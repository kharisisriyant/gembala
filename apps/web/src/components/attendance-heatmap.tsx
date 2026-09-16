import { Fragment } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useAttendanceHeatmap } from "@/lib/queries"

function cellClass(rate: number | null): string {
  if (rate === null) return "bg-muted/30"
  if (rate === 0) return "bg-destructive/15"
  if (rate < 40) return "bg-primary/15"
  if (rate < 70) return "bg-primary/35"
  if (rate < 90) return "bg-primary/60"
  return "bg-primary/90"
}

function weekLabel(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })
}

export function AttendanceHeatmap() {
  const { data, isLoading } = useAttendanceHeatmap()

  if (isLoading || !data || data.groups.length === 0) return null

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Weekly attendance</CardTitle>
        <CardDescription>Attendance rate per group, Mon–Sun weeks over the past year</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <TooltipProvider delayDuration={0}>
          <div
            className="grid w-max min-w-full gap-0.5 text-[11px]"
            style={{
              gridTemplateColumns: `minmax(110px, auto) repeat(${data.weeks.length}, minmax(13px, 1fr))`,
            }}
          >
            <div />
            {data.weeks.map((w) => (
              <div
                key={w.start}
                className="text-muted-foreground flex items-end justify-center pb-1 text-[8px] font-medium whitespace-nowrap"
                style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
              >
                {weekLabel(w.start)}
              </div>
            ))}

            {data.groups.map((g) => (
              <Fragment key={g.groupId}>
                <div className="flex items-center truncate py-1 pr-2 font-medium">{g.groupName}</div>
                {g.cells.map((c, i) => (
                  <Tooltip key={i}>
                    <TooltipTrigger asChild>
                      <div className={`aspect-square rounded-[3px] ${cellClass(c.rate)}`} />
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="font-medium">{g.groupName}</div>
                      <div className="opacity-80">
                        {weekLabel(data.weeks[i].start)} – {weekLabel(data.weeks[i].end)}
                      </div>
                      <div>
                        {c.rate === null
                          ? "No meeting"
                          : `${c.present}/${c.sessions * g.memberCount} present · ${c.rate}%`}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </Fragment>
            ))}
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  )
}
