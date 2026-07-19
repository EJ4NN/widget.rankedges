export const WINNER_TYPES = ["gain", "absoluteGain", "lots"] as const

export type WinnerType = (typeof WINNER_TYPES)[number]

export const WINNER_TYPE_LABELS: Record<WinnerType, string> = {
  gain: "Gain %",
  absoluteGain: "Absolute Gain %",
  lots: "Total Lots",
}

/** Short label for badges/chips. */
export const WINNER_TYPE_SHORT: Record<WinnerType, string> = {
  gain: "Gain",
  absoluteGain: "Abs. Gain",
  lots: "Lots",
}

export function isWinnerType(v: unknown): v is WinnerType {
  return typeof v === "string" && (WINNER_TYPES as readonly string[]).includes(v)
}

export function normalizeWinnerType(v: unknown): WinnerType {
  return isWinnerType(v) ? v : "gain"
}
