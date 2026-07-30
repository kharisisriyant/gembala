import { Injectable, NotFoundException } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import type {
  InviteCreateInput,
  InvitePreviewResponse,
  InviteResponse,
} from "@gembala/shared"
import { createHash, randomBytes } from "node:crypto"
import { and, eq, inArray } from "drizzle-orm"
import { InjectDb, type Db } from "../db/drizzle.module"
import { invites, inviteScopeTags, organizations, tags } from "../db/schema"
import type { AuthContext } from "../authz/auth-context"
import { MailService } from "../mail/mail.service"
import { TagsService } from "../tags/tags.service"

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex")

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

@Injectable()
export class InvitesService {
  constructor(
    @InjectDb() private readonly db: Db,
    private readonly tags: TagsService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  private status(row: {
    acceptedAt: Date | null
    revokedAt: Date | null
    expiresAt: Date
  }): InviteResponse["status"] {
    if (row.revokedAt) return "revoked"
    if (row.acceptedAt) return "accepted"
    if (row.expiresAt < new Date()) return "expired"
    return "pending"
  }

  async list(auth: AuthContext): Promise<InviteResponse[]> {
    const rows = await this.db.select().from(invites).where(eq(invites.orgId, auth.orgId))
    if (rows.length === 0) return []

    const scopeRows = await this.db
      .select({ inviteId: inviteScopeTags.inviteId, name: tags.name })
      .from(inviteScopeTags)
      .innerJoin(tags, eq(tags.id, inviteScopeTags.tagId))
      .where(
        inArray(
          inviteScopeTags.inviteId,
          rows.map((r) => r.id),
        ),
      )
    const scopeByInvite = new Map<string, string[]>()
    for (const r of scopeRows) {
      const list = scopeByInvite.get(r.inviteId) ?? []
      list.push(r.name)
      scopeByInvite.set(r.inviteId, list)
    }

    return rows
      .map((r) => ({
        id: r.id,
        email: r.email,
        roleLabel: r.roleLabel,
        scopeTags: scopeByInvite.get(r.id) ?? [],
        status: this.status(r),
        createdAt: r.createdAt.toISOString(),
        expiresAt: r.expiresAt.toISOString(),
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async create(auth: AuthContext, input: InviteCreateInput): Promise<InviteResponse> {
    const tagIdsByName = await this.tags.resolveTagIds(auth.orgId, input.scopeTags)

    const token = randomBytes(32).toString("hex")
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS)

    const created = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(invites)
        .values({
          orgId: auth.orgId,
          email: input.email.toLowerCase(),
          roleLabel: input.roleLabel,
          tokenHash: sha256(token),
          invitedBy: auth.userId,
          expiresAt,
        })
        .returning()
      await tx.insert(inviteScopeTags).values(
        input.scopeTags.map((name) => ({ inviteId: row.id, tagId: tagIdsByName.get(name)! })),
      )
      return row
    })

    const webOrigin = this.config.getOrThrow<string>("WEB_ORIGIN")
    await this.mail.sendInvite(created.email, auth.orgName, `${webOrigin}/accept-invite?token=${token}`)

    return {
      id: created.id,
      email: created.email,
      roleLabel: created.roleLabel,
      scopeTags: input.scopeTags,
      status: "pending",
      createdAt: created.createdAt.toISOString(),
      expiresAt: created.expiresAt.toISOString(),
    }
  }

  async revoke(auth: AuthContext, id: string): Promise<void> {
    const [row] = await this.db
      .update(invites)
      .set({ revokedAt: new Date() })
      .where(and(eq(invites.id, id), eq(invites.orgId, auth.orgId)))
      .returning({ id: invites.id })
    if (!row) throw new NotFoundException("invite not found")
  }

  // Public: feeds the accept-invite page before the user has an account.
  async preview(token: string): Promise<InvitePreviewResponse> {
    const [row] = await this.db
      .select({
        id: invites.id,
        email: invites.email,
        roleLabel: invites.roleLabel,
        acceptedAt: invites.acceptedAt,
        revokedAt: invites.revokedAt,
        expiresAt: invites.expiresAt,
        orgName: organizations.name,
      })
      .from(invites)
      .innerJoin(organizations, eq(organizations.id, invites.orgId))
      .where(eq(invites.tokenHash, sha256(token)))
    if (!row || row.revokedAt || row.acceptedAt || row.expiresAt < new Date()) {
      throw new NotFoundException("invalid or expired invite")
    }

    const scopeRows = await this.db
      .select({ name: tags.name })
      .from(inviteScopeTags)
      .innerJoin(tags, eq(tags.id, inviteScopeTags.tagId))
      .where(eq(inviteScopeTags.inviteId, row.id))

    return {
      orgName: row.orgName,
      email: row.email,
      roleLabel: row.roleLabel,
      scopeTags: scopeRows.map((r) => r.name),
    }
  }
}
