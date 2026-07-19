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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getServersForPlatform, joinContest } from "@/app/actions/contest"
import { toast } from "sonner"
import { CheckCircle2, Lock, ShieldCheck } from "lucide-react"

type Server = { id: number; name: string; company: string | null }

export function JoinDialog({
  contestId,
  contestSlug,
  disabled,
}: {
  contestId: number
  contestSlug: string
  disabled?: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<1 | 2>(1)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  // step 1
  const [nickname, setNickname] = useState("")
  const [realName, setRealName] = useState("")
  const [email, setEmail] = useState("")

  // step 2
  const [platform, setPlatform] = useState<"mt4" | "mt5" | "">("")
  const [servers, setServers] = useState<Server[]>([])
  const [loadingServers, setLoadingServers] = useState(false)
  const [serverId, setServerId] = useState("")
  const [accountLogin, setAccountLogin] = useState("")
  const [investorPassword, setInvestorPassword] = useState("")

  function reset() {
    setStep(1)
    setDone(false)
    setNickname("")
    setRealName("")
    setEmail("")
    setPlatform("")
    setServers([])
    setLoadingServers(false)
    setServerId("")
    setAccountLogin("")
    setInvestorPassword("")
  }

  async function handlePlatform(p: "mt4" | "mt5") {
    setPlatform(p)
    setServerId("")
    setLoadingServers(true)
    const list = await getServersForPlatform(p, contestId)
    setServers(list.map((s) => ({ id: s.id, name: s.name, company: s.company })))
    setLoadingServers(false)
  }

  function goToStep2(e: React.FormEvent) {
    e.preventDefault()
    if (!nickname.trim() || !realName.trim()) return
    setStep(2)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!platform || !serverId || !accountLogin.trim() || !investorPassword.trim()) return
    setLoading(true)
    const res = await joinContest({
      contestId,
      contestSlug,
      nickname: nickname.trim(),
      realName: realName.trim(),
      email: email.trim() || undefined,
      platform,
      serverId: Number(serverId),
      accountLogin: accountLogin.trim(),
      investorPassword: investorPassword.trim(),
    })
    setLoading(false)

    if (!res.ok) {
      toast.error(res.error)
      return
    }
    setDone(true)
    router.refresh()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) setTimeout(reset, 200)
      }}
    >
      <DialogTrigger
        render={<Button size="lg" disabled={disabled} className="w-full font-semibold sm:w-auto" />}
      >
        Join Contest
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {done ? (
          <div className="py-4 text-center">
            <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-primary" aria-hidden />
            <DialogTitle className="text-xl">You&apos;re in!</DialogTitle>
            <DialogDescription className="mt-2">
              Your account has been submitted. Once we verify your trading account, your live stats
              will appear on the leaderboard.
            </DialogDescription>
            <Button className="mt-6 w-full" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{step === 1 ? "Enter the contest" : "Connect your account"}</DialogTitle>
              <DialogDescription>
                {step === 1
                  ? "Tell us who you are. Your real name stays private — only your nickname is shown."
                  : "Enter your MT4/MT5 details. We only use the read-only investor password."}
              </DialogDescription>
            </DialogHeader>

            <div className="mb-1 flex items-center gap-2">
              <StepDot active={step >= 1} />
              <div className="h-px flex-1 bg-border" />
              <StepDot active={step >= 2} />
            </div>

            {step === 1 ? (
              <form onSubmit={goToStep2} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="nickname">Nickname (public)</Label>
                  <Input
                    id="nickname"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="e.g. PipHunter"
                    required
                    maxLength={30}
                    className="h-12"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="realName">Full name (private)</Label>
                  <Input
                    id="realName"
                    value={realName}
                    onChange={(e) => setRealName(e.target.value)}
                    placeholder="Your legal name"
                    required
                    className="h-12"
                  />
                  <p className="text-xs text-muted-foreground">
                    Only contest admins can see this. It is never shown publicly.
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="email">Email (optional)</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="h-12"
                  />
                </div>
                <Button type="submit" size="lg" className="mt-1 h-12 w-full text-base font-semibold">
                  Continue
                </Button>
              </form>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label>Choose your platform</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {(["mt4", "mt5"] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => handlePlatform(p)}
                        className={
                          "flex h-14 items-center justify-center rounded-xl border text-base font-bold uppercase tracking-wide transition-colors " +
                          (platform === p
                            ? "border-primary bg-primary/10 text-primary shadow-[0_0_20px_hsl(82_100%_64%/0.12)]"
                            : "border-border bg-secondary text-muted-foreground hover:border-primary/40 hover:text-foreground")
                        }
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="server">Broker server</Label>
                  <Select
                    value={serverId}
                    onValueChange={(v) => setServerId(v ?? "")}
                    disabled={!platform || loadingServers}
                  >
                    <SelectTrigger id="server" className="h-12 w-full">
                      <SelectValue
                        placeholder={
                          !platform
                            ? "Pick a platform first"
                            : loadingServers
                              ? "Loading servers…"
                              : "Select your broker server"
                        }
                      >
                        {(value) => {
                          const s = servers.find((x) => String(x.id) === value)
                          if (!s) return null
                          return `${s.name}${s.company ? ` — ${s.company}` : ""}`
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {servers.length === 0 ? (
                        <div className="px-2 py-3 text-sm text-muted-foreground">
                          {loadingServers ? "Loading…" : "No servers available for this platform."}
                        </div>
                      ) : (
                        servers.map((s) => (
                          <SelectItem key={s.id} value={String(s.id)}>
                            {s.name}
                            {s.company ? ` — ${s.company}` : ""}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {platform === "mt5" ? (
                    <p className="text-xs text-muted-foreground">Showing eligible MT5 servers.</p>
                  ) : platform === "mt4" ? (
                    <p className="text-xs text-muted-foreground">Showing eligible MT4 servers.</p>
                  ) : null}
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="login">Account ID (login)</Label>
                  <Input
                    id="login"
                    inputMode="numeric"
                    value={accountLogin}
                    onChange={(e) => setAccountLogin(e.target.value)}
                    placeholder="e.g. 5012345"
                    required
                    className="h-12"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="investor">Investor password (read-only)</Label>
                  <Input
                    id="investor"
                    type="password"
                    value={investorPassword}
                    onChange={(e) => setInvestorPassword(e.target.value)}
                    placeholder="Read-only password"
                    required
                    className="h-12"
                  />
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Lock className="h-3 w-3" aria-hidden />
                    The investor password only allows viewing — no trading or withdrawals.
                  </p>
                </div>

                <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                  Your credentials are used only to track this contest&apos;s performance.
                </div>

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    size="lg"
                    className="h-12"
                    onClick={() => setStep(1)}
                  >
                    Back
                  </Button>
                  <Button type="submit" size="lg" className="h-12 flex-1 text-base font-semibold" disabled={loading}>
                    {loading ? "Connecting..." : "Connect & Join"}
                  </Button>
                </div>
              </form>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function StepDot({ active }: { active: boolean }) {
  return (
    <span
      className={
        "h-2.5 w-2.5 rounded-full transition-colors " + (active ? "bg-primary" : "bg-border")
      }
    />
  )
}
