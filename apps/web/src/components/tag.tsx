import { cn } from "@/lib/utils"

// Tags double as RBAC scopes, so we give the "scope-ish" ones a stronger look.
const ACCENT = new Set(["youth", "married", "college", "worship", "kids"])

export function Tag({
  name,
  className,
  onClick,
  active,
}: {
  name: string
  className?: string
  onClick?: () => void
  active?: boolean
}) {
  const accent = ACCENT.has(name)
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-xs leading-tight transition-colors",
        onClick && "cursor-pointer hover:border-primary/60",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : accent
            ? "border-accent bg-accent/50 text-accent-foreground"
            : "border-border bg-secondary text-secondary-foreground",
        className,
      )}
    >
      #{name}
    </button>
  )
}

export function TagList({
  tags,
  className,
  onTagClick,
  activeTags,
}: {
  tags: string[]
  className?: string
  onTagClick?: (t: string) => void
  activeTags?: string[]
}) {
  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {tags.map((t) => (
        <Tag
          key={t}
          name={t}
          onClick={onTagClick ? () => onTagClick(t) : undefined}
          active={activeTags?.includes(t)}
        />
      ))}
    </div>
  )
}
