/**
 * The customer's own word (v2.5876, measuring follow-ups item 6): the /rate?t= page's words and rules.
 * Pure; the page is `src/pages/CustomerRating.tsx`, the reads and the save the `job-rating` function
 * (service role, by the ask's `public_token`), the ask's mint `mint_customer_rating` through the
 * `{rate}` fill in the reply box (the next PR). One tap saves the score; the words are optional after.
 */

/** The five scores, 1 to 5, left to right. */
export const SCORE_LABELS = ['Bad', 'Poor', 'Okay', 'Good', 'Great'] as const

export const WORDS_MAX = 1000

/** A token as the link carries it: the row's default is two uuids' hex, but any of ours passes. */
export function tokenOk(t: string | null | undefined): t is string {
  return typeof t === 'string' && /^[0-9a-f-]{32,80}$/i.test(t)
}

export function scoreOk(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 5
}

/** What the function answers a GET with. */
export interface RatingState {
  name: string
  score: number | null
  words: string
  answered: boolean
}

export function parseRatingState(json: unknown): RatingState | null {
  const o = (json && typeof json === 'object' ? json : null) as Record<string, unknown> | null
  if (!o || o.ok !== true) return null
  return {
    name: typeof o.name === 'string' ? o.name : '',
    score: scoreOk(o.score) ? o.score : null,
    words: typeof o.words === 'string' ? o.words : '',
    answered: o.answered === true,
  }
}

export const RATE_WORDS = {
  title: (name: string) => (name ? `${name}, how did we do?` : 'How did we do?'),
  sub: 'One tap answers it.',
  thanks: 'Thank you. Your answer is saved.',
  thanksLow: 'Thank you for the honest answer. We will do better.',
  wordsLabel: 'Anything we should know? (optional)',
  send: 'Send the words',
  sent: 'Sent. Thank you.',
  change: 'Tap a different face any time to change your answer.',
  badLink: 'This link is incomplete or has expired. Reply to our text and we will send a fresh one.',
  problem: 'Your answer could not be saved. Check your connection and tap again.',
}

/** The thanks line for a saved score: a 1 or a 2 answers with the honest version. */
export function thanksFor(score: number): string {
  return score <= 2 ? RATE_WORDS.thanksLow : RATE_WORDS.thanks
}
