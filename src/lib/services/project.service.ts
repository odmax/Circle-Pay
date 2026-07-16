import { prisma } from "@/lib/prisma"

export async function createProject(circleId: string, userId: string, data: { name: string; slug: string; description?: string; type?: string; targetAmount?: number; visibility?: string }) {
  const existing = await prisma.project.findUnique({ where: { circleId_slug: { circleId, slug: data.slug } } })
  if (existing) throw new Error("Slug already exists in this circle")
  const project = await prisma.project.create({
    data: {
      circleId, createdById: userId,
      name: data.name, slug: data.slug, description: data.description || null,
      type: data.type || "general", targetAmount: data.targetAmount || null,
      visibility: (data.visibility as any) || "MEMBERS_ONLY",
    },
  })
  await addProjectActivity(project.id, userId, "created", "Project created", `Created by ${userId}`)
  return project
}

export async function updateProject(projectId: string, data: { name?: string; description?: string; status?: string; targetAmount?: number; visibility?: string }) {
  const safe: Record<string, unknown> = {}
  if (data.name !== undefined) safe.name = data.name
  if (data.description !== undefined) safe.description = data.description
  if (data.status !== undefined) safe.status = data.status
  if (data.targetAmount !== undefined) safe.targetAmount = data.targetAmount
  if (data.visibility !== undefined) safe.visibility = data.visibility
  return prisma.project.update({ where: { id: projectId }, data: safe as any })
}

export async function archiveProject(projectId: string) {
  return prisma.project.update({ where: { id: projectId }, data: { status: "ARCHIVED" } })
}

export async function getProject(projectId: string) {
  return prisma.project.findUnique({
    where: { id: projectId },
    include: { createdBy: { select: { id: true, name: true, email: true } }, activities: { orderBy: { createdAt: "desc" }, take: 30 } },
  })
}

export async function requireProjectInCircle(projectId: string, circleId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true, circleId: true } })
  if (!project || project.circleId !== circleId) throw new Error("Not found")
  return project
}

export async function getProjectsForCircle(circleId: string) {
  return prisma.project.findMany({
    where: { circleId, status: { not: "ARCHIVED" } },
    include: { createdBy: { select: { name: true } } },
    orderBy: { updatedAt: "desc" },
  })
}

export async function addProjectActivity(projectId: string, userId: string | null, type: string, title: string, description?: string) {
  return prisma.projectActivity.create({ data: { projectId, userId, type, title, description: description || null } })
}
