/**
 * Bills and estimates in a message, PR 3 (punch list #127, the owner's pick B): a link to an estimate for a message.
 * `share_estimate_link` makes a second link for a sent or approved estimate and returns its token once; the row keeps
 * only its hash, as the emailed link's is kept, so the link in the customer's email keeps working. The link is the live
 * app's accept page (`APP_ORIGIN`), as a bill's pay page is, whichever page the office writes from.
 *
 * The function is not in the generated types until its types PR, so the client calls it untyped, as the quick replies'
 * io does.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { APP_ORIGIN } from '../appOrigin'
import { supabase } from '../supabase'
import { checkSupabaseError } from '../../utils/errorHandling'

export interface EstimateLinkIo {
  /** A new link to the estimate for a message: the accept page's URL with its own token. */
  share(estimateId: string): Promise<string>
}

/** The accept page for a token: `https://clicktooling.com/estimate/accept?t=…`. */
export function estimateAcceptUrl(token: string, origin: string = APP_ORIGIN): string {
  return `${origin.replace(/\/$/, '')}/estimate/accept?t=${encodeURIComponent(token)}`
}

/** The note under the box once a link is made: the customer's emailed link is untouched. */
export function estimateLinkNote(number: string): string {
  return `A second link to estimate${number ? ` ${number}` : ''} was made for this message. The link in their email keeps working.`
}

export function supabaseEstimateLinkIo(client: unknown = supabase): EstimateLinkIo {
  const db = client as SupabaseClient
  return {
    async share(estimateId) {
      const result = await db.rpc('share_estimate_link', { p_estimate_id: estimateId })
      checkSupabaseError(result, 'make a link to the estimate')
      const token = typeof result.data === 'string' ? result.data.trim() : ''
      if (!token) throw new Error('The estimate’s link was not made.')
      return estimateAcceptUrl(token)
    },
  }
}
