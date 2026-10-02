/**
 * "Is a blocking overlay on screen?" — the question behind the app-wide body
 * scroll lock (v2.2186). A modal is anything that covers the viewport with a
 * `position: fixed` layer: the ~320 inline-styled backdrops, the portal'd
 * sheets, the confirm/prompt dialogs, the roadmap's CSS fullscreen. Instead of
 * asking every one of them to call a hook, one sentinel (BodyScrollLockSentinel)
 * watches the DOM and holds the reference-counted lock in `bodyScrollLock.ts`
 * while this predicate finds at least one.
 *
 * Two ways a fixed layer counts:
 *  1. It says so. A visible `aria-modal="true"` panel on screen makes its layer
 *     blocking at ANY size. Size was the only test until a window that stops above
 *     the Dispatch / Job mode bar (the Lien desk) came to 89% of an iPhone's screen
 *     and the page behind it scrolled.
 *  2. It looks like one. A layer with no such panel still counts when it covers
 *     90% of the screen above the bottom bar (`APP_BOTTOM_CHROME_SELECTOR`).
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

/** The fixed bar windows stop above (the Dispatch / Job mode footer). The 90% rule measures the screen above it. */
export const APP_BOTTOM_CHROME_ATTR = 'data-app-bottom-chrome'
export const APP_BOTTOM_CHROME_SELECTOR = `[${APP_BOTTOM_CHROME_ATTR}]`
/** A panel that declares itself modal: its layer blocks whatever its size. */
export const DECLARED_MODAL_SELECTOR = '[aria-modal="true"]'

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

/** True when any part of the rect is inside the viewport (a drawer slid off screen is not). */
export function onScreen(rect: RectLike, viewport: ViewportLike): boolean {
  if (rect.width <= 0 || rect.height <= 0) return false
  const visibleW = Math.min(rect.left + rect.width, viewport.width) - Math.max(rect.left, 0)
  const visibleH = Math.min(rect.top + rect.height, viewport.height) - Math.max(rect.top, 0)
  return visibleW > 0 && visibleH > 0
}

/**
 * The height of the screen above the bottom bar: the bar's top edge when one is
 * drawn inside the viewport, else the whole viewport.
 */
export function heightAboveBottomChrome(chrome: RectLike | null, viewport: ViewportLike): number {
  if (!chrome || chrome.width <= 0 || chrome.height <= 0) return viewport.height
  if (chrome.top <= 0 || chrome.top >= viewport.height) return viewport.height
  return chrome.top
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

type StyleReader = (el: Element) => { display: string; visibility: string; opacity: string }

function isHidden(cs: { display: string; visibility: string; opacity: string }): boolean {
  return cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0'
}

/**
 * Distinct blocking overlays currently in the document: visible fixed layers that
 * aren't exempted and either hold a declared modal panel or cover the screen
 * above the bottom bar. Pure over the injected DOM readers so it's testable with
 * stubbed rects.
 */
export function findBlockingOverlays(
  doc: Document,
  win: { innerWidth: number; innerHeight: number; getComputedStyle: (el: Element) => CSSStyleDeclaration },
): Element[] {
  const viewport = { width: win.innerWidth, height: win.innerHeight }
  const read: StyleReader = (el) => win.getComputedStyle(el)
  // Each fixed layer once, with whether a visible declared modal panel sits in it.
  const layers = new Map<Element, boolean>()
  for (const cand of doc.querySelectorAll(BLOCKING_OVERLAY_CANDIDATE_SELECTOR)) {
    if (cand === doc.body || cand === doc.documentElement) continue
    if (cand.closest(PAGE_SCROLL_ALLOW_SELECTOR)) continue
    const layer = nearestFixedLayer(cand, (el) => win.getComputedStyle(el))
    if (!layer || layer.closest(PAGE_SCROLL_ALLOW_SELECTOR)) continue
    const declared =
      cand.matches(DECLARED_MODAL_SELECTOR) && !isHidden(read(cand)) && onScreen(cand.getBoundingClientRect(), viewport)
    layers.set(layer, declared || layers.get(layer) === true)
  }
  if (layers.size === 0) return []

  const chrome = doc.querySelector(APP_BOTTOM_CHROME_SELECTOR)
  const chromeRect = chrome && !isHidden(read(chrome)) ? chrome.getBoundingClientRect() : null
  const aboveChrome = { width: viewport.width, height: heightAboveBottomChrome(chromeRect, viewport) }

  const found: Element[] = []
  for (const [layer, declared] of layers) {
    if (isHidden(read(layer))) continue
    const rect = layer.getBoundingClientRect()
    if (declared ? onScreen(rect, viewport) : coversViewport(rect, aboveChrome)) found.push(layer)
  }
  return found
}
