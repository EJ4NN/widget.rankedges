/**
 * AIMSCAP Ranking API adapter (https://api.aimsrankedge.com).
 *
 * Unlike MetaAPI (which provisions one account per participant and pulls each
 * account's metrics individually), AIMSranking is a *bulk* source: you sign in
 * for a JWT, then request the full contestant record for a competition date
 * range and match each contestant to our participants by MT4 ID.
 *
 * Flow:
 *   1. POST /api/apiSignIn { username, password } -> { token }  (JWT, 1h TTL)
 *   2. POST /api/request_contestant_record (Bearer <token>)
 *        { competitionFromDate, competitionToDate, resultFromDate, resultToDate }
 *        (dates as "yyyy-MM-dd HH:mm:ss")
 *      -> [{ competitionName, contestantData: [{ MT4ID, Gain, Equity, ... }] }]
 *      (an ARRAY of competitions, each with its own contestant list)
 *
 * Everything is optional: if the credentials are not set the app still works,
 * contests using this source just report "not configured" on sync.
 *
 * Env:
 *   AIMSRANKING_API_USERNAME  (required for live data)
 *   AIMSRANKING_API_PASSWORD  (required for live data)
 *   AIMSRANKING_API_BASE      (optional) — defaults to https://api.aimsrankedge.com
 */

const BASE = (process.env.AIMSRANKING_API_BASE || "https://api.aimsrankedge.com").replace(/\/$/, "")
const USERNAME = process.env.AIMSRANKING_API_USERNAME
const PASSWORD = process.env.AIMSRANKING_API_PASSWORD

export function isAimsRankingConfigured() {
  return Boolean(USERNAME && PASSWORD)
}

/** Metrics for a single contestant, normalized to our participant shape. */
export type AimsMetrics = {
  mt4Id: string
  fullName: string
  competitionName: string
  batchTitle: string | null
  balance: number
  equity: number
  gain: number // percent
  drawdown: number // percent
  deposits: number
  withdrawals: number
  floating: number
  profit: number
  lots: number
  resultDate: string | null
  /**
   * True only when AIMS has posted actual trading results for this contestant.
   * When a trader is registered but results aren't live yet, AIMS returns "-"
   * for balance/equity/gain/profitLoss (only deposits/withdrawals are known).
   * In that state we must NOT compute a gain (equity 0 - deposit = bogus
   * -100%); the sync treats `hasResult: false` as pending.
   */
  hasResult: boolean
}

/* --------------------------- JWT token caching --------------------------- */
// The JWT lasts 1 hour; cache it in module memory and refresh a little early.
let cachedToken: string | null = null
let cachedExpiry = 0
const TOKEN_TTL_MS = 55 * 60 * 1000 // refresh at 55 min to stay under the 1h limit

async function signIn(): Promise<string> {
  if (!USERNAME || !PASSWORD) throw new Error("AIMSRANKING credentials are not configured")

  if (cachedToken && Date.now() < cachedExpiry) return cachedToken

  const res = await fetch(`${BASE}/api/apiSignIn`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "*/*" },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
    cache: "no-store",
  })

  const text = await res.text()
  let json: Record<string, unknown> = {}
  try {
    json = JSON.parse(text) as Record<string, unknown>
  } catch {
    throw new Error(`AIMSranking sign-in returned non-JSON (${res.status})`)
  }

  // The API answers HTTP 200 even on failure: { status: "0", exceptionMessage }.
  const token = (json.token ?? json.Token ?? json.jwt) as string | undefined
  if (!token) {
    const msg = (json.exceptionMessage as string) || (json.message as string) || "sign-in failed"
    throw new Error(`AIMSranking sign-in failed: ${msg}`)
  }

  cachedToken = token
  cachedExpiry = Date.now() + TOKEN_TTL_MS
  return token
}

/* ------------------------------ Helpers ------------------------------ */
// Numeric fields arrive as strings that may carry "%", "$", or thousands commas.
function num(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0
  if (typeof v !== "string") return 0
  const cleaned = v.replace(/[^0-9.-]/g, "")
  const n = Number.parseFloat(cleaned)
  return Number.isFinite(n) ? n : 0
}

function str(v: unknown): string {
  return v == null ? "" : String(v)
}

