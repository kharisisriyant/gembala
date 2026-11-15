import type { Request, Response } from "express"
import { GOOGLE_STATE_COOKIE } from "./google-oauth.service"

// HttpOnly copy of the OAuth `state`, so a callback is only honoured in the
// browser that started the flow. Lax: it must ride Google's top-level redirect.
const options = () => ({ httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/" })

export function setStateCookie(res: Response, state: string): void {
  res.cookie(GOOGLE_STATE_COOKIE, state, { ...options(), maxAge: 10 * 60 * 1000 })
}

export function readStateCookie(req: Request): string | undefined {
  const prefix = `${GOOGLE_STATE_COOKIE}=`
  return req.headers.cookie?.split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix))?.slice(prefix.length)
}

export function clearStateCookie(res: Response): void {
  res.clearCookie(GOOGLE_STATE_COOKIE, options())
}
