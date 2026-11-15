import { useTranslation } from "react-i18next"
import { useEffect, useState } from "react"
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { GoogleButton, OrDivider } from "@/components/google-button"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { API_URL } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { useAuthConfig } from "@/lib/queries"
import { AuthShell } from "./auth-shell"

export function LoginPage() {
  const { t } = useTranslation("auth")
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [params, setParams] = useSearchParams()
  const { data: authConfig } = useAuthConfig()
  const googleError = params.get("google")

  // The API redirects here with ?google=<code> when Google sign-in fails.
  useEffect(() => {
    if (!googleError) return
    toast.error(t(`google.errors.${googleError}`, { defaultValue: t("google.errors.failed") }), { id: "google-sign-in" })
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete("google")
        return next
      },
      { replace: true },
    )
  }, [googleError, setParams, t])

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
      {authConfig?.googleSignIn && (
        <div className="mt-4 space-y-4">
          <OrDivider />
          <GoogleButton href={`${API_URL}/auth/google`} />
        </div>
      )}
    </AuthShell>
  )
}
