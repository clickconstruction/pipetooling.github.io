import { staffAwarePublicHeaders } from '../publicFunctionStaffHeaders'
import { isLegalPortalSlugKey } from './legalPortalAddress'

/**
 * Is this short-domain slug the law firm's key? (v2.4750) The customer page asks before it
 * falls through to the sub portal: `legal-portal?token=<slug>&probe=1` answers 200 for a live
 * firm key, with no payload and no view row. Anything else — a dead key, a customer's or a
 * sub's slug, a network slip — is false, and the page goes on to the sub portal as before.
 */
export async function probeLegalPortalKey(slug: string): Promise<boolean> {
  if (!isLegalPortalSlugKey(slug)) return false
  try {
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL as string}/functions/v1/legal-portal?token=${encodeURIComponent(slug)}&probe=1`, { headers: await staffAwarePublicHeaders() })
    if (!res.ok) return false
    const body = (await res.json().catch(() => null)) as { ok?: boolean } | null
    return body?.ok === true
  } catch {
    return false
  }
}
