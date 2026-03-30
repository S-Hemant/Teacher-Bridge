import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { fetchMe } from '../api/client';
import { useAuth } from '../auth/AuthContext';

/** Reads OAuth tokens from hash (Google redirect) or query error. */
export function AuthCallback() {
  const { setTokens } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const qErr = params.get('oauth_error');
    if (qErr) {
      setErr(qErr);
      return;
    }

    const hash = window.location.hash.replace(/^#/, '');
    if (!hash) {
      setErr('missing_token');
      return;
    }

    const sp = new URLSearchParams(hash);
    const access = sp.get('access_token');
    const refresh = sp.get('refresh_token');
    if (!access || !refresh) {
      setErr('invalid_callback');
      return;
    }

    setTokens({
      accessToken: access,
      refreshToken: refresh,
      expiresIn: sp.get('expires_in') ?? '15m',
    });
    window.history.replaceState(null, '', window.location.pathname);

    void (async () => {
      try {
        const me = await fetchMe();
        nav(me.role === 'teacher' ? '/teacher' : '/student', { replace: true });
      } catch {
        setErr('session_failed');
      }
    })();
  }, [params, setTokens, nav]);

  if (err) {
    return (
      <div className="max-w-md mx-auto space-y-4">
        <h1 className="text-xl font-bold text-white">Sign-in issue</h1>
        <p className="text-red-400 text-sm">{err}</p>
        <button
          type="button"
          className="text-indigo-400 underline"
          onClick={() => nav('/login')}
        >
          Back to login
        </button>
      </div>
    );
  }

  return (
    <p className="text-slate-400 text-center py-12">Completing sign-in…</p>
  );
}
