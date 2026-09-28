import "dotenv/config"
import * as argon2 from "argon2"
import { eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import * as schema from "./schema"
import {
  ORG_NAME,
  SEED_PASSWORD,
  seedCareRequests,
  seedCourses,
  seedEnrollments,
  seedLeadershipAssessments,
  seedMilestones,
  seedGroups,
  seedMembers,
  seedSessions,
  seedTags,
  seedUsers,
} from "./seed-data"

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const db = drizzle(pool, { schema })

  const existing = await db
    .select({ id: schema.organizations.id })
    .from(schema.organizations)
    .where(eq(schema.organizations.name, ORG_NAME))
  if (existing.length > 0) {
    console.log(`Seed org "${ORG_NAME}" already exists — nothing to do.`)
    await pool.end()
    return
  }

  const passwordHash = await argon2.hash(SEED_PASSWORD)

  await db.transaction(async (tx) => {
    const [org] = await tx.insert(schema.organizations).values({ name: ORG_NAME }).returning()

    const LEADER_BASELINE_PERMISSIONS = [
      "members:read", "members:create", "members:update",
      "groups:read", "groups:create", "groups:update",
      "households:read", "tags:read", "rooms:read", "events:read",
      "care_requests:read", "care_requests:create", "care_requests:update",
      "journey:read", "journey:create", "journey:update", "courses:read",
    ]

    const [adminRole] = await tx
      .insert(schema.roles)
      .values({ orgId: org.id, name: "Admin", description: "Full access to everything.", isSystemAdmin: true })
      .returning()
    const [leaderRole] = await tx
      .insert(schema.roles)
      .values({ orgId: org.id, name: "Leader", description: "Read/write members and groups; read-only elsewhere." })
      .returning()
    await tx.insert(schema.rolePermissions).values(
      LEADER_BASELINE_PERMISSIONS.map((permission) => ({ roleId: leaderRole.id, permission })),
    )
    const roleIdByName = new Map([["Admin", adminRole.id], ["Leader", leaderRole.id]])

    // tags: roots first, then children (parent ids must exist)
    const tagIdByName = new Map<string, string>()
    for (const pass of [seedTags.filter((t) => !t.parent), seedTags.filter((t) => t.parent)]) {
      for (const t of pass) {
        const [row] = await tx
          .insert(schema.tags)
          .values({
            orgId: org.id,
            name: t.name,
            parentId: t.parent ? tagIdByName.get(t.parent)! : null,
            description: t.description ?? null,
          })
          .returning()
        tagIdByName.set(t.name, row.id)
      }
    }

    const memberIdByLocal = new Map<string, string>()
    for (const m of seedMembers) {
      const [row] = await tx
        .insert(schema.members)
        .values({
          orgId: org.id,
          name: m.name,
          email: m.email,
          phone: m.phone,
          status: m.status,
          joinedAt: m.joinedAt,
        })
        .returning()
      memberIdByLocal.set(m.id, row.id)
      await tx
        .insert(schema.memberTags)
        .values(m.tags.map((t) => ({ memberId: row.id, tagId: tagIdByName.get(t)! })))
    }

    const groupIdByLocal = new Map<string, string>()
    for (const g of seedGroups) {
      const [row] = await tx
        .insert(schema.groups)
        .values({
          orgId: org.id,
          name: g.name,
          leaderMemberId: memberIdByLocal.get(g.leaderId)!,
          scopeTagId: tagIdByName.get(g.scopeTag)!,
          schedule: g.schedule,
          location: g.location,
        })
        .returning()
      groupIdByLocal.set(g.id, row.id)
      await tx
        .insert(schema.groupMembers)
        .values(g.memberIds.map((m) => ({ groupId: row.id, memberId: memberIdByLocal.get(m)! })))
    }

    for (const s of seedSessions) {
      const [row] = await tx
        .insert(schema.attendanceSessions)
        .values({
          orgId: org.id,
          groupId: groupIdByLocal.get(s.groupId)!,
          date: s.date,
          topic: s.topic,
          prayerNotes: s.prayerNotes,
        })
        .returning()
      await tx
        .insert(schema.sessionAttendance)
        .values(s.presentIds.map((m) => ({ sessionId: row.id, memberId: memberIdByLocal.get(m)! })))
    }

    const userIdByEmail = new Map<string, string>()
    for (const u of seedUsers) {
      const [user] = await tx
        .insert(schema.users)
        .values({ email: u.email, name: u.name, passwordHash })
        .returning()
      userIdByEmail.set(u.email, user.id)
      const [membership] = await tx
        .insert(schema.orgMemberships)
        .values({ orgId: org.id, userId: user.id })
        .returning()
      await tx.insert(schema.membershipRoles).values(
        u.roleNames.map((name) => ({ membershipId: membership.id, roleId: roleIdByName.get(name)! })),
      )
      if (u.scopeTags) {
        await tx.insert(schema.membershipScopeTags).values(
          u.scopeTags.map((t) => ({ membershipId: membership.id, tagId: tagIdByName.get(t)! })),
        )
      }
    }

    await tx.insert(schema.careRequests).values(
      seedCareRequests.map((r) => {
        const userId = userIdByEmail.get(r.submittedByEmail)!
        return {
          orgId: org.id,
          memberId: memberIdByLocal.get(r.memberId)!,
          type: r.type,
          body: r.body,
          source: "leader" as const,
          submittedByUserId: userId,
          ...(r.closeNote !== undefined && {
            status: "closed" as const,
            closedAt: new Date(),
            closedByUserId: userId,
            closeNote: r.closeNote,
          }),
        }
      }),
    )

    const courseIdByKey = new Map<string, string>()
    for (const c of seedCourses) {
      const [row] = await tx
        .insert(schema.courses)
        .values({ orgId: org.id, name: c.name, kind: c.kind })
        .returning()
      courseIdByKey.set(c.key, row.id)
    }

    await tx.insert(schema.courseEnrollments).values(
      seedEnrollments.map((e) => ({
        orgId: org.id,
        memberId: memberIdByLocal.get(e.memberId)!,
        courseId: courseIdByKey.get(e.courseKey)!,
        status: e.status,
        startedAt: e.startedAt,
        completedAt: e.completedAt ?? null,
      })),
    )

    await tx.insert(schema.memberMilestones).values(
      seedMilestones.map((m) => ({
        orgId: org.id,
        memberId: memberIdByLocal.get(m.memberId)!,
        type: m.type,
        achievedAt: m.achievedAt,
        note: m.note ?? null,
        recordedByUserId: userIdByEmail.get(m.recordedByEmail)!,
      })),
    )
    // Same sync the API does when a baptism milestone is recorded.
    for (const m of seedMilestones.filter((m) => m.type === "baptism")) {
      await tx
        .update(schema.members)
        .set({ baptismStatus: "baptized", baptismDate: m.achievedAt })
        .where(eq(schema.members.id, memberIdByLocal.get(m.memberId)!))
    }

    await tx.insert(schema.leadershipAssessments).values(
      seedLeadershipAssessments.map((a) => ({
        orgId: org.id,
        memberId: memberIdByLocal.get(a.memberId)!,
        level: a.level,
        targetRole: a.targetRole,
        note: a.note ?? null,
        assessedByUserId: userIdByEmail.get(a.assessedByEmail)!,
      })),
    )
  })

  console.log(`Seeded "${ORG_NAME}".`)
  console.log(`Logins (password: ${SEED_PASSWORD}):`)
  for (const u of seedUsers) console.log(`  ${u.email} — ${u.roleNames.join(", ")}`)
  await pool.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
