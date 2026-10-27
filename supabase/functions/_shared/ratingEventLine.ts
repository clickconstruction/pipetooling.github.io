/**
 * The thread's line for a customer's rating (v2.5934, punch list #185): the score they tapped on /rate, a changed
 * score, the words they added, what they said we could have done better, and the Google press. `ratingThreadLine.ts`
 * writes the line this names into the asked contact's own thread as one of the app's events, keyed so a repeat never
 * writes twice: one line per rating per kind, and one per score a change lands on, so a customer tapping around writes
 * at most five.
 *
 * Deno-free on purpose: `src/lib/ratingEventLine.test.ts` imports this file directly (the `estimateEventLine.ts`
 * pattern).
 */

export type RatingEventKind = 'answered' | 'changed' | 'words' | 'google'

export interface RatingEventLine {
  /** The words, with the app's own mark first: "⭐ Dana left 5 stars on job 1312." */
  body: string
  /** The `messages.quo_id` key. */
  key: string
}

export interface RatingEventInput {
  ratingId: string
  customerName: string | null
  /** The job as the thread names it: "job 1312", "the water heater"; null for an ask tied to no job. */
  jobWord: string | null
  score?: number | null
  words?: string | null
}

/** A score at or above this is a good one: the star mark. Below, the warning mark, so the office reads it as a call. */
export const RATING_GOOD_SCORE = 4

const first = (name: string | null | undefined) => name?.trim().split(/\s+/)[0] || 'The customer'

/** Their words as the line quotes them: collapsed to one line and cut at 280 characters. */
export function ratingQuote(text: string | null | undefined): string | null {
  const one = (text ?? '').replace(/\s+/g, ' ').trim()
  if (!one) return null
  return one.length > 280 ? `${one.slice(0, 279).trimEnd()}…` : one
}

/** The job as the thread names it: its number when it has one, else its name, else null. */
export function ratingJobWord(job: { click_number?: string | null; hcp_number?: string | null; job_name?: string | null } | null | undefined): string | null {
  const number = (job?.click_number ?? job?.hcp_number ?? '').trim()
  if (number) return `job ${number}`
  const name = (job?.job_name ?? '').trim()
  return name || null
}

const stars = (n: number) => `${n} ${n === 1 ? 'star' : 'stars'}`

/** The line for an event, or null for one the thread does not draw (no score, no words). */
export function ratingEventLine(kind: RatingEventKind, input: RatingEventInput): RatingEventLine | null {
  const who = first(input.customerName)
  const on = input.jobWord ? ` on ${input.jobWord}` : ''
  const score = input.score ?? 0
  const mark = score >= RATING_GOOD_SCORE ? '⭐' : '⚠'
  if (kind === 'answered') {
    if (score < 1) return null
    return { body: `${mark} ${who} left ${stars(score)}${on}.`, key: `rating:${input.ratingId}:answered` }
  }
  if (kind === 'changed') {
    if (score < 1) return null
    return { body: `${mark} ${who} changed the answer to ${stars(score)}${on}.`, key: `rating:${input.ratingId}:score:${score}` }
  }
  if (kind === 'words') {
    const quote = ratingQuote(input.words)
    if (!quote) return null
    if (score >= 5) return { body: `⭐ ${who} wrote${on}: “${quote}”`, key: `rating:${input.ratingId}:words` }
    return { body: `${mark} What ${who} says we could have done better${on}: “${quote}”`, key: `rating:${input.ratingId}:words` }
  }
  return { body: `⭐ ${who} pressed Post it on Google.`, key: `rating:${input.ratingId}:google` }
}
