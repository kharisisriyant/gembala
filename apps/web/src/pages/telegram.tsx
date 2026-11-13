import { CheckCircle2, Send } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { PageHeader } from "@/components/page-header"
import { useTelegramLink, useUnlinkTelegram } from "@/lib/queries"

export function TelegramPage() {
  const { t } = useTranslation("notifications")
  const { data, isLoading } = useTelegramLink()
  const unlink = useUnlinkTelegram()

  return (
    <div>
      <PageHeader title={t("telegramPage.title")} subtitle={t("telegramPage.subtitle")} />

      <Card className="max-w-lg p-6">
        <div className="flex items-start gap-4">
          <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
            <Send className="size-5" />
          </div>
          <div className="flex-1">
            <h2 className="font-medium">{t("telegramPage.botTitle")}</h2>
            <p className="text-muted-foreground mt-0.5 text-sm">{t("telegramPage.botSubtitle")}</p>
          </div>
        </div>

        <div className="mt-5">
          {isLoading || !data ? (
            <p className="text-muted-foreground text-sm">{t("telegramPage.loading")}</p>
          ) : data.linked ? (
            <div>
              <div className="mb-3 flex items-center gap-2">
                <Badge variant="success">
                  <CheckCircle2 className="size-3.5" /> {t("telegramPage.connected")}
                </Badge>
                {data.telegramUsername && <span className="text-muted-foreground text-sm">@{data.telegramUsername}</span>}
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={unlink.isPending}
                onClick={async () => {
                  await unlink.mutateAsync()
                  toast(t("telegramPage.unlinked"))
                }}
              >
                {unlink.isPending ? t("telegramPage.unlinking") : t("telegramPage.unlink")}
              </Button>
            </div>
          ) : (
            <div>
              {data.disconnected && (
                <p role="alert" className="text-destructive mb-3 text-sm">
                  {t("telegram.disconnected")}
                </p>
              )}
              {data.botUsername && (
                <Button asChild className="mb-3">
                  <a href={`https://t.me/${data.botUsername}?start=${data.code}`} target="_blank" rel="noreferrer">
                    <Send className="size-4" /> {t("telegram.connect")}
                  </a>
                </Button>
              )}
              {!data.botConfigured && <p className="text-muted-foreground mb-3 text-sm">{t("telegramPage.botNotReady")}</p>}
              <p className="mb-3 text-sm">
                {data.botUsername ? t("telegramPage.sendTo", { bot: data.botUsername }) : t("telegramPage.sendLater")}
              </p>
              <div className="bg-muted/40 rounded-lg border p-4">
                <p className="text-muted-foreground mb-1 text-xs">{data.botUsername ? t("telegram.orSend") : t("telegramPage.codeLabel")}</p>
                <p className="font-mono text-2xl font-bold tracking-widest">{data.code}</p>
                <p className="text-muted-foreground mt-2 text-xs">
                  {t("telegramPage.sendCommand", { code: data.code, time: new Date(data.expiresAt).toLocaleTimeString() })}
                </p>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
