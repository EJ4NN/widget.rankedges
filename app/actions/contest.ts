"use server"

import { db } from "@/lib/db"
import { contest, participant, brokerServer, batch } from "@/lib/db/schema"
import { and, asc, eq, sql } from "drizzle-orm"
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
  // Be forgiving about how the slug arrives when embedded on a third-party site:
  // trim stray whitespace / trailing slashes and match case-insensitively so a
  // copy-pasted URL with different casing still resolves instead of 404-ing.
  const normalized = decodeURIComponent(slug ?? "")
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .toLowerCase()
  if (!normalized) return null
  const rows = await db
    .select()
    .from(contest)
    .where(sql`lower(${contest.slug}) = ${normalized}`)
    .limit(1)
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
  columns?: Partial<Pick<LeaderboardColumns, "realName" | "account" | "accountType">>,
  opts?: { batchId?: number | null; winnerType?: WinnerType },
) {
  const winnerType = normalizeWinnerType(opts?.winnerType)
  // Column to rank by, based on the batch/contest winning metric.
  const rankColumn =
    winnerType === "lots"
      ? participant.lots
      : winnerType === "absoluteGain"
        ? participant.absoluteGain
        : winnerType === "rankEdgesGain"
          ? participant.rankEdgesGain
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
      platform: participant.platform,
      startingBalance: participant.startingBalance,
      currentBalance: participant.currentBalance,
      currentEquity: participant.currentEquity,
      profit: participant.profit,
      profitPct: participant.profitPct,
      gain: participant.gain,
      absoluteGain: participant.absoluteGain,
      rankEdgesGain: participant.rankEdgesGain,
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
    // Rank traders with real results above empty accounts, then by the winning
    // metric. "Real results" is broader than closed trades: a trader can be
    // active from open/floating positions with zero CLOSED trades (e.g. Janet),
    // so gating on `trades > 0` alone wrongly buried active traders below
    // losing ones. Count any of: closed trades, a non-zero value on the SAME
    // metric we rank by (so a rankEdgesGain/absoluteGain/lots contest gates on
    // that metric, not on the broker `gain`), or non-zero equity. Only
    // truly-empty accounts sink. NULLS LAST keeps any null metric at the bottom
    // instead of Postgres' default NULLS FIRST for DESC.
    //
    // COALESCE(trades, 0) is essential: AIMS contests never populate `trades`
    // (it stays NULL), so a bare `trades > 0` makes the whole OR evaluate to
    // NULL for a zero/empty account (NULL OR FALSE = NULL), and NULL sorts
    // FIRST under DESC — which floated empty accounts to the TOP of the board.
    .orderBy(
      sql`(COALESCE(${participant.trades}, 0) > 0 OR COALESCE(${rankColumn}, 0) <> 0 OR COALESCE(${participant.currentEquity}, 0) <> 0) DESC`,
      sql`${rankColumn} DESC NULLS LAST`,
    )

  // Strip private fields unless the admin opted to display them.
  return rows.map((r) => ({
    ...r,
    realName: columns?.realName ? r.realName : null,
    accountLogin: columns?.account ? r.accountLogin : null,
    // Platform (MT4/MT5) powers both the inline account prefix and the dedicated
    // Type column, so expose it whenever either toggle is on.
    platform: columns?.account || columns?.accountType ? r.platform : null,
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
  accountLogin: string
  // All contests collect these now. For AIMS Ranking they're stored but results
  // are still read from the CRM feed by MT4 ID (no MetaAPI provisioning).
  realName?: string
  email?: string
  platform?: "mt4" | "mt5"
  serverId?: number
  investorPassword?: string
}

export async function joinContest(input: JoinInput) {
  const c = (await db.select().from(contest).where(eq(contest.id, input.contestId)).limit(1))[0]
  if (!c) return { ok: false as const, error: "Contest not found" }
  if (effectiveContestStatus(c) === "ended") {
    return { ok: false as const, error: "This contest has ended" }
  }

  const isAims = c.dataSource === "aimsranking"

  // All contests now collect the full account details (nickname, real name,
  // platform, broker server, account login, investor password). For AIMS
  // Ranking the credentials are stored but results are still read from the CRM
  // feed by MT4 ID — we do NOT provision a MetaAPI account.
  if (
    !input.nickname.trim() ||
    !input.accountLogin.trim() ||
    !input.realName?.trim() ||
    !input.platform ||
    !input.serverId ||
    // Investor password is required for MetaAPI (needed to sync), but optional
    // for AIMS Ranking, which matches results by MT4/MT5 ID.
    (!isAims && !input.investorPassword?.trim())
  ) {
    return { ok: false as const, error: "Please complete all account details" }
  }

  // Email is required only when the contest opts in. Validate format when given.
  const emailInput = input.email?.trim() || ""
  if (c.requireEmail && !emailInput) {
    return { ok: false as const, error: "Email is required to join this contest" }
  }
  if (emailInput && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput)) {
    return { ok: false as const, error: "Please enter a valid email address" }
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
    .where(and(eq(participant.contestId, input.contestId), eq(participant.accountLogin, input.accountLogin.trim())))
    .limit(1)
  if (dupe.length) {
    return { ok: false as const, error: "This trading account is already registered" }
  }

  // Resolve the selected broker server (both data sources collect it now).
  const server = (await db.select().from(brokerServer).where(eq(brokerServer.id, input.serverId!)).limit(1))[0]
  if (!server) return { ok: false as const, error: "Invalid server selected" }

  // Enforce broker allow-list when the contest restricts brokers.
  if (c.allowedBrokers && c.allowedBrokers.length > 0) {
    if (!server.company || !c.allowedBrokers.includes(server.company)) {
      return { ok: false as const, error: "This broker is not eligible for this contest" }
    }
  }

  // AIMS Ranking: store the full account details, but do NOT provision a
  // MetaAPI account — results are read from the CRM feed matched by MT4 ID.
  if (isAims) {
    await db.insert(participant).values({
      contestId: input.contestId,
      nickname: input.nickname.trim(),
      realName: input.realName!.trim(),
      email: emailInput || null,
      platform: input.platform!,
      serverId: server.id,
      serverName: server.name,
      accountLogin: input.accountLogin.trim(),
      investorPassword: input.investorPassword?.trim() || null,
      metaApiAccountId: null,
      status: "pending",
      startingBalance: c.startingBalance,
    })

    revalidatePath(`/contests/${input.contestSlug}`)
    revalidatePath(`/embed/${input.contestSlug}`)
    return { ok: true as const }
  }

  // MetaAPI flow — full account connection.
  // Try to provision on MetaAPI (best-effort). If it fails, we still register
  // the participant as pending so an admin can retry the sync.
  let metaApiAccountId: string | null = null
  if (isMetaApiConfigured()) {
    try {
      metaApiAccountId = await provisionAccount({
        name: `${c.slug}-${input.nickname}`,
        login: input.accountLogin.trim(),
        password: input.investorPassword!,
        server: server.name,
        platform: input.platform!,
      })
    } catch (e) {
      console.log("[v0] MetaAPI provision failed:", (e as Error).message)
    }
  }

  await db.insert(participant).values({
    contestId: input.contestId,
    nickname: input.nickname.trim(),
    realName: input.realName!.trim(),
    email: emailInput || null,
    platform: input.platform!,
    serverId: server.id,
    serverName: server.name,
    accountLogin: input.accountLogin.trim(),
    investorPassword: input.investorPassword!,
    metaApiAccountId,
    status: "pending",
    startingBalance: c.startingBalance,
  })

  revalidatePath(`/contests/${input.contestSlug}`)
  revalidatePath(`/embed/${input.contestSlug}`)
  return { ok: true as const }
}
