import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function Register() {
  const { signUp, user } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'teacher' | 'student'>('student');
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
      await signUp(email, password, role);
      nav(role === 'teacher' ? '/teacher' : '/student');
    } catch {
      setErr('Could not register. Email may already exist.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">Create account</h1>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-slate-400 mb-1">I am a</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="role"
                checked={role === 'student'}
                onChange={() => setRole('student')}
              />
              Student
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="role"
                checked={role === 'teacher'}
                onChange={() => setRole('teacher')}
              />
              Teacher
            </label>
          </div>
        </div>
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
          <label className="block text-sm text-slate-400 mb-1">Password (min 8)</label>
          <input
            className="w-full rounded-lg bg-slate-800 border border-slate-600 px-3 py-2 text-white"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>
        {err && <p className="text-red-400 text-sm">{err}</p>}
        <button
          type="submit"
          disabled={pending}
          className="w-full py-2.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white font-medium"
        >
          {pending ? 'Creating…' : 'Create account'}
        </button>
      </form>
      <p className="mt-4 text-slate-400 text-sm">
        Already have an account?{' '}
        <Link to="/login" className="text-indigo-400 hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
