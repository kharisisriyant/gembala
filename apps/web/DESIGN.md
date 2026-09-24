# Gembala — Design System

> Gembala (Indonesian: "shepherd") is a church management platform. This document defines how Gembala looks, feels and reads. It is the source of truth for designers, engineers and AI coding tools. When a rule here conflicts with a shadcn default, this document wins.

Stack: **Tailwind CSS v4 + shadcn/ui**, theme tokens in `src/index.css` (CSS variables mapped via `@theme inline`). Always use tokens (`bg-primary`, `text-muted-foreground`, `rounded-lg`); never hard-code colors, radii or shadows.

Items marked **[Proposed]** are recommendations that are not yet in `index.css`. See §15.

---

## 1. Design principles

1. **Care over control.** Gembala exists to help people look after people. The UI should feel warm and pastoral, not like an ERP. Prefer friendly language and generous space over density for its own sake.
2. **Calm, not loud.** Green is our brand, but it is used with intent: primary actions, active states and highlights. Most of the screen is white (or near-black in dark mode) and neutral.
3. **Trustworthy with sensitive data.** Member records, pastoral notes and offerings are personal. Make privacy visible (who can see this?) and destructive actions deliberate.
4. **Usable by everyone in the congregation.** Admins may be volunteers, older, on a low-end Android phone, on slow connections. Default to readable sizes, big tap targets and forgiving flows.
5. **Indonesian first.** Copy, names, dates, currency and cultural conventions follow Indonesian usage by default (§12).

---

## 2. Audiences and contexts

| Audience | Typical device | Needs | Density |
|---|---|---|---|
| Church admin / secretary | Laptop | Member data, reports, finance | Medium–high |
| Pastor / elder | Phone + laptop | People overview, pastoral notes, schedules | Medium |
| Ministry / small-group (komsel) leader | Phone | Attendance, member list for their group | Low–medium |
| Volunteer at check-in | Tablet / phone | Fast check-in at the door | Very low, big targets |
| Congregant (jemaat) | Phone | Profile, schedule, giving history, announcements | Low |

Admin surfaces (`/admin/*`) may use the compact density rules in §5. Everything congregant-facing uses comfortable density.

---

## 3. Color

All values are OKLCH. The brand accent hue sits around **147–150** (green); neutrals (background, card, border, muted) carry a faint cool blue tint around hue **238–243** instead of pure gray.

### 3.1 Light theme tokens (current)

| Token | Value | Role |
|---|---|---|
| `background` | `oklch(0.9813 0.0100 238.51)` | Page background — very light cool blue-gray, not pure white |
| `card` / `popover` | `oklch(1 0 0)` | Surfaces — pure white, sits slightly lighter than the page |
| `foreground` / `card-foreground` / `popover-foreground` | `oklch(0.1807 0.0207 239.84)` | Default text — near-black with a cool blue tint |
| `primary` | `oklch(0.6236 0.1833 147.41)` | Brand green: primary buttons, active nav, key highlights |
| `primary-foreground` | `oklch(0.9813 0.0100 238.51)` | Text on primary (near-white — see contrast issue §15.1) |
| `secondary` / `muted` | `oklch(0.9396 0.0204 243.42)` | Neutral fills: secondary buttons, table headers, disabled fields, skeletons |
| `secondary-foreground` | `oklch(0.2791 0.0203 242.61)` | Text on secondary |
| `muted-foreground` | `oklch(0.4501 0.0191 239.49)` | Secondary text, captions, placeholders |
| `accent` | `oklch(0.6999 0.1796 150.11)` | Brighter green: hover rows, hovered menu items, subtle highlight |
| `accent-foreground` | `oklch(0.9813 0.0100 238.51)` | Text on accent (near-white — see contrast issue §15.1) |
| `destructive` | `oklch(0.6207 0.2306 24.92)` | Delete, errors, irreversible actions (red-orange) |
| `destructive-foreground` | `oklch(0.9813 0.0100 238.51)` | Text on destructive (near-white — see contrast issue §15.1) |
| `border` / `input` | `oklch(0.8999 0.0196 240.75)` | Dividers, card borders, input borders |
| `ring` | `oklch(0.6236 0.1833 147.41)` | Focus ring — matches primary green |
| `chart-1…5` | green, blue, orange, purple, red (hues 147/250/46/300/20) | Categorical palette — see §3.5 |
| `sidebar-*` | Mirrors main tokens (green primary/accent) | Sidebar navigation |

