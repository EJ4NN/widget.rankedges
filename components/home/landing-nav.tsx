import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { BrandLogo } from "@/components/widget/brand"

const NAV_LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#contests", label: "Contests" },
  { href: "#prizes", label: "Prizes" },
  { href: "#faq", label: "FAQ" },
]

export function LandingNav({ logoUrl, coBrandUrl }: { logoUrl?: string | null; coBrandUrl?: string | null }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 glass-strong">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <BrandLogo logoUrl={logoUrl} coBrandUrl={coBrandUrl} />

        <nav className="flex items-center gap-1 sm:gap-2">
          <div className="hidden items-center gap-1 md:flex">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {l.label}
              </Link>
            ))}
          </div>
          <Link
            href="#contests"
            className="inline-flex items-center gap-1.5 rounded bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-px"
          >
            Join a contest
            <ArrowUpRight className="h-4 w-4" aria-hidden />
          </Link>
        </nav>
      </div>
    </header>
  )
}
