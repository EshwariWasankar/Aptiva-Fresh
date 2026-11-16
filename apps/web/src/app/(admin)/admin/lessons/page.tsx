'use client';

import { useEffect, useState } from 'react';
import {
  adminListLessons,
  createLesson,
  updateLesson,
  type Lesson,
} from '../../../../lib/adminExtras';
import { adminListTopics, type TopicNode } from '../../../../lib/content';

export default function AdminLessonsPage() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [topics, setTopics] = useState<TopicNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Lesson | null>(null);
  const [form, setForm] = useState({
    topicId: '',
    title: '',
    content: '',
    status: 'draft' as 'draft' | 'published',
  });
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([adminListLessons(), adminListTopics()])
      .then(([l, t]) => {
        setLessons(l);
        setTopics(t);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  function startEdit(l: Lesson) {
    setEditing(l);
    setForm({ topicId: l.topicId, title: l.title, content: l.content, status: l.status });
    setMsg(null);
  }

  function resetForm() {
    setEditing(null);
    setForm({ topicId: '', title: '', content: '', status: 'draft' });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      if (editing) {
        const updated = await updateLesson(editing.id, form);
        setLessons((prev) => prev.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)));
        setMsg('Lesson updated.');
      } else {
        const created = await createLesson(form);
        setLessons((prev) => [created, ...prev]);
        setMsg('Lesson created.');
      }
      resetForm();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Save failed');
    }
  }

  async function toggleStatus(l: Lesson) {
    try {
      const updated = await updateLesson(l.id, {
        status: l.status === 'published' ? 'draft' : 'published',
      });
      setLessons((prev) => prev.map((x) => (x.id === l.id ? { ...x, ...updated } : x)));
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Lessons</h1>
        <p className="mt-1 text-sm text-slate-600">
          Concept-repair content shown to students before targeted-practice blocks. Published
          lessons appear in practice sessions.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && <p className="text-sm text-slate-500">Loading…</p>}

      <form onSubmit={(e) => void onSubmit(e)} className="bento-card flex flex-col gap-3 p-5">
        <h2 className="text-sm font-semibold text-slate-800">
          {editing ? 'Edit lesson' : 'New lesson'}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <select
            required
            value={form.topicId}
            onChange={(e) => setForm({ ...form, topicId: e.target.value })}
            className="rounded-md border border-[#9daeac]/40 px-3 py-2 text-sm"
          >
            <option value="">Select topic…</option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <input
            required
            placeholder="Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="rounded-md border border-[#9daeac]/40 px-3 py-2 text-sm"
          />
        </div>
        <textarea
          required
          rows={8}
          placeholder="Lesson content (supports LaTeX $...$)"
          value={form.content}
          onChange={(e) => setForm({ ...form, content: e.target.value })}
          className="rounded-md border border-[#9daeac]/40 px-3 py-2 font-mono text-sm"
        />
        <div className="flex items-center gap-3">
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as 'draft' | 'published' })}
            className="rounded-md border border-[#9daeac]/40 px-3 py-2 text-sm"
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
          <button
            type="submit"
            className="rounded-md bg-[#174c4b] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            {editing ? 'Save changes' : 'Create lesson'}
          </button>
          {editing && (
            <button type="button" onClick={resetForm} className="text-sm text-slate-500 underline">
              Cancel
            </button>
          )}
          {msg && <span className="text-xs text-slate-600">{msg}</span>}
        </div>
      </form>

      <div className="bento-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#9daeac]/30 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Topic</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Updated</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {lessons.map((l) => (
              <tr key={l.id} className="border-b border-[#9daeac]/15 last:border-0">
                <td className="px-4 py-2.5 font-medium text-slate-800">{l.title}</td>
                <td className="px-4 py-2.5 text-slate-600">
                  {l.topic?.name ?? l.topicId.slice(0, 8)}
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                      l.status === 'published'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {l.status}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-xs text-slate-500">
                  {new Date(l.updatedAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    type="button"
                    onClick={() => startEdit(l)}
                    className="mr-3 text-xs text-blue-700 underline"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void toggleStatus(l)}
                    className="text-xs text-slate-600 underline"
                  >
                    {l.status === 'published' ? 'Unpublish' : 'Publish'}
                  </button>
                </td>
              </tr>
            ))}
            {lessons.length === 0 && !loading && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500">
                  No lessons yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
