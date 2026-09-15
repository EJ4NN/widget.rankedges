import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { formatDate, formatMoney } from "@/lib/format"
import { mainSiteContestUrl } from "@/lib/site"

export type MenuContest = {
  id: number
  slug: string
  name: string
  status: string
  startDate: Date
  endDate: Date
  timeZone: string | null
  startingBalance: string
  prizePool: string | null
  thumbnailUrl: string | null
}

function statusRank(status: string) {
  if (status === "live") return 0
  if (status === "upcoming") return 1
  return 2
}

export function ContestMenu({ contests }: { contests: MenuContest[] }) {
  const ordered = [...contests].sort((a, b) => {
    const s = statusRank(a.status) - statusRank(b.status)
    if (s !== 0) return s
    // Live/upcoming: soonest first. Ended: most recent first.
    return a.status === "ended"
      ? b.endDate.getTime() - a.endDate.getTime()
      : a.startDate.getTime() - b.startDate.getTime()
  })

  return (
    <section id="contests" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16">
      <div className="flex flex-col gap-2 text-center">
        <p className="eyebrow-mono">The Arena</p>
        <h2 className="text-balance font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Choose your contest
        </h2>
        <p className="mx-auto mt-1 max-w-xl text-pretty leading-relaxed text-muted-foreground">
          Live rankings sync automatically from every entrant&apos;s trading account. Tap a contest
          to open it on RankEdges.
        </p>
      </div>

      {ordered.length === 0 ? (
        <div className="mt-10 rounded-xl border border-border bg-card p-10 text-center">
          <p className="font-medium text-foreground">No contests yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Check back soon for the next season.</p>
        </div>
      ) : (
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {ordered.map((c) => (
            <Link
              key={c.id}
              href={mainSiteContestUrl(c.slug)}
              className="group glass glass-hover flex flex-col overflow-hidden rounded-xl"
            >
              <div className="relative aspect-video w-full overflow-hidden bg-muted/20">
                {c.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.thumbnailUrl || "/placeholder.svg"}
                    alt={`${c.name} banner`}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <span className="font-display text-2xl font-bold text-muted-foreground/50">
                      {c.name}
                    </span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent" />
                <div className="absolute left-3 top-3">
                  <Badge
                    variant={c.status === "live" ? "default" : "outline"}
                    className={
                      c.status === "live"
                        ? "bg-primary text-primary-foreground"
                        : "border-border/70 bg-background/60 backdrop-blur"
                    }
                  >
                    {c.status === "live" ? (
                      <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-primary-foreground" aria-hidden />
                    ) : null}
                    {c.status}
                  </Badge>
                </div>
              </div>

              <div className="flex flex-1 flex-col p-5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display text-lg font-semibold leading-tight text-foreground">
                    {c.name}
                  </h3>
                  <ArrowUpRight
                    className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-all group-hover:text-primary group-hover:-translate-y-px group-hover:translate-x-px"
                    aria-hidden
                  />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatDate(c.startDate, c.timeZone)} – {formatDate(c.endDate, c.timeZone)}
                </p>

                <div className="mt-4 flex items-end justify-between gap-3 border-t border-border/50 pt-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Starting</p>
                    <p className="font-mono text-sm font-medium text-foreground">
                      {formatMoney(c.startingBalance)}
                    </p>
                  </div>
                  {c.prizePool ? (
                    <div className="text-right">
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Prize pool</p>
                      <p className="font-mono text-sm font-medium text-primary">{c.prizePool}</p>
                    </div>
                  ) : null}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
