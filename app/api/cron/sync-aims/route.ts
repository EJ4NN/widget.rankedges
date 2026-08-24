import { NextResponse } from "next/server"
import { runScheduledAimsSync } from "@/app/actions/admin"

// Auto-sync endpoint hit by Vercel Cron (see vercel.json). Vercel automatically
// attaches `Authorization: Bearer <CRON_SECRET>` when the CRON_SECRET env var is
// set, so we verify that before doing any work. This must stay dynamic (never
// cached) and run on the Node runtime because the sync engine uses the DB.
export const dynamic = "force-dynamic"
export const runtime = "nodejs"
// Give the bulk AIMS fetch + per-contest writes room to finish.
export const maxDuration = 60

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    // Fail closed: without a secret the endpoint would be world-callable.
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET is not configured" },
      { status: 500 },
    )
  }

  const auth = request.headers.get("authorization")
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  const result = await runScheduledAimsSync(secret)
  const status = result.ok ? 200 : 401
  return NextResponse.json(result, { status })
}
