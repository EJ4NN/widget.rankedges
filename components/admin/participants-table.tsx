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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  deleteParticipant,
  deleteParticipants,
  setParticipantStatus,
  setParticipantNickname,
  setParticipantsStatus,
  syncContest,
  setParticipantBatch,
  setParticipantDataSource,
  setDisplaySource,
} from "@/app/actions/admin"
import type { SourceKey } from "@/lib/db/schema"
import { formatLots, formatMoney, formatPct, formatPctPlain, formatDateTime } from "@/lib/format"
import type { Participant } from "@/lib/db/schema"
import { TraderAvatar } from "@/components/widget/trader-avatar"
import { AddParticipantDialog } from "@/components/admin/add-participant-dialog"
import { toast } from "sonner"
import { Check, CheckCircle2, Clock, Download, Eye, EyeOff, FileSpreadsheet, Pause, Pencil, Play, RefreshCw, Trash2, X } from "lucide-react"

type Server = { id: number; name: string; company: string | null; platform: string }
type BatchOption = { id: number; name: string }

const AUTO_SYNC_INTERVAL_MS = 60_000 // 1 minute

const NO_BATCH_VALUE = "none"
const INHERIT_SOURCE = "inherit"

export function ParticipantsTable({
  contestId,
  contestSlug,
  dataSource,
  displaySource,
  participants,
  metaApiConfigured,
  servers,
  batches,
}: {
  contestId: number
  contestSlug: string
  dataSource: string
  displaySource: string
  participants: Participant[]
  metaApiConfigured: boolean
  servers: Server[]
  batches: BatchOption[]
}) {
  const contestIsAims = dataSource === "aimsranking"
  const router = useRouter()
  // Which source is currently shown (leaderboard + this table). Toggling it
  // re-projects stored snapshots server-side — instant, no API call.
  const [displayState, setDisplayState] = useState<SourceKey>(
    (displaySource as SourceKey) ?? (contestIsAims ? "aimsranking" : "metaapi"),
  )
  const displayIsAims = displayState === "aimsranking"
  // Which source THIS sync run pulls from. "auto" = per-participant routing.
  const [syncSource, setSyncSource] = useState<"auto" | SourceKey>("auto")
  // Syncing is always available for AIMS (no token needed); MetaAPI needs one.
  // With the source selector, allow syncing whenever either path is usable.
  const canSync = contestIsAims || metaApiConfigured
  const [reveal, setReveal] = useState<Record<number, boolean>>({})
  // Inline nickname editing: which participant is being renamed + the draft value.
  const [editingNick, setEditingNick] = useState<number | null>(null)
  const [nickDraft, setNickDraft] = useState("")
  const [selected, setSelected] = useState<Set<number>>(new Set())
  // Bulk-delete confirmation: "selected" removes the checked rows, "all" wipes
  // every participant in the contest. null = dialog closed.
  const [confirmDelete, setConfirmDelete] = useState<null | "selected" | "all">(null)
  const [deleting, setDeleting] = useState(false)
  const [pending, startTransition] = useTransition()
  const [syncing, setSyncing] = useState(false)
  const [autoSync, setAutoSync] = useState(false)
  const [lastAutoSync, setLastAutoSync] = useState<Date | null>(null)
  const syncingRef = useRef(false)
  // "Last synced" is formatted in the admin's local timezone, which differs
  // from the server's (UTC) — gate it on mount so SSR and first client render
  // agree, then swap in the local-time value after hydration.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

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
      // Did this run pull from the AIMS feed? True when explicitly chosen, or
      // when "auto" resolves to AIMS for an AIMS contest. Drives the messaging.
      const usedAims = syncSource === "aimsranking" || (syncSource === "auto" && contestIsAims)
      try {
        const res = await syncContest(contestId, ids, syncSource === "auto" ? undefined : syncSource)
        if (!res.ok) {
          if (!silent) toast.error(res.error ?? "Sync failed")
          return
        }
        // Pull the freshly written rows into the table.
        router.refresh()
        setLastAutoSync(new Date())
        if (!silent) {
          if (res.warning) {
            // A real, actionable failure (e.g. MetaAPI slots full, bad
            // credentials) — show why instead of a vague "still connecting".
            toast.warning("Some accounts could not be connected", {
              description: res.warning,
              duration: 8000,
            })
          } else if (usedAims && res.synced === 0 && (res.matchedNoResult ?? 0) > 0) {
            // The accounts ARE in the AIMS feed — results just aren't live yet
            // (competition hasn't started / AIMS hasn't posted them). This is
            // expected before a contest begins, not a matching problem.
            const extra = (res.notInFeed ?? 0) > 0 ? ` ${res.notInFeed} not in the feed.` : ""
            toast.info("Traders found — results not live yet", {
              description: `${res.matchedNoResult} account(s) are in the AIMS feed but have no results yet.${extra}`,
              duration: 8000,
            })
          } else if (usedAims && res.synced === 0 && res.pending) {
            // Nothing matched the AIMS feed — most often the MT4 IDs uploaded to
            // the CRM don't match the ones traders joined with.
            toast.warning("No accounts matched the AIMS feed", {
              description:
                "Check that the MT4 IDs uploaded to admin.aimsrankedge.com exactly match the traders' login numbers.",
            })
          } else if (res.pending) {
            toast.success(`Synced ${res.synced} account(s)`, {
              description: usedAims
                ? `${res.matchedNoResult ?? res.pending} awaiting results, ${res.notInFeed ?? 0} not in the feed.`
                : `${res.pending} still connecting — will retry.`,
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
    [contestId, router, syncSource, contestIsAims],
  )

  // Flip the displayed source. Server re-projects stored snapshots instantly.
  const changeDisplaySource = useCallback(
    async (src: SourceKey) => {
      if (src === displayState) return
      const prev = displayState
      setDisplayState(src)
      const res = await setDisplaySource(contestId, src)
      if (!res.ok) {
        setDisplayState(prev)
        toast.error(res.error ?? "Could not switch source")
        return
      }
      router.refresh()
      toast.success(`Now showing ${src === "aimsranking" ? "AIMS Ranking" : "MetaAPI"} data`)
    },
    [contestId, displayState, router],
  )

  // Auto-sync on an interval while enabled. Runs one sync immediately on toggle-on.
  useEffect(() => {
    if (!autoSync || !canSync) return
    void runSync(true)
    const id = setInterval(() => void runSync(true), AUTO_SYNC_INTERVAL_MS)
    return () => clearInterval(id)
  }, [autoSync, canSync, runSync])

  function handleSync() {
    void runSync(false)
  }

  function handleSyncSelected() {
    if (selected.size === 0) return
    void runSync(false, Array.from(selected))
  }

  function startEditNick(id: number, current: string) {
    setEditingNick(id)
    setNickDraft(current)
  }

  function cancelEditNick() {
    setEditingNick(null)
    setNickDraft("")
  }

  function saveNick(id: number, original: string) {
    const next = nickDraft.trim()
    if (!next || next === original) {
      cancelEditNick()
      return
    }
    startTransition(async () => {
      const res = await setParticipantNickname(id, next)
      if (res.ok) {
        toast.success("Nickname updated")
        cancelEditNick()
        router.refresh()
      } else {
        toast.error(res.error ?? "Could not update nickname")
      }
    })
  }

  function handleBulkStatus(status: string | null) {
    if (!status) return
    const ids = Array.from(selected)
    if (ids.length === 0) return
    startTransition(async () => {
      const res = await setParticipantsStatus(ids, status)
      if (res.ok) {
        toast.success(`Updated ${res.updated} participant(s) to ${status}`)
        setSelected(new Set())
        router.refresh()
      } else {
        toast.error("Nothing to update")
      }
    })
  }

  async function handleBulkDelete() {
    if (!confirmDelete) return
    setDeleting(true)
    try {
      const res =
        confirmDelete === "all"
          ? await deleteParticipants({ allInContest: contestId })
          : await deleteParticipants({ ids: Array.from(selected) })
      if (!res.ok) {
        toast.error(res.error ?? "Delete failed")
        return
      }
      toast.success(`Deleted ${res.deleted} participant(s)`)
      setSelected(new Set())
      setConfirmDelete(null)
      router.refresh()
    } finally {
      setDeleting(false)
    }
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
          <AddParticipantDialog
            contestId={contestId}
            servers={servers}
            hasBatches={batches.length > 0}
            contestDataSource={dataSource}
          />
          {/* Display source toggle — flips the shown data instantly (no API). */}
          <div className="inline-flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Show</span>
            <div className="inline-flex overflow-hidden rounded-md border border-border">
              <button
                type="button"
                onClick={() => void changeDisplaySource("aimsranking")}
                aria-pressed={displayIsAims}
                className={
                  "px-2.5 py-1 text-xs font-medium transition-colors " +
                  (displayIsAims ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-secondary")
                }
              >
                AIMS
              </button>
              <button
                type="button"
                onClick={() => void changeDisplaySource("metaapi")}
                aria-pressed={!displayIsAims}
                className={
                  "px-2.5 py-1 text-xs font-medium transition-colors " +
                  (!displayIsAims ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-secondary")
                }
              >
                MetaAPI
              </button>
            </div>
          </div>
          {/* Which source the next Sync pulls from. */}
          <div className="inline-flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Sync from</span>
            <Select value={syncSource} onValueChange={(v) => setSyncSource(v as "auto" | SourceKey)}>
              <SelectTrigger className="h-8 w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto</SelectItem>
                <SelectItem value="aimsranking">AIMS Ranking</SelectItem>
                <SelectItem value="metaapi">MetaAPI</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {contestIsAims && (
            <Button
              size="sm"
              variant="secondary"
              nativeButton={false}
              disabled={participants.length === 0}
              render={<a href={`/admin/contests/${contestId}/aims-export`} />}
            >
              <Download className="mr-1.5 h-4 w-4" />
              Download for AIMS
            </Button>
          )}
          <Button
            size="sm"
            variant={autoSync ? "default" : "secondary"}
            onClick={() => setAutoSync((v) => !v)}
            disabled={!canSync}
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
            <>
              <Select value="" onValueChange={handleBulkStatus} disabled={pending}>
                <SelectTrigger className="h-8 w-44" aria-label="Set status for selected">
                  <SelectValue placeholder={`Set status (${selected.size})`} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Set to Active</SelectItem>
                  <SelectItem value="pending">Set to Pending</SelectItem>
                  <SelectItem value="rejected">Set to Rejected</SelectItem>
                  <SelectItem value="disqualified">Set to Disqualified</SelectItem>
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="secondary"
                onClick={handleSyncSelected}
                disabled={syncing || !canSync}
              >
                <RefreshCw className={"mr-1.5 h-4 w-4 " + (syncing ? "animate-spin" : "")} />
                Sync selected ({selected.size})
              </Button>
              <Button
                size="sm"
                variant="secondary"
                nativeButton={false}
                render={
                  <a
                    href={`/admin/contests/${contestId}/full-export?ids=${Array.from(selected).join(",")}`}
                  />
                }
              >
                <FileSpreadsheet className="mr-1.5 h-4 w-4" />
                Export data ({selected.size})
              </Button>
            </>
          )}
          <Button size="sm" onClick={handleSync} disabled={syncing || !canSync}>
            <RefreshCw className={"mr-1.5 h-4 w-4 " + (syncing ? "animate-spin" : "")} />
            {syncing ? "Syncing..." : "Sync all"}
          </Button>
          {selected.size > 0 && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setConfirmDelete("selected")}
              disabled={deleting}
            >
              <Trash2 className="mr-1.5 h-4 w-4" />
              Delete selected ({selected.size})
            </Button>
          )}
          {participants.length > 0 && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setConfirmDelete("all")}
              disabled={deleting}
            >
              <Trash2 className="mr-1.5 h-4 w-4" />
              Delete all
            </Button>
          )}
        </div>
      </div>

      {autoSync && (
        <p className="border-b border-border bg-primary/5 px-5 py-2 text-xs text-muted-foreground">
          <span className="font-medium text-primary">Auto-sync active</span> — refreshing every minute
          {lastAutoSync ? ` · last synced ${lastAutoSync.toLocaleTimeString()}` : "..."}
        </p>
      )}

      {contestIsAims ? (
        <p className="border-b border-border bg-primary/5 px-5 py-2 text-xs text-muted-foreground">
          <span className="font-medium text-primary">AIMS Ranking source</span> — download the contestant
          sheet, upload it to admin.aimsrankedge.com, then sync to pull results (matched by MT4 ID).
        </p>
      ) : !metaApiConfigured ? (
        <p className="border-b border-border bg-secondary/40 px-5 py-2 text-xs text-muted-foreground">
          MetaAPI is not configured — add METAAPI_TOKEN to enable automatic live syncing.
        </p>
      ) : null}

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
                <TableHead>Source</TableHead>
                <TableHead>Investor pwd</TableHead>
                <TableHead className="text-right">Equity</TableHead>
                <TableHead className="text-right">{displayIsAims ? "REG (RankEdges Gain)" : "Gain"}</TableHead>
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
                // For MetaAPI accounts, show absolute gain (simple % on deposited
                // capital) to match the public portal — MetaStats' time-weighted
                // gain can be wildly misleading when an account has a large
                // mid-contest drawdown despite being profitable
                // (e.g. Danny: -89.91% vs +29.46%). AIMS accounts use rankEdgesGain.
                const pct = Number((displayIsAims ? p.rankEdgesGain : p.absoluteGain) ?? 0)
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
                        {editingNick === p.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              autoFocus
                              value={nickDraft}
                              onChange={(e) => setNickDraft(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.nativeEvent.isComposing || e.keyCode === 229) return
                                if (e.key === "Enter") saveNick(p.id, p.nickname)
                                else if (e.key === "Escape") cancelEditNick()
                              }}
                              maxLength={60}
                              aria-label={`Edit nickname for ${p.nickname}`}
                              className="h-8 w-36 rounded-md border border-border bg-background px-2 text-sm text-foreground outline-none focus:border-primary"
                            />
                            <button
                              type="button"
                              aria-label="Save nickname"
                              disabled={pending}
                              onClick={() => saveNick(p.id, p.nickname)}
                              className="text-primary hover:opacity-80 disabled:opacity-50"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              aria-label="Cancel editing"
                              onClick={cancelEditNick}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="group flex items-center gap-1.5">
                            <span>{p.nickname}</span>
                            <button
                              type="button"
                              aria-label={`Rename ${p.nickname}`}
                              onClick={() => startEditNick(p.id, p.nickname)}
                              className="text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
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
                      {p.serverName ? (
                        <div className="text-muted-foreground">{p.serverName}</div>
                      ) : null}
                      {contestIsAims ? (
                        p.lastSyncedAt ? (
                          Number(p.currentEquity) === 0 && Number(p.lots) === 0 ? (
                            // Matched in the AIMS feed but no trading results yet
                            // (competition not started / results not posted).
                            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-sans text-[10px] font-medium text-primary">
                              <CheckCircle2 className="h-3 w-3" />
                              In feed · awaiting results
                            </span>
                          ) : (
                            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-sans text-[10px] font-medium text-primary">
                              <CheckCircle2 className="h-3 w-3" />
                              In AIMS feed
                            </span>
                          )
                        ) : (
                          <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 font-sans text-[10px] font-medium text-warning">
                            <Clock className="h-3 w-3" />
                            Not in feed yet
                          </span>
                        )
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={p.dataSource ?? INHERIT_SOURCE}
                        onValueChange={(v) => {
                          if (!v) return
                          startTransition(async () => {
                            await setParticipantDataSource(
                              p.id,
                              v === INHERIT_SOURCE ? null : (v as "metaapi" | "aimsranking"),
                            )
                            toast.success("Data source updated", {
                              description: "Re-sync to pull this trader from the new source.",
                            })
                            router.refresh()
                          })
                        }}
                      >
                        <SelectTrigger className="h-8 w-32">
                          {/* Explicit label — a bare SelectValue falls back to the raw enum string. */}
                          <SelectValue>
                            {p.dataSource === "metaapi"
                              ? "MetaAPI"
                              : p.dataSource === "aimsranking"
                                ? "AIMS"
                                : `Auto (${dataSource === "aimsranking" ? "AIMS" : "MetaAPI"})`}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={INHERIT_SOURCE}>
                            Auto ({dataSource === "aimsranking" ? "AIMS" : "MetaAPI"})
                          </SelectItem>
                          <SelectItem value="metaapi">MetaAPI</SelectItem>
                          <SelectItem value="aimsranking">AIMS Ranking</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs">
                          {p.investorPassword ? (reveal[p.id] ? p.investorPassword : "••••••••") : "—"}
                        </span>
                        {p.investorPassword ? (
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
                        ) : null}
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
                      {mounted ? formatDateTime(p.lastSyncedAt) : "—"}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={p.status}
                        onValueChange={(v) => {
                          if (!v) return
                          startTransition(async () => {
                            await setParticipantStatus(p.id, v)
                            toast.success("Status updated")
                          })
                        }}
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

      <Dialog open={confirmDelete !== null} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmDelete === "all"
                ? `Delete all ${participants.length} participants?`
                : `Delete ${selected.size} selected participant(s)?`}
            </DialogTitle>
            <DialogDescription>
              This permanently removes {confirmDelete === "all" ? "every participant" : "the selected participants"}{" "}
              from this contest, including their synced metrics. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirmDelete(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void handleBulkDelete()} disabled={deleting}>
              <Trash2 className="mr-1.5 h-4 w-4" />
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