// yyyy-MM-dd HH:mm:ss in UTC, the format the API documents.
function fmtDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(
    d.getUTCMinutes(),
  )}:${p(d.getUTCSeconds())}`
}

/** One row of contestantData, mapped to our normalized metrics. */
function mapContestant(c: Record<string, unknown>, competitionName: string): AimsMetrics | null {
  // The API's actual JSON casing (mT4ID, profitLoss, totalDeposit, lotSize...)
  // differs from the documented PascalCase, so match keys case-insensitively.
  const lower: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(c)) lower[k.toLowerCase()] = v
  const get = (...names: string[]) => {
    for (const n of names) {
      const v = lower[n.toLowerCase()]
      if (v != null) return v
    }
    return undefined
  }

  const mt4Id = str(get("mt4id", "mt4 id")).trim()
  if (!mt4Id) return null

  // A value is a "real" result only if it parses to a finite number — AIMS uses
  // "-" (or blank) as a placeholder before results are posted.
  const hasNum = (...names: string[]) => {
    const v = get(...names)
    if (v == null) return false
    if (typeof v === "number") return Number.isFinite(v)
    const cleaned = String(v).replace(/[^0-9.-]/g, "")
    return cleaned !== "" && cleaned !== "-" && Number.isFinite(Number.parseFloat(cleaned))
  }
  // Results are live once any of the traded-performance fields is a real number.
  // Deposits/withdrawals alone don't count — a registered-but-not-started trader
  // has those but no equity/gain yet.
  const hasResult =
    hasNum("equity") || hasNum("balance") || hasNum("gain") || hasNum("profitloss")

  return {
    mt4Id,
    fullName: str(get("fullname")),
    competitionName,
    batchTitle: str(get("batchtitle")) || null,
    balance: num(get("balance")),
    equity: num(get("equity")),
    gain: num(get("gain")),
    drawdown: num(get("drawdown")),
    deposits: num(get("totaldeposit")),
    withdrawals: num(get("totalwithdrawal")),
    floating: num(get("floating")),
    profit: num(get("profitloss")),
    lots: num(get("lotsize")),
    resultDate: str(get("resultdate")) || null,
    hasResult,
  }
}

/**
 * Fetch contestant records for a competition/result date range and return them
 * keyed by MT4 ID for O(1) matching against our participants.
 *
 * The API returns an ARRAY of competitions; we flatten every competition's
 * `contestantData` into one map. When the same MT4 ID appears more than once
 * (multiple result snapshots), the latest `resultDate` wins.
 */
export async function fetchContestantMetrics(range: {
  competitionFrom: Date
  competitionTo: Date
  resultFrom: Date
  resultTo: Date
  /** Optional: only keep contestants from a competition whose name matches. */
  competitionName?: string
}): Promise<{
  competitions: string[]
  byMt4Id: Map<string, AimsMetrics>
  /** Total contestant rows the feed returned, before MT4-ID parsing. If this is
   *  > 0 but byMt4Id is empty, the API likely changed its field names. */
  rawContestantCount: number
}> {
  const token = await signIn()

  const res = await fetch(`${BASE}/api/request_contestant_record`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "*/*",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      competitionFromDate: fmtDate(range.competitionFrom),
      competitionToDate: fmtDate(range.competitionTo),
      resultFromDate: fmtDate(range.resultFrom),
      resultToDate: fmtDate(range.resultTo),
    }),
    cache: "no-store",
  })

  const text = await res.text()
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error(`AIMSranking contestant request returned non-JSON (${res.status})`)
  }

  // Error responses come back as a single object with an exceptionMessage.
  if (!Array.isArray(parsed) && parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>
    const msg = String(obj.exceptionMessage ?? "")
    // "No competition data found" just means the window matched nothing — treat
    // it as an empty result so the sync marks everyone pending instead of erroring.
    if (msg && /no competition data/i.test(msg)) {
      return { competitions: [], byMt4Id: new Map(), rawContestantCount: 0 }
    }
    if (obj.exceptionMessage) {
      throw new Error(`AIMSranking contestant request failed: ${msg}`)
    }
  }

  const competitions = Array.isArray(parsed) ? (parsed as Record<string, unknown>[]) : []
  const wanted = range.competitionName?.trim().toLowerCase()

  const byMt4Id = new Map<string, AimsMetrics>()
  const names: string[] = []
  let rawContestantCount = 0
  for (const comp of competitions) {
    const competitionName = str(comp.competitionName)
    names.push(competitionName)
    if (wanted && competitionName.trim().toLowerCase() !== wanted) continue

    const list = (comp.contestantData ?? comp.ContestantData ?? []) as Record<string, unknown>[]
    for (const c of Array.isArray(list) ? list : []) {
      rawContestantCount++
      const m = mapContestant(c, competitionName)
      if (!m) continue
      const prev = byMt4Id.get(m.mt4Id)
      // Keep the most recent snapshot when duplicates exist.
      if (!prev || (m.resultDate ?? "") >= (prev.resultDate ?? "")) {
        byMt4Id.set(m.mt4Id, m)
      }
    }
  }

  return { competitions: names, byMt4Id, rawContestantCount }
}
