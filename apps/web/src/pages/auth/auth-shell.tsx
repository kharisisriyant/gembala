import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

import { LegalLinks } from "@/components/legal-links"

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
          <img src="/logo.png" alt="" className="size-10 object-contain" />
          <div className="leading-tight">
            <div className="font-heading text-xl font-bold">gembala</div>
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
        <div className="mt-6"><LegalLinks /></div>
      </div>
    </div>
  )
}
