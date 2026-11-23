/**
 * A device held in the hand: its press on a photo opens the camera. A desk opens the file picker.
 * One reading of the pointer, for the place sheet's photo and the job's **Photo of a spot**. Since v2.8349 a
 * device held in the hand also swipes a Dashboard row away, where a desk gets a word press (`SwipeAwayRow`).
 */
export function handHeld(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches
  } catch {
    return false
  }
}
