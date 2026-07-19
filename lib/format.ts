export function formatMoney(value: string | number | null | undefined) {
  const n = Number(value ?? 0)
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function formatPct(value: string | number | null | undefined) {
  const n = Number(value ?? 0)
  const sign = n > 0 ? "+" : ""
  return `${sign}${n.toFixed(2)}%`
}

/** Plain percentage without a forced +/- sign (for drawdown, win rate, etc.) */
export function formatPctPlain(value: string | number | null | undefined) {
  const n = Number(value ?? 0)
  return `${n.toFixed(2)}%`
}

/** Compact money, e.g. $12.4K, for tight leaderboard cells. */
export function formatMoneyCompact(value: string | number | null | undefined) {
  const n = Number(value ?? 0)
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  })
}

/** Format traded volume in lots, e.g. 190.91 or 1.2K for large values. */
export function formatLots(value: string | number | null | undefined) {
  const n = Number(value ?? 0)
  if (Math.abs(n) >= 10000) {
    return n.toLocaleString("en-US", { notation: "compact", maximumFractionDigits: 1 })
  }
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Format a date for an <input type="datetime-local"> value (local time, no seconds). */
export function toDateTimeLocal(d: Date | string | null | undefined) {
  if (!d) return ""
  const date = new Date(d)
  if (Number.isNaN(date.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function formatDate(d: Date | string | null | undefined) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

/**
 * Format a calendar date in UTC so server and client render identically
 * (avoids hydration mismatches for date-only values like batch periods).
 */
export function formatDateUTC(d: Date | string | null | undefined) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })
}

export function formatDateTime(d: Date | string | null | undefined) {
  if (!d) return "—"
  return new Date(d).toLocaleString("en-US", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}
