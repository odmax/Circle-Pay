import { NextResponse } from "next/server"

export type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "WORKFLOW_INVALID"
  | "WORKFLOW_ARCHIVED"
  | "WORKFLOW_OVERLAP"
  | "APPROVAL_STAGE_NOT_ACTIVE"
  | "APPROVAL_REVIEWER_NOT_ASSIGNED"
  | "APPROVAL_SELF_REVIEW_FORBIDDEN"
  | "APPROVAL_ALREADY_DECIDED"
  | "APPROVAL_DELEGATION_INVALID"
  | "APPROVAL_ALREADY_COMPLETED"
  | "DELEGATION_CYCLE"
  | "DELEGATION_SELF"
  | "DELEGATION_OVERLAP"
  | "REASSIGNMENT_INVALID"
  | "INTERNAL_ERROR"

export interface ApiError {
  code: ErrorCode
  message: string
  details?: unknown
}

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status })
}

export function apiCreated<T>(data: T) {
  return NextResponse.json({ success: true, data }, { status: 201 })
}

export function apiError(code: ErrorCode, message: string, status?: number, details?: unknown) {
  const httpStatus = status ?? errorStatusMap[code] ?? 500
  return NextResponse.json(
    { success: false, error: { code, message, ...(details ? { details } : {}) } },
    { status: httpStatus }
  )
}

export function mapServiceError(error: unknown) {
  if (!(error instanceof Error)) {
    return apiError("INTERNAL_ERROR", "An unexpected error occurred")
  }
  const msg = error.message

  if (msg.includes("not found") || msg.includes("Not found")) return apiError("NOT_FOUND", msg)
  if (msg.includes("Permission denied") || msg.includes("permission")) return apiError("FORBIDDEN", msg)
  if (msg.includes("Unauthorized")) return apiError("UNAUTHORIZED", msg)
  if (msg.includes("already") && msg.includes("voted")) return apiError("APPROVAL_ALREADY_DECIDED", msg)
  if (msg.includes("already") && msg.includes("completed")) return apiError("APPROVAL_ALREADY_COMPLETED", msg)
  if (msg.includes("not active")) return apiError("APPROVAL_STAGE_NOT_ACTIVE", msg)
  if (msg.includes("not assigned")) return apiError("APPROVAL_REVIEWER_NOT_ASSIGNED", msg)
  if (msg.includes("Self-approval")) return apiError("APPROVAL_SELF_REVIEW_FORBIDDEN", msg)
  if (msg.includes("expired") || msg.includes("Expire")) return apiError("CONFLICT", msg)
  if (msg.includes("Cannot edit archived")) return apiError("WORKFLOW_ARCHIVED", msg)
  if (msg.includes("validation failed")) return apiError("WORKFLOW_INVALID", msg, 422)
  if (msg.includes("overlapping")) return apiError("WORKFLOW_OVERLAP", msg, 409)
  if (msg.includes("cycle") || msg.includes("circular")) return apiError("DELEGATION_CYCLE", msg, 409)
  if (msg.includes("self-delegation")) return apiError("DELEGATION_SELF", msg, 409)

  return apiError("INTERNAL_ERROR", "An internal error occurred")
}

const errorStatusMap: Record<ErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 422,
  CONFLICT: 409,
  WORKFLOW_INVALID: 422,
  WORKFLOW_ARCHIVED: 409,
  WORKFLOW_OVERLAP: 409,
  APPROVAL_STAGE_NOT_ACTIVE: 409,
  APPROVAL_REVIEWER_NOT_ASSIGNED: 403,
  APPROVAL_SELF_REVIEW_FORBIDDEN: 403,
  APPROVAL_ALREADY_DECIDED: 409,
  APPROVAL_DELEGATION_INVALID: 409,
  APPROVAL_ALREADY_COMPLETED: 409,
  DELEGATION_CYCLE: 409,
  DELEGATION_SELF: 409,
  DELEGATION_OVERLAP: 409,
  REASSIGNMENT_INVALID: 422,
  INTERNAL_ERROR: 500,
}
