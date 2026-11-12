import { Injectable, Logger } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { addDays, todayInZone, type DigestPreferencesInput, type DigestPreviewResponse } from "@gembala/shared"
import { AttentionService } from "../attention/attention.service"
import type { AuthContext } from "../authz/auth-context"
import { AuthContextService } from "../authz/auth-context.service"
import { CareRequestsService } from "../care-requests/care-requests.service"
import { MailService } from "../mail/mail.service"
import { TelegramService } from "../telegram/telegram.service"
import { DigestRepository, type DigestRecipient } from "./digest.repository"
import { isEmptyDigest, renderDigest, type DigestData } from "./digest.render"

// Monday of the week containing `day` (YYYY-MM-DD).
export function weekStartOf(day: string): string {
  const dow = new Date(`${day}T00:00:00Z`).getUTCDay() // 0 = Sunday
  return addDays(day, -((dow + 6) % 7))
}

@Injectable()
export class DigestService {
  private readonly logger = new Logger("Digest")

  constructor(
    private readonly repo: DigestRepository,
    private readonly attention: AttentionService,
    private readonly care: CareRequestsService,
    private readonly authContext: AuthContextService,
    private readonly telegram: TelegramService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  private get webOrigin(): string {
    return this.config.getOrThrow<string>("WEB_ORIGIN")
  }

  async getPreferences(userId: string): Promise<DigestPreferencesInput> {
    const row = await this.repo.findPreferences(userId)
    return { enabled: row?.enabled ?? true, locale: row?.locale === "en" ? "en" : "id" }
  }

  async savePreferences(userId: string, prefs: DigestPreferencesInput): Promise<DigestPreferencesInput> {
    await this.repo.upsertPreferences(userId, prefs)
    return prefs
  }

  // Admins get an org-wide summary; everyone else gets their own lists.
  private async build(auth: AuthContext, now: Date): Promise<DigestData> {
    const today = todayInZone(now)
    const items = await this.attention.forUser(auth, today)
    const base = { userName: auth.userName, weekStart: weekStartOf(today), items }
    if (!auth.isSystemAdmin) return { kind: "personal", ...base }
    return { kind: "admin", ...base, summary: await this.care.openSummary(auth) }
  }

  // What this week's message would look like for the caller. Sends nothing.
  async preview(auth: AuthContext, now: Date = new Date()): Promise<DigestPreviewResponse> {
    const [data, prefs] = await Promise.all([this.build(auth, now), this.getPreferences(auth.userId)])
    const rendered = renderDigest(data, prefs.locale, this.webOrigin)
    return { kind: data.kind, empty: isEmptyDigest(data), subject: rendered.subject, text: rendered.text }
  }

  // Idempotent per (user, week): safe to call repeatedly (cron retry, restart,
  // second instance). Returns how many messages went out in this run.
  async runWeekly(now: Date = new Date()): Promise<number> {
    const weekStart = weekStartOf(todayInZone(now))
    let sent = 0
    for (const recipient of await this.repo.recipients()) {
      if (!recipient.enabled) continue
      try {
        if (await this.deliverTo(recipient, weekStart, now)) sent++
      } catch (err) {
        // One bad recipient never stops the run; log the id, never the content.
        this.logger.error(`digest for user ${recipient.userId} failed: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
    this.logger.log(`weekly digest ${weekStart}: ${sent} sent`)
    return sent
  }

  private async deliverTo(r: DigestRecipient, weekStart: string, now: Date): Promise<boolean> {
    const auth = await this.authContext.load(r.userId)
    if (!auth) return false
    const data = await this.build(auth, now)
    if (isEmptyDigest(data)) return false // nothing to say: no message, no log row
    if (!(await this.repo.claim(r.userId, weekStart))) return false

    const rendered = renderDigest(data, r.locale, this.webOrigin)
    try {
      if (await this.telegram.sendToUser(r.userId, rendered.text)) {
        await this.repo.markSent(r.userId, weekStart, "telegram")
      } else {
        await this.mail.sendWeeklyDigest(r.email, rendered)
        await this.repo.markSent(r.userId, weekStart, "email")
      }
      return true
    } catch (err) {
      await this.repo.markFailed(r.userId, weekStart, err instanceof Error ? err.message : String(err))
      throw err
    }
  }
}
