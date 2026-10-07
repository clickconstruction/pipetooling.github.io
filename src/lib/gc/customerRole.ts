/**
 * GC mode, the real build, PR 1b: who we work for, moved from the GC mode prototype (branch
 * spike/gc-mode, `GcNewProject.tsx`; the owner, 2026-10-04: "Sometimes we are working for the owner,
 * sometimes we are working for another GC or an owner's rep who then works and bills the owner").
 * The words for each role; the screen keeps its own rule for which customers come first.
 */
import type { CustomerRole } from './types'

/** Who we work for, in the window's words. */
export const CUSTOMER_ROLES: { role: CustomerRole; label: string; customer: string; them: string }[] = [
  { role: 'owner', label: 'The owner', customer: 'The owner we build it for', them: 'the owner' },
  { role: 'gc', label: 'Another general contractor', customer: 'The general contractor we work for', them: 'the general contractor' },
  { role: 'ownersRep', label: "An owner's rep", customer: "The owner's rep we work for", them: "the owner's rep" },
]

/** The words for a role; a role the list does not know reads as the owner. */
export function customerRoleWords(role: CustomerRole | undefined): (typeof CUSTOMER_ROLES)[number] {
  return CUSTOMER_ROLES.find((r) => r.role === role) ?? (CUSTOMER_ROLES[0] as (typeof CUSTOMER_ROLES)[number])
}
