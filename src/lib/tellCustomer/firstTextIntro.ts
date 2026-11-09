/**
 * A first text says who is writing (v2.6771, punch list #291). The owner, 2026-11-09: "if it's the first message to
 * the user, it's really important that we say hi this is user from ClickPlumbing". The box already knows whether a
 * text is the customer's first from us: the carriers' opt-out line rides on it (`textOut.optoutReason`, the reason
 * `first`), read off the thread's outbound texts to the number. This kernel reads the same tail the sheet already has
 * (`TellContact.lines`, the texts by number the To chip orders by) and adds the words' rule: on a first text the words
 * must name the sender or the company, else Send is held and **Put the opening back** restores the line's opening.
 * A later text is never held. Pure; the sheet is `components/customers/TellCustomerSheet.tsx`.
 */
import type { RecipientLine } from '../messages/compose'
import { daysSinceOurLastText, optoutReason, type OptoutReason } from '../messages/textOut'

/** The company a text names, as the opt-out line and the opening both read it. */
export const INTRO_COMPANY = 'Click Plumbing'

const timeOf = (at: string): number => {
  const t = Date.parse(at)
  return Number.isNaN(t) ? 0 : t
}

/** When our last text to this number went, in milliseconds, or null when we never texted it; theirs do not count. */
export function lastOurTextTo(lines: readonly RecipientLine[], channelId: string | null): number | null {
  if (!channelId) return null
  let last: number | null = null
  for (const l of lines) {
    if (l.direction !== 'out' || l.channelId !== channelId) continue
    const t = timeOf(l.at)
    if (t && (last === null || t > last)) last = t
  }
  return last
}

/** The opt-out line's reason on this text, by the box's own rule: `first`, `silence`, or null when no line rides. */
export function firstTextReason(lines: readonly RecipientLine[], channelId: string | null, nowMs: number): OptoutReason | null {
  return optoutReason(lastOurTextTo(lines, channelId), nowMs)
}

/** The quiet days behind a `silence` reason, for the bubble's tag; null when we never texted the number. */
export function quietDays(lines: readonly RecipientLine[], channelId: string | null, nowMs: number): number | null {
  return daysSinceOurLastText(lastOurTextTo(lines, channelId), nowMs)
}

/** Whether this is the customer's first text from us on this number. */
export function isFirstText(lines: readonly RecipientLine[], channelId: string | null, nowMs: number): boolean {
  return firstTextReason(lines, channelId, nowMs) === 'first'
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()

/**
 * Whether the words say who is writing: the sender's first name or the company's name, anywhere in them. Either is
 * enough; the hold is for words that carry neither (the office trimmed the whole opening).
 */
export function introPresent(text: string, me: string | null, company: string = INTRO_COMPANY): boolean {
  const words = norm(text)
  if (!words) return false
  if (company && words.includes(norm(company))) return true
  const name = norm(me ?? '')
  return name.length > 1 && new RegExp(`(^|[^a-z])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`).test(words)
}

/** Whether Send is held: a first text whose words name neither the sender nor the company. */
export function introHeld(first: boolean, text: string, me: string | null, company: string = INTRO_COMPANY): boolean {
  return first && !introPresent(text, me, company)
}

/**
 * The line's opening: its first sentence, "Hi Dana, this is Rosa with Click Plumbing." (or the Spanish "Hola Dana, soy
 * Rosa de Click Plumbing."). Taken from the words as the sheet started them, filled for this customer.
 */
export function lineOpening(startingWords: string): string {
  const words = startingWords.trim()
  const m = /^(.*?[.!?])(\s|$)/.exec(words)
  return (m?.[1] ?? words).trim()
}

/** Put the opening back: the line's first sentence ahead of the words as typed, once. */
export function withOpeningBack(text: string, startingWords: string): string {
  const opening = lineOpening(startingWords)
  const body = text.trim()
  if (!opening) return body
  if (norm(body).startsWith(norm(opening))) return body
  return body ? `${opening} ${body}` : opening
}

const possessive = (first: string | null) => (first ? `${first}’s` : 'their')

export const FIRST_TEXT_WORDS = {
  /** The chip on the sheet. */
  chip: 'First text to this number',
  /** Under the chip: why the opening matters and what the app adds. */
  hint: (first: string | null) => `${first ? `${first}’s` : 'Their'} first text from us names you and ${INTRO_COMPANY}. The app adds the carriers’ opt-out line under it. Preview shows both.`,
  /** The hold under the box when the opening is gone. */
  hold: (first: string | null, me: string | null) => `This is ${possessive(first)} first text from us, so it has to say who is writing. Put ‘this is ${me ?? 'you'} with ${INTRO_COMPANY}’ back, or press Put the opening back.`,
  /** The press that restores the opening. */
  putBack: 'Put the opening back',
  /** Beside the press: why only this text is held. */
  laterNote: 'A later text is not held. Only the first one has to introduce you.',
  /** The chip on the preview's phone. */
  previewChip: (first: string | null) => `${first ? `${first}’s` : 'Their'} first text from us`,
  /** Under the preview's phone caption on a first text. */
  previewHint: 'A number they have not seen before. The words have to say who we are.',
  /** Under a later text's bubble in the preview: why no opt-out line shows. */
  previewLater: 'No opt-out line: not their first text from us.',
} as const