### 3.2 Dark theme tokens (current)

Background is a near-black cool blue (`oklch(0.1289 0.0199 238.91)`), cards are a lighter near-black blue (`oklch(0.1807 0.0207 239.84)`), text is near-white with the same cool tint (`oklch(0.9513 0.0101 238.51)`). Primary and accent become a brighter green (`oklch(0.70 0.18 149)` / `oklch(0.72 0.18 150)`) with dark, near-black text on top — good contrast, the inverse (and correct) pairing of the light theme's primary/accent text (§15.1).

**Known inconsistency (kept as-is):** the dark-mode sidebar tokens (`sidebar-primary`, `sidebar-accent`, `sidebar-ring`, etc.) are blue/neutral-gray, not green — they don't match the green `sidebar-*` tokens used in light mode or the green `primary`/`accent` used elsewhere in dark mode. This was flagged when the theme was installed and intentionally left as-is; revisit if the dark-mode sidebar ever looks out of place next to the rest of the dark UI.

### 3.3 Semantic colors [Proposed]

The theme currently has only `destructive`. Church data needs more status colors (attendance, member status, payment state). Because our brand color is green, **success must not be confused with "brand"**. Add:

```css
:root {
  --success: oklch(0.55 0.15 150);          /* darker, cooler green than primary */
  --success-foreground: oklch(1 0 0);
  --success-soft: oklch(0.96 0.04 150);     /* badge/alert background */
  --warning: oklch(0.75 0.16 75);           /* amber */
  --warning-foreground: oklch(0.30 0.07 60);
  --warning-soft: oklch(0.97 0.05 85);
  --info: oklch(0.60 0.13 240);             /* calm blue */
  --info-foreground: oklch(1 0 0);
  --info-soft: oklch(0.96 0.03 240);
}
```

Map them in `@theme inline` as `--color-success`, etc.

### 3.4 Color usage rules

- **One primary action per view.** Only one `bg-primary` button in a given card, dialog or page header.
- Green is for **action and "you are here"** (active nav, selected tab, primary button, links). Don't use it for decoration or large background fills.
- Large surfaces are `background`, `card` or `muted`. Never fill a full section with `primary` or `secondary`, except the marketing site hero.
- Hover on neutral things (rows, menu items, list items) → `bg-accent`.
- Text is `foreground` by default, `muted-foreground` for supporting text. Never use `primary` for body text.
- Status is never conveyed by color alone. Pair with an icon or a label (§13).

### 3.5 Charts

- `chart-1…5` is now a **categorical** palette (green, blue, orange, purple, red — distinct hues, not a single-hue ramp). Use it for **categorical** data: ministries, funds, campuses, discrete groups.
- There is currently **no sequential ramp** for single-metric ordered data (attendance over weeks, giving by month, age brackets). **[Proposed]** add a green sequential ramp (`chart-seq-1…5`, same hue as `primary` at increasing lightness) for that use case instead of reusing the categorical palette.
- Label series directly where possible instead of relying on a legend.

---

## 4. Typography

| Family | Token | Use |
|---|---|---|
| Space Grotesk | `font-sans` | All UI text |
| PT Serif | `font-serif` | **Scripture verses, sermon titles, devotional content only** — gives spiritual content its own voice |
| Space Mono | `font-mono` | IDs, codes, technical values. Not for money (use `tabular-nums` instead) |

All three are loaded from Google Fonts via `@import` at the top of `index.css`.

