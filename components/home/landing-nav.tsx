import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { BrandLogo } from "@/components/widget/brand"
import { MAIN_SITE_URL } from "@/lib/site"

export function LandingNav({ logoUrl, coBrandUrl }: { logoUrl?: string | null; coBrandUrl?: string | null }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 glass-strong">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <BrandLogo logoUrl={logoUrl} coBrandUrl={coBrandUrl} />

        <nav className="flex items-center gap-2 sm:gap-3">
          <Link
            href="#contests"
            className="hidden rounded px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
          >
            Contests
          </Link>
          <Link
            href={MAIN_SITE_URL}
            className="inline-flex items-center gap-1.5 rounded bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-px"
          >
            Visit RankEdges
            <ArrowUpRight className="h-4 w-4" aria-hidden />
          </Link>
        </nav>
      </div>
    </header>
  )
}
