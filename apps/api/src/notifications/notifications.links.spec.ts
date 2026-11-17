import { buildWebLink, signLink, verifyLink } from "./notifications.links"

const secret = "s".repeat(40)
const claims = { userId: "u1", category: "reminder", channel: "email" } as const

describe("signed links", () => {
  it("round-trips", () => {
    expect(verifyLink(secret, signLink(secret, claims))).toEqual(claims)
  })

  it("rejects a tampered body, signature or other secret", () => {
    const token = signLink(secret, claims)
    const [body, sig] = token.split(".")
    const forged = Buffer.from(JSON.stringify({ ...claims, userId: "u2" })).toString("base64url")
    expect(verifyLink(secret, `${forged}.${sig}`)).toBeNull()
    expect(verifyLink(secret, `${body}.${sig}x`)).toBeNull()
    expect(verifyLink("o".repeat(40), token)).toBeNull()
    expect(verifyLink(secret, "garbage")).toBeNull()
    expect(verifyLink(secret, `${token}.extra`)).toBeNull()
  })

  it("never expires without exp, and honours exp when set", () => {
    expect(verifyLink(secret, signLink(secret, claims), Date.now() + 10 * 365 * 86_400_000)).toEqual(claims)
    const token = signLink(secret, { ...claims, exp: 1_000 })
    expect(verifyLink(secret, token, 999)).not.toBeNull()
    expect(verifyLink(secret, token, 1_000)).toBeNull()
  })
})

describe("buildWebLink", () => {
  it("joins an app path to the origin", () => {
    expect(buildWebLink("https://app.test/", "/care/1")).toBe("https://app.test/care/1")
  })
  it.each(["https://evil.test", "//evil.test", "care/1", "/a\\b"])("rejects %s", (path) => {
    expect(() => buildWebLink("https://app.test", path)).toThrow()
  })
})
