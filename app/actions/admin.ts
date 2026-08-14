"use server"

import { db } from "@/lib/db"
import {
  brokerServer,
  contest,
  contestAssignment,
  participant,
  batch,
  setting,
  user as userTable,
  type MetricSnapshot,
  type SourceKey,
} from "@/lib/db/schema"
import { requireAdmin } from "@/lib/get-session"
import {
  assertCanManageContest,
  getAccessibleContestIds,
  getCurrentAdmin,
  requireMaster,
} from "@/lib/authz"
import { and, asc, desc, eq, inArray, ne } from "drizzle-orm"
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
  await requireMaster()
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
  const admin = await getCurrentAdmin()
  const accessible = await getAccessibleContestIds(admin)
  // null = master (all contests). Otherwise scope to owned + assigned ids.
  if (accessible === null) {
    return db.select().from(contest).orderBy(desc(contest.createdAt))
  }
  if (accessible.length === 0) return []
  return db
    .select()
    .from(contest)
    .where(inArray(contest.id, accessible))
    .orderBy(desc(contest.createdAt))
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

// Ranking metric for a (non-batched) contest; unknown values fall back to gain.
function normalizeContestWinnerType(v: FormDataEntryValue | null): string {
  const s = String(v)
  return ["gain", "absoluteGain", "rankEdgesGain", "lots"].includes(s) ? s : "gain"
}

export async function createContest(formData: FormData) {
  const admin = await getCurrentAdmin()
  const name = String(formData.get("name") || "").trim()
  const description = String(formData.get("description") || "").trim()
  const rules = String(formData.get("rules") || "").trim()
  const faq = String(formData.get("faq") || "").trim()
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
  const winnerType = normalizeContestWinnerType(formData.get("winnerType"))
  const requireEmail = formData.get("requireEmail") != null

  if (!name || !startDate || !endDate) {
    return { ok: false as const, error: "Name, start date and end date are required" }
  }

  const slugInput = String(formData.get("slug") || "").trim()
  let slug = slugify(slugInput || name) || slugify(name)
  const existing = await db.select({ id: contest.id }).from(contest).where(eq(contest.slug, slug)).limit(1)
  if (existing.length) slug = `${slug}-${Date.now().toString(36)}`

  await db.insert(contest).values({
    ownerId: admin.id,
    slug,
    name,
    description: description || null,
    rules: rules || null,
    faq: faq || null,
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
    winnerType,
    requireEmail,
    status: "upcoming",
  })

  revalidatePath("/admin")
  return { ok: true as const, slug }
}

export async function updateContest(id: number, formData: FormData) {
  await assertCanManageContest(id)
  const name = String(formData.get("name") || "").trim()
  const description = String(formData.get("description") || "").trim()
  const rules = String(formData.get("rules") || "").trim()
  const faq = String(formData.get("faq") || "").trim()
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
  const winnerType = normalizeContestWinnerType(formData.get("winnerType"))
  const requireEmail = formData.get("requireEmail") != null

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
    faq: faq || null,
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
      winnerType,
      requireEmail,
    })
    .where(eq(contest.id, id))

  revalidatePath("/admin")
  revalidatePath(`/admin/contests/${id}`)
  return { ok: true as const }
}

export async function updateContestStatus(id: number, status: string) {
  await assertCanManageContest(id)
  await db.update(contest).set({ status }).where(eq(contest.id, id))
  revalidatePath("/admin")
}

export async function updateLeaderboardColumns(id: number, columns: LeaderboardColumns) {
  await assertCanManageContest(id)
  // Normalize to a clean boolean map so only known keys are persisted.
  const clean = resolveColumns(columns)
  await db.update(contest).set({ leaderboardColumns: clean }).where(eq(contest.id, id))
  revalidatePath("/admin")
  revalidatePath(`/admin/contests/${id}`)
  return { ok: true as const }
}

export async function deleteContest(id: number) {
  await assertCanManageContest(id)
  await db.delete(participant).where(eq(participant.contestId, id))
  await db.delete(batch).where(eq(batch.contestId, id))
  await db.delete(contestAssignment).where(eq(contestAssignment.contestId, id))
  await db.delete(contest).where(eq(contest.id, id))
  revalidatePath("/admin")
}

/* -------------------------------- Batches ------------------------------- */

