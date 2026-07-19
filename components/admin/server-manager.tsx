"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createServer, deleteServer } from "@/app/actions/admin"
import type { BrokerServer } from "@/lib/db/schema"
import { toast } from "sonner"
import { Trash2, Server } from "lucide-react"

export function ServerManager({ servers }: { servers: BrokerServer[] }) {
  const [platform, setPlatform] = useState("")
  const [pending, startTransition] = useTransition()

  async function handleCreate(formData: FormData) {
    formData.set("platform", platform)
    const res = await createServer(formData)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    toast.success("Server added")
    setPlatform("")
    const form = document.getElementById("server-form") as HTMLFormElement | null
    form?.reset()
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="font-semibold text-foreground">Add broker server</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Servers clients can pick from when connecting an account.
        </p>
        <form id="server-form" action={handleCreate} className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="sname">Server name</Label>
            <Input id="sname" name="name" placeholder="e.g. AIMS-Live" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="scompany">Broker / company (optional)</Label>
            <Input id="scompany" name="company" placeholder="e.g. AIMS Global" />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Platform</Label>
            <Select value={platform} onValueChange={setPlatform} required>
              <SelectTrigger>
                <SelectValue placeholder="Select platform" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mt4">MT4</SelectItem>
                <SelectItem value="mt5">MT5</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={!platform}>
            Add server
          </Button>
        </form>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="border-b border-border px-5 py-3">
          <h3 className="font-semibold text-foreground">Servers ({servers.length})</h3>
        </div>
        {servers.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            <Server className="mx-auto mb-2 h-6 w-6" aria-hidden />
            No servers yet. Add one so clients can join.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {servers.map((s) => (
              <li key={s.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="font-medium text-foreground">{s.name}</p>
                  {s.company && <p className="text-xs text-muted-foreground">{s.company}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="uppercase">
                    {s.platform}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${s.name}`}
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        await deleteServer(s.id)
                        toast.success("Server removed")
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
