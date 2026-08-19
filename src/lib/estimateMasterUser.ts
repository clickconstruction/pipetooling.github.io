import { supabase } from './supabase'
import { isAssistantLike } from './subcontractorLikeRole'
import type { UserRole } from '../hooks/useAuth'

/**
 * The master account an estimate (or change order) belongs to: masters/devs
 * own their rows; assistant-likes attribute to their first adopting master.
 * Extracted from Estimates.tsx (CO train v2.1835) so the Bids → Estimates
 * change-order bridge resolves ownership the same way as New estimate.
 */
export async function resolveEstimateMasterUserId(
  userId: string,
  role: UserRole | null,
): Promise<string | null> {
  if (role === 'dev' || role === 'master_technician') return userId
  if (isAssistantLike(role)) {
    const { data } = await supabase
      .from('master_assistants')
      .select('master_id')
      .eq('assistant_id', userId)
      .limit(1)
      .maybeSingle()
    const mid = (data as { master_id: string } | null)?.master_id
    return mid ?? userId
  }
  return userId
}
