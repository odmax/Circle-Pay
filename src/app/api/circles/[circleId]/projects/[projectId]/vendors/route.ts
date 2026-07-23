import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { requireProjectInCircle } from "@/lib/services/project.service"
import {
  createVendor,
  getVendors,
  updateVendor,
  deleteVendor,
  getVendorStats,
} from "@/lib/services/project-vendor.service"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ circleId: string; projectId: string }> },
) {
  const s = await auth()
  if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId, projectId } = await params
  const member = await prisma.circleMember.findUnique({
    where: { circleId_userId: { circleId, userId: s.user.id } },
  })
  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 })
  await requireProjectInCircle(projectId, circleId)

  const url = new URL(req.url)
  const stats = url.searchParams.get("stats")
  const search = url.searchParams.get("search") || undefined

  if (stats === "true") {
    return NextResponse.json(await getVendorStats(projectId))
  }

  const isActive = url.searchParams.get("active")
  const filters: { isActive?: boolean; search?: string } = {}
  if (isActive !== null) filters.isActive = isActive === "true"
  if (search) filters.search = search

  return NextResponse.json(await getVendors(projectId, filters))
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ circleId: string; projectId: string }> },
) {
  const s = await auth()
  if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId, projectId } = await params
  const member = await prisma.circleMember.findUnique({
    where: { circleId_userId: { circleId, userId: s.user.id } },
  })
  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 })
  await requireProjectInCircle(projectId, circleId)

  try {
    const data = await req.json()
    const vendor = await createVendor(projectId, circleId, data)
    return NextResponse.json(vendor, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ circleId: string; projectId: string }> },
) {
  const s = await auth()
  if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId } = await params
  const member = await prisma.circleMember.findUnique({
    where: { circleId_userId: { circleId, userId: s.user.id } },
  })
  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 })

  try {
    const { vendorId, ...data } = await req.json()
    if (!vendorId) return NextResponse.json({ error: "vendorId required" }, { status: 400 })
    const vendor = await updateVendor(vendorId, data)
    return NextResponse.json(vendor)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ circleId: string; projectId: string }> },
) {
  const s = await auth()
  if (!s?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { circleId } = await params
  const member = await prisma.circleMember.findUnique({
    where: { circleId_userId: { circleId, userId: s.user.id } },
  })
  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 })

  try {
    const { vendorId } = await req.json()
    if (!vendorId) return NextResponse.json({ error: "vendorId required" }, { status: 400 })
    await deleteVendor(vendorId)
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
