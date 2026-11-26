/**
 * The clock's two note boxes and the presses under them (punch list #446, v2.8624). The clock-in sheet asks what
 * you plan to get done and the clock-out review what you worked on; neither press may act with its box empty. Until
 * this file Complete Clock In stood live and refused by a toast, which to a person looked like a dead press that was
 * pressed, and the clock-out review's press was dead with no word of why. The house rule: a press that cannot act is
 * dead, drawn with the dead press's pair, and the screen says what brings it alive. Pure.
 */

/** Under the clock-in sheet's box while it is empty. */
export const CLOCK_IN_PLAN_EMPTY_LINE = 'Say what you mean to get done today, then Complete Clock In.'

/** Under the clock-out review's box while it is empty. */
export const CLOCK_OUT_NOTE_EMPTY_LINE = 'Say what you worked on today, then Complete clock out.'

/** Whether a note box holds nothing but spaces, so its press is dead. */
export function clockNoteEmpty(text: string): boolean {
  return text.trim() === ''
}
