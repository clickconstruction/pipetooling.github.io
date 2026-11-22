/**
 * Needs you on a phone: where the Dashboard draws the list, and where its door leads.
 *
 * Needs you is one list drawn three ways, all of them older than this file: the card's **Cards** stack, the
 * card's **Walk the list** deck, and the one-line door `Needs you · 10 · <the first line>` that opens an Inbox
 * tab where the card is. Until the new phone layout the door was an office person's alone, with Dispatch Mode
 * on, and every other phone carried the whole stack on its Dashboard.
 *
 * Under the new phone layout (`newPhoneLayout.ts`) the rule is the page's mode, not the role:
 *
 * - **A mode with an Inbox tab** (Dispatch Mode, Job Mode): the Dashboard draws the door, and the door opens
 *   that mode's Inbox, where the card is. The door stands in for the Needs you card alone: the cards under it stay.
 * - **No mode, or Task Mode**: there is no Inbox tab to lead to, so the card stays on the Dashboard.
 *
 * Wherever the card is drawn it opens on Walk the list (`needsYouInitialMode`), with Cards one chip away.
 *
 * With the switch off this file answers what the Dashboard answered before it: the door for an office person's
 * phone with Dispatch Mode on, and nothing on Job Mode's own Dashboard.
 *
 * Nothing here draws. `DashboardPinnedQuickRow` draws the door and the card, and both are the ones it had.
 */
import type { UserRole } from '../../hooks/useAuth'
import { needsYouDoorWords } from '../dashboard/phoneFolds'
import type { NeedsYouItem } from '../dashboardNeedsYou'
import { groupNeedsYouItems, needsYouHeaderWords } from '../needsYouActor'
import type { PageMode } from '../pageMode'

/** Dispatch Mode's Inbox tab. */
export const DISPATCH_MODE_INBOX_PATH = '/dispatch-mode/inbox'

/** Job Mode's Inbox tab. */
export const JOB_MODE_INBOX_PATH = '/job-mode/inbox'

/** The Inbox tab the page's mode puts at the foot of the phone, or null when the mode has none. */
export function needsYouInboxPath(mode: PageMode): string | null {
  if (mode === 'dispatch') return DISPATCH_MODE_INBOX_PATH
  if (mode === 'job') return JOB_MODE_INBOX_PATH
  return null
}

export interface NeedsYouPlaceInput {
  /** `useNewPhoneLayout().on`: the switch is ticked on this device and the screen is a phone's width. */
  newPhoneLayout: boolean
  /** The office person's phone (`phoneOffice` on the Dashboard): the folds, the quiet squares and the old door. */
  phoneOffice: boolean
  /** The one mode the page is drawn in (`usePageMode`). */
  mode: PageMode
}

/** The door a Dashboard draws in place of the Needs you card. */
export interface NeedsYouDoorPlan {
  /** The Inbox tab the door opens. */
  to: string
  /**
   * Whether the two cards drawn under the list stay on the Dashboard: the office's round and, for the office,
   * what waits on the leader. The office person's door of v2.3883 takes them to the Inbox tab with the list.
   * The new phone layout's door stands in for the Needs you card alone, so the red *No round* mark a leader
   * reads on his Dashboard today is still on his Dashboard.
   */
  cardsStay: boolean
}

/**
 * The full Dashboard: the door it draws, or null when it keeps the card.
 *
 * The office person's phone with Dispatch Mode on has the door it had, switch off or on.
 * Switch on: every other phone whose mode has an Inbox tab gets the door too, for every role.
 */
export function needsYouDashboardDoor(input: NeedsYouPlaceInput): NeedsYouDoorPlan | null {
  if (input.phoneOffice && input.mode === 'dispatch') return { to: DISPATCH_MODE_INBOX_PATH, cardsStay: false }
  if (!input.newPhoneLayout) return null
  const to = needsYouInboxPath(input.mode)
  return to ? { to, cardsStay: true } : null
}

/**
 * Job Mode's own Dashboard, which never drew the list: its card lives in Job Mode's Inbox tab.
 *
 * Switch off: nothing, as before. Switch on: the door to that tab, so the count of what waits is on the
 * first screen of a phone that starts in Job Mode.
 */
export function needsYouJobModeDoor(input: { newPhoneLayout: boolean }): string | null {
  return input.newPhoneLayout ? JOB_MODE_INBOX_PATH : null
}

/**
 * What the door says: `Needs you · <count> · <first>`, or null when the list is empty and there is no door.
 *
 * Switch off: every line counted and the list's first line, as the door read before the switch.
 *
 * Switch on: what the card it opens says. The count is the viewer's own lines, the number in the card's amber
 * pill, and the first line is the first of them, the one Walk the list opens on. The door was built for the
 * assistant, whose lines most of the list is. A leader's list is mostly the office's, so the old words told him
 * 33 where his card says 8, and named a line that is not his to press. With none of his own the count is 0 and
 * the words are how many wait on others, as the card's header says it.
 *
 * `ownOnly` is Job Mode's own Dashboard, where the door stands in for no card: there a list with none of the
 * viewer's own lines draws no door, so a field hand's first screen is never an amber line that says 0.
 */
export function needsYouDoorLine(
  items: ReadonlyArray<Pick<NeedsYouItem, 'key' | 'title'>>,
  input: { newPhoneLayout: boolean; role: UserRole | null | undefined; ownOnly?: boolean },
): { count: number; first: string } | null {
  if (!input.newPhoneLayout) return needsYouDoorWords(items)
  if (items.length === 0) return null
  const groups = groupNeedsYouItems(items, input.role)
  const first = groups.yours[0]
  if (first) return { count: groups.yours.length, first: first.title }
  if (input.ownOnly) return null
  return { count: 0, first: needsYouHeaderWords(groups).others }
}
