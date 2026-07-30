import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { initials } from "@/lib/helpers"

export function MemberAvatar({
  name,
  className,
}: {
  name: string
  className?: string
}) {
  return (
    <Avatar className={cn("size-8", className)}>
      <AvatarFallback className="bg-primary/15 text-primary text-xs font-semibold">
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  )
}
