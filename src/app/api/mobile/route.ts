import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getMobileUserFromRequest } from "@/lib/services/mobile-auth.service"
import { getUserDashboard } from "@/lib/services/dashboard.service"
import { getDashboardSnapshot } from "@/lib/services/snapshot.service"
import { getUserPaymentIntents } from "@/lib/services/circle-payment.service"

export async function GET(req: Request) {
  try {
    const user = await getMobileUserFromRequest(req)
    const userId = user.id
    const url = new URL(req.url)

    // Dashboard
    if (url.pathname === "/api/mobile/dashboard") {
      let data = await getDashboardSnapshot(userId)
      if (!data) data = await getUserDashboard(userId)
      const { stats, userCircles, recentActivity } = data
      return NextResponse.json({ stats, circles: userCircles, recentActivity })
    }

    // Circles list
    if (url.pathname === "/api/mobile/circles") {
      const circles = await prisma.circleMember.findMany({
        where: { userId }, include: { circle: { include: { _count: { select: { members: true } }, createdBy: { select: { name: true } } } } },
      })
      return NextResponse.json(circles.map((m) => ({ ...m.circle, myRole: m.role, memberCount: m.circle._count.members })))
    }

    // Circle detail
    const circleDetailMatch = url.pathname.match(/\/api\/mobile\/circles\/([^/]+)$/)
    if (circleDetailMatch) {
      const member = await prisma.circleMember.findUnique({ where: { circleId_userId: { circleId: circleDetailMatch[1], userId } }, include: { circle: { include: { _count: { select: { members: true, contributions: true } }, createdBy: { select: { name: true } } } } } })
      if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 })
      return NextResponse.json({ ...member.circle, myRole: member.role })
    }

    // My Status
    const myStatusMatch = url.pathname.match(/\/api\/mobile\/circles\/([^/]+)\/my-status/)
    if (myStatusMatch) {
      const statusMember = await prisma.circleMember.findUnique({ where: { circleId_userId: { circleId: myStatusMatch[1], userId } } })
      if (!statusMember) return NextResponse.json({ error: "Not found" }, { status: 404 })
      const { getMemberCircleStatus } = await import("@/lib/services/member-status.service")
      return NextResponse.json(await getMemberCircleStatus(myStatusMatch[1], userId))
    }

    // Payments
    const paymentsMatch = url.pathname.match(/\/api\/mobile\/circles\/([^/]+)\/payments$/)
    if (paymentsMatch) {
      const payMember = await prisma.circleMember.findUnique({ where: { circleId_userId: { circleId: paymentsMatch[1], userId } } })
      if (!payMember) return NextResponse.json({ error: "Not found" }, { status: 404 })
      return NextResponse.json(await getUserPaymentIntents(userId, paymentsMatch[1]))
    }

    // Projects
    const projectsMatch = url.pathname.match(/\/api\/mobile\/circles\/([^/]+)\/projects$/)
    if (projectsMatch) {
      const projMember = await prisma.circleMember.findUnique({ where: { circleId_userId: { circleId: projectsMatch[1], userId } } })
      if (!projMember) return NextResponse.json({ error: "Not found" }, { status: 404 })
      const { getProjectsForCircle } = await import("@/lib/services/project.service")
      return NextResponse.json(await getProjectsForCircle(projectsMatch[1]))
    }

    // Project detail
    const projectMatch = url.pathname.match(/\/api\/mobile\/circles\/([^/]+)\/projects\/([^/]+)$/)
    if (projectMatch) {
      const projDetailMember = await prisma.circleMember.findUnique({ where: { circleId_userId: { circleId: projectMatch[1], userId } } })
      if (!projDetailMember) return NextResponse.json({ error: "Not found" }, { status: 404 })
      const { getProject } = await import("@/lib/services/project.service")
      const project = await getProject(projectMatch[2])
      if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 })
      const { getProjectROIDashboard } = await import("@/lib/services/project-roi.service")
      const roi = await getProjectROIDashboard(projectMatch[2])
      return NextResponse.json({ ...project, roi: roi.summary })
    }

    // Portfolio
    if (url.pathname === "/api/mobile/portfolio") {
      const { getMemberProjectPortfolio } = await import("@/lib/services/project-distribution.service")
      return NextResponse.json(await getMemberProjectPortfolio(userId))
    }

    // Notifications
    if (url.pathname === "/api/mobile/notifications") {
      const notifs = await prisma.notification.findMany({ where: { userId }, include: { circle: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 30 })
      const unreadCount = await prisma.notification.count({ where: { userId, isRead: false } })
      return NextResponse.json({ notifications: notifs, unreadCount })
    }

    return NextResponse.json({ error: "Not found" }, { status: 404 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Unauthorized" }, { status: 401 })
  }
}
