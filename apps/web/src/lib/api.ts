import type { AuthResponse, CsrfResponse } from "@gembala/shared"

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api"
let accessToken: string | null = null
let csrfToken: string | null = null
let refreshPromise: Promise<boolean> | null = null

export function getToken(): string | null { return accessToken }
export function setToken(token: string | null) { accessToken = token }
export function clearToken() { accessToken = null; csrfToken = null }

export class ApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) { super(message); this.name = "ApiError"; this.status = status }
}

type FetchOptions = { method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"; body?: unknown; skipRefresh?: boolean }

async function parse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = res.statusText
    try { const data = await res.json(); message = typeof data.message === "string" ? data.message : Array.isArray(data.message) ? data.message.join(", ") : message } catch { /* non-JSON */ }
    throw new ApiError(res.status, message)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

async function bootstrapCsrf(): Promise<boolean> {
  const res = await fetch(`${API_URL}/auth/csrf`, { credentials: "include", headers: { "Cache-Control": "no-store" } })
  if (!res.ok) return false
  csrfToken = (await parse<CsrfResponse>(res)).csrfToken
  return true
}

async function refreshAccessToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise
  refreshPromise = (async () => {
    if (!csrfToken && !(await bootstrapCsrf())) return false
    const res = await fetch(`${API_URL}/auth/refresh`, { method: "POST", credentials: "include", headers: { "X-CSRF-Token": csrfToken ?? "", "Cache-Control": "no-store" } })
    if (!res.ok) { clearToken(); return false }
    const auth = await parse<AuthResponse>(res)
    accessToken = auth.accessToken
    return true
  })().finally(() => { refreshPromise = null })
  return refreshPromise
}

export async function restoreSession(): Promise<AuthResponse | null> {
  if (!csrfToken && !(await bootstrapCsrf())) return null
  const res = await fetch(`${API_URL}/auth/refresh`, { method: "POST", credentials: "include", headers: { "X-CSRF-Token": csrfToken ?? "", "Cache-Control": "no-store" } })
  if (!res.ok) { clearToken(); return null }
  const auth = await parse<AuthResponse>(res); accessToken = auth.accessToken; return auth
}

export async function apiFetch<T>(path: string, opts: FetchOptions = {}): Promise<T> {
  const request = () => fetch(`${API_URL}${path}`, { method: opts.method ?? "GET", credentials: "include", headers: { ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}), ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) }, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined })
  let res = await request()
  if (res.status === 401 && !opts.skipRefresh && !path.startsWith("/auth/")) {
    if (await refreshAccessToken()) res = await request()
  }
  return parse<T>(res)
}

export async function authenticate(path: "/auth/login" | "/auth/register" | "/auth/accept-invite", body: unknown): Promise<AuthResponse> {
  const res = await fetch(`${API_URL}${path}`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: JSON.stringify(body) })
  const auth = await parse<AuthResponse>(res); accessToken = auth.accessToken; await bootstrapCsrf(); return auth
}

export async function logoutRequest(all = false): Promise<void> {
  try {
    await apiFetch<void>(all ? "/auth/logout-all" : "/auth/logout", { method: "POST" })
  } finally {
    clearToken()
  }
}
