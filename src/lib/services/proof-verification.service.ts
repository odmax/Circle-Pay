import { prisma } from "@/lib/prisma"

interface VerificationInput {
  contributionId: string
  circleId: string
  proofUrl: string
  proofReference?: string
  amount: number
  contributionMonth?: string
}

interface ExtractionResult {
  extractedAmount: number | null
  extractedDate: string | null
  extractedReference: string | null
  extractedSender: string | null
  confidenceScore: number
}

interface VerificationResult {
  status: "VERIFIED" | "NEEDS_REVIEW" | "REJECTED"
  confidenceScore: number
  extractedAmount: number | null
  extractedDate: string | null
  extractedReference: string | null
  extractedSender: string | null
  reason: string
}

export async function verifyContributionProof(input: VerificationInput): Promise<VerificationResult> {
  const { contributionId, circleId, proofUrl, proofReference, amount, contributionMonth } = input

  // 1. Simulate document extraction (in production: call OCR/AI service)
  const extraction = simulateExtraction(proofUrl, proofReference, amount, contributionMonth)

  // 2. Check for duplicate proof
  const duplicate = await prisma.contribution.findFirst({
    where: {
      circleId,
      proofUrl: { not: null, equals: proofUrl },
      id: { not: contributionId },
    },
  })
  if (duplicate) {
    return {
      status: "REJECTED",
      confidenceScore: extraction.confidenceScore,
      extractedAmount: null,
      extractedDate: null,
      extractedReference: null,
      extractedSender: null,
      reason: "Duplicate proof: this document has already been submitted for another contribution",
    }
  }

  // 3. Verify amount match
  const amountMatch = extraction.extractedAmount !== null &&
    Math.abs(extraction.extractedAmount - amount) < 0.01

  // 4. Verify date/month match
  let dateMatch = false
  if (extraction.extractedDate && contributionMonth) {
    try {
      const extracted = new Date(extraction.extractedDate)
      const month = parseInt(contributionMonth.split("-")[1])
      const year = parseInt(contributionMonth.split("-")[0])
      const extractedMonth = extracted.getMonth() + 1
      const extractedYear = extracted.getFullYear()
      dateMatch = extractedMonth === month && extractedYear === year
    } catch { dateMatch = false }
  }

  // 5. Determine verification status
  if (amountMatch && dateMatch && extraction.confidenceScore >= 0.7) {
    return {
      status: "VERIFIED",
      confidenceScore: extraction.confidenceScore,
      extractedAmount: extraction.extractedAmount,
      extractedDate: extraction.extractedDate,
      extractedReference: extraction.extractedReference,
      extractedSender: extraction.extractedSender,
      reason: "Amount and date match with high confidence",
    }
  }

  if (amountMatch && extraction.confidenceScore >= 0.5) {
    return {
      status: "NEEDS_REVIEW",
      confidenceScore: extraction.confidenceScore,
      extractedAmount: extraction.extractedAmount,
      extractedDate: extraction.extractedDate,
      extractedReference: extraction.extractedReference,
      extractedSender: extraction.extractedSender,
      reason: "Amount matches but confidence is moderate — admin review recommended",
    }
  }

  if (!amountMatch && extraction.confidenceScore >= 0.5) {
    return {
      status: "REJECTED",
      confidenceScore: extraction.confidenceScore,
      extractedAmount: extraction.extractedAmount,
      extractedDate: extraction.extractedDate,
      extractedReference: extraction.extractedReference,
      extractedSender: extraction.extractedSender,
      reason: `Amount mismatch: expected ${amount}, extracted ${extraction.extractedAmount}`,
    }
  }

  return {
    status: "NEEDS_REVIEW",
    confidenceScore: extraction.confidenceScore,
    extractedAmount: extraction.extractedAmount,
    extractedDate: extraction.extractedDate,
    extractedReference: extraction.extractedReference,
    extractedSender: extraction.extractedSender,
    reason: "Low confidence extraction — admin review required",
  }
}

function simulateExtraction(
  proofUrl: string,
  proofReference?: string,
  expectedAmount?: number,
  contributionMonth?: string,
): ExtractionResult {
  const hasImage = proofUrl.match(/\.(jpg|jpeg|png|pdf)$/i)
  const baseConfidence = hasImage ? 0.85 : 0.4

  return {
    extractedAmount: expectedAmount ?? null,
    extractedDate: contributionMonth ? `${contributionMonth}-01` : null,
    extractedReference: proofReference ?? null,
    extractedSender: null,
    confidenceScore: baseConfidence,
  }
}

export async function applyVerificationResult(contributionId: string, result: VerificationResult) {
  return prisma.contribution.update({
    where: { id: contributionId },
    data: {
      verificationStatus: result.status as any,
      confidenceScore: result.confidenceScore,
      extractedAmount: result.extractedAmount,
      extractedDate: result.extractedDate ? new Date(result.extractedDate) : null,
      extractedReference: result.extractedReference,
      extractedSender: result.extractedSender,
      verificationReason: result.reason,
    },
  })
}
