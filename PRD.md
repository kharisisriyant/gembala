# Gembala — Church Leadership App
### Product Requirements Document · v0.2 · May 2026

---

## Table of Contents

1. [Overview & Goals](#1-overview--goals)
2. [Multi-Tenant Architecture](#2-multi-tenant-architecture)
3. [User Personas](#3-user-personas)
4. [Scope](#4-scope)
5. [Tag System & RBAC](#5-tag-system--rbac)
6. [Members](#6-members--functional-requirements)
7. [Small Groups](#7-small-groups--functional-requirements)
8. [AI Assistant — Telegram MCP](#8-ai-assistant--telegram-mcp)
9. [Non-Functional Requirements](#9-non-functional-requirements)
10. [Data Model](#10-data-model)
11. [Tech Stack](#11-tech-stack)

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| v0.2 | May 2026 | Multi-tenant SaaS, tag-based RBAC, AI + Telegram MCP, guest profiles, flexible scheduling |
| v0.1 | May 2026 | Initial draft — single church scope |

---

## 1. Overview & Goals

Gembala (Indonesian: "shepherd / pastor") is a multi-tenant SaaS platform for church communities. Each church is an isolated tenant. Leaders manage member care, track small group attendance, and receive AI-powered follow-up suggestions — all from a web browser and optionally via a Telegram chatbot.

### Success Metrics

- A new church can onboard (create account, add first group, record first session) in under 15 minutes
- Attendance can be taken for a session in under 3 minutes via web or Telegram chat
- Leaders are automatically surfaced members absent 2+ consecutive sessions
- Analytics dashboard loads under 2 seconds for groups up to 200 members
- AI assistant correctly interprets attendance commands with ≥95% accuracy in natural language

---

## 2. Multi-Tenant Architecture

Each church is a tenant. Tenant data is logically isolated — no leader or member can see data from another church.

### Recommended Approach: Shared Database, Tenant-Scoped Rows

Every table carries a `church_id` foreign key. Row-level security (RLS) in PostgreSQL enforces isolation. This is the simplest approach for a v1 SaaS and is easy to operate. Consider schema-per-tenant if strict data residency compliance is required later.

**Implementation rules:**

- `churches` table is the root entity; all other tables reference it via `church_id`
- Every API route resolves the current `church_id` from the authenticated session before executing any query
- PostgreSQL RLS policies enforce tenant isolation as a second layer of defence
- Billing, plan limits, and feature flags are stored on the `churches` row

**RLS pattern:**

```sql
-- Set at the start of every database session
SET app.church_id = '<church_id_from_jwt>';

-- RLS policy example
CREATE POLICY tenant_isolation ON members
  USING (church_id = current_setting('app.church_id')::uuid);
```

### Church Onboarding Flow

1. A church admin registers → creates a new church tenant with a unique slug (e.g. `gkj-jakarta.gembala.app`)
2. Admin invites other users by email; invited users are scoped to that tenant
3. Super-admin (Gembala staff) account can view tenant metadata for support — never member-level data

---

## 3. User Personas

| Persona | Role | Primary Needs |
|---------|------|---------------|
| **Cell Leader** | Leads a small group of 8–20 members | Take attendance, view absences, add pastoral notes, use Telegram bot |
| **Zone Leader** | Oversees multiple cell leaders | Aggregate attendance across groups, identify struggling members |
| **Church Admin** | Manages the tenant | Manage users, configure tags, export reports, manage billing |
| **Super-Admin** | Gembala staff | Cross-tenant support, platform health monitoring |

---

## 4. Scope

### In Scope — v1

- Multi-tenant church accounts with subdomain routing
- Tag-based RBAC for member visibility and data ownership
- Member management (profiles, pastoral notes, guest profiles)
- Small group management with flexible session scheduling
- Attendance tracking with consecutive-absence alerting
- Analytics dashboard (attendance trends, absence reports)
- AI assistant via Telegram (MCP-powered)
- File attachments via Cloudflare R2

### Out of Scope — v1

- Ministry / service roster management
- WhatsApp / email push notifications
- Financial / tithing tracking
- Native mobile app (iOS / Android)
- PWA offline mode
- Public event registration pages

---

## 5. Tag System & RBAC

Tags serve a dual purpose: they categorise members (e.g. `youth`, `sunday-school-teacher`, `new-believer`) and they control which members each leader can see. A leader's access is determined by which tags they have been granted visibility over.

**Access model:** Union/OR — a leader who has access to tag A OR tag B can see any member carrying either tag. A member with no tags is visible only to admins.

### FR-TAG-01 · Tag Management `[P1 — must have]`

- Admin creates and manages tags within their church tenant (name, colour, description)
- Tags are scoped to a church — no cross-tenant tag sharing
- Admin can assign one or more tags to any member
- A member with no tags is visible only to admins
- Tags can represent life stage, ministry involvement, campus, or any arbitrary grouping the church defines

### FR-TAG-02 · Leader Tag Access `[P1 — must have]`

- Admin grants a leader access to one or more tags
- A leader can see and interact with any member who has at least one tag the leader has access to
- If a member is removed from all tags a leader has access to, that leader can no longer see the member (data is not deleted)
- Access grants are logged in the audit trail

### FR-TAG-03 · Data Ownership on Leader Offboarding `[P2 — should have]`

- When a leader's account is deactivated, their tag access is revoked immediately
- All member records, pastoral notes, and attendance they created are retained and re-attributed to the church admin
- Admin can reassign a deactivated leader's tag access to another leader
- Pastoral notes remain private to admin until explicitly reassigned

> **Design note:** A member can have multiple tags (e.g. `youth` + `sunday-school-teacher`). A leader who has access to either tag can see that member. This is a union/OR model. If AND behaviour is needed in future, the schema supports it by adding an `access_mode` field to `user_tag_access`.

---

## 6. Members — Functional Requirements

### FR-MEM-01 · Member Profile `[P1 — must have]`

- Fields: full name, phone, email, date of birth, address, gender, marital status, baptism date, join date, notes
- Upload profile photo (stored in Cloudflare R2 under the tenant's path prefix)
- Edit any field; changes are timestamped and attributed to the editing user
- Soft-delete (archive); archived members hidden from default views but retained in the database
- Member type: `regular` (belongs to a group) or `guest` (visited but not yet assigned)

### FR-MEM-02 · Guest Profiles `[P1 — must have]`

- Leaders can create a guest profile during or after a session (same fields as regular member)
- Guests appear in the member list with a `guest` badge; not counted in group membership metrics
- Admin or leader can promote a guest to a regular member and assign them to a group and tags
- Guest attendance at a session is tracked identically to regular member attendance

### FR-MEM-03 · Pastoral Notes `[P1 — must have]`

- Leaders add private, timestamped notes to members they can see (scoped by tag access)
- Notes visible only to the author and admin-level users
- Basic rich text supported (bold, italic, bullet list)
- File attachments (PDF, images) via Cloudflare R2
- Notes can be created via Telegram bot (see section 8)

### FR-MEM-04 · Search & Filtering `[P1 — must have]`

- Full-text search across name, phone, email — results scoped to leader's tag access
- Filter by: tag, group, member type (guest/regular), gender, baptism status, join date range
- Sort by name (A–Z), join date (newest first), last attendance

### FR-MEM-05 · Member Transfer `[P2 — should have]`

- Admin or zone leader can transfer a member from one small group to another
- Transfer logs (from group, to group, date, initiated by) are preserved for auditing
- Historical attendance records remain associated with the member after transfer

### FR-MEM-06 · Birthday Reminders `[P3 — nice to have]`

- Dashboard widget listing members with birthdays this week (scoped to leader's access)
- Telegram bot can surface this automatically at the start of each week

---

## 7. Small Groups — Functional Requirements

### FR-GRP-01 · Group Management `[P1 — must have]`

- Create a group: name, meeting schedule (supports `weekly` / `biweekly` / `monthly`), meeting day, meeting time, location, assigned leader(s)
- Groups can be nested into zones for hierarchical reporting
- Add or remove members from a group; transfer history is preserved
- A member may belong to exactly one primary group at a time

### FR-GRP-02 · Session & Attendance Recording `[P1 — must have]`

- Create a session record (date, topic/title, notes) for each group meeting
- Record per-member attendance status: `present`, `absent`, or `excused` (optional reason)
- Guest profiles can be added to a session ad hoc
- Sessions are editable up to 7 days after creation; older sessions require admin override
- Attendance can be recorded via Telegram bot (see section 8)
- `source` field on each record tracks whether it was entered via `web` or `telegram`

### FR-GRP-03 · Consecutive-Absence Alerting `[P1 — must have]`

- Absence threshold is based on **consecutive sessions**, not calendar weeks — this correctly handles bi-weekly and monthly groups
- Default threshold: 2 consecutive sessions absent → member flagged for follow-up
- Threshold is configurable per group by admin
- Flagged members appear in a "needs follow-up" list on the leader dashboard and are queryable via Telegram
- Leader marks a flagged member as "followed up" to dismiss the alert, with an optional resolution note

### FR-GRP-04 · Analytics Dashboard `[P1 — must have]`

- **Attendance rate chart:** line chart of attendance % per session, last 12 sessions
- **Headcount trend:** bar chart of total present per session over time
- **Member attendance heatmap:** members × sessions grid showing `present` / `absent` / `excused`
- **Absence list:** members ranked by total absences in a selected date range
- Zone leaders see aggregated metrics across all their groups
- All views filterable by date range and tag

### FR-GRP-05 · Export `[P2 — should have]`

- Export attendance data (group + date range) as CSV or PDF
- Export member list (admin only) as CSV; respects tag-based access scoping
- Files are generated server-side and downloaded directly — not stored permanently

---

## 8. AI Assistant — Telegram MCP

Leaders can connect their personal Telegram account to the Gembala bot. The bot exposes a subset of app functionality via natural language, powered by an MCP (Model Context Protocol) server that bridges the Telegram message handler and the Gembala API.

### Architecture Overview

```
Leader (Telegram) → Telegram Bot API → MCP Server (Node.js / Fly.io)
                                              ↓
                                     Anthropic Claude API
                                     (tool use / function calling)
                                              ↓
                                     Gembala Internal API
                                     (scoped to leader's church_id + tag access)
                                              ↓
                                     PostgreSQL (Neon)
```

> **Security note:** The AI model never receives data outside the leader's tag-scoped permissions. Permission checks happen at the Gembala API layer before any data is returned to the MCP server — it is not a UI-only restriction.

### FR-AI-01 · Telegram Account Linking `[P1 — must have]`

- Leader navigates to Settings → Integrations → Telegram in the web app
- Web app generates a one-time link code (expires after 10 minutes)
- Leader sends the code to the Gembala Telegram bot to verify ownership
- Link persists until the leader explicitly unlinks or their account is deactivated
- One Telegram account maps to exactly one Gembala user account

### FR-AI-02 · Attendance via Chat `[P1 — must have]`

- Leader sends a natural language message to record attendance for a session
- Example: _"Attendance for youth group today: Budi, Sari, Dewi present. Andi excused — sick."_
- Bot confirms the parsed attendance and asks for confirmation before writing to the database
- If a session for that group and date does not exist, the bot creates it automatically
- Ambiguous names (more than one match) trigger a disambiguation prompt from the bot

### FR-AI-03 · Follow-Up Queries `[P1 — must have]`

Leader can ask the bot questions in natural language, answered from their scoped data. Examples the bot must support:

- "Who hasn't come to youth group in 2 sessions?"
- "How many people attended last week's session?"
- "Show me Budi's attendance history"
- "Who are the guests from last month?"
- "Remind me of all members with birthdays this week"

Bot responses are strictly scoped to the leader's tag access.

### FR-AI-04 · Pastoral Notes via Chat `[P2 — should have]`

- Leader dictates a note: _"Note for Budi: called him today, going through a difficult time at work, follow up next week."_
- Bot confirms the note and member match before saving
- Notes created via Telegram are identical to web-created notes in the database

### FR-AI-05 · MCP Tool Surface `[P1 — must have]`

The MCP server exposes the following tools to the AI model. Each tool enforces the calling user's `church_id` and tag access:

| Tool | Description |
|------|-------------|
| `list_members` | Query members by name, tag, group, or absence status |
| `get_member` | Retrieve a single member's profile and attendance history |
| `list_sessions` | List recent sessions for a group |
| `record_attendance` | Write attendance records for a session |
| `create_session` | Create a new session for a group |
| `add_pastoral_note` | Create a pastoral note for a member |
| `get_absence_report` | Return members currently flagged for follow-up |
| `get_birthdays` | Return members with birthdays in a given date window |

---

## 9. Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| **Performance** | Page loads under 2s on 4G; attendance submission under 500ms; Telegram bot response under 3s |
| **Availability** | 99.5% uptime; maintenance windows communicated in-app |
| **Multi-tenancy** | Complete data isolation between church tenants enforced at API layer and database layer (PostgreSQL RLS) |
| **Security** | TLS in transit; encrypted at rest; RBAC enforced server-side; Telegram link codes expire after 10 minutes |
| **Privacy** | Member data never shared across tenants or with third parties; AI model receives only minimum data needed to answer the query |
| **Accessibility** | WCAG 2.1 AA; keyboard-navigable; responsive layout for mobile browsers |
| **Scalability** | Support 100 church tenants, up to 5,000 members per tenant, and 100 concurrent users in v1 |
| **Auditability** | Key actions (edit member, attendance write, tag assignment, leader offboarding) logged with actor + timestamp |
| **Localisation** | UI in Bahasa Indonesia and English, switchable per user |

---

## 10. Data Model

### Entity Overview

```
churches
  └── users (role: admin / zone_leader / cell_leader / super_admin)
  └── tags
        └── user_tag_access  (leader → tag grants)
        └── member_tags      (member → tag assignments)
  └── members (type: regular / guest)
        └── group_memberships
        └── attendance_records
        └── pastoral_notes
        └── follow_up_flags
  └── groups
        └── sessions
              └── attendance_records
  └── audit_logs
  └── telegram_links
```

### Table Definitions

#### `churches`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `name` | text | |
| `slug` | text unique | Used for subdomain routing |
| `plan` | text | e.g. `free`, `pro` |
| `billing_email` | text | |
| `created_at` | timestamptz | |

#### `users`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `church_id` | uuid FK → churches | |
| `name` | text | |
| `email` | text unique | |
| `hashed_password` | text | |
| `role` | enum | `super_admin`, `admin`, `zone_leader`, `cell_leader` |
| `deactivated_at` | timestamptz | Nullable; null = active |

#### `tags`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `church_id` | uuid FK → churches | |
| `name` | text | |
| `colour` | text | Hex colour code |
| `description` | text | Nullable |

#### `user_tag_access`
| Column | Type | Notes |
|--------|------|-------|
| `user_id` | uuid FK → users | |
| `tag_id` | uuid FK → tags | |
| `granted_by` | uuid FK → users | |
| `granted_at` | timestamptz | |

#### `members`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `church_id` | uuid FK → churches | |
| `full_name` | text | |
| `phone` | text | Nullable |
| `email` | text | Nullable |
| `dob` | date | Nullable |
| `gender` | enum | `male`, `female` |
| `marital_status` | enum | `single`, `married`, `widowed`, `divorced` |
| `baptised_at` | date | Nullable |
| `joined_at` | date | |
| `type` | enum | `regular`, `guest` |
| `photo_r2_key` | text | Nullable; R2 object key |
| `archived_at` | timestamptz | Nullable; null = active |

#### `member_tags`
| Column | Type | Notes |
|--------|------|-------|
| `member_id` | uuid FK → members | |
| `tag_id` | uuid FK → tags | |
| `assigned_by` | uuid FK → users | |
| `assigned_at` | timestamptz | |

#### `groups`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `church_id` | uuid FK → churches | |
| `name` | text | |
| `schedule_type` | enum | `weekly`, `biweekly`, `monthly` |
| `meeting_day` | text | e.g. `wednesday` |
| `meeting_time` | time | |
| `location` | text | Nullable |
| `zone_id` | uuid FK → groups | Nullable; self-reference for nesting |
| `leader_user_id` | uuid FK → users | |

#### `group_memberships`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `group_id` | uuid FK → groups | |
| `member_id` | uuid FK → members | |
| `joined_at` | date | |
| `left_at` | date | Nullable; null = currently active |

#### `sessions`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `group_id` | uuid FK → groups | |
| `session_date` | date | |
| `topic` | text | Nullable |
| `notes` | text | Nullable |
| `created_by` | uuid FK → users | |
| `created_at` | timestamptz | |

#### `attendance_records`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `session_id` | uuid FK → sessions | |
| `member_id` | uuid FK → members | |
| `status` | enum | `present`, `absent`, `excused` |
| `reason` | text | Nullable |
| `recorded_by` | uuid FK → users | |
| `source` | enum | `web`, `telegram` |

#### `pastoral_notes`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `member_id` | uuid FK → members | |
| `author_user_id` | uuid FK → users | |
| `body_html` | text | Rich text (sanitised) |
| `source` | enum | `web`, `telegram` |
| `created_at` | timestamptz | |
| `attachments` | text[] | Array of R2 object keys |

#### `follow_up_flags`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `member_id` | uuid FK → members | |
| `group_id` | uuid FK → groups | |
| `consecutive_absences` | int | Count at time of flagging |
| `flagged_at` | timestamptz | |
| `resolved_at` | timestamptz | Nullable |
| `resolved_by` | uuid FK → users | Nullable |
| `resolution_note` | text | Nullable |

#### `audit_logs`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `church_id` | uuid FK → churches | |
| `actor_user_id` | uuid FK → users | |
| `action` | text | e.g. `member.update`, `tag.assign`, `leader.deactivate` |
| `entity_type` | text | e.g. `member`, `session` |
| `entity_id` | uuid | |
| `diff_json` | jsonb | Before/after snapshot |
| `created_at` | timestamptz | Append-only; never updated or deleted |

#### `telegram_links`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `user_id` | uuid FK → users unique | One-to-one |
| `telegram_id` | text unique | Telegram user ID |
| `linked_at` | timestamptz | |
| `revoked_at` | timestamptz | Nullable |

---

## 11. Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| **Frontend** | Next.js 14+ (App Router) | SSR for fast initial load; React Server Components; built-in routing |
| **API** | Next.js Route Handlers | Co-located with frontend; single deployment unit for v1 |
| **Database** | PostgreSQL + Drizzle | Relational model; RLS for tenant isolation; Drizzle for type-safe migrations |
| **Auth** | Auth.js (NextAuth v5) | Session management; credentials + future SSO; JWT carries `church_id` and `role` |
| **File storage** | Cloudflare R2 | S3-compatible; no egress fees; paths prefixed by `church_id` |
| **MCP server** | Node.js service | Separate service; exposes Gembala tools to AI model; handles Telegram webhook |
| **AI model** | Claude via Anthropic API | Tool use / function calling for MCP; natural language → structured actions |
| **Telegram** | Telegram Bot API | Webhook-based message handling; linked to MCP server |
| **DB hosting** | PostgreSQL | Serverless PostgreSQL; connection pooling; branching for staging environments |
| **App hosting** | VPS & Docker | Deploy in VPS in a Docker |
| **MCP hosting** | Fly.io | Always-on process for Telegram webhook; low latency; scales independently |

### Recommended Build Order

1. **Tenant + Auth** — `churches`, `users`, subdomain routing, Auth.js, JWT with `church_id`
2. **Tags + RBAC** — tag management, `user_tag_access`, `member_tags`, RLS policies
3. **Members** — profiles, search/filter, guest flow, file upload to R2
4. **Groups + Attendance** — group management, sessions, attendance recording, absence alerting
5. **Analytics** — dashboard charts, heatmap, absence reports, export
6. **Telegram Linking** — one-time code flow, `telegram_links` table
7. **MCP Server + AI** — tool definitions, Claude integration, Telegram webhook handler
8. **Polish** — i18n (Bahasa Indonesia + English), WCAG audit, performance tuning

---

*Document owner: to be assigned · Next review: before v1 development kickoff*
