import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { contest, participant } from "@/lib/db/schema"
import { asc, eq, inArray, and } from "drizzle-orm"
import { getCurrentAdmin, canManageContest } from "@/lib/authz"
import { utils, write } from "xlsx"

// Full data export: every meaningful participant field for the selected traders
// (or the whole contest when no ids are supplied). Distinct from the AIMS export,
// which only emits the MT4-ID upload template for the AIMSCAP CRM.
const HEADERS = [
  "Nickname",
  "Real name",
  "Email",
  "Platform",
  "Data source",
  "Server",
  "Account login",
  "Status",
  "Starting balance",
  "Current balance",
  "Current equity",
  "Profit",
  "Profit %",
  "Gain % (time-weighted)",
  "Absolute gain %",
  "RankEdges gain %",
  "Lots",
  "Max drawdown %",
  "Deposits",
  "Withdrawals",
  "Trades",
  "Win rate %",
  "Last synced",
  "Joined",
]

const DATE_FMT = "yyyy-mm-dd hh:mm:ss"

function num(v: string | number | null): number | string {
  if (v === null || v === undefined || v === "") return ""
  const n = Number(v)
  return Number.isNaN(n) ? String(v) : n
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin()

  const { id } = await params
  const contestId = Number(id)
  if (Number.isNaN(contestId)) {
    return NextResponse.json({ error: "Invalid contest id" }, { status: 400 })
  }

  if (!(await canManageContest(admin, contestId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const c = (await db.select().from(contest).where(eq(contest.id, contestId)).limit(1))[0]
  if (!c) {
    return NextResponse.json({ error: "Contest not found" }, { status: 404 })
  }

  // Optional ?ids=1,2,3 restricts the export to the selected participants.
  const idsParam = new URL(req.url).searchParams.get("ids")
  const selectedIds = idsParam
    ? idsParam
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isInteger(n))
    : []

  const where =
    selectedIds.length > 0
      ? and(eq(participant.contestId, contestId), inArray(participant.id, selectedIds))
      : eq(participant.contestId, contestId)

  const rows = await db.select().from(participant).where(where).orderBy(asc(participant.createdAt))

  const aoa: (string | number | Date)[][] = [HEADERS]
  for (const p of rows) {
    aoa.push([
      p.nickname,
      p.realName,
      p.email ?? "",
      p.platform.toUpperCase(),
      p.dataSource ?? "(inherit)",
      p.serverName ?? "",
      p.accountLogin,
      p.status,
      num(p.startingBalance),
      num(p.currentBalance),
      num(p.currentEquity),
      num(p.profit),
      num(p.profitPct),
      num(p.gain),
      num(p.absoluteGain),
      num(p.rankEdgesGain),
      num(p.lots),
      num(p.maxDrawdown),
      num(p.deposits),
      num(p.withdrawals),
      p.trades ?? 0,
      num(p.winRate),
      p.lastSyncedAt ? new Date(p.lastSyncedAt) : "",
      new Date(p.createdAt),
    ])
  }

  const ws = utils.aoa_to_sheet(aoa, { cellDates: true })

  // Date number format for "Last synced" (col 22) and "Joined" (col 23).
  for (let r = 1; r <= rows.length; r++) {
    for (const col of [22, 23]) {
      const ref = utils.encode_cell({ r, c: col })
      if (ws[ref] && ws[ref].t === "d") ws[ref].z = DATE_FMT
    }
  }

  ws["!cols"] = HEADERS.map((h) => ({ wch: Math.max(12, h.length + 2) }))

  const wb = utils.book_new()
  utils.book_append_sheet(wb, ws, "Participants")

  const buf: Buffer = write(wb, { type: "buffer", bookType: "xlsx" })

  const safeSlug = c.slug.replace(/[^a-z0-9-]/gi, "-")
  const scope = selectedIds.length > 0 ? `selected-${rows.length}` : "all"
  const filename = `rankedges-data-${safeSlug}-${scope}.xlsx`

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  })
}
