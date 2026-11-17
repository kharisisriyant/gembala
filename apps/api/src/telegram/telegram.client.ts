// Thin Telegram Bot API sender. Classification only; callers decide what to do.
export type TelegramSendResult =
  | { ok: true; messageId: string }
  | { ok: false; status: number; description: string; retryAfterMs?: number }

export const TELEGRAM_MAX_TEXT = 4096

export async function sendTelegramMessage(
  token: string,
  params: { chatId: string; text: string; parseMode?: "HTML"; buttonUrl?: string; buttonText?: string },
): Promise<TelegramSendResult> {
  let res: Response
  try {
    res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: params.chatId,
        text: params.text,
        disable_web_page_preview: true,
        ...(params.parseMode ? { parse_mode: params.parseMode } : {}),
        ...(params.buttonUrl ? { reply_markup: { inline_keyboard: [[{ text: params.buttonText ?? "Open", url: params.buttonUrl }]] } } : {}),
      }),
    })
  } catch (err) {
    return { ok: false, status: 0, description: err instanceof Error ? err.message : String(err) }
  }
  let data: { ok?: boolean; description?: string; result?: { message_id?: number }; parameters?: { retry_after?: number } } = {}
  try {
    data = await res.json()
  } catch {
    /* non-JSON error page */
  }
  if (res.ok && data.ok) return { ok: true, messageId: String(data.result?.message_id ?? "") }
  const retryAfter = data.parameters?.retry_after
  return {
    ok: false,
    status: res.status,
    description: data.description ?? res.statusText,
    retryAfterMs: retryAfter ? retryAfter * 1000 : undefined,
  }
}

export const escapeTelegramHtml = (value: string) =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")

// Telegram counts characters after entity parsing, but stay well inside the cap
// on the raw HTML so a long body can never be rejected.
export function clampTelegramText(text: string): string {
  return text.length <= TELEGRAM_MAX_TEXT ? text : `${text.slice(0, TELEGRAM_MAX_TEXT - 1)}…`
}
