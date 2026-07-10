"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { Check, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { toast } from "sonner"

const PAID_PLANS = [
  {
    slug: "premium",
    name: "Premium",
    description: "For power users who want unlimited everything",
    price: 49,
    features: [
      "Unlimited circles",
      "Advanced contribution tracking",
      "Advanced goal analytics",
      "Detailed reports",
      "AI features (coming soon)",
      "Priority support",
      "Export data",
    ],
  },
  {
    slug: "community",
    name: "Community",
    description: "For stokvels, churches, and community organizations",
    price: 99,
    features: [
      "Unlimited circles",
      "Stokvel management tools",
      "Church finance management",
      "Burial society tools",
      "Community finance tools",
      "Group voting (coming soon)",
      "Payout tracking (coming soon)",
      "Loan management (coming soon)",
      "Priority support",
    ],
  },
]

export default function UpgradePage() {
  const { status } = useSession()
  const [loadingSlug, setLoadingSlug] = useState<string | null>(null)

  // Fetch current plan from session or assume free
  const currentPlan = "free"
  const [promoCode, setPromoCode] = useState("")

  async function handleCheckout(planSlug: string) {
    setLoadingSlug(planSlug)
    try {
      const body: Record<string, string> = { planSlug }
      if (promoCode.trim()) body.promoCode = promoCode.trim()
      const res = await fetch("/api/payments/checkout", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || "Checkout failed")
        setLoadingSlug(null)
        return
      }
      const { checkoutUrl } = await res.json()
      window.location.assign(checkoutUrl)
    } catch {
      toast.error("Something went wrong")
      setLoadingSlug(null)
    }
  }

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Upgrade Plan</h1>
        <p className="text-muted-foreground">
          Current plan: <span className="font-semibold text-brand">{currentPlan === "free" ? "Free" : "Premium"}</span>
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 max-w-3xl">
        {PAID_PLANS.map((plan) => {
          const isCurrent = currentPlan === plan.slug
          return (
            <Card
              key={plan.slug}
              className={`rounded-2xl p-6 flex flex-col ${
                plan.slug === "premium"
                  ? "border-brand bg-brand-50/20"
                  : "border-border/40"
              }`}
            >
              <h3 className="text-xl font-bold">{plan.name}</h3>
              <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
              <div className="mt-4 mb-4">
                <span className="text-3xl font-bold">R{plan.price}</span>
                <span className="text-muted-foreground">/month</span>
              </div>

              <ul className="space-y-2 mb-6 flex-1">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Check className="size-4 text-brand shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <div className="space-y-2">
                <input
                  type="text" placeholder="Promo code (optional)" value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  className="w-full rounded-xl border px-3 py-1.5 text-sm" disabled={isCurrent}
                />
                <Button
                  className="w-full rounded-xl bg-brand hover:bg-brand-600"
                  disabled={isCurrent || loadingSlug === plan.slug}
                  onClick={() => handleCheckout(plan.slug)}
                >
                  {loadingSlug === plan.slug ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : isCurrent ? (
                    "Current Plan"
                  ) : (
                    `Upgrade to ${plan.name}`
                  )}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Payments secured by <span className="font-semibold">PayFast</span>
                </p>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
