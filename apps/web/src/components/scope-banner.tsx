import { Eye, ShieldCheck } from "lucide-react"
import { useAuth } from "@/lib/auth"
import { useMembers } from "@/lib/queries"

// Tiny indicator in the header that makes the active RBAC scope obvious.
export function ScopeBanner() {
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
            Full access
            {count !== undefined && (
              <>
                {" "}· <span className="text-foreground font-medium">{count}</span> members
              </>
            )}
          </span>
        </>
      ) : (
        <>
          <Eye className="text-primary size-4" />
          <span>
            Scoped to{" "}
            <span className="text-foreground font-mono font-medium">
              #{me.scopeTags?.join(" #")}
            </span>
            {count !== undefined && <> · {count} members</>}
          </span>
        </>
      )}
    </div>
  )
}
