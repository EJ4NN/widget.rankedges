import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { PoweredBy } from "@/components/widget/brand"
import { MAIN_SITE_URL } from "@/lib/site"

export function LandingFooter({ logoUrl }: { logoUrl?: string | null }) {
  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto max-w-6xl px-4 py-14">
        <div className="glass-strong flex flex-col items-center gap-5 rounded-2xl px-6 py-10 text-center">
          <h2 className="text-balance font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Ready to prove your edge?
          </h2>
          <p className="max-w-md text-pretty leading-relaxed text-muted-foreground">
            Join the RankEdges Trading Arena and compete in the next live contest.
          </p>
          <Link
            href={MAIN_SITE_URL}
            className="inline-flex items-center gap-2 rounded bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-px glow-primary"
          >
            Go to RankEdges
            <ArrowUpRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>

        <div className="mt-10 flex flex-col items-center gap-3">
          <PoweredBy logoUrl={logoUrl} />
          <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
            Trading involves risk. Past performance is not indicative of future results.
          </p>
        </div>
      </div>
    </footer>
  )
}
