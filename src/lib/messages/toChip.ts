/**
 * The To chip (punch list #118, PR 1): where a text goes, and the short menu that switches it when a customer has more
 * than one number. Every send picked by a rule and offered no switch, so a customer who texted from a second phone kept
 * hearing from us on the first. The chip reads `numberOrder` (`compose.ts`): the usual the office starred, else the one
 * the thread last carried a line on, else the first that can still take a text. With one number the chip is a label.
 * With more it opens a menu, each number with when it last carried a line, a STOP marked, the usual starred, and a tick,
 * *Make this their usual number*, that remembers the pick (`contact_channel_make_usual`). Pure; the window draws it.
 */
import type { Contact, ContactRecord } from '../contacts/kernel'
import { numberOrder, type RecipientLine } from './compose'
import { whenWords, type ThreadMessage } from './thread'

/** One row of the chip's menu. */
export interface NumberChoice {
  id: string
  value: string
  /** This number sent STOP: listed grey, not pickable. */
  optedOut: boolean
  /** The office starred it. */
  usual: boolean
  /** When the thread last carried a line on it, or null when it never did. */
  lastAt: string | null
  /** The words beside the number: "last line yesterday", "no line yet", "sent STOP". */
  words: string
}

export const MAKE_USUAL_LABEL = 'Make this their usual number'
export const USUAL_MARK = '★ usual'
export const STOP_MARK = 'STOP'

/** The words beside a number in the menu. */
export function numberWords(lastAt: string | null, optedOut: boolean, nowIso: string): string {
  if (optedOut) return 'sent STOP'
  if (!lastAt) return 'no line yet'
  return `last line ${whenWords(lastAt, nowIso)}`
}

/** Their numbers as the menu lists them, in the order a text would go to them. */
export function numberChoices(contact: Pick<Contact, 'channels'>, lines: readonly RecipientLine[], nowIso: string): NumberChoice[] {
  const lastOn = new Map<string, string>()
  for (const l of lines) {
    if (!l.channelId || (l.direction !== 'in' && l.direction !== 'out')) continue
    if (l.at > (lastOn.get(l.channelId) ?? '')) lastOn.set(l.channelId, l.at)
  }
  return numberOrder(contact, lines).map((ch) => {
    const lastAt = lastOn.get(ch.id) ?? null
    const optedOut = Boolean(ch.optedOutAt)
    return { id: ch.id, value: ch.value, optedOut, usual: Boolean(ch.usualAt) && !optedOut, lastAt, words: numberWords(lastAt, optedOut, nowIso) }
  })
}

/** The chip opens a menu only when there is a choice to make: two numbers or more. */
export function chipHasMenu(choices: readonly NumberChoice[]): boolean {
  return choices.length > 1
}

/** The chip's own words: "To (830) 555-0190", or what is missing. */
export function chipLabel(choice: NumberChoice | null): string {
  return choice ? `To ${choice.value}` : 'To no number on file'
}

/** The pick remembers only when the office opened the menu and chose a number that is not the usual already. */
export function usualToSet(choices: readonly NumberChoice[], pickedId: string | null, tick: boolean): string | null {
  if (!tick || !pickedId) return null
  const picked = choices.find((c) => c.id === pickedId)
  if (!picked || picked.optedOut || picked.usual) return null
  return picked.id
}

// ---------- Who is this? asks ----------

/** Whole days after which an old number counts as quiet, so the new one is ticked as the usual by default. */
export const QUIET_NUMBER_DAYS = 30

/** A known record's numbers, with when each last carried a line, for *Who is this?*'s ask. */
export interface KnownNumber {
  value: string
  lastAt: string | null
  usual: boolean
}

/**
 * The numbers the record already has in Messages, from the page's view: the contact whose record is this one, and the
 * newest line on each of its numbers. Empty when the record has no thread yet, so the ask is not drawn.
 */
export function numbersOfRecord(
  view: { contacts: readonly Pick<Contact, 'id' | 'record' | 'channels'>[]; messages: readonly ThreadMessage[] },
  record: NonNullable<ContactRecord>,
): KnownNumber[] {
  const holder = view.contacts.find((c) => c.record && c.record.table === record.table && c.record.id === record.id)
  if (!holder) return []
  const lastOn = new Map<string, string>()
  for (const l of view.messages) {
    if (l.contactId !== holder.id || !l.channelId || (l.direction !== 'in' && l.direction !== 'out')) continue
    if (l.at > (lastOn.get(l.channelId) ?? '')) lastOn.set(l.channelId, l.at)
  }
  return holder.channels
    .filter((ch) => ch.kind === 'phone' && !ch.optedOutAt)
    .map((ch) => ({ value: ch.value, lastAt: lastOn.get(ch.id) ?? null, usual: Boolean(ch.usualAt) }))
}

/**
 * The ask under *Who is this?* (the card's call 4): *Make this their usual number · (830) 555-0121 was*. Ticked by
 * default when no old number carried a line in the last `QUIET_NUMBER_DAYS`, since the office knows which phone the
 * customer is holding; unticked when one did. Null when the record has no number yet: the new one is simply theirs.
 */
export function usualAsk(known: readonly KnownNumber[], nowIso: string): { label: string; was: string; tickedByDefault: boolean } | null {
  if (!known.length) return null
  const quietSince = Date.parse(nowIso) - QUIET_NUMBER_DAYS * 86_400_000
  const busy = known.some((k) => k.lastAt && Date.parse(k.lastAt) >= quietSince)
  const old = known.find((k) => k.usual) ?? known[0]!
  return { label: MAKE_USUAL_LABEL, was: `${old.value} was`, tickedByDefault: !busy }
}
