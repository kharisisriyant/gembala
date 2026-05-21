import fetch from "node-fetch";

const GEMBALA_API = process.env.GEMBALA_API_URL || "http://localhost:3000";
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET!;

interface GembalaUser {
  id: string;
  churchId: string;
  role: string;
}

// Resolve Gembala user from Telegram ID
export async function resolveUser(telegramId: string): Promise<GembalaUser | null> {
  const res = await fetch(`${GEMBALA_API}/api/telegram/resolve`, {
    headers: { "x-webhook-secret": WEBHOOK_SECRET, "x-telegram-id": telegramId },
  });
  if (!res.ok) return null;
  return res.json() as Promise<GembalaUser>;
}

// Complete account linking
export async function verifyLinkCode(code: string, telegramId: string) {
  const res = await fetch(`${GEMBALA_API}/api/telegram/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-webhook-secret": WEBHOOK_SECRET },
    body: JSON.stringify({ code, telegramId }),
  });
  return { ok: res.ok, data: await res.json() };
}

// API helpers scoped to a user
export function makeApiClient(userId: string, churchId: string) {
  async function apiCall(path: string, method = "GET", body?: unknown) {
    const res = await fetch(`${GEMBALA_API}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "x-webhook-secret": WEBHOOK_SECRET,
        "x-internal-user-id": userId,
        "x-internal-church-id": churchId,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`API ${method} ${path} failed: ${err}`);
    }
    return res.json();
  }

  return {
    listMembers: (params: Record<string, string> = {}) => {
      const qs = new URLSearchParams(params).toString();
      return apiCall(`/api/internal/members${qs ? "?" + qs : ""}`);
    },
    getMember: (memberId: string) => apiCall(`/api/internal/members/${memberId}`),
    listSessions: (groupId: string) => apiCall(`/api/internal/groups/${groupId}/sessions`),
    createSession: (groupId: string, body: unknown) =>
      apiCall(`/api/internal/groups/${groupId}/sessions`, "POST", body),
    recordAttendance: (groupId: string, sessionId: string, body: unknown) =>
      apiCall(`/api/internal/groups/${groupId}/sessions/${sessionId}/attendance`, "POST", body),
    addPastoralNote: (memberId: string, body: unknown) =>
      apiCall(`/api/internal/members/${memberId}/notes`, "POST", body),
    getAbsenceReport: () => apiCall(`/api/internal/follow-up`),
    getBirthdays: (days = 7) => apiCall(`/api/internal/members/birthdays?days=${days}`),
  };
}