export async function listBatches(contestId: number) {
  await assertCanManageContest(contestId)
  return db
    .select()
    .from(batch)
    .where(eq(batch.contestId, contestId))
    .orderBy(asc(batch.sortOrder), asc(batch.startDate))
}

export async function createBatch(contestId: number, formData: FormData) {
  await assertCanManageContest(contestId)
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
  await assertCanManageContest(row.contestId)

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
  await assertCanManageContest(row.contestId)
  // Unassign participants from this batch, then remove it.
  await db.update(participant).set({ batchId: null }).where(eq(participant.batchId, id))
  await db.delete(batch).where(eq(batch.id, id))
  revalidatePath("/admin")
  revalidatePath(`/admin/contests/${row.contestId}`)
  return { ok: true as const }
}

/**
 * Resolve the contest a participant belongs to and assert the current admin can
 * manage it. Throws if the participant is missing or access is denied.
 */
async function assertCanManageParticipant(participantId: number) {
  const row = (
    await db.select({ contestId: participant.contestId }).from(participant).where(eq(participant.id, participantId)).limit(1)
  )[0]
  if (!row) throw new Error("Participant not found")
  await assertCanManageContest(row.contestId)
  return row.contestId
}

export async function setParticipantBatch(participantId: number, batchId: number | null) {
  await assertCanManageParticipant(participantId)
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
  await requireMaster()
  const name = String(formData.get("name") || "").trim()
  const platform = String(formData.get("platform") || "").trim()
  const company = String(formData.get("company") || "").trim()
  if (!name || !platform) return { ok: false as const, error: "Name and platform are required" }

  await db.insert(brokerServer).values({ name, platform, company: company || null })
  revalidatePath("/admin")
  return { ok: true as const }
}

export async function deleteServer(id: number) {
  await requireMaster()
  await db.delete(brokerServer).where(eq(brokerServer.id, id))
  revalidatePath("/admin")
}

/* ----------------------------- Participants ----------------------------- */

export async function listParticipants(contestId: number) {
  await assertCanManageContest(contestId)
  return db
    .select()
    .from(participant)
    .where(eq(participant.contestId, contestId))
    .orderBy(desc(participant.createdAt))
}

export async function addParticipant(contestId: number, formData: FormData) {
  await assertCanManageContest(contestId)

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

  const c = (await db.select().from(contest).where(eq(contest.id, contestId)).limit(1))[0]
  if (!c) return { ok: false as const, error: "Contest not found" }

  // Which source this trader will actually sync from (override wins over contest default).
  const effectiveSource = dataSource ?? c.dataSource
  // AIMS Ranking matches by MT4/MT5 ID, so the investor password is optional there.
  const isAims = effectiveSource === "aimsranking"

  if (!nickname || !realName || !platform || !serverName || !accountLogin || (!isAims && !investorPassword)) {
    return {
      ok: false as const,
      error: isAims
        ? "All fields except email and investor password are required"
        : "All fields except email are required",
    }
  }
  if (platform !== "mt4" && platform !== "mt5") {
    return { ok: false as const, error: "Platform must be MT4 or MT5" }
  }

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
    investorPassword: investorPassword || null,
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
  await assertCanManageParticipant(id)
  await db.update(participant).set({ dataSource: source }).where(eq(participant.id, id))
  revalidatePath("/admin")
  return { ok: true as const }
}

export async function setParticipantStatus(id: number, status: string) {
  await assertCanManageParticipant(id)
  await db.update(participant).set({ status }).where(eq(participant.id, id))
  revalidatePath("/admin")
}

export async function deleteParticipant(id: number) {
  await assertCanManageParticipant(id)
  await db.delete(participant).where(eq(participant.id, id))
  revalidatePath("/admin")
}

/**
 * Bulk-delete participants. Pass a list of ids to remove those rows, or set
 * `allInContest` to a contest id to wipe every participant in that contest
 * (used by the admin "Delete all" button for large test runs). Deletes in
 * chunks so a 300+ participant test batch doesn't blow the query size.
 */
