/**
 * A day was heard, say what it is (punch list #421): when a person names a day still ahead in their own text or
 * voicemail, one press under the line says what the day is a promise of. The owner's call (2026-11-23) is *straight to
 * the choice*: no offered row waits for someone to name it later from Follow up. The line reads
 * *⟪Wed Nov 25⟫ is a promise of*, then a button for each kind by who they are (`promiseChoices`), then *just talk*. A
 * customer's payment opens the sheet #129 built (`wordFromLine.ts`), so a payment has one road and the Pipeline stays
 * its record. A voicemail also offers *Another day*, since its transcript is Quo's hearing of it.
 *
 * Who gets the choice: a customer, a trade partner and an architect, the three kinds `promiseChoices` names. A lead, a
 * supply house, a candidate, a sub, our own team and a number nobody has named get none. Which lines: their own text or
 * voicemail, the lines whose words are theirs alone (`wordFromLine.ts` → `DAY_CHANNELS`). The day is read from the
 * line's own day (`daySaidIn`), in the app's zone, so "Wednesday" in Monday's text is that week's Wednesday whenever it
 * is read. Pure: the write is `write_down_heard`, and the read of what a line was already called is the thread's.
 */
import type { ContactKind } from '../contacts/kernel'
import { val } from '../valuesInPlace'
import { dayLabel } from './owed'
import { JUST_TALK, promiseChoices, promiseGoesOn, type HeardPromiseKind, type PromiseChoice, type PromisePerson } from './promises'
import { daySaidIn } from './voicemailRead'

/** The kinds of person a heard day is offered for. */
const CHOICE_PEOPLE: ReadonlySet<ContactKind> = new Set<ContactKind>(['customer', 'trade', 'arch'])

/** Their own words alone: a call's line is Quo's summary of both sides, and an email quotes every mail under it. */
const CHOICE_CHANNELS: ReadonlySet<string> = new Set(['text', 'voicemail'])

/** A line the choice draws under: theirs, a text or a voicemail, from a customer, a trade partner or an architect. */
export function lineTakesChoice(m: { direction: string; channel: string }, c: { kind: string }): boolean {
  return m.direction === 'in' && CHOICE_CHANNELS.has(m.channel) && CHOICE_PEOPLE.has(c.kind as ContactKind)
}

/** One press on the choice: a kind, or a payment, which opens the sheet instead of writing here. */
export interface HeardChoice {
  kind: Exclude<HeardPromiseKind, 'said'>
  /** The button. */
  label: string
  /** Its hover: where the choice goes. */
  tip: string
  /** A payment opens #129's sheet; every other kind writes the line in one press. */
  opens: 'sheet' | 'write'
  /** The kernel's choice, for the written words and the write-throughs. */
  choice: PromiseChoice
}

/** A day heard on a line, with the presses under it. */
export interface HeardChoiceLine {
  /** The day, YYYY-MM-DD. */
  ymd: string
  /** "Wed Nov 25". */
  label: string
  /** The words it was read from: "Wednesday". */
  said: string
  /** How the line came. */
  from: 'text' | 'voicemail'
  choices: HeardChoice[]
  /** A voicemail's day was Quo's hearing of it, so the office may pick another. */
  anotherDay: boolean
}

/** The hover on *A payment*: the sheet opens with the day in it. */
export function paymentChoiceTip(label: string): string {
  return `Opens the payment sheet with ${label} filled in. Nothing is written until you save.`
}

/** The presses for a person, in `promiseChoices`' order. */
export function heardChoices(person: PromisePerson, jobName: string | null, label: string): HeardChoice[] {
  return promiseChoices(person, jobName)
    .filter((c): c is PromiseChoice & { kind: HeardChoice['kind'] } => c.kind !== 'said')
    .map((choice) =>
      choice.kind === 'payment'
        ? { kind: choice.kind, label: choice.label, tip: paymentChoiceTip(label), opens: 'sheet' as const, choice }
        : { kind: choice.kind, label: choice.label, tip: promiseGoesOn(choice), opens: 'write' as const, choice },
    )
}

/**
 * The day a person said on their own text or voicemail, with the choice under it, or null: a line the choice does not
 * draw under, no day said, or a day already gone by at `now`. `chosenYmd` is a day the office picked with
 * *Another day*, which stands in for the day read.
 */
