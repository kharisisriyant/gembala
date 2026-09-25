// Demo data copied from the UI prototype's mock.ts so the seeded org matches
// what the mock rendered. Local ids (m1, g1, ...) only key the maps below —
// real rows get uuids.

export type SeedTag = { name: string; parent: string | null; description?: string }
export type SeedMember = {
  id: string
  name: string
  email: string
  phone: string
  tags: string[]
  status: "active" | "newcomer" | "inactive"
  joinedAt: string
}
export type SeedGroup = {
  id: string
  name: string
  leaderId: string
  scopeTag: string
  memberIds: string[]
  schedule: string
  location: string
}
export type SeedSession = {
  groupId: string
  date: string
  presentIds: string[]
  topic: string
  prayerNotes: string
}
export type SeedUser = {
  name: string
  email: string
  roleNames: string[]
  scopeTags: string[] | null
}

export const ORG_NAME = "Gembala Demo Church"
export const SEED_PASSWORD = "password123"

export const seedTags: SeedTag[] = [
  { name: "members", parent: null, description: "Everyone in the church directory" },

  { name: "youth", parent: null, description: "Students & young people" },
  { name: "teen", parent: "youth", description: "Junior & senior high school" },
  { name: "college", parent: "youth", description: "University & young adults" },

  { name: "married", parent: null, description: "Married couples" },
  { name: "kids", parent: null, description: "Children's ministry" },

  { name: "worship", parent: null, description: "Worship & music ministry" },
  { name: "guitarist", parent: "worship" },
  { name: "pianist", parent: "worship" },
  { name: "vocalist", parent: "worship" },

  { name: "prayer-team", parent: null, description: "Intercessory prayer" },
  { name: "usher", parent: null, description: "Hospitality & ushering" },
  { name: "leader", parent: null, description: "Group leaders & coordinators" },
]

export const seedMembers: SeedMember[] = [
  { id: "m1", name: "Andrew Tanu", email: "andrew.t@gmail.com", phone: "0812-1111-2201", tags: ["members", "youth", "worship", "guitarist", "leader"], status: "active", joinedAt: "2021-03-14" },
  { id: "m2", name: "Bella Sihombing", email: "bella.s@gmail.com", phone: "0812-1111-2202", tags: ["members", "youth", "worship", "vocalist"], status: "active", joinedAt: "2022-01-09" },
  { id: "m3", name: "Calvin Wijaya", email: "calvin.w@gmail.com", phone: "0812-1111-2203", tags: ["members", "youth", "college"], status: "active", joinedAt: "2022-08-21" },
  { id: "m4", name: "Diana Putri", email: "diana.p@gmail.com", phone: "0812-1111-2204", tags: ["members", "youth", "teen", "prayer-team"], status: "active", joinedAt: "2023-02-11" },
  { id: "m5", name: "Eric Halim", email: "eric.h@gmail.com", phone: "0812-1111-2205", tags: ["members", "youth", "teen", "usher"], status: "newcomer", joinedAt: "2026-04-02" },
  { id: "m6", name: "Fiona Lim", email: "fiona.l@gmail.com", phone: "0812-1111-2206", tags: ["members", "youth", "college", "worship", "vocalist"], status: "active", joinedAt: "2021-11-30" },
  { id: "m7", name: "Gerald Manik", email: "gerald.m@gmail.com", phone: "0812-1111-2207", tags: ["members", "married", "leader", "prayer-team"], status: "active", joinedAt: "2018-06-17" },
  { id: "m8", name: "Hana Kusuma", email: "hana.k@gmail.com", phone: "0812-1111-2208", tags: ["members", "married", "worship", "vocalist", "pianist"], status: "active", joinedAt: "2019-09-03" },
  { id: "m9", name: "Ivan Pratama", email: "ivan.p@gmail.com", phone: "0812-1111-2209", tags: ["members", "married", "usher"], status: "active", joinedAt: "2020-05-25" },
  { id: "m10", name: "Jessica Tan", email: "jessica.t@gmail.com", phone: "0812-1111-2210", tags: ["members", "married", "kids", "leader"], status: "active", joinedAt: "2017-12-12" },
  { id: "m11", name: "Kevin Surya", email: "kevin.s@gmail.com", phone: "0812-1111-2211", tags: ["members", "college", "guitarist"], status: "active", joinedAt: "2023-07-19" },
  { id: "m12", name: "Linda Marpaung", email: "linda.m@gmail.com", phone: "0812-1111-2212", tags: ["members", "college", "prayer-team"], status: "newcomer", joinedAt: "2026-05-18" },
  { id: "m13", name: "Marcus Ng", email: "marcus.n@gmail.com", phone: "0812-1111-2213", tags: ["members", "youth", "worship", "guitarist"], status: "active", joinedAt: "2022-04-08" },
  { id: "m14", name: "Nadia Sari", email: "nadia.s@gmail.com", phone: "0812-1111-2214", tags: ["members", "youth", "kids"], status: "inactive", joinedAt: "2021-02-27" },
  { id: "m15", name: "Oscar Wibowo", email: "oscar.w@gmail.com", phone: "0812-1111-2215", tags: ["members", "married", "leader"], status: "active", joinedAt: "2016-10-05" },
]

