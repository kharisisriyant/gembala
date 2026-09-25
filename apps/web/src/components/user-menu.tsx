import { ChevronsUpDown, LogOut, ShieldCheck } from "lucide-react"
import { useNavigate } from "react-router-dom"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { MemberAvatar } from "@/components/member-avatar"
import { useAuth } from "@/lib/auth"

export function UserMenu() {
  const { me, logout } = useAuth()
  const navigate = useNavigate()
  if (!me) return null
  const roleSummary = me.isSystemAdmin ? "Admin" : me.roles.map((r) => r.name).join(", ") || "No roles"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="h-auto gap-2 py-1.5 pr-2 pl-2">
          <MemberAvatar name={me.user.name} className="size-7" />
          <div className="hidden text-left leading-tight sm:block">
            <div className="text-sm font-medium">{me.user.name}</div>
            <div className="text-muted-foreground text-xs">{roleSummary}</div>
          </div>
          <ChevronsUpDown className="text-muted-foreground size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <div className="text-sm font-medium">{me.user.name}</div>
          <div className="text-muted-foreground text-xs">{me.user.email}</div>
          <div className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
            <ShieldCheck className="size-3.5" />
            {me.org.name} · {roleSummary}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            logout()
            navigate("/login")
          }}
        >
          <LogOut className="size-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
