import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { io, type Socket } from 'socket.io-client';
import { api } from '../api/client';

const wsBase =
  import.meta.env.VITE_WS_URL ||
  (typeof window !== 'undefined' ? window.location.origin : '');

// Stop words for naive keyword extraction if NLP keywords aren't provided
const STOP_WORDS = new Set(['about','above','after','again','against','all','and','any','because','before','below','between','both','but','down','during','each','from','further','here','into','more','most','once','only','other','over','same','some','such','that','then','there','these','this','those','through','under','until','very','what','when','where','which','while','who','whom','why','with','have','that','will','what','would','there','their','what','about','which','when','make','like','time','just','know','take','into','year','your','good','some','could','them','other','than','then','now','look','only','come','its','over','think','also','back','after','use','two','how','our','work','first','well','way','even','new','want','because','any','these','give','day','most','us']);

export function VoiceSearch() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const [status, setStatus] = useState<string | null>(null);
  const [vqId, setVqId] = useState<string | null>(null);
  const [wsNote, setWsNote] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [text, setText] = useState('');
  
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<any>(null);
  const chunks = useRef<Blob[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const backdropRef = useRef<HTMLDivElement | null>(null);

  const createPresign = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/voice-queries', {
        contentType: 'audio/webm',
      });
      return data as { voiceQueryId: string; uploadUrl: string };
    },
  });

  const poll = useQuery({
    queryKey: ['voice', vqId],
    queryFn: async () => {
      const { data } = await api.get(`/voice-queries/${vqId}`);
      return data as {
        status: string;
        transcript?: string;
        nlpResult?: { keywords?: string[] };
        recommendations?: {
          rank: number;
          score: number;
          teacher: {
            userId: string;
            user: { profile?: { displayName?: string } };
            headline?: string;
          };
        }[];
      };
    },
    enabled: !!vqId,
    refetchInterval: (q) =>
      q.state.data?.status === 'done' || q.state.data?.status === 'failed'
        ? false
        : 2000,
  });

  const updateTranscriptMutation = useMutation({
    mutationFn: async (newText: string) => {
      const { data } = await api.patch(`/voice-queries/${vqId}`, { transcript: newText });
      return data;
    },
    onSuccess: (data) => {
      qc.setQueryData(['voice', vqId], data);
    },
  });

  useEffect(() => {
    if (poll.data?.status === 'done' && poll.data.transcript && !text) {
      setText(poll.data.transcript);
    }
  }, [poll.data?.status, poll.data?.transcript, text]);

  useEffect(() => {
    const done = poll.data?.status === 'done';
    if (done && text && text !== poll.data?.transcript) {
      const timer = setTimeout(() => {
        updateTranscriptMutation.mutate(text);
      }, 750);
      return () => clearTimeout(timer);
    }
  }, [text, poll.data?.status, poll.data?.transcript, updateTranscriptMutation]);

  useEffect(() => {
    if (!vqId) return;
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const s = io(`${wsBase}/ws`, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = s;
    s.on('connect', () => setWsNote('Live updates connected'));
    s.on('disconnect', () => setWsNote(null));
    s.on('voiceQuery.completed', (payload: { voiceQueryId: string; status: string }) => {
      if (payload.voiceQueryId === vqId) {
        void qc.invalidateQueries({ queryKey: ['voice', vqId] });
        setStatus(
          payload.status === 'done'
            ? 'Processing complete (WebSocket).'
            : 'Processing failed (WebSocket).',
        );
      }
    });

    return () => {
      s.disconnect();
      socketRef.current = null;
    };
  }, [vqId, qc]);

  async function startRecording() {
    setStatus(null);
    setLiveTranscript('');
    chunks.current = [];
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorder.current = mr;
      mr.ondataavailable = (e) => {
        if (e.data.size) chunks.current.push(e.data);
      };
      mr.start();
      setIsRecording(true);
      setStatus('Listening to your voice...');

      // Attempt to use native Speech Recognition for real-time overlay
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.onresult = (event: any) => {
          let currentTranscript = '';
          for (let i = 0; i < event.results.length; i++) {
            currentTranscript += event.results[i][0].transcript;
          }
          setLiveTranscript(currentTranscript);
          setText(currentTranscript);
        };
        recognition.start();
        recognitionRef.current = recognition;
      }
    } catch (err) {
      setStatus('Microphone access denied or unavailable.');
    }
  }

  async function stopAndUpload() {
    const mr = mediaRecorder.current;
    if (!mr) return;
    setIsRecording(false);
    
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    await new Promise<void>((resolve) => {
      mr.onstop = () => resolve();
      mr.stop();
      mr.stream.getTracks().forEach((t) => t.stop());
    });
    
    const blob = new Blob(chunks.current, { type: 'audio/webm' });
    setStatus('Uploading audio securely...');

    try {
      const presign = await createPresign.mutateAsync();
      await fetch(presign.uploadUrl, {
        method: 'PUT',
        body: blob,
        headers: { 'Content-Type': 'audio/webm' },
      });
      await api.post(`/voice-queries/${presign.voiceQueryId}/complete`);
      setVqId(presign.voiceQueryId);
      setStatus('AI is analyzing your request...');
    } catch (err) {
      setStatus('Failed to upload audio. Please try again.');
    }
  }

  const done = poll.data?.status === 'done';
  const failed = poll.data?.status === 'failed';
  
  // Extract keywords either from the backend NLP result or naively from transcript
  const getKeywords = () => {
    const sourceText = text || poll.data?.transcript || '';
    if (!sourceText) return [];
    if (sourceText === poll.data?.transcript && poll.data.nlpResult?.keywords && poll.data.nlpResult.keywords.length > 0) {
      return poll.data.nlpResult.keywords;
    }
    // Naive extraction: words > 4 chars, not in stop list
    const words = sourceText.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/);
    const uniqueWords = Array.from(new Set(words));
    return uniqueWords.filter(w => w.length > 4 && !STOP_WORDS.has(w)).slice(0, 5);
  };

  const keywords = getKeywords();

  const sharedTextClasses = "w-full min-h-[120px] p-4 text-sm leading-relaxed italic font-sans border rounded-xl break-words whitespace-pre-wrap";

  const renderHighlightedText = () => {
    if (!text) return null;
    const he = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    let rendered = he;
    // Sort keywords by length descending to avoid partial matches
    const sortedKw = [...keywords].sort((a,b) => b.length - a.length);
    sortedKw.forEach(kw => {
      const regex = new RegExp(`\\b(${kw})\\b`, 'gi');
      rendered = rendered.replace(regex, '<mark class="bg-indigo-500/40 text-indigo-200 px-0.5 rounded shadow-sm">$1</mark>');
    });
    return <span dangerouslySetInnerHTML={{ __html: rendered }} />;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 to-indigo-400">
          Smart Voice Match
        </h1>
        <p className="text-slate-400 text-lg">
          Just tell us what you want to learn. Our AI will analyze your audio and find the best verified teachers for you immediately.
        </p>
      </div>

      {/* Recording Interface */}
      <div className="bg-slate-900/50 backdrop-blur-md border border-slate-700/50 rounded-3xl p-8 sm:p-12 shadow-xl flex flex-col items-center justify-center relative overflow-hidden">
        
        {/* Pulsing ring background when recording */}
        {isRecording && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="w-64 h-64 bg-rose-500/20 rounded-full animate-ping absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"></div>
            <div className="w-48 h-48 bg-rose-500/20 rounded-full animate-pulse absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animation-delay-150"></div>
          </div>
        )}

        <button
          type="button"
          onClick={isRecording ? stopAndUpload : startRecording}
          disabled={createPresign.isPending}
          className={`relative z-10 flex flex-col items-center justify-center w-32 h-32 rounded-full transition-all duration-300 shadow-2xl focus:outline-none ${
            isRecording 
              ? 'bg-rose-500 hover:bg-rose-600 scale-110 shadow-rose-500/50' 
              : 'bg-indigo-500 hover:bg-indigo-600 hover:scale-105 shadow-indigo-500/30'
          }`}
        >
          {isRecording ? (
             <svg className="w-12 h-12 text-white animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" /></svg>
          ) : (
            <svg className="w-12 h-12 text-white ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
          )}
        </button>

        <p className={`mt-6 font-medium text-lg z-10 ${isRecording ? 'text-rose-400 animate-pulse' : 'text-slate-300'}`}>
          {isRecording ? 'Listening now... Click to stop' : 'Tap microphone to speak'}
        </p>

        {status && !isRecording && (
          <div className="mt-4 px-4 py-2 bg-slate-800/80 rounded-full border border-slate-700 text-sm text-indigo-300 shadow-inner z-10 flex items-center space-x-2">
             {!done && !failed && (
               <svg className="animate-spin h-4 w-4 text-indigo-400" xmlns="http://www.w0.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
             )}
             <span>{status}</span>
          </div>
        )}

        {/* Live Transcription Overlay */}
        {isRecording && liveTranscript && (
          <div className="absolute bottom-8 w-full max-w-lg px-8 text-center z-10">
             <div className="p-4 bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-700/50 shadow-2xl">
               <p className="text-white text-lg font-light leading-relaxed italic">"{liveTranscript}"</p>
             </div>
          </div>
        )}
      </div>

      {/* Results Section */}
      {done && poll.data && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 opacity-0 animate-in slide-in-from-bottom-4 fade-in fill-mode-forwards duration-500">
          
          {/* Analysis Column */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-slate-900/40 border border-slate-700/50 rounded-2xl p-6 shadow-lg">
              <div className="flex items-center space-x-3 mb-4 text-emerald-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                <h3 className="font-semibold text-lg text-white">Audio Captured</h3>
              </div>
              
              <div className="relative flex flex-col group mt-2">
                 {updateTranscriptMutation.isPending && (
                   <span className="absolute top-3 right-4 text-[10px] text-fuchsia-400 animate-pulse z-20 font-bold uppercase tracking-wider">
                     Updating...
                   </span>
                 )}
                 {/* Backdrop div */}
                 <div
                   ref={backdropRef}
                   className={`${sharedTextClasses} absolute inset-0 bg-slate-800/40 border-slate-700/30 text-slate-300 pointer-events-none z-0 overflow-hidden`}
                   aria-hidden="true"
                 >
                   {renderHighlightedText()}
                 </div>
                 {/* Foreground textarea */}
                 <textarea
                   className={`${sharedTextClasses} relative bg-transparent border-transparent text-transparent caret-white z-10 outline-none focus:ring-2 focus:ring-indigo-500/50 resize-y`}
                   value={text}
                   onChange={e => setText(e.target.value)}
                   onScroll={e => {
                     if (backdropRef.current) backdropRef.current.scrollTop = e.currentTarget.scrollTop;
                   }}
                   spellCheck={false}
                 />
                 <div className="mt-2 flex justify-between px-1">
                   <p className="text-[11px] text-slate-500 flex items-center">
                     <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                     Click inside to edit your transcription
                   </p>
                 </div>
              </div>

              {keywords.length > 0 && (
                <div className="mt-6">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Extracted Keywords</p>
                  <div className="flex flex-wrap gap-2">
                    {keywords.map((kw, i) => (
                      <button
                        key={i}
                        onClick={() => nav(`/student/discover?q=${encodeURIComponent(kw)}`)}
                        className="px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 hover:border-indigo-500/50 rounded-lg text-indigo-300 text-sm transition-all focus:ring-2 focus:ring-indigo-500/50 outline-none"
                        title={`Search for ${kw}`}
                      >
                        {kw}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500 mt-3 flex items-center">
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    Click any keyword to run a manual search.
                  </p>
                </div>
              )}
            </div>
            {wsNote && (
              <p className="text-xs text-slate-500 flex items-center justify-center">
                <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse"></span>
                {wsNote}
              </p>
            )}
          </div>

          {/* Recommendations Column */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-xl font-bold text-white mb-4">Top AI Recommendations</h2>
            
            {(poll.data.recommendations ?? []).length === 0 ? (
              <div className="bg-slate-900/30 rounded-2xl p-8 border border-dashed border-slate-700 text-center">
                <p className="text-slate-400">No specific teachers matched your voice query.</p>
                <button onClick={() => nav('/student/discover')} className="mt-4 text-indigo-400 hover:text-indigo-300 font-medium">Browse anonymously</button>
              </div>
            ) : (
              (poll.data.recommendations ?? []).map((r, i) => (
                <Link
                  key={r.rank}
                  to={`/teachers/${r.teacher.userId}`}
                  className="block bg-slate-800/40 hover:bg-slate-800 border border-slate-700/50 hover:border-indigo-500/50 rounded-2xl p-5 transition-all hover:shadow-lg hover:-translate-y-1 group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-inner">
                        {(r.teacher.user.profile?.displayName || 'T').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white group-hover:text-indigo-300 transition-colors">
                          {r.teacher.user.profile?.displayName ?? 'Teacher'}
                        </h3>
                        <p className="text-sm text-slate-400">{r.teacher.headline || 'Expert Teacher'}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <div className="flex items-baseline space-x-1">
                        <span className="text-2xl font-bold text-emerald-400">{r.score.toFixed(1)}</span>
                        <span className="text-xs text-slate-500 uppercase tracking-widest font-semibold">Match</span>
                      </div>
                      {i === 0 && <span className="mt-1 px-2 py-0.5 bg-fuchsia-500/20 border border-fuchsia-500/30 text-fuchsia-300 text-[10px] uppercase tracking-wider rounded font-bold">Best Fit</span>}
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>

        </div>
      )}

      {failed && (
        <div className="bg-rose-500/10 border border-rose-500/30 p-6 rounded-2xl flex flex-col items-center justify-center text-center">
          <svg className="w-10 h-10 text-rose-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
          <h3 className="text-rose-400 font-bold text-lg mb-1">Processing Failed</h3>
          <p className="text-sm text-slate-400">Our AI was unable to analyze your query. The audio might have been too short or noisy.</p>
        </div>
      )}
    </div>
  );
}
