"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Member {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  gender: string | null;
  type: string;
  joinedAt: string;
}

interface Tag {
  id: string;
  name: string;
  colour: string;
}

export default function MembersPage() {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    email: "",
    gender: "",
    maritalStatus: "",
    joinedAt: new Date().toISOString().split("T")[0],
    type: "regular",
    tagIds: [] as string[],
  });
  const [saving, setSaving] = useState(false);

  const fetchMembers = useCallback(async () => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (tagFilter) params.set("tag", tagFilter);
    if (typeFilter) params.set("type", typeFilter);
    const res = await fetch(`/api/members?${params}`);
    if (res.ok) setMembers(await res.json());
    setLoading(false);
  }, [search, tagFilter, typeFilter]);

  useEffect(() => {
    fetch("/api/tags").then((r) => r.json()).then(setTags);
  }, []);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(fetchMembers, 300);
    return () => clearTimeout(t);
  }, [fetchMembers]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      const member = await res.json();
      setShowForm(false);
      setForm({
        fullName: "",
        phone: "",
        email: "",
        gender: "",
        maritalStatus: "",
        joinedAt: new Date().toISOString().split("T")[0],
        type: "regular",
        tagIds: [],
      });
      fetchMembers();
    }
    setSaving(false);
  }

  function toggleTag(id: string) {
    setForm((p) => ({
      ...p,
      tagIds: p.tagIds.includes(id)
        ? p.tagIds.filter((t) => t !== id)
        : [...p.tagIds, id],
    }));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Members</h1>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Add Member
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <input
          type="text"
          placeholder="Search name, phone, email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <select
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All tags</option>
          {tags.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All types</option>
          <option value="regular">Regular</option>
          <option value="guest">Guest</option>
        </select>
      </div>

      {/* Member table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {["Name", "Phone", "Email", "Gender", "Type", "Joined"].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
            ) : members.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No members found.</td></tr>
            ) : (
              members.map((m) => (
                <tr
                  key={m.id}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => router.push(`/members/${m.id}`)}
                >
                  <td className="px-4 py-3 font-medium text-gray-900">{m.fullName}</td>
                  <td className="px-4 py-3 text-gray-500">{m.phone || "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{m.email || "—"}</td>
                  <td className="px-4 py-3 text-gray-500 capitalize">{m.gender || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                      m.type === "guest" ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"
                    }`}>
                      {m.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{m.joinedAt}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add member modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">Add Member</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <form onSubmit={handleCreate} className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Full Name *</label>
                  <input required type="text" value={form.fullName} onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
                  <input type="text" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                  <input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Gender</label>
                  <select value={form.gender} onChange={(e) => setForm((p) => ({ ...p, gender: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">—</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Marital Status</label>
                  <select value={form.maritalStatus} onChange={(e) => setForm((p) => ({ ...p, maritalStatus: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">—</option>
                    <option value="single">Single</option>
                    <option value="married">Married</option>
                    <option value="widowed">Widowed</option>
                    <option value="divorced">Divorced</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Joined Date *</label>
                  <input required type="date" value={form.joinedAt} onChange={(e) => setForm((p) => ({ ...p, joinedAt: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                  <select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="regular">Regular</option>
                    <option value="guest">Guest</option>
                  </select>
                </div>
              </div>

              {tags.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">Tags</label>
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => toggleTag(tag.id)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                          form.tagIds.includes(tag.id)
                            ? "border-transparent text-white"
                            : "bg-white text-gray-600 border-gray-300"
                        }`}
                        style={form.tagIds.includes(tag.id) ? { backgroundColor: tag.colour, borderColor: tag.colour } : {}}
                      >
                        {tag.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
                <button type="submit" disabled={saving}
                  className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                  {saving ? "Saving…" : "Add Member"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
