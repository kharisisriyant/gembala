import "dotenv/config"
import { randomUUID } from "node:crypto"
import { NOTIFICATION_CHANNELS, type NotificationChannel } from "@gembala/shared"

// Operator tools that need no HTTP route (D26, D34, TP-8). Runs from the compiled
// build (Nest DI needs decorator metadata, which tsx does not emit): `pnpm build` first.
//   pnpm --filter @gembala/api notifications replay [channel]
//   pnpm --filter @gembala/api notifications kill list
//   pnpm --filter @gembala/api notifications kill add [--type KEY] [--channel CH] [--reason TEXT]
//   pnpm --filter @gembala/api notifications kill remove <id>
//   pnpm --filter @gembala/api notifications preview <type> <en|id> '<json payload>'
//   pnpm --filter @gembala/api notifications send <type> <user email> '<json payload>'
const USAGE = "usage: notifications <replay [channel] | kill list|add|remove | preview <type> <en|id> <json> | send <type> <email> <json>>"

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : undefined
}

function channelArg(value: string | undefined): NotificationChannel | undefined {
  if (value === undefined) return undefined
  if (!(NOTIFICATION_CHANNELS as readonly string[]).includes(value)) throw new Error(`channel must be one of ${NOTIFICATION_CHANNELS.join(", ")}`)
  return value as NotificationChannel
}

async function main() {
  const [command, ...args] = process.argv.slice(2)
  // The CLI only reads and writes; running workers here would compete with the API's.
  process.env.NOTIFICATIONS_WORKERS = "false"
  const { NestFactory } = await import("@nestjs/core")
  const { AppModule } = await import("../app.module")
  const { NotificationsService } = await import("./notifications.service")
  const { NotificationsDispatcher } = await import("./notifications.dispatcher")
  const { NotificationsRepository } = await import("./notifications.repository")
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ["error", "warn"] })
  try {
    const service = app.get(NotificationsService)
    const repo = app.get(NotificationsRepository)
    switch (command) {
      case "replay": {
        const n = await app.get(NotificationsDispatcher).replayFailed(channelArg(args[0]))
        console.log(`${n} failed deliveries reset to pending; a running worker will enqueue them`)
        break
      }
      case "kill": {
        const [action, ...rest] = args
        if (action === "list") console.table(await repo.listKillSwitches())
        else if (action === "add") {
          const row = await repo.addKillSwitch({ typeKey: flag(rest, "type") ?? null, channel: channelArg(flag(rest, "channel")) ?? null, reason: flag(rest, "reason") ?? "" })
          console.log(`kill switch ${row.id} added (type=${row.typeKey ?? "any"}, channel=${row.channel ?? "any"})`)
        } else if (action === "remove" && rest[0]) console.log((await repo.removeKillSwitch(rest[0])) ? "removed" : "not found")
        else throw new Error(USAGE)
        break
      }
      case "preview": {
        const [type, locale, json] = args
        if (!type || (locale !== "en" && locale !== "id")) throw new Error(USAGE)
        console.log(JSON.stringify(service.preview(type, locale, JSON.parse(json ?? "{}")), null, 2))
        break
      }
      case "send": {
        const [type, email, json] = args
        if (!type || !email) throw new Error(USAGE)
        const userId = await repo.userIdByEmail(email)
        if (!userId) throw new Error("no user with that email")
        const queued = await service.notifyUser({ type, userId, payload: JSON.parse(json ?? "{}"), idempotencyKey: `cli:${randomUUID()}` })
        console.log(queued ? "queued; a running worker will deliver it" : "not queued (user has no org)")
        break
      }
      default:
        throw new Error(USAGE)
    }
  } finally {
    await app.close()
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
