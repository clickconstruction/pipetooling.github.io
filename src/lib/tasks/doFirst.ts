/**
 * Do first (punch list #369, step D1): the person lifts one task into Next. The page's own order is today's open
 * tasks, then a task sent back, then the oldest. That is the office's order, and the person holding the list may know
 * better this morning.
 *
 * Kept on the device, one key per account, as Task Mode's own toggle is (`taskModeToggle.ts`): it is how this person
 * reads their list here, not a fact about the task. Nobody else sees it and nothing is saved to the task. A task that
 * is finished, stuck or gone is passed over, so a stale pick never hides the real Next.
 */

const PREFIX = 'task_do_first'

export function doFirstStorageKey(userId: string): string {
  return `${PREFIX}_${userId}`
}

export function readDoFirst(userId: string | null | undefined): string | null {
  if (!userId) return null
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage.getItem(doFirstStorageKey(userId)) || null
  } catch {
    return null
  }
}

/** Set the task to do first, or clear it with null. */
export function writeDoFirst(userId: string | null | undefined, instanceId: string | null): void {
  if (!userId) return
  try {
    if (typeof localStorage === 'undefined') return
    if (instanceId) localStorage.setItem(doFirstStorageKey(userId), instanceId)
    else localStorage.removeItem(doFirstStorageKey(userId))
  } catch {
    // The pick still holds for this visit, in the page's own state.
  }
}

/** The picked task when it can still be Next: on one of the lists, and one of the tasks that may be Next. */
export function doFirstId(pickedId: string | null, mayBeNext: ReadonlyArray<{ id: string }>): string | null {
  return pickedId && mayBeNext.some((r) => r.id === pickedId) ? pickedId : null
}

export const DO_FIRST_LABEL = 'Do first'
export const DO_FIRST_WORDS = 'Lift it into Next on this device.'
export const DO_FIRST_OFF_LABEL = 'Stop doing it first'
export const DO_FIRST_OFF_WORDS = 'Give Next back to the list’s own order.'
/** The quiet word the Next card wears when the person picked it. */
export const DO_FIRST_MARK = 'You picked this to do first.'