### 4.1 Type scale

| Level | Tailwind | Weight | Use |
|---|---|---|---|
| Display | `text-4xl` / `md:text-5xl` | 700 | Marketing / landing only |
| H1 | `text-3xl` | 700 | Page title (one per page) |
| H2 | `text-2xl` | 600 | Section title |
| H3 | `text-lg` | 600 | Card title, dialog title |
| Body | `text-base` (16px) | 400 | Default. Minimum for congregant-facing text |
| Body small | `text-sm` (14px) | 400 | Admin tables, secondary info |
| Caption / label | `text-xs` (12px) | 500 | Metadata, helper text, badge labels |

Rules:
- Use at most **two weights** per component (e.g. 400 + 600).
- Numbers in tables, amounts and statistics use `tabular-nums`.
- Scripture: `font-serif text-lg italic` for the verse, `text-sm text-muted-foreground not-italic` for the reference (e.g. *Mazmur 23:1*).

### 4.2 Letter spacing

`--tracking-normal: 0em` — default tracking, no adjustment needed for body text or tables.

---

## 5. Spacing and layout

- Base unit: `--spacing: 0.25rem` (4px). Use Tailwind's scale; avoid arbitrary values.
- Spacing rhythm: `gap-2` (8px) inside a control group · `gap-4` (16px) between fields · `gap-6` (24px) between cards · `gap-10`+ between page sections.
- Card padding: `p-6` comfortable, `p-4` compact (admin tables, dashboards).
- Page container: `max-w-6xl mx-auto px-4 md:px-6`. Forms: `max-w-2xl`. Reading content (announcements, devotionals): `max-w-prose`.
- Breakpoints: Tailwind defaults. **Design mobile first** — most congregants and small-group leaders are on phones.
- Admin layout: collapsible sidebar (shadcn `Sidebar`) + top bar with church/campus switcher and user menu. On mobile the sidebar becomes a sheet.

### Density modes

| | Comfortable (default) | Compact (admin tables) |
|---|---|---|
| Control height | `h-10` | `h-9` |
| Table row | `h-14` | `h-11` |
| Card padding | `p-6` | `p-4` |
| Body text | `text-base` | `text-sm` |

---

## 6. Shape

The theme uses a standard, moderate radius: `--radius: 0.75rem` (12px) in light mode, `0.625rem` (10px) in dark mode. This is no longer the "soft pill" signature look of the earlier theme — corners are rounded but conventional, closer to typical shadcn defaults.

Derived scale (light): `radius-sm` 8px · `radius-md` 10px · `radius-lg` 12px · `radius-xl` 16px.
Derived scale (dark): `radius-sm` 6px · `radius-md` 8px · `radius-lg` 10px · `radius-xl` 14px.
**Known quirk:** `--radius` itself differs between light and dark mode (12px vs 10px), so the whole scale shifts slightly when toggling themes. See §15.3.

Usage:
- Buttons, inputs, selects, search bars → `rounded-md` or the component default (no longer pill-shaped by default; use `rounded-full` only where a pill is intentional, e.g. badges/chips).
- Cards, dialogs, sheets → `rounded-lg` or `rounded-xl`.
- Avatars → `rounded-full`.
- **Tables** → the wrapper card is rounded; rows and cells have no radius.
- **Small nested items** (dropdown items, calendar days, list rows inside a card) → `rounded-sm` or `rounded-md`.
- Nested radius rule: inner radius = outer radius − padding.

---

## 7. Elevation

Shadows are tight and subtle (3px blur, low opacity, near-black tint) — a crisp hairline of elevation rather than a soft glow.

| Token | Use |
|---|---|
| `shadow-xs` | Inputs, subtle lift |
| `shadow-sm` | Cards at rest (default) |
| `shadow-md` | Hovered interactive cards, popovers, dropdowns |
| `shadow-lg` | Sheets, sticky headers when scrolled |
| `shadow-xl` | Dialogs |
| `shadow-2xl` | Rarely — highest-elevation overlays only |

