import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common"
import { permissionKey, type PastoralNoteResponse, type PastoralNoteSource } from "@gembala/shared"
import { ScopeService } from "../authz/scope.service"
import type { AuthContext } from "../authz/auth-context"
import { PastoralNotesRepository, type PastoralNoteRow } from "./pastoral-notes.repository"

// Private pastoral notes. Privacy rules (all enforced here, not in the controller):
// - the member must be in the caller's org and tag scope, else 404;
// - a note is visible only to its author and org admins (isSystemAdmin);
//   anyone else gets an empty list / 404, never a 403 that reveals the note;
// - edit: author only; delete: author or org admin.
@Injectable()
export class PastoralNotesService {
  constructor(
    private readonly notes: PastoralNotesRepository,
    private readonly scope: ScopeService,
  ) {}

  private canRead(auth: AuthContext, row: PastoralNoteRow): boolean {
    return auth.isSystemAdmin || (row.authorId !== null && row.authorId === auth.userId)
  }

  private toResponse(auth: AuthContext, r: PastoralNoteRow): PastoralNoteResponse {
    const isAuthor = r.authorId !== null && r.authorId === auth.userId
    return {
      id: r.id,
      memberId: r.memberId,
      body: r.body,
      source: r.source,
      author: r.authorId && r.authorName ? { id: r.authorId, name: r.authorName } : null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      canEdit: isAuthor,
      canDelete: isAuthor || auth.isSystemAdmin,
    }
  }

  // HTTP routes are already guarded; this repeats the check for non-HTTP callers
  // (the Telegram bot), which build an AuthContext without going through the guard.
  private assertPermission(auth: AuthContext, action: "read" | "update"): void {
    if (!auth.isSystemAdmin && !auth.permissions.has(permissionKey("members", action))) {
      throw new ForbiddenException(`missing permission: ${permissionKey("members", action)}`)
    }
  }

  // The HTTP DTO already validates this; repeated for non-HTTP callers.
  private cleanBody(body: string): string {
    const trimmed = body.trim()
    if (!trimmed) throw new BadRequestException("body is required")
    if (trimmed.length > PastoralNotesService.MAX_BODY) throw new BadRequestException(`body is longer than ${PastoralNotesService.MAX_BODY} characters`)
    return trimmed
  }

  static readonly MAX_BODY = 5000

  private async assertMemberVisible(auth: AuthContext, memberId: string): Promise<void> {
    const member = await this.notes.findMember(auth.orgId, memberId)
    if (!member) throw new NotFoundException("member not found")
    const scope = await this.scope.expandedScope(auth)
    if (!this.scope.memberVisible(scope, await this.notes.memberTagNames(memberId))) {
      throw new NotFoundException("member not found")
    }
  }

  // Missing, someone else's (non-admin) and out-of-scope all read as 404.
  private async visibleNote(auth: AuthContext, id: string): Promise<PastoralNoteRow> {
    const row = await this.notes.findById(auth.orgId, id)
    if (!row || row.orgId !== auth.orgId || !this.canRead(auth, row)) throw new NotFoundException("note not found")
    const scope = await this.scope.expandedScope(auth)
    if (!this.scope.memberVisible(scope, await this.notes.memberTagNames(row.memberId))) {
      throw new NotFoundException("note not found")
    }
    return row
  }

  async list(auth: AuthContext, memberId: string): Promise<PastoralNoteResponse[]> {
    this.assertPermission(auth, "read")
    await this.assertMemberVisible(auth, memberId)
    const rows = await this.notes.listForMember(auth.orgId, memberId, auth.isSystemAdmin ? undefined : auth.userId)
    return rows.filter((r) => this.canRead(auth, r)).map((r) => this.toResponse(auth, r))
  }

  async get(auth: AuthContext, id: string): Promise<PastoralNoteResponse> {
    this.assertPermission(auth, "read")
    return this.toResponse(auth, await this.visibleNote(auth, id))
  }

  // Entry point for both the web (source "web") and the Telegram bot (source "telegram").
  async create(
    auth: AuthContext,
    memberId: string,
    body: string,
    source: PastoralNoteSource,
  ): Promise<PastoralNoteResponse> {
    this.assertPermission(auth, "update")
    const trimmed = this.cleanBody(body)
    await this.assertMemberVisible(auth, memberId)
    const { id } = await this.notes.insert({
      orgId: auth.orgId,
      memberId,
      authorUserId: auth.userId,
      body: trimmed,
      source,
    })
    return this.get(auth, id)
  }

  async update(auth: AuthContext, id: string, body: string): Promise<PastoralNoteResponse> {
    this.assertPermission(auth, "update")
    const row = await this.visibleNote(auth, id)
    // Admins can read and delete, but never rewrite someone else's words.
    if (row.authorId !== auth.userId) throw new ForbiddenException("only the author can edit a note")
    await this.notes.updateBody(auth.orgId, id, this.cleanBody(body))
    return this.get(auth, id)
  }

  async remove(auth: AuthContext, id: string): Promise<void> {
    this.assertPermission(auth, "update")
    await this.visibleNote(auth, id)
    await this.notes.delete(auth.orgId, id)
  }
}
