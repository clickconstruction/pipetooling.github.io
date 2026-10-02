// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import {
  APP_BOTTOM_CHROME_ATTR,
  coversViewport,
  findBlockingOverlays,
  heightAboveBottomChrome,
  nearestFixedLayer,
  onScreen,
  PAGE_SCROLL_ALLOW_ATTR,
  PAGE_SCROLL_ALLOW_VALUE,
} from './blockingOverlay'

const VIEW = { width: 390, height: 844 }

describe('coversViewport', () => {
  it('a full backdrop counts; a toast, a bottom nav, or a small popover does not', () => {
    expect(coversViewport({ top: 0, left: 0, width: 390, height: 844 }, VIEW)).toBe(true)
    expect(coversViewport({ top: 780, left: 0, width: 390, height: 64 }, VIEW)).toBe(false) // bottom nav
    expect(coversViewport({ top: 40, left: 60, width: 300, height: 120 }, VIEW)).toBe(false) // popover
    expect(coversViewport({ top: 20, left: 0, width: 390, height: 824 }, VIEW)).toBe(true) // safe-area inset still ≥ 90%
  })
  it('degenerate inputs are never blocking', () => {
    expect(coversViewport({ top: 0, left: 0, width: 0, height: 0 }, VIEW)).toBe(false)
    expect(coversViewport({ top: 0, left: 0, width: 390, height: 844 }, { width: 0, height: 0 })).toBe(false)
  })
})

function el(tag: string, attrs: Record<string, string> = {}, rect?: { top: number; left: number; width: number; height: number }) {
  const e = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v)
  if (rect) e.getBoundingClientRect = () => ({ ...rect, right: rect.left + rect.width, bottom: rect.top + rect.height, x: rect.left, y: rect.top, toJSON: () => rect })
  return e
}
const FULL = { top: 0, left: 0, width: 390, height: 844 }
const win = () => ({ innerWidth: 390, innerHeight: 844, getComputedStyle: (e: Element) => window.getComputedStyle(e) })

afterEach(() => {
  document.body.innerHTML = ''
})

describe('findBlockingOverlays', () => {
  it('finds an inline-styled fixed backdrop with no role at all', () => {
    const backdrop = el('div', { style: 'position: fixed; inset: 0px; background: rgba(0,0,0,0.4)' }, FULL)
    backdrop.appendChild(el('div', {}, { top: 100, left: 20, width: 350, height: 400 }))
    document.body.appendChild(backdrop)
    expect(findBlockingOverlays(document, win())).toEqual([backdrop])
  })
  it('walks a role=dialog panel up to its fixed backdrop and counts the backdrop once', () => {
    const backdrop = el('div', { style: 'position: fixed; inset: 0px' }, FULL)
    const panel = el('div', { role: 'dialog', 'aria-modal': 'true' }, { top: 100, left: 20, width: 350, height: 400 })
    backdrop.appendChild(panel)
    document.body.appendChild(backdrop)
    expect(findBlockingOverlays(document, win())).toEqual([backdrop])
  })
  it('ignores small fixed things (toast, nav) and in-page role=dialog regions', () => {
    document.body.appendChild(el('div', { style: 'position: fixed; bottom: 0px; left: 0px; right: 0px; height: 64px' }, { top: 780, left: 0, width: 390, height: 64 }))
    document.body.appendChild(el('section', { role: 'dialog' }, { top: 200, left: 0, width: 390, height: 300 })) // static region, not fixed
    expect(findBlockingOverlays(document, win())).toEqual([])
  })
  it('respects the data-page-scroll="allow" opt-out on the overlay or an ancestor', () => {
    const backdrop = el('div', { style: 'position: fixed; inset: 0px', [PAGE_SCROLL_ALLOW_ATTR]: PAGE_SCROLL_ALLOW_VALUE }, FULL)
    backdrop.appendChild(el('div', { role: 'dialog' }, { top: 100, left: 20, width: 350, height: 400 }))
    document.body.appendChild(backdrop)
    expect(findBlockingOverlays(document, win())).toEqual([])
  })
  it('skips hidden overlays', () => {
    const backdrop = el('div', { style: 'position: fixed; inset: 0px; display: none' }, FULL)
    document.body.appendChild(backdrop)
    expect(findBlockingOverlays(document, win())).toEqual([])
  })
  it('never treats the locked <body> itself as an overlay (the lock must not sustain itself)', () => {
    document.body.setAttribute('style', 'overflow: hidden; position: fixed; top: -429px; left: 0px; right: 0px;')
    document.body.getBoundingClientRect = () => ({ top: -429, left: 0, width: 390, height: 2894, right: 390, bottom: 2465, x: 0, y: -429, toJSON: () => ({}) })
    expect(findBlockingOverlays(document, win())).toEqual([])
    document.body.removeAttribute('style')
  })
  it('nearestFixedLayer returns null outside any fixed ancestor', () => {
    const plain = el('div')
    document.body.appendChild(plain)
    expect(nearestFixedLayer(plain, (e) => window.getComputedStyle(e))).toBeNull()
  })
})

