"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createContest, deleteContest, updateContest, updateContestStatus } from "@/app/actions/admin"
import { ImageUploadField } from "@/components/admin/image-upload-field"
import type { Contest } from "@/lib/db/schema"
import { formatDate, toDateTimeLocal } from "@/lib/format"
import { toast } from "sonner"
import { ExternalLink, Pencil, Plus, Trash2 } from "lucide-react"

function ContestForm({
  contest,
  onSubmit,
  submitLabel,
  brokers,
}: {
  contest?: Contest
  onSubmit: (formData: FormData) => Promise<void>
  submitLabel: string
  brokers: string[]
}) {
  const allowed = contest?.allowedBrokers ?? []
  return (
    <form action={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" placeholder="e.g. Asia Cup 2026" defaultValue={contest?.name} required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          name="description"
          placeholder="Short tagline"
          defaultValue={contest?.description ?? ""}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="startingBalance">Starting balance ($)</Label>
          <Input
            id="startingBalance"
            name="startingBalance"
            type="number"
            defaultValue={contest?.startingBalance ?? "10000"}
            min="1"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="prizePool">Prize pool</Label>
          <Input id="prizePool" name="prizePool" placeholder="e.g. $5,000" defaultValue={contest?.prizePool ?? ""} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="startDate">Start date</Label>
          <Input
            id="startDate"
            name="startDate"
            type="datetime-local"
            defaultValue={toDateTimeLocal(contest?.startDate)}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="endDate">End date</Label>
          <Input
            id="endDate"
            name="endDate"
            type="datetime-local"
            defaultValue={toDateTimeLocal(contest?.endDate)}
            required
          />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="maxParticipants">Max participants (optional)</Label>
        <Input
          id="maxParticipants"
          name="maxParticipants"
          type="number"
          min="1"
          defaultValue={contest?.maxParticipants ?? ""}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label>Eligible brokers</Label>
        <p className="text-xs text-muted-foreground">
          Tick which brokers can join. Leave all unticked to allow every broker.
        </p>
        {brokers.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
            No brokers yet. Add broker servers (with a company name) in the Servers tab first.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {brokers.map((b) => (
              <label
                key={b}
                className="group relative cursor-pointer select-none"
              >
                <input
                  type="checkbox"
                  name="allowedBrokers"
                  value={b}
                  defaultChecked={allowed.includes(b)}
                  className="peer sr-only"
                />
                <span className="flex items-center gap-2 rounded-full border border-border bg-secondary px-4 py-2 text-sm font-medium text-muted-foreground transition-colors peer-checked:border-primary peer-checked:bg-primary/10 peer-checked:text-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
                  {b}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>
      <ImageUploadField
        name="posterUrl"
        label="Poster image"
        defaultValue={contest?.posterUrl}
        aspect="aspect-[16/6]"
        hint="Wide banner shown at the top of the contest page."
      />
      <ImageUploadField
        name="thumbnailUrl"
        label="Thumbnail image"
        defaultValue={contest?.thumbnailUrl}
        aspect="aspect-video"
        hint="Card image shown on the contest listings."
      />
      <ImageUploadField
        name="sponsorLogoUrl"
        label="Sponsor logo (optional)"
        defaultValue={contest?.sponsorLogoUrl}
        aspect="aspect-[16/6]"
        hint="Shown co-branded next to RankEdges in the header. Use a light/white transparent PNG (dark background). Recommended height 200–320px."
      />
      <div className="flex flex-col gap-2">
        <Label htmlFor="rules">Rules</Label>
        <textarea
          id="rules"
          name="rules"
          rows={4}
          placeholder="One rule per line…"
          defaultValue={contest?.rules ?? ""}
          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
      </div>
      <Button type="submit">{submitLabel}</Button>
    </form>
  )
}

function EditContestDialog({ contest, brokers }: { contest: Contest; brokers: string[] }) {
  const [open, setOpen] = useState(false)

  async function handleUpdate(formData: FormData) {
    const res = await updateContest(contest.id, formData)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    toast.success("Contest updated")
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon" aria-label="Edit contest">
            <Pencil className="h-4 w-4" />
          </Button>
        }
      />
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit contest</DialogTitle>
          <DialogDescription>Update {contest.name}.</DialogDescription>
        </DialogHeader>
        <ContestForm contest={contest} onSubmit={handleUpdate} submitLabel="Save changes" brokers={brokers} />
      </DialogContent>
    </Dialog>
  )
}

export function ContestManager({ contests, brokers }: { contests: Contest[]; brokers: string[] }) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  async function handleCreate(formData: FormData) {
    const res = await createContest(formData)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    toast.success("Contest created")
    setOpen(false)
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-foreground">Contests ({contests.length})</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button size="sm" />}>
            <Plus className="mr-1.5 h-4 w-4" /> New contest
          </DialogTrigger>
          <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Create contest</DialogTitle>
              <DialogDescription>Set up a new trading contest.</DialogDescription>
            </DialogHeader>
            <ContestForm onSubmit={handleCreate} submitLabel="Create contest" brokers={brokers} />
          </DialogContent>
        </Dialog>
      </div>

      {contests.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          No contests yet. Create your first one.
        </div>
      ) : (
        <div className="grid gap-3">
          {contests.map((c) => (
            <div
              key={c.id}
              className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-foreground">{c.name}</p>
                  <Badge variant="outline" className="uppercase">
                    {c.status}
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatDate(c.startDate)} – {formatDate(c.endDate)} · /{c.slug}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={c.status}
                  onValueChange={(v) =>
                    startTransition(async () => {
                      await updateContestStatus(c.id, v ?? c.status)
                      toast.success("Status updated")
                    })
                  }
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="upcoming">Upcoming</SelectItem>
                    <SelectItem value="live">Live</SelectItem>
                    <SelectItem value="ended">Ended</SelectItem>
                  </SelectContent>
                </Select>
                <EditContestDialog contest={c} brokers={brokers} />
                <Button
                  variant="secondary"
                  size="sm"
                  nativeButton={false}
                  render={<Link href={`/admin/contests/${c.id}`} />}
                >
                  Manage
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="View public page"
                  nativeButton={false}
                  render={<Link href={`/contests/${c.slug}`} target="_blank" />}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Delete contest"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await deleteContest(c.id)
                      toast.success("Contest deleted")
                    })
                  }
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
