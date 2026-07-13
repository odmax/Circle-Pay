import { NextResponse } from "next/server"
import { getCurrentInternalAdmin } from "@/lib/services/owner-permission.service"

export async function GET() {
  const admin = await getCurrentInternalAdmin()
  return NextResponse.json(admin)
}
