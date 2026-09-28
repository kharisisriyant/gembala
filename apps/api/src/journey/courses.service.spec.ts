import { ConflictException, NotFoundException } from "@nestjs/common"
import { CoursesService } from "./courses.service"
import type { CoursesRepository } from "./courses.repository"

const auth = { orgId: "org-1", userId: "u1" } as any
const course = (over = {}) => ({ id: "c1", name: "Katekisasi", kind: "catechism" as const, enrollmentCount: 0, ...over })

describe("CoursesService", () => {
  let repo: jest.Mocked<CoursesRepository>
  let service: CoursesService

  beforeEach(() => {
    repo = {
      list: jest.fn(),
      findById: jest.fn(),
      findByName: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<CoursesRepository>
    service = new CoursesService(repo)
  })

  it("create 409s on a duplicate name", async () => {
    repo.findByName.mockResolvedValue({ id: "other" })
    await expect(service.create(auth, { name: "Katekisasi", kind: "catechism" })).rejects.toBeInstanceOf(ConflictException)
    expect(repo.insert).not.toHaveBeenCalled()
  })

  it("create inserts and returns the course", async () => {
    repo.findByName.mockResolvedValue(undefined)
    repo.insert.mockResolvedValue({ id: "c1" })
    repo.findById.mockResolvedValue(course())
    await expect(service.create(auth, { name: "Katekisasi", kind: "catechism" })).resolves.toEqual(course())
    expect(repo.insert).toHaveBeenCalledWith({ orgId: "org-1", name: "Katekisasi", kind: "catechism" })
  })

  it("update 404s for a missing course", async () => {
    repo.findById.mockResolvedValue(undefined)
    await expect(service.update(auth, "c1", { name: "x" })).rejects.toBeInstanceOf(NotFoundException)
  })

  it("update allows keeping the same name", async () => {
    repo.findById.mockResolvedValue(course())
    repo.findByName.mockResolvedValue({ id: "c1" })
    await service.update(auth, "c1", { name: "Katekisasi", kind: "sidi_prep" })
    expect(repo.update).toHaveBeenCalledWith("org-1", "c1", { name: "Katekisasi", kind: "sidi_prep" })
  })

  it("update 409s when the name belongs to another course", async () => {
    repo.findById.mockResolvedValue(course())
    repo.findByName.mockResolvedValue({ id: "c2" })
    await expect(service.update(auth, "c1", { name: "Dup" })).rejects.toBeInstanceOf(ConflictException)
  })

  it("remove 409s when the course has enrollments", async () => {
    repo.findById.mockResolvedValue(course({ enrollmentCount: 2 }))
    await expect(service.remove(auth, "c1")).rejects.toBeInstanceOf(ConflictException)
    expect(repo.delete).not.toHaveBeenCalled()
  })

  it("remove deletes an unused course", async () => {
    repo.findById.mockResolvedValue(course())
    await service.remove(auth, "c1")
    expect(repo.delete).toHaveBeenCalledWith("org-1", "c1")
  })
})
