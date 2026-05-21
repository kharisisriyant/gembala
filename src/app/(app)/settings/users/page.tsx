"use client";

import { useState, useEffect, useCallback } from "react";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Tag {
  id: string;
  name: string;
  colour: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userTagAccess, setUserTagAccess] = useState<Tag[]>([]);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "cell_leader" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchUsers = useCallback(async () => {
    const res = await fetch("/api/users");
    if (res.ok) setUsers(await res.json());
  }, []);

  const fetchTags = useCallback(async () => {
    const res = await fetch("/api/tags");
    if (res.ok) setTags(await res.json());
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchTags();
  }, [fetchUsers, fetchTags]);

  async function selectUser(u: User) {
    setSelectedUser(u);
    const res = await fetch(`/api/users/${u.id}/tag-access`);
    if (res.ok) setUserTagAccess(await res.json());
  }

  async function toggleTagAccess(tagId: string, hasAccess: boolean) {
    if (!selectedUser) return;
    if (hasAccess) {
      await fetch(`/api/users/${selectedUser.id}/tag-access`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagId }),
      });
    } else {
      await fetch(`/api/users/${selectedUser.id}/tag-access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagId }),
      });
    }
    const res = await fetch(`/api/users/${selectedUser.id}/tag-access`);
    if (res.ok) setUserTagAccess(await res.json());
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setForm({ name: "", email: "", password: "", role: "cell_leader" });
      fetchUsers();
    } else {
      const data = await res.json();
      setError(data.error || "Failed to create user");
    }
    setSaving(false);
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">User Management</h1>
      <div className="grid grid-cols-2 gap-6">
        <div>
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h2 className="text-sm font-medium text-gray-700 mb-3">Add Leader</h2>
            <form onSubmit={handleCreate} className="space-y-2">
              {[
                { name: "name", placeholder: "Full name", type: "text" },
                { name: "email", placeholder: "Email", type: "email" },
                { name: "password", placeholder: "Temporary password", type: "password" },
              ].map((f) => (
                <input
                  key={f.name}
                  type={f.type}
                  required
                  placeholder={f.placeholder}
                  value={(form as any)[f.name]}
                  onChange={(e) => setForm((p) => ({ ...p, [f.name]: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              ))}
              <select
                value={form.role}
                onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="cell_leader">Cell Leader</option>
                <option value="zone_leader">Zone Leader</option>
                <option value="admin">Admin</option>
              </select>
              {error && <p className="text-xs text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={saving}
                className="w-full py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? "Adding…" : "Add User"}
              </button>
            </form>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {users.map((u) => (
              <button
                key={u.id}
                onClick={() => selectUser(u)}
                className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${selectedUser?.id === u.id ? "bg-indigo-50" : ""}`}
              >
                <p className="text-sm font-medium text-gray-900">{u.name}</p>
                <p className="text-xs text-gray-500">{u.role.replace("_", " ")}</p>
              </button>
            ))}
          </div>
        </div>

        <div>
          {selectedUser ? (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h2 className="text-sm font-medium text-gray-700 mb-1">
                Tag Access — {selectedUser.name}
              </h2>
              <p className="text-xs text-gray-400 mb-4">Toggle to grant or revoke access</p>
              <div className="space-y-2">
                {tags.map((tag) => {
                  const hasAccess = userTagAccess.some((t) => t.id === tag.id);
                  return (
                    <label key={tag.id} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hasAccess}
                        onChange={() => toggleTagAccess(tag.id, hasAccess)}
                        className="w-4 h-4 accent-indigo-600"
                      />
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: tag.colour }}
                      />
                      <span className="text-sm text-gray-800">{tag.name}</span>
                    </label>
                  );
                })}
                {tags.length === 0 && (
                  <p className="text-sm text-gray-400">No tags created yet.</p>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl p-8 text-center">
              <p className="text-sm text-gray-400">Select a user to manage their tag access</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
