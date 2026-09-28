import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { KeyRound, ShieldCheck, UserRound } from "lucide-react"
import { permissionResourceSchema } from "@gembala/shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MemberAvatar } from "@/components/member-avatar"
import { PageHeader } from "@/components/page-header"
import { useAuth } from "@/lib/auth"
import { useChangePassword, useUpdateProfile } from "@/lib/queries"

const TABS = ["profile", "roles", "security"] as const
type Tab = (typeof TABS)[number]

export function ProfilePage() {
  const { t } = useTranslation("profile")
  const [params, setParams] = useSearchParams()
  const requested = params.get("tab")
  const tab: Tab = TABS.includes(requested as Tab) ? (requested as Tab) : "profile"

  return (
    <div>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <Tabs value={tab} onValueChange={(v) => setParams(v === "profile" ? {} : { tab: v }, { replace: true })}>
        <TabsList>
          <TabsTrigger value="profile">
            <UserRound className="size-4" /> {t("tabs.profile")}
          </TabsTrigger>
          <TabsTrigger value="roles">
            <ShieldCheck className="size-4" /> {t("tabs.roles")}
          </TabsTrigger>
          <TabsTrigger value="security">
            <KeyRound className="size-4" /> {t("tabs.security")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="profile" className="mt-4">
          <ProfileCard />
        </TabsContent>
        <TabsContent value="roles" className="mt-4">
          <RolesCard />
        </TabsContent>
        <TabsContent value="security" className="mt-4">
          <PasswordCard />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function ProfileCard() {
  const { t } = useTranslation("profile")
  const { me } = useAuth()
  const update = useUpdateProfile()
  const [name, setName] = useState(me?.user.name ?? "")
  useEffect(() => setName(me?.user.name ?? ""), [me?.user.name])
  if (!me) return null

  const dirty = name.trim() !== me.user.name && name.trim().length > 0

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await update.mutateAsync({ name: name.trim() })
      toast.success(t("profile.saved"))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("profile.error"))
    }
  }

  return (
    <Card className="max-w-lg p-6">
      <div className="mb-5 flex items-center gap-4">
        <MemberAvatar name={me.user.name} className="size-14 text-base" />
        <div>
          <h2 className="font-medium">{t("profile.title")}</h2>
          <p className="text-muted-foreground text-sm">{t("profile.description")}</p>
        </div>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="profile-name">{t("profile.name")}</Label>
          <Input
            id="profile-name"
            required
            maxLength={100}
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="profile-email">{t("profile.email")}</Label>
          <Input id="profile-email" value={me.user.email} disabled readOnly />
          <p className="text-muted-foreground text-xs">{t("profile.emailHint")}</p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="profile-org">{t("profile.organization")}</Label>
          <Input id="profile-org" value={me.org.name} disabled readOnly />
        </div>
        <Button type="submit" disabled={!dirty || update.isPending}>
          {update.isPending ? t("actions.saving", { ns: "common" }) : t("actions.save", { ns: "common" })}
        </Button>
      </form>
    </Card>
  )
}

function RolesCard() {
  const { t } = useTranslation("profile")
  const { t: tc } = useTranslation()
  const { me, permissions } = useAuth()
  if (!me) return null

  const resourceLabel = (r: string) =>
    tc(`nav.${r}`, { defaultValue: tc(`permissions.resources.${r}`, { ns: "roles", defaultValue: r }) })
  const grouped = permissionResourceSchema.options
    .map((resource) => ({
      resource,
      actions: [...permissions]
        .filter((p) => p.startsWith(`${resource}:`))
        .map((p) => p.split(":")[1]),
    }))
    .filter((g) => g.actions.length > 0)

  return (
    <div className="grid max-w-2xl gap-4">
      <Card className="p-6">
        <h2 className="font-medium">{t("roles.title")}</h2>
        <p className="text-muted-foreground mb-4 text-sm">{t("roles.description")}</p>
        {me.isSystemAdmin && (
          <p className="mb-3 flex items-center gap-2 text-sm">
            <Badge variant="info">{tc("roles.admin")}</Badge> {t("roles.adminNote")}
          </p>
        )}
        {me.roles.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {me.roles.map((r) => (
              <Badge key={r.id} variant="secondary">
                {r.name}
              </Badge>
            ))}
          </div>
        ) : (
          !me.isSystemAdmin && <p className="text-muted-foreground text-sm">{t("roles.none")}</p>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="mb-2 font-medium">{t("roles.scopeTitle")}</h2>
        {me.scopeTags === null ? (
          <p className="text-muted-foreground text-sm">{t("roles.fullAccess")}</p>
        ) : (
          <>
            <p className="text-muted-foreground mb-3 text-sm">{t("roles.scopedTo")}</p>
            <div className="flex flex-wrap gap-2">
              {me.scopeTags.map((tag) => (
                <Badge key={tag} variant="outline">
                  {tag}
                </Badge>
              ))}
            </div>
          </>
        )}
      </Card>

      {!me.isSystemAdmin && (
        <Card className="p-6">
          <h2 className="mb-3 font-medium">{t("roles.permissionsTitle")}</h2>
          {grouped.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("roles.noPermissions")}</p>
          ) : (
            <ul className="divide-y">
              {grouped.map((g) => (
                <li key={g.resource} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="text-sm font-medium">{resourceLabel(g.resource)}</span>
                  <span className="flex flex-wrap gap-1">
                    {g.actions.map((a) => (
                      <Badge key={a} variant="muted">
                        {tc(`permissions.actions.${a}`, { ns: "roles", defaultValue: a })}
                      </Badge>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  )
}

function PasswordCard() {
  const { t } = useTranslation("profile")
  const change = useChangePassword()
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (next !== confirm) return void toast.error(t("password.mismatch"))
    if (next === current) return void toast.error(t("password.same"))
    try {
      await change.mutateAsync({ currentPassword: current, newPassword: next })
      toast.success(t("password.success"))
      setCurrent("")
      setNext("")
      setConfirm("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("password.error"))
    }
  }

  return (
    <Card className="max-w-lg p-6">
      <h2 className="font-medium">{t("password.title")}</h2>
      <p className="text-muted-foreground mb-5 text-sm">{t("password.description")}</p>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="pw-current">{t("password.current")}</Label>
          <Input
            id="pw-current"
            type="password"
            autoComplete="current-password"
            required
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="pw-new">{t("password.new")}</Label>
          <Input
            id="pw-new"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={128}
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="pw-confirm">{t("password.confirm")}</Label>
          <Input
            id="pw-confirm"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={128}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={change.isPending}>
          {change.isPending ? t("password.submitting") : t("password.submit")}
        </Button>
      </form>
    </Card>
  )
}
