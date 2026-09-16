import Link from "next/link"
import { ArrowRight } from "lucide-react"

type MockRow = {
  rank: number
  name: string
  lots: string
  dd: string
  tier: string
  gain: string
  positive: boolean
}

const MOCK_ROWS: MockRow[] = [
  { rank: 1, name: "ghost_pips", lots: "42.5", dd: "6.1", tier: "S", gain: "+184.2", positive: true },
  { rank: 2, name: "kl.scalper", lots: "61.2", dd: "9.4", tier: "S", gain: "+151.8", positive: true },
  { rank: 3, name: "nord_edge", lots: "33.9", dd: "4.8", tier: "A", gain: "+129.6", positive: true },
  { rank: 4, name: "trm_fx", lots: "22.1", dd: "18.2", tier: "B", gain: "-12.3", positive: false },
  { rank: 5, name: "vega.raid", lots: "28.4", dd: "7.7", tier: "A", gain: "+96.4", positive: true },
]

const SIGNALS = [
  { term: "Sync", value: "MT4 / MT5 auto-sync" },
  { term: "Updates", value: "Real-time updates" },
  { term: "Access", value: "Invite-only control" },
]

export function LandingHero() {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 pb-16 pt-16 sm:pt-24 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-10">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/70" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
              </span>
              Live season
            </span>
            <span className="inline-flex items-center rounded-full border border-border bg-card/50 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              Ranked · MT4 / MT5
            </span>
          </div>

          <h1 className="mt-6 text-balance font-display text-5xl font-bold uppercase leading-[0.98] tracking-tight text-foreground sm:text-6xl">
            Trade live.
            <br />
            <span className="text-gradient-primary">Climb the board.</span>
            <br />
            Own the arena.
          </h1>

          <p className="mt-6 max-w-xl text-pretty leading-relaxed text-muted-foreground">
            RankEdges runs live MT4/MT5 trading contests with a real-time leaderboard — connect your
            account, trade your strategy against the field, and rise the ranks for prizes and bragging
            rights.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="#contests"
              className="inline-flex items-center gap-2 rounded bg-primary px-6 py-3 text-sm font-semibold uppercase tracking-wide text-primary-foreground transition-transform hover:-translate-y-px glow-primary"
            >
              Join a contest
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              href="#how"
              className="inline-flex items-center gap-2 rounded border border-border px-6 py-3 text-sm font-semibold uppercase tracking-wide text-foreground transition-colors hover:border-primary/40 hover:text-primary"
            >
              How it works
            </Link>
          </div>

          <dl className="mt-10 flex flex-wrap gap-x-8 gap-y-3">
            {SIGNALS.map((s) => (
              <div key={s.term} className="flex flex-col">
                <dt className="sr-only">{s.term}</dt>
                <dd className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  {s.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <HeroLeaderboard />
      </div>
    </section>
  )
}

function HeroLeaderboard() {
  return (
    <div className="glass-strong relative rounded-2xl p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <span className="eyebrow-mono">Live standings</span>
        <span className="font-mono text-[11px] font-medium text-muted-foreground">Arena #0142</span>
      </div>

      <ul className="mt-4 flex flex-col gap-2">
        {MOCK_ROWS.map((r) => (
          <li
            key={r.rank}
            className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/40 px-3 py-2.5"
          >
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded font-mono text-xs font-bold ${
                r.rank === 1
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {r.rank}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-mono text-sm font-medium text-foreground">{r.name}</p>
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {r.lots} lots · DD {r.dd}%
              </p>
            </div>
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-border bg-card font-mono text-[10px] font-bold text-muted-foreground">
              {r.tier}
            </span>
            <span
              className={`w-16 shrink-0 text-right font-mono text-sm font-bold ${
                r.positive ? "text-primary" : "text-destructive"
              }`}
            >
              {r.gain}%
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          Synced via MT4 / MT5
        </span>
        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
          Updated 2s ago
        </span>
      </div>
    </div>
  )
}
