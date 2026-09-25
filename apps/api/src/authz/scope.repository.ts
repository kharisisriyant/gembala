import { Injectable } from "@nestjs/common"
import { eq } from "drizzle-orm"
import { InjectDb, type Db, type Tx } from "../db/drizzle.module"
import { tags } from "../db/schema"
import type { TagRow } from "./scope.service"

@Injectable()
export class ScopeRepository {
  constructor(@InjectDb() private readonly db: Db) {}

  async orgTags(orgId: string, tx: Db | Tx = this.db): Promise<TagRow[]> {
    return tx
      .select({
        id: tags.id,
        name: tags.name,
        parentId: tags.parentId,
        description: tags.description,
      })
      .from(tags)
      .where(eq(tags.orgId, orgId))
  }
}
