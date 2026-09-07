import { supabase } from './supabase'
import { resolveCompanyOwnerUserId } from './companyOwner'
import type { UserRole } from '../hooks/useAuth'

/**
 * The account an estimate (or change order) is stamped with: the company owner
 * account (one company, v2.2972) — no longer the creator or an adopting master.
 * Signature kept for the three callers (Estimates, the Bids → Estimates change-order
 * bridge, the Quick Estimate wizard); the role no longer changes the answer.
 */
export async function resolveEstimateMasterUserId(
  userId: string,
  _role: UserRole | null,
): Promise<string | null> {
  return resolveCompanyOwnerUserId(supabase, userId)
}
