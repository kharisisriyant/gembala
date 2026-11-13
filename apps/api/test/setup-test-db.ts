import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import IORedis from "ioredis"
import { join } from "node:path"
import { Pool } from "pg"

const BASE = process.env.TEST_DATABASE_ADMIN_URL ?? "postgres://gembala:gembala@localhost:5433/postgres"
const TEST_DB = "gembala_test"
// Separate Redis logical db so tests never touch dev queues.
export const TEST_REDIS_URL = process.env.TEST_REDIS_URL ?? "redis://localhost:6380/1"

// Recreates the disposable test database, migrates it and clears the test Redis db.
export async function resetTestDb(): Promise<string> {
  const admin = new Pool({ connectionString: BASE })
  await admin.query(`drop database if exists ${TEST_DB} with (force)`)
  await admin.query(`create database ${TEST_DB}`)
  await admin.end()

  const url = BASE.replace(/\/[^/]*$/, `/${TEST_DB}`)
  const pool = new Pool({ connectionString: url })
  await migrate(drizzle(pool), { migrationsFolder: join(__dirname, "..", "drizzle") })
  await pool.end()

  const redis = new IORedis(TEST_REDIS_URL)
  await redis.flushdb()
  await redis.quit()
  return url
}
