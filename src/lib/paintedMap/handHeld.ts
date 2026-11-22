/**
 * A device held in the hand: its press on a photo opens the camera. A desk opens the file picker.
 * One reading of the pointer, for the place sheet's photo and the job's **Photo of a spot**.
 */
export function handHeld(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches
  } catch {
    return false
  }
}
