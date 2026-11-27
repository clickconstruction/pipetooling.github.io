/**
 * The Team queue's line on a charge the office texted again (punch list #299, v2.8728). The line already says when
 * the charge was texted and reminded (`receiptLineWords`, the kernel the `receipt-request` function shares). Since
 * v2.8697 the office can press **Text again** on a charge texted twice with no receipt, and the line did not say so:
 * a second person in the office read *Reminded Tue 6:14 PM. No receipt yet.* and could not tell a third text had
 * gone. This adds the one sentence, in the words the Needs you row uses.
 *
 * It lives beside the shared kernel, not in it, so the function's own files do not change and nothing is redeployed.
 * Pure.
 */
import { RECEIPT_COMPANY_TZ, receiptLineWords, type ReceiptLine, type ReceiptRequestState } from './receiptText'

/** A request as the line reads it, with the office's Text again presses (the migration of v2.8697). */
export type ReceiptRequestAgainState = ReceiptRequestState & {
  /** When the office last pressed Text again. */
  again_at?: string | null
  /** How many times the office has pressed Text again. */
  again_count?: number | null
}

const TIMES = ['', 'once', 'twice', 'three times', 'four times', 'five times']
const NO_RECEIPT = 'No receipt yet.'

function fmt(ms: number, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: RECEIPT_COMPANY_TZ, ...options }).format(new Date(ms))
}

/** *9:02 AM* for today on the company's clock, *Wed 9:02 AM* for another day, as the line's other times read. */
function clock(iso: string | null | undefined, nowMs: number): string | null {
  const ms = iso ? Date.parse(iso) : NaN
  if (!Number.isFinite(ms)) return null
  const time = fmt(ms, { hour: 'numeric', minute: '2-digit' })
  const day = (at: number) => fmt(at, { year: 'numeric', month: '2-digit', day: '2-digit' })
  return day(ms) === day(nowMs) ? time : `${fmt(ms, { weekday: 'short' })} ${time}`
}

/**
 * The sentence for the office's Text again presses, or null when it has pressed none:
 *
 *   The office texted again Wed 9:02 AM.
 *   The office texted again twice, last Thu 9:40 PM.
 */
export function receiptTextedAgainWords(r: Pick<ReceiptRequestAgainState, 'again_at' | 'again_count'>, nowMs: number): string | null {
  const n = r.again_count
  const count = typeof n === 'number' && Number.isInteger(n) && n > 0 ? n : 0
  if (count === 0) return null
  const when = clock(r.again_at, nowMs)
  const times = TIMES[count] ?? `${count} times`
  if (!when) return `The office texted again ${times}.`
  return count === 1 ? `The office texted again ${when}.` : `The office texted again ${times}, last ${when}.`
}

/**
 * The charge's line with the office's Text again on it. Every line but a waiting one is the shared kernel's own: a
 * charge that could not be texted was never texted again.
 *
 *   Reminded Tue 6:14 PM. The office texted again Wed 9:02 AM. No receipt yet.
 */
export function receiptLineWithAgain(r: ReceiptRequestAgainState, nowMs: number): ReceiptLine | null {
  const line = receiptLineWords(r, nowMs)
  if (!line || line.tone !== 'waiting') return line
  const again = receiptTextedAgainWords(r, nowMs)
  if (!again) return line
  const words = line.words.endsWith(NO_RECEIPT) ? `${line.words.slice(0, -NO_RECEIPT.length)}${again} ${NO_RECEIPT}` : `${line.words} ${again}`
  return { ...line, words }
}
