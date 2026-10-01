import { useTranslation } from "react-i18next"
import { useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/lib/auth"
import { AuthShell } from "./auth-shell"

export function RegisterPage() {
  const { t } = useTranslation("auth")
  const { register } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get("token") ?? ""
  const [organizationName, setOrganizationName] = useState("")
  const [name, setName] = useState("")
  const [email, setEmail] = useState(params.get("email") ?? "")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      await register({ token, organizationName, name, email, password })
      toast.success(t("created"))
      navigate("/dashboard", { replace: true })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("registerError"))
    } finally {
      setBusy(false)
    }
  }

  if (!token) return (
    <AuthShell title={t("inviteOnly")} description={t("requestInvite")} footer={<Link to="/login">{t("signIn")}</Link>}>
      <Button asChild className="w-full"><a href="mailto:kharisisriyant@gmail.com">{t("requestInvite")}</a></Button>
    </AuthShell>
  )

  return (
    <AuthShell
      title={t("registerTitle")}
      description={t("registerDescription")}
      footer={
        <>
          {t("existingAccount")}{" "}
          <Link to="/login" className="text-foreground font-medium hover:underline">
            {t("signIn")}
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="org">{t("org")}</Label>
          <Input
            id="org"
            required
            value={organizationName}
            onChange={(e) => setOrganizationName(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="name">{t("name")}</Label>
          <Input id="name" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
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
          <Label htmlFor="password">{t("password")}</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="text-muted-foreground text-xs">{t("passwordHint")}</p>
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? t("creating") : t("create")}
        </Button>
      </form>
    </AuthShell>
  )
}
