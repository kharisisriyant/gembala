import { escapeHtml, renderEmail } from "./email.render"

const base = { title: "Budi <b>assigned</b>", body: "Line1\nLine2 & more", link: "https://app.test/x", locale: "en" as const, preferencesUrl: "https://app.test/profile", unsubscribeUrl: "https://app.test/unsubscribe?token=t" }

describe("renderEmail", () => {
  it("escapes user-supplied text in html but not in plain text", () => {
    const { html, text } = renderEmail(base)
    expect(html).toContain("Budi &lt;b&gt;assigned&lt;/b&gt;")
    expect(html).not.toContain("<b>assigned")
    expect(html).toContain("Line1<br>Line2 &amp; more")
    expect(text).toContain("Budi <b>assigned</b>")
  })

  it("has html and text parts with the action link and the preferences link", () => {
    const { html, text } = renderEmail(base)
    for (const part of [html, text]) {
      expect(part).toContain("https://app.test/x")
      expect(part).toContain("https://app.test/profile")
    }
  })

  it("includes unsubscribe only when given", () => {
    expect(renderEmail(base).text).toContain("unsubscribe?token=t")
    expect(renderEmail({ ...base, unsubscribeUrl: null }).text).not.toContain("unsubscribe")
  })

  it("localises the footer", () => {
    expect(renderEmail({ ...base, locale: "id" }).text).toContain("Kelola preferensi notifikasi")
  })

  it("omits the action button without a link", () => {
    expect(renderEmail({ ...base, link: null }).html).not.toContain("display:inline-block")
  })

  it("escapeHtml handles quotes", () => {
    expect(escapeHtml(`"'`)).toBe("&quot;&#039;")
  })
})
