import { BadRequestException } from "@nestjs/common"
import { signLink } from "./notifications.links"
import { UnsubscribeService } from "./unsubscribe.service"

const secret = "s".repeat(40)
const setup = () => {
  const prefs = { upsertPreference: jest.fn(), insertConsent: jest.fn() }
  return { service: new UnsubscribeService({ getOrThrow: () => secret } as any, prefs as any), prefs }
}
const token = (category: any, channel: any = "email") => signLink(secret, { userId: "u1", category, channel })

describe("UnsubscribeService", () => {
  it("turns the category off for email and records consent from the email link", async () => {
    const { service, prefs } = setup()
    await service.apply(token("reminder"))
    expect(prefs.upsertPreference).toHaveBeenCalledWith("u1", "reminder", "email", false)
    expect(prefs.insertConsent).toHaveBeenCalledWith({ userId: "u1", category: "reminder", channel: "email", enabled: false, source: "email_link" })
  })

  it("previews the category", () => {
    expect(setup().service.preview(token("activity"))).toEqual({ category: "activity" })
  })

  it.each([["security"], ["bad-token"]])("rejects %s", async (value) => {
    const { service, prefs } = setup()
    const t = value === "bad-token" ? value : token(value)
    await expect(service.apply(t)).rejects.toBeInstanceOf(BadRequestException)
    expect(prefs.upsertPreference).not.toHaveBeenCalled()
  })

  it("rejects non-email tokens", async () => {
    await expect(setup().service.apply(token("reminder", "telegram"))).rejects.toBeInstanceOf(BadRequestException)
  })
})
