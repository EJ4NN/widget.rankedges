"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { createBatch, updateBatch, deleteBatch } from "@/app/actions/admin"
import { toDateTimeLocal, formatDate } from "@/lib/format"
import { WINNER_TYPES, WINNER_TYPE_LABELS, WINNER_TYPE_SHORT, type WinnerType } from "@/lib/winner-type"
import type { Batch } from "@/lib/db/schema"
import { toast } from "sonner"
import { Layers, Pencil, Plus, Trash2, Trophy } from "lucide-react"

function BatchForm({
  contestId,
  batch,
  onDone,
}: {
  contestId: number
  batch?: Batch
  onDone: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [winnerType, setWinnerType] = useState<WinnerType>((batch?.winnerType as WinnerType) ?? "gain")

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    formData.set("winnerType", winnerType)

    setLoading(true)
    const res = batch ? await updateBatch(batch.id, formData) : await createBatch(contestId, formData)
    setLoading(false)

    if (!res.ok) {
      toast.error(res.error ?? "Could not save batch")
      return
    }
    toast.success(batch ? "Batch updated" : "Batch added")
    onDone()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Batch name</Label>
        <Input id="name" name="name" placeholder="e.g. June Batch" defaultValue={batch?.name ?? ""} required />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="startDate">Start date</Label>
          <Input
            id="startDate"
            name="startDate"
            type="datetime-local"
            defaultValue={toDateTimeLocal(batch?.startDate)}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="endDate">End date</Label>
          <Input
            id="endDate"
            name="endDate"
            type="datetime-local"
            defaultValue={toDateTimeLocal(batch?.endDate)}
            required
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Winner determined by</Label>
        <div className="grid grid-cols-3 gap-2">
          {WINNER_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setWinnerType(t)}
              className={
                "rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors " +
                (winnerType === t
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-secondary text-muted-foreground hover:text-foreground")
              }
            >
              {WINNER_TYPE_SHORT[t]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="prizePool">Prize pool (optional)</Label>
          <Input id="prizePool" name="prizePool" placeholder="e.g. $5,000" defaultValue={batch?.prizePool ?? ""} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="advanceCount">Top N advance</Label>
          <Input
            id="advanceCount"
            name="advanceCount"
            type="number"
            min={0}
            placeholder="e.g. 10"
            defaultValue={batch?.advanceCount ? String(batch.advanceCount) : ""}
          />
        </div>
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="secondary" className="flex-1" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" className="flex-1" disabled={loading}>
          {loading ? "Saving..." : batch ? "Save batch" : "Add batch"}
        </Button>
      </div>
    </form>
  )
}

export function BatchesCard({ contestId, batches }: { contestId: number; batches: Batch[] }) {
  const router = useRouter()
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<Batch | null>(null)

  function done() {
    setAddOpen(false)
    setEditing(null)
    router.refresh()
  }

  async function handleDelete(b: Batch) {
    if (!confirm(`Delete "${b.name}"? Participants in this batch will be unassigned.`)) return
    const res = await deleteBatch(b.id)
    if (res.ok) {
      toast.success("Batch deleted")
      router.refresh()
    } else {
      toast.error("Could not delete batch")
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" aria-hidden />
          <h2 className="font-semibold text-foreground">Batches (rounds)</h2>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger render={<Button size="sm" variant="secondary" />}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add batch
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add batch</DialogTitle>
              <DialogDescription>
                Create a round with its own date range, prize, and winning metric.
              </DialogDescription>
            </DialogHeader>
            <BatchForm contestId={contestId} onDone={done} />
          </DialogContent>
        </Dialog>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Run the contest in sequential rounds. Each batch is listed on the public contest page with its own
        leaderboard. Leave empty to run as a single round.
      </p>

      {batches.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          No batches yet. Add one to split this contest into rounds.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {batches.map((b) => (
            <li
              key={b.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/40 px-4 py-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium text-foreground">{b.name}</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                    <Trophy className="h-3 w-3" aria-hidden />
                    {WINNER_TYPE_LABELS[b.winnerType as WinnerType] ?? b.winnerType}
                  </span>
                </div>
                <div className="mt-0.5 text-[12px] text-muted-foreground">
                  {formatDate(b.startDate)} – {formatDate(b.endDate)}
                  {b.prizePool ? ` · ${b.prizePool}` : ""}
                  {b.advanceCount ? ` · Top ${b.advanceCount} advance` : ""}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setEditing(b)}
                  aria-label={`Edit ${b.name}`}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleDelete(b)}
                  aria-label={`Delete ${b.name}`}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit batch</DialogTitle>
            <DialogDescription>Update this round&apos;s dates, prize, and winning metric.</DialogDescription>
          </DialogHeader>
          {editing ? <BatchForm contestId={contestId} batch={editing} onDone={done} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