Rules: cards use **either** a visible border **or** a shadow, not both at full strength. Default is shadow + `border-border` (the border is very light so it only adds definition). Don't stack elevated cards inside elevated cards; inner groups use `bg-muted` instead.

---

## 8. Components (shadcn)

### Buttons
| Variant | Use |
|---|---|
| `default` (primary) | The main action: *Simpan*, *Tambah Jemaat*, *Check-in* |
| `secondary` | Second action next to primary |
| `outline` | Neutral actions: *Filter*, *Ekspor* |
| `ghost` | Toolbar and icon buttons, table row actions |
| `destructive` | Delete / remove, only inside a confirmation dialog or a clearly separated danger zone |
| `link` | Inline navigation |

- Labels: verb-first, sentence case, Indonesian (*Tambah jemaat*, not *JEMAAT BARU*).
- Icon + label for primary actions; icon-only buttons must have `aria-label` and a tooltip.
- Loading state: keep width, show spinner, disable, keep label (*Menyimpan…*).
- Minimum tap target 44×44px on touch surfaces.

### Inputs and forms
- Label always visible above the field (no placeholder-as-label).
- Helper text below in `text-xs text-muted-foreground`; error text in `text-destructive` with an icon, and `aria-invalid` on the field.
- Group long forms (member profile) into cards with H3 titles: *Data pribadi*, *Keluarga*, *Kerohanian* (baptism, sidi, etc.), *Kontak*.
- Only require what is truly required. **Name fields: a single "Nama lengkap" field**, never force first/last name — many Indonesians have a single name.
- Phone input defaults to +62 and accepts `08…` format.
- Date pickers show Indonesian month and day names.

### Cards
- Header (title + optional description + optional action on the right), body, optional footer.
- Stat cards: label (`text-sm text-muted-foreground`), value (`text-3xl font-semibold tabular-nums`), trend (with arrow icon + text, not color only).

### Badges / status
| Meaning | Style |
|---|---|
| Active / present / paid | `success-soft` bg + `success` text + icon |
| Pending / needs follow-up | `warning-soft` bg + warning text |
| Info / new | `info-soft` bg |
| Inactive / archived / moved | `bg-muted text-muted-foreground` |
| Deceased (*Meninggal*) | `bg-muted text-muted-foreground` with a respectful label. **Never red.** |
| Error / failed | `destructive` |

### Tables (admin)
- Sticky header on `bg-muted`, `text-xs font-medium uppercase tracking-wide text-muted-foreground`.
- Row hover `bg-accent`; selected row `bg-accent` + checkbox.
- Money and numbers right-aligned, `tabular-nums`.
- Row actions in a `ghost` icon button → dropdown menu at the end of the row.
- On mobile, tables collapse into stacked cards (name + 2–3 key fields + chevron).

### Navigation
- Sidebar groups (example): *Beranda* · *Jemaat* (members, families) · *Komsel & Pelayanan* · *Ibadah & Acara* · *Kehadiran* · *Keuangan* · *Pengumuman* · *Pengaturan*.
- Active item: `bg-sidebar-accent text-sidebar-accent-foreground font-medium` + primary-colored icon.
- Congregant app on mobile: bottom tab bar with max 5 items.

### Dialogs, sheets, toasts
- Confirmation for destructive actions states the consequence and names the thing: *Hapus data keluarga Siregar? Tindakan ini tidak bisa dibatalkan.* For high-risk deletions, require typing the name.
- Prefer **sheets** for create/edit forms on mobile, **dialogs** on desktop.
- Toasts (sonner) for confirmations of completed actions; include *Urungkan* (undo) where possible instead of asking for confirmation up front.

### Empty, loading and error states
- Empty: simple lucide icon in a `bg-accent` circle, one-line title, one sentence, one primary action. Example: *Belum ada komsel — Buat komsel pertama untuk mulai mencatat kehadiran.*
- Loading: skeletons shaped like the content (`bg-muted animate-pulse`), not spinners, for page content.
- Error: plain-language explanation + retry. Never show raw error codes to congregants.

