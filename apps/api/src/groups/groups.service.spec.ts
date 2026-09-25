import { BadRequestException, NotFoundException } from "@nestjs/common"
import { GroupsService } from "./groups.service"
import type { GroupsRepository } from "./groups.repository"
import type { ScopeService } from "../authz/scope.service"
import type { TagsService } from "../tags/tags.service"
import type { MembersService } from "../members/members.service"
import type { Db } from "../db/drizzle.module"

function makeRepo(): jest.Mocked<GroupsRepository> {
  return {
    orgGroupsWithScopeTag: jest.fn(),
    membersByGroupIds: jest.fn(),
    membersByIds: jest.fn(),
    membersInOrgByIds: jest.fn(),
    lastSessionsByGroupIds: jest.fn(),
    presentCountsBySessionIds: jest.fn(),
    insert: jest.fn(),
    insertGroupMembers: jest.fn(),
    groupMemberIds: jest.fn(),
    update: jest.fn(),
    replaceGroupMembers: jest.fn(),
    sessionsByGroupId: jest.fn(),
    presentRowsBySessionIds: jest.fn(),
    rosterRowsByGroupIds: jest.fn(),
    sessionRowsSince: jest.fn(),
  } as unknown as jest.Mocked<GroupsRepository>
}

const auth = { orgId: "org-1" } as any
const groupRow = {
  id: "g1",
  name: "Youth Group",
  leaderMemberId: "leader-1",
  scopeTagName: "youth",
  schedule: "Fridays 7pm",
  location: "Room 3",
}

describe("GroupsService", () => {
  let repo: jest.Mocked<GroupsRepository>
  let scope: jest.Mocked<ScopeService>
  let tags: jest.Mocked<TagsService>
  let members: jest.Mocked<MembersService>
  let db: jest.Mocked<Db>
  let service: GroupsService

  beforeEach(() => {
    repo = makeRepo()
    scope = { expandedScope: jest.fn(), groupVisible: jest.fn(), assertGroupVisible: jest.fn() } as any
    tags = { resolveTagIds: jest.fn() } as any
    members = { orgMembersWithTags: jest.fn() } as any
    db = { transaction: jest.fn((cb: any) => cb(db)) } as any
    service = new GroupsService(db, repo, scope, tags, members)
  })

  describe("list", () => {
    it("filters groups outside scope and sorts by name", async () => {
      repo.orgGroupsWithScopeTag.mockResolvedValue([
        { ...groupRow, id: "g1", name: "Zeta" },
        { ...groupRow, id: "g2", name: "Alpha" },
      ])
      scope.expandedScope.mockResolvedValue({} as any)
      scope.groupVisible.mockImplementation((_s, tag) => tag === "youth")
      repo.membersByGroupIds.mockResolvedValue([])
      repo.membersByIds.mockResolvedValue([])
      repo.lastSessionsByGroupIds.mockResolvedValue([])
      repo.presentCountsBySessionIds.mockResolvedValue([])

      const result = await service.list(auth)

      expect(result.map((g) => g.name)).toEqual(["Alpha", "Zeta"])
    })

    it("returns [] with no extra queries when nothing is visible", async () => {
      repo.orgGroupsWithScopeTag.mockResolvedValue([groupRow])
      scope.expandedScope.mockResolvedValue({} as any)
      scope.groupVisible.mockReturnValue(false)

      const result = await service.list(auth)

      expect(result).toEqual([])
      expect(repo.membersByGroupIds).not.toHaveBeenCalled()
    })
  })

  describe("create", () => {
    it("rejects member ids that don't exist in the org", async () => {
      scope.expandedScope.mockResolvedValue({} as any)
      tags.resolveTagIds.mockResolvedValue(new Map([["youth", "t1"]]))
      repo.membersInOrgByIds.mockResolvedValue([{ id: "leader-1", name: "Leader" }])

      await expect(
        service.create(auth, {
          name: "Youth",
          scopeTag: "youth",
          leaderId: "leader-1",
          memberIds: ["m1", "m2"],
          schedule: "",
          location: "",
        } as any),
      ).rejects.toThrow(BadRequestException)
      expect(repo.insert).not.toHaveBeenCalled()
    })

    it("always includes the leader in the roster", async () => {
      scope.expandedScope.mockResolvedValue({} as any)
      tags.resolveTagIds.mockResolvedValue(new Map([["youth", "t1"]]))
      repo.membersInOrgByIds.mockResolvedValue([{ id: "leader-1", name: "Leader" }])
      repo.insert.mockResolvedValue({ ...groupRow, id: "g1" } as any)

      await service.create(auth, {
        name: "Youth",
        scopeTag: "youth",
        leaderId: "leader-1",
        memberIds: [],
        schedule: "",
        location: "",
      } as any)

      expect(repo.membersInOrgByIds).toHaveBeenCalledWith(auth.orgId, ["leader-1"])
      expect(repo.insertGroupMembers).toHaveBeenCalledWith("g1", ["leader-1"], db)
    })
  })

  describe("requireVisibleGroup", () => {
    it("404s on unknown group", async () => {
      repo.orgGroupsWithScopeTag.mockResolvedValue([])

      await expect(service.requireVisibleGroup(auth, "missing")).rejects.toThrow(NotFoundException)
    })
  })

  describe("update", () => {
    it("rejects a roster change with unknown member ids", async () => {
      repo.orgGroupsWithScopeTag.mockResolvedValue([groupRow])
      scope.expandedScope.mockResolvedValue({} as any)
      scope.groupVisible.mockReturnValue(true)
      repo.membersInOrgByIds.mockResolvedValue([])

      await expect(
        service.update(auth, "g1", { memberIds: ["ghost"] } as any),
      ).rejects.toThrow(BadRequestException)
      expect(repo.update).not.toHaveBeenCalled()
    })
  })

  describe("attendanceHeatmap", () => {
    it("returns empty groups with correct week buckets when nothing is visible", async () => {
      repo.orgGroupsWithScopeTag.mockResolvedValue([])
      scope.expandedScope.mockResolvedValue({} as any)

      const result = await service.attendanceHeatmap(auth, 4)

      expect(result.groups).toEqual([])
      expect(result.weeks).toHaveLength(4)
    })
  })
})
