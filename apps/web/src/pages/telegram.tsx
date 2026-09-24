import { CheckCircle2, Send } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { PageHeader } from "@/components/page-header"
import { useTelegramLink, useUnlinkTelegram } from "@/lib/queries"

export function TelegramPage() {
  const { data, isLoading } = useTelegramLink()
  const unlink = useUnlinkTelegram()

  return (
    <div>
      <PageHeader title="Telegram" subtitle="Link your Telegram account to Gembala." />

      <Card className="max-w-lg p-6">
        <div className="flex items-start gap-4">
          <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
            <Send className="size-5" />
          </div>
          <div className="flex-1">
            <h2 className="font-medium">Telegram Bot</h2>
            <p className="text-muted-foreground mt-0.5 text-sm">
              Connect your personal Telegram account.
            </p>
          </div>
        </div>

        <div className="mt-5">
          {isLoading || !data ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : data.linked ? (
            <div>
              <div className="mb-3 flex items-center gap-2">
                <Badge variant="success">
                  <CheckCircle2 className="size-3.5" /> Connected
                </Badge>
                {data.telegramUsername && (
                  <span className="text-muted-foreground text-sm">@{data.telegramUsername}</span>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={unlink.isPending}
                onClick={async () => {
                  await unlink.mutateAsync()
                  toast("Telegram unlinked")
                }}
              >
                {unlink.isPending ? "Unlinking…" : "Unlink Telegram"}
              </Button>
            </div>
          ) : (
            <div>
              {!data.botConfigured && (
                <p className="text-muted-foreground mb-3 text-sm">
                  The bot isn't connected yet — check back later.
                </p>
              )}
              <p className="mb-3 text-sm">
                {data.botUsername
                  ? `Message @${data.botUsername} on Telegram with the code below.`
                  : "Send the code below to the bot on Telegram once it's connected."}
              </p>
              <div className="bg-muted/40 rounded-lg border p-4">
                <p className="text-muted-foreground mb-1 text-xs">Your one-time code</p>
                <p className="font-mono text-2xl font-bold tracking-widest">{data.code}</p>
                <p className="text-muted-foreground mt-2 text-xs">
                  Send: /link {data.code} — expires {new Date(data.expiresAt).toLocaleTimeString()}
                </p>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
