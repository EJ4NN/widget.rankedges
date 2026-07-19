"use client"

import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { deleteParticipant, setParticipantStatus, syncContest, setParticipantBatch } from "@/app/actions/admin"
import { formatLots, formatMoney, formatPct, formatPctPlain, formatDateTime } from "@/lib/format"
import type { Participant } from "@/lib/db/schema"
import { TraderAvatar } from "@/components/widget/trader-avatar"
import { AddParticipantDialog } from "@/components/admin/add-participant-dialog"
import { toast } from "sonner"
import { Eye, EyeOff, Pause, Play, RefreshCw, Trash2 } from "lucide-react"

type Server = { id: number; name: string; company: string | null; platform: string }
type BatchOption = { id: number; name: string }

const AUTO_SYNC_INTERVAL_MS = 60_000 // 1 minute

const NO_BATCH_VALUE = "none"

export function ParticipantsTable({
  contestId,
  participants,
  metaApiConfigured,
  servers,
  batches,
}: {
  contestId: number
  participants: Participant[]
  metaApiConfigured: boolean
  servers: Server[]
  batches: BatchOption[]
}) {
  const router = useRouter()
  const [reveal, setReveal] = useState<Record<number, boolean>>({})
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [pending, startTransition] = useTransition()
  const [syncing, setSyncing] = useState(false)
  const [autoSync, setAutoSync] = useState(false)
  const [lastAutoSync, setLastAutoSync] = useState<Date | null>(null)
  const syncingRef = useRef(false)

  const allSelected = participants.length > 0 && selected.size === participants.length
  const someSelected = selected.size > 0 && !allSelected

  function toggleOne(id: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === participants.length ? new Set() : new Set(participants.map((p) => p.id))))
  }

  const runSync = useCallback(
    async (silent = false, ids?: number[]) => {
      if (syncingRef.current) return
      syncingRef.current = true
      setSyncing(true)
      try {
        const res = await syncContest(contestId, ids)
        if (!res.ok) {
          if (!silent) toast.error(res.error ?? "Sync failed")
          return
        }
        // Pull the freshly written rows into the table.
        router.refresh()
        setLastAutoSync(new Date())
        if (!silent) {
          if (res.pending) {
            toast.success(`Synced ${res.synced} account(s)`, {
              description: `${res.pending} still connecting — will retry.`,
            })
          } else {
            toast.success(`Synced ${res.synced} account(s)`)
          }
        }
      } finally {
        syncingRef.current = false
        setSyncing(false)
      }
    },
    [contestId, router],
  )

  // Auto-sync on an interval while enabled. Runs one sync immediately on toggle-on.
  useEffect(() => {
    if (!autoSync || !metaApiConfigured) return
    void runSync(true)
    const id = setInterval(() => void runSync(true), AUTO_SYNC_INTERVAL_MS)
    return () => clearInterval(id)
  }, [autoSync, metaApiConfigured, runSync])

  function handleSync() {
    void runSync(false)
  }

  function handleSyncSelected() {
    if (selected.size === 0) return
    void runSync(false, Array.from(selected))
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-semibold text-foreground">Participants ({participants.length})</h3>
          <p className="text-xs text-muted-foreground">
            Real names and investor passwords are visible to admins only.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AddParticipantDialog contestId={contestId} servers={servers} hasBatches={batches.length > 0} />
          <Button
            size="sm"
            variant={autoSync ? "default" : "secondary"}
            onClick={() => setAutoSync((v) => !v)}
            disabled={!metaApiConfigured}
            aria-pressed={autoSync}
          >
            {autoSync ? (
              <Pause className="mr-1.5 h-4 w-4" />
            ) : (
              <Play className="mr-1.5 h-4 w-4" />
            )}
            {autoSync ? "Auto-sync on" : "Auto-sync off"}
          </Button>
          {selected.size > 0 && (
            <Button
              size="sm"
              variant="secondary"
              onClick={handleSyncSelected}
              disabled={syncing || !metaApiConfigured}
            >
              <RefreshCw className={"mr-1.5 h-4 w-4 " + (syncing ? "animate-spin" : "")} />
              Sync selected ({selected.size})
            </Button>
          )}
          <Button size="sm" onClick={handleSync} disabled={syncing || !metaApiConfigured}>
            <RefreshCw className={"mr-1.5 h-4 w-4 " + (syncing ? "animate-spin" : "")} />
            {syncing ? "Syncing..." : "Sync all"}
          </Button>
        </div>
      </div>

      {autoSync && (
        <p className="border-b border-border bg-primary/5 px-5 py-2 text-xs text-muted-foreground">
          <span className="font-medium text-primary">Auto-sync active</span> — refreshing every minute
          {lastAutoSync ? ` · last synced ${lastAutoSync.toLocaleTimeString()}` : "..."}
        </p>
      )}

      {!metaApiConfigured && (
        <p className="border-b border-border bg-secondary/40 px-5 py-2 text-xs text-muted-foreground">
          MetaAPI is not configured — add METAAPI_TOKEN to enable automatic live syncing.
        </p>
      )}

      {participants.length === 0 ? (
        <div className="p-10 text-center text-sm text-muted-foreground">No participants yet.</div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    aria-label="Select all participants"
                    className="h-4 w-4 cursor-pointer accent-primary align-middle"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected
                    }}
                    onChange={toggleAll}
                  />
                </TableHead>
                <TableHead>Trader</TableHead>
                {batches.length > 0 ? <TableHead>Batch</TableHead> : null}
                <TableHead>Real name</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Investor pwd</TableHead>
                <TableHead className="text-right">Equity</TableHead>
                <TableHead className="text-right">Gain</TableHead>
                <TableHead className="text-right">Lots</TableHead>
                <TableHead className="text-right">Drawdown</TableHead>
                <TableHead className="text-right">Depo / WD</TableHead>
                <TableHead className="text-right">Trades / Win</TableHead>
                <TableHead>Synced</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {participants.map((p) => {
                const pct = Number(p.gain ?? 0)
                return (
                  <TableRow key={p.id} data-state={selected.has(p.id) ? "selected" : undefined}>
                    <TableCell>
                      <input
                        type="checkbox"
                        aria-label={`Select ${p.nickname}`}
                        className="h-4 w-4 cursor-pointer accent-primary align-middle"
                        checked={selected.has(p.id)}
                        onChange={() => toggleOne(p.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        <TraderAvatar nickname={p.nickname} src={p.avatarUrl} size={28} ring="none" />
                        {p.nickname}
                      </div>
                    </TableCell>
                    {batches.length > 0 ? (
                      <TableCell>
                        <Select
                          value={p.batchId ? String(p.batchId) : NO_BATCH_VALUE}
                          onValueChange={(v) =>
                            startTransition(async () => {
                              await setParticipantBatch(p.id, v === NO_BATCH_VALUE ? null : Number(v))
                              toast.success("Batch updated")
                              router.refresh()
                            })
                          }
                        >
                          <SelectTrigger className="h-8 w-32">
                            <SelectValue>
                              {(value) =>
                                value === NO_BATCH_VALUE
                                  ? "No batch"
                                  : (batches.find((b) => String(b.id) === value)?.name ?? "No batch")
                              }
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NO_BATCH_VALUE}>No batch</SelectItem>
                            {batches.map((b) => (
                              <SelectItem key={b.id} value={String(b.id)}>
                                {b.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    ) : null}
                    <TableCell className="text-muted-foreground">{p.realName}</TableCell>
                    <TableCell className="font-mono text-xs">
                      <span className="uppercase text-muted-foreground">{p.platform}</span>{" "}
                      {p.accountLogin}
                      <div className="text-muted-foreground">{p.serverName}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs">
                          {reveal[p.id] ? p.investorPassword : "••••••••"}
                        </span>
                        <button
                          type="button"
                          aria-label="Toggle password"
                          onClick={() => setReveal((r) => ({ ...r, [p.id]: !r[p.id] }))}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          {reveal[p.id] ? (
                            <EyeOff className="h-3.5 w-3.5" />
                          ) : (
                            <Eye className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatMoney(p.currentEquity)}
                    </TableCell>
                    <TableCell
                      className={
                        "text-right font-mono font-semibold " +
                        (pct >= 0 ? "text-primary" : "text-destructive")
                      }
                    >
                      {formatPct(pct)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-foreground">
                      {formatLots(p.lots)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-warning">
                      {formatPctPlain(p.maxDrawdown)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      <span className="text-foreground">{formatMoney(p.deposits)}</span>
                      <div className="text-muted-foreground">{formatMoney(p.withdrawals)}</div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      <span className="text-foreground">{p.trades ?? 0}</span>
                      <div className="text-muted-foreground">{formatPctPlain(p.winRate)}</div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateTime(p.lastSyncedAt)}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={p.status}
                        onValueChange={(v) =>
                          startTransition(async () => {
                            await setParticipantStatus(p.id, v)
                            toast.success("Status updated")
                          })
                        }
                      >
                        <SelectTrigger className="h-8 w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="rejected">Rejected</SelectItem>
                          <SelectItem value="disqualified">Disqualified</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Delete participant"
                        disabled={pending}
                        onClick={() =>
                          startTransition(async () => {
                            await deleteParticipant(p.id)
                            toast.success("Participant removed")
                          })
                        }
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
