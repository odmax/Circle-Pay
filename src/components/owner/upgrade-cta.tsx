import { Button } from "@/components/ui/button"
import Link from "next/link"

export function UpgradeCTA({ planName }: { planName?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center">
      <p className="text-sm text-muted-foreground">This feature is not included in your current plan{planName ? ` (${planName})` : ""}.</p>
      <Button render={<Link href="/upgrade" />} className="rounded-xl bg-brand hover:bg-brand-600">Upgrade Plan</Button>
    </div>
  )
}
