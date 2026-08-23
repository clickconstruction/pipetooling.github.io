/**
 * Canvas event helpers for the Roadmap Map (extracted from ChecklistTechTreeTab
 * in v2.2156). Pure: no React, no DOM queries — just shapes the event gives us.
 */

/** Client coordinates of a React Flow connect-end event (mouse or touch), or null when the event carries none. */
export function clientCoordsForConnectEnd(
  event: MouseEvent | TouchEvent,
): { x: number; y: number } | null {
  if (typeof TouchEvent !== 'undefined' && event instanceof TouchEvent) {
    if (event.touches.length > 0) {
      const t = event.touches[0]!
      return { x: t.clientX, y: t.clientY }
    }
    if (event.changedTouches.length > 0) {
      const t = event.changedTouches[0]!
      return { x: t.clientX, y: t.clientY }
    }
  }
  if ('clientX' in event && typeof (event as MouseEvent).clientX === 'number') {
    return { x: (event as MouseEvent).clientX, y: (event as MouseEvent).clientY }
  }
  return null
}

