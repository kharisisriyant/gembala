import { ChevronsUpDown, KeyRound, LogOut, ShieldCheck, UserRound } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar"
import { MemberAvatar } from "@/components/member-avatar"
import { useAuth } from "@/lib/auth"

export function UserMenu() {
  const { t } = useTranslation()
  const { me, logout } = useAuth()
  const { isMobile } = useSidebar()
  const navigate = useNavigate()
  if (!me) return null
  const roleSummary = me.isSystemAdmin
    ? t("roles.admin")
    : me.roles.map((r) => r.name).join(", ") || t("roles.noRoles")

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" tooltip={me.user.name} className="data-[state=open]:bg-sidebar-accent">
              <MemberAvatar name={me.user.name} className="shrink-0" />
              <div className="min-w-0 flex-1 text-left leading-tight">
                <div className="truncate text-sm font-medium">{me.user.name}</div>
                <div className="text-muted-foreground truncate text-xs">{roleSummary}</div>
              </div>
              <ChevronsUpDown className="text-muted-foreground ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side={isMobile ? "top" : "right"}
            align="end"
            sideOffset={8}
            className="w-64"
          >
            <DropdownMenuLabel className="font-normal">
              <div className="truncate text-sm font-medium">{me.user.name}</div>
              <div className="text-muted-foreground truncate text-xs">{me.user.email}</div>
              <div className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
                <ShieldCheck className="size-3.5 shrink-0" />
                <span className="truncate">
                  {me.org.name} · {roleSummary}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/profile")}>
              <UserRound className="size-4" /> {t("userMenu.profile")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/profile?tab=roles")}>
              <ShieldCheck className="size-4" /> {t("userMenu.roles")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/profile?tab=security")}>
              <KeyRound className="size-4" /> {t("userMenu.password")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                logout()
                navigate("/login")
              }}
            >
              <LogOut className="size-4" /> {t("userMenu.signOut")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