export const seedGroups: SeedGroup[] = [
  { id: "g1", name: "Youth Komsel — North", leaderId: "m1", scopeTag: "youth", memberIds: ["m1", "m2", "m3", "m4", "m5"], schedule: "Fri · 7:00 PM", location: "Andrew's home, Kelapa Gading" },
  { id: "g2", name: "Youth Komsel — South", leaderId: "m13", scopeTag: "youth", memberIds: ["m13", "m6", "m14"], schedule: "Fri · 7:30 PM", location: "Church Room 201" },
  { id: "g3", name: "Worship Team Connect", leaderId: "m8", scopeTag: "worship", memberIds: ["m1", "m2", "m6", "m8", "m13"], schedule: "Sun · 4:00 PM", location: "Main Hall" },
  { id: "g4", name: "Couples Komsel", leaderId: "m7", scopeTag: "married", memberIds: ["m7", "m8", "m9", "m10", "m15"], schedule: "Sat · 6:00 PM", location: "Gerald & Hana's home" },
  { id: "g5", name: "Campus Fellowship", leaderId: "m11", scopeTag: "college", memberIds: ["m3", "m6", "m11", "m12"], schedule: "Wed · 6:30 PM", location: "Cafe Sejahtera" },
]

export const seedSessions: SeedSession[] = [
  { groupId: "g1", date: "2026-06-19", presentIds: ["m1", "m2", "m3", "m4"], topic: "Identity in Christ — Ephesians 1", prayerNotes: "Eric still searching for a job. Diana's mom recovering from surgery. Praise: Calvin passed his finals." },
  { groupId: "g1", date: "2026-06-12", presentIds: ["m1", "m2", "m4", "m5"], topic: "What is grace? — Romans 5", prayerNotes: "Pray for Calvin's exams this week. Group fasting on Wednesday." },
  { groupId: "g1", date: "2026-06-05", presentIds: ["m1", "m3", "m4", "m5"], topic: "Welcome night + testimonies", prayerNotes: "Bella travelling. New friend Eric joined — pray he feels at home." },
  { groupId: "g2", date: "2026-06-19", presentIds: ["m13", "m6"], topic: "Serving with the right heart — Mark 10", prayerNotes: "Nadia hasn't come in a month — Marcus to follow up this week." },
  { groupId: "g4", date: "2026-06-20", presentIds: ["m7", "m8", "m10", "m15"], topic: "Marriage & communication — Eph 4", prayerNotes: "Ivan travelling for work. Pray for Jessica's parents' health." },
  { groupId: "g3", date: "2026-06-21", presentIds: ["m1", "m2", "m8", "m13"], topic: "Sunday prep + heart check-in", prayerNotes: "Fiona sick. Smooth flow for this Sunday's service." },
]

export const seedUsers: SeedUser[] = [
  { name: "Pastor David", email: "pastor.david@gembala.dev", roleNames: ["Admin"], scopeTags: null },
  { name: "Andrew Tanu", email: "andrew@gembala.dev", roleNames: ["Leader"], scopeTags: ["youth"] },
  { name: "Hana Kusuma", email: "hana@gembala.dev", roleNames: ["Leader"], scopeTags: ["worship"] },
  { name: "Gerald Manik", email: "gerald@gembala.dev", roleNames: ["Leader"], scopeTags: ["married"] },
]
