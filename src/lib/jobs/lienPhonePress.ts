/**
 * A phone's To do row on the Lien desk: the words at the left and one press at the right, every press one size.
 *
 * Until now a phone drew each press as wide as its words, on a line of its own under the row's words, so the press
 * stood in a different place on every row, from 69 px for *Note it* to 241 px for *Answer the homestead question*.
 * A row with a second press drew it beside the first, where it took the right side and pushed the main press to a
 * line of its own at the left. A computer's row already keeps one column for its press (`ROW_PRESS_PX` in
 * `LienDeskNextUp.tsx`), with longer words wrapping inside it and the quieter press beside the question it answers.
 * A phone now does the same: the sizes are here, and the three presses whose words run past the column take a
 * shorter form, since the line above each already says which question or which record.
 *
 * The owner's rule of 2026-11-23, said of the Dashboard's Needs you rows the same day: on the left a person sees
 * what to do, on the right what to press, and the presses are one size down the list.
 *
 * Pure. The widths are mirrored in `src/index.css` (`.lienPhoneRow`), where a media query narrows the column, since
 * an inline style cannot ask the screen's width. The test holds the two together.
 */

/** The press column's width on a phone. */
export const LIEN_PHONE_PRESS_PX = 116

/** The press column's width on a small phone. */
export const LIEN_PHONE_PRESS_NARROW_PX = 100

/** A screen this wide or narrower is a small phone. */
export const LIEN_PHONE_PRESS_NARROW_AT_PX = 360

/** A row's press stands a fingertip tall (`PHONE_PRESS_MIN_HEIGHT`). It was 40. */
export const LIEN_PHONE_PRESS_MIN_HEIGHT = 44

/** The quiet second way out under a row's words (*Not lienable…*, *Take back…*): a line of words a thumb can still press. */
export const LIEN_PHONE_QUIET_MIN_HEIGHT = 32

/** The CSS variable `.lienPhoneRow` sets, which the row's two columns read. */
export const LIEN_PHONE_PRESS_VAR = '--lien-phone-press'

/** The row's two columns: the words take what is left, the press keeps its width. */
export function lienPhoneRowColumns(): string {
  return `minmax(0, 1fr) var(${LIEN_PHONE_PRESS_VAR}, ${LIEN_PHONE_PRESS_PX}px)`
}

/**
 * The three presses whose words run to three lines in the column, and the form a phone draws. Each is matched whole,
 * so a press that only starts with one of them keeps its own words.
 */
const SHORT: Readonly<Record<string, string>> = {
  'Answer the homestead question': 'Answer it',
  'Open the property record': 'Open the record',
  'Fix the property record': 'Fix the record',
}

/** A row's press as a phone words it: the short form of the three long ones, any other press as it is. */
export function lienPhonePressWords(button: string): string {
  return SHORT[button] ?? button
}

/** Whether a phone words this press differently from a computer. The press's hover says the whole of it then. */
export function lienPhonePressShortened(button: string): boolean {
  return button in SHORT
}
