import { Badge } from "@/components/ui/badge"
import { Countdown } from "@/components/widget/countdown"
import { JoinDialog } from "@/components/widget/join-dialog"
import { formatDate, formatMoney } from "@/lib/format"
import type { Contest } from "@/lib/db/schema"
import { Calendar, Trophy, Users, Wallet } from "lucide-react"

function statusBadge(status: string) {
  switch (status) {
    case "live":
      return (
        <Badge className="bg-primary text-primary-foreground">
          <span className="mr-1.5 inline-block h-2 w-2 animate-pulse rounded-full bg-primary-foreground" />
          Live
        </Badge>
      )
    case "ended":
      return <Badge variant="secondary">Ended</Badge>
    default:
      return (
        <Badge variant="outline" className="border-accent text-accent">
          Upcoming
        </Badge>
      )
  }
}

export function ContestHero({
  contest,
  participantCount,
}: {
  contest: Contest
  participantCount: number
}) {
  const isEnded = contest.status === "ended"
  const countdownTarget = contest.status === "upcoming" ? contest.startDate : contest.endDate
  const countdownLabel = contest.status === "upcoming" ? "Starts in" : "Ends in"

  const stats = [
    { icon: Wallet, label: "Starting balance", value: formatMoney(contest.startingBalance) },
    { icon: Trophy, label: "Prize pool", value: contest.prizePool || "—" },
    { icon: Users, label: "Traders", value: String(participantCount) },
    {
      icon: Calendar,
      label: "Dates",
      value: `${formatDate(contest.startDate)} – ${formatDate(contest.endDate)}`,
    },
  ]

  return (
    <section className="relative overflow-hidden rounded-3xl border border-primary/25 bg-card shadow-[var(--shadow-glow)]">
      {contest.posterUrl && (
        <div className="relative w-full bg-card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={contest.posterUrl || "/placeholder.svg"}
            alt={`${contest.name} poster`}
            className="h-auto w-full object-contain"
          />
          {/* Top + bottom vignette so the full image blends into the card */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-card to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-card to-transparent" />
        </div>
      )}
      <div className={contest.posterUrl ? "p-6 pt-4 sm:p-8 sm:pt-5" : "p-6 sm:p-8"}>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <div className="mb-3 flex items-center gap-3">
            {statusBadge(contest.status)}
            <span className="eyebrow-mono">Trading Contest</span>
          </div>
          <h1 className="font-display text-balance text-3xl font-bold uppercase tracking-tight text-foreground sm:text-5xl">
            {contest.name}
          </h1>
          {contest.description && (
            <p className="mt-3 text-pretty leading-relaxed text-muted-foreground">
              {contest.description}
            </p>
          )}
        </div>

        {!isEnded && (
          <div className="shrink-0">
            <Countdown target={countdownTarget.toString()} label={countdownLabel} />
          </div>
        )}
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-secondary/40 p-4">
            <s.icon className="mb-2 h-4 w-4 text-primary" aria-hidden />
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</p>
            <p className="mt-1 font-mono text-lg font-semibold text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        <JoinDialog contestId={contest.id} contestSlug={contest.slug} disabled={isEnded} />
        {isEnded ? (
          <p className="text-sm text-muted-foreground">This contest has ended.</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Free to enter. Connect your MT4/MT5 account to compete.
          </p>
        )}
      </div>
      </div>
    </section>
  )
}
