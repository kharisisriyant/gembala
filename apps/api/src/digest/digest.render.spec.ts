import { isEmptyDigest, renderDigest, type DigestData } from "./digest.render"

const empty = { care: [], absent: [], newcomers: [], nextStep: [], birthdays: [] }
const personal = (items: Partial<DigestData["items"]>): DigestData => ({
  kind: "personal",
  userName: "Andrew",
  weekStart: "2026-11-09",
  items: { ...empty, ...items },
})
const careItem = (i: number) => ({ requestId: `r${i}`, memberId: `m${i}`, memberName: `Person ${i}`, type: "care" as const, daysOpen: 12, overdueDays: 4, alsoAbsentMissed: null })

describe("renderDigest", () => {
  it("renders sections with counts, annotations and links (EN)", () => {
    const out = renderDigest(
      personal({
        care: [{ ...careItem(1), alsoAbsentMissed: 3 }],
        absent: [{ memberId: "a", name: "Dewi", groupId: "g", groupName: "Youth", missed: 3, lastSeen: "2026-10-25" }],
        newcomers: [{ memberId: "n", name: "Rina", daysSince: 20 }],
        nextStep: [{ stage: "Baptism class", count: 2 }],
        birthdays: [{ memberId: "b", name: "Hana", dateOfBirth: "1990-11-11", daysUntil: 2, date: "2026-11-11" }],
      }),
      "en",
      "https://app.test",
    )
    expect(out.subject).toContain("weekly gembala digest")
    expect(out.text).toContain("3 need you")
    expect(out.text).toContain("CARE (1)")
    expect(out.text).toContain("Person 1 — care request · open 12 days · overdue 4 days · also absent 3")
    expect(out.text).toContain("Dewi · Youth · missed 3 · last seen 25 Oct")
    expect(out.text).toContain("Rina · 20 days since first visit")
    expect(out.text).toContain("Birthdays: Hana (Wed)")
    expect(out.text).toContain("Baptism class 2")
    expect(out.text).toContain("https://app.test/profile")
  })

  it("renders Indonesian", () => {
    const out = renderDigest(personal({ care: [careItem(1)] }), "id", "https://app.test")
    expect(out.text).toContain("Selamat pagi Andrew")
    expect(out.text).toContain("permohonan pelayanan")
    expect(out.text).toContain("terlambat 4 hari")
  })

  it("caps each section at 5 lines with '+N more' and stays under Telegram's limit", () => {
    const care = Array.from({ length: 40 }, (_, i) => careItem(i))
    const out = renderDigest(personal({ care }), "en", "https://app.test")
    expect(out.text.match(/^• Person/gm)).toHaveLength(5)
    expect(out.text).toContain("+35 more")
    expect(out.text.length).toBeLessThan(4096)
  })

  it("never includes request body text and escapes HTML", () => {
    const out = renderDigest(personal({ care: [{ ...careItem(1), memberName: "<b>Eve</b>" }] }), "en", "https://app.test")
    expect(out.html).toContain("&lt;b&gt;Eve&lt;/b&gt;")
    expect(out.html).not.toContain("<b>Eve")
  })

  it("renders the admin summary", () => {
    const out = renderDigest(
      {
        ...personal({ absent: [{ memberId: "a", name: "Dewi", groupId: "g", groupName: "Youth", missed: 2, lastSeen: null }] }),
        kind: "admin",
        summary: {
          byOwner: [{ name: "Lea", open: 3, overdue: 2 }],
          unassigned: 1,
          ownerCannotSee: 1,
          longestOverdue: [{ memberName: "Budi", type: "prayer", ownerName: null, overdueDays: 9 }],
        },
      },
      "en",
      "https://app.test",
    )
    expect(out.text).toContain("team summary")
    expect(out.text).toContain("4 open, 2 overdue")
    expect(out.text).toContain("1 unassigned")
    expect(out.text).toContain("Lea: 3 open, 2 overdue")
    expect(out.text).toContain("Budi — prayer request · unassigned · overdue 9 days")
    expect(out.text).toContain("1 absent")
  })
})

describe("isEmptyDigest", () => {
  it("is empty only when every section is empty", () => {
    expect(isEmptyDigest(personal({}))).toBe(true)
    expect(isEmptyDigest(personal({ birthdays: [{ memberId: "b", name: "H", dateOfBirth: "", daysUntil: 0, date: "" }] }))).toBe(false)
  })
})
