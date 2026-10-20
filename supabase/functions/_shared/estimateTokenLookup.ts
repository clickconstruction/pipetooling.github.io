/**
 * The estimate a customer's link opens (punch list #127, the owner's pick B). A link is a random token whose SHA-256
 * is kept: the emailed one on the estimate's own row (`estimates.public_token_hash`), and since #127 each message's in
 * `estimate_share_links` (made by `share_estimate_link`), so a link sent by text never retires the emailed one. The
 * three functions that open an estimate from a link (get-estimate-for-customer, accept-estimate,
 * log-estimate-option-view) ask here which estimate a hash is, then read the estimate by its id.
 *
 * When the link stops working: a shared link's own day, else the row's (`public_token_expires_at`). A shared link
 * read before its table is on the database, or any read that fails, is no match, so an emailed link opens as it always
 * did.
 *
 * Deno-free on purpose: `src/lib/estimateTokenLookup.test.ts` imports this file directly, as
 * `estimateLinkResend.test.ts` does its own.
 */

/** Which estimate a link's hash opens, and the shared link's own end when it is one. */
export interface EstimateLinkRef {
  estimateId: string
  /** The shared link's day to stop; null for the emailed link, whose day is the row's. */
  shareExpiresAt: string | null
}

/** The little of a Supabase client the lookup uses, so a test hands a fake. */
export interface EstimateLookupClient {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): { maybeSingle(): PromiseLike<{ data: unknown; error: unknown }> }
    }
  }
}

/** The estimate a link's hash opens: the emailed link's first, else a shared one's. Null when neither is. */
export async function estimateRefForTokenHash(admin: EstimateLookupClient, tokenHash: string): Promise<EstimateLinkRef | null> {
  const own = await admin.from('estimates').select('id').eq('public_token_hash', tokenHash).maybeSingle()
  const ownRow = own.error ? null : (own.data as { id?: string } | null)
  if (ownRow?.id) return { estimateId: String(ownRow.id), shareExpiresAt: null }
  const share = await admin.from('estimate_share_links').select('estimate_id, expires_at').eq('token_hash', tokenHash).maybeSingle()
  const shareRow = share.error ? null : (share.data as { estimate_id?: string; expires_at?: string | null } | null)
  if (shareRow?.estimate_id) return { estimateId: String(shareRow.estimate_id), shareExpiresAt: shareRow.expires_at ?? null }
  return null
}

/** The day the link stops working: a shared link's own, else the estimate row's. */
export function linkExpiresAt(ref: EstimateLinkRef, rowExpiresAt: string | null | undefined): string | null {
  return ref.shareExpiresAt ?? rowExpiresAt ?? null
}

/** Whether the link has stopped working at `now`. A day that does not read is no end, as the functions read it. */
export function linkHasExpired(ref: EstimateLinkRef, rowExpiresAt: string | null | undefined, now: number): boolean {
  const at = linkExpiresAt(ref, rowExpiresAt)
  const exp = at ? Date.parse(String(at)) : NaN
  return !Number.isNaN(exp) && exp < now
}
