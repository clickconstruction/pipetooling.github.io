/**
 * Put the dot where I am (punch list #402, call 5): what one reading does to a place's dot, and what
 * the place panel says about it after the Precise Location line. Pure.
 *
 * A rough reading is an area and not a spot. Its middle can be miles from the job, so the dot is
 * left where the painter had it, and the panel says why. A weak reading still moves the dot: the
 * phone knows about where it is, and the painter drags the dot the rest of the way.
 *
 * No reading at all moves nothing either. The panel says the reason and the next press, in the same
 * place under the press. The dot is what is dragged here: dragging the map places nothing.
 */
import type { MyFixFailure } from '../materials/myLocation'
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

/**
 * In place of the line when the press got no reading at all: the reason, that the dot is where it was, and the next
 * press. A phone that ran out of time is asked again. One that said no is asked again once location is allowed.
 */
export function placeDotNoFixWords(why: MyFixFailure): string {
  if (why === 'refused') return 'Location is off for this app. The dot was not moved. Drag it onto the spot, or allow location in the phone’s settings and press again.'
  if (why === 'none') return 'This device gives no location. The dot was not moved. Drag it onto the spot by hand.'
  return 'Your phone did not find you in time. The dot was not moved. Drag it onto the spot, or press Put the dot where I am again.'
}
