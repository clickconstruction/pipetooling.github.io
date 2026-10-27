/**
 * The thread's line for a customer's rating, written (v2.5934, punch list #185). The words and the key are
 * `ratingEventLine.ts` (pure); this is the write: one `messages` row in the asked contact's own thread as the app's
 * event — `channel: 'event'`, `direction: 'team'`, `who_text: 'The app'` — keyed on `quo_id` with duplicates ignored,
 * the estimate line's shape. The rating already names its contact, so no thread is looked for. Best effort: it logs
 * and never throws, since the customer's answer must never wait on it.
 */
import { ratingEventLine, ratingJobWord, type RatingEventKind } from './ratingEventLine.ts'

// deno-lint-ignore no-explicit-any
type Admin = any

export interface RatingForLine {
  id: string
  contact_id: string | null
  job_id: string | null
  customer_name: string | null
  score: number | null
  words: string | null
}

/** The job as the line names it, read once; null for an ask tied to no job or a read that failed. */
export async function ratingJobWordFor(admin: Admin, jobId: string | null): Promise<string | null> {
  if (!jobId) return null
  try {
    const job = (await admin.from('jobs_ledger').select('job_name, hcp_number, click_number').eq('id', jobId).maybeSingle()).data as {
      job_name: string | null
      hcp_number: string | null
      click_number: string | null
    } | null
    return ratingJobWord(job)
  } catch {
    return null
  }
}

export async function writeRatingThreadLine(admin: Admin, rating: RatingForLine, kind: RatingEventKind, jobWord: string | null): Promise<void> {
  try {
    if (!rating.contact_id) return
    const line = ratingEventLine(kind, { ratingId: rating.id, customerName: rating.customer_name, jobWord, score: rating.score, words: rating.words })
    if (!line) return
    const { error } = await admin.from('messages').upsert(
      {
        contact_id: rating.contact_id,
        channel: 'event',
        direction: 'team',
        who_text: 'The app',
        body: line.body,
        jobs_ledger_id: rating.job_id,
        quo_id: line.key,
      },
      { onConflict: 'quo_id', ignoreDuplicates: true },
    )
    if (error) console.error('writeRatingThreadLine', JSON.stringify(error))
  } catch (e) {
    console.error('writeRatingThreadLine', e instanceof Error ? e.message : String(e))
  }
}
