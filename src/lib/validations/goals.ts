import { z } from "zod"

export const createGoalSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  description: z.string().max(300).optional().or(z.literal("")),
  targetAmount: z.coerce.number().positive("Target amount must be positive"),
  deadline: z.string().optional().or(z.literal("")),
})

export const updateGoalSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(300).optional(),
  targetAmount: z.coerce.number().positive().optional(),
  deadline: z.string().optional().nullable(),
  status: z.enum(["ACTIVE", "COMPLETED", "CANCELLED", "ARCHIVED"]).optional(),
})

export const allocateGoalSchema = z.object({
  userId: z.string().min(1, "Member is required"),
  contributionId: z.string().optional().or(z.literal("")),
  amount: z.coerce.number().positive("Amount must be positive"),
  allocationDate: z.string().min(1, "Date is required"),
  note: z.string().max(300).optional().or(z.literal("")),
})

export type CreateGoalInput = z.infer<typeof createGoalSchema>
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>
export type AllocateGoalInput = z.infer<typeof allocateGoalSchema>
