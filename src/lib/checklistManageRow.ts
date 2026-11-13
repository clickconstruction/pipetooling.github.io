/**
 * Two small rules of a row on Checklist → Manage (punch list #348, PR 1).
 */

export type RowMenuPlacement = {
  /** Px from the right edge of the screen: the menu's right edge sits under the press's. */
  right: number
  /** Px from the top of the screen when the menu opens downward. */
  top?: number
  /** Px from the bottom of the screen when the menu opens upward. */
  bottom?: number
  opensUp: boolean
}

/**
 * Where a row's ⋮ menu goes, in the screen's own px, for a menu drawn `position: fixed`.
 *
 * The menu used to hang inside its list, and the list clips at its rounded edge. On the last task, or the only
 * one a search found, a phone showed the top of *Edit* and no *Delete*. Drawn over the page, the menu opens under
 * its press when there is room, and above it when there is more room there.
 */
export function rowMenuPlacement(a: { anchorTop: number; anchorBottom: number; anchorRight: number; menuHeight: number; viewportWidth: number; viewportHeight: number; gap?: number }): RowMenuPlacement {
  const gap = a.gap ?? 4
  const right = Math.max(8, Math.round(a.viewportWidth - a.anchorRight))
  const below = a.viewportHeight - a.anchorBottom - gap
  const above = a.anchorTop - gap
  if (a.menuHeight <= below || below >= above) return { right, top: Math.round(a.anchorBottom + gap), opensUp: false }
  return { right, bottom: Math.round(a.viewportHeight - a.anchorTop + gap), opensUp: true }
}

/** One line of the ⋮ menu is about this tall: 0.6rem above and below a 0.875rem line. */
export const ROW_MENU_LINE_PX = 40

/**
 * Whether a row says *notifies on done*.
 *
 * Someone else told always counts. *Tell me* counts only when somebody other than the giver has the task: the
 * window hides that bell on a task that is only the giver's, but the stored tick stays on, and the row read it.
 */
export function showsNotifiesOnDone(item: { notifyCreator: boolean; notifyOtherUserId: string | null; creatorId: string | null; assigneeIds: readonly string[] }): boolean {
  if (item.notifyOtherUserId) return true
  if (!item.notifyCreator) return false
  if (item.assigneeIds.length === 0) return true
  return item.assigneeIds.some((id) => id !== item.creatorId)
}
