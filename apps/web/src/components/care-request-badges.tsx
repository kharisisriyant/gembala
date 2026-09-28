import { useTranslation } from "react-i18next"
import type { CareRequestStatus, CareRequestType } from "@gembala/shared"
import { Badge } from "@/components/ui/badge"

export function CareRequestTypeBadge({ type }: { type: CareRequestType }) {
  const { t } = useTranslation("care-requests")
  return <Badge variant={type === "prayer" ? "info" : "warning"}>{t(`type.${type}`)}</Badge>
}

export function CareRequestStatusBadge({ status }: { status: CareRequestStatus }) {
  const { t } = useTranslation("care-requests")
  return <Badge variant={status === "open" ? "success" : "muted"}>{t(`status.${status}`)}</Badge>
}
