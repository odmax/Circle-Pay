import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { requireOwnerPermission } from "@/lib/services/owner-permission.service"
import { PERMISSIONS } from "@/lib/ownerPermissions"
import { seedDefaultPlanFeatures } from "@/lib/services/feature-gate.service"

export async function POST() {
  try {
    const s = await auth()
    if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    await requireOwnerPermission(s.user.id, PERMISSIONS.PLANS_MANAGE)
    await seedDefaultPlanFeatures()
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 })
  }
}
