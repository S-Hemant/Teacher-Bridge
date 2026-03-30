import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';

export function TeacherDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const qc = useQueryClient();

  const detail = useQuery({
    queryKey: ['teacher', id],
    queryFn: async () => {
      const { data } = await api.get(`/teachers/${id}`);
      return data;
    },
    enabled: !!id,
  });

  const save = useMutation({
    mutationFn: async () => {
      await api.post('/students/me/saved-teachers', { teacherUserId: id });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saved-teachers'] }),
  });

  if (!id) return null;
  if (detail.isLoading) return <p className="text-slate-400">Loading…</p>;
  if (detail.isError || !detail.data) {
    return <p className="text-red-400">Teacher not found.</p>;
  }

  const t = detail.data as {
    profile?: { displayName?: string; bio?: string };
    headline?: string;
    hourlyRateCents: number;
    currency: string;
    ratingAvg: number;
    reviewCount: number;
    subjects: { name: string }[];
    reviews: { rating: number; comment?: string; studentName: string }[];
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">
          {t.profile?.displayName ?? 'Teacher'}
        </h1>
        <p className="text-slate-400 mt-1">{t.headline}</p>
        <p className="text-indigo-300 mt-2">
          {(t.hourlyRateCents / 100).toFixed(0)} {t.currency}/hr · ★ {t.ratingAvg} (
          {t.reviewCount})
        </p>
        <p className="text-sm text-slate-500 mt-2">
          Subjects: {t.subjects.map((s) => s.name).join(', ')}
        </p>
      </div>
      {user?.role === 'student' && (
        <button
          type="button"
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm"
        >
          {save.isPending ? 'Saving…' : 'Save teacher'}
        </button>
      )}
      <section>
        <h2 className="text-lg font-semibold text-white mb-2">Reviews</h2>
        <ul className="space-y-3">
          {t.reviews.map((r) => (
            <li key={r.studentName + r.rating} className="border-b border-slate-800 pb-2">
              <span className="text-amber-400">★ {r.rating}</span>{' '}
              <span className="text-slate-300">{r.comment}</span>
              <span className="text-slate-500 text-sm ml-2">— {r.studentName}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
