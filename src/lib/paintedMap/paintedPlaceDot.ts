/**
 * Put the dot where I am (punch list #402, call 5): what one reading does to a place's dot, and what
 * the place panel says about it after the Precise Location line. Pure.
 *
 * A rough reading is an area and not a spot. Its middle can be miles from the job, so the dot is
 * left where the painter had it, and the panel says why. A weak reading still moves the dot: the
 * phone knows about where it is, and the painter drags the dot the rest of the way.
 */
import { isRoughFix } from './paintedTrack'
import type { PhoneKind } from './preciseLocation'

/** May this reading move the dot? Any reading may but a rough one. One with no margin said nothing against itself. */
export const readingMovesDot = (accuracyM: number | null | undefined): boolean => !isRoughFix(accuracyM)

/** After the line while the signal is weak: the dot moved, and is about right. */
export const PLACE_DOT_WEAK_NOTE_WORDS = 'Drag the dot onto the spot.'

/** After the line on a rough reading: the dot did not move. A desk has no switch to turn on, so it is offered the drag alone. */
export function placeDotRoughNoteWords(kind: PhoneKind): string {
  return kind === 'other' ? 'The dot was not moved. Drag it onto the spot by hand.' : 'The dot was not moved. Drag it onto the spot by hand, or turn the switch on and press again.'
}
