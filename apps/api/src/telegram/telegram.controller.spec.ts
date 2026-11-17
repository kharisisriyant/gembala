import { UnauthorizedException } from "@nestjs/common"
import { TelegramController } from "./telegram.controller"

const make = (secret: string | undefined) => {
  const telegram = { handleUpdate: jest.fn().mockResolvedValue(undefined) }
  const controller = new TelegramController(telegram as any, { get: () => secret } as any)
  return { controller, telegram }
}

describe("TelegramController.webhook (TG-7)", () => {
  it("accepts the right secret-token header", async () => {
    const { controller, telegram } = make("s3cret")
    expect(await controller.webhook("s3cret", {})).toEqual({ ok: true })
    expect(telegram.handleUpdate).toHaveBeenCalled()
  })

  it.each([["wrong"], [undefined], ["s3cre"], [""]])("rejects %p", async (header) => {
    const { controller, telegram } = make("s3cret")
    await expect(controller.webhook(header as any, {})).rejects.toBeInstanceOf(UnauthorizedException)
    expect(telegram.handleUpdate).not.toHaveBeenCalled()
  })

  it("rejects everything when no secret is configured", async () => {
    await expect(make(undefined).controller.webhook("", {})).rejects.toBeInstanceOf(UnauthorizedException)
  })
})
