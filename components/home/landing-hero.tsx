import Link from "next/link"
import { ArrowRight, ArrowUpRight } from "lucide-react"
import { MAIN_SITE_URL } from "@/lib/site"

type Stat = { value: string; label: string }

export function LandingHero({ stats }: { stats: Stat[] }) {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto max-w-6xl px-4 pb-16 pt-20 sm:pt-28">
        <div className="mx-auto max-w-3xl text-center">
          <p className="eyebrow-mono">RankEdges Trading Arena</p>
          <h1 className="mt-4 text-balance font-display text-5xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-6xl">
            Compete in{" "}
            <span className="text-gradient-primary">live trading contests</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-pretty leading-relaxed text-muted-foreground">
            Connect your MT4/MT5 account, trade your strategy, and climb a real-time leaderboard.
            Pick a contest below and prove your edge against traders across the region.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="#contests"
              className="inline-flex items-center gap-2 rounded bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-px glow-primary"
            >
              Browse contests
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              href={MAIN_SITE_URL}
              className="inline-flex items-center gap-2 rounded border border-border px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:border-primary/40 hover:text-primary"
            >
              Go to RankEdges
              <ArrowUpRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>

        <dl className="mx-auto mt-16 grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
          {stats.map((s) => (
            <div key={s.label} className="glass rounded-xl px-6 py-5 text-center">
              <dt className="sr-only">{s.label}</dt>
              <dd className="font-display text-3xl font-bold text-foreground">{s.value}</dd>
              <p className="mt-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {s.label}
              </p>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
