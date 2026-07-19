import Link from "next/link"
import { db } from "@/lib/db"
import { contest } from "@/lib/db/schema"
import { desc } from "drizzle-orm"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatDate, formatMoney } from "@/lib/format"
import { BrandLogo, PoweredBy } from "@/components/widget/brand"
import { getBranding } from "@/app/actions/admin"
import { withEffectiveStatus } from "@/lib/contest-status"
import { ArrowRight } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function HomePage() {
  const rows = await db.select().from(contest).orderBy(desc(contest.createdAt))
  const contests = rows.map((c) => withEffectiveStatus(c))
  const branding = await getBranding()

  return (
    <main className="min-h-svh bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <BrandLogo logoUrl={branding.logoUrl} coBrandUrl={branding.coBrandUrl} />
          <Button variant="secondary" size="sm" nativeButton={false} render={<Link href="/admin" />}>
            Admin
          </Button>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-4 py-12">
        <div className="max-w-2xl">
          <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Compete in live trading contests
          </h1>
          <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">
            Connect your MT4/MT5 account, trade your strategy, and climb a live leaderboard. Every
            contest is embeddable directly into the AIMS client portal.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {contests.length === 0 ? (
            <div className="col-span-full rounded-xl border border-border bg-card p-10 text-center">
              <p className="font-medium text-foreground">No contests yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Head to the admin dashboard to create your first contest.
              </p>
            </div>
          ) : (
            contests.map((c) => (
              <Link
                key={c.id}
                href={`/contests/${c.slug}`}
                className="group glass glass-hover overflow-hidden rounded-xl"
              >
                {c.thumbnailUrl && (
                  <div className="relative aspect-video w-full overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={c.thumbnailUrl || "/placeholder.svg"}
                      alt={`${c.name} thumbnail`}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-card/90 to-transparent" />
                  </div>
                )}
                <div className="p-5">
                <div className="mb-3 flex items-center justify-between">
                  <Badge
                    variant={c.status === "live" ? "default" : "outline"}
                    className={c.status === "live" ? "bg-primary text-primary-foreground" : ""}
                  >
                    {c.status}
                  </Badge>
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
                </div>
                <h2 className="text-lg font-semibold text-foreground">{c.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatDate(c.startDate)} – {formatDate(c.endDate)}
                </p>
                <p className="mt-3 font-mono text-sm text-foreground">
                  {formatMoney(c.startingBalance)}{" "}
                  <span className="text-muted-foreground">starting balance</span>
                </p>
                </div>
              </Link>
            ))
          )}
        </div>
      </section>

      <footer className="mx-auto flex max-w-5xl items-center justify-center border-t border-border/60 px-4 py-8">
        <PoweredBy logoUrl={branding.logoUrl} />
      </footer>
    </main>
  )
}
