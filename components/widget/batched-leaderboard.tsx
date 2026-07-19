"use client"

import { useState, type ComponentProps } from "react"
import { Leaderboard } from "@/components/widget/leaderboard"
import { cn } from "@/lib/utils"
import { formatDateUTC } from "@/lib/format"
import { WINNER_TYPE_LABELS, type WinnerType } from "@/lib/winner-type"
import type { BatchPhase } from "@/lib/batch-phase"
import type { LeaderboardColumns } from "@/lib/leaderboard-columns"
import { CalendarDays, Trophy } from "lucide-react"

type Rows = ComponentProps<typeof Leaderboard>["rows"]

export type BatchBlock = {
  id: number
  name: string
  startDate: string
  endDate: string
  prizePool: string | null
  winnerType: WinnerType
  advanceCount: number
  phase: BatchPhase
  rows: Rows
}

const PHASE_LABELS: Record<BatchPhase, string> = {
  current: "Live now",
  previous: "Ended",
  upcoming: "Upcoming",
}

export function BatchedLeaderboard({
  batches,
  columns,
}: {
  batches: BatchBlock[]
  columns: LeaderboardColumns
}) {
  // Default to the batch that is currently live, else the most recent one.
  const defaultId = (batches.find((b) => b.phase === "current") ?? batches[batches.length - 1])?.id
  const [active, setActive] = useState(defaultId)
  const current = batches.find((b) => b.id === active) ?? batches[0]

  if (!current) return null

  return (
    <div className="flex flex-col gap-4">
      {/* Batch selector */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Contest batches">
        {batches.map((b) => (
          <button
            key={b.id}
            type="button"
            role="tab"
            aria-selected={b.id === current.id}
            onClick={() => setActive(b.id)}
            className={cn(
              "flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
              b.id === current.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-background/40 text-muted-foreground hover:text-foreground",
            )}
          >
            {b.name}
            {b.phase === "current" ? (
              <span className="flex h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
            ) : null}
          </button>
        ))}
      </div>

      {/* Active batch meta */}
      <div className="glass flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-2xl px-4 py-3 text-sm">
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px] font-semibold",
            current.phase === "current"
              ? "bg-primary/15 text-primary"
              : "bg-muted text-muted-foreground",
          )}
        >
          {PHASE_LABELS[current.phase]}
        </span>
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <CalendarDays className="h-4 w-4 text-primary" aria-hidden />
          {formatDateUTC(current.startDate)} – {formatDateUTC(current.endDate)}
        </span>
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Trophy className="h-4 w-4 text-primary" aria-hidden />
          Winner by {WINNER_TYPE_LABELS[current.winnerType]}
        </span>
        {current.prizePool ? (
          <span className="font-semibold text-foreground">{current.prizePool}</span>
        ) : null}
        {current.advanceCount ? (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
            Top {current.advanceCount} advance
          </span>
        ) : null}
      </div>

      <Leaderboard rows={current.rows} columns={columns} highlightKey={current.winnerType} />
    </div>
  )
}
