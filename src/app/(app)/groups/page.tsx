"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface Group {
  id: string;
  name: string;
  scheduleType: string;
  meetingDay: string | null;
  location: string | null;
  leaderName: string | null;
}

interface User {
  id: string;
  name: string;
  role: string;
}

export default function GroupsPage() {
  const [groupsList, setGroupsList] = useState<Group[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    scheduleType: "weekly",
    meetingDay: "",
    meetingTime: "",
    location: "",
    leaderUserId: "",
    absenceThreshold: 2,
  });
  const [saving, setSaving] = useState(false);

  const fetchGroups = useCallback(async () => {
    const res = await fetch("/api/groups");
    if (res.ok) setGroupsList(await res.json());
  }, []);

  useEffect(() => {
    fetchGroups();
    fetch("/api/users").then((r) => r.json()).then(setUsers).catch(() => {});
  }, [fetchGroups]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setShowForm(false);
      fetchGroups();
    }
    setSaving(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Small Groups</h1>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Create Group
        </button>
      </div>

      <div className="grid gap-4">
        {groupsList.length === 0 ? (
          <p className="text-gray-400 text-sm">No groups yet.</p>
        ) : (
          groupsList.map((g) => (
            <Link
              key={g.id}
              href={`/groups/${g.id}`}
              className="bg-white border border-gray-200 rounded-xl px-5 py-4 hover:border-indigo-300 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-gray-900">{g.name}</p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {g.scheduleType}{g.meetingDay ? ` · ${g.meetingDay}` : ""}
                    {g.location ? ` · ${g.location}` : ""}
                  </p>
                </div>
                <span className="text-sm text-gray-400">{g.leaderName}</span>
              </div>
            </Link>
          ))
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">Create Group</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <form onSubmit={handleCreate} className="p-5 space-y-3">
              <input required type="text" placeholder="Group name" value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <select value={form.scheduleType} onChange={(e) => setForm((p) => ({ ...p, scheduleType: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="weekly">Weekly</option>
                <option value="biweekly">Bi-weekly</option>
                <option value="monthly">Monthly</option>
              </select>
              <input type="text" placeholder="Meeting day (e.g. Wednesday)" value={form.meetingDay}
                onChange={(e) => setForm((p) => ({ ...p, meetingDay: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <input type="time" value={form.meetingTime} onChange={(e) => setForm((p) => ({ ...p, meetingTime: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <input type="text" placeholder="Location (optional)" value={form.location}
                onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <select required value={form.leaderUserId} onChange={(e) => setForm((p) => ({ ...p, leaderUserId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">Select leader…</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name} ({u.role.replace("_", " ")})</option>
                ))}
              </select>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Absence threshold (consecutive sessions)
                </label>
                <input type="number" min={1} max={10} value={form.absenceThreshold}
                  onChange={(e) => setForm((p) => ({ ...p, absenceThreshold: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
                <button type="submit" disabled={saving}
                  className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                  {saving ? "Creating…" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