export async function deleteParticipants(opts: { ids?: number[]; allInContest?: number }) {
  await getCurrentAdmin()

  let contestId = opts.allInContest ?? null
  let deleted = 0

  if (opts.allInContest != null) {
    await assertCanManageContest(opts.allInContest)
    const res = await db
      .delete(participant)
      .where(eq(participant.contestId, opts.allInContest))
      .returning({ id: participant.id })
    deleted = res.length
  } else if (opts.ids && opts.ids.length > 0) {
    // Verify the caller can manage every contest these participants belong to,
    // so a sub-admin can't delete rows from contests outside their scope.
    const owningRows = await db
      .select({ id: participant.id, contestId: participant.contestId })
      .from(participant)
      .where(inArray(participant.id, opts.ids))
    const contestIds = Array.from(new Set(owningRows.map((r) => r.contestId)))
    for (const cid of contestIds) await assertCanManageContest(cid)
    // Capture the contest for revalidation before the rows are gone.
    contestId = owningRows[0]?.contestId ?? null

    const CHUNK = 200
    for (let i = 0; i < opts.ids.length; i += CHUNK) {
      const slice = opts.ids.slice(i, i + CHUNK)
      const res = await db
        .delete(participant)
        .where(inArray(participant.id, slice))
        .returning({ id: participant.id })
      deleted += res.length
    }
  } else {
    return { ok: false as const, error: "Nothing to delete" }
  }

  revalidatePath("/admin")
  if (contestId != null) revalidatePath(`/admin/contests/${contestId}`)
  return { ok: true as const, deleted }
}

/** Flatten a stored snapshot into the numeric metric columns the app reads. */
function snapshotToColumns(s: MetricSnapshot) {
  return {
    currentBalance: String(s.currentBalance),
    currentEquity: String(s.currentEquity),
    profit: String(s.profit),
    profitPct: String(s.profitPct),
    gain: String(s.gain),
    absoluteGain: String(s.absoluteGain),
    rankEdgesGain: String(s.rankEdgesGain),
    lots: String(s.lots),
    maxDrawdown: String(s.maxDrawdown),
    deposits: String(s.deposits),
    withdrawals: String(s.withdrawals),
    trades: s.trades,
    winRate: String(s.winRate),
    lastSyncedAt: s.syncedAt ? new Date(s.syncedAt) : null,
  }
}

/** Merge a freshly-synced snapshot into a participant's stored source snapshots. */
function mergeSnapshot(
  existing: typeof participant.$inferSelect.sourceSnapshots,
  source: SourceKey,
  snap: MetricSnapshot,
) {
  return { ...(existing ?? {}), [source]: snap }
}

/**
 * Re-project the contest's display source into every participant's flat metric
 * columns from their stored snapshots. Pure DB work — no external API calls —
 * so toggling the displayed source is instant. Participants without a snapshot
 * for the chosen source are left untouched.
 */
async function projectDisplaySource(
  contestId: number,
  c: typeof contest.$inferSelect,
  onlyIds?: Set<number>,
) {
  const src = (c.displaySource ?? c.dataSource) as SourceKey
  const rows = await db.select().from(participant).where(eq(participant.contestId, contestId))
  for (const p of rows) {
    if (onlyIds && !onlyIds.has(p.id)) continue
    const snap = p.sourceSnapshots?.[src]
    if (!snap) continue
    await db.update(participant).set(snapshotToColumns(snap)).where(eq(participant.id, p.id))
  }
}

/**
 * Pull live metrics from MetaAPI for every participant of a contest that has a
 * provisioned MetaAPI account, and recompute profit / profit %.
 */
