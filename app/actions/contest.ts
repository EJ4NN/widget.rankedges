"use server"

import { db } from "@/lib/db"
import { contest, participant, brokerServer, batch } from "@/lib/db/schema"
import { and, asc, desc, eq, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { isMetaApiConfigured, provisionAccount } from "@/lib/metaapi"
import { withEffectiveStatus, effectiveContestStatus } from "@/lib/contest-status"
import type { LeaderboardColumns } from "@/lib/leaderboard-columns"
import { normalizeWinnerType, type WinnerType } from "@/lib/winner-type"

/** Batches (rounds) for a contest, ordered for display. */
export async function listBatches(contestId: number) {
  return db
    .select()
    .from(batch)
    .where(eq(batch.contestId, contestId))
    .orderBy(asc(batch.sortOrder), asc(batch.startDate))
}

export async function getContestBySlug(slug: string) {
  const rows = await db.select().from(contest).where(eq(contest.slug, slug)).limit(1)
  return rows[0] ? withEffectiveStatus(rows[0]) : null
}

export async function getServersForPlatform(platform: string, contestId?: number) {
  const rows = await db
    .select()
    .from(brokerServer)
    .where(eq(brokerServer.platform, platform))
    .orderBy(asc(brokerServer.name))

  // Restrict to the contest's allowed brokers, when configured.
  if (contestId != null) {
    const c = (await db.select().from(contest).where(eq(contest.id, contestId)).limit(1))[0]
    const allowed = c?.allowedBrokers
    if (allowed && allowed.length > 0) {
      return rows.filter((s) => s.company && allowed.includes(s.company))
    }
  }
  return rows
}

/** Broker companies a contest accepts (empty array = all brokers). */
export async function getAllowedBrokers(contestId: number) {
  const c = (await db.select().from(contest).where(eq(contest.id, contestId)).limit(1))[0]
  return c?.allowedBrokers ?? []
}

/**
 * Public leaderboard. Private identity fields (realName, account) are only
 * included when the contest's column config explicitly enables them, so nothing
 * sensitive is ever sent to the client by default. investorPassword is never exposed.
 */
export async function getLeaderboard(
  contestId: number,
  columns?: Partial<Pick<LeaderboardColumns, "realName" | "account">>,
  opts?: { batchId?: number | null; winnerType?: WinnerType },
) {
  const winnerType = normalizeWinnerType(opts?.winnerType)
  // Column to rank by, based on the batch/contest winning metric.
  const rankColumn =
    winnerType === "lots"
      ? participant.lots
      : winnerType === "absoluteGain"
        ? participant.absoluteGain
        : participant.gain

  const filters = [eq(participant.contestId, contestId), sql`${participant.status} != 'rejected'`]
  // Only filter by batch when the contest actually uses batches.
  if (opts?.batchId != null) {
    filters.push(eq(participant.batchId, opts.batchId))
  }

  const rows = await db
    .select({
      id: participant.id,
      batchId: participant.batchId,
      nickname: participant.nickname,
      status: participant.status,
      avatarUrl: participant.avatarUrl,
      realName: participant.realName,
      accountLogin: participant.accountLogin,
      startingBalance: participant.startingBalance,
      currentBalance: participant.currentBalance,
      currentEquity: participant.currentEquity,
      profit: participant.profit,
      profitPct: participant.profitPct,
      gain: participant.gain,
      absoluteGain: participant.absoluteGain,
      lots: participant.lots,
      maxDrawdown: participant.maxDrawdown,
      deposits: participant.deposits,
      withdrawals: participant.withdrawals,
      trades: participant.trades,
      winRate: participant.winRate,
      lastSyncedAt: participant.lastSyncedAt,
      createdAt: participant.createdAt,
    })
    .from(participant)
    .where(and(...filters))
    // Rank traders with real activity (at least one trade) above inactive ones,
    // then by the winning metric for this batch/contest.
    .orderBy(sql`(${participant.trades} > 0) DESC`, desc(rankColumn))

  // Strip private fields unless the admin opted to display them.
  return rows.map((r) => ({
    ...r,
    realName: columns?.realName ? r.realName : null,
    accountLogin: columns?.account ? r.accountLogin : null,
  }))
}

export async function getParticipantCount(contestId: number) {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(participant)
    .where(eq(participant.contestId, contestId))
  return rows[0]?.count ?? 0
}

type JoinInput = {
  contestId: number
  contestSlug: string
  nickname: string
  realName: string
  email?: string
  platform: "mt4" | "mt5"
  serverId: number
  accountLogin: string
  investorPassword: string
}

export async function joinContest(input: JoinInput) {
  const c = (await db.select().from(contest).where(eq(contest.id, input.contestId)).limit(1))[0]
  if (!c) return { ok: false as const, error: "Contest not found" }
  if (effectiveContestStatus(c) === "ended") {
    return { ok: false as const, error: "This contest has ended" }
  }

  // capacity check
  if (c.maxParticipants) {
    const count = await getParticipantCount(input.contestId)
    if (count >= c.maxParticipants) {
      return { ok: false as const, error: "This contest is full" }
    }
  }

  // duplicate account guard
  const dupe = await db
    .select({ id: participant.id })
    .from(participant)
    .where(and(eq(participant.contestId, input.contestId), eq(participant.accountLogin, input.accountLogin)))
    .limit(1)
  if (dupe.length) {
    return { ok: false as const, error: "This trading account is already registered" }
  }

  const server = (await db.select().from(brokerServer).where(eq(brokerServer.id, input.serverId)).limit(1))[0]
  if (!server) return { ok: false as const, error: "Invalid server selected" }

  // Enforce broker allow-list when the contest restricts brokers.
  if (c.allowedBrokers && c.allowedBrokers.length > 0) {
    if (!server.company || !c.allowedBrokers.includes(server.company)) {
      return { ok: false as const, error: "This broker is not eligible for this contest" }
    }
  }

  // Try to provision on MetaAPI (best-effort). If it fails, we still register
  // the participant as pending so an admin can retry the sync.
  let metaApiAccountId: string | null = null
  if (isMetaApiConfigured()) {
    try {
      metaApiAccountId = await provisionAccount({
        name: `${c.slug}-${input.nickname}`,
        login: input.accountLogin,
        password: input.investorPassword,
        server: server.name,
        platform: input.platform,
      })
    } catch (e) {
      console.log("[v0] MetaAPI provision failed:", (e as Error).message)
    }
  }

  await db.insert(participant).values({
    contestId: input.contestId,
    nickname: input.nickname,
    realName: input.realName,
    email: input.email || null,
    platform: input.platform,
    serverId: server.id,
    serverName: server.name,
    accountLogin: input.accountLogin,
    investorPassword: input.investorPassword,
    metaApiAccountId,
    status: "pending",
    startingBalance: c.startingBalance,
  })

  revalidatePath(`/contests/${input.contestSlug}`)
  revalidatePath(`/embed/${input.contestSlug}`)
  return { ok: true as const }
}
