import Link from "next/link"
import {
  ArrowRight,
  Shield,
  Users,
  PiggyBank,
  Receipt,
  Target,
  Bell,
  Handshake,
  Globe,
  Heart,
  Home,
  Plane,
  Gem,
  Church,
  TrendingUp,
  Check,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <div className="flex size-8 items-center justify-center rounded-lg bg-brand text-brand-foreground">
              <span className="text-sm font-bold">C</span>
            </div>
            Circle Pay
          </Link>
          <nav className="hidden items-center gap-6 sm:flex">
            <Link href="/pricing" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              Pricing
            </Link>
            <Link href="/login" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              Sign In
            </Link>
            <Button render={<Link href="/register" />} className="rounded-lg bg-brand hover:bg-brand-600">
              Get Started
            </Button>
            <Link href="/owner/login" className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors" title="Owner Access">
              <Shield className="size-4" />
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-7xl px-4 pt-20 pb-16 sm:px-6 lg:pt-32 lg:pb-24">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-sm font-medium text-brand-700">
              <PiggyBank className="size-4" />
              Group Finance Platform — Not just bill splitting
            </div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Manage money{" "}
              <span className="text-brand">together</span>,{" "}
              <span className="text-brand">better</span>
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-muted-foreground sm:text-xl">
              Circle Pay is the group finance platform for Africa. Save towards shared
              goals, track expenses, split bills, manage stokvels, and build financial
              trust — all in one place.
            </p>
            <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Button render={<Link href="/register" />} size="lg" className="rounded-xl bg-brand px-8 hover:bg-brand-600">
                Start Your Circle <ArrowRight className="ml-2 size-4" />
              </Button>
              <Button render={<Link href="/pricing" />} variant="outline" size="lg" className="rounded-xl px-8">
                View Plans
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Powered by <span className="font-semibold text-foreground">Mozetech</span>. Built for Africa.
            </p>
          </div>
        </section>

        {/* Use Cases */}
        <section className="border-t border-border/40 bg-muted/30 py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight">Built for every group</h2>
              <p className="mt-4 text-muted-foreground">
                From families to stokvels — Circle Pay works for everyone.
              </p>
            </div>
            <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <UseCase icon={<Heart />} title="Families" desc="Manage family budgets, allowances, and shared savings goals." />
              <UseCase icon={<Users />} title="Friends" desc="Split bills, track shared expenses, and stay accountable." />
              <UseCase icon={<Home />} title="Housemates" desc="Rent, utilities, groceries — split fairly every month." />
              <UseCase icon={<Plane />} title="Travel Groups" desc="Trip costs, accommodation, activities — all tracked." />
              <UseCase icon={<Gem />} title="Wedding Groups" desc="Wedding budget, contributions, and planning together." />
              <UseCase icon={<PiggyBank />} title="Savings Groups" desc="Group savings towards shared financial goals." />
              <UseCase icon={<Users />} title="Stokvels" desc="Traditional rotating savings and credit management." />
              <UseCase icon={<Church />} title="Churches" desc="Offerings, projects, and community fund tracking." />
              <UseCase icon={<TrendingUp />} title="Investment Clubs" desc="Pool funds and track collective investments." />
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight">How Circle Pay works</h2>
              <p className="mt-4 text-muted-foreground">Three simple steps to financial harmony.</p>
            </div>
            <div className="mt-14 grid gap-8 sm:grid-cols-3">
              <StepCard step="1" icon={<Users />} title="Create a Circle" desc="Start a group for any purpose — family, stokvel, church, or travel. Invite members with a code." />
              <StepCard step="2" icon={<PiggyBank />} title="Contribute & Save" desc="Set up contribution plans and savings goals. Everyone chips in on their schedule." />
              <StepCard step="3" icon={<Receipt />} title="Track & Settle" desc="Record expenses, split bills, and settle balances. Everything is transparent and recorded." />
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="border-t border-border/40 bg-muted/30 py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight">Powerful features</h2>
              <p className="mt-4 text-muted-foreground">Everything your group needs to manage money together.</p>
            </div>
            <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <Feature icon={<PiggyBank />} title="Contributions" desc="Recurring and once-off contribution plans. Track who paid and who's pending." />
              <Feature icon={<Target />} title="Savings Goals" desc="Set targets with deadlines. Allocate funds and watch progress together." />
              <Feature icon={<Receipt />} title="Expense Tracking" desc="Record shared expenses. Split equally, by exact amounts, or percentage." />
              <Feature icon={<Handshake />} title="Balances & Settlements" desc="See who owes who. Settle up with confirmation and audit trail." />
              <Feature icon={<Bell />} title="Notifications" desc="Stay informed. Real-time alerts for contributions, goals, expenses, and settlements." />
              <Feature icon={<Shield />} title="Trust & Transparency" desc="Every transaction is recorded. Audit trail for complete accountability." />
            </div>
          </div>
        </section>

        {/* Africa Focus */}
        <section className="py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mx-auto max-w-3xl text-center">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-sm font-medium text-brand-700">
                <Globe className="size-4" />
                Made for Africa
              </div>
              <h2 className="text-3xl font-bold tracking-tight">Built for how Africa saves together</h2>
              <p className="mt-4 text-muted-foreground leading-relaxed">
                We understand stokvels, church groups, family contributions, and community
                savings. Our platform supports ZAR, NGN, KES, GHS and more — with
                mobile-first design for the networks our communities use.
              </p>
              <div className="mt-8 grid gap-4 sm:grid-cols-3 text-left">
                <CheckCard text="Stokvel-ready features" />
                <CheckCard text="Multi-currency support" />
                <CheckCard text="Mobile-first experience" />
                <CheckCard text="Church group management" />
                <CheckCard text="Burial society tools coming soon" />
                <CheckCard text="Payments via PayFast, Ozow, Stitch" />
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-border/40 bg-brand py-20">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
            <h2 className="text-3xl font-bold tracking-tight text-white">Ready to start your circle?</h2>
            <p className="mt-4 text-brand-100">
              Join thousands of groups already managing money better with Circle Pay.
            </p>
            <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Button render={<Link href="/register" />} size="lg" className="rounded-xl bg-white text-brand px-8 hover:bg-brand-50">
                Get Started Free <ArrowRight className="ml-2 size-4" />
              </Button>
              <Button render={<Link href="/pricing" />} variant="outline" size="lg" className="rounded-xl border-white/20 text-white hover:bg-white/10">
                View Pricing
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/40 py-8">
        <div className="mx-auto max-w-7xl px-4 text-center text-sm text-muted-foreground sm:px-6">
          &copy; {new Date().getFullYear()} Mozetech. Circle Pay — Group Finance, Simplified.
        </div>
      </footer>
    </div>
  )
}

function UseCase({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Card className="rounded-2xl border-border/40 transition-shadow hover:shadow-md">
      <CardContent className="flex items-start gap-3 p-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand">{icon}</div>
        <div>
          <h4 className="font-semibold text-sm">{title}</h4>
          <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function StepCard({ step, icon, title, desc }: { step: string; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="text-center">
      <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-brand-50 text-brand">{icon}</div>
      <div className="mt-4 inline-flex size-6 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">{step}</div>
      <h3 className="mt-2 font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
    </div>
  )
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-border/40 bg-card p-5">
      <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand">{icon}</div>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
    </div>
  )
}

function CheckCard({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <Check className="size-4 text-brand shrink-0" />
      <span>{text}</span>
    </div>
  )
}
