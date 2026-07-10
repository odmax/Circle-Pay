import { z } from "zod"

export const createExpenseSchema = z
  .object({
    title: z.string().min(2, "Title is required").max(100),
    notes: z.string().max(300).optional().or(z.literal("")),
    amount: z.coerce.number().positive("Amount must be positive"),
    category: z.enum([
      "groceries", "rent", "utilities", "transport", "food",
      "travel", "event", "family", "church", "other",
    ]),
    splitType: z.enum(["EQUAL", "EXACT", "PERCENTAGE"]),
    expenseDate: z.string().min(1, "Date is required"),
    receiptUrl: z.string().url().optional().or(z.literal("")),
    // Paid by — the user who covered the cost
    paidById: z.string().min(1, "Payer is required"),
    // Splits — array of { userId, amount?, percentage? }
    splits: z
      .array(
        z.object({
          userId: z.string().min(1),
          amount: z.coerce.number().optional(),
          percentage: z.coerce.number().min(0).max(100).optional(),
        })
      )
      .min(1, "At least one member must be included in the split"),
  })
  .superRefine((data, ctx) => {
    const { splitType, amount, splits } = data

    if (splitType === "EQUAL") {
      // No additional validation needed — backend handles equal split
    }

    if (splitType === "EXACT") {
      const total = splits.reduce((sum, s) => sum + (Number(s.amount) || 0), 0)
      if (Math.abs(total - Number(amount)) > 0.01) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Exact split amounts must sum to ${amount}. Current total: ${total}`,
          path: ["splits"],
        })
      }
    }

    if (splitType === "PERCENTAGE") {
      const total = splits.reduce((sum, s) => sum + (Number(s.percentage) || 0), 0)
      if (Math.abs(total - 100) > 0.01) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Percentage splits must sum to 100%. Current total: ${total}%`,
          path: ["splits"],
        })
      }
    }
  })

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>
