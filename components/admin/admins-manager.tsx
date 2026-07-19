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
import { createAdminUser, deleteAdminUser } from "@/app/actions/users"
import { toast } from "sonner"
import { Plus, Trash2, ShieldCheck } from "lucide-react"

type AdminUser = {
  id: string
  name: string
  email: string
  createdAt: Date | string
}

export function AdminsManager({
  users,
  currentUserId,
}: {
  users: AdminUser[]
  currentUserId: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)

    setLoading(true)
    const res = await createAdminUser(formData)
    setLoading(false)

    if (!res.ok) {
      toast.error(res.error)
      return
    }
    toast.success("Admin account created")
    form.reset()
    setOpen(false)
    router.refresh()
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    const res = await deleteAdminUser(id)
    setDeletingId(null)

    if (!res.ok) {
      toast.error(res.error)
      return
    }
    toast.success("Admin removed")
    router.refresh()
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Admin accounts</h2>
          <p className="text-sm text-muted-foreground">
            Registration is closed. Only existing admins can create new accounts here.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button size="sm" />}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add admin
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add admin account</DialogTitle>
              <DialogDescription>
                Create a new administrator. They can sign in immediately with these credentials.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="admin-name">Full name</Label>
                <Input id="admin-name" name="name" placeholder="e.g. Jane Doe" required />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="admin-email">Email</Label>
                <Input
                  id="admin-email"
                  name="email"
                  type="email"
                  placeholder="admin@example.com"
                  autoComplete="off"
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="admin-password">Password</Label>
                <Input
                  id="admin-password"
                  name="password"
                  type="password"
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={loading}>
                  {loading ? "Creating..." : "Create admin"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <ul className="divide-y divide-border">
        {users.map((u) => {
          const isSelf = u.id === currentUserId
          return (
            <li key={u.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <ShieldCheck className="h-4 w-4" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {u.name}
                    {isSelf && (
                      <span className="ml-2 rounded bg-secondary px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        You
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="text-muted-foreground hover:text-destructive"
                disabled={isSelf || deletingId === u.id}
                onClick={() => handleDelete(u.id)}
                aria-label={`Remove ${u.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
