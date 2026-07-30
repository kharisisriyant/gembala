import { Global, Inject, Module, type OnApplicationShutdown } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import * as schema from "./schema"

export const DRIZZLE = Symbol("DRIZZLE")
export const PG_POOL = Symbol("PG_POOL")

export type Db = NodePgDatabase<typeof schema>

export const InjectDb = () => Inject(DRIZZLE)

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new Pool({ connectionString: config.getOrThrow<string>("DATABASE_URL") }),
    },
    {
      provide: DRIZZLE,
      inject: [PG_POOL],
      useFactory: (pool: Pool): Db => drizzle(pool, { schema }),
    },
  ],
  exports: [DRIZZLE],
})
export class DrizzleModule implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async onApplicationShutdown() {
    await this.pool.end()
  }
}
