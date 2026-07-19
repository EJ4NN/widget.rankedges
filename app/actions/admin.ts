"use server"

import { db } from "@/lib/db"
import { brokerServer, contest, participant, batch, setting } from "@/lib/db/schema"
import { requireAdmin } from "@/lib/get-session"
import { and, asc, desc, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { getAccountMetrics, isMetaApiConfigured, provisionAccount } from "@/lib/metaapi"
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

export async function createContest(formData: FormData) {
  await requireAdmin()
  const name = String(formData.get("name") || "").trim()
  const description = String(formData.get("description") || "").trim()
  const rules = String(formData.get("rules") || "").trim()
  const prizePool = String(formData.get("prizePool") || "").trim()
  const startingBalance = String(formData.get("startingBalance") || "10000")
  const startDate = String(formData.get("startDate") || "")
  const endDate = String(formData.get("endDate") || "")
  const maxParticipants = String(formData.get("maxParticipants") || "")
  const posterUrl = String(formData.get("posterUrl") || "").trim()
  const thumbnailUrl = String(formData.get("thumbnailUrl") || "").trim()
  const sponsorLogoUrl = String(formData.get("sponsorLogoUrl") || "").trim()
  const allowedBrokers = formData.getAll("allowedBrokers").map((b) => String(b)).filter(Boolean)

  if (!name || !startDate || !endDate) {
    return { ok: false as const, error: "Name, start date and end date are required" }
  }

  let slug = slugify(name)
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
    maxParticipants: maxParticipants ? Number(maxParticipants) : null,
    posterUrl: posterUrl || null,
    thumbnailUrl: thumbnailUrl || null,
    sponsorLogoUrl: sponsorLogoUrl || null,
    allowedBrokers: allowedBrokers.length ? allowedBrokers : null,
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
  const maxParticipants = String(formData.get("maxParticipants") || "")
  const posterUrl = String(formData.get("posterUrl") || "").trim()
  const thumbnailUrl = String(formData.get("thumbnailUrl") || "").trim()
  const sponsorLogoUrl = String(formData.get("sponsorLogoUrl") || "").trim()
  const allowedBrokers = formData.getAll("allowedBrokers").map((b) => String(b)).filter(Boolean)

  if (!name || !startDate || !endDate) {
    return { ok: false as const, error: "Name, start date and end date are required" }
  }

  await db
    .update(contest)
    .set({
      name,
      description: description || null,
      rules: rules || null,
      prizePool: prizePool || null,
      startingBalance,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      maxParticipants: maxParticipants ? Number(maxParticipants) : null,
      posterUrl: posterUrl || null,
      thumbnailUrl: thumbnailUrl || null,
      sponsorLogoUrl: sponsorLogoUrl || null,
      allowedBrokers: allowedBrokers.length ? allowedBrokers : null,
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

  if (!nickname || !realName || !platform || !serverName || !accountLogin || !investorPassword) {
    return { ok: false as const, error: "All fields except email are required" }
  }
  if (platform !== "mt4" && platform !== "mt5") {
    return { ok: false as const, error: "Platform must be MT4 or MT5" }
  }

  const c = (await db.select().from(contest).where(eq(contest.id, contestId)).limit(1))[0]
  if (!c) return { ok: false as const, error: "Contest not found" }

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
  let metaApiAccountId: string | null = null
  if (isMetaApiConfigured()) {
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
    serverName,
    accountLogin,
    investorPassword,
    metaApiAccountId,
    status: "active",
    startingBalance: c.startingBalance,
  })

  revalidatePath("/admin")
  revalidatePath(`/admin/contests/${contestId}`)
  return { ok: true as const, provisioned: Boolean(metaApiAccountId) }
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
  if (!isMetaApiConfigured()) {
    return { ok: false as const, synced: 0, error: "METAAPI_TOKEN is not configured" }
  }

  // When participantIds is provided, only sync those rows; otherwise sync all.
  const allRows = await db.select().from(participant).where(eq(participant.contestId, contestId))
  const idSet = participantIds && participantIds.length > 0 ? new Set(participantIds) : null
  const rows = idSet ? allRows.filter((p) => idSet.has(p.id)) : allRows

  let synced = 0
  let pending = 0
  for (const p of rows) {
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
        console.log("[v0] provision during sync failed:", (e as Error).message)
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

    await db
      .update(participant)
      .set({
        currentBalance: String(metrics.balance),
        currentEquity: String(equity),
        profit: String(profit),
        profitPct: String(profitPct),
        gain: String(metrics.gain),
        absoluteGain: String(metrics.absoluteGain),
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
  return { ok: true as const, synced, pending }
}
