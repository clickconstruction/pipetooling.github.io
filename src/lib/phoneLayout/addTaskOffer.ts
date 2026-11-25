/**
 * Where the Home Screen offer for the Add Task icon is drawn (`AddTaskShortcutBanner`).
 *
 * The offer is shown in iOS Safari alone, to a person who can add a task, until it is dismissed. It stood as a line
 * above the header on every page. Under the new phone layout it became one quiet row of the Dashboard. On a phone
 * with that layout off it is still the line, and since punch list #428 (the owner's answer of 2026-11-25, *On the
 * Dashboard alone*) the line stands on the Dashboard alone too. About 56 points of every other page go back to the
 * page. A wider screen keeps the line on every page: it has the room, and the answer was a phone's.
 *
 * Pure: the shell asks, with what it already knows.
 */

export type AddTaskOfferPlace = 'line' | 'quiet' | null

/** The Dashboard's own address, the one page a phone draws the offer on. */
export const ADD_TASK_OFFER_PHONE_PAGE = '/dashboard'

export function addTaskOfferPlace(at: {
  /** The new phone layout is on (`useNewPhoneLayout`), which is only ever on at a phone's width. */
  phoneBars: boolean
  /** The screen is a phone's width. */
  narrow: boolean
  pathname: string
}): AddTaskOfferPlace {
  const onDashboard = at.pathname === ADD_TASK_OFFER_PHONE_PAGE
  if (at.phoneBars) return onDashboard ? 'quiet' : null
  if (at.narrow) return onDashboard ? 'line' : null
  return 'line'
}
