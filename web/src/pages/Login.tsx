import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchMe } from '../api/client';
import { useAuth } from '../auth/AuthContext';

export function Login() {
  const { signIn, user } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (user) {
      nav(user.role === 'teacher' ? '/teacher' : '/student', { replace: true });
    }
  }, [user, nav]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setPending(true);
    try {
      await signIn(email, password);
      const me = await fetchMe();
      nav(me.role === 'teacher' ? '/teacher' : '/student', { replace: true });
    } catch {
      setErr('Invalid email or password.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[75vh] relative py-12">
      {/* Decorative Background Elements */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none -z-10"></div>
      <div className="absolute top-10 right-10 w-[300px] h-[300px] bg-purple-600/20 rounded-full blur-[100px] pointer-events-none -z-10"></div>

      <div className="w-full max-w-md relative z-10">
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-8 sm:p-10 shadow-2xl transition-all duration-300 hover:shadow-indigo-500/10">
          
          <div className="text-center mb-10">
            <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400 mb-2 tracking-tight">
              Welcome Back
            </h1>
            <p className="text-slate-400 text-sm">Sign in to access your dashboard</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-6">
            <div className="space-y-2 relative group">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider ml-1">Email</label>
              <div className="relative">
                <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <input
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-xl py-3 pl-12 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all duration-200"
                  type="email"
                  placeholder="student1@demo.local"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="space-y-2 relative group">
              <div className="flex justify-between items-center ml-1">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Password</label>
                <a href="#" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">Forgot?</a>
              </div>
              <div className="relative">
                <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <input
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-xl py-3 pl-12 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all duration-200"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>

            {err && (
              <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 flex items-center text-rose-400 text-sm">
                <svg className="w-5 h-5 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                {err}
              </div>
            )}

            <button
              type="submit"
              disabled={pending}
              className="w-full relative group overflow-hidden rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 py-3.5 text-white font-semibold shadow-lg shadow-indigo-500/25 transition-all hover:shadow-indigo-500/40 hover:-translate-y-0.5 disabled:opacity-70 disabled:hover:translate-y-0"
            >
              <div className="absolute inset-0 w-full h-full bg-white/20 scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-300 ease-out"></div>
              <span className="relative flex items-center justify-center space-x-2">
                {pending ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                     <span>Authenticating...</span>
                  </>
                ) : (
                  <span>Sign In &rarr;</span>
                )}
              </span>
            </button>
          </form>

          <div className="mt-8 mb-6 flex items-center">
            <div className="flex-1 border-t border-slate-700"></div>
            <span className="px-4 text-xs text-slate-500 uppercase tracking-widest font-medium">Or continue with</span>
            <div className="flex-1 border-t border-slate-700"></div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <a
              className="flex-1 flex justify-center items-center py-2.5 px-4 rounded-xl bg-slate-800/80 border border-slate-700 hover:bg-slate-700 hover:border-slate-500 transition-all text-sm text-slate-200 group"
              href={`${typeof window !== 'undefined' ? window.location.origin : ''}/api/v1/auth/google?role=student`}
            >
              <svg className="w-4 h-4 mr-2 text-slate-400 group-hover:text-white transition-colors" viewBox="0 0 24 24" fill="currentColor"><path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.64 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"/></svg>
              Student
            </a>
            <a
              className="flex-1 flex justify-center items-center py-2.5 px-4 rounded-xl bg-slate-800/80 border border-slate-700 hover:bg-slate-700 hover:border-slate-500 transition-all text-sm text-slate-200 group"
              href={`${typeof window !== 'undefined' ? window.location.origin : ''}/api/v1/auth/google?role=teacher`}
            >
              <svg className="w-4 h-4 mr-2 text-slate-400 group-hover:text-white transition-colors" viewBox="0 0 24 24" fill="currentColor"><path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.64 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"/></svg>
              Teacher
            </a>
          </div>
        </div>

        <p className="mt-8 text-center text-slate-400 text-sm">
          Don't have an account?{' '}
          <Link to="/register" className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors hover:underline underline-offset-4">
            Create one now
          </Link>
        </p>
      </div>
    </div>
  );
}
