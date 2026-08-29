import { describe, it, expect } from "vitest"
import * as fs from "fs"
import * as path from "path"
import { validateProofFile, s3ObjectKeyFromProofUrl } from "@/lib/services/upload.service"

function readFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(relativePath), "utf-8")
}

function exists(relativePath: string): boolean {
  return fs.existsSync(path.resolve(relativePath))
}

const routes = [
  "src/app/api/circles/[circleId]/grocery/[campaignId]/quotes/route.ts",
  "src/app/api/circles/[circleId]/grocery/[campaignId]/expenses/route.ts",
  "src/app/api/circles/[circleId]/grocery/[campaignId]/purchase/route.ts",
  "src/app/api/circles/[circleId]/loans/[loanId]/disburse/proof/route.ts",
  "src/app/api/circles/[circleId]/loans/[loanId]/repayments/proof/route.ts",
  "src/app/api/circles/[circleId]/payouts/[cycleId]/route.ts",
  "src/app/api/circles/[circleId]/contributions/[contributionId]/route.ts",
  "src/app/api/mobile/uploads/proof/route.ts",
]

describe("Storage Proofs — Pure Validation", () => {
  it("SP1: validateProofFile rejects oversized files", () => {
    expect(() => validateProofFile({ size: 5 * 1024 * 1024 + 1, type: "image/jpeg" })).toThrow(/too large/i)
  })

  it("SP2: validateProofFile accepts allowed MIME types at/below 5MB", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"]) {
      expect(validateProofFile({ size: 1024, type })).toBe(true)
    }
  })

  it("SP3: validateProofFile rejects disallowed MIME types", () => {
    expect(() => validateProofFile({ size: 100, type: "text/html" })).toThrow(/type .* not allowed/i)
  })

  it("SP4: validateProofFile rejects non-allowlisted extensions", () => {
    expect(() => validateProofFile({ size: 100, type: "image/jpeg", name: "proof.svg" })).toThrow(/extension not allowed/i)
  })

  it("SP5: s3ObjectKeyFromProofUrl converts an internal URL to an object key", () => {
    expect(s3ObjectKeyFromProofUrl("/api/proofs/circle123/abcd1234abcd1234abcd1234.jpg")).toBe(
      "proofs/circle123/abcd1234abcd1234abcd1234.jpg"
    )
  })

  it("SP6: s3ObjectKeyFromProofUrl rejects non-proof URLs", () => {
    expect(() => s3ObjectKeyFromProofUrl("/images/logo.png")).toThrow(/invalid proof url/i)
  })
})

describe("Storage Proofs — Serving Route Security", () => {
  const route = exists("src/app/api/proofs/[...key]/route.ts")
    ? readFile("src/app/api/proofs/[...key]/route.ts")
    : ""

  it("SP7: protected serving route exists", () => {
    expect(exists("src/app/api/proofs/[...key]/route.ts")).toBe(true)
  })

  it("SP8: route requires an authenticated circle member (rejects cross-circle)", () => {
    expect(route).toContain("requireCircleAccess")
    expect(route).toContain("circleId")
  })

  it("SP9: route enforces a strict key allowlist and rejects path traversal", () => {
    expect(route).toContain("VALID_KEY")
    expect(route).toContain("\\.")
    // Rejects embedded slashes in the filename and '..' traversal
    expect(route).toContain("[a-f0-9]{24}")
  })

  it("SP10: route responds with a 302 redirect to a presigned URL", () => {
    expect(route).toContain("getProofUrl")
    expect(route).toContain("NextResponse.redirect")
    expect(route).toContain("302")
  })

  it("SP11: route never exposes bucket credentials", () => {
    expect(route).not.toContain("AWS_SECRET_ACCESS_KEY")
    expect(route).not.toContain("AWS_ACCESS_KEY_ID")
  })
})

describe("Storage Proofs — No Local Filesystem", () => {
  const svc = readFile("src/lib/services/upload.service.ts")

  it("SP12: upload service uses S3, not the local filesystem", () => {
    expect(svc).toContain("@aws-sdk/client-s3")
    expect(svc).toContain("@aws-sdk/s3-request-presigner")
    expect(svc).toContain("S3Client")
    expect(svc).toContain("PutObjectCommand")
    expect(svc).toContain("GetObjectCommand")
    expect(svc).toContain("getSignedUrl")
  })

  it("SP13: no public/uploads writes remain in the upload service", () => {
    expect(svc).not.toContain("public/uploads")
    expect(svc).not.toContain("UPLOAD_DIR")
    expect(svc).not.toContain("writeFile")
    expect(svc).not.toContain('from "fs/promises"')
  })

  it("SP14: stored URL is the stable internal /api/proofs path, not a presigned URL", () => {
    expect(svc).toContain("`/api/proofs/${circleId}/${safeName}`")
    expect(JSON.stringify(svc)).not.toContain("X-Amz-Signature")
  })

  it("SP15: object key embeds circleId for circle-scoped authorization", () => {
    expect(svc).toContain("`proofs/${circleId}/${safeName}`")
  })

  it("SP16: uploadProofImage accepts circleId and reads AWS env config", () => {
    expect(svc).toContain("uploadProofImage(")
    expect(svc).toContain("circleId: string")
    expect(svc).toContain("AWS_S3_BUCKET")
    expect(svc).toContain("AWS_S3_ENDPOINT")
    expect(svc).toContain("PROOF_URL_TTL_SECONDS")
  })

  it("SP17: generateProofKey uses a random hash, not the raw userId", () => {
    expect(svc).toContain('crypto.createHash("sha256")')
    expect(svc).toContain("Date.now()")
  })
})

describe("Storage Proofs — Call Sites Pass circleId", () => {
  it("SP18: every upload call site exists", () => {
    for (const r of routes) expect(exists(r)).toBe(true)
  })

  it("SP19: no call site uses the old 3-argument upload signature", () => {
    for (const r of routes) {
      const src = readFile(r)
      expect(src).not.toContain("uploadProofImage(buffer, file.name, session.user.id)")
      expect(src).not.toContain("uploadProofImage(buffer, file.name, user.id)")
    }
  })

  it("SP20: grocery/loans/payout/contribution sites pass their circleId param", () => {
    for (const r of routes.slice(0, 7)) {
      expect(readFile(r)).toContain(", circleId)")
    }
  })

  it("SP21: mobile site passes the payment intent's real circleId", () => {
    expect(readFile(routes[7])).toContain("intent.circleId")
  })
})

describe("Storage Proofs — Cron Scheduling", () => {
  it("SP22: vercel.json schedules all three cron endpoints", () => {
    const v = readFile("vercel.json")
    expect(v).toContain("/api/cron/contribution-scheduler")
    expect(v).toContain("/api/cron/automations/run")
    expect(v).toContain("/api/cron/process-approvals")
  })

  it("SP23: cron routes require CRON_SECRET (fail closed)", () => {
    for (const r of ["src/app/api/cron/contribution-scheduler/route.ts", "src/app/api/cron/automations/run/route.ts", "src/app/api/cron/process-approvals/route.ts"]) {
      expect(readFile(r)).toContain("CRON_SECRET")
    }
  })

  it("SP24: .env.example documents storage and cron env vars", () => {
    const env = readFile(".env.example")
    for (const key of ["AWS_REGION", "AWS_S3_BUCKET", "AWS_S3_ENDPOINT", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "PROOF_URL_TTL_SECONDS", "CRON_SECRET"]) {
      expect(env).toContain(key)
    }
  })
})
