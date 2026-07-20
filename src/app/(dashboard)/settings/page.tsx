import { redirect } from "next/navigation"
import Link from "next/link"
import { AlertTriangle, Calendar, Phone, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { auth } from "@/lib/auth"
import { getProfile } from "@/lib/services/profile.service"
import { ProfileForm } from "@/components/settings/profile-form"
import { ChangePasswordForm } from "@/components/settings/change-password-form"
import { CURRENCIES } from "@/lib/constants"
import { SignoutButton } from "@/components/auth/signout-button"

export default async function SettingsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const profile = await getProfile(session.user.id)
  const initials = profile.name
    ? profile.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "??"
  const ccy = CURRENCIES.find((c) => c.code === profile.currency)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your account</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          <ProfileForm profile={{ name: profile.name, phone: profile.phone, currency: profile.currency }} />
          <ChangePasswordForm hasPassword={profile.hasPassword} />
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Profile Overview */}
          <Card className="rounded-2xl border-border/40">
            <CardHeader>
              <CardTitle className="text-base">Profile</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center text-center">
              <Avatar className="size-20 mb-3">
                <AvatarImage src={profile.image || ""} />
                <AvatarFallback className="text-xl bg-brand-100 text-brand-700">{initials}</AvatarFallback>
              </Avatar>
              <h3 className="font-semibold text-lg">{profile.name || "User"}</h3>
              <p className="text-sm text-muted-foreground">{profile.email}</p>
              <div className="mt-3 w-full space-y-2 text-sm">
                {profile.phone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="size-3.5" />
                    <span>{profile.phone}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Wallet className="size-3.5" />
                  <span>{ccy?.symbol} {profile.currency}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="size-3.5" />
                  <span>Joined {new Date(profile.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Security */}
          <Card className="rounded-2xl border-border/40">
            <CardHeader>
              <CardTitle className="text-base">Security</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Email login</span>
                <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">{profile.hasPassword ? "Enabled" : "Disabled"}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Google</span>
                <Badge variant="outline" className={profile.hasGoogle ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500"}>{profile.hasGoogle ? "Linked" : "Not linked"}</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Subscription */}
          <Card className="rounded-2xl border-border/40">
            <CardHeader>
              <CardTitle className="text-base">Subscription</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Plan</span>
                <Badge className="bg-brand-50 text-brand-700">{profile.plan}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">{profile.planStatus}</Badge>
              </div>
              {profile.periodEnd && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Renews</span>
                  <span>{new Date(profile.periodEnd).toLocaleDateString()}</span>
                </div>
              )}
              {profile.planSlug === "free" && (
                <Button render={<Link href="/upgrade" />} className="w-full rounded-xl bg-brand hover:bg-brand-600">
                  Upgrade Plan
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="rounded-2xl border-red-200">
            <CardHeader>
              <CardTitle className="text-base text-red-600">Danger Zone</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <SignoutButton
                variant="outline"
                className="w-full justify-start gap-2 rounded-xl text-red-600 border-red-200 hover:bg-red-50"
              />
              <Button variant="ghost" disabled className="w-full justify-start gap-2 rounded-xl text-muted-foreground">
                <AlertTriangle className="size-4" /> Delete Account (coming soon)
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
