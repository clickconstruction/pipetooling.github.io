/**
 * The last press's line in the papers window (punch list #350): what a press said back, and how long it stays.
 *
 * A line belongs to the paper and the step it arrived on. *WS-2041-1.pdf is downloaded* left under another sheet's
 * work statement reads as that sheet's, and *Sent 3 papers* over a send step opened again reads as this send's.
 * So the line goes when the window moves to another paper or another step, and it stays gone on the way back.
 *
 * A new line always shows, wherever the window is when it arrives: the paper picker stays live while a press is
 * under way, and its answer must not be lost. A statement's period is not a place: the line names its file.
 *
 * Pure: no React, no Supabase.
 */

/** Which paper the window is on, as the window holds it. */
export type SubPaperPlaceView = { kind: 'statement' } | { kind: 'work'; sheetId: string } | { kind: 'payment'; sendingKey: string }

/**
 * Where the window is: the step, the paper it is on, and which email of a send in several it has open. `email`
 * counts from 0, and the first email is the step itself: *Sent 12 papers* must not stand over the next twelve.
 */
export function subPaperPlace(view: SubPaperPlaceView, step: 'paper' | 'send', email: number = 0): string {
  return `${step}${email > 0 ? `#${email}` : ''}:${view.kind === 'work' ? `work:${view.sheetId}` : view.kind === 'payment' ? `payment:${view.sendingKey}` : 'statement'}`
}

/** A line as the window holds it: where it arrived, and whether the window has moved on since. */
export type SubPaperSaidHeld<T> = { said: T | null; place: string; gone: boolean }

/**
 * What the window holds after a draw. A line it has not seen before is held where the window is now. The same
 * line at another place is gone, and stays gone. Nothing changed answers the same object, so a draw can compare.
 */
export function subPaperSaidHeld<T>(held: SubPaperSaidHeld<T> | null, said: T | null, place: string): SubPaperSaidHeld<T> {
  if (!held || held.said !== said) return { said, place, gone: false }
  if (held.gone || held.place === place) return held
  return { ...held, gone: true }
}

/** The line to draw: the last press's, until the window moves. */
export function subPaperSaidShown<T>(held: SubPaperSaidHeld<T>): T | null {
  return held.gone ? null : held.said
}
