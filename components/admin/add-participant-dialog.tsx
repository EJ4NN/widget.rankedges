"use client"

import { useMemo, useState } from "react"
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
import { addParticipant } from "@/app/actions/admin"
import { toast } from "sonner"
import { Lock, Plus } from "lucide-react"

type Server = { id: number; name: string; company: string | null; platform: string }

export function AddParticipantDialog({
  contestId,
  servers,
  hasBatches = false,
}: {
  contestId: number
  servers: Server[]
  hasBatches?: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [platform, setPlatform] = useState<"mt4" | "mt5">("mt5")

  const serverSuggestions = useMemo(
    () => servers.filter((s) => s.platform === platform),
    [servers, platform],
  )

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    formData.set("platform", platform)

    setLoading(true)
    const res = await addParticipant(contestId, formData)
    setLoading(false)

    if (!res.ok) {
      toast.error(res.error)
      return
    }
    toast.success("Participant added", {
      description: res.provisioned
        ? "MetaAPI account provisioned — stats will sync shortly."
        : "Added, but MetaAPI provisioning failed. Try syncing later.",
    })
    setOpen(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="secondary" />}>
        <Plus className="mr-1.5 h-4 w-4" />
        Add participant
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add participant</DialogTitle>
          <DialogDescription>
            Register a trader&apos;s MT4/MT5 account on their behalf. The account is provisioned on
            MetaAPI so live stats sync automatically.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="nickname">Nickname (public)</Label>
              <Input id="nickname" name="nickname" placeholder="e.g. PipHunter" required maxLength={30} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="realName">Full name (private)</Label>
              <Input id="realName" name="realName" placeholder="Legal name" required />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email (optional)</Label>
            <Input id="email" name="email" type="email" placeholder="trader@example.com" />
          </div>

          {hasBatches ? (
            <p className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
              This trader will be auto-assigned to the current batch based on today&apos;s date. You
              can move them to another batch later from the participants table.
            </p>
          ) : null}

          <div className="flex flex-col gap-2">
            <Label>Platform</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["mt4", "mt5"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPlatform(p)}
                  className={
                    "rounded-lg border px-4 py-2.5 text-sm font-semibold uppercase transition-colors " +
                    (platform === p
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-secondary text-muted-foreground hover:text-foreground")
                  }
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="serverName">Broker server</Label>
            <Input
              id="serverName"
              name="serverName"
              placeholder="e.g. AuricInternationalMarkets-Live"
              list="admin-server-suggestions"
              required
            />
            <datalist id="admin-server-suggestions">
              {serverSuggestions.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.company ?? ""}
                </option>
              ))}
            </datalist>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="accountLogin">Account ID (login)</Label>
              <Input
                id="accountLogin"
                name="accountLogin"
                inputMode="numeric"
                placeholder="e.g. 507232"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="investorPassword">Investor password</Label>
              <Input
                id="investorPassword"
                name="investorPassword"
                type="password"
                placeholder="Read-only"
                required
              />
            </div>
          </div>

          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="h-3 w-3" aria-hidden />
            Use the read-only investor password — it allows viewing only, no trading.
          </p>

          <div className="flex gap-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? "Adding..." : "Add & provision"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
