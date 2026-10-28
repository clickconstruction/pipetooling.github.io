/**
 * The review ask's link, minted by the morning run (v2.5943, punch list #185). The office's press mints through the RPC
 * `mint_customer_rating`, which needs a signed-in caller; the run writes as the service role, so it does the same work
 * here, by the one rule every door keeps since v2.6007 (`ratings/ratingAsk.ts` in the kernel copy): a job whose rating
 * was answered is never asked again; a fresh unanswered ask to the same contact about the same job (30 days) is reused,
 * so a re-send never forks the asked count; otherwise a new `customer_ratings` row, whose default `public_token` the
 * link carries. The page is `/rate?t=…` on the public site.
 */
import { answeredAlready, decideRatingAsk, needsRatingLink, ratingUrl, type RatingAskRow } from './gcKernels/lib/ratings/ratingAsk.ts'

export { needsRatingLink, ratingUrl }

// deno-lint-ignore no-explicit-any
type Admin = any

export type RatingMint = { url: string; reused: boolean } | { refused: 'answered' | 'no job' | 'error'; detail?: string }

const ASK_COLUMNS = 'contact_id, job_id, answered_at, asked_at, public_token'

/** Every ask on one job, as the rule reads them. */
export async function readRatingAsks(admin: Admin, jobId: string): Promise<RatingAskRow[]> {
  const { data, error } = await admin.from('customer_ratings').select(ASK_COLUMNS).eq('job_id', jobId)
  if (error) throw new Error(`customer_ratings: ${error.message}`)
  return (data ?? []) as RatingAskRow[]
}

/**
 * Whether the job's rating was answered already, so the run keeps its offer back (v2.6007). A read that fails answers
 * no: the offer is prepared, and the press on Today's sends asks again before it mints (`offersIo.ts`).
 */
export async function ratingAnswered(admin: Admin, jobId: string): Promise<boolean> {
  try {
    return answeredAlready(await readRatingAsks(admin, jobId), jobId)
  } catch {
    return false
  }
}

export async function mintRatingLink(admin: Admin, input: { contactId: string; jobId: string | null; name: string; origin: string }): Promise<RatingMint> {
  try {
    if (!input.jobId) return { refused: 'no job' }
    const decision = decideRatingAsk(await readRatingAsks(admin, input.jobId), { contactId: input.contactId, jobId: input.jobId, now: new Date() })
    if ('refused' in decision) return { refused: decision.refused }
    if ('reuse' in decision) return { url: ratingUrl(decision.reuse, input.origin), reused: true }
    const { data, error } = await admin
      .from('customer_ratings')
      .insert({ contact_id: input.contactId, job_id: input.jobId, customer_name: input.name.slice(0, 200), asked_by: null })
      .select('public_token')
      .maybeSingle()
    if (error || !data?.public_token) return { refused: 'error', detail: error?.message ?? 'no token came back' }
    return { url: ratingUrl(data.public_token, input.origin), reused: false }
  } catch (e) {
    return { refused: 'error', detail: e instanceof Error ? e.message : String(e) }
  }
}
