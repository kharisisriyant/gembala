import { NotFoundException } from "@nestjs/common"
import { decodeCursor, encodeCursor, InboxService } from "./inbox.service"

const auth = { userId: "u1", orgId: "o1" }
const row = (n: number, over = {}) => ({
  id: `00000000-0000-0000-0000-00000000000${n}`, typeKey: "t", category: "activity" as const, title: `T${n}`, body: "b",
  link: "/x", readAt: null, createdAt: new Date(`2026-11-12T10:0${n}:00Z`), ...over,
})

describe("cursor", () => {
  it("round-trips", () => {
    const r = row(1)
    expect(decodeCursor(encodeCursor(r))).toEqual({ createdAt: r.createdAt, id: r.id })
  })
  it("rejects garbage", () => {
    expect(decodeCursor("not-a-cursor")).toBeNull()
  })
})

describe("InboxService.list", () => {
  const setup = (rows: any[]) => {
    const repo = { list: jest.fn().mockResolvedValue(rows), unreadCount: jest.fn().mockResolvedValue(3), setRead: jest.fn(), markAllRead: jest.fn().mockResolvedValue(2) }
    return { service: new InboxService(repo as any), repo }
  }

  it("asks for one extra row and returns a cursor when more remain", async () => {
    const { service, repo } = setup([row(3), row(2), row(1)])
    const res = await service.list(auth, { limit: 2 })
    expect(repo.list.mock.calls[0][2].limit).toBe(3)
    expect(res.items.map((i) => i.title)).toEqual(["T3", "T2"])
    expect(decodeCursor(res.nextCursor!)?.id).toBe(row(2).id)
  })

  it("returns no cursor on the last page", async () => {
    const { service } = setup([row(2), row(1)])
    expect((await service.list(auth, { limit: 2 })).nextCursor).toBeNull()
  })

  it("ignores a tampered cursor", async () => {
    const { service, repo } = setup([])
    await service.list(auth, { limit: 2, cursor: "###" })
    expect(repo.list.mock.calls[0][2].cursor).toBeUndefined()
  })

  it("serialises dates and read state", async () => {
    const { service } = setup([row(1, { readAt: new Date("2026-11-12T11:00:00Z") })])
    const [item] = (await service.list(auth, { limit: 5 })).items
    expect(item.readAt).toBe("2026-11-12T11:00:00.000Z")
    expect(item.createdAt).toBe("2026-11-12T10:01:00.000Z")
  })
})

describe("InboxService writes", () => {
  it("404s when the notification is not the caller's", async () => {
    const repo = { setRead: jest.fn().mockResolvedValue(null) }
    await expect(new InboxService(repo as any).setRead(auth, "id", true)).rejects.toBeInstanceOf(NotFoundException)
  })
})
