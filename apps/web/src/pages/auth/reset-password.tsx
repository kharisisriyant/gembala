import { useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { apiFetch } from "@/lib/api"
import { AuthShell } from "./auth-shell"

export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get("token") ?? ""
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) {
      toast.error("Passwords don't match")
      return
    }
    setBusy(true)
    try {
      await apiFetch<void>("/auth/reset-password", { method: "POST", body: { token, password } })
      toast.success("Password updated", { description: "Sign in with your new password." })
      navigate("/login", { replace: true })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reset failed")
    } finally {
      setBusy(false)
    }
  }

  if (!token) {
    return (
      <AuthShell title="Invalid link" description="This reset link is missing its token.">
        <Button asChild className="w-full">
          <Link to="/forgot-password">Request a new link</Link>
        </Button>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Choose a new password" description="Your reset link is valid for one hour.">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="password">New password</Label>
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
        <div className="grid gap-2">
          <Label htmlFor="confirm">Confirm password</Label>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Updating…" : "Update password"}
        </Button>
      </form>
    </AuthShell>
  )
}
