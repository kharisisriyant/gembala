import { useState } from "react"
import { Collapsible } from "radix-ui"
import {
  ChevronRight,
  LayoutDashboard,
  Users,
  Users2,
  Sprout,
  Tags,
  MailPlus,
  Send,
  CalendarDays,
  CalendarClock,
  DoorOpen,
  ShieldCheck,
  HandHeart,
  Footprints,
} from "lucide-react"
import { NavLink, useLocation } from "react-router-dom"
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
  useSidebar,
} from "@/components/ui/sidebar"
import { useAuth } from "@/lib/auth"
import { UserMenu } from "@/components/user-menu"

type NavItem = {
  titleKey: string
  to: string
  icon: typeof LayoutDashboard
  permission?: { resource: PermissionResource; action: PermissionAction }
}

const dashboardNav: NavItem[] = [
  { titleKey: "nav.dashboard", to: "/dashboard", icon: LayoutDashboard },
]

const congregationNav: NavItem[] = [
  { titleKey: "nav.members", to: "/members", icon: Users, permission: { resource: "members", action: "read" } },
  { titleKey: "nav.groups", to: "/groups", icon: Sprout, permission: { resource: "groups", action: "read" } },
  { titleKey: "nav.careRequests", to: "/care-requests", icon: HandHeart, permission: { resource: "care_requests", action: "read" } },
  { titleKey: "nav.journey", to: "/journey", icon: Footprints, permission: { resource: "journey", action: "read" } },
  { titleKey: "nav.tags", to: "/tags", icon: Tags, permission: { resource: "tags", action: "read" } },
]

const servicesNav: NavItem[] = [
  { titleKey: "nav.scheduling", to: "/scheduling", icon: CalendarClock, permission: { resource: "scheduling", action: "read" } },
  { titleKey: "nav.events", to: "/events", icon: CalendarDays, permission: { resource: "events", action: "read" } },
  { titleKey: "nav.rooms", to: "/rooms", icon: DoorOpen, permission: { resource: "rooms", action: "read" } },
]

const adminNav: NavItem[] = [
  { titleKey: "nav.team", to: "/settings/team", icon: Users2 },
  { titleKey: "nav.roles", to: "/settings/roles", icon: ShieldCheck },
  { titleKey: "nav.invites", to: "/settings/invites", icon: MailPlus },
]

const personalNav: NavItem[] = [{ titleKey: "nav.telegram", to: "/settings/telegram", icon: Send }]

function NavItems({ items }: { items: NavItem[] }) {
  const { pathname } = useLocation()
  const { t } = useTranslation()
  return (
    <SidebarMenu>
      {items.map((item) => {
        const title = t(item.titleKey)
        return (
          <SidebarMenuItem key={item.to}>
            <SidebarMenuButton asChild isActive={pathname === item.to || pathname.startsWith(`${item.to}/`)} tooltip={title}>
              <NavLink to={item.to}>
                <item.icon />
                <span>{title}</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )
      })}
    </SidebarMenu>
  )
}

function NavigationGroup({ id, items }: { id: string; items: NavItem[] }) {
  const { t } = useTranslation()
  const { pathname, key: routeKey } = useLocation()
  const { state, isMobile } = useSidebar()
  const [routeOverride, setRouteOverride] = useState<{ routeKey: string; expanded: boolean } | null>(null)
  const storageKey = `gembala.sidebar.${id}.expanded`
  const [expanded, setExpanded] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      return saved === null ? id !== "administration" : saved === "true"
    } catch {
      return id !== "administration"
    }
  })
  const containsCurrentPage = items.some((item) => pathname === item.to || pathname.startsWith(`${item.to}/`))
  const iconOnly = state === "collapsed" && !isMobile
  const open = iconOnly || (routeOverride?.routeKey === routeKey
    ? routeOverride.expanded
    : containsCurrentPage || expanded)

  const onOpenChange = (value: boolean) => {
    setRouteOverride({ routeKey, expanded: value })
    setExpanded(value)
    try {
      localStorage.setItem(storageKey, String(value))
    } catch {
      // Navigation remains usable when browser storage is unavailable.
    }
  }

  if (items.length === 0) return null

  return (
    <Collapsible.Root open={open} onOpenChange={onOpenChange} asChild>
      <SidebarGroup>
        <SidebarGroupLabel asChild className="group-data-[collapsible=icon]:hidden">
          <Collapsible.Trigger className="hover:bg-sidebar-accent cursor-pointer">
            {t(`nav.${id}`)}
            <ChevronRight className={`ml-auto transition-transform ${open ? "rotate-90" : ""}`} />
          </Collapsible.Trigger>
        </SidebarGroupLabel>
        <Collapsible.Content>
          <SidebarGroupContent>
            <NavItems items={items} />
          </SidebarGroupContent>
        </Collapsible.Content>
      </SidebarGroup>
    </Collapsible.Root>
  )
}

export function AppSidebar() {
  const { t } = useTranslation()
  const { me, isSystemAdmin, hasPermission } = useAuth()
  const filterVisible = (items: NavItem[]) => items.filter(
    (item) => !item.permission || hasPermission(item.permission.resource, item.permission.action),
  )
  const visibleAdminNav = adminNav.filter((item) => {
    if (item.to === "/settings/invites") return hasPermission("invites", "read")
    return isSystemAdmin // Team and Roles stay system-admin-only
  })

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5 group-data-[collapsible=icon]:p-0">
          <img src="/logo.png" alt="" className="size-9 shrink-0 object-contain group-data-[collapsible=icon]:size-8" />
          <div className="leading-tight group-data-[collapsible=icon]:hidden">
            <div className="font-heading text-lg font-bold">gembala</div>
            <div className="text-muted-foreground text-xs">{me?.org.name ?? t("sidebar.tagline")}</div>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <NavItems items={dashboardNav} />
          </SidebarGroupContent>
        </SidebarGroup>
        <NavigationGroup id="congregation" items={filterVisible(congregationNav)} />
        <NavigationGroup id="services" items={filterVisible(servicesNav)} />
        <NavigationGroup id="administration" items={visibleAdminNav} />
        <SidebarGroup>
          <SidebarGroupLabel>{t("nav.personal")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <NavItems items={personalNav} />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <UserMenu />
      </SidebarFooter>
    </Sidebar>
  )
}
