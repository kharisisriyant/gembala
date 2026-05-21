"use client";

import { useState, useEffect, useCallback } from "react";

interface Tag {
  id: string;
  name: string;
  colour: string;
  description: string | null;
}

export default function TagsPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", colour: "#6366f1", description: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchTags = useCallback(async () => {
    const res = await fetch("/api/tags");
    if (res.ok) setTags(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchTags(); }, [fetchTags]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setForm({ name: "", colour: "#6366f1", description: "" });
      fetchTags();
    } else {
      const data = await res.json();
      setError(data.error || "Failed to create tag");
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this tag? Members with this tag will lose the assignment.")) return;
    await fetch(`/api/tags/${id}`, { method: "DELETE" });
    fetchTags();
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Tag Management</h1>

      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <h2 className="text-base font-medium text-gray-800 mb-4">Create Tag</h2>
        <form onSubmit={handleCreate} className="space-y-3">
          <div className="flex gap-3">
            <input
              type="text"
              required
              placeholder="Tag name"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            />
            <input
              type="color"
              value={form.colour}
              onChange={(e) => setForm((p) => ({ ...p, colour: e.target.value }))}
              className="w-10 h-10 rounded border border-gray-300 cursor-pointer"
              title="Tag colour"
            />
          </div>
          <input
            type="text"
            placeholder="Description (optional)"
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "Creating…" : "Create Tag"}
          </button>
        </form>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
        {loading ? (
          <p className="p-4 text-sm text-gray-500">Loading…</p>
        ) : tags.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">No tags yet.</p>
        ) : (
          tags.map((tag) => (
            <div key={tag.id} className="flex items-center gap-3 px-4 py-3">
              <span
                className="w-4 h-4 rounded-full flex-shrink-0"
                style={{ backgroundColor: tag.colour }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{tag.name}</p>
                {tag.description && (
                  <p className="text-xs text-gray-500 truncate">{tag.description}</p>
                )}
              </div>
              <button
                onClick={() => handleDelete(tag.id)}
                className="text-xs text-red-500 hover:underline"
              >
                Delete
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
