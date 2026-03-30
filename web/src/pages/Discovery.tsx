import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

type TeacherRow = {
  id: string;
  headline?: string;
  hourlyRateCents: number;
  currency: string;
  ratingAvg: number;
  reviewCount: number;
  profile?: { displayName?: string };
  primarySubject?: { name: string };
};

export function Discovery() {
  const [q, setQ] = useState('');
  const [subject, setSubject] = useState('');
  const list = useQuery({
    queryKey: ['teachers', q, subject],
    queryFn: async () => {
      const { data } = await api.get('/teachers', {
        params: { q: q || undefined, subject: subject || undefined, limit: 24 },
      });
      return data as { data: TeacherRow[] };
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Find teachers</h1>
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          className="flex-1 rounded-lg bg-slate-800 border border-slate-600 px-3 py-2 text-white"
          placeholder="Search name or headline"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <input
          className="sm:w-48 rounded-lg bg-slate-800 border border-slate-600 px-3 py-2 text-white"
          placeholder="Subject slug (e.g. mathematics)"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
      </div>
      {list.isLoading && <p className="text-slate-400">Loading…</p>}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {(list.data?.data ?? []).map((t) => (
          <Link
            key={t.id}
            to={`/teachers/${t.id}`}
            className="block rounded-xl border border-slate-700 bg-slate-900/50 p-4 hover:border-indigo-500/50 transition"
          >
            <h3 className="font-semibold text-white">
              {t.profile?.displayName ?? 'Teacher'}
            </h3>
            <p className="text-sm text-slate-400 mt-1 line-clamp-2">{t.headline}</p>
            <p className="text-sm text-indigo-300 mt-2">
              {t.primarySubject?.name ?? 'Subject'} · {(t.hourlyRateCents / 100).toFixed(0)}{' '}
              {t.currency}/hr
            </p>
            <p className="text-xs text-slate-500 mt-1">
              ★ {t.ratingAvg} ({t.reviewCount} reviews)
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
