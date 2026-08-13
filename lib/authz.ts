import "server-only"
import { db } from "@/lib/db"
import { contest, contestAssignment, user as userTable } from "@/lib/db/schema"
import { requireAdmin } from "@/lib/get-session"
import { and, eq, or } from "drizzle-orm"
import { redirect } from "next/navigation"

// The single master admin. Kept as a hard fallback so the master can never be
// locked out even if the DB `role` column somehow isn't set.
export const MASTER_EMAIL = "mohamadhifzhan@gmail.com"

export type AdminUser = {
  id: string
  email: string
  name: string
  role: string
}

/**
 * Resolve the signed-in admin together with their role. Better Auth's session
 * user may not carry custom columns, so we read the authoritative `role` from
 * the DB. Redirects to /sign-in when not authenticated.
 */
export async function getCurrentAdmin(): Promise<AdminUser> {
  const sessionUser = await requireAdmin()
  const row = (
    await db
      .select({ id: userTable.id, email: userTable.email, name: userTable.name, role: userTable.role })
      .from(userTable)
      .where(eq(userTable.id, sessionUser.id))
      .limit(1)
  )[0]
  const email = row?.email ?? sessionUser.email ?? ""
  // Email fallback guarantees the master keeps full access.
  const role = row?.role ?? "admin"
  const effectiveRole = email.toLowerCase() === MASTER_EMAIL.toLowerCase() ? "master" : role
  return {
    id: row?.id ?? sessionUser.id,
    email,
    name: row?.name ?? sessionUser.name ?? email,
    role: effectiveRole,
  }
}

export function isMaster(u: { email?: string | null; role?: string | null } | null | undefined): boolean {
  if (!u) return false
  return u.role === "master" || (u.email ?? "").toLowerCase() === MASTER_EMAIL.toLowerCase()
}

/** Require a signed-in master; sub-admins are redirected back to /admin. */
export async function requireMaster(): Promise<AdminUser> {
  const u = await getCurrentAdmin()
  if (!isMaster(u)) redirect("/admin")
  return u
}

/**
 * Contest ids the given admin may manage. Master → all. Sub-admin → contests
 * they own ∪ contests assigned to them. Returns null to mean "all contests"
 * (master), so callers can skip filtering entirely.
 */
export async function getAccessibleContestIds(u: AdminUser): Promise<number[] | null> {
  if (isMaster(u)) return null
  const owned = await db.select({ id: contest.id }).from(contest).where(eq(contest.ownerId, u.id))
  const assigned = await db
    .select({ id: contestAssignment.contestId })
    .from(contestAssignment)
    .where(eq(contestAssignment.userId, u.id))
  const ids = new Set<number>()
  for (const r of owned) ids.add(r.id)
  for (const r of assigned) ids.add(r.id)
  return Array.from(ids)
}

/** Whether a specific admin can manage a specific contest. */
export async function canManageContest(u: AdminUser, contestId: number): Promise<boolean> {
  if (isMaster(u)) return true
  const rows = await db
    .select({ id: contest.id })
    .from(contest)
    .leftJoin(
      contestAssignment,
      and(eq(contestAssignment.contestId, contest.id), eq(contestAssignment.userId, u.id)),
    )
    .where(and(eq(contest.id, contestId), or(eq(contest.ownerId, u.id), eq(contestAssignment.userId, u.id))))
    .limit(1)
  return rows.length > 0
}

/**
 * Guard for contest-scoped server actions. Resolves the current admin, then
 * throws if they cannot manage `contestId`. Returns the admin for convenience.
 */
export async function assertCanManageContest(contestId: number): Promise<AdminUser> {
  const u = await getCurrentAdmin()
  if (!(await canManageContest(u, contestId))) {
    throw new Error("You do not have access to this contest")
  }
  return u
}

/** Convenience: does this admin have access to ANY of these contest ids. */
export async function filterAccessibleContestIds(u: AdminUser, ids: number[]): Promise<number[]> {
  if (isMaster(u)) return ids
  const accessible = await getAccessibleContestIds(u)
  if (!accessible) return ids
  const set = new Set(accessible)
  return ids.filter((id) => set.has(id))
}
