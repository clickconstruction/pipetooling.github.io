/**
 * Messages R3: the quick replies editor's **Phone** tab and a line's phone fields (`to-dos/gc-mode/messages/
 * RESIDENTIAL_BUILD_PLAN.md` → R3's screens). Lifted from the residential prototype v0.8 on branch spike/gc-mode
 * (`customer-messages-prototype.html`: `phoneTab`, its ↑ ↓ off presses, and `editRow`'s phone tick and short name), the
 * words and the rules, never the DOM. Pure: the caller saves each place through `edit_quick_reply`'s `p_phone_order`.
 *
 * The office orders the lines a tech gets on Job Mode here. The phone itself (`phone.ts`'s `phoneLines`) puts the
 * job's step first and shows six at most, so the tab lists every line on the phone and says which wait past six.
 */

import { onThePhone, PHONE_ONLY_CUSTOMERS, type QuickReply, type QuickReplyFor, type QuickReplyScope } from './kernel'
import { PHONE_MAX } from './phone'

/** The Phone tab's list: every line on the phone by its place, a tie by id, as `phoneLines` breaks one. Not capped. */
export function phoneTabLines<Q extends QuickReply>(lines: readonly Q[]): Q[] {
  return lines.filter(onThePhone).sort((a, b) => (a.phoneOrder ?? 0) - (b.phoneOrder ?? 0) || a.id.localeCompare(b.id))
}

/** One save the Phone tab makes: a line and its new place. A place of 0 takes it off the phone. */
export interface PhonePlace {
  id: string
  phoneOrder: number
}

/** The place `edit_quick_reply` reads as off the phone. */
export const OFF_THE_PHONE = 0

/**
 * Move a line up or down one place. The list in its new order is numbered 1 to n, and a save goes for each line whose
 * place changed. A list already numbered 1 to n takes two saves. A list with gaps or ties is numbered again in passing.
 */
export function movePhone(lines: readonly QuickReply[], id: string, by: -1 | 1): PhonePlace[] {
  const list = phoneTabLines(lines)
  const at = list.findIndex((q) => q.id === id)
  const to = at + by
  if (at < 0 || to < 0 || to >= list.length) return []
  const moved = [...list]
  ;[moved[at], moved[to]] = [moved[to]!, moved[at]!]
  return moved.flatMap((q, i) => (q.phoneOrder === i + 1 ? [] : [{ id: q.id, phoneOrder: i + 1 }]))
}

/** The place a line takes when it is ticked onto the phone: after the last. */
export function nextPhonePlace(lines: readonly QuickReply[]): number {
  return lines.filter(onThePhone).reduce((most, q) => Math.max(most, q.phoneOrder ?? 0), 0) + 1
}

/**
 * Whether the tick can put a line on the phone, from who it is for and whose it is, and the words when it cannot.
 * A line moved away from customers, or kept for one person, comes off the phone on its Save.
 */
export function phoneTick(line: { for: QuickReplyFor; scope: QuickReplyScope }): { can: boolean; why: string | null } {
  return line.scope === 'team' && line.for === 'customer' ? { can: true, why: null } : { can: false, why: PHONE_ONLY_CUSTOMERS }
}

/** Which lines on the tab reach the phone: the first six. The rest wait until one above comes off. */
export function reachesPhone(index: number): boolean {
  return index < PHONE_MAX
}

/** The Phone tab's words and a line's phone fields. */
export const PHONE_TAB_WORDS = {
  note: 'The lines a tech gets on Job Mode, in this order. On the phone, the lines for the job’s step move to the top. The rest keep this order.',
  max: `${PHONE_MAX} at most reach the phone. Something else is always last.`,
  waiting: `Only the first ${PHONE_MAX} reach the phone. This one waits until a line above comes off.`,
  empty: 'No line is on the phone yet. Open a line for customers and tick On the tech’s phone.',
  up: 'Move up',
  down: 'Move down',
  off: 'Take it off the phone',
  tick: 'On the tech’s phone',
  name: 'Its short name on the phone',
  nameNote: 'What the tech’s button says. Empty reads the line’s first sentence.',
  moved: 'Moved. The phone shows the new order.',
  tookOff: 'Taken off the phone. It stays on the list.',
} as const
