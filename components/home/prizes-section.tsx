import { Crown, Medal, Award } from "lucide-react"

const TIERS = [
  {
    rank: "1st",
    icon: Crown,
    title: "Arena champion",
    body: "Top prize pool payout, champion badge, and permanent arena hall-of-fame slot.",
    highlight: true,
  },
  {
    rank: "2nd–3rd",
    icon: Medal,
    title: "Podium finish",
    body: "Runner-up prize share plus podium badge visible across future contests.",
    highlight: false,
  },
  {
    rank: "Top 10",
    icon: Award,
    title: "Ranked finish",
    body: "Ranked-finish recognition and priority invites into the next arena season.",
    highlight: false,
  },
]

export function PrizesSection() {
  return (
    <section id="prizes" className="scroll-mt-20 border-y border-border/50 bg-card/30">
      <div className="mx-auto max-w-6xl px-4 py-16">
        <div className="max-w-2xl">
          <p className="eyebrow-mono">Why compete</p>
          <h2 className="mt-3 text-balance font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Rank matters. Prizes follow.
          </h2>
          <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">
            Every arena pays out by rank, not luck. Gain, drawdown, and lots are scored the same way
            for every competitor, so the leaderboard is the only scoreboard that matters — and it&apos;s
            visible to everyone, live.
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {TIERS.map((t) => (
            <div
              key={t.rank}
              className={`glass rounded-xl p-6 ${t.highlight ? "glow-primary border-primary/30" : ""}`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded ${
                    t.highlight ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}
                >
                  <t.icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="font-mono text-sm font-bold uppercase tracking-wider text-primary">
                  {t.rank}
                </span>
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold text-foreground">{t.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
