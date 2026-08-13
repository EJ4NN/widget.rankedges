"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { contest, contestAssignment, user } from "@/lib/db/schema"
import { requireMaster, MASTER_EMAIL } from "@/lib/authz"
import { asc, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export async function listAdminUsers() {
  await requireMaster()
  return db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    })
    .from(user)
    .orderBy(asc(user.createdAt))
}

/**
 * Create a new admin account. Public sign-up is disabled, so this is the only
 * way to add users — and it is gated behind requireAdmin(). We create the user
 * and its credential account directly via Better Auth's internal adapter so it
 * works even with emailAndPassword.disableSignUp = true.
 */
export async function createAdminUser(formData: FormData) {
  await requireMaster()

  const name = String(formData.get("name") || "").trim()
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase()
  const password = String(formData.get("password") || "")

  if (!name || !email || !password) {
    return { ok: false as const, error: "Name, email and password are required" }
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false as const, error: "Enter a valid email address" }
  }
  if (password.length < 8) {
    return { ok: false as const, error: "Password must be at least 8 characters" }
  }

  const existing = await db.select({ id: user.id }).from(user).where(eq(user.email, email)).limit(1)
  if (existing.length) {
    return { ok: false as const, error: "An account with this email already exists" }
  }

  const ctx = await auth.$context
  const hash = await ctx.password.hash(password)
  const created = await ctx.internalAdapter.createUser({
    email,
    name,
    emailVerified: true,
  })
  if (!created) {
    return { ok: false as const, error: "Failed to create user" }
  }
  await ctx.internalAdapter.linkAccount({
    userId: created.id,
    providerId: "credential",
    accountId: created.id,
    password: hash,
  })

  revalidatePath("/admin")
  return { ok: true as const }
}

export async function deleteAdminUser(id: string) {
  const current = await requireMaster()

  if (current.id === id) {
    return { ok: false as const, error: "You cannot remove your own account" }
  }

  const target = (await db.select({ id: user.id, email: user.email }).from(user).where(eq(user.id, id)).limit(1))[0]
  if (!target) return { ok: false as const, error: "User not found" }
  if ((target.email ?? "").toLowerCase() === MASTER_EMAIL.toLowerCase()) {
    return { ok: false as const, error: "Cannot remove the master admin" }
  }

  const all = await db.select({ id: user.id }).from(user)
  if (all.length <= 1) {
    return { ok: false as const, error: "Cannot remove the last remaining admin" }
  }

  // Preserve the sub-admin's contests: transfer ownership to the master, then
  // drop their contest assignments before deleting the account.
  await db.update(contest).set({ ownerId: current.id }).where(eq(contest.ownerId, id))
  await db.delete(contestAssignment).where(eq(contestAssignment.userId, id))
  await db.delete(user).where(eq(user.id, id))
  revalidatePath("/admin")
  return { ok: true as const }
}
