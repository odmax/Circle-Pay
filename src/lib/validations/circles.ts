import { z } from "zod"

export const createCircleSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name must be at most 50 characters"),
  description: z
    .string()
    .max(200, "Description must be at most 200 characters")
    .optional()
    .or(z.literal("")),
  type: z.enum([
    "FAMILY", "TRAVEL", "HOUSEMATE", "WEDDING", "SAVINGS",
    "STOKVEL", "CHURCH", "INVESTMENT", "CUSTOM",
  ]),
  currency: z.enum(["NGN", "KES", "GHS", "ZAR", "USD", "EUR", "GBP"]),
  settings: z.record(z.string(), z.unknown()).optional(),
})

export const updateCircleSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  description: z.string().max(200).optional().nullable(),
  currency: z.enum(["NGN", "KES", "GHS", "ZAR", "USD", "EUR", "GBP"]).optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
})

export const addMemberSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.enum(["ADMIN", "MEMBER"]),
})

export const updateMemberRoleSchema = z.object({
  role: z.enum(["ADMIN", "MEMBER"]),
})

export type CreateCircleInput = z.infer<typeof createCircleSchema>
export type UpdateCircleInput = z.infer<typeof updateCircleSchema>
export type AddMemberInput = z.infer<typeof addMemberSchema>
