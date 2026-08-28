// Production TODO: Replace with Vercel Blob, S3, or Cloudinary storage
// For development: store files in /public/uploads/ directory

import { writeFile, mkdir } from "fs/promises"
import path from "path"
import crypto from "crypto"

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "proofs")
const MAX_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"]
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".heic", ".pdf"]

export function validateProofFile(file: { size: number; type: string; name?: string }) {
  if (file.size > MAX_SIZE) throw new Error(`File too large. Maximum size is 5MB.`)
  if (!ALLOWED_TYPES.includes(file.type)) throw new Error(`File type ${file.type} not allowed. Use JPEG, PNG, WebP, or HEIC.`)
  // Prevent serving attacker-controlled extensions (.html/.svg/.js) from public/
  // even when the MIME header is spoofed to an allowed image type.
  if (file.name) {
    const ext = path.extname(file.name).toLowerCase()
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      throw new Error("File extension not allowed. Use JPEG, PNG, WebP, HEIC, or PDF.")
    }
  }
  return true
}

export async function uploadProofImage(file: Buffer, fileName: string, userId: string): Promise<{ proofUrl: string; fileName: string; size: number }> {
  await mkdir(UPLOAD_DIR, { recursive: true })
  const hash = crypto.createHash("sha256").update(userId + Date.now().toString()).digest("hex").slice(0, 12)
  const rawExt = path.extname(fileName || "").toLowerCase()
  const ext = ALLOWED_EXTENSIONS.includes(rawExt) ? rawExt : ".jpg"
  const safeName = `proof-${hash}${ext}`
  const filePath = path.join(UPLOAD_DIR, safeName)
  await writeFile(filePath, file)
  return { proofUrl: `/uploads/proofs/${safeName}`, fileName: safeName, size: file.length }
}
