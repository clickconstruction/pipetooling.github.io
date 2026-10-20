/** The read behind the paid claims (v2.5650): `list_paid_claims`, the live claims the caller may read. A read that fails, or one before the push, gives none. */
import { supabase } from '../supabase'
import { parsePaidClaimsRpc, type PaidClaim } from './paidClaims'

export async function loadPaidClaims(client: unknown = supabase): Promise<PaidClaim[]> {
  try {
    const db = client as typeof supabase
    const res = await db.rpc('list_paid_claims' as never)
    if (res.error) return []
    return parsePaidClaimsRpc(res.data as unknown) ?? []
  } catch {
    return []
  }
}
