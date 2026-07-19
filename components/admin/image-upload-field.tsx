"use client"

import { useRef, useState } from "react"
import { uploadImage } from "@/app/actions/admin"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { ImagePlus, Loader2, X } from "lucide-react"

type Props = {
  name: string
  label: string
  defaultValue?: string | null
  /** Tailwind aspect ratio class for the preview, e.g. "aspect-video" */
  aspect?: string
  hint?: string
  /** Notified whenever the value changes (upload, paste, or clear). */
  onValueChange?: (url: string) => void
}

export function ImageUploadField({
  name,
  label,
  defaultValue,
  aspect = "aspect-video",
  hint,
  onValueChange,
}: Props) {
  const [url, setUrlState] = useState(defaultValue ?? "")
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function setUrl(next: string) {
    setUrlState(next)
    onValueChange?.(next)
  }

  async function handleFile(file: File) {
    setUploading(true)
    const fd = new FormData()
    fd.append("file", file)
    const res = await uploadImage(fd)
    setUploading(false)
    if (!res.ok) {
      toast.error(res.error ?? "Upload failed")
      return
    }
    setUrl(res.url)
    toast.success("Image uploaded")
  }

  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      {/* URL is submitted with the parent form */}
      <input type="hidden" name={name} value={url} />

      {url ? (
        <div className={`relative w-full overflow-hidden rounded-md border border-border ${aspect}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url || "/placeholder.svg"} alt={`${label} preview`} className="h-full w-full object-cover" />
          <button
            type="button"
            onClick={() => setUrl("")}
            className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-md bg-background/80 text-foreground backdrop-blur transition-colors hover:bg-destructive hover:text-destructive-foreground"
            aria-label={`Remove ${label}`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className={`flex w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-secondary/40 text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground ${aspect}`}
        >
          {uploading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-xs">Uploading...</span>
            </>
          ) : (
            <>
              <ImagePlus className="h-5 w-5" />
              <span className="text-xs">Click to upload</span>
            </>
          )}
        </button>
      )}

      <div className="flex items-center gap-2">
        <Input
          placeholder="...or paste an image URL"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="text-xs"
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          Browse
        </Button>
      </div>
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void handleFile(f)
          e.target.value = ""
        }}
      />
    </div>
  )
}
