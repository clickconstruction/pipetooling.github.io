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
import { ratingUrl as ratingUrlAt, type RatingAnswer } from './ratingAsk'

export type { RatingAnswer } from './ratingAsk'

export interface RatingLinkIo {
  /** A rating ask's link for a message: /rate with the ask's own token. */
  mint(contactId: string, jobId: string | null, name: string): Promise<string>
  /** The asks on these Pipeline jobs, answered or not, so a door keeps an answered job back (v2.6007, `ratingAsk.ts`). */
  asksOn(jobIds: readonly string[]): Promise<RatingAnswer[]>
}

/** The rating page for a token: `https://clicktooling.com/rate?t=…` (`ratingAsk.ts`'s, at the app's origin). */
export function ratingUrl(token: string, origin: string = APP_ORIGIN): string {
  return ratingUrlAt(token, origin)
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
    async asksOn(jobIds) {
      if (!jobIds.length) return []
      const result = await db.from('customer_ratings').select('job_id, answered_at').in('job_id', [...jobIds])
      checkSupabaseError(result, 'read the review asks')
      return (result.data ?? []) as RatingAnswer[]
    },
  }
}
