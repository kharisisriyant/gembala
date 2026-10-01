import { useTranslation } from "react-i18next"
import { useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/lib/auth"
import { AuthShell } from "./auth-shell"

export function LoginPage() {
  const { t } = useTranslation("auth")
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)

  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? "/dashboard"

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      await login({ email, password })
      navigate(from, { replace: true })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("loginError"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell
      title={t("welcome")}
      description={t("loginDescription")}
      footer={
        <>
          {t("inviteOnly")}{" "}
          <a href="mailto:kharisisriyant@gmail.com" className="text-foreground font-medium hover:underline">
            {t("requestInvite")}
          </a>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="email">{t("email")}</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">{t("password")}</Label>
            <Link to="/forgot-password" className="text-muted-foreground text-xs hover:underline">
              {t("forgot")}
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? t("signingIn") : t("signIn")}
        </Button>
      </form>
    </AuthShell>
  )
}
