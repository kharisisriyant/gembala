import { z } from "zod"
import { NotificationAccess } from "./notifications.access"

const careType = { key: "care.x", canAccess: ({ userId, orgId, payload }: any, a: any) => a.memberVisible(userId, orgId, payload.memberId), payload: z.object({}), render: () => ({}) } as any
const plain = { key: "plain", payload: z.object({}), render: () => ({}) } as any

function setup(opts: { auth?: any; tags?: string[] | null; visible?: boolean } = {}) {
  const authContext = { load: jest.fn().mockResolvedValue("auth" in opts ? opts.auth : { orgId: "o1" }) }
  const scope = { expandedScope: jest.fn().mockResolvedValue("scope"), memberVisible: jest.fn().mockReturnValue(opts.visible ?? true) }
  const repo = { memberTagNames: jest.fn().mockResolvedValue("tags" in opts ? opts.tags : ["youth"]) }
  return { access: new NotificationAccess(authContext as any, scope as any, repo as any, [careType, plain]), scope }
}

describe("NotificationAccess", () => {
  it("allows types without an extra rule", async () => {
    expect(await setup().access.allowed("plain", "u", "o1", {})).toBe(true)
  })

  it("checks member visibility through the user's scope", async () => {
    const { access, scope } = setup()
    expect(await access.allowed("care.x", "u", "o1", { memberId: "m" })).toBe(true)
    expect(scope.memberVisible).toHaveBeenCalledWith("scope", ["youth"])
    expect(await setup({ visible: false }).access.allowed("care.x", "u", "o1", { memberId: "m" })).toBe(false)
  })

  it.each([
    ["user is gone", { auth: null }],
    ["user switched orgs", { auth: { orgId: "other" } }],
    ["member was deleted", { tags: null }],
  ])("denies when %s", async (_n, opts) => {
    expect(await setup(opts as any).access.allowed("care.x", "u", "o1", { memberId: "m" })).toBe(false)
  })
})
