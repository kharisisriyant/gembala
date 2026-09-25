import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import type {
  InviteCreateInput,
  InvitePreviewResponse,
  InviteResponse,
} from "@gembala/shared"
import { createHash, randomBytes } from "node:crypto"
import { InjectDb, type Db } from "../db/drizzle.module"
import type { AuthContext } from "../authz/auth-context"
import { MailService } from "../mail/mail.service"
import { TagsService } from "../tags/tags.service"
import { RolesService } from "../roles/roles.service"
import { InvitesRepository } from "./invites.repository"

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex")

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

@Injectable()
export class InvitesService {
  constructor(
    @InjectDb() private readonly db: Db,
    private readonly invites: InvitesRepository,
    private readonly tags: TagsService,
    private readonly roles: RolesService,
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
    const rows = await this.invites.listByOrg(auth.orgId)
    if (rows.length === 0) return []
    const inviteIds = rows.map((r) => r.id)

    const scopeRows = await this.invites.scopeTagNamesByInviteIds(inviteIds)
    const scopeByInvite = new Map<string, string[]>()
    for (const r of scopeRows) {
      const list = scopeByInvite.get(r.inviteId) ?? []
      list.push(r.name)
      scopeByInvite.set(r.inviteId, list)
    }

    const roleRows = await this.invites.rolesByInviteIds(inviteIds)
    const rolesByInvite = new Map<string, { id: string; name: string }[]>()
    for (const r of roleRows) {
      const list = rolesByInvite.get(r.inviteId) ?? []
      list.push({ id: r.id, name: r.name })
      rolesByInvite.set(r.inviteId, list)
    }

    return rows
      .map((r) => ({
        id: r.id,
        email: r.email,
        roles: rolesByInvite.get(r.id) ?? [],
        scopeTags: scopeByInvite.get(r.id) ?? [],
        status: this.status(r),
        createdAt: r.createdAt.toISOString(),
        expiresAt: r.expiresAt.toISOString(),
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async create(auth: AuthContext, input: InviteCreateInput): Promise<InviteResponse> {
    const tagIdsByName = await this.tags.resolveTagIds(auth.orgId, input.scopeTags)

    const grantable = await this.roles.assignableRoles(auth)
    const grantableIds = new Set(grantable.map((r) => r.id))
    if (!input.roleIds.every((id) => grantableIds.has(id))) {
      throw new ForbiddenException("you can't invite someone with a role you don't have access to grant")
    }
    const invitedRoles = grantable.filter((r) => input.roleIds.includes(r.id))

    const token = randomBytes(32).toString("hex")
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS)

    const created = await this.db.transaction(async (tx) => {
      const row = await this.invites.insert(
        {
          orgId: auth.orgId,
          email: input.email.toLowerCase(),
          tokenHash: sha256(token),
          invitedBy: auth.userId,
          expiresAt,
        },
        tx,
      )
      await this.invites.insertScopeTags(
        row.id,
        input.scopeTags.map((name) => tagIdsByName.get(name)!),
        tx,
      )
      await this.invites.insertRoles(row.id, input.roleIds, tx)
      return row
    })

    const webOrigin = this.config.getOrThrow<string>("WEB_ORIGIN")
    await this.mail.sendInvite(created.email, auth.orgName, `${webOrigin}/accept-invite?token=${token}`)

    return {
      id: created.id,
      email: created.email,
      roles: invitedRoles.map((r) => ({ id: r.id, name: r.name })),
      scopeTags: input.scopeTags,
      status: "pending",
      createdAt: created.createdAt.toISOString(),
      expiresAt: created.expiresAt.toISOString(),
    }
  }

  async revoke(auth: AuthContext, id: string): Promise<void> {
    const row = await this.invites.revoke(auth.orgId, id)
    if (!row) throw new NotFoundException("invite not found")
  }

  // Public: feeds the accept-invite page before the user has an account.
  async preview(token: string): Promise<InvitePreviewResponse> {
    const row = await this.invites.findByTokenHashWithOrg(sha256(token))
    if (!row || row.revokedAt || row.acceptedAt || row.expiresAt < new Date()) {
      throw new NotFoundException("invalid or expired invite")
    }

    const scopeRows = await this.invites.scopeTagNamesByInviteId(row.id)
    const roleRows = await this.invites.rolesByInviteId(row.id)

    return {
      orgName: row.orgName,
      email: row.email,
      roles: roleRows,
      scopeTags: scopeRows.map((r) => r.name),
    }
  }
}
