/**
 * The thread's line for a customer's review (v2.5896, punch list #185): the stars and the words they left on the
 * review page, what they said we could have done better, and the Google press. `reviewThreadLine.ts` writes the line
 * this names into the customer's own thread as one of the app's events, keyed so a repeat never writes twice.
 *
 * Deno-free on purpose: `src/lib/reviewEventLine.test.ts` imports this file directly (the `estimateEventLine.ts`
 * pattern).
 */

export type ReviewEventKind = 'answered' | 'better' | 'google'

export interface ReviewEventLine {
  /** The words, with the app's own mark first: "⭐ Dana left 5 stars on job 1312: “…”". */
  body: string
  /** The `messages.quo_id` key: one line per review per kind. */
  key: string
}

export interface ReviewEventInput {
  reviewId: string
  customerName: string | null
  /** The job as the thread names it: "job 1312", "the water heater". */
  jobWord: string
  stars?: number | null
  words?: string | null
  better?: string | null
}

/** Stars at or above this are a good review; below, the line carries the warning mark so the office calls. */
export const REVIEW_GOOD_STARS = 4

const first = (name: string | null | undefined) => name?.trim().split(/\s+/)[0] || 'The customer'

/** Their words as the line quotes them: collapsed to one line and cut at 280 characters. */
export function reviewQuote(text: string | null | undefined): string | null {
  const one = (text ?? '').replace(/\s+/g, ' ').trim()
  if (!one) return null
  return one.length > 280 ? `${one.slice(0, 279).trimEnd()}…` : one
}

/** The job as the thread names it: its number when it has one, else its name, else "the job". */
export function reviewJobWord(job: { click_number?: string | null; hcp_number?: string | null; job_name?: string | null } | null | undefined): string {
  const number = (job?.click_number ?? job?.hcp_number ?? '').trim()
  if (number) return `job ${number}`
  const name = (job?.job_name ?? '').trim()
  return name || 'the job'
}

/** The line for an event, or null for one the thread does not draw (an answer with no stars, a better with no words). */
export function reviewEventLine(kind: ReviewEventKind, input: ReviewEventInput): ReviewEventLine | null {
  const who = first(input.customerName)
  if (kind === 'answered') {
    const stars = input.stars ?? 0
    if (stars < 1) return null
    const mark = stars >= REVIEW_GOOD_STARS ? '⭐' : '⚠'
    const quote = reviewQuote(input.words)
    const tail = quote ? `: “${quote}”` : '.'
    return { body: `${mark} ${who} left ${stars} ${stars === 1 ? 'star' : 'stars'} on ${input.jobWord}${tail}`, key: `review:${input.reviewId}:answered` }
  }
  if (kind === 'better') {
    const quote = reviewQuote(input.better)
    if (!quote) return null
    return { body: `⚠ What ${who} says we could have done better on ${input.jobWord}: “${quote}”`, key: `review:${input.reviewId}:better` }
  }
  return { body: `⭐ ${who} pressed Post it on Google.`, key: `review:${input.reviewId}:google` }
}
