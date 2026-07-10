import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { getPlatformSettings, getFeatureFlags, seedDefaultPlatformSettings } from "@/lib/services/platform-settings.service"
import { requireOwnerPage } from "@/lib/services/owner-permission.service"
import { PERMISSIONS } from "@/lib/ownerPermissions"

export default async function PlatformSettingsPage() {
  await requireOwnerPage(PERMISSIONS.PLATFORM_SETTINGS_EDIT)
  await seedDefaultPlatformSettings()
  const settings = await getPlatformSettings()
  const flags = await getFeatureFlags()

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold tracking-tight">Platform Settings</h1><p className="text-muted-foreground">Global configuration and feature flags</p></div>

      {/* General Settings */}
      <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">General</CardTitle></CardHeader><CardContent className="space-y-3">
        <SettingRow label="Maintenance Mode" value={settings.maintenanceMode} keyName="maintenanceMode" />
        <SettingRow label="Registration Enabled" value={settings.registrationEnabled} keyName="registrationEnabled" />
        <SettingRow label="Google Login" value={settings.googleLoginEnabled} keyName="googleLoginEnabled" />
        <SettingRow label="Discover" value={settings.discoverEnabled} keyName="discoverEnabled" />
        <SettingRow label="AI Assistant" value={settings.aiAssistantEnabled} keyName="aiAssistantEnabled" />
        <SettingRow label="Wallet Tracking" value={settings.walletTrackingEnabled} keyName="walletTrackingEnabled" />
        <form action={async (fd) => { "use server"; const { requireOwnerPermission } = await import("@/lib/services/owner-permission.service"); const { auth } = await import("@/lib/auth"); const s = await auth(); if (!s?.user?.id) return; await requireOwnerPermission(s.user.id, "PLATFORM_SETTINGS_EDIT"); const { updatePlatformSetting } = await import("@/lib/services/platform-settings.service"); await updatePlatformSetting("defaultCurrency", fd.get("defaultCurrency") as string, s.user.id) }} className="flex items-center justify-between">
          <span className="text-sm">Default Currency</span>
          <div className="flex gap-2"><select name="defaultCurrency" defaultValue={String(settings.defaultCurrency || "ZAR")} className="rounded-xl border px-3 py-1 text-sm">{["ZAR","NGN","KES","GHS","USD","EUR","GBP"].map((c) => <option key={c} value={c}>{c}</option>)}</select><Button type="submit" size="sm" className="rounded-xl">Save</Button></div>
        </form>
      </CardContent></Card>

      {/* Feature Flags */}
      <Card className="rounded-2xl"><CardHeader><CardTitle className="text-base">Feature Flags</CardTitle></CardHeader><CardContent>
        <div className="space-y-3">
          {flags.length === 0 ? <p className="text-sm text-muted-foreground">No feature flags configured</p> : flags.map((f) => (
            <form key={f.id} action={async () => { "use server"; const { requireOwnerPermission } = await import("@/lib/services/owner-permission.service"); const { auth } = await import("@/lib/auth"); const s = await auth(); if (!s?.user?.id) return; await requireOwnerPermission(s.user.id, "PLATFORM_SETTINGS_EDIT"); const { updateFeatureFlag } = await import("@/lib/services/platform-settings.service"); await updateFeatureFlag(f.key, !f.isEnabled, s.user.id) }} className="flex items-center justify-between">
              <div><p className="text-sm font-medium">{f.name}</p>{f.description && <p className="text-xs text-muted-foreground">{f.description}</p>}</div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={f.isEnabled ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500"}>{f.isEnabled ? "ON" : "OFF"}</Badge>
                <Button type="submit" size="sm" variant="outline" className="rounded-xl text-xs">{f.isEnabled ? "Disable" : "Enable"}</Button>
              </div>
            </form>
          ))}
          <form action={async () => { "use server"; const { requireOwnerPermission } = await import("@/lib/services/owner-permission.service"); const { auth } = await import("@/lib/auth"); const s = await auth(); if (!s?.user?.id) return; await requireOwnerPermission(s.user.id, "PLATFORM_SETTINGS_EDIT"); const { updateFeatureFlag } = await import("@/lib/services/platform-settings.service"); for (const key of ["feedEnabled","eventsEnabled","pollsEnabled"]) { await updateFeatureFlag(key, true, s.user.id) } }}><Button type="submit" size="sm" variant="outline" className="rounded-xl text-xs">Seed Default Flags</Button></form>
        </div>
      </CardContent></Card>
    </div>
  )
}

function SettingRow({ label, value, keyName }: { label: string; value: unknown; keyName: string }) {
  return (
    <form action={async () => { "use server"; const { requireOwnerPermission } = await import("@/lib/services/owner-permission.service"); const { auth } = await import("@/lib/auth"); const s = await auth(); if (!s?.user?.id) return; await requireOwnerPermission(s.user.id, "PLATFORM_SETTINGS_EDIT"); const { updatePlatformSetting } = await import("@/lib/services/platform-settings.service"); await updatePlatformSetting(keyName, !value, s.user.id) }} className="flex items-center justify-between">
      <span className="text-sm">{label}</span>
      <div className="flex items-center gap-2">
        <Badge variant="outline" className={value ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500"}>{value ? "ON" : "OFF"}</Badge>
        <Button type="submit" size="sm" variant="outline" className="rounded-xl text-xs">{value ? "Disable" : "Enable"}</Button>
      </div>
    </form>
  )
}
