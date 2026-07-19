export type LeaderboardColumns = {
  gain: boolean
  absoluteGain: boolean
  lots: boolean
  equity: boolean
  deposits: boolean
  withdrawals: boolean
  drawdown: boolean
  realName: boolean
  account: boolean
}

// What the public leaderboard shows out of the box. Private identity fields
// (realName, account) default to OFF so nothing sensitive leaks unless an
// admin explicitly opts in.
export const DEFAULT_LEADERBOARD_COLUMNS: LeaderboardColumns = {
  gain: true,
  absoluteGain: true,
  lots: true,
  equity: true,
  deposits: true,
  withdrawals: true,
  drawdown: true,
  realName: false,
  account: false,
}

// Numeric stat columns rendered in the standings table / podium, in display order.
export const NUMERIC_COLUMN_KEYS = [
  "gain",
  "absoluteGain",
  "lots",
  "equity",
  "deposits",
  "withdrawals",
  "drawdown",
] as const

export type NumericColumnKey = (typeof NUMERIC_COLUMN_KEYS)[number]

export const COLUMN_LABELS: Record<keyof LeaderboardColumns, string> = {
  gain: "Gain",
  absoluteGain: "Abs. Gain",
  lots: "Lots",
  equity: "Equity",
  deposits: "Deposits",
  withdrawals: "Withdrawals",
  drawdown: "Drawdown",
  realName: "Real name",
  account: "Account no.",
}

// Merge a stored (possibly partial / null) config with defaults so older
// contests without the column still render correctly.
export function resolveColumns(stored: Partial<LeaderboardColumns> | null | undefined): LeaderboardColumns {
  return { ...DEFAULT_LEADERBOARD_COLUMNS, ...(stored ?? {}) }
}
