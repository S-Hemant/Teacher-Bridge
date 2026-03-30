import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export function StudentDashboard() {
  const sessions = useQuery({
    queryKey: ['student-sessions'],
    queryFn: async () => {
      const { data } = await api.get('/students/me/sessions');
      return data as { id: string; scheduledAt: string; status: string }[];
    },
  });
  const progress = useQuery({
    queryKey: ['student-progress'],
    queryFn: async () => {
      const { data } = await api.get('/students/me/progress');
      return data as {
        entries: { metricKey: string; value: unknown; recordedAt: string }[];
        completedSessions: number;
      };
    },
  });
  const saved = useQuery({
    queryKey: ['saved-teachers'],
    queryFn: async () => {
      const { data } = await api.get('/students/me/saved-teachers');
      return data as { teacher: { id: string; profile?: { displayName?: string } } }[];
    },
  });

  const chartData = (progress.data?.entries ?? [])
    .filter((e) => e.metricKey === 'score')
    .map((e, i) => ({
      name: new Date(e.recordedAt).toLocaleDateString(),
      value: typeof e.value === 'object' && e.value && 'v' in e.value ? Number((e.value as { v: number }).v) : i,
    }));

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-white">Student dashboard</h1>

      <div className="grid md:grid-cols-2 gap-6">
        <section className="rounded-xl border border-slate-700 bg-slate-900/50 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Sessions</h2>
          {sessions.isLoading && <p className="text-slate-400">Loading…</p>}
          <ul className="space-y-2">
            {(sessions.data ?? []).slice(0, 6).map((s) => (
              <li
                key={s.id}
                className="flex justify-between text-sm border-b border-slate-800 pb-2"
              >
                <span>{new Date(s.scheduledAt).toLocaleString()}</span>
                <span className="text-slate-400">{s.status}</span>
              </li>
            ))}
            {!sessions.data?.length && !sessions.isLoading && (
              <p className="text-slate-500 text-sm">No sessions yet.</p>
            )}
          </ul>
          <Link
            to="/student/discover"
            className="inline-block mt-4 text-indigo-400 text-sm hover:underline"
          >
            Book a teacher
          </Link>
        </section>

        <section className="rounded-xl border border-slate-700 bg-slate-900/50 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Progress</h2>
          <p className="text-slate-400 text-sm mb-2">
            Completed sessions: {progress.data?.completedSessions ?? 0}
          </p>
          {chartData.length > 0 ? (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid stroke="#334155" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} />
                  <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #475569' }} />
                  <Line type="monotone" dataKey="value" stroke="#818cf8" dot />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-slate-500 text-sm">
              Add progress entries with metric &quot;score&quot; to see a chart.
            </p>
          )}
        </section>
      </div>

      <section className="rounded-xl border border-slate-700 bg-slate-900/50 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Saved teachers</h2>
        <div className="flex flex-wrap gap-3">
          {(saved.data ?? []).map((s) => (
            <Link
              key={s.teacher.id}
              to={`/teachers/${s.teacher.id}`}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm"
            >
              {s.teacher.profile?.displayName ?? 'Teacher'}
            </Link>
          ))}
          {!saved.data?.length && !saved.isLoading && (
            <p className="text-slate-500 text-sm">No saved teachers yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
