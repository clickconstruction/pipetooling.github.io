/**
 * The {rate} blank's link (v2.5877, measuring follow-ups item 6): a one-tap rating ask minted for a
 * message, as {estimate}'s link is (`estimateLinkIo.ts`). `mint_customer_rating` makes (or reuses) the
 * customer_ratings row and returns its token once; the page is `/rate?t=…` (v2.5876). The function is
 * not in the generated types until its types PR, so the client calls it untyped, as the quick replies'
 * io does.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { APP_ORIGIN } from '../appOrigin'
import { supabase } from '../supabase'
import { checkSupabaseError } from '../../utils/errorHandling'

export interface RatingLinkIo {
  /** A rating ask's link for a message: /rate with the ask's own token. */
  mint(contactId: string, jobId: string | null, name: string): Promise<string>
}

/** The rating page for a token: `https://clicktooling.com/rate?t=…`. */
export function ratingUrl(token: string, origin: string = APP_ORIGIN): string {
  return `${origin.replace(/\/$/, '')}/rate?t=${encodeURIComponent(token)}`
}

/** The send row's words while the link is being made: the line is in the box already, its blank waiting on the link. */
export const RATING_LINK_MAKING = 'Making the rating link…'

export function supabaseRatingLinkIo(client: unknown = supabase): RatingLinkIo {
  const db = client as SupabaseClient
  return {
    async mint(contactId, jobId, name) {
      const result = await db.rpc('mint_customer_rating', { p_contact_id: contactId, p_job_id: jobId, p_customer_name: name })
      checkSupabaseError(result, 'make the rating link')
      const data = (result.data ?? {}) as { ok?: boolean; token?: string; error?: string }
      if (data.error) throw new Error(data.error)
      const token = typeof data.token === 'string' ? data.token.trim() : ''
      if (!data.ok || !token) throw new Error('The rating link was not made.')
      return ratingUrl(token)
    },
  }
}
