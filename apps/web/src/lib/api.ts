const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api"

const TOKEN_KEY = "gembala.token"

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

type FetchOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"
  body?: unknown
}

export async function apiFetch<T>(path: string, opts: FetchOptions = {}): Promise<T> {
  const token = getToken()
  const res = await fetch(`${API_URL}${path}`, {
    method: opts.method ?? "GET",
    headers: {
      ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  })

  if (res.status === 401 && token) {
    // token expired or user deleted — drop it and start over at login
    clearToken()
    window.location.assign("/login")
    throw new ApiError(401, "session expired")
  }

  if (!res.ok) {
    let message = res.statusText
    try {
      const data = await res.json()
      if (typeof data.message === "string") message = data.message
      else if (Array.isArray(data.message)) message = data.message.join(", ")
      else if (Array.isArray(data.errors)) message = data.errors.map((e: { message: string }) => e.message).join(", ")
    } catch {
      // non-JSON error body
    }
    throw new ApiError(res.status, message)
  }

  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}
