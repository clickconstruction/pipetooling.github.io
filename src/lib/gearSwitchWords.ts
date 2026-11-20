/**
 * The gear menu's two show-or-hide switches (v2.8043): the pin bar's and Tell the dev's.
 *
 * Neither is a mode. A mode changes the page a person sees (Job Mode, Dispatch Mode, Task Mode); these two
 * only show or hide one thing, so each row is named for that thing and wears its icon. They read Pin Mode
 * and Fix Mode until v2.8043. The stored keys (`pinModeToggle.ts`, `tellTheDev/fixMode.ts`) kept the old
 * word so nobody's choice was lost.
 *
 * One home for the words, because two screens draw the rows: the gear menu and the phone dock's More sheet.
 */

export type GearSwitch = 'pin' | 'fix'

/** The row that shows or hides the pin bar at the bottom of a page. */
export const PIN_BAR_SWITCH_LABEL = 'Pin bar'

/** The row that shows or hides the wrench. The feature's own name: the wrench opens Tell the dev. */
export const TELL_THE_DEV_SWITCH_LABEL = 'Tell the dev'

/** What a press will do, said as the act: the row is ticked while its thing shows. */
export function switchRowTip(which: GearSwitch, on: boolean): string {
  if (which === 'pin') return on ? 'Hide the pin bar' : 'Show the pin bar at the bottom of pages'
  return on ? 'Hide the wrench that sends a note to the dev' : 'Show the wrench that sends a note to the dev'
}

/**
 * The switch's name for a screen reader, read with its pressed state. Tell the dev's says *wrench*, because on
 * a narrow phone the gear menu also holds the press that opens the box, and that one is named Tell the dev.
 */
export function switchRowAriaLabel(which: GearSwitch): string {
  return which === 'pin' ? 'Show the pin bar' : 'Show the Tell the dev wrench'
}
