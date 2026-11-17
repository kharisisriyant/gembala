import { useEffect, useState } from "react"
import { LoneSheep } from "@/components/landing-illustrations"
import { onCelebrate } from "@/lib/celebrate"

const STAGGER_SECONDS = 0.25

/** Decorative overlay: plays the sheep requested through `celebrate()`. Mounted once in `App`. */
export function SheepParade() {
  const [runs, setRuns] = useState<{ id: number; sheep: number }[]>([])

  useEffect(
    () =>
      onCelebrate((sheep) => {
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
        setRuns((prev) => [...prev, { id: (prev.at(-1)?.id ?? 0) + 1, sheep }])
      }),
    [],
  )

  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 bottom-3 z-[60] h-10 overflow-x-clip">
      {runs.flatMap((run) =>
        Array.from({ length: run.sheep }, (_, index) => (
          <div
            key={`${run.id}-${index}`}
            className="animate-trot absolute bottom-0 left-0"
            style={{ animationDelay: `${index * STAGGER_SECONDS}s` }}
            onAnimationEnd={(event) => {
              // The last sheep leaving the screen retires the whole run.
              if (event.target !== event.currentTarget || index !== run.sheep - 1) return
              setRuns((prev) => prev.filter((r) => r.id !== run.id))
            }}
          >
            <LoneSheep className="w-14 animate-[hop_0.5s_ease-out_infinite] drop-shadow-sm" />
          </div>
        )),
      )}
    </div>
  )
}
