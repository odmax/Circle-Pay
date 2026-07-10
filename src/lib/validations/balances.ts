import { z } from "zod"

export const createSettlementSchema = z.object({
  debtorId: z.string().min(1, "Debtor is required"),
  creditorId: z.string().min(1, "Creditor is required"),
  amount: z.coerce.number().positive("Amount must be positive"),
  settlementDate: z.string().min(1, "Date is required"),
  note: z.string().max(300).optional().or(z.literal("")),
})

export type CreateSettlementInput = z.infer<typeof createSettlementSchema>
