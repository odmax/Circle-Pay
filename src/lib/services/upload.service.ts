// Durable S3-compatible proof storage (AWS S3, Cloudflare R2, MinIO, etc.).
// Files are never written to the local filesystem; the DB stores a stable,
// non-expiring internal URL (`/api/proofs/...`) which a protected route later
// resolves to a short-lived presigned GET URL.

import crypto from "crypto"
import path from "path"
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

const MAX_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"]
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".heic", ".pdf"]

function getBucket(): string {
  const bucket = process.env.AWS_S3_BUCKET
  if (!bucket) {
    throw new Error("AWS_S3_BUCKET is not configured. Set AWS_S3_BUCKET (and the AWS credentials region/endpoint) to enable proof storage.")
  }
  return bucket
}

// Lazily created so importing this module never requires S3 env config; only
// actual upload/presign calls do. Supports S3-compatible providers via the
// optional AWS_S3_ENDPOINT override (defaults to AWS-Region-backed S3).
let _client: S3Client | null = null
function getClient(): S3Client {
  if (!_client) {
    _client = new S3Client({
      region: process.env.AWS_REGION || "us-east-1",
      ...(process.env.AWS_S3_ENDPOINT ? { endpoint: process.env.AWS_S3_ENDPOINT } : {}),
    })
  }
  return _client
}

export function validateProofFile(file: { size: number; type: string; name?: string }) {
  if (file.size > MAX_SIZE) throw new Error(`File too large. Maximum size is 5MB.`)
  if (!ALLOWED_TYPES.includes(file.type)) throw new Error(`File type ${file.type} not allowed. Use JPEG, PNG, WebP, or HEIC.`)
  // Prevent serving attacker-controlled extensions (.html/.svg/.js) from storage
  // even when the MIME header is spoofed to an allowed image type.
  if (file.name) {
    const ext = path.extname(file.name).toLowerCase()
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      throw new Error("File extension not allowed. Use JPEG, PNG, WebP, HEIC, or PDF.")
    }
  }
  return true
}

export async function uploadProofImage(
  file: Buffer,
  fileName: string,
  userId: string,
  circleId: string
): Promise<{ proofUrl: string; fileName: string; size: number }> {
  const bucket = getBucket()
  const hash = crypto.createHash("sha256").update(`${userId}:${circleId}:${Date.now()}`).digest("hex").slice(0, 24)
  const rawExt = path.extname(fileName || "").toLowerCase()
  const ext = ALLOWED_EXTENSIONS.includes(rawExt) ? rawExt : ".jpg"
  const safeName = `${hash}${ext}`
  const objectKey = `proofs/${circleId}/${safeName}`

  await getClient().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: file,
      ContentType: mimeForExtension(ext),
    })
  )

  return {
    proofUrl: `/api/proofs/${circleId}/${safeName}`,
    fileName: safeName,
    size: file.length,
  }
}

// Resolve a stable internal URL (e.g. "/api/proofs/<circleId>/<hash>.jpg") to a
// short-lived presigned S3 GET URL. Throws for malformed or non-allowlisted keys.
export async function getProofUrl(proofUrl: string): Promise<string> {
  const key = s3ObjectKeyFromProofUrl(proofUrl)
  const ttl = Number(process.env.PROOF_URL_TTL_SECONDS || "3600")
  return getSignedUrl(
    getClient(),
    new GetObjectCommand({ Bucket: getBucket(), Key: key }),
    { expiresIn: ttl }
  )
}

// "/api/proofs/<circleId>/<hash>.jpg" -> "proofs/<circleId>/<hash>.jpg"
export function s3ObjectKeyFromProofUrl(proofUrl: string): string {
  const prefix = "/api/"
  if (!proofUrl.startsWith(prefix + "proofs/")) {
    throw new Error("Invalid proof URL")
  }
  return proofUrl.slice(prefix.length)
}

const EXT_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".pdf": "application/pdf",
}

function mimeForExtension(ext: string): string {
  return EXT_MIME[ext] ?? "application/octet-stream"
}
