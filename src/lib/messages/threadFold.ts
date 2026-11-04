/**
 * Messages, cut 10: when a person's thread folds its header for a narrow column (the prototype's v1.32, the owner's
 * pick C, and v1.48's way back). It goes by the thread column's own width, not the screen's, so a narrow column at a
 * wide window folds too. A phone always folds, since the window fills its screen.
 */

/** The thread column's width at which the header folds, and every width under it. */
export const THREAD_FOLD_PX = 640

/** The header folds: on a phone, or once the column is measured at 640 px or less. Unmeasured reads wide. */
export function isThreadFolded(columnWidth: number | null, phone: boolean): boolean {
  return phone || (columnWidth !== null && columnWidth > 0 && columnWidth <= THREAD_FOLD_PX)
}

/**
 * A short window (v2.6474): a laptop's screen gives the thread about 700 px of height, and the header, the sort card and
 * the reply box took all but a hundred of it. Under this height the window takes its whole height, and the parts a slot
 * draws read `short` from the open thread to fold themselves to one row. The header folded here too until v2.6505,
 * which made it the same compact shape at every height (`threadHeader.ts`).
 */
export const THREAD_SHORT_PX = 820

/** The media query for a window shorter than `THREAD_SHORT_PX`. */
export const THREAD_SHORT_QUERY = `(max-height: ${THREAD_SHORT_PX - 0.02}px)`

/** The window folds by height: shorter than 820 px, and never on a phone, whose sheet keeps its own fold (cut 10). */
export function isThreadShort(shortScreen: boolean, phone: boolean): boolean {
  return shortScreen && !phone
}

/**
 * The thread column's width from which the sort card sits beside the lines (v2.6478, the owner's B): the card takes a
 * column at the right, whole, and the lines keep the full height. Since v2.6482 at any height, since a tall window with
 * the card over the lines squeezed them to their floor just the same (1440×900 and 1920×1080, live).
 */
export const THREAD_BESIDE_PX = 900

/** The sort card goes beside the lines: a thread column of 900 px or wider, at a desk. Unmeasured reads narrow. */
export function isThreadBeside(columnWidth: number | null, phone: boolean): boolean {
  return !phone && columnWidth !== null && columnWidth >= THREAD_BESIDE_PX
}

/**
 * What folds to one row (v2.6482): the sort card wherever it sits over the lines, since there it takes the room the
 * lines need on any screen; the reply box on a short window and on a phone, where its four rows are a third of the
 * screen. A tall desk keeps the whole box.
 */
export function threadFolds(f: { short: boolean; phone: boolean; beside: boolean }): { card: boolean; box: boolean } {
  return { card: !f.beside, box: f.short || f.phone }
}
