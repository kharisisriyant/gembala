import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { initials } from "@/lib/helpers"

export function MemberAvatar({
  name,
  photoUrl,
  className,
}: {
  name: string
  photoUrl?: string
  className?: string
}) {
  return (
    <Avatar className={cn("size-8", className)}>
      {photoUrl && <AvatarImage src={photoUrl} alt={name} />}
      <AvatarFallback className="bg-primary/15 text-primary text-xs font-semibold">
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  )
}
