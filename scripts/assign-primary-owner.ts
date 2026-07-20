#!/usr/bin/env npx tsx
/**
 * Assign primary owner script.
 *
 * Usage:
 *   npx tsx scripts/assign-primary-owner.ts --email Ademoyemo@gmail.com --dry-run   (default)
 *   npx tsx scripts/assign-primary-owner.ts --email Ademoyemo@gmail.com --execute
 *
 * - Defaults to dry-run (safe).
 * - Requires --execute to perform changes.
 * - Normalizes email (case-insensitive).
 * - Idempotent: safe to run multiple times.
 *
 * Actions performed on --execute:
 * 1. Find exactly one user by email.
 * 2. Ensure InternalAdmin exists with SUPER_ADMIN role.
 * 3. Ensure owner-unlimited plan exists (seeds plans).
 * 4. Assign owner-unlimited subscription (ACTIVE, no expiry).
 * 5. Mark email verified.
 */

import { prisma } from "../src/lib/prisma"
import { normalizeEmail, emailsEqual } from "../src/lib/email"
import { assignOwnerUnlimitedPlan, seedPlans } from "../src/lib/services/subscription.service"

function getArg(args: string[], name: string): string | undefined {
  const idx = args.indexOf(`--${name}`)
  if (idx === -1) return undefined
  return args[idx + 1]
}

function hasFlag(args: string[], name: string): boolean {
  return args.includes(`--${name}`)
}

async function main() {
  const rawArgs = process.argv.slice(2)

  const emailArg = getArg(rawArgs, "email")
  const dryRun = hasFlag(rawArgs, "dry-run") || !hasFlag(rawArgs, "execute")

  if (!emailArg) {
    console.error("Error: --email is required.")
    console.error("  Usage: npx tsx scripts/assign-primary-owner.ts --email user@example.com --execute")
    process.exit(1)
  }

  const email = normalizeEmail(emailArg)
  if (!email) {
    console.error("Error: Invalid email.")
    process.exit(1)
  }

  const configuredOwnerEmail = normalizeEmail(process.env.OWNER_EMAIL)
  if (!configuredOwnerEmail) {
    console.error("Error: OWNER_EMAIL environment variable is not set.")
    console.error("  Set OWNER_EMAIL in your .env file.")
    process.exit(1)
  }

  if (email !== configuredOwnerEmail) {
    console.error(`Error: Email "${email}" does not match OWNER_EMAIL "${configuredOwnerEmail}".`)
    console.error("  The email must match the configured OWNER_EMAIL.")
    process.exit(1)
  }

  console.log(`\nAssign Primary Owner`)
  console.log(`  Email:  ${email}`)
  console.log(`  Mode:   ${dryRun ? "DRY RUN (no changes)" : "EXECUTE (will modify database)"}\n`)

  const users = await prisma.user.findMany({
    where: { email: { equals: email, mode: "insensitive" } },
    select: {
      id: true,
      email: true,
      name: true,
      emailVerified: true,
      internalAdmin: true,
      subscription: { include: { plan: true } },
    },
  })

  if (users.length === 0) {
    console.error(`No user found with email: ${email}`)
    console.error("  The user must register first before assigning primary owner.")
    process.exit(1)
  }

  if (users.length > 1) {
    console.error(`Multiple users found with email: ${email} (${users.length} matches)`)
    console.error("  This should not happen due to the unique constraint. Manual investigation required.")
    process.exit(1)
  }

  const user = users[0]
  console.log(`User found: ${user.name || "(no name)"} <${user.email}> (id: ${user.id})\n`)

  // Current state
  console.log("Current state:")
  console.log(`  InternalAdmin: ${user.internalAdmin ? `${user.internalAdmin.role} (active: ${user.internalAdmin.isActive})` : "NONE"}`)
  if (user.subscription) {
    console.log(`  Subscription: ${user.subscription.plan.name} (${user.subscription.plan.slug}) - status: ${user.subscription.status}`)
  } else {
    console.log(`  Subscription: NONE`)
  }
  console.log(`  Email verified: ${user.emailVerified ? "YES" : "NO"}`)

  // Planned changes
  console.log("\nPlanned changes:")

  let hasChanges = false

  if (!user.internalAdmin || !user.internalAdmin.isActive || user.internalAdmin.role !== "SUPER_ADMIN") {
    console.log("  - Create/update InternalAdmin with role SUPER_ADMIN, isActive: true")
    hasChanges = true
  } else {
    console.log("  - InternalAdmin: already SUPER_ADMIN and active -- no change")
  }

  if (!user.emailVerified) {
    console.log("  - Mark email as verified")
    hasChanges = true
  } else {
    console.log("  - Email: already verified -- no change")
  }

  if (!user.subscription || user.subscription.plan.slug !== "owner-unlimited" || user.subscription.status !== "ACTIVE") {
    console.log(`  - ${user.subscription ? "Change from " + user.subscription.plan.slug : "Create"} owner-unlimited subscription (ACTIVE, no expiry)`)
    hasChanges = true
  } else {
    console.log("  - Subscription: already owner-unlimited ACTIVE -- no change")
  }

  if (!hasChanges) {
    console.log("\nNo changes needed. User is already configured as primary owner.")
    return
  }

  if (dryRun) {
    console.log("\nDry run complete. No changes made.")
    console.log(`  To execute: npx tsx scripts/assign-primary-owner.ts --email ${email} --execute`)
    return
  }

  // Execute
  console.log("\nExecuting...\n")

  const admin = await prisma.internalAdmin.upsert({
    where: { userId: user.id },
    create: { userId: user.id, role: "SUPER_ADMIN", isActive: true },
    update: { role: "SUPER_ADMIN", isActive: true },
  })
  console.log(`  InternalAdmin: upserted (id: ${admin.id}, role: ${admin.role})`)

  await seedPlans()
  console.log("  Plans seeded (including owner-unlimited)")

  const sub = await assignOwnerUnlimitedPlan(user.id)
  console.log(`  Subscription: ${sub.plan.name} (${sub.plan.slug}) - status: ${sub.status}`)

  if (!user.emailVerified) {
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: new Date() },
    })
    console.log("  Email: marked as verified")
  }

  console.log(`\nDone. ${user.email} is now the primary owner.`)
  console.log(`  Plan: owner-unlimited (hidden, non-purchasable, unlimited circles)`)
  console.log(`  Role: SUPER_ADMIN`)
  console.log(`  AdminDashboard: accessible at /owner`)
  console.log(`\n  Note: existing sessions will reflect owner status on next login or token refresh.`)
  console.log("")
}

main().catch((err) => {
  console.error("Fatal error:", err)
  process.exit(1)
})
