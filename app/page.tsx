import { db } from "@/lib/db"
import { contest } from "@/lib/db/schema"
import { desc } from "drizzle-orm"
import { getBranding } from "@/app/actions/admin"
import { withEffectiveStatus } from "@/lib/contest-status"
import { LandingNav } from "@/components/home/landing-nav"
import { LandingHero } from "@/components/home/landing-hero"
import { ContestMenu, type MenuContest } from "@/components/home/contest-menu"
import { HowItWorks } from "@/components/home/how-it-works"
import { LandingFooter } from "@/components/home/landing-footer"

export const dynamic = "force-dynamic"

export default async function HomePage() {
  const rows = await db.select().from(contest).orderBy(desc(contest.createdAt))
  const contests = rows.map((c) => withEffectiveStatus(c))
  const branding = await getBranding()

  const menuContests: MenuContest[] = contests.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    status: c.status,
    startDate: c.startDate,
    endDate: c.endDate,
    timeZone: c.timeZone,
    startingBalance: c.startingBalance,
    prizePool: c.prizePool,
    thumbnailUrl: c.thumbnailUrl,
  }))

  const liveCount = contests.filter((c) => c.status === "live").length
  const stats = [
    { value: String(liveCount), label: liveCount === 1 ? "Live contest" : "Live contests" },
    { value: String(contests.length), label: "Total contests" },
    { value: "MT4 / MT5", label: "Platforms" },
  ]

  return (
    <main className="relative z-10 min-h-svh">
      <LandingNav logoUrl={branding.logoUrl} coBrandUrl={branding.coBrandUrl} />
      <LandingHero stats={stats} />
      <ContestMenu contests={menuContests} />
      <HowItWorks />
      <LandingFooter logoUrl={branding.logoUrl} />
    </main>
  )
}