export async function syncContest(
  contestId: number,
  participantIds?: number[],
  // Force a specific source for THIS sync run. When omitted ("auto"), each row
  // is pulled from its own effective data source (per-participant override, else
  // the contest default). When set, every row is pulled from that one source so
  // the admin can populate a second source's snapshot for comparison/toggling.
  syncSource?: SourceKey,
) {
  await assertCanManageContest(contestId)

  const c = (await db.select().from(contest).where(eq(contest.id, contestId)).limit(1))[0]
  if (!c) return { ok: false as const, synced: 0, error: "Contest not found" }

  // When participantIds is provided, only sync those rows; otherwise sync all.
  const allRows = await db.select().from(participant).where(eq(participant.contestId, contestId))
  const idSet = participantIds && participantIds.length > 0 ? new Set(participantIds) : null
  const rows = idSet ? allRows.filter((p) => idSet.has(p.id)) : allRows

  // Partition the rows by which source to pull from. An explicit syncSource
  // overrides the per-participant/contest routing; otherwise AIMS-sourced
  // traders hit the AIMS feed and the rest go through MetaAPI — in one run.
  let aimsRows: typeof rows
  let metaRows: typeof rows
  if (syncSource === "aimsranking") {
    aimsRows = rows
    metaRows = []
  } else if (syncSource === "metaapi") {
    aimsRows = []
    metaRows = rows
  } else {
    aimsRows = rows.filter((p) => (p.dataSource ?? c.dataSource) === "aimsranking")
    metaRows = rows.filter((p) => (p.dataSource ?? c.dataSource) !== "aimsranking")
  }

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
    await projectDisplaySource(contestId, c, idSet ?? undefined)
    revalidatePath("/admin")
    revalidatePath(`/admin/contests/${contestId}`)
    if (c.slug) {
      revalidatePath(`/embed/${c.slug}`)
      revalidatePath(`/contests/${c.slug}`)
    }
    return { ok: true as const, synced, pending, warning: provisionError ?? undefined }
  }

  if (!isMetaApiConfigured()) {
    // No MetaAPI token: if we already synced AIMS rows, report partial success.
    if (aimsRows.length > 0) {
      await projectDisplaySource(contestId, c, idSet ?? undefined)
      revalidatePath("/admin")
      revalidatePath(`/admin/contests/${contestId}`)
      if (c.slug) {
        revalidatePath(`/embed/${c.slug}`)
        revalidatePath(`/contests/${c.slug}`)
      }
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
          password: p.investorPassword ?? "",
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

    const equity = metrics.equity
    // Use MetaStats' own net trading profit — this matches the trader's MT4/MT5
    // "Profit" figure exactly (it already excludes deposits/withdrawals). The
    // old `equity - startingBalance` was wrong for anyone whose real deposits
    // differed from the assumed starting balance (e.g. topped-up accounts),
    // since it counted extra deposits as profit.
    const profit = metrics.profit
    // Percentage return relative to total deposits (withdrawals excluded).
    const deposits = Number(metrics.deposits) || 0
    const profitPct = deposits > 0 ? (profit / deposits) * 100 : 0
    // RankEdges gain uses the same profit-over-deposits basis.
    const rankEdgesGain = deposits > 0 ? (metrics.profit / deposits) * 100 : 0

    const snap: MetricSnapshot = {
      currentBalance: metrics.balance,
      currentEquity: equity,
      profit,
      profitPct,
      gain: metrics.gain,
      absoluteGain: metrics.absoluteGain,
      rankEdgesGain,
      lots: metrics.lots,
      maxDrawdown: metrics.maxDrawdown,
      deposits: metrics.deposits,
      withdrawals: metrics.withdrawals,
      trades: metrics.trades,
      winRate: metrics.winRate,
      syncedAt: new Date().toISOString(),
    }

    await db
      .update(participant)
      .set({
        sourceSnapshots: mergeSnapshot(p.sourceSnapshots, "metaapi", snap),
        status: p.status === "pending" ? "active" : p.status,
      })
      .where(eq(participant.id, p.id))
    synced++
  }

  // Mirror the display source's snapshot into the flat metric columns.
  await projectDisplaySource(contestId, c, idSet ?? undefined)
  revalidatePath("/admin")
  revalidatePath(`/admin/contests/${contestId}`)
  if (c.slug) {
    revalidatePath(`/embed/${c.slug}`)
    revalidatePath(`/contests/${c.slug}`)
  }
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

    // RankEdges gain is our own metric (profit / deposit). `gain` keeps the raw
    // figure AIMS reports; `absoluteGain` isn't provided by AIMS so it stays 0.
    // AIMS doesn't expose closed-trade counts or win rate.
    const snap: MetricSnapshot = {
      currentBalance: m.balance,
      currentEquity: m.equity,
      profit,
      profitPct: rankEdgesGain,
      gain: m.gain,
      absoluteGain: 0,
      rankEdgesGain,
      lots: m.lots,
      maxDrawdown: m.drawdown,
      deposits: m.deposits,
      withdrawals: m.withdrawals,
      trades: null,
      winRate: 0,
      syncedAt: new Date().toISOString(),
    }

    await db
      .update(participant)
      .set({
        sourceSnapshots: mergeSnapshot(p.sourceSnapshots, "aimsranking", snap),
        status: p.status === "pending" ? "active" : p.status,
      })
      .where(eq(participant.id, p.id))
    synced++
  }

  revalidatePath("/admin")
  revalidatePath(`/admin/contests/${contestId}`)
  return { ok: true as const, synced, pending, warning: undefined as string | undefined }
}

