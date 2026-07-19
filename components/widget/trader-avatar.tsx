import { traderAvatar } from "@/lib/avatar"
import { cn } from "@/lib/utils"

export function TraderAvatar({
  nickname,
  src,
  size = 40,
  className,
  ring,
}: {
  nickname: string
  src?: string | null
  size?: number
  className?: string
  ring?: "primary" | "accent" | "violet" | "none"
}) {
  const url = traderAvatar(nickname, src)
  const ringClass =
    ring === "primary"
      ? "ring-2 ring-primary/70"
      : ring === "accent"
        ? "ring-2 ring-accent/70"
        : ring === "violet"
          ? "ring-2 ring-[var(--violet-neon)]/70"
          : "ring-1 ring-border"
  return (
    <span
      className={cn(
        "inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-secondary",
        ringClass,
        className,
      )}
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url || "/placeholder.svg"}
        alt={`${nickname} avatar`}
        width={size}
        height={size}
        crossOrigin="anonymous"
        className="h-full w-full object-cover"
      />
    </span>
  )
}
