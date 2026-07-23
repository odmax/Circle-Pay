import { prisma } from "@/lib/prisma"
import { Prisma } from "@/generated/prisma"

export interface CreateVendorInput {
  name: string
  email?: string
  phone?: string
  address?: string
  taxNumber?: string
  paymentDetails?: string
  notes?: string
}

export interface UpdateVendorInput {
  name?: string
  email?: string
  phone?: string
  address?: string
  taxNumber?: string
  paymentDetails?: string
  notes?: string
  isActive?: boolean
}

export async function createVendor(projectId: string, circleId: string, data: CreateVendorInput) {
  const existing = await prisma.projectVendor.findFirst({
    where: { circleId, projectId, name: { equals: data.name, mode: "insensitive" } },
  })
  if (existing) throw new Error("Vendor with this name already exists")

  return prisma.projectVendor.create({
    data: {
      projectId,
      circleId,
      name: data.name,
      email: data.email || null,
      phone: data.phone || null,
      address: data.address || null,
      taxNumber: data.taxNumber || null,
      paymentDetails: data.paymentDetails || null,
      notes: data.notes || null,
    },
  })
}

export async function getVendors(projectId: string, filters?: { isActive?: boolean; search?: string }) {
  const where: any = { projectId }
  if (filters?.isActive !== undefined) where.isActive = filters.isActive
  if (filters?.search) {
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { email: { contains: filters.search, mode: "insensitive" } },
    ]
  }

  return prisma.projectVendor.findMany({
    where,
    orderBy: { totalSpend: "desc" },
  })
}

export async function getVendorById(vendorId: string) {
  return prisma.projectVendor.findUnique({ where: { id: vendorId } })
}

export async function updateVendor(vendorId: string, data: UpdateVendorInput) {
  const existing = await prisma.projectVendor.findUnique({ where: { id: vendorId } })
  if (!existing) throw new Error("Vendor not found")

  return prisma.projectVendor.update({ where: { id: vendorId }, data })
}

export async function deleteVendor(vendorId: string) {
  const existing = await prisma.projectVendor.findUnique({ where: { id: vendorId } })
  if (!existing) throw new Error("Vendor not found")

  const expenseCount = await prisma.projectExpense.count({
    where: { vendorId },
  })
  if (expenseCount > 0) {
    return prisma.projectVendor.update({
      where: { id: vendorId },
      data: { isActive: false },
    })
  }

  return prisma.projectVendor.delete({ where: { id: vendorId } })
}

export async function recordVendorSpend(vendorId: string, amount: number) {
  return prisma.projectVendor.update({
    where: { id: vendorId },
    data: {
      totalSpend: { increment: new Prisma.Decimal(amount) },
      expenseCount: { increment: 1 },
    },
  })
}

export async function getVendorStats(projectId: string) {
  const vendors = await prisma.projectVendor.findMany({
    where: { projectId, isActive: true },
    orderBy: { totalSpend: "desc" },
  })

  const totalSpend = vendors.reduce((s, v) => s + Number(v.totalSpend), 0)
  const topVendors = vendors.slice(0, 10)

  return {
    vendors,
    summary: {
      totalVendors: vendors.length,
      totalSpend,
      topVendors,
    },
  }
}
