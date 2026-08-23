// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { coversViewport, findBlockingOverlays, nearestFixedLayer, PAGE_SCROLL_ALLOW_ATTR, PAGE_SCROLL_ALLOW_VALUE } from './blockingOverlay'

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
