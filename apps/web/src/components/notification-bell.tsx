import { Bell } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { NotificationItem } from "@/components/notification-item"
import { useMarkAllNotificationsRead, useNotifications, useUnreadNotificationCount } from "@/lib/queries"

export function NotificationBell() {
  const { t } = useTranslation("notifications")
  const { data: unread } = useUnreadNotificationCount()
  const count = unread?.count ?? 0
  const { data } = useNotifications({ limit: 8 })
  const markAll = useMarkAllNotificationsRead()
  const items = data?.pages[0]?.items ?? []

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={count > 0 ? t("bell.unread", { count }) : t("bell.label")}>
          <Bell className="size-4" />
          {count > 0 && (
            <span className="bg-primary text-primary-foreground absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold leading-4">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96 max-w-[calc(100vw-2rem)] p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-medium">{t("title")}</span>
          <Button variant="ghost" size="sm" disabled={count === 0 || markAll.isPending} onClick={() => markAll.mutate()}>
            {t("markAllRead")}
          </Button>
        </div>
        <div className="max-h-96 divide-y overflow-y-auto">
          {items.length === 0 ? (
            <p className="text-muted-foreground px-3 py-6 text-center text-sm">{t("empty")}</p>
          ) : (
            items.map((item) => <NotificationItem key={item.id} item={item} showToggle={false} />)
          )}
        </div>
        <div className="border-t p-1">
          <Button asChild variant="ghost" size="sm" className="w-full">
            <Link to="/notifications">{t("bell.viewAll")}</Link>
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
