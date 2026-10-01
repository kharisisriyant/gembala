jest.mock("resend", () => ({ Resend: jest.fn() }))

import { ServiceUnavailableException } from "@nestjs/common"
import type { ConfigService } from "@nestjs/config"
import { Resend } from "resend"
import { ResendMailService } from "./resend-mail.service"

describe("ResendMailService", () => {
  const send = jest.fn()
  const config = {
    getOrThrow: jest.fn((key: string) => ({
      RESEND_API_KEY: "re_test_key",
      RESEND_FROM_EMAIL: "noreply@example.com",
      RESEND_FROM_NAME: "Gembala",
    })[key]),
  } as unknown as ConfigService

  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(Resend).mockImplementation(() => ({ emails: { send } }) as never)
    send.mockResolvedValue({ data: { id: "email-1" }, error: null })
  })

  it("sends password-reset emails with the configured sender", async () => {
    const service = new ResendMailService(config)

    await service.sendPasswordReset("member@example.com", "https://app.example.com/reset-password?token=abc")

    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      from: "Gembala <noreply@example.com>",
      to: "member@example.com",
      subject: "Reset your Gembala password",
      text: expect.stringContaining("https://app.example.com/reset-password?token=abc"),
    }))
  })

  it("turns a Resend error into a retryable HTTP failure", async () => {
    send.mockResolvedValue({ data: null, error: { message: "sender domain is not verified" } })
    const service = new ResendMailService(config)

    await expect(service.sendInvite("member@example.com", "<Church>", "https://app.example.com/invite"))
      .rejects.toBeInstanceOf(ServiceUnavailableException)
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      html: expect.stringContaining("&lt;Church&gt;"),
    }))
  })
})
