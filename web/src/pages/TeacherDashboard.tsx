import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

export function TeacherDashboard() {
  const profile = useQuery({
    queryKey: ['teacher-me'],
    queryFn: async () => {
      const { data } = await api.get('/teachers/me');
      return data;
    },
  });
  const sessions = useQuery({
    queryKey: ['teacher-sessions'],
    queryFn: async () => {
      const { data } = await api.get('/teachers/me/sessions');
      return data as { id: string; scheduledAt: string; status: string; student: { profile?: { displayName?: string } } }[];
    },
  });
  const docs = useQuery({
    queryKey: ['teacher-docs'],
    queryFn: async () => {
      const { data } = await api.get('/teachers/me/documents');
      return data as { id: string; title: string; createdAt: string }[];
    },
  });

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-white">Teacher dashboard</h1>

      <section className="rounded-xl border border-slate-700 bg-slate-900/50 p-6">
        <h2 className="text-lg font-semibold text-white mb-2">Profile</h2>
        {profile.isLoading && <p className="text-slate-400">Loading…</p>}
        {profile.data && (
          <pre className="text-sm text-slate-300 overflow-auto max-h-48">
            {JSON.stringify(profile.data, null, 2)}
          </pre>
        )}
        <p className="text-slate-500 text-sm mt-2">
          Update via API <code className="text-indigo-400">PUT /teachers/me</code>
        </p>
      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-900/50 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Upcoming & past sessions</h2>
        <ul className="space-y-2">
          {(sessions.data ?? []).slice(0, 10).map((s) => (
            <li
              key={s.id}
              className="flex justify-between text-sm border-b border-slate-800 pb-2"
            >
              <span>{s.student.profile?.displayName ?? 'Student'}</span>
              <span className="text-slate-400">
                {new Date(s.scheduledAt).toLocaleString()} · {s.status}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-900/50 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Materials</h2>
        <ul className="space-y-1 text-sm text-slate-300">
          {(docs.data ?? []).map((d) => (
            <li key={d.id}>
              {d.title} · {new Date(d.createdAt).toLocaleDateString()}
            </li>
          ))}
        </ul>
        {!docs.data?.length && !docs.isLoading && (
          <p className="text-slate-500 text-sm">No documents yet.</p>
        )}
      </section>
    </div>
  );
}
