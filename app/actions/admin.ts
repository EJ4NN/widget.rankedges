"use server"

import { db } from "@/lib/db"
import { brokerServer, contest, participant, batch, setting } from "@/lib/db/schema"
import { requireAdmin } from "@/lib/get-session"
import { and, asc, desc, eq, ne } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { getAccountMetrics, isMetaApiConfigured, provisionAccount } from "@/lib/metaapi"
import { isAimsRankingConfigured, fetchContestantMetrics, type AimsMetrics } from "@/lib/aimsranking"
import { put } from "@vercel/blob"
import { resolveColumns, type LeaderboardColumns } from "@/lib/leaderboard-columns"
import { normalizeWinnerType } from "@/lib/winner-type"
import { resolveBatchForDate } from "@/lib/batch-phase"

/* ------------------------------- Uploads -------------------------------- */

export async function uploadImage(formData: FormData) {
  await requireAdmin()
  const file = formData.get("file")
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false as const, error: "No file provided" }
  }
  if (!file.type.startsWith("image/")) {
    return { ok: false as const, error: "File must be an image" }
  }
  if (file.size > 8 * 1024 * 1024) {
    return { ok: false as const, error: "Image must be under 8MB" }
  }

  const ext = file.name.split(".").pop() || "png"
  const key = `contests/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const blob = await put(key, file, { access: "public" })
  return { ok: true as const, url: blob.url }
}

/* ------------------------------- Branding ------------------------------- */

export async function getBranding() {
  const row = (await db.select().from(setting).where(eq(setting.id, 1)).limit(1))[0]
  return { logoUrl: row?.logoUrl ?? null, coBrandUrl: row?.coBrandUrl ?? null }
}

export async function updateBranding(formData: FormData) {
  await requireAdmin()
  const logoUrl = String(formData.get("logoUrl") || "").trim() || null
  const coBrandUrl = String(formData.get("coBrandUrl") || "").trim() || null

  await db
    .insert(setting)
    .values({ id: 1, logoUrl, coBrandUrl, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: setting.id,
      set: { logoUrl, coBrandUrl, updatedAt: new Date() },
    })

  // Branding shows on every widget/landing surface.
  revalidatePath("/", "layout")
  return { ok: true as const }
}

/* ------------------------------- Contests ------------------------------- */

export async function listContests() {
  await requireAdmin()
  return db.select().from(contest).orderBy(desc(contest.createdAt))
}

function slugify(s: string) {
  return s
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "")
  }

// Only accept known data sources; anything else falls back to the MetaAPI default.
function normalizeDataSource(v: FormDataEntryValue | null): "metaapi" | "aimsranking" {
  return String(v) === "aimsranking" ? "aimsranking" : "metaapi"
}

export async function createContest(formData: FormData) {
  await requireAdmin()
  const name = String(formData.get("name") || "").trim()
  const description = String(formData.get("description") || "").trim()
  const rules = String(formData.get("rules") || "").trim()
  const prizePool = String(formData.get("prizePool") || "").trim()
  const startingBalance = String(formData.get("startingBalance") || "10000")
  const startDate = String(formData.get("startDate") || "")
  const endDate = String(formData.get("endDate") || "")
  const timeZone = String(formData.get("timeZone") || "").trim()
  const maxParticipants = String(formData.get("maxParticipants") || "")
  const posterUrl = String(formData.get("posterUrl") || "").trim()
  const thumbnailUrl = String(formData.get("thumbnailUrl") || "").trim()
  const sponsorLogoUrl = String(formData.get("sponsorLogoUrl") || "").trim()
  const allowedBrokers = formData.getAll("allowedBrokers").map((b) => String(b)).filter(Boolean)
  const dataSource = normalizeDataSource(formData.get("dataSource"))

  if (!name || !startDate || !endDate) {
    return { ok: false as const, error: "Name, start date and end date are required" }
  }

  const slugInput = String(formData.get("slug") || "").trim()
  let slug = slugify(slugInput || name) || slugify(name)
  const existing = await db.select({ id: contest.id }).from(contest).where(eq(contest.slug, slug)).limit(1)
  if (existing.length) slug = `${slug}-${Date.now().toString(36)}`

  await db.insert(contest).values({
    slug,
    name,
    description: description || null,
    rules: rules || null,
    prizePool: prizePool || null,
    startingBalance,
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    timeZone: timeZone || null,
    maxParticipants: maxParticipants ? Number(maxParticipants) : null,
    posterUrl: posterUrl || null,
    thumbnailUrl: thumbnailUrl || null,
    sponsorLogoUrl: sponsorLogoUrl || null,
    allowedBrokers: allowedBrokers.length ? allowedBrokers : null,
    dataSource,
    status: "upcoming",
  })

  revalidatePath("/admin")
  return { ok: true as const, slug }
}

export async function updateContest(id: number, formData: FormData) {
  await requireAdmin()
  const name = String(formData.get("name") || "").trim()
  const description = String(formData.get("description") || "").trim()
  const rules = String(formData.get("rules") || "").trim()
  const prizePool = String(formData.get("prizePool") || "").trim()
  const startingBalance = String(formData.get("startingBalance") || "10000")
  const startDate = String(formData.get("startDate") || "")
  const endDate = String(formData.get("endDate") || "")
  const timeZone = String(formData.get("timeZone") || "").trim()
  const slugInput = String(formData.get("slug") || "").trim()
  const maxParticipants = String(formData.get("maxParticipants") || "")
  const posterUrl = String(formData.get("posterUrl") || "").trim()
  const thumbnailUrl = String(formData.get("thumbnailUrl") || "").trim()
  const sponsorLogoUrl = String(formData.get("sponsorLogoUrl") || "").trim()
  const allowedBrokers = formData.getAll("allowedBrokers").map((b) => String(b)).filter(Boolean)
  const dataSource = normalizeDataSource(formData.get("dataSource"))

  if (!name || !startDate || !endDate) {
    return { ok: false as const, error: "Name, start date and end date are required" }
  }

  // Slug: use the admin-provided value (or fall back to the name), normalized.
  // Ensure it stays unique across other contests.
  let slug = slugify(slugInput || name)
  if (!slug) slug = slugify(name)
  const slugClash = await db
    .select({ id: contest.id })
    .from(contest)
    .where(and(eq(contest.slug, slug), ne(contest.id, id)))
    .limit(1)
  if (slugClash.length) {
    return { ok: false as const, error: `The URL slug "${slug}" is already used by another contest.` }
  }

  await db
    .update(contest)
    .set({
      slug,
      name,
      description: description || null,
      rules: rules || null,
      prizePool: prizePool || null,
      startingBalance,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      timeZone: timeZone || null,
      maxParticipants: maxParticipants ? Number(maxParticipants) : null,
      posterUrl: posterUrl || null,
      thumbnailUrl: thumbnailUrl || null,
      sponsorLogoUrl: sponsorLogoUrl || null,
      allowedBrokers: allowedBrokers.length ? allowedBrokers : null,
      dataSource,
    })
    .where(eq(contest.id, id))

  revalidatePath("/admin")
  revalidatePath(`/admin/contests/${id}`)
  return { ok: true as const }
}

export async function updateContestStatus(id: number, status: string) {
  await requireAdmin()
  await db.update(contest).set({ status }).where(eq(contest.id, id))
  revalidatePath("/admin")
}

export async function updateLeaderboardColumns(id: number, columns: LeaderboardColumns) {
  await requireAdmin()
  // Normalize to a clean boolean map so only known keys are persisted.
  const clean = resolveColumns(columns)
  await db.update(contest).set({ leaderboardColumns: clean }).where(eq(contest.id, id))
  revalidatePath("/admin")
  revalidatePath(`/admin/contests/${id}`)
  return { ok: true as const }
}

export async function deleteContest(id: number) {
  await requireAdmin()
  await db.delete(participant).where(eq(participant.contestId, id))
  await db.delete(batch).where(eq(batch.contestId, id))
  await db.delete(contest).where(eq(contest.id, id))
  revalidatePath("/admin")
}

/* -------------------------------- Batches ------------------------------- */

export async function listBatches(contestId: number) {
  await requireAdmin()
  return db
    .select()
    .from(batch)
    .where(eq(batch.contestId, contestId))
    .orderBy(asc(batch.sortOrder), asc(batch.startDate))
}

export async function createBatch(contestId: number, formData: FormData) {
  await requireAdmin()
  const name = String(formData.get("name") || "").trim()
  const startDate = String(formData.get("startDate") || "")
  const endDate = String(formData.get("endDate") || "")
  const prizePool = String(formData.get("prizePool") || "").trim()
  const winnerType = normalizeWinnerType(formData.get("winnerType"))
  const advanceCount = Number(formData.get("advanceCount") || 0)

  if (!name || !startDate || !endDate) {
    return { ok: false as const, error: "Name, start date and end date are required" }
  }

  // Append after the current last batch.
  const existing = await db.select({ sortOrder: batch.sortOrder }).from(batch).where(eq(batch.contestId, contestId))
  const nextOrder = existing.reduce((max, b) => Math.max(max, b.sortOrder), -1) + 1

  await db.insert(batch).values({
    contestId,
    name,
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    prizePool: prizePool || null,
    winnerType,
    advanceCount: Number.isFinite(advanceCount) ? Math.max(0, advanceCount) : 0,
    sortOrder: nextOrder,
  })

  revalidatePath("/admin")
  revalidatePath(`/admin/contests/${contestId}`)
  return { ok: true as const }
}


export async function updateBatch(id: number, formData: FormData) {
  await requireAdmin()
  const name = String(formData.get("name") || "").trim()
  const startDate = String(formData.get("startDate") || "")
  const endDate = String(formData.get("endDate") || "")
  const prizePool = String(formData.get("prizePool") || "").trim()
  const winnerType = normalizeWinnerType(formData.get("winnerType"))
  const advanceCount = Number(formData.get("advanceCount") || 0)

  if (!name || !startDate || !endDate) {
    return { ok: false as const, error: "Name, start date and end date are required" }
  }

  const row = (await db.select().from(batch).where(eq(batch.id, id)).limit(1))[0]
  if (!row) return { ok: false as const, error: "Batch not found" }

  await db
    .update(batch)
    .set({
      name,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      prizePool: prizePool || null,
      winnerType,
      advanceCount: Number.isFinite(advanceCount) ? Math.max(0, advanceCount) : 0,
    })
    .where(eq(batch.id, id))

  revalidatePath("/admin")
  revalidatePath(`/admin/contests/${row.contestId}`)
  return { ok: true as const }
}

export async function deleteBatch(id: number) {
  await requireAdmin()
  const row = (await db.select().from(batch).where(eq(batch.id, id)).limit(1))[0]
  if (!row) return { ok: false as const }
  // Unassign participants from this batch, then remove it.
  await db.update(participant).set({ batchId: null }).where(eq(participant.batchId, id))
  await db.delete(batch).where(eq(batch.id, id))
  revalidatePath("/admin")
  revalidatePath(`/admin/contests/${row.contestId}`)
  return { ok: true as const }
}

export async function setParticipantBatch(participantId: number, batchId: number | null) {
  await requireAdmin()
  await db.update(participant).set({ batchId }).where(eq(participant.id, participantId))
  revalidatePath("/admin")
  return { ok: true as const }
}

/* -------------------------------- Servers ------------------------------- */

export async function listServers() {
  await requireAdmin()
  return db.select().from(brokerServer).orderBy(desc(brokerServer.createdAt))
}

export async function createServer(formData: FormData) {
  await requireAdmin()
  const name = String(formData.get("name") || "").trim()
  const platform = String(formData.get("platform") || "").trim()
  const company = String(formData.get("company") || "").trim()
  if (!name || !platform) return { ok: false as const, error: "Name and platform are required" }

  await db.insert(brokerServer).values({ name, platform, company: company || null })
  revalidatePath("/admin")
  return { ok: true as const }
}

export async function deleteServer(id: number) {
  await requireAdmin()
  await db.delete(brokerServer).where(eq(brokerServer.id, id))
  revalidatePath("/admin")
}

/* ----------------------------- Participants ----------------------------- */

export async function listParticipants(contestId: number) {
  await requireAdmin()
  return db
    .select()
    .from(participant)
    .where(eq(participant.contestId, contestId))
    .orderBy(desc(participant.createdAt))
}

export async function addParticipant(contestId: number, formData: FormData) {
  await requireAdmin()

  const nickname = String(formData.get("nickname") || "").trim()
  const realName = String(formData.get("realName") || "").trim()
  const email = String(formData.get("email") || "").trim()
  const platform = String(formData.get("platform") || "").trim() as "mt4" | "mt5"
  const serverName = String(formData.get("serverName") || "").trim()
  const accountLogin = String(formData.get("accountLogin") || "").trim()
  const investorPassword = String(formData.get("investorPassword") || "").trim()
  // Optional per-participant data source: "" (inherit contest), "metaapi", "aimsranking".
  const dataSourceInput = String(formData.get("dataSource") || "").trim()
  const dataSource = dataSourceInput === "metaapi" || dataSourceInput === "aimsranking" ? dataSourceInput : null

  if (!nickname || !realName || !platform || !serverName || !accountLogin || !investorPassword) {
    return { ok: false as const, error: "All fields except email are required" }
  }
  if (platform !== "mt4" && platform !== "mt5") {
    return { ok: false as const, error: "Platform must be MT4 or MT5" }
  }

  const c = (await db.select().from(contest).where(eq(contest.id, contestId)).limit(1))[0]
  if (!c) return { ok: false as const, error: "Contest not found" }

  // Which source this trader will actually sync from (override wins over contest default).
  const effectiveSource = dataSource ?? c.dataSource

  // Auto-assign to the batch whose active period covers now (admins can move
  // participants between batches later from the participants table).
  const contestBatches = await db.select().from(batch).where(eq(batch.contestId, contestId))
  const batchId = resolveBatchForDate(contestBatches)?.id ?? null

  // Prevent registering the same trading account twice in this contest.
  const dupe = await db
    .select({ id: participant.id })
    .from(participant)
    .where(and(eq(participant.contestId, contestId), eq(participant.accountLogin, accountLogin)))
    .limit(1)
  if (dupe.length) {
    return { ok: false as const, error: "This trading account is already registered" }
  }

  // Best-effort provisioning on MetaAPI so live stats can sync right away.
  // AIMS-sourced participants are matched by MT4 ID against the AIMS feed and
  // never touch MetaAPI, so we skip provisioning for them entirely.
  let metaApiAccountId: string | null = null
  if (effectiveSource !== "aimsranking" && isMetaApiConfigured()) {
    try {
      metaApiAccountId = await provisionAccount({
        name: `${c.slug}-${nickname}`,
        login: accountLogin,
        password: investorPassword,
        server: serverName,
        platform,
      })
    } catch (e) {
      console.log("[v0] admin add participant — provision failed:", (e as Error).message)
    }
  }

  await db.insert(participant).values({
    contestId,
    batchId,
    nickname,
    realName,
    email: email || null,
    platform,
    dataSource,
    serverName,
    accountLogin,
    investorPassword,
    metaApiAccountId,
    status: "active",
    startingBalance: c.startingBalance,
  })

  revalidatePath("/admin")
  revalidatePath(`/admin/contests/${contestId}`)
  return {
    ok: true as const,
    provisioned: Boolean(metaApiAccountId),
    source: effectiveSource === "aimsranking" ? ("aimsranking" as const) : ("metaapi" as const),
  }
}

/** Change a single participant's data source (null = inherit contest default). */
export async function setParticipantDataSource(id: number, source: "metaapi" | "aimsranking" | null) {
  await requireAdmin()
  await db.update(participant).set({ dataSource: source }).where(eq(participant.id, id))
  revalidatePath("/admin")
  return { ok: true as const }
}

export async function setParticipantStatus(id: number, status: string) {
  await requireAdmin()
  await db.update(participant).set({ status }).where(eq(participant.id, id))
  revalidatePath("/admin")
}

export async function deleteParticipant(id: number) {
  await requireAdmin()
  await db.delete(participant).where(eq(participant.id, id))
  revalidatePath("/admin")
}

/**
 * Pull live metrics from MetaAPI for every participant of a contest that has a
 * provisioned MetaAPI account, and recompute profit / profit %.
 */
export async function syncContest(contestId: number, participantIds?: number[]) {
  await requireAdmin()

  const c = (await db.select().from(contest).where(eq(contest.id, contestId)).limit(1))[0]
  if (!c) return { ok: false as const, synced: 0, error: "Contest not found" }

  // When participantIds is provided, only sync those rows; otherwise sync all.
  const allRows = await db.select().from(participant).where(eq(participant.contestId, contestId))
  const idSet = participantIds && participantIds.length > 0 ? new Set(participantIds) : null
  const rows = idSet ? allRows.filter((p) => idSet.has(p.id)) : allRows

  // Each participant can override the contest's data source. Partition the rows
  // so AIMS-sourced traders are matched against the AIMS feed while the rest go
  // through MetaAPI provisioning — both in a single sync run.
  const aimsRows = rows.filter((p) => (p.dataSource ?? c.dataSource) === "aimsranking")
  const metaRows = rows.filter((p) => (p.dataSource ?? c.dataSource) !== "aimsranking")

  let synced = 0
  let pending = 0
  // The most relevant provisioning failure, surfaced to the admin so a
  // "cannot sync" is explained instead of silently counted as pending.
  let provisionError: string | null = null

  // --- AIMS Ranking participants (bulk fetch, matched by MT4 ID) ---
  if (aimsRows.length > 0) {
    const r = await syncViaAimsRanking(contestId, c, aimsRows)
    if (!r.ok) {
      // If there are no MetaAPI rows to fall back on, surface the AIMS error
      // directly; otherwise carry it as a warning so the MetaAPI sync still runs.
      if (metaRows.length === 0) return r
      provisionError = r.error
    } else {
      synced += r.synced
      pending += r.pending ?? 0
      if (r.warning) provisionError = r.warning
    }
  }

  // --- MetaAPI participants ---
  if (metaRows.length === 0) {
    revalidatePath("/admin")
    revalidatePath(`/admin/contests/${contestId}`)
    return { ok: true as const, synced, pending, warning: provisionError ?? undefined }
  }

  if (!isMetaApiConfigured()) {
    // No MetaAPI token: if we already synced AIMS rows, report partial success.
    if (aimsRows.length > 0) {
      revalidatePath("/admin")
      revalidatePath(`/admin/contests/${contestId}`)
      return {
        ok: true as const,
        synced,
        pending: pending + metaRows.length,
        warning: "METAAPI_TOKEN is not configured — MetaAPI participants were skipped.",
      }
    }
    return { ok: false as const, synced: 0, error: "METAAPI_TOKEN is not configured" }
  }

  for (const p of metaRows) {
    // Provision on MetaAPI if we don't have an account id yet (e.g. joined
    // before the token was set, or broker detection was still in progress).
    let accountId = p.metaApiAccountId
    if (!accountId) {
      try {
        accountId = await provisionAccount({
          name: `c${contestId}-${p.nickname}`,
          login: p.accountLogin,
          password: p.investorPassword,
          server: p.serverName ?? "",
          platform: (p.platform as "mt4" | "mt5") ?? "mt5",
        })
        await db.update(participant).set({ metaApiAccountId: accountId }).where(eq(participant.id, p.id))
      } catch (e) {
        const msg = (e as Error).message
        console.log("[v0] provision during sync failed:", msg)
        // Translate MetaAPI's raw errors into something an admin can act on.
        provisionError = /E_RESOURCE_SLOTS|resource slots/i.test(msg)
          ? "MetaAPI account limit reached — your MetaAPI plan has no free account slots. Remove an unused connected account or upgrade your MetaAPI subscription to add more."
          : /failed to authenticate|invalid account|account disabled|invalid.*password/i.test(msg)
            ? `Broker rejected the login for account ${p.accountLogin}. Check the login, investor password and server name.`
            : /\.srv file|server .* not found|check the server name/i.test(msg)
              ? `Server name for account ${p.accountLogin} is not recognized by MetaAPI. Check the exact MT4/MT5 server name.`
              : `MetaAPI could not connect account ${p.accountLogin}: ${msg}`
        pending++
        continue
      }
    }

    const metrics = await getAccountMetrics(accountId)
    if (!metrics) {
      // Account is provisioned but metrics aren't ready yet (still connecting).
      pending++
      continue
    }

    const starting = Number(p.startingBalance ?? 0) || Number(metrics.deposits) || 0
    const equity = metrics.equity
    const profit = starting > 0 ? equity - starting : metrics.profit
    const profitPct = starting > 0 ? (profit / starting) * 100 : 0
    // RankEdges gain: profit relative to deposits only (withdrawals excluded).
    const deposits = Number(metrics.deposits) || 0
    const rankEdgesGain = deposits > 0 ? (metrics.profit / deposits) * 100 : 0

    await db
      .update(participant)
      .set({
        currentBalance: String(metrics.balance),
        currentEquity: String(equity),
        profit: String(profit),
        profitPct: String(profitPct),
        gain: String(metrics.gain),
        absoluteGain: String(metrics.absoluteGain),
        rankEdgesGain: String(rankEdgesGain),
        lots: String(metrics.lots),
        maxDrawdown: String(metrics.maxDrawdown),
        deposits: String(metrics.deposits),
        withdrawals: String(metrics.withdrawals),
        trades: metrics.trades,
        winRate: String(metrics.winRate),
        status: p.status === "pending" ? "active" : p.status,
        lastSyncedAt: new Date(),
      })
      .where(eq(participant.id, p.id))
    synced++
  }

  revalidatePath("/admin")
  revalidatePath(`/admin/contests/${contestId}`)
  return { ok: true as const, synced, pending, warning: provisionError ?? undefined }
}

/**
 * Sync a contest whose data source is the AIMSCAP Ranking API. One bulk request
 * returns every contestant for the competition date range; we match each of our
 * participants by MT4 ID (= accountLogin) and update their metrics. No account
 * provisioning is involved.
 */
async function syncViaAimsRanking(
  contestId: number,
  c: typeof contest.$inferSelect,
  rows: (typeof participant.$inferSelect)[],
) {
  if (!isAimsRankingConfigured()) {
    return {
      ok: false as const,
      synced: 0,
      error: "AIMSRANKING_API_USERNAME / AIMSRANKING_API_PASSWORD are not configured",
    }
  }

  // The AIMS competition's own date range rarely lines up with our contest
  // dates (its competition may end days/weeks after ours), and AIMS timestamps
  // run ahead of UTC. Since we match purely by MT4 ID, use a generous window so
  // date/timezone misalignment can never exclude an uploaded contestant. Our
  // adapter keeps the latest result snapshot per MT4 ID.
  const now = new Date()
  const DAY = 24 * 60 * 60 * 1000
  const start = new Date(c.startDate)
  const lower = new Date(Math.min(start.getTime(), now.getTime()) - 365 * DAY)
  const upper = new Date(now.getTime() + 365 * DAY)

  let byMt4Id: Map<string, AimsMetrics>
  let rawContestantCount = 0
  try {
    const res = await fetchContestantMetrics({
      competitionFrom: lower,
      competitionTo: upper,
      resultFrom: lower,
      resultTo: upper,
    })
    byMt4Id = res.byMt4Id
    rawContestantCount = res.rawContestantCount
  } catch (e) {
    console.log("[v0] AIMSranking fetch failed:", (e as Error).message)
    return { ok: false as const, synced: 0, error: `AIMS Ranking sync failed: ${(e as Error).message}` }
  }

  // The feed returned contestant rows but none had a readable MT4 ID — a strong
  // sign the API changed its field names. Surface this clearly instead of
  // silently marking everyone "not in feed yet".
  if (rawContestantCount > 0 && byMt4Id.size === 0) {
    return {
      ok: false as const,
      synced: 0,
      error:
        "AIMS Ranking returned data in an unexpected format (no MT4 IDs found). The API may have changed — contact support.",
    }
  }

  let synced = 0
  let pending = 0
  for (const p of rows) {
    const m = byMt4Id.get(p.accountLogin.trim())
    if (!m) {
      // Contestant not found in the AIMS feed yet (not approved / no results).
      pending++
      continue
    }
    if (!m.hasResult) {
      // Registered in AIMS but results aren't live yet (balance/equity/gain are
      // "-"). Writing them would produce a bogus -100% gain, so leave pending
      // until AIMS posts real trading results.
      pending++
      continue
    }

    // RankEdges gain: profit relative to total deposit only, ignoring
    // withdrawals. profit comes from the AIMS ProfitLoss field (fallback to
    // equity - deposit if not provided). If there's no deposit, gain is 0.
    const profit = m.profit || m.equity - m.deposits
    const rankEdgesGain = m.deposits > 0 ? (profit / m.deposits) * 100 : 0

    await db
      .update(participant)
      .set({
        currentBalance: String(m.balance),
        currentEquity: String(m.equity),
        profit: String(profit),
        profitPct: String(rankEdgesGain),
        // RankEdges gain is our own metric (profit / deposit) and lives in its
        // own column. `gain` keeps the raw figure AIMS reports; `absoluteGain`
        // isn't provided by AIMS so it stays 0. Admin picks the ranking metric.
        rankEdgesGain: String(rankEdgesGain),
        gain: String(m.gain),
        absoluteGain: "0",
        lots: String(m.lots),
        maxDrawdown: String(m.drawdown),
        deposits: String(m.deposits),
        withdrawals: String(m.withdrawals),
        status: p.status === "pending" ? "active" : p.status,
        lastSyncedAt: new Date(),
      })
      .where(eq(participant.id, p.id))
    synced++
  }

  revalidatePath("/admin")
  revalidatePath(`/admin/contests/${contestId}`)
  return { ok: true as const, synced, pending, warning: undefined as string | undefined }
}
