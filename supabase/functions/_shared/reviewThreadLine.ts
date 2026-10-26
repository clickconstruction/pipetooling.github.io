/**
 * The thread's line for a customer's review, written (v2.5896, punch list #185). The words and the key are
 * `reviewEventLine.ts` (pure); this is the read and the write: the review's customer and job, the customer's own
 * thread (`findPageContact`, never made here), and one `messages` row as the app's event — `channel: 'event'`,
 * `direction: 'team'`, `who_text: 'The app'` — keyed on `quo_id` with duplicates ignored, the estimate line's shape.
 * Best effort: it logs and never throws, since the customer's answer must never wait on it.
 */
import { reviewEventLine, reviewJobWord, type ReviewEventKind } from './reviewEventLine.ts'
import { findPageContact } from './gcPortalThread.ts'

// deno-lint-ignore no-explicit-any
type Admin = any

export async function writeReviewThreadLine(admin: Admin, input: { reviewId: string; kind: ReviewEventKind }): Promise<void> {
  try {
    const row = (
      await admin
        .from('customer_reviews')
        .select('id, job_id, customer_id, stars, words, better, jobs_ledger(job_name, hcp_number, click_number), customers(name)')
        .eq('id', input.reviewId)
        .maybeSingle()
    ).data as {
      id: string
      job_id: string
      customer_id: string | null
      stars: number | null
      words: string | null
      better: string | null
      jobs_ledger: { job_name: string | null; hcp_number: string | null; click_number: string | null } | null
      customers: { name: string | null } | null
    } | null
    if (!row?.customer_id) return
    const line = reviewEventLine(input.kind, {
      reviewId: row.id,
      customerName: row.customers?.name ?? null,
      jobWord: reviewJobWord(row.jobs_ledger),
      stars: row.stars,
      words: row.words,
      better: row.better,
    })
    if (!line) return
    const contactId = await findPageContact(admin, row.customer_id)
    if (!contactId) return
    const { error } = await admin.from('messages').upsert(
      {
        contact_id: contactId,
        channel: 'event',
        direction: 'team',
        who_text: 'The app',
        body: line.body,
        jobs_ledger_id: row.job_id,
        quo_id: line.key,
      },
      { onConflict: 'quo_id', ignoreDuplicates: true },
    )
    if (error) console.error('writeReviewThreadLine', JSON.stringify(error))
  } catch (e) {
    console.error('writeReviewThreadLine', e instanceof Error ? e.message : String(e))
  }
}
