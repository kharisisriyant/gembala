import { Leaf } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string
  description: string
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <div className="bg-muted/30 flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2">
          <div className="bg-primary text-primary-foreground flex size-10 items-center justify-center rounded-lg">
            <Leaf className="size-5" />
          </div>
          <div className="leading-tight">
            <div className="font-heading text-xl font-bold">Gembala</div>
            <div className="text-muted-foreground text-xs">Shepherd your people</div>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
        {footer && <div className="text-muted-foreground mt-4 text-center text-sm">{footer}</div>}
      </div>
    </div>
  )
}
