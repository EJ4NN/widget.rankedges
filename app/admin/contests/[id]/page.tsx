import Link from "next/link"
import { notFound } from "next/navigation"
import { db } from "@/lib/db"
import { contest, brokerServer } from "@/lib/db/schema"
import { asc, eq } from "drizzle-orm"
import { requireAdmin } from "@/lib/get-session"
import { listParticipants, listBatches } from "@/app/actions/admin"
import { ParticipantsTable } from "@/components/admin/participants-table"
import { EmbedSnippet } from "@/components/admin/embed-snippet"
import { LeaderboardColumnsCard } from "@/components/admin/leaderboard-columns-card"
import { BatchesCard } from "@/components/admin/batches-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { isMetaApiConfigured } from "@/lib/metaapi"
import { formatDate } from "@/lib/format"
import { ArrowLeft, ExternalLink } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function AdminContestPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireAdmin()
  const { id } = await params
  const contestId = Number(id)
  if (Number.isNaN(contestId)) notFound()

  const c = (await db.select().from(contest).where(eq(contest.id, contestId)).limit(1))[0]
  if (!c) notFound()

  const participants = await listParticipants(contestId)
  const batches = await listBatches(contestId)
  const servers = await db.select().from(brokerServer).orderBy(asc(brokerServer.name))

  return (
    <div>
      <Link
        href="/admin"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to dashboard
      </Link>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{c.name}</h1>
            <Badge variant="outline" className="uppercase">
              {c.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {formatDate(c.startDate)} – {formatDate(c.endDate)}
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          nativeButton={false}
          render={<Link href={`/contests/${c.slug}`} target="_blank" />}
        >
          View public page <ExternalLink className="ml-1.5 h-4 w-4" />
        </Button>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <EmbedSnippet slug={c.slug} />
        <LeaderboardColumnsCard contestId={contestId} initial={c.leaderboardColumns} />
      </div>

      <div className="mb-6">
        <BatchesCard contestId={contestId} batches={batches} />
      </div>

      <ParticipantsTable
        contestId={contestId}
        participants={participants}
        metaApiConfigured={isMetaApiConfigured()}
        batches={batches.map((b) => ({ id: b.id, name: b.name }))}
        servers={servers.map((s) => ({
          id: s.id,
          name: s.name,
          company: s.company,
          platform: s.platform,
        }))}
      />
    </div>
  )
}
