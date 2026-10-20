/**
 * Messages, cut 8d: what the office's preview of a customer's page reads (`GcCustomerPortalWindow`). The customer's
 * live link that shows their GC jobs (`customer_portal_links`, audience `all` or `customer`; a `gc` link reads none),
 * and the portal's own answer for it as a staff look: `?preview=1` with the office's session, so no view is counted
 * and nothing is written. A link is made only when the office presses for one (`makePortalLink`).
 */
import { checkSupabaseError } from '../../utils/errorHandling'
import { staffAwarePublicHeaders } from '../publicFunctionStaffHeaders'
import { withPreviewFlag } from '../publicViewCounting'
import { supabase } from '../supabase'
import { mintCustomerPortalLink } from './mintCustomerPortalLink'
import { parsePortalPayload, type PortalPayload } from './portalPayload'

type LinkRow = { audience: string; token: string | null; revoked_at: string | null; created_at: string }

/** The newest live link that shows the customer's GC jobs, the full one first; null when they have none. */
export async function activePortalToken(customerId: string): Promise<string | null> {
  const res = await supabase
    .from('customer_portal_links')
    .select('audience, token, revoked_at, created_at')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
  checkSupabaseError(res, 'read their portal link')
  const live = ((res.data ?? []) as LinkRow[]).filter((r) => r.revoked_at === null && r.token)
  return (live.find((r) => r.audience === 'all') ?? live.find((r) => r.audience === 'customer'))?.token ?? null
}

/** Make the customer's link, as the globe's Create does. */
export async function makePortalLink(customerId: string): Promise<string | null> {
  return mintCustomerPortalLink(customerId, 'all')
}

/** The customer's page as their portal answers it, read as the office. */
export async function loadPortalPreview(token: string): Promise<PortalPayload> {
  const url = withPreviewFlag(`${import.meta.env.VITE_SUPABASE_URL as string}/functions/v1/customer-portal?token=${encodeURIComponent(token)}`)
  const res = await fetch(url, { headers: await staffAwarePublicHeaders() })
  const body: unknown = await res.json().catch(() => null)
  const payload = res.ok ? parsePortalPayload(body) : null
  if (!payload) throw new Error('Their portal did not open. Try again in a minute.')
  return payload
}
