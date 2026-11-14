/**
 * Materials on site, the Deliveries panel's words (v2.7250, punch list #344 PR 8): what the panel says after a
 * delivery's one press is answered, what it asks before the same invoice lands twice, and the heads over the lines
 * the reader could not read and the lines that print one figure. Pure, so the sentences are held by tests.
 */
import { countedLabel, pluralNoun } from '../batchWords'

const LINES = ['line', 'lines'] as const

/** The head over the pasted lines that hold a number and a word and did not read. */
export function notReadHead(n: number): string {
  return n === 1 ? '1 line was not read. Add it as a line, or leave it out.' : `${n} lines were not read. Add each as a line, or leave it out.`
}

/** One figure on a line of more than one piece: the reader takes it for neither a unit price nor a total, and the office says. */
export const LONE_FIGURE_WORDS = {
  ask: 'Some lines print one figure. What is it?',
  each: 'The price of each',
  total: 'The line’s total',
  unsaid: 'Until you say, those lines land with no price.',
  title: 'One figure on a line of more than one piece. Say whether it is the price of each or the line’s total.',
} as const

/**
 * The one sentence after a delivery's press is answered. Landed and kept each say so. A refusal returns null: the
 * store has said it with the office's reason, and the lines stay on the screen to send again.
 */
export function deliveryOutcomeWords(kind: 'landed' | 'queued' | 'refused' | 'failed', n: number, source: string): { line: string; tone: 'success' | 'info' } | null {
  const what = `${n} ${pluralNoun(LINES, n)} from ${source}`
  if (kind === 'landed') return { line: `${what} landed in Unsorted as a delivery.`, tone: 'success' }
  if (kind === 'queued') return { line: `${what} ${n === 1 ? 'is' : 'are'} kept on this device. ${n === 1 ? 'It sends by itself' : 'They send by themselves'} when the signal is back.`, tone: 'info' }
  return null
}

/** Before the same invoice lands twice: the note over the button, and the window that asks. Its button names the act. */
export function deliveryAgainWords(source: string, landed: number, n: number): { note: string; message: string; confirmLabel: string } {
  const note = `${source} already landed ${landed} ${pluralNoun(LINES, landed)} on this job.`
  return {
    note,
    message: `${note} Adding ${n === 1 ? 'this line' : `these ${n} lines`} again adds to what the job is said to hold. A count would then read the extra as walked away.`,
    confirmLabel: `${countedLabel('Add', n, LINES)} again`,
  }
}
