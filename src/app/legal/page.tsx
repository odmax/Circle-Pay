import Link from "next/link"
import { Shield, FileText, AlertTriangle, Users, Ban, Cookie, RotateCcw, Lock } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

const pages = [
  { href: "/legal/privacy", title: "Privacy Policy", desc: "How we collect, use, and protect your personal information under POPIA and GDPR.", icon: Shield, updated: "1 July 2026" },
  { href: "/legal/terms", title: "Terms & Conditions", desc: "The agreement between you and Circle Pay governing platform use, subscriptions, and liabilities.", icon: FileText, updated: "1 July 2026" },
  { href: "/legal/investment-disclaimer", title: "Investment Disclaimer", desc: "Important notice regarding investment projects, ROI calculations, and financial risk.", icon: AlertTriangle, updated: "1 July 2026" },
  { href: "/legal/community-guidelines", title: "Community Guidelines", desc: "Rules and standards for participating in circles, projects, and community features.", icon: Users, updated: "1 July 2026" },
  { href: "/legal/acceptable-use", title: "Acceptable Use Policy", desc: "Prohibited activities including fraud, money laundering, and platform abuse.", icon: Ban, updated: "1 July 2026" },
  { href: "/legal/cookies", title: "Cookie Policy", desc: "How we use cookies for authentication, preferences, analytics, and security.", icon: Cookie, updated: "1 July 2026" },
  { href: "/legal/refunds", title: "Refund Policy", desc: "Our policy on subscription refunds, cancellations, upgrades, and billing disputes.", icon: RotateCcw, updated: "1 July 2026" },
  { href: "/legal/security", title: "Security", desc: "How we protect your account, data, and financial records including encryption and audit controls.", icon: Lock, updated: "1 July 2026" },
]

export default function LegalPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Legal & Trust Center</h1>
        <p className="mt-2 text-muted-foreground">Transparency and trust are the foundation of our platform. All legal documents are written in plain language and updated regularly.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {pages.map((p) => {
          const Icon = p.icon
          return (
            <Link key={p.href} href={p.href} className="block group">
              <Card className="rounded-2xl h-full hover:shadow-sm transition-shadow group-hover:border-brand-200">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><Icon className="size-5" /></div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold group-hover:text-brand transition-colors">{p.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{p.desc}</p>
                      <p className="text-xs text-muted-foreground/60 mt-2">Last updated: {p.updated}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
