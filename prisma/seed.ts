import { PrismaClient } from "../src/generated/prisma"
import { PrismaPg } from "@prisma/adapter-pg"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  const ownerEmail = process.env.OWNER_EMAIL?.toLowerCase()

  if (!ownerEmail) {
    console.log("OWNER_EMAIL not set — skipping seed")
    return
  }

  const user = await prisma.user.findFirst({
    where: { email: { equals: ownerEmail, mode: "insensitive" } },
  })

  if (!user) {
    console.log(`User ${ownerEmail} not registered — register first, then re-run seed`)
    return
  }

  const admin = await prisma.internalAdmin.upsert({
    where: { userId: user.id },
    create: { userId: user.id, role: "SUPER_ADMIN" },
    update: { role: "SUPER_ADMIN" },
  })

  console.log(`Owner seeded: ${user.email} — role: ${admin.role}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