describe('onScreen / heightAboveBottomChrome', () => {
  it('a rect counts as on screen when any part of it is inside the viewport', () => {
    expect(onScreen({ top: 500, left: 0, width: 390, height: 300 }, VIEW)).toBe(true)
    expect(onScreen({ top: 0, left: 390, width: 320, height: 844 }, VIEW)).toBe(false) // a drawer slid off to the right
    expect(onScreen({ top: 0, left: 0, width: 0, height: 0 }, VIEW)).toBe(false)
  })
  it('the screen above the bar ends at the bar; no bar, a hidden bar or one off screen leaves the whole viewport', () => {
    expect(heightAboveBottomChrome({ top: 750, left: 0, width: 390, height: 94 }, VIEW)).toBe(750)
    expect(heightAboveBottomChrome(null, VIEW)).toBe(844)
    expect(heightAboveBottomChrome({ top: 0, left: 0, width: 0, height: 0 }, VIEW)).toBe(844)
    expect(heightAboveBottomChrome({ top: 900, left: 0, width: 390, height: 94 }, VIEW)).toBe(844)
  })
})

describe('findBlockingOverlays: a window that stops above the bottom bar', () => {
  // An iPhone home-screen app, 393 x 852: the Dispatch Mode bar is 60 + 34 (home indicator) = 94,
  // so a window with `bottom: var(--app-bottom-chrome)` is 758 tall — 89% of the screen.
  const PHONE = { innerWidth: 393, innerHeight: 852, getComputedStyle: (e: Element) => window.getComputedStyle(e) }
  const ABOVE_BAR = { top: 0, left: 0, width: 393, height: 758 }
  const bar = () => el('nav', { style: 'position: fixed; left: 0px; right: 0px; bottom: 0px', [APP_BOTTOM_CHROME_ATTR]: '' }, { top: 758, left: 0, width: 393, height: 94 })

  it('a declared modal panel blocks at 89% of the screen (the Lien desk on an iPhone)', () => {
    const overlay = el('div', { style: 'position: fixed; top: 0px; left: 0px; right: 0px' }, ABOVE_BAR)
    overlay.appendChild(el('div', { role: 'dialog', 'aria-modal': 'true' }, { top: 16, left: 16, width: 361, height: 726 }))
    document.body.appendChild(overlay)
    expect(findBlockingOverlays(document, PHONE)).toEqual([overlay])
  })
  it('an unlabelled layer that fills the screen above the bar blocks too, measured against that screen', () => {
    const overlay = el('div', { style: 'position: fixed; top: 0px; left: 0px; right: 0px' }, ABOVE_BAR)
    document.body.appendChild(overlay)
    // Without the bar in the page the same layer is 89% of the viewport: not a window.
    expect(findBlockingOverlays(document, PHONE)).toEqual([])
    document.body.appendChild(bar())
    expect(findBlockingOverlays(document, PHONE)).toEqual([overlay])
  })
  it('the bar itself never blocks', () => {
    document.body.appendChild(bar())
    expect(findBlockingOverlays(document, PHONE)).toEqual([])
  })
})

describe('findBlockingOverlays: declared modals', () => {
  it('a bottom sheet with no backdrop blocks when its panel says aria-modal', () => {
    const sheet = el('div', { style: 'position: fixed; left: 0px; right: 0px; bottom: 0px', role: 'dialog', 'aria-modal': 'true' }, { top: 500, left: 0, width: 390, height: 344 })
    document.body.appendChild(sheet)
    expect(findBlockingOverlays(document, win())).toEqual([sheet])
  })
  it('a small fixed role=dialog WITHOUT aria-modal (a popover) still does not block', () => {
    document.body.appendChild(el('div', { style: 'position: fixed; top: 40px; left: 60px', role: 'dialog' }, { top: 40, left: 60, width: 300, height: 120 }))
    expect(findBlockingOverlays(document, win())).toEqual([])
  })
  it('a declared modal kept mounted but out of sight never freezes the page', () => {
    const offScreen = el('div', { style: 'position: fixed; top: 0px', role: 'dialog', 'aria-modal': 'true' }, { top: 0, left: 390, width: 320, height: 844 })
    const transparent = el('div', { style: 'position: fixed; inset: 0px; opacity: 0', role: 'dialog', 'aria-modal': 'true' }, FULL)
    const unrendered = el('div', { style: 'position: fixed; inset: 0px' }, { top: 0, left: 0, width: 300, height: 300 })
    unrendered.appendChild(el('div', { role: 'dialog', 'aria-modal': 'true' }, { top: 0, left: 0, width: 0, height: 0 }))
    document.body.append(offScreen, transparent, unrendered)
    expect(findBlockingOverlays(document, win())).toEqual([])
  })
  it('the opt-out still wins over a declared modal', () => {
    const overlay = el('div', { style: 'position: fixed; inset: 0px', [PAGE_SCROLL_ALLOW_ATTR]: PAGE_SCROLL_ALLOW_VALUE }, FULL)
    overlay.appendChild(el('div', { role: 'dialog', 'aria-modal': 'true' }, { top: 100, left: 20, width: 350, height: 400 }))
    document.body.appendChild(overlay)
    expect(findBlockingOverlays(document, win())).toEqual([])
  })
  it('counts a layer once when it holds both an unlabelled and a declared candidate', () => {
    const overlay = el('div', { style: 'position: fixed; top: 0px; left: 0px; right: 0px' }, { top: 0, left: 0, width: 390, height: 700 })
    overlay.appendChild(el('div', { role: 'dialog' }, { top: 10, left: 10, width: 100, height: 100 }))
    overlay.appendChild(el('div', { role: 'dialog', 'aria-modal': 'true' }, { top: 120, left: 10, width: 300, height: 400 }))
    document.body.appendChild(overlay)
    expect(findBlockingOverlays(document, win())).toEqual([overlay])
  })
})
