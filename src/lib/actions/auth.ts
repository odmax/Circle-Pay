"use server"

import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { registerSchema } from "@/lib/validations/auth"
import { seedPlans, assignFreePlan } from "@/lib/services/subscription.service"

export async function registerUser(formData: FormData) {
  const raw = {
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  }

  const parsed = registerSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.flatten().fieldErrors,
    }
  }

  const { name, email, phone, password } = parsed.data

  const passwordHash = await bcrypt.hash(password, 12)

  let user
  try {
    user = await prisma.user.create({
      data: {
        name,
        email,
        phone: phone || null,
        passwordHash,
      },
    })
  } catch (e: any) {
    if (e?.code === "P2002") {
      const field = e?.meta?.target?.includes("email") ? "email" : "phone"
      return {
        success: false,
        error: { [field]: [field === "email"
          ? "An account with this email already exists"
          : "This phone number is already registered"] },
      }
    }
    throw e
  }

  await seedPlans()
  await assignFreePlan(user.id)

  // Seed owner admin if email matches (case-insensitive)
  if (process.env.OWNER_EMAIL && email.toLowerCase() === process.env.OWNER_EMAIL.toLowerCase()) {
    try {
      await prisma.internalAdmin.upsert({
        where: { userId: user.id },
        create: { userId: user.id, role: "SUPER_ADMIN" },
        update: {},
      })
    } catch {}
  }

  return { success: true, error: null }
}
