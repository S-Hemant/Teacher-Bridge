import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function Home() {
  const { user } = useAuth();
  return (
    <div className="space-y-8">
      <section className="rounded-2xl bg-gradient-to-br from-indigo-900/50 to-slate-900 border border-slate-700 p-8 md:p-12">
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
          Smart bridge between teachers and students
        </h1>
        <p className="text-slate-300 max-w-2xl text-lg">
          Discover tutors by subject and availability, track progress, share materials, and
          describe what you need by voice — we match you with the right educator.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          {!user && (
            <>
              <Link
                to="/register"
                className="inline-flex items-center px-5 py-2.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white font-medium"
              >
                Get started
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center px-5 py-2.5 rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-800"
              >
                Log in
              </Link>
            </>
          )}
          {user?.role === 'student' && (
            <Link
              to="/student/discover"
              className="inline-flex items-center px-5 py-2.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white font-medium"
            >
              Find teachers
            </Link>
          )}
          {user?.role === 'teacher' && (
            <Link
              to="/teacher"
              className="inline-flex items-center px-5 py-2.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white font-medium"
            >
              Open dashboard
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}
