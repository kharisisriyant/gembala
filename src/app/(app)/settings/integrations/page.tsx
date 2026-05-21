"use client";

import { useState, useEffect } from "react";

interface LinkStatus {
  linked: boolean;
  telegramId?: string;
  code?: string;
  expiresAt?: string;
  instruction?: string;
}

export default function IntegrationsPage() {
  const [status, setStatus] = useState<LinkStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [unlinking, setUnlinking] = useState(false);

  async function fetchStatus() {
    const res = await fetch("/api/telegram/link");
    if (res.ok) setStatus(await res.json());
    setLoading(false);
  }

  useEffect(() => { fetchStatus(); }, []);

  async function handleUnlink() {
    if (!confirm("Unlink your Telegram account?")) return;
    setUnlinking(true);
    await fetch("/api/telegram/link", { method: "DELETE" });
    fetchStatus();
    setUnlinking(false);
  }

  async function handleRefresh() {
    setLoading(true);
    await fetchStatus();
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Integrations</h1>

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center text-white text-lg flex-shrink-0">
            ✈
          </div>
          <div className="flex-1">
            <h2 className="font-medium text-gray-900">Telegram Bot</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Connect your Telegram account to record attendance and query member data via chat.
            </p>
          </div>
        </div>

        <div className="mt-5">
          {loading ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : status?.linked ? (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-sm text-green-700 font-medium">Connected</span>
                <span className="text-sm text-gray-400">· Telegram ID: {status.telegramId}</span>
              </div>
              <button
                onClick={handleUnlink}
                disabled={unlinking}
                className="text-sm text-red-500 hover:underline disabled:opacity-50"
              >
                {unlinking ? "Unlinking…" : "Unlink Telegram"}
              </button>
            </div>
          ) : (
            <div>
              <p className="text-sm text-gray-600 mb-3">
                Use the code below to link your Telegram account. The code expires in 10 minutes.
              </p>
              {status?.code ? (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-3">
                  <p className="text-xs text-gray-500 mb-1">Your one-time code:</p>
                  <p className="text-2xl font-mono font-bold text-indigo-700 tracking-widest">
                    {status.code}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">{status.instruction}</p>
                </div>
              ) : null}
              <button
                onClick={handleRefresh}
                className="text-sm text-indigo-600 hover:underline"
              >
                Generate new code
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
