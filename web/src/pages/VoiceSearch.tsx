import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { io, type Socket } from 'socket.io-client';
import { api } from '../api/client';

const wsBase =
  import.meta.env.VITE_WS_URL ||
  (typeof window !== 'undefined' ? window.location.origin : '');

export function VoiceSearch() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<string | null>(null);
  const [vqId, setVqId] = useState<string | null>(null);
  const [wsNote, setWsNote] = useState<string | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const socketRef = useRef<Socket | null>(null);

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
        recommendations?: {
          rank: number;
          score: number;
          teacher: {
            userId: string;
            user: { profile?: { displayName?: string } };
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
    chunks.current = [];
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
    mediaRecorder.current = mr;
    mr.ondataavailable = (e) => {
      if (e.data.size) chunks.current.push(e.data);
    };
    mr.start();
    setStatus('Recording… click Stop when done.');
  }

  async function stopAndUpload() {
    const mr = mediaRecorder.current;
    if (!mr) return;
    await new Promise<void>((resolve) => {
      mr.onstop = () => resolve();
      mr.stop();
      mr.stream.getTracks().forEach((t) => t.stop());
    });
    const blob = new Blob(chunks.current, { type: 'audio/webm' });
    setStatus('Uploading…');

    const presign = await createPresign.mutateAsync();
    await fetch(presign.uploadUrl, {
      method: 'PUT',
      body: blob,
      headers: { 'Content-Type': 'audio/webm' },
    });
    await api.post(`/voice-queries/${presign.voiceQueryId}/complete`);
    setVqId(presign.voiceQueryId);
    setStatus('Processing on server…');
  }

  const done = poll.data?.status === 'done';
  const failed = poll.data?.status === 'failed';

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-white">Voice match</h1>
      <p className="text-slate-400">
        Record a short description of what you need help with. We transcribe it, infer subject
        and keywords, then recommend teachers. When a job finishes, the UI updates via WebSocket (
        {wsNote ?? 'connecting…'}).
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void startRecording()}
          className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white"
        >
          Start recording
        </button>
        <button
          type="button"
          onClick={() => void stopAndUpload()}
          className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white"
        >
          Stop & upload
        </button>
      </div>
      {status && <p className="text-slate-300 text-sm">{status}</p>}
      {done && poll.data && (
        <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-4 space-y-3">
          <p className="text-white font-medium">Transcript</p>
          <p className="text-slate-300 text-sm">{poll.data.transcript}</p>
          <p className="text-white font-medium pt-2">Recommended teachers</p>
          <ul className="space-y-2">
            {(poll.data.recommendations ?? []).map((r) => (
              <li key={r.rank} className="flex justify-between text-sm">
                <Link
                  to={`/teachers/${r.teacher.userId}`}
                  className="text-indigo-400 hover:underline"
                >
                  {r.teacher.user.profile?.displayName ?? 'Teacher'}
                </Link>
                <span className="text-slate-500">score {r.score.toFixed(1)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {failed && <p className="text-red-400">Processing failed. Check API logs / storage.</p>}
    </div>
  );
}
