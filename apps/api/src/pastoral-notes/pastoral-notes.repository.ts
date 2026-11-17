import { Injectable } from "@nestjs/common"
import { and, desc, eq } from "drizzle-orm"
import { InjectDb, type Db, type Tx } from "../db/drizzle.module"
import { members, memberTags, pastoralNotes, tags, users } from "../db/schema"

export type PastoralNoteInsert = typeof pastoralNotes.$inferInsert

export type PastoralNoteRow = {
  id: string
  orgId: string
  memberId: string
  authorId: string | null
  authorName: string | null
  body: string
  source: "web" | "telegram"
  createdAt: Date
  updatedAt: Date
}

const rowShape = {
  id: pastoralNotes.id,
  orgId: pastoralNotes.orgId,
  memberId: pastoralNotes.memberId,
  authorId: pastoralNotes.authorUserId,
  authorName: users.name,
  body: pastoralNotes.body,
  source: pastoralNotes.source,
  createdAt: pastoralNotes.createdAt,
  updatedAt: pastoralNotes.updatedAt,
}

@Injectable()
export class PastoralNotesRepository {
  constructor(@InjectDb() private readonly db: Db) {}

  private baseSelect(tx: Db | Tx) {
    return tx
      .select(rowShape)
      .from(pastoralNotes)
      .leftJoin(users, eq(users.id, pastoralNotes.authorUserId))
  }

  // Newest first. authorUserId narrows to one author's notes (non-admin callers).
  async listForMember(
    orgId: string,
    memberId: string,
    authorUserId?: string,
    tx: Db | Tx = this.db,
  ): Promise<PastoralNoteRow[]> {
    const conds = [eq(pastoralNotes.orgId, orgId), eq(pastoralNotes.memberId, memberId)]
    if (authorUserId) conds.push(eq(pastoralNotes.authorUserId, authorUserId))
    return this.baseSelect(tx)
      .where(and(...conds))
      .orderBy(desc(pastoralNotes.createdAt), desc(pastoralNotes.id))
  }

  async findById(orgId: string, id: string, tx: Db | Tx = this.db): Promise<PastoralNoteRow | undefined> {
    const [row] = await this.baseSelect(tx).where(and(eq(pastoralNotes.orgId, orgId), eq(pastoralNotes.id, id)))
    return row
  }

  async findMember(orgId: string, memberId: string, tx: Db | Tx = this.db): Promise<{ id: string } | undefined> {
    const [row] = await tx
      .select({ id: members.id })
      .from(members)
      .where(and(eq(members.orgId, orgId), eq(members.id, memberId)))
    return row
  }

  async memberTagNames(memberId: string, tx: Db | Tx = this.db): Promise<string[]> {
    const rows = await tx
      .select({ name: tags.name })
      .from(memberTags)
      .innerJoin(tags, eq(tags.id, memberTags.tagId))
      .where(eq(memberTags.memberId, memberId))
    return rows.map((r) => r.name)
  }

  async insert(input: PastoralNoteInsert, tx: Db | Tx = this.db): Promise<{ id: string }> {
    const [row] = await tx.insert(pastoralNotes).values(input).returning({ id: pastoralNotes.id })
    return row
  }

  async updateBody(orgId: string, id: string, body: string, tx: Db | Tx = this.db) {
    await tx
      .update(pastoralNotes)
      .set({ body, updatedAt: new Date() })
      .where(and(eq(pastoralNotes.orgId, orgId), eq(pastoralNotes.id, id)))
  }

  async delete(orgId: string, id: string, tx: Db | Tx = this.db) {
    await tx.delete(pastoralNotes).where(and(eq(pastoralNotes.orgId, orgId), eq(pastoralNotes.id, id)))
  }
}
