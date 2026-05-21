"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface AttendanceRow {
  id: string;
  memberId: string;
  fullName: string;
  status: "present" | "absent" | "excused";
  reason: string | null;
  source: string;
}

interface GroupMember {
  memberId: string;
  fullName: string;
}

type StatusMap = Record<string, { status: "present" | "absent" | "excused"; reason: string }>;

export default function SessionAttendancePage() {
  const { id: groupId, sessionId } = useParams<{ id: string; sessionId: string }>();
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [statusMap, setStatusMap] = useState<StatusMap>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const fetchData = useCallback(async () => {
    const [attRes, memRes] = await Promise.all([
      fetch(`/api/groups/${groupId}/sessions/${sessionId}/attendance`),
      fetch(`/api/groups/${groupId}/members`),
    ]);

    const att: AttendanceRow[] = attRes.ok ? await attRes.json() : [];
    const mem: GroupMember[] = memRes.ok ? await memRes.json() : [];

    setAttendance(att);
    setGroupMembers(mem);

    // Build initial status map from existing records
    const map: StatusMap = {};
    for (const m of mem) {
      const existing = att.find((a) => a.memberId === m.memberId);
      map[m.memberId] = {
        status: existing?.status || "present",
        reason: existing?.reason || "",
      };
    }
    setStatusMap(map);
  }, [groupId, sessionId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function setStatus(memberId: string, status: "present" | "absent" | "excused") {
    setStatusMap((p) => ({ ...p, [memberId]: { ...p[memberId], status } }));
  }

  function setReason(memberId: string, reason: string) {
    setStatusMap((p) => ({ ...p, [memberId]: { ...p[memberId], reason } }));
  }

  async function handleSave() {
    setSaving(true);
    const records = groupMembers.map((m) => ({
      memberId: m.memberId,
      status: statusMap[m.memberId]?.status || "present",
      reason: statusMap[m.memberId]?.reason || undefined,
    }));

    await fetch(`/api/groups/${groupId}/sessions/${sessionId}/attendance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ records }),
    });

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setSaving(false);
    fetchData();
  }

  const statusColors = {
    present: "bg-green-100 text-green-700 border-green-200",
    absent: "bg-red-100 text-red-700 border-red-200",
    excused: "bg-yellow-100 text-yellow-700 border-yellow-200",
  };

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/groups/${groupId}`} className="text-sm text-gray-500 hover:text-gray-700">← Group</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-semibold text-gray-900">Attendance</h1>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
        {groupMembers.length === 0 ? (
          <p className="p-4 text-sm text-gray-400">No members in this group.</p>
        ) : (
          groupMembers.map((m) => {
            const entry = statusMap[m.memberId] || { status: "present", reason: "" };
            return (
              <div key={m.memberId} className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="flex-1 text-sm font-medium text-gray-900">{m.fullName}</span>
                  {(["present", "absent", "excused"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatus(m.memberId, s)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                        entry.status === s ? statusColors[s] : "bg-gray-50 text-gray-400 border-gray-200"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                {entry.status === "excused" && (
                  <input
                    type="text"
                    placeholder="Reason (optional)"
                    value={entry.reason}
                    onChange={(e) => setReason(m.memberId, e.target.value)}
                    className="mt-2 w-full px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                )}
              </div>
            );
          })
        )}
      </div>

      {groupMembers.length > 0 && (
        <div className="flex justify-end mt-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {saved ? "Saved!" : saving ? "Saving…" : "Save Attendance"}
          </button>
        </div>
      )}
    </div>
  );
}
