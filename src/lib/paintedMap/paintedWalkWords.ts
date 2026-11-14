/**
 * What a person reads while painting a walk (punch list #345). Pure words. They are plain on
 * purpose: this is the first thing in the app that follows a phone, so every line says what is
 * read, when, and what is kept.
 */
import { taskPlaceAccuracyWords } from '../tasks/taskPlace'
import { spanWords } from './paintedTrack'
import type { WalkPause, WalkState } from './paintedWalk'

/** What the start sheet says before the first reading is asked for. */
export const WALK_BEFORE_WORDS = [
  'Keep this screen on and in your hand. The line stops if the phone locks.',
  'The line stays on this phone until you press Save.',
  'Painting pauses by itself after 5 minutes standing still, and ends after an hour.',
] as const

/** Under the start press: when the phone is read. */
export const WALK_ASK_WORDS = 'Your phone will ask to share where you are. It is read only while this screen says Painting.'

/** Beside Save, before anything leaves the phone. */
export const WALK_NOTHING_LEFT_WORDS = 'Nothing has left this phone yet. Saving keeps the line. It keeps no clock along it, so it cannot say how fast you went or where you stopped.'

/** While the screen cannot be held on by the browser. */
export const WALK_CANNOT_STAY_AWAKE_WORDS = 'This phone cannot hold its own screen on. Touch the screen now and then so it does not lock.'

/** `Sure within 15 ft`, or the words for a phone that has not said. */
export function walkSureWords(accuracyM: number | null | undefined): string {
  const sure = taskPlaceAccuracyWords(accuracyM)
  return sure ? `Sure ${sure}` : 'Finding you…'
}

/** Over the map while the phone is not sure enough to draw the line as read. */
export function walkPoorWords(accuracyM: number | null | undefined): string {
  const sure = taskPlaceAccuracyWords(accuracyM)
  return sure ? `Only sure ${sure} here. This part is drawn faint.` : 'The phone is not sure here. This part is drawn faint.'
}

/** Why the painting is paused, and what the person can do about it. */
export function walkPausedWords(state: Pick<WalkState, 'pausedWhy' | 'gapMs'>): { lead: string; tail: string } {
  const why: WalkPause | null = state.pausedWhy
  if (why === 'hidden') {
    const gap = state.gapMs != null && state.gapMs >= 1000 ? `for ${spanWords(state.gapMs)}` : 'for a moment'
    return { lead: `The screen was off ${gap}, so the line has a gap.`, tail: 'A phone’s browser cannot read where you are while it is locked or another app is in front.' }
  }
  if (why === 'standing') return { lead: 'You stood still for 5 minutes, so painting paused itself.', tail: 'Nothing was read while it was paused.' }
  if (why === 'time') return { lead: 'Painting ends by itself after an hour.', tail: 'Look the line over and save it. Paint the rest as a new line.' }
  return { lead: 'Paused.', tail: 'Nothing is being read.' }
}

/** A rough location: what it means and the two switches that fix it. */
export const WALK_ROUGH_WORDS = {
  lead: 'Your phone is giving a rough location, not where you stand.',
  tail: 'A line cannot be painted from that.',
  steps: [
    'iPhone: Settings, Privacy and Security, Location Services, Safari Websites. Turn on Precise Location.',
    'Android: press the lock beside the address, Permissions, Location. Turn on Use precise location.',
  ],
} as const

/** Why no reading came, as the browser reports it. */
export type WalkRefusal = 'none' | 'refused' | 'failed'

/** What a person reads when the phone gives nothing to paint from. Drawing by hand needs no location at all. */
export function walkRefusalWords(why: WalkRefusal): string {
  if (why === 'refused') return 'Location is off for this app. Allow it in the phone’s settings to paint by walking. You can still draw the line by hand.'
  if (why === 'none') return 'This device gives no location. You can still draw the line by hand.'
  return 'The phone could not find you. Try again in the open. You can still draw the line by hand.'
}

/** A walk found on the phone from before: `A walk from 2:14 PM is still on this phone.` */
export function keptWalkWords(timeWords: string): string {
  return `A walk from ${timeWords} is still on this phone. It was not saved.`
}