/**
 * Switch which stored source (AIMS Ranking or MetaAPI) is shown on the
 * leaderboard and admin table. Instant: it only re-projects the already-synced
 * snapshots into the flat metric columns — no external API is called. Rows that
 * have no snapshot yet for the chosen source keep their previous values.
 */
export async function setDisplaySource(contestId: number, source: SourceKey) {
  await assertCanManageContest(contestId)

  const c = (await db.select().from(contest).where(eq(contest.id, contestId)).limit(1))[0]
  if (!c) return { ok: false as const, error: "Contest not found" }

  const updated = { ...c, displaySource: source }
  await db.update(contest).set({ displaySource: source }).where(eq(contest.id, contestId))
  await projectDisplaySource(contestId, updated)

  revalidatePath("/admin")
  revalidatePath(`/admin/contests/${contestId}`)
  if (c.slug) {
    revalidatePath(`/embed/${c.slug}`)
    revalidatePath(`/contests/${c.slug}`)
  }
  return { ok: true as const, source }
}

/* ----------------------- Compare data sources (read-only) ----------------------- */

/** A single source's live reading for one participant. */
export type SourceSnapshot = {
  available: boolean
  reason?: string
  equity: number
  gain: number // raw gain % as the source reports it
  rankEdgesGain: number // our computed metric: profit / deposits * 100
  profit: number
  lots: number
  drawdown: number
  deposits: number
  withdrawals: number
  trades: number | null
}

export type CompareRow = {
  id: number
  nickname: string
  accountLogin: string
  platform: string
  aims: SourceSnapshot
  meta: SourceSnapshot
}

const UNAVAILABLE = (reason: string): SourceSnapshot => ({
  available: false,
  reason,
  equity: 0,
  gain: 0,
  rankEdgesGain: 0,
  profit: 0,
  lots: 0,
  drawdown: 0,
  deposits: 0,
  withdrawals: 0,
  trades: null,
})

/**
 * Fetch each participant's metrics from BOTH the AIMS Ranking feed and MetaAPI
 * at once, purely for admin comparison. This does NOT write any metrics to the
 * database — the stored/ranked values are left untouched. Provisioning a
 * MetaAPI account id (a one-time side effect) may still happen so we can read
 * that account, but no equity/gain/etc. is persisted.
 */
