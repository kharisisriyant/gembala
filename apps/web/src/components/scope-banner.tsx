import { Eye, ShieldCheck } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useAuth } from "@/lib/auth"
import { useMembers } from "@/lib/queries"

// Tiny indicator in the header that makes the active RBAC scope obvious.
export function ScopeBanner() {
  const { t } = useTranslation()
  const { me } = useAuth()
  const { data: members } = useMembers()
  if (!me) return null

  const isAdmin = me.scopeTags === null
  const count = members?.length

  return (
    <div className="text-muted-foreground hidden items-center gap-1.5 text-sm md:flex">
      {isAdmin ? (
        <>
          <ShieldCheck className="text-primary size-4" />
          <span>
            {t("scope.fullAccess")}
            {count !== undefined && (
              <>
                {" "}· <span className="text-foreground font-medium">{count}</span>{" "}
                {t("scope.memberSuffix")}
              </>
            )}
          </span>
        </>
      ) : (
        <>
          <Eye className="text-primary size-4" />
          <span>
            {t("scope.scopedTo")}{" "}
            <span className="text-foreground font-mono font-medium">
              #{me.scopeTags?.join(" #")}
            </span>
            {count !== undefined && <> · {t("scope.members", { count })}</>}
          </span>
        </>
      )}
    </div>
  )
}
