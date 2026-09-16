import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { PoweredBy } from "@/components/widget/brand"
import { MAIN_SITE_URL } from "@/lib/site"

const FOOTER_LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#contests", label: "Contests" },
  { href: "#prizes", label: "Prizes" },
  { href: "#faq", label: "FAQ" },
]

export function LandingFooter({ logoUrl }: { logoUrl?: string | null }) {
  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto max-w-6xl px-4 py-16">
        {/* Final CTA */}
        <div className="glass-strong flex flex-col items-center gap-5 rounded-2xl px-6 py-12 text-center">
          <p className="eyebrow-mono">Ready when you are</p>
          <h2 className="text-balance font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Step into the arena and start climbing
          </h2>
          <p className="max-w-md text-pretty leading-relaxed text-muted-foreground">
            Connect your MT4/MT5 account and get placed on a live leaderboard in minutes.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="#contests"
              className="inline-flex items-center gap-2 rounded bg-primary px-6 py-3 text-sm font-semibold uppercase tracking-wide text-primary-foreground transition-transform hover:-translate-y-px glow-primary"
            >
              Join a contest
              <ArrowUpRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              href={MAIN_SITE_URL}
              className="inline-flex items-center gap-2 rounded border border-border px-6 py-3 text-sm font-semibold uppercase tracking-wide text-foreground transition-colors hover:border-primary/40 hover:text-primary"
            >
              Explore RankEdges
            </Link>
          </div>
        </div>

        {/* Footer body */}
        <div className="mt-12 flex flex-col gap-8 border-t border-border/50 pt-10 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-sm">
            <p className="font-display text-lg font-bold text-foreground">
              Rank<span className="text-primary">Edges</span>
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              The live trading arena for forex traders — real-time leaderboards, MT4/MT5 auto-sync,
              and embeddable contest widgets for brokers and partners.
            </p>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2">
            {FOOTER_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-10 flex flex-col items-center gap-3">
          <PoweredBy logoUrl={logoUrl} />
          <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
            © {new Date().getFullYear()} RankEdges. Trading involves risk. Past performance is not
            indicative of future results.
          </p>
        </div>
      </div>
    </footer>
  )
}
