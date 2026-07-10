import Link from "next/link"
import { ArrowRight, Check } from "lucide-react"
import { Button } from "@/components/ui/button"

const FALLBACK_PLANS = [
  {
    id: "free",
    slug: "free",
    name: "Free",
    description: "For individuals getting started with group finance",
    price: 0,
    features: [
      "Up to 3 circles",
      "Basic expense tracking",
      "Basic contributions",
      "Basic savings goals",
      "In-app notifications",
      "Mobile app access",
    ],
  },
  {
    id: "premium",
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
    id: "community",
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

export default async function PricingPage() {
  let plans = FALLBACK_PLANS
  try {
    const { getPlans } = await import("@/lib/services/subscription.service")
    plans = await getPlans()
  } catch {}

  const labels: Record<string, { badge?: string; cta: string; href: string }> = {
    free: { cta: "Get Started Free", href: "/register" },
    premium: { badge: "Most Popular", cta: "Upgrade to Premium", href: "/register" },
    community: { cta: "Contact Sales", href: "/register" },
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <div className="flex size-8 items-center justify-center rounded-lg bg-brand text-brand-foreground">
              <span className="text-sm font-bold">C</span>
            </div>
            Circle Pay
          </Link>
          <nav className="hidden items-center gap-6 sm:flex">
            <Link href="/login" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              Sign In
            </Link>
            <Button render={<Link href="/register" />} className="rounded-lg bg-brand hover:bg-brand-600">
              Get Started
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="text-4xl font-bold tracking-tight">Simple, transparent pricing</h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Start free. Upgrade when your group grows.
            </p>
          </div>

          <div className="mt-14 grid gap-6 lg:grid-cols-3 max-w-5xl mx-auto">
            {plans.map((plan) => {
              const label = labels[plan.slug] || { cta: "Get Started", href: "/register" }
              const isPremium = plan.slug === "premium"
              const features = plan.features as string[]

              return (
                <div
                  key={plan.id}
                  className={`relative rounded-2xl border p-6 flex flex-col ${
                    isPremium
                      ? "border-brand bg-brand-50/20 shadow-lg scale-[1.02]"
                      : "border-border/40 bg-card"
                  }`}
                >
                  {label.badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand px-4 py-1 text-xs font-semibold text-white">
                      {label.badge}
                    </div>
                  )}
                  <div className="mb-4">
                    <h3 className="text-xl font-bold">{plan.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
                  </div>
                  <div className="mb-4">
                    <span className="text-4xl font-bold">
                      {plan.price === 0 ? "Free" : `R${plan.price.toLocaleString()}`}
                    </span>
                    {plan.price > 0 && (
                      <span className="text-muted-foreground">/month</span>
                    )}
                  </div>
                  <Button
                    render={<Link href={label.href} />}
                    className={`w-full rounded-xl mb-6 ${isPremium ? "bg-brand hover:bg-brand-600" : ""}`}
                    variant={isPremium ? "default" : "outline"}
                  >
                    {label.cta} <ArrowRight className="ml-2 size-4" />
                  </Button>
                  <ul className="space-y-2 flex-1">
                    {features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <Check className="size-4 text-brand shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>

          <div className="mt-12 text-center">
            <p className="text-sm text-muted-foreground">
              Payments via PayFast, Ozow, and Stitch coming soon. For community plans,{" "}
              <Link href="mailto:hello@mozetech.com" className="text-brand underline">
                contact us
              </Link>
              .
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/40 py-8">
        <div className="mx-auto max-w-7xl px-4 text-center text-sm text-muted-foreground sm:px-6">
          &copy; {new Date().getFullYear()} Mozetech. Circle Pay.
        </div>
      </footer>
    </div>
  )
}
