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
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">Log in</h1>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-slate-400 mb-1">Email</label>
          <input
            className="w-full rounded-lg bg-slate-800 border border-slate-600 px-3 py-2 text-white"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Password</label>
          <input
            className="w-full rounded-lg bg-slate-800 border border-slate-600 px-3 py-2 text-white"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>
        {err && <p className="text-red-400 text-sm">{err}</p>}
        <button
          type="submit"
          disabled={pending}
          className="w-full py-2.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white font-medium"
        >
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <div className="mt-6 pt-6 border-t border-slate-700 space-y-3">
        <p className="text-slate-500 text-sm text-center">Or continue with</p>
        <div className="flex flex-wrap gap-2 justify-center">
          <a
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm text-white border border-slate-600"
            href={`${typeof window !== 'undefined' ? window.location.origin : ''}/api/v1/auth/google?role=student`}
          >
            Google (student)
          </a>
          <a
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm text-white border border-slate-600"
            href={`${typeof window !== 'undefined' ? window.location.origin : ''}/api/v1/auth/google?role=teacher`}
          >
            Google (teacher)
          </a>
        </div>
        <p className="text-slate-500 text-xs text-center">
          Configure <code className="text-indigo-400">GOOGLE_CLIENT_ID</code> on the API.
        </p>
      </div>
      <p className="mt-4 text-slate-400 text-sm">
        No account?{' '}
        <Link to="/register" className="text-indigo-400 hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
