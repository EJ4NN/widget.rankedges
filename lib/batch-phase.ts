export type BatchPhase = "previous" | "current" | "upcoming"

type DateInput = Date | string | number

function toTime(d: DateInput): number {
  return d instanceof Date ? d.getTime() : new Date(d).getTime()
}

/**
 * Where a batch sits relative to `now`:
 * - "current"  → now is within [startDate, endDate]
 * - "previous" → the batch has already ended
 * - "upcoming" → the batch hasn't started yet
 */
export function getBatchPhase(
  batch: { startDate: DateInput; endDate: DateInput },
  now: Date = new Date(),
): BatchPhase {
  const t = now.getTime()
  const start = toTime(batch.startDate)
  const end = toTime(batch.endDate)
  if (t < start) return "upcoming"
  if (t > end) return "previous"
  return "current"
}

/** Upcoming batches are hidden from the public widget until they start. */
export function isPublicBatch(
  batch: { startDate: DateInput; endDate: DateInput },
  now: Date = new Date(),
): boolean {
  return getBatchPhase(batch, now) !== "upcoming"
}

/**
 * Auto-assign a participant to the batch whose active period covers `now`.
 * If none is active (e.g. between rounds), fall back to the most recent batch
 * that has already started; returns null when there are no eligible batches.
 */
export function resolveBatchForDate<T extends { id: number; startDate: DateInput; endDate: DateInput }>(
  batches: T[],
  now: Date = new Date(),
): T | null {
  const started = batches.filter((b) => toTime(b.startDate) <= now.getTime())
  if (started.length === 0) return null
  const active = started.find((b) => toTime(b.endDate) >= now.getTime())
  if (active) return active
  // Otherwise the latest batch that has started.
  return started.reduce((latest, b) => (toTime(b.startDate) > toTime(latest.startDate) ? b : latest))
}
