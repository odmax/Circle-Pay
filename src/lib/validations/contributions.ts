import { z } from "zod"

export const createContributionPlanSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(50),
  description: z.string().max(200).optional().or(z.literal("")),
  amount: z.coerce.number().positive("Amount must be positive"),
  frequency: z.enum(["WEEKLY", "MONTHLY", "ONCE_OFF", "CUSTOM"]),
  dueDay: z.coerce.number().int().min(1).max(31).optional(),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional().or(z.literal("")),
})

export const updateContributionPlanSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  description: z.string().max(200).optional(),
  amount: z.coerce.number().positive().optional(),
  frequency: z.enum(["WEEKLY", "MONTHLY", "ONCE_OFF", "CUSTOM"]).optional(),
  dueDay: z.coerce.number().int().min(1).max(31).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  isActive: z.boolean().optional(),
})

export const addContributionSchema = z.object({
  userId: z.string().min(1, "Member is required"),
  planId: z.string().optional().or(z.literal("")),
  amount: z.coerce.number().positive("Amount must be positive"),
  status: z.enum(["PAID", "PENDING", "PENDING_REVIEW", "CANCELLED"]),
  paymentDate: z.string().min(1, "Payment date is required"),
  note: z.string().max(300).optional().or(z.literal("")),
})

export const updateContributionSchema = z.object({
  amount: z.coerce.number().positive("Amount must be positive").optional(),
  status: z.enum(["PAID", "PENDING", "PENDING_REVIEW", "CONFIRMED", "REJECTED", "OVERDUE", "CANCELLED"]).optional(),
  paymentDate: z.string().min(1, "Payment date is required").optional(),
  note: z.string().max(300).optional().nullable(),
  planId: z.string().optional().nullable(),
  correctionReason: z.string().min(1, "Correction reason is required").optional(),
})

export const restoreContributionSchema = z.object({})

export type CreateContributionPlanInput = z.infer<typeof createContributionPlanSchema>
export type UpdateContributionPlanInput = z.infer<typeof updateContributionPlanSchema>
export type AddContributionInput = z.infer<typeof addContributionSchema>
export type UpdateContributionInput = z.infer<typeof updateContributionSchema>
