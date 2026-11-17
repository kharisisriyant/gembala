import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import type { NotificationItemResponse } from "@gembala/shared"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useSetNotificationRead } from "@/lib/queries"

export function formatNotificationTime(iso: string, lang: string): string {
  return new Date(iso).toLocaleString(lang === "id" ? "id-ID" : "en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

// One inbox row. Opening an item marks it read; the toggle undoes that.
export function NotificationItem({
  item,
  onOpen,
  showToggle = true,
}: {
  item: NotificationItemResponse
  onOpen?: () => void
  showToggle?: boolean
}) {
  const { t, i18n } = useTranslation("notifications")
  const setRead = useSetNotificationRead()
  const unread = item.readAt === null
  const open = () => {
    if (unread) setRead.mutate({ id: item.id, read: true })
    onOpen?.()
  }
  const body = (
    <>
      <div className="flex items-start gap-2">
        {unread && <span aria-hidden className="bg-primary mt-1.5 size-2 shrink-0 rounded-full" />}
        <div className="min-w-0 flex-1">
          <div className={cn("text-sm", unread ? "font-semibold" : "font-medium")}>{item.title}</div>
          <div className="text-muted-foreground line-clamp-2 text-sm">{item.body}</div>
          <div className="text-muted-foreground mt-1 text-xs">{formatNotificationTime(item.createdAt, i18n.language)}</div>
        </div>
      </div>
    </>
  )
  return (
    <div className="flex items-start gap-2 px-3 py-2">
      {item.link ? (
        <Link to={item.link} onClick={open} className="hover:bg-accent min-w-0 flex-1 rounded-md p-1">
          {body}
        </Link>
      ) : (
        <button type="button" onClick={open} className="hover:bg-accent min-w-0 flex-1 rounded-md p-1 text-left">
          {body}
        </button>
      )}
      {showToggle && (
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0"
          onClick={() => setRead.mutate({ id: item.id, read: unread })}
        >
          {unread ? t("markRead") : t("markUnread")}
        </Button>
      )}
    </div>
  )
}
