import { NextRequest, NextResponse } from "next/server"
import { requireCircleAccess } from "@/lib/api/auth"
import { getProofUrl } from "@/lib/services/upload.service"

// A stored proof key has the form: <circleId>/<24-hex-hash>.<allowlisted-ext>
const VALID_KEY = /^[A-Za-z0-9_-]+\/[a-f0-9]{24}\.(jpg|jpeg|png|webp|heic|pdf)$/

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const { key } = await params

  // Require exactly two segments (circleId / filename).
  if (!key || key.length !== 2) {
    return NextResponse.json({ error: "Invalid proof request" }, { status: 400 })
  }

  const proofUrl = `/api/proofs/${key.join("/")}`

  // Reject malformed keys, path traversal (".."), embedded slashes in the
  // filename, and non-allowlisted extensions before touching storage.
  if (!VALID_KEY.test(proofUrl)) {
    return NextResponse.json({ error: "Invalid proof key" }, { status: 400 })
  }

  const circleId = key[0]

  // Require an authenticated member of the proof's circle (rejects cross-circle
  // access). Never exposes bucket credentials or presigns for non-members.
  const access = await requireCircleAccess(circleId)
  if (access.error) {
    return access.error
  }

  try {
    const signedUrl = await getProofUrl(proofUrl)
    return NextResponse.redirect(signedUrl, 302)
  } catch (error) {
    return NextResponse.json({ error: "Failed to resolve proof" }, { status: 404 })
  }
}
