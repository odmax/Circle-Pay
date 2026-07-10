import { prisma } from "@/lib/prisma"

const DOCUMENTS = [
  { slug: "terms", title: "Terms & Conditions", requiresAcceptance: true },
  { slug: "privacy", title: "Privacy Policy", requiresAcceptance: true },
  { slug: "investment-disclaimer", title: "Investment Disclaimer", requiresAcceptance: true },
  { slug: "community-guidelines", title: "Community Guidelines", requiresAcceptance: false },
  { slug: "acceptable-use", title: "Acceptable Use Policy", requiresAcceptance: false },
  { slug: "cookies", title: "Cookie Policy", requiresAcceptance: false },
  { slug: "refunds", title: "Refund Policy", requiresAcceptance: false },
  { slug: "security", title: "Security", requiresAcceptance: false },
]

export async function seedLegalDocuments() {
  for (const doc of DOCUMENTS) {
    const existing = await prisma.legalDocument.findUnique({ where: { slug: doc.slug } })
    if (!existing) {
      await prisma.legalDocument.create({
        data: {
          slug: doc.slug, title: doc.title, version: "1.0", effectiveDate: new Date("2026-07-01"),
          contentHash: "v1", isActive: true, requiresAcceptance: doc.requiresAcceptance,
        },
      })
    }
  }
}

export async function getActiveLegalDocuments() {
  await seedLegalDocuments()
  return prisma.legalDocument.findMany({ where: { isActive: true }, orderBy: { slug: "asc" } })
}

export async function getRequiredLegalDocuments() {
  await seedLegalDocuments()
  return prisma.legalDocument.findMany({ where: { isActive: true, requiresAcceptance: true } })
}

export async function getUserLegalAcceptanceStatus(userId: string) {
  await seedLegalDocuments()
  const required = await getRequiredLegalDocuments()
  const accepted = await prisma.userLegalAcceptance.findMany({ where: { userId }, include: { document: true } })
  const acceptedMap = new Map(accepted.map((a) => [a.document.slug, a.version]))
  const allAccepted = required.every((doc) => acceptedMap.get(doc.slug) === doc.version)
  return { required: required.map((d) => ({ slug: d.slug, title: d.title, version: d.version, accepted: acceptedMap.get(d.slug) === d.version })), allAccepted }
}

export async function recordLegalAcceptance(userId: string, slugs: string[], request?: { ip?: string; userAgent?: string }) {
  const docs = await prisma.legalDocument.findMany({ where: { slug: { in: slugs }, isActive: true } })
  for (const doc of docs) {
    await prisma.userLegalAcceptance.upsert({
      where: { userId_documentId_version: { userId, documentId: doc.id, version: doc.version } },
      create: { userId, documentId: doc.id, version: doc.version, ipAddress: request?.ip || null, userAgent: request?.userAgent || null },
      update: {},
    })
  }
  return true
}

export async function requireLegalAcceptance(userId: string) {
  const status = await getUserLegalAcceptanceStatus(userId)
  return !status.allAccepted
}
