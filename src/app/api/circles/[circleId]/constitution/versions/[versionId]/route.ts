import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getVersion } from "@/lib/services/constitution.service"
import { prisma } from "@/lib/prisma"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ circleId: string; versionId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const { circleId, versionId } = await params
    const version = await getVersion(circleId, versionId, session.user.id)
    const acceptance = await prisma.constitutionAcceptance.findUnique({
      where: { versionId_userId: { versionId, userId: session.user.id } },
      select: { acceptedAt: true },
    })
    return NextResponse.json({ version, myAcceptance: acceptance?.acceptedAt ?? null })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed"
    const status = msg.includes("permission") || msg.includes("denied") ? 403 : 400
    return NextResponse.json({ error: msg }, { status })
  }
}
