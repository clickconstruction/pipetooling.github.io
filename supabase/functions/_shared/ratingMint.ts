/**
 * The review ask's link, minted by the morning run (v2.5943, punch list #185). The office's press mints through the RPC
 * `mint_customer_rating`, which needs a signed-in caller; the run writes as the service role, so it does the same work
 * here, by the RPC's own rule: a fresh unanswered ask to the same contact about the same job (30 days) is reused, so a
 * re-send never forks the asked count; otherwise a new `customer_ratings` row, whose default `public_token` the link
 * carries. A job whose rating was answered already is never asked again. The page is `/rate?t=…` on the public site.
 */

// deno-lint-ignore no-explicit-any
type Admin = any

export type RatingMint = { url: string; reused: boolean } | { refused: 'answered' | 'no job' | 'error'; detail?: string }

const REUSE_DAYS = 30

export const ratingUrl = (token: string, origin: string): string => `${origin.replace(/\/$/, '')}/rate?t=${encodeURIComponent(token)}`

/** Whether a line still waits on the rating's link. */
export const needsRatingLink = (body: string): boolean => body.includes('{rate}')

export async function mintRatingLink(admin: Admin, input: { contactId: string; jobId: string | null; name: string; origin: string }): Promise<RatingMint> {
  try {
    if (!input.jobId) return { refused: 'no job' }
    const answered = (await admin.from('customer_ratings').select('id').eq('job_id', input.jobId).not('answered_at', 'is', null).limit(1)).data as { id: string }[] | null
    if (answered?.length) return { refused: 'answered' }
    const since = new Date(Date.now() - REUSE_DAYS * 24 * 3600 * 1000).toISOString()
    const open = (
      await admin
        .from('customer_ratings')
        .select('public_token')
        .eq('contact_id', input.contactId)
        .eq('job_id', input.jobId)
        .is('answered_at', null)
        .gt('asked_at', since)
        .order('asked_at', { ascending: false })
        .limit(1)
    ).data as { public_token: string }[] | null
    if (open?.[0]?.public_token) return { url: ratingUrl(open[0].public_token, input.origin), reused: true }
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
