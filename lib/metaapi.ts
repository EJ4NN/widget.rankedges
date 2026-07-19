/**
 * Thin MetaAPI REST wrapper.
 *
 * MetaAPI (https://metaapi.cloud) lets us connect a real MT4/MT5 account using
 * only the read-only *investor* password and read account metrics. We use two
 * of its REST APIs:
 *   - Provisioning API -> create / deploy a MetaTrader account (GLOBAL host)
 *   - MetaStats API    -> read account metrics (REGION-specific host)
 *
 * Everything is optional: if METAAPI_TOKEN is not set the app still works, it
 * just keeps participants "pending" with no live metrics.
 *
 * Env:
 *   METAAPI_TOKEN   (required for live data) — MetaAPI auth token
 *   METAAPI_REGION  (optional) — deploy region, default "singapore"
 */

const TOKEN = process.env.METAAPI_TOKEN

// MetaAPI deploy regions. The MetaStats host is region-agnostic in practice
// (the new-york host serves metrics for accounts in any region), so we validate
// the configured region and fall back to a known-good default when it is unset
// or invalid (e.g. an account id pasted into the env by mistake).
const VALID_REGIONS = [
  "new-york",
  "london",
  "singapore",
  "sydney",
  "tokyo",
  "mumbai",
  "sao-paulo",
]
const rawRegion = (process.env.METAAPI_REGION || "").trim().toLowerCase()
const REGION = VALID_REGIONS.includes(rawRegion) ? rawRegion : "new-york"

// Provisioning API is served from a single global host (region goes in the body).
const PROVISIONING_BASE = "https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai"

export function isMetaApiConfigured() {
  return Boolean(TOKEN)
}

/** 32-char hex transaction id required by the create-account endpoint. */
function transactionId() {
  let s = ""
  while (s.length < 32) s += Math.random().toString(16).slice(2)
  return s.slice(0, 32)
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

type ProvisionInput = {
  name: string
  login: string
  password: string // investor password (read-only)
  server: string
  platform: "mt4" | "mt5"
}

/**
 * Create + deploy a MetaTrader account on MetaAPI. Returns the MetaAPI account
 * id which we persist so we can pull metrics later.
 *
 * Broker-settings detection can take time; the API answers 202 while it works.
 * We reuse the same transaction id and poll a few times before giving up so the
 * caller can register the participant as "pending" and retry later.
 */
export async function provisionAccount(input: ProvisionInput): Promise<string> {
  if (!TOKEN) throw new Error("METAAPI_TOKEN is not configured")

  const txId = transactionId()
  const body = JSON.stringify({
    name: input.name,
    type: "cloud-g2",
    login: input.login,
    password: input.password,
    server: input.server,
    platform: input.platform,
    magic: 0,
    region: REGION,
    reliability: "high",
    metastatsApiEnabled: true,
  })

  let accountId: string | null = null
  // Up to 3 attempts (~ up to ~12s) to let broker settings detection finish.
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`${PROVISIONING_BASE}/users/current/accounts`, {
      method: "POST",
      headers: {
        "auth-token": TOKEN,
        "transaction-id": txId,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body,
    })

    if (res.status === 201) {
      const data = (await res.json()) as { id: string; state?: string }
      accountId = data.id
      break
    }

    // 202 => broker settings detection in progress, retry with same txId.
    if (res.status === 202) {
      await sleep(4000)
      continue
    }

    const text = await res.text()
    throw new Error(`MetaAPI provisioning failed (${res.status}): ${text}`)
  }

  if (!accountId) {
    throw new Error("MetaAPI provisioning still in progress; retry the sync shortly")
  }

  // Ensure the account is deployed (ignored if already deployed).
  await deployAccount(accountId)
  return accountId
}

/** Start the API server + terminal for an account. No-op if already deployed. */
export async function deployAccount(accountId: string): Promise<void> {
  if (!TOKEN) return
  await fetch(`${PROVISIONING_BASE}/users/current/accounts/${accountId}/deploy`, {
    method: "POST",
    headers: {
      "auth-token": TOKEN,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  })
}

export type AccountMetrics = {
  balance: number
  equity: number
  profit: number
  gain: number // percent return (time-weighted)
  absoluteGain: number // percent absolute gain
  lots: number // total traded volume
  deposits: number
  withdrawals: number
  maxDrawdown: number // percent
  trades: number
  winRate: number // percent
}

type RawMetrics = {
  balance?: number
  equity?: number
  profit?: number
  gain?: number
  absoluteGain?: number
  lots?: number
  deposits?: number
  withdrawals?: number
  maxDrawdown?: number
  trades?: number
  wonTradesPercent?: number
}

// MetaStats hosts are effectively region-agnostic, but some regional hosts can
// be flaky or unreachable (e.g. singapore fails to resolve, london returns 504
// intermittently). Try the configured region first, then fall back to a known
// reliable host so live data keeps flowing regardless of the region setting.
const METASTATS_HOSTS = Array.from(
  new Set([
    `https://metastats-api-v1.${REGION}.agiliumtrade.ai`,
    "https://metastats-api-v1.new-york.agiliumtrade.ai",
    "https://metastats-api-v1.london.agiliumtrade.ai",
  ]),
)

/** Fetch live metrics for a provisioned MetaAPI account. */
export async function getAccountMetrics(accountId: string): Promise<AccountMetrics | null> {
  if (!TOKEN) return null

  let res: Response | null = null
  for (const host of METASTATS_HOSTS) {
    try {
      const r = await fetch(
        `${host}/users/current/accounts/${accountId}/metrics?includeOpenPositions=true`,
        {
          headers: { "auth-token": TOKEN, Accept: "application/json" },
          cache: "no-store",
        },
      )
      if (r.ok) {
        res = r
        break
      }
      // 4xx (e.g. account not found) won't be fixed by another host — stop early.
      if (r.status >= 400 && r.status < 500) return null
    } catch (e) {
      console.log(`[v0] metastats host failed (${host}):`, (e as Error).message)
    }
  }

  if (!res) return null

  // REST wraps metrics as { metrics: {...} }; be tolerant of a bare object too.
  const json = (await res.json()) as { metrics?: RawMetrics } & RawMetrics
  const m: RawMetrics | undefined = json.metrics ?? json
  if (!m || m.balance === undefined) return null

  return {
    balance: m.balance ?? 0,
    equity: m.equity ?? m.balance ?? 0,
    profit: m.profit ?? 0,
    gain: m.gain ?? 0,
    absoluteGain: m.absoluteGain ?? 0,
    lots: m.lots ?? 0,
    deposits: Math.abs(m.deposits ?? 0),
    // MetaStats returns withdrawals as a negative number; store as positive.
    withdrawals: Math.abs(m.withdrawals ?? 0),
    maxDrawdown: m.maxDrawdown ?? 0,
    trades: m.trades ?? 0,
    winRate: m.wonTradesPercent ?? 0,
  }
}
