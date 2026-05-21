"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface GroupData {
  id: string;
  name: string;
  scheduleType: string;
  meetingDay: string | null;
  location: string | null;
  absenceThreshold: number;
}

interface Session {
  id: string;
  sessionDate: string;
  topic: string | null;
  notes: string | null;
}

interface GroupMember {
  membershipId: string;
  memberId: string;
  fullName: string;
  phone: string | null;
  type: string;
}

export default function GroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [group, setGroup] = useState<GroupData | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [tab, setTab] = useState<"sessions" | "members">("sessions");
  const [showSession, setShowSession] = useState(false);
  const [sessionForm, setSessionForm] = useState({
    sessionDate: new Date().toISOString().split("T")[0],
    topic: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  const fetchGroup = useCallback(async () => {
    const res = await fetch(`/api/groups/${id}`);
    if (res.ok) setGroup(await res.json());
  }, [id]);

  const fetchSessions = useCallback(async () => {
    const res = await fetch(`/api/groups/${id}/sessions`);
    if (res.ok) setSessions(await res.json());
  }, [id]);

  const fetchMembers = useCallback(async () => {
    const res = await fetch(`/api/groups/${id}/members`);
    if (res.ok) setGroupMembers(await res.json());
  }, [id]);

  useEffect(() => {
    fetchGroup();
    fetchSessions();
    fetchMembers();
  }, [fetchGroup, fetchSessions, fetchMembers]);

  async function handleCreateSession(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch(`/api/groups/${id}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sessionForm),
    });
    if (res.ok) {
      setShowSession(false);
      fetchSessions();
    }
    setSaving(false);
  }

  if (!group) return <div className="text-gray-400">Loading…</div>;

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-2">
        <Link href="/groups" className="text-sm text-gray-500 hover:text-gray-700">← Groups</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-semibold text-gray-900">{group.name}</h1>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        {group.scheduleType} · {group.meetingDay || "—"} · {group.location || "—"}
      </p>

      <div className="flex gap-1 border-b border-gray-200 mb-5">
        {(["sessions", "members"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
              tab === t ? "border-b-2 border-indigo-600 text-indigo-600 -mb-px" : "text-gray-500 hover:text-gray-700"
            }`}>
            {t}
          </button>
        ))}
      </div>

      {tab === "sessions" && (
        <div>
          <div className="flex justify-end mb-3">
            <button onClick={() => setShowSession(true)}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">
              New Session
            </button>
          </div>
          <div className="space-y-3">
            {sessions.length === 0 ? (
              <p className="text-sm text-gray-400">No sessions recorded.</p>
            ) : (
              sessions.map((s) => (
                <Link key={s.id} href={`/groups/${id}/sessions/${s.id}`}
                  className="block bg-white border border-gray-200 rounded-xl px-5 py-4 hover:border-indigo-300 transition-colors">
                  <p className="font-medium text-gray-900">{s.sessionDate}</p>
                  {s.topic && <p className="text-sm text-gray-500">{s.topic}</p>}
                </Link>
              ))
            )}
          </div>
        </div>
      )}

      {tab === "members" && (
        <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
          {groupMembers.length === 0 ? (
            <p className="p-4 text-sm text-gray-400">No members in this group.</p>
          ) : (
            groupMembers.map((m) => (
              <Link key={m.membershipId} href={`/members/${m.memberId}`}
                className="flex items-center px-4 py-3 hover:bg-gray-50 transition-colors">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{m.fullName}</p>
                  <p className="text-xs text-gray-400">{m.phone || "No phone"}</p>
                </div>
                {m.type === "guest" && (
                  <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">Guest</span>
                )}
              </Link>
            ))
          )}
        </div>
      )}

      {showSession && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">New Session</h2>
              <button onClick={() => setShowSession(false)} className="text-gray-400">✕</button>
            </div>
            <form onSubmit={handleCreateSession} className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Date *</label>
                <input required type="date" value={sessionForm.sessionDate}
                  onChange={(e) => setSessionForm((p) => ({ ...p, sessionDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Topic</label>
                <input type="text" value={sessionForm.topic}
                  onChange={(e) => setSessionForm((p) => ({ ...p, topic: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowSession(false)} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
                <button type="submit" disabled={saving}
                  className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                  {saving ? "Creating…" : "Create Session"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