export async function compareContestSources(contestId: number) {
  await assertCanManageContest(contestId)

  const c = (await db.select().from(contest).where(eq(contest.id, contestId)).limit(1))[0]
  if (!c) return { ok: false as const, error: "Contest not found" }

  const rows = await db.select().from(participant).where(eq(participant.contestId, contestId))

  // --- AIMS: one bulk fetch, matched by MT4 ID (same wide window as the sync) ---
  let aimsById = new Map<string, AimsMetrics>()
  let aimsError: string | null = null
  if (isAimsRankingConfigured()) {
    const now = new Date()
    const DAY = 24 * 60 * 60 * 1000
    const start = new Date(c.startDate)
    const lower = new Date(Math.min(start.getTime(), now.getTime()) - 365 * DAY)
    const upper = new Date(now.getTime() + 365 * DAY)
    try {
      const res = await fetchContestantMetrics({
        competitionFrom: lower,
        competitionTo: upper,
        resultFrom: lower,
        resultTo: upper,
      })
      aimsById = res.byMt4Id
    } catch (e) {
      aimsError = `AIMS fetch failed: ${(e as Error).message}`
    }
  } else {
    aimsError = "AIMS Ranking is not configured"
  }

  const metaConfigured = isMetaApiConfigured()

  const result: CompareRow[] = []
  for (const p of rows) {
    // AIMS snapshot
    let aims: SourceSnapshot
    if (aimsError) {
      aims = UNAVAILABLE(aimsError)
    } else {
      const m = aimsById.get(p.accountLogin.trim())
      if (!m) {
        aims = UNAVAILABLE("Not in AIMS feed")
      } else if (!m.hasResult) {
        aims = UNAVAILABLE("Registered — no results yet")
      } else {
        const profit = m.profit || m.equity - m.deposits
        aims = {
          available: true,
          equity: m.equity,
          gain: m.gain,
          rankEdgesGain: m.deposits > 0 ? (profit / m.deposits) * 100 : 0,
          profit,
          lots: m.lots,
          drawdown: m.drawdown,
          deposits: m.deposits,
          withdrawals: m.withdrawals,
          trades: null, // AIMS feed doesn't expose closed-trade counts
        }
      }
    }

    // MetaAPI snapshot (best-effort; provision the account id if missing)
    let meta: SourceSnapshot
    if (!metaConfigured) {
      meta = UNAVAILABLE("MetaAPI not configured")
    } else {
      let accountId = p.metaApiAccountId
      if (!accountId) {
        try {
          accountId = await provisionAccount({
            name: `c${contestId}-${p.nickname}`,
            login: p.accountLogin,
            password: p.investorPassword ?? "",
            server: p.serverName ?? "",
            platform: (p.platform as "mt4" | "mt5") ?? "mt5",
          })
          await db.update(participant).set({ metaApiAccountId: accountId }).where(eq(participant.id, p.id))
        } catch (e) {
          const msg = (e as Error).message
          meta = UNAVAILABLE(
            /E_RESOURCE_SLOTS|resource slots/i.test(msg)
              ? "MetaAPI account limit reached"
              : /authenticate|invalid account|password/i.test(msg)
                ? "Broker rejected login"
                : /server .* not found|\.srv file/i.test(msg)
                  ? "Server not recognized"
                  : "Could not connect",
          )
          result.push({ id: p.id, nickname: p.nickname, accountLogin: p.accountLogin, platform: p.platform, aims, meta })
          continue
        }
      }
      const metrics = accountId ? await getAccountMetrics(accountId) : null
      if (!metrics) {
        meta = UNAVAILABLE("No metrics yet (connecting)")
      } else {
        // MetaStats' net trading profit — matches the trader's MT4/MT5 figure
        // (excludes deposits/withdrawals). Don't derive it from equity minus a
        // fixed starting balance, which breaks for topped-up accounts.
        const profit = metrics.profit
        meta = {
          available: true,
          equity: metrics.equity,
          gain: metrics.gain,
          rankEdgesGain: metrics.deposits > 0 ? (metrics.profit / metrics.deposits) * 100 : 0,
          profit,
          lots: metrics.lots,
          drawdown: metrics.maxDrawdown,
          deposits: metrics.deposits,
          withdrawals: metrics.withdrawals,
          trades: metrics.trades,
        }
      }
    }

    result.push({ id: p.id, nickname: p.nickname, accountLogin: p.accountLogin, platform: p.platform, aims, meta })
  }

  return { ok: true as const, rows: result, aimsError: aimsError ?? undefined }
}

/* ----------------------- Contest access (master only) ----------------------- */

/**
 * The contest owner plus every sub-admin, each flagged with whether they
 * currently have access to this contest (owner is always true and locked).
 * Master-only.
 */
export async function listContestAccess(contestId: number) {
  await requireMaster()
  const c = (await db.select().from(contest).where(eq(contest.id, contestId)).limit(1))[0]
  if (!c) return { ok: false as const, error: "Contest not found" }

  const admins = await db
    .select({ id: userTable.id, name: userTable.name, email: userTable.email, role: userTable.role })
    .from(userTable)
    .orderBy(asc(userTable.name))

  const assignedRows = await db
    .select({ userId: contestAssignment.userId })
    .from(contestAssignment)
    .where(eq(contestAssignment.contestId, contestId))
  const assigned = new Set(assignedRows.map((r) => r.userId))

  const rows = admins
    .filter((a) => a.role !== "master") // master already has access to everything
    .map((a) => ({
      id: a.id,
      name: a.name,
      email: a.email,
      isOwner: a.id === c.ownerId,
      assigned: a.id === c.ownerId || assigned.has(a.id),
    }))

  return { ok: true as const, ownerId: c.ownerId, rows }
}

/** Grant a sub-admin management access to a contest. Master-only. */
export async function assignContest(contestId: number, userId: string) {
  await requireMaster()
  await db.insert(contestAssignment).values({ contestId, userId }).onConflictDoNothing()
  revalidatePath("/admin")
  revalidatePath(`/admin/contests/${contestId}`)
  return { ok: true as const }
}

/** Revoke a sub-admin's assigned access to a contest. Master-only. */
export async function unassignContest(contestId: number, userId: string) {
  await requireMaster()
  await db
    .delete(contestAssignment)
    .where(and(eq(contestAssignment.contestId, contestId), eq(contestAssignment.userId, userId)))
  revalidatePath("/admin")
  revalidatePath(`/admin/contests/${contestId}`)
  return { ok: true as const }
}
