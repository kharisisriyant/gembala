import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import type { OrganizationInviteResponse } from "@gembala/shared"
import { apiFetch } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function OrganizationInviteForm() {
  const { t } = useTranslation("auth")
  const [email, setEmail] = useState("")
  const [invite, setInvite] = useState<OrganizationInviteResponse | null>(null)
  const [busy, setBusy] = useState(false)

  return (
    <form className="mb-6 space-y-3 rounded-lg border p-4" onSubmit={async (event) => {
      event.preventDefault()
      setBusy(true)
      setInvite(null)
      try {
        setInvite(await apiFetch<OrganizationInviteResponse>("/auth/organization-invites", { method: "POST", body: { email } }))
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("inviteError"))
      } finally {
        setBusy(false)
      }
    }}>
      <h2 className="font-semibold">{t("orgInvites")}</h2>
      <p className="text-muted-foreground text-sm">{t("orgInvitesDescription")}</p>
      <Label htmlFor="organization-invite-email">{t("email")}</Label>
      <Input id="organization-invite-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
      <Button disabled={busy}>{t(busy ? "generating" : "generate")}</Button>
      {invite && <div className="space-y-2">
        <Label htmlFor="organization-invite-url">{t("inviteLink")}</Label>
        <Input id="organization-invite-url" readOnly value={invite.url} onFocus={(event) => event.target.select()} />
        <Button type="button" variant="outline" onClick={async () => {
          try {
            await navigator.clipboard.writeText(invite.url)
            toast.success(t("copied"))
          } catch {
            document.getElementById("organization-invite-url")?.focus()
          }
        }}>{t("copy")}</Button>
      </div>}
    </form>
  )
}
