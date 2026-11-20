/**
 * What a person reads while painting a walk (punch list #345). Pure words. They are plain on
 * purpose: this is the first thing in the app that follows a phone, so every line says what is
 * read, when, and what is kept.
 */
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

/**
 * Beside Save, before the walk's lines leave the phone. On a map that is already saved something has left it: a
 * place added on the walk, or what the map held before. So there the sentence speaks of the walk alone (#393).
 */
export function walkNothingLeftWords(mapSaved: boolean): string {
  const lead = mapSaved ? 'What you painted has not left this phone yet.' : 'Nothing has left this phone yet.'
  return `${lead} Saving keeps the line. It keeps no clock along it, so it cannot say how fast you went or where you stopped.`
}

/** Under ＋ Place on Look it over: a place does not wait for Save the way a line does. */
export const WALK_REVIEW_PLACE_WORDS = 'Mark a gate, a meter or where to park. A place is saved when you add it, so it stays if you throw the walk away.'

/** What throwing a walk away leaves behind: nothing on a map that was never saved, and on a saved map everything that already was. */
export function walkThrowAwayWords(mapSaved: boolean): string {
  return mapSaved
    ? 'The lines you painted go from this phone. What is already saved on the map stays.'
    : 'What you painted goes from this phone. Nothing was sent anywhere, so nothing is left behind.'
}

/** While the screen cannot be held on by the browser. */
export const WALK_CANNOT_STAY_AWAKE_WORDS = 'This phone cannot hold its own screen on. Touch the screen now and then so it does not lock.'

/**
 * What the walk does about how sure the phone is, said after the Precise Location line (punch list #402). The line
 * itself, in every state, is `preciseLocation.ts`. A weak signal still draws, faint. A rough reading draws nothing.
 */
export const WALK_WEAK_NOTE_WORDS = 'This part is drawn faint. Fix it by hand when you look the line over.'
export const WALK_ROUGH_NOTE_WORDS = 'A line cannot be painted from a reading that wide.'

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
