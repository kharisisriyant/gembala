import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"

const WOOL = "oklch(0.97 0.01 90)"
const INK = "oklch(0.3 0.02 240)"

function Sheep({
  x,
  y,
  scale = 1,
  flip,
}: {
  x: number
  y: number
  scale?: number
  flip?: boolean
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -scale : scale} ${scale})`}>
      {[16, 24, 38, 46].map((lx) => (
        <rect key={lx} x={lx} y={30} width={4} height={12} rx={2} fill={INK} />
      ))}
      <g fill={WOOL}>
        <ellipse cx={32} cy={24} rx={22} ry={14} />
        <circle cx={14} cy={20} r={9} />
        <circle cx={22} cy={12} r={9} />
        <circle cx={34} cy={10} r={10} />
        <circle cx={46} cy={14} r={9} />
        <circle cx={52} cy={24} r={8} />
        <circle cx={14} cy={28} r={8} />
      </g>
      <ellipse cx={56} cy={20} rx={7} ry={8} fill={INK} />
      <ellipse cx={50} cy={15} rx={4} ry={2} fill={INK} transform="rotate(-25 50 15)" />
      <circle cx={58} cy={18} r={1.2} fill={WOOL} />
    </g>
  )
}

function Cloud({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} className="fill-card">
      <ellipse cx={40} cy={24} rx={40} ry={14} />
      <circle cx={28} cy={16} r={14} />
      <circle cx={50} cy={12} r={16} />
    </g>
  )
}

type FlockSheep = { x: number; y: number; scale?: number; flip?: boolean }

// The first four stay inside the slice of the scene a phone shows; the last two only fit from `md` up.
const FLOCK: FlockSheep[] = [
  { x: 540, y: 178, scale: 1.2 },
  { x: 760, y: 190, flip: true },
  { x: 790, y: 203, scale: 0.7 },
  { x: 930, y: 183 },
  { x: 330, y: 180, flip: true },
  { x: 1110, y: 186, scale: 0.9 },
]
const MOBILE_FLOCK_SIZE = 4

function CountableSheep({
  sheep: { x, y, scale = 1, flip },
  number,
  hop,
  label,
  onCount,
}: {
  sheep: FlockSheep
  number: number
  hop: number
  label: string
  onCount: () => void
}) {
  const direction = flip ? -1 : 1
  return (
    <g
      transform={`translate(${x} ${y})`}
      role="button"
      tabIndex={0}
      aria-label={label}
      aria-pressed={number > 0}
      onClick={onCount}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return
        event.preventDefault()
        onCount()
      }}
      className="group focus-visible:outline-ring cursor-pointer outline-offset-4 focus-visible:outline-2"
    >
      {/* Padded hit area: the smallest sheep is only ~25px wide on a phone. */}
      <rect
        x={flip ? -78 * scale : -12 * scale}
        y={-24 * scale}
        width={90 * scale}
        height={78 * scale}
        fill="transparent"
      />
      <g key={hop} className={cn(hop > 0 && "motion-safe:animate-hop")}>
        <g className="transition-transform group-hover:-translate-y-1">
          <Sheep x={0} y={0} scale={scale} flip={flip} />
        </g>
        {number > 0 && (
          <text
            x={direction * 33 * scale}
            y={-8 * scale}
            textAnchor="middle"
            fontSize={18 * scale}
            className="fill-foreground font-bold"
            aria-hidden
          >
            {number}
          </text>
        )}
      </g>
    </g>
  )
}

/**
 * Rolling pasture with a small flock; clicking a sheep counts it. The front hill is
 * `fill-card` so it blends into a `bg-card` section below.
 */
export function PastureScene({ className }: { className?: string }) {
  const { t } = useTranslation("landing")
  const isMobile = useIsMobile()
  const flock = isMobile ? FLOCK.slice(0, MOBILE_FLOCK_SIZE) : FLOCK
  // Indexes into FLOCK, in the order they were counted.
  const [counted, setCounted] = useState<number[]>([])
  const [hops, setHops] = useState<Record<number, number>>({})
  const count = counted.filter((index) => index < flock.length).length
  const done = count === flock.length

  function countSheep(index: number) {
    const next = counted.includes(index) ? counted : [...counted, index]
    setCounted(next)
    // The last sheep counted sets the whole flock hopping.
    const hopping = flock.every((_, i) => next.includes(i)) ? flock.map((_, i) => i) : [index]
    setHops((prev) => ({
      ...prev,
      ...Object.fromEntries(hopping.map((i) => [i, (prev[i] ?? 0) + 1])),
    }))
  }

  return (
    <div className="relative">
      <svg
        viewBox="0 0 1440 320"
        preserveAspectRatio="xMidYMax slice"
        className={cn("block w-full", className)}
      >
        <g aria-hidden>
          <circle cx={1010} cy={135} r={58} className="fill-warning/20" />
          <circle cx={1010} cy={135} r={40} className="fill-warning/60" />
          <g className="motion-safe:animate-drift">
            <Cloud x={470} y={100} />
            <Cloud x={1210} y={92} scale={1.2} />
            <Cloud x={170} y={120} scale={0.8} />
          </g>
          <path
            d="M0 220 C240 120 480 140 720 200 C960 260 1200 150 1440 190 V320 H0Z"
            className="fill-primary/15"
          />
          <path
            d="M0 260 C300 170 560 250 800 230 C1040 210 1240 240 1440 210 V320 H0Z"
            className="fill-primary/35"
          />
        </g>
        {flock.map((sheep, index) => (
          <CountableSheep
            key={index}
            sheep={sheep}
            number={counted.filter((i) => i < flock.length).indexOf(index) + 1}
            hop={hops[index] ?? 0}
            label={t("pasture.sheep", { number: index + 1 })}
            onCount={() => countSheep(index)}
          />
        ))}
        <path
          d="M0 290 C360 230 720 300 1080 270 C1260 255 1380 270 1440 280 V320 H0Z"
          className="fill-card pointer-events-none"
          aria-hidden
        />
      </svg>
      <p
        role="status"
        className={cn(
          "bg-card absolute top-0 left-1/2 -translate-x-1/2 rounded-full border px-3 py-1 text-sm font-medium whitespace-nowrap shadow-sm",
          count === 0 && "sr-only",
        )}
      >
        {count === 0
          ? ""
          : done
            ? t("pasture.done", { count })
            : t("pasture.progress", { count, total: flock.length })}
      </p>
    </div>
  )
}

/** A bush big enough for one sheep to hide behind. */
export function Bush({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 96 64" className={className} aria-hidden>
      <g className="fill-primary/60">
        <ellipse cx={48} cy={46} rx={46} ry={18} />
        <circle cx={24} cy={34} r={18} />
        <circle cx={48} cy={24} r={22} />
        <circle cx={72} cy={34} r={18} />
      </g>
      <g className="fill-primary/80">
        <circle cx={36} cy={44} r={14} />
        <circle cx={62} cy={46} r={12} />
      </g>
    </svg>
  )
}

/** Hill silhouettes with one sheep, for placing at the bottom of a coloured card. */
export function HillsFooter({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1440 160"
      preserveAspectRatio="xMidYMax slice"
      className={cn("block w-full", className)}
      aria-hidden
    >
      <path
        d="M0 90 C300 20 600 110 900 70 C1140 40 1300 80 1440 50 V160 H0Z"
        fill="white"
        opacity={0.12}
      />
      <path
        d="M0 130 C360 70 760 150 1100 110 C1260 92 1380 110 1440 120 V160 H0Z"
        fill="white"
        opacity={0.16}
      />
      <Sheep x={640} y={78} />
      <Sheep x={800} y={86} scale={0.7} flip />
    </svg>
  )
}

export function LoneSheep({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 66 44" className={className} aria-hidden>
      <Sheep x={0} y={0} />
    </svg>
  )
}
