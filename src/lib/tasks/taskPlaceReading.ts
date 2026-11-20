/**
 * One reading of the phone on a task's screens and on the box map, and what each screen says about
 * it after the Precise Location line (punch list #402, call 8). Pure words.
 *
 * A rough reading is an area and not a spot (`isRoughFix`): its middle can be miles from where the
 * person stands. So it moves no map, sets no place and measures no distance. The line then shows
 * the way to the switch, in place of *Try again in the open*, which would not help. A press takes
 * one reading and has no better one to wait for, so it is called rough at once.
 *
 * The line itself, in every state, is `preciseLocation.ts`.
 */
import type { PhoneKind } from '../paintedMap/preciseLocation'

/** Use where I am, and the box map's Use my location: the map moved, and is about right. */
export const WHERE_I_AM_WEAK_NOTE_WORDS = 'Drag the map until the ring is on the spot.'

/** The same two presses on a rough reading: the map did not move. With nowhere to open it opens wide, and says `whereIAmRoughWideNoteWords`. A desk has no switch to turn on, so it is offered the drag alone. */
export function whereIAmRoughNoteWords(kind: PhoneKind): string {
  return kind === 'other' ? 'The map was not moved. Drag it until the ring is on the spot.' : 'The map was not moved. Drag it until the ring is on the spot, or turn the switch on and press again.'
}

/** A map with nowhere to open, opened wide to be dragged after the press got no spot: nothing was left as it was, so it does not say so. */
export const WHERE_I_AM_WIDE_WORDS = 'The map opened wide. Zoom in and drag it until the ring is on the spot.'

/** The same two presses on a rough reading when the map had nowhere to open: it has just opened wide, so *was not moved* would not be true. */
export function whereIAmRoughWideNoteWords(kind: PhoneKind): string {
  return kind === 'other' ? WHERE_I_AM_WIDE_WORDS : 'The map opened wide. Zoom in and drag it until the ring is on the spot, or turn the switch on and press again.'
}

/** The Tally's Site map has no ring: Use my location only moves the view. On a rough reading the view stays. */
export function siteMapRoughNoteWords(kind: PhoneKind): string {
  return kind === 'other' ? 'The map was not moved.' : 'The map was not moved. Turn the switch on and press again.'
}

/** The Site map with nowhere to open, opened wide after the press got no spot. */
export const SITE_MAP_WIDE_WORDS = 'The map opened wide. Zoom in and drag it to the site.'

/** The Site map's press on a rough reading when the map had nowhere to open. */
export function siteMapRoughWideNoteWords(kind: PhoneKind): string {
  return kind === 'other' ? SITE_MAP_WIDE_WORDS : 'The map opened wide. Zoom in and drag it to the site, or turn the switch on and press again.'
}

/** Standing at this task? A reading the phone knows, but too wide to keep with no look at a map: the open sky is the cure. */
export const ADD_HERE_WEAK_NOTE_WORDS = 'Try again in the open.'

/** The same press on a rough reading: the open sky is not the cure, the switch is. */
export const ADD_HERE_ROUGH_NOTE_WORDS = 'A place cannot be added from a reading that wide.'

/** How far am I?, and Show where I am on a map of tasks or of a box: no distance is said from the middle of an area. */
export const HOW_FAR_ROUGH_NOTE_WORDS = 'How far cannot be told from a reading that wide.'
