"use client"

import { useState, useTransition } from "react"
import { updateBranding } from "@/app/actions/admin"
import { ImageUploadField } from "@/components/admin/image-upload-field"
import { BrandLogo } from "@/components/widget/brand"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

type Props = {
  logoUrl: string | null
  coBrandUrl: string | null
}

export function BrandingManager({ logoUrl, coBrandUrl }: Props) {
  // Live preview values (updated as the admin uploads/pastes URLs).
  const [logo, setLogo] = useState(logoUrl ?? "")
  const [coBrand, setCoBrand] = useState(coBrandUrl ?? "")
  const [pending, startTransition] = useTransition()

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const res = await updateBranding(formData)
      if (res.ok) toast.success("Branding saved")
      else toast.error("Could not save branding")
    })
  }

  return (
    <div className="glass rounded-2xl p-5 sm:p-6">
      <h2 className="font-display text-lg font-bold uppercase tracking-wide text-foreground">Branding</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Customize the logo shown across the contest widget, landing page, and embeds.
      </p>

      {/* Live preview */}
      <div className="mt-5 flex items-center justify-center rounded-xl border border-border bg-background/40 px-6 py-8">
        <BrandLogo size={56} logoUrl={logo || null} coBrandUrl={coBrand || null} />
      </div>

      <form action={handleSubmit} className="mt-6 grid gap-6 sm:grid-cols-2">
        <ImageUploadField
          name="logoUrl"
          label="Primary logo"
          defaultValue={logoUrl}
          aspect="aspect-square"
          hint="Square PNG with transparent background. Recommended 256×256px (min 128×128px)."
          onValueChange={setLogo}
        />
        <ImageUploadField
          name="coBrandUrl"
          label="Co-brand logo (optional)"
          defaultValue={coBrandUrl}
          aspect="aspect-square"
          hint="Shown left of RankEdges with a divider, e.g. AIMS. Transparent PNG, recommended 256×256px."
          onValueChange={setCoBrand}
        />

        <div className="sm:col-span-2">
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            Save branding
          </Button>
        </div>
      </form>
    </div>
  )
}
