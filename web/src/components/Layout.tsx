import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2 rounded-md text-sm font-medium ${
    isActive ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-800'
  }`;

export function Layout() {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-slate-700 bg-slate-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center gap-4 justify-between">
          <Link to="/" className="text-lg font-semibold text-indigo-400">
            Teacher Bridge
          </Link>
          <nav className="flex flex-wrap gap-1 items-center">
            {user?.role === 'student' && (
              <>
                <NavLink to="/student" className={linkClass} end>
                  Dashboard
                </NavLink>
                <NavLink to="/student/discover" className={linkClass}>
                  Find teachers
                </NavLink>
                <NavLink to="/student/voice" className={linkClass}>
                  Voice match
                </NavLink>
              </>
            )}
            {user?.role === 'teacher' && (
              <>
                <NavLink to="/teacher" className={linkClass} end>
                  Dashboard
                </NavLink>
              </>
            )}
            {!user && (
              <>
                <NavLink to="/login" className={linkClass}>
                  Log in
                </NavLink>
                <NavLink to="/register" className={linkClass}>
                  Sign up
                </NavLink>
              </>
            )}
            {user && (
              <button
                type="button"
                onClick={() => signOut()}
                className="ml-2 px-3 py-2 text-sm rounded-md bg-slate-800 text-slate-200 hover:bg-slate-700"
              >
                Sign out
              </button>
            )}
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