export function heardChoiceOnLine(
  m: { direction: string; channel: string; at: string; body: string },
  person: PromisePerson,
  jobName: string | null,
  now: Date,
  chosenYmd: string | null = null,
): HeardChoiceLine | null {
  if (!lineTakesChoice(m, person)) return null
  const found = daySaidIn(m.body, m.at, now)
  if (!found || found.past) return null
  const ymd = chosenYmd ?? found.day
  const label = dayLabel(ymd)
  const from = m.channel === 'voicemail' ? 'voicemail' : 'text'
  return { ymd, label, said: found.said, from, choices: heardChoices(person, jobName, label), anotherDay: from === 'voicemail' }
}

/** The words before the presses, the day marked as a value: "⟪day|Wed Nov 25⟫ is a promise of". */
export function heardChoiceWords(label: string): string {
  return `${val('day', label)} is a promise of`
}

/** The last press: the day was not a promise. */
export const JUST_TALK_PRESS = JUST_TALK

/** Its hover. */
export const JUST_TALK_TIP = 'The day was only talk. Nothing is written, and the choice goes away.'

/** What the office reads after *just talk*. */
export const JUST_TALK_TOAST = 'Kept as just talk. Nothing else was written.'

/** *Another day*'s hover. */
export const ANOTHER_DAY_TIP = 'Quo may have heard the day wrong. Pick the day they said.'

/** The day picker's label for a typed day. */
export const ANOTHER_DAY_TYPED = 'The day they said'

/** What the office reads once the line is written: "Written down. Their quote by Wed Nov 25." */
export function heardWrittenToast(kind: string, writes: string | null, ymd: string): string {
  const day = dayLabel(ymd)
  if (kind === 'access') return `Written down. We can be on site ${day}.`
  const what = MARK_WHAT[writes ?? kind] ?? 'their word'
  return `Written down. ${what.charAt(0).toUpperCase()}${what.slice(1)} by ${day}.`
}

/** The kind a choice writes by default: a double kind writes its first (the lead, 2026-10-12). */
export function defaultWrites(kind: string): 'start' | 'insurance' | null {
  return kind === 'start' ? 'start' : kind === 'papers' ? 'insurance' : null
}

/** A line's day already said, as the thread keeps it (`message_promises`). */
export interface HeardMark {
  kind: string | null
  state: string
  day: string | null
  writes?: string | null
}

/** What a written kind is, in the line under it. A double kind names the one written. */
const MARK_WHAT: Readonly<Record<string, string>> = {
  quote: 'their quote',
  start: 'their start',
  delivery: 'their delivery',
  insurance: 'their insurance',
  w9: 'their W-9',
  papers: 'their insurance',
  payment: 'a payment',
  decision: 'their answer on our bid',
  access: 'a day we can be on site',
  answer: 'their answer',
  cert: 'the certificate',
}

/**
 * Under a line already said, the marked sentence: "Written down as ⟪what|their quote⟫ by ⟪day|Wed Nov 25⟫." A day called
 * just talk and an offered day say nothing here: just talk takes the choice away, and an offered day still offers it.
 */
export function heardMarkWords(mark: HeardMark): string | null {
  if (mark.state !== 'written' || !mark.kind || !mark.day) return null
  if (mark.kind === 'access') return `Written down. We can be on site ${val('day', dayLabel(mark.day))}.`
  const what = MARK_WHAT[mark.writes ?? mark.kind]
  if (!what) return null
  return `Written down as ${val('what', what)} by ${val('day', dayLabel(mark.day))}.`
}

/**
 * What the line shows, from its mark: the choice while nothing was said (or the day is still offered); the written
 * words once a kind was written; nothing once it was called just talk. A payment written stays with #129's press, which
 * changes or voids it on the sheet.
 */
export function heardLineState(mark: HeardMark | null): 'choice' | 'written' | 'payment' | 'talk' {
  if (!mark || mark.state === 'offered') return 'choice'
  if (mark.state === 'no') return 'talk'
  if (mark.kind === 'payment') return 'payment'
  return 'written'
}

/** The written choice's own words for the hover on the written line: where it goes. */
export function heardMarkTip(choice: PromiseChoice | undefined): string | undefined {
  return choice ? promiseGoesOn(choice) : undefined
}
