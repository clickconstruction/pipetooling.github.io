/** Stable droppable ids for Schedule Dispatch grid cells (person × day). */

export const SCHEDULE_DISPATCH_CELL_PREFIX = 'sd-cell:'

export function scheduleDispatchCellDroppableId(workDate: string, assigneeUserId: string): string {
  return `${SCHEDULE_DISPATCH_CELL_PREFIX}${workDate}:${assigneeUserId}`
}

export function parseScheduleDispatchCellDroppableId(
  id: unknown,
): { workDate: string; assigneeUserId: string } | null {
  if (typeof id !== 'string' || !id.startsWith(SCHEDULE_DISPATCH_CELL_PREFIX)) return null
  const rest = id.slice(SCHEDULE_DISPATCH_CELL_PREFIX.length)
  const colon = rest.indexOf(':')
  if (colon <= 0) return null
  const workDate = rest.slice(0, colon)
  const assigneeUserId = rest.slice(colon + 1)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate) || !assigneeUserId) return null
  return { workDate, assigneeUserId }
}
