import { useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function RequireAuth({
  role,
  children,
}: {
  role?: 'teacher' | 'student';
  children: ReactNode;
}) {
  const { user, loading } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      nav('/login', { replace: true });
      return;
    }
    if (role && user.role !== role) {
      nav(user.role === 'teacher' ? '/teacher' : '/student', { replace: true });
    }
  }, [user, loading, role, nav]);

  if (loading || !user) {
    return (
      <div className="text-slate-400 py-12 text-center">Loading…</div>
    );
  }
  if (role && user.role !== role) {
    return null;
  }
  return <>{children}</>;
}
