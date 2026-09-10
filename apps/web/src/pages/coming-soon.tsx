import { Leaf } from "lucide-react"

export function ComingSoonPage() {
  return (
    <div className="bg-muted/30 flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        <div className="mb-6 flex items-center justify-center gap-2">
          <div className="bg-primary text-primary-foreground flex size-10 items-center justify-center rounded-lg">
            <Leaf className="size-5" />
          </div>
          <div className="text-left leading-tight">
            <div className="font-heading text-xl font-bold">Gembala</div>
            <div className="text-muted-foreground text-xs">Shepherd your people</div>
          </div>
        </div>
        <h1 className="font-heading text-2xl font-bold">Coming soon</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          We're still building this. Check back soon.
        </p>
      </div>
    </div>
  )
}
