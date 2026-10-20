/**
 * Messages R3: the phone's lines, the presses a tech gets on Job Mode under **Message the customer**
 * (`to-dos/gc-mode/messages/RESIDENTIAL_BUILD_PLAN.md` → R3). Lifted from the residential prototype v0.8 on branch
 * spike/gc-mode (`to-dos/gc-mode/messages/customer-messages-prototype.html`: `phoneLines`, `shortTitle`, `hintFor`
 * and `wordsFor`), the words and the rules, never the DOM. Pure: the caller reads `quick_replies` with the phone's
 * columns and passes the job's step and the blanks' values in.
 *
 * The office marks a customer line for the phone and gives it a place. The phone shows the lines for the step the job
 * is on first, then the rest in their places, six at most, and **Something else** last. A line may carry Spanish, and
 * a person who reads Spanish gets it when it is written.
 */

import { blanksIn, fillLine, type BlankFills } from './blanks'
import type { QuickReply } from './kernel'

/** A quick reply with the phone's columns (R3's SQL adds them to `quick_replies`). */
export interface PhoneLine extends QuickReply {
  /** Its place on the phone, 1 first, or null when it is not on the phone. */
  phoneOrder: number | null
  /** The button's name, or null to take it from the line's words. */
  phoneName: string | null
  /** The line in Spanish, or null when nobody has written it. */
  textEs: string | null
}

/** The most lines that reach the phone before Something else. The owner may change it. */
export const PHONE_MAX = 6

/** The phone's last press, always there: a note to the office, never a text to the customer. */
export const SOMETHING_ELSE = {
  label: 'Something else',
  hint: 'a note to the office, who sends it on',
  note: 'This goes to the office as a note on the job. The customer never sees it. The office sends what they should hear.',
  send: 'Send to the office',
} as const

/**
 * The lines on the phone: the team's customer lines marked for it, the step the job is on first, then by their
 * places, at most `PHONE_MAX`. A line kept for one person never reaches every tech's phone.
 */
export function phoneLines(lines: readonly PhoneLine[], stepId: string | null): PhoneLine[] {
  const onStep = (q: PhoneLine) => (stepId != null && q.stepId === stepId ? 1 : 0)
  return lines
    .filter((q) => !q.removed && q.scope === 'team' && q.for === 'customer' && q.phoneOrder != null)
    .sort((a, b) => onStep(b) - onStep(a) || (a.phoneOrder ?? 0) - (b.phoneOrder ?? 0) || a.id.localeCompare(b.id))
    .slice(0, PHONE_MAX)
}

/** A sentence that only says who is writing: "this is Luis with Click Plumbing". */
const GREETING = /^this is\b.*\bClick Plumbing$/i

/**
 * The button's name: the line's `phoneName` when it has one. Else the first sentence of the filled words, past the
 * name it opens with and any sentence that only says who is writing, with a capital first letter.
 */
export function shortName(line: Pick<PhoneLine, 'text' | 'phoneName'>, fills: BlankFills): string {
  const named = line.phoneName?.trim()
  if (named) return named
  const text = fillLine(line.text.replace(/^\{first\},?\s*/, ''), fills).text
  const parts = text
    .split(/[.?!:](?=\s|$)/)
    .map((s) => s.trim())
    .filter(Boolean)
  const cut = parts.find((s) => !GREETING.test(s)) ?? parts[0] ?? text
  return cut.charAt(0).toUpperCase() + cut.slice(1)
}

/**
 * The hint under a phone button, from the first blank it uses that the app reads: the drive, the schedule or their
 * page. It shows the value when the caller knows it.
 */
export function hintFor(text: string, fills: BlankFills = {}): string {
  const used = blanksIn(text)
  const v = (key: string) => fills[key]?.trim() || null
  if (used.includes('minutes')) return v('minutes') ? `about ${v('minutes')} minutes, from the drive` : 'minutes out, from the drive'
  if (used.includes('window')) return v('window') ? `the new window ${v('window')}, from the schedule` : 'the new window, from the schedule'
  if (used.includes('back day')) {
    if (!v('back day')) return 'the next visit, from the schedule'
    return `back ${v('back day')}${v('back time') ? ` at ${v('back time')}` : ''}, from the schedule`
  }
  if (used.includes('day')) return v('day') ? `${v('day')}, from the schedule` : 'the day of the visit, from the schedule'
  if (used.includes('link')) return 'with the link to their page'
  return 'ready to go'
}

/** The words a person reads in their language: `language.ts`'s rule, kept here for the phone's callers. */
export { wordsFor } from './language'
