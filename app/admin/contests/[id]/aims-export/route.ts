import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { contest, participant } from "@/lib/db/schema"
import { asc, eq } from "drizzle-orm"
import { getCurrentAdmin, canManageContest } from "@/lib/authz"
import { utils, write } from "xlsx"

// Matches the AIMSCAP CRM upload template exactly:
//   A: "Contestants MT4 ID"        -> participant account login (number)
//   B: "Contestant Phone"          -> "-" (we don't collect phone)
//   C: "Contestants Joined Date..."-> join date as yyyy-mm-dd hh:mm:ss
const HEADERS = [
  "Contestants MT4 ID",
  "Contestant Phone",
  "Contestants Joined Date [example 2025-12-31 00:00:00]",
]

const DATE_FMT = "yyyy-mm-dd hh:mm:ss"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const rows = await db
    .select()
    .from(participant)
    .where(eq(participant.contestId, contestId))
    .orderBy(asc(participant.createdAt))

  // Build an array-of-arrays so we control the exact header text and column order.
  const aoa: (string | number | Date)[][] = [HEADERS]
  for (const p of rows) {
    // MT4 ID: numeric when possible (the CRM sample stores it as a number),
    // otherwise fall back to the raw login string.
    const login = p.accountLogin.trim()
    const mt4Id: string | number = /^\d+$/.test(login) ? Number(login) : login
    aoa.push([mt4Id, "-", new Date(p.createdAt)])
  }

  const ws = utils.aoa_to_sheet(aoa, { cellDates: true })

  // Apply the yyyy-mm-dd hh:mm:ss number format to every date cell in column C.
  for (let r = 1; r <= rows.length; r++) {
    const ref = utils.encode_cell({ r, c: 2 })
    if (ws[ref]) ws[ref].z = DATE_FMT
  }

  // Reasonable column widths so the sheet is readable in Excel.
  ws["!cols"] = [{ wch: 20 }, { wch: 18 }, { wch: 42 }]

  const wb = utils.book_new()
  utils.book_append_sheet(wb, ws, "Sheet1")

  const buf: Buffer = write(wb, { type: "buffer", bookType: "xlsx" })

  const safeSlug = c.slug.replace(/[^a-z0-9-]/gi, "-")
  const filename = `aimscap-contestants-${safeSlug}.xlsx`

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  })
}
