import { LayoutDashboard, Users, Sprout, Leaf, Tags, MailPlus, Send } from "lucide-react"
import { NavLink } from "react-router-dom"
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

type NavItem = { title: string; to: string; icon: typeof LayoutDashboard }

const nav: NavItem[] = [
  { title: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { title: "Small Groups", to: "/groups", icon: Sprout },
  { title: "Members", to: "/members", icon: Users },
  { title: "Tags", to: "/tags", icon: Tags },
]

const adminNav: NavItem[] = [{ title: "Invites", to: "/settings/invites", icon: MailPlus }]

const personalNav: NavItem[] = [{ title: "Telegram", to: "/settings/telegram", icon: Send }]

function NavItems({ items }: { items: NavItem[] }) {
  return (
    <SidebarMenu>
      {items.map((item) => (
        <SidebarMenuItem key={item.to}>
          <NavLink to={item.to} end={item.to === "/"}>
            {({ isActive }) => (
              <SidebarMenuButton isActive={isActive} tooltip={item.title}>
                <item.icon />
                <span>{item.title}</span>
              </SidebarMenuButton>
            )}
          </NavLink>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  )
}

export function AppSidebar() {
  const { me, isAdmin } = useAuth()
  const manageItems = isAdmin ? [...nav, ...adminNav] : nav

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-lg">
            <Leaf className="size-5" />
          </div>
          <div className="leading-tight">
            <div className="font-heading text-lg font-bold">Gembala</div>
            <div className="text-muted-foreground text-xs">{me?.org.name ?? "Shepherd your people"}</div>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Manage</SidebarGroupLabel>
          <SidebarGroupContent>
            <NavItems items={manageItems} />
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Personal</SidebarGroupLabel>
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
              <div className="text-muted-foreground text-xs">{me.roleLabel}</div>
            </div>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  )
}
