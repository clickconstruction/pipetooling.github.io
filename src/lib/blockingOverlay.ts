/**
 * "Is a blocking overlay on screen?" — the question behind the app-wide body
 * scroll lock (v2.2186). A modal is anything that covers the viewport with a
 * `position: fixed` layer: the ~320 inline-styled backdrops, the portal'd
 * sheets, the confirm/prompt dialogs, the roadmap's CSS fullscreen. Instead of
 * asking every one of them to call a hook, one sentinel (BodyScrollLockSentinel)
 * watches the DOM and holds the reference-counted lock in `bodyScrollLock.ts`
 * while this predicate finds at least one.
 *
 * Opt-out: put `data-page-scroll="allow"` on the overlay (or any ancestor of
 * the candidate) and it is ignored — the "selectively change it back" valve.
 */

/** Attribute + value that exempts an overlay from the page scroll lock. */
export const PAGE_SCROLL_ALLOW_ATTR = 'data-page-scroll'
export const PAGE_SCROLL_ALLOW_VALUE = 'allow'
export const PAGE_SCROLL_ALLOW_SELECTOR = `[${PAGE_SCROLL_ALLOW_ATTR}="${PAGE_SCROLL_ALLOW_VALUE}"]`

/**
 * Cheap candidate query. React writes inline styles, so `[style*="position: fixed"]`
 * catches the bare backdrops that never got a role; the role/aria selectors catch
 * panels whose fixed backdrop is an ancestor; the classes are the few CSS-styled
 * overlays. The predicate then walks up to the nearest fixed layer and measures it.
 */
export const BLOCKING_OVERLAY_CANDIDATE_SELECTOR = [
  '[role="dialog"]',
  '[aria-modal="true"]',
  '[style*="position: fixed"]',
  '.respModalOverlay',
  '.roadmap-task-overlay',
  '.dispatch-po-overlay',
].join(', ')

export type RectLike = { top: number; left: number; width: number; height: number }
export type ViewportLike = { width: number; height: number }

/** True when the rect spans at least `minCoverage` of the viewport in both axes (a backdrop, not a toast or a bottom nav). */
export function coversViewport(rect: RectLike, viewport: ViewportLike, minCoverage = 0.9): boolean {
  if (viewport.width <= 0 || viewport.height <= 0) return false
  if (rect.width <= 0 || rect.height <= 0) return false
  const visibleW = Math.min(rect.left + rect.width, viewport.width) - Math.max(rect.left, 0)
  const visibleH = Math.min(rect.top + rect.height, viewport.height) - Math.max(rect.top, 0)
  return visibleW / viewport.width >= minCoverage && visibleH / viewport.height >= minCoverage
}

/**
 * The fixed layer a candidate lives in — itself or its nearest `position: fixed`
 * ancestor — or null when it isn't inside one (a role="dialog" that is a plain
 * in-page region, for instance).
 */
export function nearestFixedLayer(el: Element, getComputedStyle: (el: Element) => { position: string }): Element | null {
  let cur: Element | null = el
  // Stop before <body>/<html>: the lock itself pins the body with position: fixed,
  // and treating that as an overlay would make the lock self-sustaining.
  while (cur && cur !== cur.ownerDocument.documentElement && cur !== cur.ownerDocument.body) {
    if (getComputedStyle(cur).position === 'fixed') return cur
    cur = cur.parentElement
  }
  return null
}

/**
 * Distinct blocking overlays currently in the document: visible fixed layers that
 * cover the viewport and aren't exempted. Pure over the injected DOM readers so
 * it's testable with stubbed rects.
 */
export function findBlockingOverlays(
  doc: Document,
  win: { innerWidth: number; innerHeight: number; getComputedStyle: (el: Element) => CSSStyleDeclaration },
): Element[] {
  const viewport = { width: win.innerWidth, height: win.innerHeight }
  const found = new Set<Element>()
  const candidates = doc.querySelectorAll(BLOCKING_OVERLAY_CANDIDATE_SELECTOR)
  for (const cand of candidates) {
    if (cand === doc.body || cand === doc.documentElement) continue
    if (cand.closest(PAGE_SCROLL_ALLOW_SELECTOR)) continue
    const layer = nearestFixedLayer(cand, (el) => win.getComputedStyle(el))
    if (!layer || found.has(layer)) continue
    if (layer.closest(PAGE_SCROLL_ALLOW_SELECTOR)) continue
    const cs = win.getComputedStyle(layer)
    if (cs.display === 'none' || cs.visibility === 'hidden') continue
    if (!coversViewport(layer.getBoundingClientRect(), viewport)) continue
    found.add(layer)
  }
  return [...found]
}
