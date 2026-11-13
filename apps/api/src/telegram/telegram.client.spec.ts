import { clampTelegramText, escapeTelegramHtml, sendTelegramMessage, TELEGRAM_MAX_TEXT } from "./telegram.client"

const reply = (status: number, body: object) => jest.fn().mockResolvedValue({ ok: status < 400, status, statusText: "x", json: async () => body })

afterEach(() => jest.restoreAllMocks())

describe("sendTelegramMessage", () => {
  it("returns the message id and sends HTML with a button", async () => {
    const fetchMock = reply(200, { ok: true, result: { message_id: 7 } })
    global.fetch = fetchMock as any
    const res = await sendTelegramMessage("tok", { chatId: "1", text: "<b>x</b>", parseMode: "HTML", buttonUrl: "https://a.test/x", buttonText: "Open" })
    expect(res).toEqual({ ok: true, messageId: "7" })
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body).toMatchObject({ chat_id: "1", parse_mode: "HTML", reply_markup: { inline_keyboard: [[{ url: "https://a.test/x" }]] } })
  })

  it("reports retry_after in milliseconds on 429", async () => {
    global.fetch = reply(429, { ok: false, description: "Too Many Requests", parameters: { retry_after: 3 } }) as any
    expect(await sendTelegramMessage("t", { chatId: "1", text: "x" })).toMatchObject({ ok: false, status: 429, retryAfterMs: 3000 })
  })

  it("reports status 403 when the bot is blocked", async () => {
    global.fetch = reply(403, { ok: false, description: "Forbidden: bot was blocked by the user" }) as any
    expect(await sendTelegramMessage("t", { chatId: "1", text: "x" })).toMatchObject({ ok: false, status: 403 })
  })

  it("reports network failures as status 0", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("ECONNRESET")) as any
    expect(await sendTelegramMessage("t", { chatId: "1", text: "x" })).toMatchObject({ ok: false, status: 0 })
  })
})

describe("text helpers", () => {
  it("escapes the three characters Telegram HTML cares about", () => {
    expect(escapeTelegramHtml("a<b>&c")).toBe("a&lt;b&gt;&amp;c")
  })
  it("clamps to the 4096 limit", () => {
    expect(clampTelegramText("x".repeat(5000)).length).toBe(TELEGRAM_MAX_TEXT)
    expect(clampTelegramText("short")).toBe("short")
  })
})
