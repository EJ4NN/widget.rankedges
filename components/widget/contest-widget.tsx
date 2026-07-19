import { getContestBySlug, getLeaderboard, getParticipantCount, listBatches } from "@/app/actions/contest"
import { getBranding } from "@/app/actions/admin"
import { ContestHero } from "@/components/widget/contest-hero"
import { Leaderboard } from "@/components/widget/leaderboard"
import { BatchedLeaderboard, type BatchBlock } from "@/components/widget/batched-leaderboard"
import { BrandLogo, PoweredBy } from "@/components/widget/brand"
import { RulesContent } from "@/components/widget/rules-content"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { resolveColumns } from "@/lib/leaderboard-columns"
import { normalizeWinnerType } from "@/lib/winner-type"
import { isPublicBatch, getBatchPhase } from "@/lib/batch-phase"

export async function ContestWidget({ slug }: { slug: string }) {
  const contest = await getContestBySlug(slug)
  if (!contest) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <p className="font-medium text-foreground">Contest not found</p>
        <p className="mt-1 text-sm text-muted-foreground">
          This contest may have been removed or the link is incorrect.
        </p>
      </div>
    )
  }

  const columns = resolveColumns(contest.leaderboardColumns)
  const branding = await getBranding()
  // Public widget shows only previous + current batches; upcoming rounds stay hidden.
  const allBatches = await listBatches(contest.id)
  const batches = allBatches.filter((b) => isPublicBatch(b))
  const hasBatches = batches.length > 0

  const [rows, count, batchBlocks] = await Promise.all([
    // Overall leaderboard (used when the contest has no batches).
    hasBatches ? Promise.resolve([]) : getLeaderboard(contest.id, columns),
    getParticipantCount(contest.id),
    // One leaderboard per batch, each ranked by that batch's winning metric.
    hasBatches
      ? Promise.all(
          batches.map(async (b): Promise<BatchBlock> => {
            const winnerType = normalizeWinnerType(b.winnerType)
            const batchRows = await getLeaderboard(contest.id, columns, { batchId: b.id, winnerType })
            return {
              id: b.id,
              name: b.name,
              startDate: b.startDate as unknown as string,
              endDate: b.endDate as unknown as string,
              prizePool: b.prizePool,
              winnerType,
              advanceCount: b.advanceCount,
              phase: getBatchPhase(b),
              rows: batchRows,
            }
          }),
        )
      : Promise.resolve([] as BatchBlock[]),
  ])

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between border-b border-border/60 pb-4">
        <BrandLogo
          logoUrl={branding.logoUrl}
          coBrandUrl={contest.sponsorLogoUrl ?? branding.coBrandUrl}
        />
      </header>

      <ContestHero contest={contest} participantCount={count} />

      <Tabs defaultValue="leaderboard">
        <TabsList>
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
          <TabsTrigger value="rules">Rules</TabsTrigger>
        </TabsList>

        <TabsContent value="leaderboard" className="mt-4">
          {hasBatches ? (
            <BatchedLeaderboard batches={batchBlocks} columns={columns} />
          ) : (
            <Leaderboard rows={rows} columns={columns} />
          )}
        </TabsContent>

        <TabsContent value="rules" className="mt-4">
          <div className="glass rounded-xl p-6">
              {contest.rules ? (
                <RulesContent rules={contest.rules} />
              ) : (
              <p className="text-muted-foreground">No rules have been published for this contest.</p>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <footer className="flex flex-col items-center gap-2 border-t border-border/60 pt-5">
        <PoweredBy logoUrl={branding.logoUrl} />
        <p className="text-center text-[11px] text-muted-foreground">
          Trading involves risk. Past performance is not indicative of future results.
        </p>
      </footer>
    </div>
  )
}
