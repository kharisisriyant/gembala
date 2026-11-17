import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Bush, LoneSheep } from "@/components/landing-illustrations"
import { useAuth } from "@/lib/auth"
import { cn } from "@/lib/utils"

const BUSH_COUNT = 5

// Catch-all route: one sheep has wandered off and hides behind a random bush.
export function NotFoundPage() {
  const { t } = useTranslation("not-found")
  const { me } = useAuth()
  const [hidingPlace] = useState(() => Math.floor(Math.random() * BUSH_COUNT))
  const [searched, setSearched] = useState<number[]>([])
  const lastSearched = searched.at(-1)
  const found = searched.includes(hidingPlace)

  return (
    <main className="mx-auto flex min-h-svh max-w-xl flex-col items-center justify-center gap-6 p-4 text-center">
      <p className="text-primary text-6xl font-bold">404</p>
      <h1 className="text-2xl font-bold text-balance">{t("title")}</h1>
      <p className="text-muted-foreground text-balance">{t("body")}</p>
      <div className="flex flex-wrap items-end justify-center gap-2">
        {Array.from({ length: BUSH_COUNT }, (_, index) => {
          const isSearched = searched.includes(index)
          return (
            <button
              key={index}
              type="button"
              disabled={found || isSearched}
              aria-label={t("bush", { number: index + 1 })}
              onClick={() => setSearched((prev) => [...prev, index])}
              className="focus-visible:outline-ring flex h-20 w-20 items-end justify-center rounded-lg outline-offset-2 focus-visible:outline-2 enabled:cursor-pointer sm:w-24"
            >
              {isSearched && index === hidingPlace ? (
                <LoneSheep className="motion-safe:animate-hop mb-1 w-16" />
              ) : (
                <Bush
                  className={cn(
                    "w-full transition-opacity",
                    isSearched && "motion-safe:animate-rustle opacity-30",
                  )}
                />
              )}
            </button>
          )
        })}
      </div>
      <p role="status" className="min-h-6 font-medium">
        {found
          ? t("found")
          : lastSearched !== undefined && t("empty", { number: lastSearched + 1 })}
      </p>
      <Button asChild size="lg" variant={found ? "default" : "outline"}>
        <Link to={me ? "/dashboard" : "/"}>{t("home")}</Link>
      </Button>
    </main>
  )
}
