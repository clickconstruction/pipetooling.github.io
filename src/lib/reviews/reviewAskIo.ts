/**
 * The review ask's reads and writes (v2.5896, punch list #185): the link, minted once by `customer_review_ask`. The
 * RPC refuses in words (a training account, a twin, a job with no customer, a job already answered), and the words
 * come back as the error's message.
 */
import { supabase } from '../supabase'
import { checkSupabaseError } from '../../utils/errorHandling'
import { reviewLinkUrl } from './reviewAsk'

type Client = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> }

/** The job's review link, fresh: a new token each time, so an older link dies. */
export async function mintReviewLink(jobId: string, client: Client = supabase as unknown as Client): Promise<string> {
  const { data, error } = await client.rpc('customer_review_ask', { p_job_id: jobId })
  checkSupabaseError(error, 'The review link could not be made.')
  if (typeof data !== 'string' || !data) throw new Error('The review link could not be made.')
  return reviewLinkUrl(data)
}
