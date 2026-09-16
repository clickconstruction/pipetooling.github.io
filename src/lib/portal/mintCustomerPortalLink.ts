/**
 * Mint (or rotate) a customer's portal link through `mint_customer_portal_link`.
 *
 * One code path for every door that creates a link — the customer globe modal
 * and, since v2.3517, the Stage Plan drawer's *Create their link* — so the
 * audience default, the error shape and the "no token" case cannot drift apart.
 * Resolves the token; throws on an RPC error or a refusal carried in the payload.
 */
import { supabase } from '../supabase'
import type { MintCustomerPortalLinkResult } from '../../types/database-functions'

export type PortalLinkAudience = 'customer' | 'gc' | 'all'

export async function mintCustomerPortalLink(
  customerId: string,
  audience: PortalLinkAudience = 'all',
  rotate = false,
): Promise<string | null> {
  const { data, error } = await supabase.rpc('mint_customer_portal_link', {
    p_customer_id: customerId,
    p_audience: audience,
    p_rotate: rotate,
  })
  if (error) throw error
  const res = (data ?? {}) as MintCustomerPortalLinkResult
  if (res.error) throw new Error(res.error)
  return res.token ?? null
}
