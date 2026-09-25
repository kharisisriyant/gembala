import {
  LayoutDashboard,
  Users,
  Users2,
  Sprout,
  Leaf,
  Tags,
  MailPlus,
  Send,
  CalendarDays,
  DoorOpen,
  ShieldCheck,
} from "lucide-react"
import { NavLink } from "react-router-dom"
import { useTranslation } from "react-i18next"
import type { PermissionAction, PermissionResource } from "@gembala/shared"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { useAuth } from "@/lib/auth"
import { MemberAvatar } from "@/components/member-avatar"

type NavItem = {
  titleKey: string
  to: string
  icon: typeof LayoutDashboard
  permission?: { resource: PermissionResource; action: PermissionAction }
}

const nav: NavItem[] = [
  { titleKey: "nav.dashboard", to: "/dashboard", icon: LayoutDashboard },
  { titleKey: "nav.groups", to: "/groups", icon: Sprout, permission: { resource: "groups", action: "read" } },
  { titleKey: "nav.members", to: "/members", icon: Users, permission: { resource: "members", action: "read" } },
  { titleKey: "nav.events", to: "/events", icon: CalendarDays, permission: { resource: "events", action: "read" } },
  { titleKey: "nav.rooms", to: "/rooms", icon: DoorOpen, permission: { resource: "rooms", action: "read" } },
  { titleKey: "nav.tags", to: "/tags", icon: Tags, permission: { resource: "tags", action: "read" } },
]

const adminNav: NavItem[] = [
  { titleKey: "nav.invites", to: "/settings/invites", icon: MailPlus },
  { titleKey: "nav.team", to: "/settings/team", icon: Users2 },
  { titleKey: "nav.roles", to: "/settings/roles", icon: ShieldCheck },
]

const personalNav: NavItem[] = [{ titleKey: "nav.telegram", to: "/settings/telegram", icon: Send }]

function NavItems({ items }: { items: NavItem[] }) {
  const { t } = useTranslation()
  return (
    <SidebarMenu>
      {items.map((item) => {
        const title = t(item.titleKey)
        return (
          <SidebarMenuItem key={item.to}>
            <NavLink to={item.to} end={item.to === "/"}>
              {({ isActive }) => (
                <SidebarMenuButton isActive={isActive} tooltip={title}>
                  <item.icon />
                  <span>{title}</span>
                </SidebarMenuButton>
              )}
            </NavLink>
          </SidebarMenuItem>
        )
      })}
    </SidebarMenu>
  )
}

export function AppSidebar() {
  const { t } = useTranslation()
  const { me, isSystemAdmin, hasPermission } = useAuth()
  const visibleNav = nav.filter(
    (item) => !item.permission || hasPermission(item.permission.resource, item.permission.action),
  )
  const visibleAdminNav = adminNav.filter((item) => {
    if (item.to === "/settings/invites") return hasPermission("invites", "read")
    return isSystemAdmin // Team and Roles stay system-admin-only
  })
  const manageItems = [...visibleNav, ...visibleAdminNav]

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-lg">
            <Leaf className="size-5" />
          </div>
          <div className="leading-tight">
            <div className="font-heading text-lg font-bold">Gembala</div>
            <div className="text-muted-foreground text-xs">{me?.org.name ?? t("sidebar.tagline")}</div>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t("nav.manage")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <NavItems items={manageItems} />
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>{t("nav.personal")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <NavItems items={personalNav} />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        {me && (
          <div className="flex items-center gap-2 rounded-md p-2">
            <MemberAvatar name={me.user.name} />
            <div className="leading-tight">
              <div className="text-sm font-medium">{me.user.name}</div>
              <div className="text-muted-foreground text-xs">
                {me.isSystemAdmin ? t("roles.admin") : me.roles.map((r) => r.name).join(", ") || t("roles.noRoles")}
              </div>
            </div>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  )
}
