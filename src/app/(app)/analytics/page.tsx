"use client";

import { useState, useEffect, useCallback } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

interface Group {
  id: string;
  name: string;
}

interface AttendanceRateRow {
  date: string;
  rate: number;
  present: number;
  total: number;
}

interface AbsenceRow {
  name: string;
  memberId: string;
  absences: number;
}

interface HeatmapData {
  sessions: string[];
  members: Array<Record<string, string | null>>;
}

const STATUS_COLOR: Record<string, string> = {
  present: "#22c55e",
  absent: "#ef4444",
  excused: "#f59e0b",
};

export default function AnalyticsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState("");
  const [attendanceData, setAttendanceData] = useState<AttendanceRateRow[]>([]);
  const [absenceList, setAbsenceList] = useState<AbsenceRow[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapData | null>(null);
  const [tab, setTab] = useState<"chart" | "heatmap" | "absences">("chart");

  useEffect(() => {
    fetch("/api/analytics?type=summary")
      .then((r) => r.json())
      .then((data) => {
        setGroups(data);
        if (data.length > 0) setSelectedGroup(data[0].id);
      });
  }, []);

  const fetchAnalytics = useCallback(async () => {
    if (!selectedGroup) return;
    const [rateRes, absRes, heatRes] = await Promise.all([
      fetch(`/api/analytics?type=attendance-rate&groupId=${selectedGroup}`),
      fetch(`/api/analytics?type=absence-list&groupId=${selectedGroup}`),
      fetch(`/api/analytics?type=heatmap&groupId=${selectedGroup}`),
    ]);
    if (rateRes.ok) setAttendanceData(await rateRes.json());
    if (absRes.ok) setAbsenceList(await absRes.json());
    if (heatRes.ok) setHeatmap(await heatRes.json());
  }, [selectedGroup]);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Analytics</h1>
        <select
          value={selectedGroup}
          onChange={(e) => setSelectedGroup(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Select group…</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
      </div>

      <div className="flex gap-1 border-b border-gray-200 mb-5">
        {(["chart", "heatmap", "absences"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
              tab === t ? "border-b-2 border-indigo-600 text-indigo-600 -mb-px" : "text-gray-500 hover:text-gray-700"
            }`}>
            {t}
          </button>
        ))}
      </div>

      {tab === "chart" && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-medium text-gray-700 mb-4">Attendance Rate — Last 12 Sessions</h2>
            {attendanceData.length === 0 ? (
              <p className="text-sm text-gray-400">No data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={attendanceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                  <Tooltip formatter={(v: number) => `${v}%`} />
                  <Line type="monotone" dataKey="rate" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-medium text-gray-700 mb-4">Headcount per Session</h2>
            {attendanceData.length === 0 ? (
              <p className="text-sm text-gray-400">No data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={attendanceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="present" fill="#6366f1" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {tab === "heatmap" && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 overflow-x-auto">
          <h2 className="text-sm font-medium text-gray-700 mb-4">Member Attendance Heatmap</h2>
          {!heatmap || heatmap.members.length === 0 ? (
            <p className="text-sm text-gray-400">No data yet.</p>
          ) : (
            <table className="text-xs border-collapse">
              <thead>
                <tr>
                  <th className="text-left pr-3 pb-2 font-medium text-gray-600 whitespace-nowrap">Member</th>
                  {heatmap.sessions.map((d) => (
                    <th key={d} className="px-1 pb-2 font-medium text-gray-400 whitespace-nowrap">{d.slice(5)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heatmap.members.map((row) => (
                  <tr key={String(row.name)}>
                    <td className="pr-3 py-1 font-medium text-gray-800 whitespace-nowrap">{row.name}</td>
                    {heatmap.sessions.map((d) => {
                      const status = row[d];
                      return (
                        <td key={d} className="px-1 py-1 text-center">
                          <span
                            className="inline-block w-5 h-5 rounded"
                            style={{ backgroundColor: status ? STATUS_COLOR[status] : "#e5e7eb" }}
                            title={status || "no record"}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "absences" && (
        <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
          <div className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide bg-gray-50">
            Members ranked by total absences
          </div>
          {absenceList.length === 0 ? (
            <p className="px-4 py-4 text-sm text-gray-400">No data.</p>
          ) : (
            absenceList.map((row) => (
              <div key={row.memberId} className="flex items-center px-4 py-3">
                <span className="flex-1 text-sm font-medium text-gray-900">{row.name}</span>
                <span className="text-sm text-red-500 font-medium">{row.absences} absences</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
