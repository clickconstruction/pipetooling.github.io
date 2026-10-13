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
 * Their numbers and addresses under the company: open at a desk (v1.166), folded away on a narrow header so the lines
 * get the room. A press on the arrow decides from then on, either way.
 */
export function reachOpen(chosen: boolean | null, folded: boolean): boolean {
  return chosen ?? !folded
}