---

## 9. Domain patterns

**Member profile.** Header with avatar (initials fallback on `bg-accent text-accent-foreground`), name, status badge, family link and quick actions (*Hubungi*, *Edit*). Tabs below: *Profil*, *Keluarga*, *Pelayanan*, *Kehadiran*, *Persembahan*, *Catatan pastoral*.

**Pastoral notes (confidential).** Always show a lock icon and a visibility line (*Hanya terlihat oleh Gembala & Majelis*). Distinct surface: `bg-muted` card with a left border in `warning`. Never show pastoral notes in lists, exports or search previews.

**Family / household.** Shown as a group of avatar chips with relationship labels (*Kepala keluarga*, *Istri*, *Anak*).

**Attendance / check-in.** Built for speed on a tablet at the door: huge search input, large result rows (min `h-16`), one tap to check in, immediate visual confirmation (success color + check icon + name), undo available for 5 seconds. Works with one hand.

**Offerings / finance (*Persembahan*).** Amounts in Rupiah, right-aligned, `tabular-nums`. Clear fund labels (*Persepuluhan*, *Persembahan umum*, *Diakonia*, *Pembangunan*). Finance screens are admin-only and visually calmer: no celebratory colors on giving amounts, no ranking of individual givers.

**Schedules and rotas (*Jadwal pelayanan*).** Calendar/week view with ministry color chips (categorical palette) + text label. Unfilled slots use a dashed border and `warning` label *Belum terisi*.

**Announcements.** Reading layout (`max-w-prose`), cover image optional, scripture blocks in `font-serif`.

---

## 10. Iconography and imagery

- Icons: **lucide-react** (shadcn default), stroke 2 (1.75 for larger decorative icons). Sizes: `size-4` inline/in buttons, `size-5` nav, `size-6`+ empty states.
- Avoid overly religious clip-art in the product UI. Keep symbolism subtle: a shepherd's staff or sheep motif for the logo/brand moments, not sprinkled across screens.
- Photos: real congregation photos, warm and natural light. Always provide an initials avatar fallback.
- Illustrations (empty states, onboarding): flat, soft shapes, using the brand greens + neutrals.

---

## 11. Motion

- Durations: 150ms (hover, press), 200ms (menus, popovers), 300ms (sheets, dialogs).
- Easing: `ease-out` for entering, `ease-in` for leaving.
- Animate opacity and transform only. No bouncing, no confetti in admin tools.
- Respect `prefers-reduced-motion` (use `motion-safe:` / `motion-reduce:` variants).

---

## 12. Content and localization

- **Default language: Bahasa Indonesia**, with English as a secondary locale. Keep strings in i18n files; never hard-code copy.
- Tone: warm, polite, simple. Address the user with *Anda* (formal) in the admin app. **[Open question]** congregant app may use *kamu*.
- Church terms follow the church's configuration where possible (*komsel* vs *KTB* vs *cell group*, *jemaat*, *majelis*, *pendeta*). Don't hard-code denomination-specific terms.
- Dates: `Minggu, 27 September 2026`; short: `27 Sep 2026`; time: 24-hour `09.00` (Indonesian uses a period). Week starts on **Monday** in calendars, but Sunday (*Minggu*) is visually highlighted as the service day.
- Currency: `Rp 1.500.000` (dot thousand separators, no decimals). Use `Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })`.
- Phone: display as `0812-3456-7890`, store as E.164 (`+6281234567890`).

---

## 13. Accessibility

