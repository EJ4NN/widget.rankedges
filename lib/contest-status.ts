import type { Contest } from "@/lib/db/schema"

export type ContestStatus = "upcoming" | "live" | "ended"

/**
 * Derives a contest's effective status from its start/end dates so the
 * lifecycle transitions automatically without any cron job. An admin can still
 * force a contest closed early by setting its stored status to "ended".
 */
export function effectiveContestStatus(
  c: Pick<Contest, "status" | "startDate" | "endDate">,
  now: Date = new Date(),
): ContestStatus {
  // Admin override: a manually ended contest stays ended.
  if (c.status === "ended") return "ended"

  const start = c.startDate ? new Date(c.startDate) : null
  const end = c.endDate ? new Date(c.endDate) : null

  if (end && now > end) return "ended"
  if (start && now < start) return "upcoming"
  return "live"
}

/** Returns the contest with its `status` normalized to the effective value. */
export function withEffectiveStatus<
  T extends Pick<Contest, "status" | "startDate" | "endDate">,
>(c: T, now: Date = new Date()): T {
  return { ...c, status: effectiveContestStatus(c, now) }
}
