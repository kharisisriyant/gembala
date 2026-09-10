import { useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import type { InvitePreviewResponse } from "@gembala/shared"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { TagList } from "@/components/tag"
import { apiFetch } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { AuthShell } from "./auth-shell"

export function AcceptInvitePage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { acceptInvite } = useAuth()
  const token = params.get("token") ?? ""
  const [name, setName] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)

  const { data: invite, isLoading, error } = useQuery({
    queryKey: ["invite-preview", token],
    queryFn: () => apiFetch<InvitePreviewResponse>(`/invites/token/${token}`),
    enabled: Boolean(token),
    retry: false,
  })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      await acceptInvite({ token, name, password })
      toast.success(`Welcome to ${invite?.orgName}`)
      navigate("/dashboard", { replace: true })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not accept invite")
    } finally {
      setBusy(false)
    }
  }

  if (!token || error) {
    return (
      <AuthShell title="Invalid invite" description="This invite link is invalid, expired, or revoked.">
        <Button asChild className="w-full" variant="outline">
          <Link to="/login">Go to sign in</Link>
        </Button>
      </AuthShell>
    )
  }

  if (isLoading || !invite) {
    return (
      <AuthShell title="Checking invite…" description="One moment.">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title={`Join ${invite.orgName}`}
      description={`You've been invited as ${invite.roleLabel} (${invite.email}).`}
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <div className="text-muted-foreground mb-2 text-xs font-medium uppercase">Your scope</div>
          <TagList tags={invite.scopeTags} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="name">Your full name</Label>
          <Input id="name" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password">Choose a password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Joining…" : "Join organization"}
        </Button>
      </form>
    </AuthShell>
  )
}
