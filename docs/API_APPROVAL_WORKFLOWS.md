# Circle Pay — Approval Workflows API

Internal API documentation for the approval-workflows feature.

---

## Table of Contents

1. [Conventions](#conventions)
2. [Workflow Management](#workflow-management)
3. [Approval Requests](#approval-requests)
4. [Delegations](#delegations)
5. [Server Actions](#server-actions)
6. [Error Codes](#error-codes)
7. [Mobile / Expo Considerations](#mobile--expo-considerations)

---

## Conventions

### Base Path

All REST routes are scoped under `/api/circles/[circleId]`. The `circleId` param must be a valid circle the authenticated user belongs to.

### Auth

Every route requires a valid session token. The user must be a member of the target circle.

### Permissions

| Role | Description |
| ---- | ----------- |
| `OWNER` | Full control over workflows, approvals, and delegations. |
| `ADMIN` | Can manage workflows and approvals. Cannot delete the circle. |
| `MEMBER` | Can submit approval requests and view own approvals. |
| `VIEWER` | Read-only access to workflows and approvals. |

### Response Format

```jsonc
// Success
{ "success": true, "data": <payload> }

// Error
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {} // optional — validation errors, etc.
  }
}
```

### Pagination

List endpoints accept `?page=1&limit=20` query params (defaults: `page=1`, `limit=20`, `maxLimit=100`). Responses include `{ total, page, limit, pages }` in `data`.

### Scope Filters

`GET /approvals` and `GET /approvals/stats` support `?scope=mine|pending|completed|all` (default: `mine`).

### Date Format

All timestamps are ISO 8601 UTC strings.

---

## Workflow Management

### 1. List Workflows

| | |
| --- | --- |
| **Route** | `GET /api/circles/[circleId]/approval-workflows` |
| **Permission** | `MEMBER` or above |
| **Query** | `?page`, `?limit`, `?status=DRAFT|ACTIVE|INACTIVE|ARCHIVED` |

**Response**

```jsonc
{
  "success": true,
  "data": {
    "workflows": [
      {
        "id": "wf_abc123",
        "name": "Expense Approval",
        "description": "Approve expenses over $100",
        "status": "ACTIVE",
        "triggerType": "AMOUNT_THRESHOLD",
        "thresholdAmount": 100,
        "thresholdCurrency": "USD",
        "stages": [
          {
            "order": 1,
            "type": "SINGLE_REVIEWER",
            "approverRole": "ADMIN",
            "timeoutHours": 48
          }
        ],
        "createdAt": "2026-01-15T10:30:00Z",
        "updatedAt": "2026-01-15T10:30:00Z",
        "createdBy": "usr_123"
      }
    ],
    "total": 5,
    "page": 1,
    "limit": 20,
    "pages": 1
  }
}
```

---

### 2. Create Workflow

| | |
| --- | --- |
| **Route** | `POST /api/circles/[circleId]/approval-workflows` |
| **Permission** | `ADMIN` or above |

**Request Body**

| Field | Type | Required | Notes |
| ----- | ---- | -------- | ----- |
| `name` | `string` | yes | 1–100 chars |
| `description` | `string` | no | Max 500 chars |
| `triggerType` | `enum` | yes | `AMOUNT_THRESHOLD` · `CATEGORY` · `MANUAL` · `ALWAYS` |
| `thresholdAmount` | `number` | conditional | Required when `triggerType` is `AMOUNT_THRESHOLD`. Min 0. |
| `thresholdCurrency` | `string` | conditional | Required when `triggerType` is `AMOUNT_THRESHOLD`. ISO 4217. |
| `categories` | `string[]` | conditional | Required when `triggerType` is `CATEGORY`. |
| `stages` | `Stage[]` | yes | Min 1 stage. See schema below. |

**Stage Schema**

| Field | Type | Required | Notes |
| ----- | ---- | -------- | ----- |
| `order` | `integer` | yes | 1-indexed, sequential. |
| `type` | `enum` | yes | `SINGLE_REVIEWER` · `ANY_REVIEWER` · `ALL_REVIEWERS` · `SEQUENTIAL` |
| `approverRole` | `enum` | conditional | Required unless `approverUserIds` is set. `OWNER` · `ADMIN` · `MEMBER` |
| `approverUserIds` | `string[]` | conditional | Explicit user IDs. Min 1. |
| `timeoutHours` | `integer` | no | Default 72. Min 1, max 720. |
| `require2FA` | `boolean` | no | Default false. |

**Response** — 201

```jsonc
{
  "success": true,
  "data": {
    "id": "wf_abc123",
    "name": "Expense Approval",
    "status": "DRAFT",
    // ... full workflow object
  }
}
```

**Errors**: `VALIDATION_ERROR`, `FORBIDDEN`, `WORKFLOW_OVERLAP` (409 if trigger ranges overlap an existing workflow).

---

### 3. Get Workflow Detail

| | |
| --- | --- |
| **Route** | `GET /api/circles/[circleId]/approval-workflows/[workflowId]` |
| **Permission** | `MEMBER` or above |

**Response**

```jsonc
{
  "success": true,
  "data": {
    "id": "wf_abc123",
    "name": "Expense Approval",
    "description": "Approve expenses over $100",
    "status": "ACTIVE",
    "triggerType": "AMOUNT_THRESHOLD",
    "thresholdAmount": 100,
    "thresholdCurrency": "USD",
    "stages": [ /* ... */ ],
    "usageCount": 42,
    "lastUsedAt": "2026-06-20T14:00:00Z",
    "createdAt": "2026-01-15T10:30:00Z",
    "updatedAt": "2026-03-01T08:00:00Z",
    "createdBy": "usr_123"
  }
}
```

**Errors**: `NOT_FOUND`

---

### 4. Update Workflow

| | |
| --- | --- |
| **Route** | `PATCH /api/circles/[circleId]/approval-workflows/[workflowId]` |
| **Permission** | `ADMIN` or above |

**Request Body** — same fields as create, all optional. Partial updates accepted. Cannot update an `ARCHIVED` workflow.

**Response** — 200 with full updated workflow object.

**Errors**: `NOT_FOUND`, `VALIDATION_ERROR`, `WORKFLOW_ARCHIVED` (409), `WORKFLOW_OVERLAP` (409).

---

### 5. Delete Workflow

| | |
| --- | --- |
| **Route** | `DELETE /api/circles/[circleId]/approval-workflows/[workflowId]` |
| **Permission** | `ADMIN` or above |

Only `DRAFT` workflows can be deleted.

**Response** — 200 `{ success: true, data: null }`

**Errors**: `NOT_FOUND`, `FORBIDDEN`, `WORKFLOW_ARCHIVED` (409 — cannot delete non-DRAFT).

---

### 6. Archive Workflow

| | |
| --- | --- |
| **Route** | `POST /api/circles/[circleId]/approval-workflows/[workflowId]/archive` |
| **Permission** | `ADMIN` or above |

Transitions `ACTIVE` or `INACTIVE` → `ARCHIVED`. Cannot archive an already-archived workflow.

**Response** — 200 with updated workflow.

**Errors**: `NOT_FOUND`, `FORBIDDEN`, `WORKFLOW_ARCHIVED` (409).

---

### 7. Activate Workflow

| | |
| --- | --- |
| **Route** | `POST /api/circles/[circleId]/approval-workflows/[workflowId]/activate` |
| **Permission** | `ADMIN` or above |

Transitions `DRAFT` or `INACTIVE` → `ACTIVE`. The workflow must pass validation (at least one stage, valid trigger config).

**Response** — 200 with updated workflow.

**Errors**: `NOT_FOUND`, `FORBIDDEN`, `WORKFLOW_INVALID` (422), `WORKFLOW_OVERLAP` (409), `WORKFLOW_ARCHIVED` (409).

---

### 8. Deactivate Workflow

| | |
| --- | --- |
| **Route** | `POST /api/circles/[circleId]/approval-workflows/[workflowId]/deactivate` |
| **Permission** | `ADMIN` or above |

Transitions `ACTIVE` → `INACTIVE`. Existing approvals using this workflow continue unaffected.

**Response** — 200 with updated workflow.

**Errors**: `NOT_FOUND`, `FORBIDDEN`, `WORKFLOW_ARCHIVED` (409).

---

### 9. Duplicate Workflow

| | |
| --- | --- |
| **Route** | `POST /api/circles/[circleId]/approval-workflows/[workflowId]/duplicate` |
| **Permission** | `ADMIN` or above |

Creates a new `DRAFT` copy of the workflow. Appends ` (Copy)` to the name.

**Request Body**

| Field | Type | Required | Notes |
| ----- | ---- | -------- | ----- |
| `name` | `string` | no | Override the default copy name. |

**Response** — 201 with new DRAFT workflow.

**Errors**: `NOT_FOUND`, `FORBIDDEN`.

---

### 10. Validate Workflow

| | |
| --- | --- |
| **Route** | `POST /api/circles/[circleId]/approval-workflows/[workflowId]/validate` |
| **Permission** | `MEMBER` or above |

Checks whether the workflow can be activated. Returns validation result without changing state.

**Response**

```jsonc
{
  "success": true,
  "data": {
    "valid": false,
    "errors": [
      { "field": "stages[0].approverUserIds", "message": "At least one reviewer must be assigned" }
    ]
  }
}
```

**Errors**: `NOT_FOUND`.

---

### 11. Preview Workflow

| | |
| --- | --- |
| **Route** | `POST /api/circles/[circleId]/approval-workflows/preview` |
| **Permission** | `MEMBER` or above |

Accepts a full workflow payload (same schema as create) and returns a preview of how it would behave — including which users match each stage, trigger overlap analysis, and validation. Does not persist.

**Request Body** — same as create.

**Response**

```jsonc
{
  "success": true,
  "data": {
    "valid": true,
    "stagesPreview": [
      { "order": 1, "type": "ADMIN", "matchedReviewers": ["usr_admin1", "usr_admin2"] }
    ],
    "triggerOverlaps": [],
    "warnings": []
  }
}
```

**Errors**: `VALIDATION_ERROR`.

---

## Approval Requests

### 12. List Approvals

| | |
| --- | --- |
| **Route** | `GET /api/circles/[circleId]/approvals` |
| **Permission** | `MEMBER` or above |
| **Query** | `?page`, `?limit`, `?scope=mine|pending|completed|all`, `?status=PENDING|APPROVED|REJECTED|CANCELLED` |

`mine` (default): only approvals where the user is the requester or assigned reviewer.
`pending`: approvals awaiting the current user's decision.
`completed`: all finalized approvals.
`all`: everything (requires `ADMIN` or above).

**Response**

```jsonc
{
  "success": true,
  "data": {
    "approvals": [
      {
        "id": "apr_xyz789",
        "title": "Office supplies purchase",
        "amount": 250,
        "currency": "USD",
        "status": "PENDING",
        "currentStage": 1,
        "totalStages": 2,
        "requestedBy": "usr_456",
        "requestedByName": "Jane Doe",
        "workflowId": "wf_abc123",
        "workflowName": "Expense Approval",
        "createdAt": "2026-06-20T14:00:00Z",
        "decisions": []
      }
    ],
    "total": 30,
    "page": 1,
    "limit": 20,
    "pages": 2
  }
}
```

---

### 13. Create Approval Request

| | |
| --- | --- |
| **Route** | `POST /api/circles/[circleId]/approvals` |
| **Permission** | `MEMBER` or above |

The matching workflow is resolved automatically from `triggerType` / `thresholdAmount` / `categories`. If no workflow matches and `MANUAL` trigger is not configured, the request proceeds without a workflow.

**Request Body**

| Field | Type | Required | Notes |
| ----- | ---- | -------- | ----- |
| `title` | `string` | yes | 1–200 chars |
| `description` | `string` | no | Max 2000 chars |
| `amount` | `number` | no | Must be ≥ 0 |
| `currency` | `string` | no | ISO 4217, defaults to circle's default |
| `category` | `string` | no | Must match a workflow's `categories` if applicable |
| `metadata` | `Record<string, unknown>` | no | Arbitrary JSON, max 10KB |
| `workflowId` | `string` | no | Explicit workflow override |

**Response** — 201

```jsonc
{
  "success": true,
  "data": {
    "id": "apr_xyz789",
    "title": "Office supplies purchase",
    "amount": 250,
    "currency": "USD",
    "status": "PENDING",
    "currentStage": 1,
    "totalStages": 2,
    "requestedBy": "usr_456",
    "workflowId": "wf_abc123",
    "stages": [
      {
        "order": 1,
        "status": "PENDING",
        "reviewers": [
          { "userId": "usr_admin1", "name": "Admin User", "status": "PENDING" }
        ]
      }
    ],
    "createdAt": "2026-06-20T14:00:00Z"
  }
}
```

**Errors**: `VALIDATION_ERROR`, `FORBIDDEN`, `WORKFLOW_INVALID` (if matched workflow fails validation).

---

### 14. Get Approval Detail

| | |
| --- | --- |
| **Route** | `GET /api/circles/[circleId]/approvals/[approvalId]` |
| **Permission** | `MEMBER` or above (own approvals, or ADMIN+) |

**Response** — full approval object including all stages, reviewer statuses, and decisions.

**Errors**: `NOT_FOUND`.

---

### 15. Cancel Approval (via PATCH)

| | |
| --- | --- |
| **Route** | `PATCH /api/circles/[circleId]/approvals/[approvalId]` |
| **Permission** | Requester or `ADMIN` |

**Request Body**

| Field | Type | Required | Notes |
| ----- | ---- | -------- | ----- |
| `status` | `string` | yes | Must be `"CANCELLED"` |
| `reason` | `string` | no | Max 500 chars |

**Response** — 200 with updated approval.

**Errors**: `NOT_FOUND`, `APPROVAL_ALREADY_COMPLETED` (409), `APPROVAL_STAGE_NOT_ACTIVE` (409).

---

### 16. Get Stage Progress

| | |
| --- | --- |
| **Route** | `GET /api/circles/[circleId]/approvals/[approvalId]/stages` |
| **Permission** | `MEMBER` or above |

**Response**

```jsonc
{
  "success": true,
  "data": {
    "approvalId": "apr_xyz789",
    "currentStage": 1,
    "totalStages": 2,
    "stages": [
      {
        "order": 1,
        "type": "ANY_REVIEWER",
        "status": "PENDING",
        "reviewers": [
          { "userId": "usr_admin1", "status": "PENDING", "assignedAt": "2026-06-20T14:01:00Z" }
        ],
        "timeoutAt": "2026-06-22T14:00:00Z"
      },
      {
        "order": 2,
        "type": "ALL_REVIEWERS",
        "status": "WAITING",
        "reviewers": []
      }
    ]
  }
}
```

**Errors**: `NOT_FOUND`.

---

### 17. Decide (Approve / Reject)

| | |
| --- | --- |
| **Route** | `POST /api/circles/[circleId]/approvals/[approvalId]/decide` |
| **Permission** | Assigned reviewer on the current stage, or `ADMIN` |

**Request Body**

| Field | Type | Required | Notes |
| ----- | ---- | -------- | ----- |
| `decision` | `enum` | yes | `APPROVED` · `REJECTED` |
| `comment` | `string` | no | Max 1000 chars |
| `token2FA` | `string` | conditional | Required if stage has `require2FA`. |

**Behavior**: If the stage completes (e.g., `ANY_REVIEWER` gets one approval), the approval advances to the next stage. If it was the last stage, the approval status becomes `APPROVED`. Rejection immediately finalizes the approval as `REJECTED`.

**Response** — 200 with updated approval.

**Errors**: `NOT_FOUND`, `APPROVAL_REVIEWER_NOT_ASSIGNED` (403), `APPROVAL_SELF_REVIEW_FORBIDDEN` (403), `APPROVAL_ALREADY_DECIDED` (409), `APPROVAL_ALREADY_COMPLETED` (409), `APPROVAL_STAGE_NOT_ACTIVE` (409).

---

### 18. Get Timeline

| | |
| --- | --- |
| **Route** | `GET /api/circles/[circleId]/approvals/[approvalId]/timeline` |
| **Permission** | `MEMBER` or above |

**Response**

```jsonc
{
  "success": true,
  "data": {
    "timeline": [
      { "type": "CREATED", "userId": "usr_456", "timestamp": "2026-06-20T14:00:00Z" },
      { "type": "STAGE_ENTERED", "stage": 1, "timestamp": "2026-06-20T14:00:01Z" },
      { "type": "REVIEWER_ASSIGNED", "userId": "usr_admin1", "stage": 1, "timestamp": "2026-06-20T14:01:00Z" },
      { "type": "DECISION", "userId": "usr_admin1", "decision": "APPROVED", "stage": 1, "comment": "Looks good", "timestamp": "2026-06-21T09:00:00Z" },
      { "type": "STAGE_ENTERED", "stage": 2, "timestamp": "2026-06-21T09:00:01Z" }
    ]
  }
}
```

**Errors**: `NOT_FOUND`.

---

### 19. Cancel Approval (via POST)

| | |
| --- | --- |
| **Route** | `POST /api/circles/[circleId]/approvals/[approvalId]/cancel` |
| **Permission** | Requester or `ADMIN` |

**Request Body**

| Field | Type | Required | Notes |
| ----- | ---- | -------- | ----- |
| `reason` | `string` | no | Max 500 chars |

**Response** — 200 with updated approval (`status: "CANCELLED"`).

**Errors**: `NOT_FOUND`, `APPROVAL_ALREADY_COMPLETED` (409).

---

### 20. Manual Escalation

| | |
| --- | --- |
| **Route** | `POST /api/circles/[circleId]/approvals/[approvalId]/escalate` |
| **Permission** | `ADMIN` or above, or auto-escalation on timeout |

**Request Body**

| Field | Type | Required | Notes |
| ----- | ---- | -------- | ----- |
| `targetUserId` | `string` | no | Escalate to a specific user. If omitted, escalates to next `ADMIN`. |
| `reason` | `string` | no | Max 500 chars |

**Response** — 200 with updated approval. The target user becomes a reviewer on the current stage.

**Errors**: `NOT_FOUND`, `FORBIDDEN`, `APPROVAL_ALREADY_COMPLETED` (409), `APPROVAL_STAGE_NOT_ACTIVE` (409).

---

### 21. Reassign Reviewer

| | |
| --- | --- |
| **Route** | `POST /api/circles/[circleId]/approvals/[approvalId]/reassign` |
| **Permission** | `ADMIN` or above |

**Request Body**

| Field | Type | Required | Notes |
| ----- | ---- | -------- | ----- |
| `fromUserId` | `string` | yes | Current reviewer to replace. |
| `toUserId` | `string` | yes | New reviewer. |
| `reason` | `string` | no | Max 500 chars |

**Response** — 200 with updated approval. Original reviewer's decision (if any) is preserved; the new reviewer starts as `PENDING`.

**Errors**: `NOT_FOUND`, `FORBIDDEN`, `APPROVAL_REVIEWER_NOT_ASSIGNED` (403), `APPROVAL_ALREADY_COMPLETED` (409).

---

### 22. Approval Statistics

| | |
| --- | --- |
| **Route** | `GET /api/circles/[circleId]/approvals/stats` |
| **Permission** | `MEMBER` or above |
| **Query** | `?scope=mine|all` |

**Response**

```jsonc
{
  "success": true,
  "data": {
    "total": 150,
    "pending": 12,
    "approved": 120,
    "rejected": 10,
    "cancelled": 8,
    "avgResolutionHours": 18.5,
    "byWorkflow": [
      { "workflowId": "wf_abc123", "workflowName": "Expense Approval", "count": 80, "avgHours": 12.3 },
      { "workflowId": "wf_def456", "workflowName": "Contract Review", "count": 45, "avgHours": 36.1 }
    ]
  }
}
```

---

## Delegations

### 23. List Delegations

| | |
| --- | --- |
| **Route** | `GET /api/circles/[circleId]/delegations` |
| **Permission** | `MEMBER` or above |
| **Query** | `?page`, `?limit`, `?active=true|false` |

**Response**

```jsonc
{
  "success": true,
  "data": {
    "delegations": [
      {
        "id": "dlg_001",
        "fromUserId": "usr_admin1",
        "fromUserName": "Admin User",
        "toUserId": "usr_member1",
        "toUserName": "Backup Member",
        "reason": "Vacation",
        "startAt": "2026-07-01T00:00:00Z",
        "endAt": "2026-07-15T23:59:59Z",
        "isActive": true,
        "createdAt": "2026-06-25T10:00:00Z"
      }
    ],
    "total": 3,
    "page": 1,
    "limit": 20,
    "pages": 1
  }
}
```

---

### 24. Create Delegation

| | |
| --- | --- |
| **Route** | `POST /api/circles/[circleId]/delegations` |
| **Permission** | `MEMBER` or above (users can delegate their own authority) |

**Request Body**

| Field | Type | Required | Notes |
| ----- | ---- | -------- | ----- |
| `toUserId` | `string` | yes | Must be a member of the circle. Cannot be self. |
| `reason` | `string` | no | Max 200 chars |
| `startAt` | `string` | yes | ISO 8601 datetime |
| `endAt` | `string` | yes | ISO 8601 datetime. Must be after `startAt`. Max 90 days. |

**Response** — 201 with delegation object.

**Errors**: `VALIDATION_ERROR`, `DELEGATION_SELF` (409), `DELEGATION_CYCLE` (409 — prevents A→B→A chain), `FORBIDDEN`.

---

### 25. Get Delegation Detail

| | |
| --- | --- |
| **Route** | `GET /api/circles/[circleId]/delegations/[delegationId]` |
| **Permission** | `MEMBER` or above |

**Response** — full delegation object.

**Errors**: `NOT_FOUND`.

---

### 26. Revoke Delegation

| | |
| --- | --- |
| **Route** | `DELETE /api/circles/[circleId]/delegations/[delegationId]` |
| **Permission** | Delegating user (`fromUserId`) or `ADMIN` |

**Response** — 200 `{ success: true, data: null }`

**Errors**: `NOT_FOUND`, `FORBIDDEN`.

---

## Server Actions

Server actions are Next.js mutations invoked via `useActionState` / `useFormState` in the web client. They accept `FormData` and return `{ success, error?, data? }`.

### 27. createWorkflowAction

| | |
| --- | --- |
| **Action** | `createWorkflowAction(circleId, formData)` |
| **Permission** | `ADMIN` or above |

**FormData fields**: `name`, `description`, `triggerType`, `thresholdAmount`, `thresholdCurrency`, `categories` (JSON array), `stages` (JSON array).

**Response**: `{ success: true, data: Workflow }` or `{ success: false, error: { code, message, details } }`.

---

### 28. updateWorkflowAction

| | |
| --- | --- |
| **Action** | `updateWorkflowAction(circleId, workflowId, formData)` |
| **Permission** | `ADMIN` or above |

Same fields as `createWorkflowAction`, all optional.

---

### 29. activateWorkflowAction

| | |
| --- | --- |
| **Action** | `activateWorkflowAction(circleId, workflowId)` |
| **Permission** | `ADMIN` or above |

No additional form data needed.

---

### 30. archiveWorkflowAction

| | |
| --- | --- |
| **Action** | `archiveWorkflowAction(circleId, workflowId)` |
| **Permission** | `ADMIN` or above |

No additional form data needed.

---

### 31. decideApprovalAction

| | |
| --- | --- |
| **Action** | `decideApprovalAction(circleId, approvalId, formData)` |
| **Permission** | Assigned reviewer or `ADMIN` |

**FormData fields**: `decision` (`APPROVED` | `REJECTED`), `comment` (optional), `token2FA` (optional).

---

### 32. cancelApprovalAction

| | |
| --- | --- |
| **Action** | `cancelApprovalAction(circleId, approvalId, formData)` |
| **Permission** | Requester or `ADMIN` |

**FormData fields**: `reason` (optional).

---

### 33. createDelegationAction

| | |
| --- | --- |
| **Action** | `createDelegationAction(circleId, formData)` |
| **Permission** | Any member |

**FormData fields**: `toUserId`, `reason`, `startAt`, `endAt`.

---

### 34. revokeDelegationAction

| | |
| --- | --- |
| **Action** | `revokeDelegationAction(circleId, delegationId)` |
| **Permission** | Delegating user or `ADMIN` |

No additional form data needed.

---

## Error Codes

| Code | HTTP | Description |
| ---- | ---- | ----------- |
| `UNAUTHORIZED` | 401 | Missing or invalid authentication. |
| `FORBIDDEN` | 403 | User lacks the required role/permission. |
| `NOT_FOUND` | 404 | Resource does not exist or is not accessible. |
| `VALIDATION_ERROR` | 422 | Request body / query failed validation. `details` contains field-level errors. |
| `CONFLICT` | 409 | Generic conflict (resource state mismatch). |
| `WORKFLOW_INVALID` | 422 | Workflow definition is incomplete or invalid (missing stages, bad trigger config). |
| `WORKFLOW_ARCHIVED` | 409 | Operation is not allowed on an archived workflow. |
| `WORKFLOW_OVERLAP` | 409 | The workflow's trigger range overlaps an existing active workflow. |
| `APPROVAL_STAGE_NOT_ACTIVE` | 409 | The targeted stage is not the current active stage. |
| `APPROVAL_REVIEWER_NOT_ASSIGNED` | 403 | User is not a reviewer on the current stage. |
| `APPROVAL_SELF_REVIEW_FORBIDDEN` | 403 | Requester cannot approve their own request. |
| `APPROVAL_ALREADY_DECIDED` | 409 | Reviewer has already decided on this stage. |
| `APPROVAL_ALREADY_COMPLETED` | 409 | Approval is already finalized (approved, rejected, or cancelled). |
| `DELEGATION_CYCLE` | 409 | Delegation creates a cycle (A→B and B→A). |
| `DELEGATION_SELF` | 409 | Cannot delegate to yourself. |

---

## Mobile / Expo Considerations

When consuming these APIs from the Expo (React Native) mobile client:

- **Auth tokens**: Pass the session token via `Authorization: Bearer <token>` header. The mobile client stores tokens in `expo-secure-store`.
- **Server actions are web-only**: Do not call server actions from mobile. Use the REST API equivalents (routes 1–26) instead.
- **Pagination**: Always request paginated results. Use `limit=20` as default on mobile to minimize payload size over cellular connections.
- **Real-time updates**: The approval timeline and stage status can be polled at 15-second intervals or via WebSocket if configured. Avoid aggressive polling.
- **Optimistic UI**: When deciding on an approval, the mobile client can optimistically update local state before the response arrives, then reconcile on success.
- **Error handling**: All errors follow the standard `{ success, error: { code, message } }` shape. Map `code` to user-friendly messages locally. Do not rely on `message` for display — it may contain technical details.
- **Offline support**: Cache approval lists in `expo-sqlite` or AsyncStorage. Defer mutations (decide, cancel, etc.) and retry on reconnect.
- **Timeouts**: Set a 15-second timeout on network requests. The `timeoutHours` on workflow stages is unrelated to API request timeouts.
- **Binary data**: Workflow and approval payloads are JSON-only. No file upload endpoints exist on these routes.
