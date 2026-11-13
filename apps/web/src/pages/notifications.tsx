import { useState } from "react"
import { useTranslation } from "react-i18next"
import { NOTIFICATION_CATEGORIES, type NotificationCategory } from "@gembala/shared"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PageHeader } from "@/components/page-header"
import { NotificationItem } from "@/components/notification-item"
import { useMarkAllNotificationsRead, useNotifications, useUnreadNotificationCount } from "@/lib/queries"

const ALL = "all"

export function NotificationsPage() {
  const { t } = useTranslation("notifications")
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [category, setCategory] = useState<NotificationCategory | typeof ALL>(ALL)
  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useNotifications({
    unread: unreadOnly || undefined,
    category: category === ALL ? undefined : category,
  })
  const { data: unread } = useUnreadNotificationCount()
  const markAll = useMarkAllNotificationsRead()
  const items = data?.pages.flatMap((p) => p.items) ?? []

  return (
    <div>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        action={
          <Button variant="outline" disabled={!unread?.count || markAll.isPending} onClick={() => markAll.mutate()}>
            {t("markAllRead")}
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button variant={unreadOnly ? "outline" : "default"} size="sm" onClick={() => setUnreadOnly(false)}>
          {t("filters.all")}
        </Button>
        <Button variant={unreadOnly ? "default" : "outline"} size="sm" onClick={() => setUnreadOnly(true)}>
          {t("filters.unread")}
        </Button>
        <Select value={category} onValueChange={(v) => setCategory(v as NotificationCategory | typeof ALL)}>
          <SelectTrigger className="w-44" aria-label={t("filters.category")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("filters.category")}</SelectItem>
            {NOTIFICATION_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {t(`categories.${c}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Card className="divide-y overflow-hidden p-0">
        {isLoading ? null : items.length === 0 ? (
          <p className="text-muted-foreground p-8 text-center">{unreadOnly ? t("emptyUnread") : t("empty")}</p>
        ) : (
          items.map((item) => <NotificationItem key={item.id} item={item} />)
        )}
      </Card>
      {hasNextPage && (
        <div className="mt-4 flex justify-center">
          <Button variant="outline" disabled={isFetchingNextPage} onClick={() => void fetchNextPage()}>
            {t("loadMore")}
          </Button>
        </div>
      )}
    </div>
  )
}
