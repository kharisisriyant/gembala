import { useTranslation } from "react-i18next"
import { Link, useSearchParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useUnsubscribe, useUnsubscribePreview } from "@/lib/queries"

// Opened from the footer of a notification email; works without signing in.
export function UnsubscribePage() {
  const { t } = useTranslation("notifications")
  const token = useSearchParams()[0].get("token") ?? ""
  const preview = useUnsubscribePreview(token)
  const unsubscribe = useUnsubscribe()
  const category = preview.data ? t(`categories.${preview.data.category}`) : ""

  return (
    <div className="mx-auto flex min-h-svh max-w-md items-center p-4">
      <Card className="w-full space-y-4 p-6">
        <h1 className="text-2xl">{t("unsubscribe.title")}</h1>
        {preview.isLoading ? null : !preview.data ? (
          <p role="alert">{t("unsubscribe.invalid")}</p>
        ) : unsubscribe.isSuccess ? (
          <p role="status">{t("unsubscribe.done", { category })}</p>
        ) : (
          <>
            <p>{t("unsubscribe.confirm", { category })}</p>
            {unsubscribe.isError && <p role="alert">{t("unsubscribe.invalid")}</p>}
            <Button disabled={unsubscribe.isPending} onClick={() => unsubscribe.mutate(token)}>
              {t("unsubscribe.button")}
            </Button>
          </>
        )}
        <Button asChild variant="link" className="px-0">
          <Link to="/profile">{t("unsubscribe.manage")}</Link>
        </Button>
      </Card>
    </div>
  )
}
