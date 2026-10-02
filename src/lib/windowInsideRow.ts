/**
 * A window drawn inside a row is not the row (v2.4361). React bubbles events through the
 * component tree, through a portal too, so a row that reacts to a press also hears every press
 * made inside a window it draws. Half a second held still anywhere in a GC's notes marked the bid
 * behind it on the Bid Board (`bids/bidMarkHold.ts`), and the row then swallowed the click that
 * followed, so the notes' Save never ran. A 280 ms press in Cost this task lifted the Checklist
 * task behind it for dragging.
 *
 * v2.4352 and v2.4356 stop a window's backdrop click. A press is the row's to ignore instead:
 * stopping it in the window would also hide it from the document listeners that close a menu
 * on a press elsewhere (`SearchableSelect` and ~30 others), and every window drawn in such a row
 * would have to remember it.
 *
 * A press came from a window when its target is outside the row's own DOM (a portal) or a
 * `position: fixed` layer sits between the target and the row: the backdrop, and so everything
 * in its panel. `closest('[role=dialog]')` alone misses a press on the backdrop itself.
 */

type RowEvent = { target: EventTarget | null; currentTarget: EventTarget | null }

/** True when an event a row is handling started inside a window drawn in that row. */
export function startedInWindowInside(e: RowEvent): boolean {
  // Duck-typed, not `instanceof Element`: the node test environment has no DOM globals.
  const row = e.currentTarget as Element | null
  const target = e.target as Node | null
  if (!row || !target || typeof row.contains !== 'function') return false
  if (!row.contains(target)) return true
  const view = row.ownerDocument?.defaultView
  if (!view) return false
  for (let el = target.nodeType === 1 ? (target as Element) : target.parentElement; el && el !== row; el = el.parentElement) {
    if (view.getComputedStyle(el).position === 'fixed') return true
  }
  return false
}

/**
 * A handler map a row spreads (dnd-kit's `listeners`), each handler skipping an event that
 * started inside a window drawn in the row.
 */
export function ignoreWindowsInside<H extends Record<string, unknown>>(handlers: H | undefined): H | undefined {
  if (!handlers) return handlers
  const out: Record<string, unknown> = {}
  for (const [name, handler] of Object.entries(handlers)) {
    out[name] =
      typeof handler === 'function'
        ? (e: RowEvent, ...rest: unknown[]) => {
            if (!startedInWindowInside(e)) (handler as (...args: unknown[]) => unknown)(e, ...rest)
          }
        : handler
  }
  return out as H
}