- Text contrast: **WCAG AA** minimum (4.5:1 normal text, 3:1 large text and UI boundaries). Several current token pairs fail. See §15.1.
- Focus: visible `ring` on all interactive elements (`focus-visible:ring-[3px] ring-ring/50`, shadcn default). Never remove outlines without a replacement.
- Tap targets ≥ 44×44px on touch surfaces.
- Don't use color alone for status, charts or validation.
- Body text never smaller than 16px on congregant-facing screens; allow browser zoom to 200% without breaking layouts.
- Every form field has a `<Label>`; every icon-only button has an `aria-label`.

---

## 14. Do's and don'ts

| Do | Don't |
|---|---|
| One green primary button per view | Several competing green buttons |
| White/neutral surfaces with green accents | Full-bleed green sections in the app |
| `Nama lengkap` single field | Required "first name / last name" |
| `Rp 250.000`, right-aligned, tabular | `IDR 250000.00`, left-aligned |
| Status badge with icon + label | A colored dot with no label |
| Gray, respectful badge for deceased members | Red or "error" styling for deceased |
| Lock icon + visibility line on pastoral notes | Pastoral notes in list previews or exports |
| Serif only for scripture and sermon content | Serif for UI headings |
| Skeleton loaders shaped like content | Full-page spinners |
| Tokens (`bg-accent`, `rounded-xl`) | Hex codes, `rounded-[12px]`, custom shadows |

---

## 15. Known issues in the current theme and proposed fixes

Values below are approximate contrast estimates based on OKLCH lightness; verify with a contrast checker before shipping.

### 15.1 Contrast
- **Light mode:** `primary-foreground`, `accent-foreground` and `destructive-foreground` are all the same near-white token (`oklch(0.98 0.01 238.5)`) sitting on mid-lightness colors (`primary` L 0.62, `accent` L 0.70, `destructive` L 0.62). Near-white text on a mid-lightness saturated color is a likely AA fail for button/badge labels — the same class of problem the previous theme had, just not yet fixed here. Options:
  - **A (recommended):** darken each `-foreground` token to a near-black shade (mirroring what dark mode already does correctly for `primary-foreground`/`accent-foreground`).
  - **B:** darken `primary`/`accent`/`destructive` themselves and keep white text.
- **Dark mode:** `primary-foreground` and `accent-foreground` are already dark-on-bright (correct pairing, good contrast). `destructive-foreground` is still the same near-white token on `destructive` (L 0.62) — same fail as light mode, needs the same fix.

### 15.2 Letter spacing
Resolved — `--tracking-normal: 0em`.

### 15.3 Radius differs between light and dark mode
`--radius` is `0.75rem` (12px) in light mode but `0.625rem` (10px) in dark mode, so the whole radius scale (`radius-sm/md/lg/xl`) shifts slightly when toggling themes. Cards, buttons and dialogs will read as marginally sharper in dark mode. Low-impact, but worth aligning if it's ever noticeable side-by-side (e.g. keep one `--radius` value shared across both themes).

### 15.4 Dark-mode sidebar hue mismatch
See §3.2 — dark-mode `sidebar-primary`/`sidebar-accent`/`sidebar-ring` are blue/neutral-gray instead of the green used everywhere else (including the light-mode sidebar). Kept as-is per a deliberate call when the theme was installed; revisit if it reads as inconsistent in practice.

### 15.5 Missing tokens
- No `success`, `warning`, `info` tokens (+ `-soft`, `-foreground`) — needed for status badges (attendance, payment state, member status). See §3.3.
- No sequential chart ramp for ordered single-metric data — `chart-1…5` is now categorical, not sequential. See §3.5.

---

## 16. Open questions

1. Primary/accent/destructive contrast in light mode (§15.1): option A (dark text, matching what dark mode already does) or B (darken the backgrounds and keep white text)?
2. Congregant app tone: *Anda* or *kamu*?
3. Multi-church / multi-campus: should each church be able to set its own accent color or logo on top of the Gembala base (white-labelling)? If yes, only `primary`, `ring` and `sidebar-primary` should be overridable.
4. Is dark mode needed at launch, or can it wait until the light theme is stable?
5. Should the marketing site share this system exactly, or allow bolder use of green?
