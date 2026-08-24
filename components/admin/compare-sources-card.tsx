"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { compareContestSources, type CompareRow, type SourceSnapshot } from "@/app/actions/admin"
import { formatMoney, formatPct, formatPctPlain, formatLots } from "@/lib/format"
import { toast } from "sonner"
import { GitCompare, RefreshCw } from "lucide-react"

/** One metric cell: shows the AIMS value over the MetaAPI value, or a reason. */
function DualCell({
  aims,
  meta,
  render,
  highlightDiff = false,
}: {
  aims: SourceSnapshot
  meta: SourceSnapshot
  render: (s: SourceSnapshot) => string
  highlightDiff?: boolean
}) {
  const aimsText = aims.available ? render(aims) : "—"
  const metaText = meta.available ? render(meta) : "—"
  const differ = highlightDiff && aims.available && meta.available && aimsText !== metaText
  return (
    <div className="font-mono text-xs leading-tight">
      <div className={differ ? "text-primary" : "text-foreground"}>{aimsText}</div>
      <div className={differ ? "text-warning" : "text-muted-foreground"}>{metaText}</div>
    </div>
  )
}

export function CompareSourcesCard({ contestId }: { contestId: number }) {
  const [rows, setRows] = useState<CompareRow[] | null>(null)
  const [loading, setLoading] = useState(false)

  async function run() {
    setLoading(true)
    try {
      const res = await compareContestSources(contestId)
      if (!res.ok) {
        toast.error(res.error ?? "Compare failed")
        return
      }
      setRows(res.rows)
      if (res.aimsError) {
        toast.warning("AIMS data unavailable", { description: res.aimsError })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 font-semibold text-foreground">
            <GitCompare className="h-4 w-4 text-primary" />
            Compare data sources
          </h3>
          <p className="text-xs text-muted-foreground">
            Live reading from both APIs, side by side. This is read-only — it does not change the stored
            leaderboard values.
          </p>
        </div>
        <Button size="sm" onClick={run} disabled={loading}>
          <RefreshCw className={"mr-1.5 h-4 w-4 " + (loading ? "animate-spin" : "")} />
          {loading ? "Fetching..." : rows ? "Refresh" : "Compare now"}
        </Button>
      </div>

      {rows ? (
        <>
          <p className="border-b border-border bg-primary/5 px-5 py-2 text-xs text-muted-foreground">
            Each cell shows <span className="font-medium text-primary">AIMS</span> on top and{" "}
            <span className="font-medium text-warning">MetaAPI</span> below. Values that differ are
            colour-coded.
          </p>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trader</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead className="text-right">Equity</TableHead>
                  <TableHead className="text-right">REG</TableHead>
                  <TableHead className="text-right">Gain</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                  <TableHead className="text-right">Lots</TableHead>
                  <TableHead className="text-right">Drawdown</TableHead>
                  <TableHead className="text-right">Depo / WD</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium text-foreground">{r.nickname}</TableCell>
                    <TableCell className="font-mono text-xs">
                      <span className="uppercase text-muted-foreground">{r.platform}</span> {r.accountLogin}
                      {(!r.aims.available || !r.meta.available) && (
                        <div className="mt-0.5 text-[10px] leading-tight">
                          {!r.aims.available && <div className="text-primary/70">AIMS: {r.aims.reason}</div>}
                          {!r.meta.available && <div className="text-warning/70">Meta: {r.meta.reason}</div>}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DualCell aims={r.aims} meta={r.meta} render={(s) => formatMoney(s.equity)} highlightDiff />
                    </TableCell>
                    <TableCell className="text-right">
                      <DualCell aims={r.aims} meta={r.meta} render={(s) => formatPct(s.rankEdgesGain)} highlightDiff />
                    </TableCell>
                    <TableCell className="text-right">
                      <DualCell aims={r.aims} meta={r.meta} render={(s) => formatPct(s.gain)} highlightDiff />
                    </TableCell>
                    <TableCell className="text-right">
                      <DualCell aims={r.aims} meta={r.meta} render={(s) => formatMoney(s.profit)} highlightDiff />
                    </TableCell>
                    <TableCell className="text-right">
                      <DualCell aims={r.aims} meta={r.meta} render={(s) => formatLots(s.lots)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <DualCell aims={r.aims} meta={r.meta} render={(s) => formatPctPlain(s.drawdown)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <DualCell
                        aims={r.aims}
                        meta={r.meta}
                        render={(s) => `${formatMoney(s.deposits)} / ${formatMoney(s.withdrawals)}`}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      ) : (
        <div className="p-8 text-center text-sm text-muted-foreground">
          Click <span className="font-medium text-foreground">Compare now</span> to pull each trader from both
          MetaAPI and AIMS Ranking at the same time.
        </div>
      )}
    </div>
  )
}
