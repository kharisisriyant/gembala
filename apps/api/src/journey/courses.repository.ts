import { Injectable } from "@nestjs/common"
import { and, asc, count, eq } from "drizzle-orm"
import { InjectDb, type Db, type Tx } from "../db/drizzle.module"
import { courseEnrollments, courses } from "../db/schema"

export type CourseInsert = typeof courses.$inferInsert
export type CoursePatch = Partial<Pick<CourseInsert, "name" | "kind">>

export type CourseRow = {
  id: string
  name: string
  kind: (typeof courses.$inferSelect)["kind"]
  enrollmentCount: number
}

@Injectable()
export class CoursesRepository {
  constructor(@InjectDb() private readonly db: Db) {}

  private baseSelect(tx: Db | Tx) {
    return tx
      .select({
        id: courses.id,
        name: courses.name,
        kind: courses.kind,
        enrollmentCount: count(courseEnrollments.id),
      })
      .from(courses)
      .leftJoin(courseEnrollments, eq(courseEnrollments.courseId, courses.id))
      .groupBy(courses.id)
  }

  async list(orgId: string, tx: Db | Tx = this.db): Promise<CourseRow[]> {
    return this.baseSelect(tx).where(eq(courses.orgId, orgId)).orderBy(asc(courses.name))
  }

  async findById(orgId: string, id: string, tx: Db | Tx = this.db): Promise<CourseRow | undefined> {
    const [row] = await this.baseSelect(tx).where(and(eq(courses.orgId, orgId), eq(courses.id, id)))
    return row
  }

  async findByName(orgId: string, name: string, tx: Db | Tx = this.db): Promise<{ id: string } | undefined> {
    const [row] = await tx
      .select({ id: courses.id })
      .from(courses)
      .where(and(eq(courses.orgId, orgId), eq(courses.name, name)))
    return row
  }

  async insert(input: CourseInsert, tx: Db | Tx = this.db) {
    const [row] = await tx.insert(courses).values(input).returning({ id: courses.id })
    return row
  }

  async update(orgId: string, id: string, patch: CoursePatch, tx: Db | Tx = this.db) {
    if (Object.values(patch).every((v) => v === undefined)) return
    await tx
      .update(courses)
      .set(patch)
      .where(and(eq(courses.orgId, orgId), eq(courses.id, id)))
  }

  async delete(orgId: string, id: string, tx: Db | Tx = this.db) {
    await tx.delete(courses).where(and(eq(courses.orgId, orgId), eq(courses.id, id)))
  }
}
