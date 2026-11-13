import { readFileSync } from "node:fs"
import { join } from "node:path"
import { notificationTypes } from "./notification-types"

// Every deep link in the catalog must land on a real web route (a wrong path
// renders a blank page). Routes are read from the web app's router.
const routes = [...readFileSync(join(__dirname, "../../../web/src/App.tsx"), "utf8").matchAll(/path="([^"]+)"/g)].map((m) => m[1])
const matches = (path: string) =>
  routes.some((route) => new RegExp(`^${route.replace(/:[^/]+/g, "[^/]+")}$`).test(path))

const uuid = "11111111-1111-4111-8111-111111111111"
const samples: Record<string, object> = {
  "care_request.assigned": { memberId: uuid, memberName: "Jo", type: "care", assignedBy: "Lea", dueAt: "2026-11-20" },
  "care_request.reopened": { memberId: uuid, memberName: "Jo", type: "care", reopenedBy: "Lea" },
  "care_request.due_soon": { memberId: uuid, memberName: "Jo", type: "care", dueAt: "2026-11-20", daysLeft: 1 },
  "care_request.overdue": { memberId: uuid, memberName: "Jo", type: "prayer", dueAt: "2026-11-01", overdueDays: 7 },
  "attention.absence_streak": { memberId: uuid, memberName: "Jo", groupId: uuid, groupName: "Youth", missed: 3 },
  "journey.stage_reminder": { memberId: uuid, memberName: "Jo", daysSince: 4 },
  "invite.accepted": { inviteeName: "Ana" },
  "security.password_changed": {},
  "security.refresh_reuse": {},
  "digest.weekly": { subject: "Week", text: "Body" },
}

describe("notification catalog", () => {
  it("has a sample for every type", () => {
    expect(Object.keys(samples).sort()).toEqual(notificationTypes.map((t) => t.key).sort())
  })

  it.each(notificationTypes.map((t) => [t.key, t] as const))("%s validates, renders in both locales and links to a real route", (key, type) => {
    const payload = type.payload.parse(samples[key])
    for (const locale of ["en", "id"] as const) {
      const out = type.render(locale, payload)
      expect(out.title.length).toBeGreaterThan(0)
      expect(out.body.length).toBeGreaterThan(0)
      if (out.link) expect(matches(out.link.split("?")[0])).toBe(true)
    }
  })

  it("keeps product updates out of transactional and security types (NT-4)", () => {
    expect(notificationTypes.filter((t) => t.category === "product_updates")).toEqual([])
  })
})
