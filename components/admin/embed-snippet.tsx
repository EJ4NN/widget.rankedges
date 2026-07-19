"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Check, Copy, Code2 } from "lucide-react"
import { toast } from "sonner"

// The public widget is served from its own domain, independent of wherever the
// admin dashboard happens to run. Override with NEXT_PUBLIC_WIDGET_ORIGIN if needed.
const WIDGET_ORIGIN = (
  process.env.NEXT_PUBLIC_WIDGET_ORIGIN || "https://widget.rankedges.com"
).replace(/\/$/, "")

export function EmbedSnippet({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false)

  const origin = WIDGET_ORIGIN
  const src = `${origin}/embed/${slug}`
  const snippet = `<iframe
  src="${src}"
  style="width:100%;border:0;min-height:720px"
  title="AIMS Trading Contest"
  loading="lazy"
></iframe>
<script>
  window.addEventListener("message", function (e) {
    if (e.data && e.data.type === "aims-contest-height") {
      var f = document.querySelector('iframe[src^="${origin}/embed/"]');
      if (f) f.style.height = e.data.height + "px";
    }
  });
</script>`

  async function copy() {
    let ok = false
    // The async Clipboard API is blocked inside sandboxed iframes (e.g. the v0
    // preview), so fall back to a temporary textarea + execCommand("copy").
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(snippet)
        ok = true
      }
    } catch {
      ok = false
    }

    if (!ok) {
      try {
        const ta = document.createElement("textarea")
        ta.value = snippet
        ta.style.position = "fixed"
        ta.style.opacity = "0"
        document.body.appendChild(ta)
        ta.focus()
        ta.select()
        ok = document.execCommand("copy")
        document.body.removeChild(ta)
      } catch {
        ok = false
      }
    }

    if (ok) {
      setCopied(true)
      toast.success("Embed code copied")
      setTimeout(() => setCopied(false), 2000)
    } else {
      toast.error("Copy failed — select the code below and copy manually")
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Code2 className="h-4 w-4 text-muted-foreground" aria-hidden />
          <h3 className="font-semibold text-foreground">Embed on the AIMS site</h3>
        </div>
        <Button size="sm" variant="secondary" onClick={copy}>
          {copied ? <Check className="mr-1.5 h-4 w-4" /> : <Copy className="mr-1.5 h-4 w-4" />}
          {copied ? "Copied" : "Copy code"}
        </Button>
      </div>
      <p className="mb-3 text-sm text-muted-foreground">
        Paste this snippet into any page on the AIMS website. The iframe auto-resizes to fit the
        widget as the leaderboard updates.
      </p>
      <pre className="overflow-x-auto rounded-lg border border-border bg-secondary p-3 text-xs leading-relaxed text-foreground">
        <code>{snippet}</code>
      </pre>
    </div>
  )
}
