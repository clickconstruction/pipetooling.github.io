import { replyFootScroll } from '../../../lib/messages/threadWindowFrame'

/**
 * Brings the reply box's foot, the row with the send press, into the thread's column (finding 319). It acts only
 * where the column scrolls (a phone), only while the box holds the focus, and only by the px the foot is under. It
 * never scrolls up. Answers whether it moved the column.
 */
export function showReplyFoot(box: HTMLElement | null): boolean {
  const column = box?.closest<HTMLElement>('[data-thread-column]')
  if (!box || !column) return false
  if (!/auto|scroll/.test(getComputedStyle(column).overflowY)) return false
  if (!box.contains(document.activeElement)) return false
  const by = replyFootScroll(column.getBoundingClientRect().bottom, box.getBoundingClientRect().bottom)
  if (by === 0) return false
  column.scrollTop += by
  return true
}
