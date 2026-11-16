import { describe, expect, it } from 'vitest'
import { LIEN_FOOT_MENU_EDGE_PX, lienFootMenuBounds, lienFootMenuPlace, type LienFootMenuBox } from './lienFootMenuPlace'

const box = (left: number, top: number, right: number, bottom: number): LienFootMenuBox => ({ left, top, right, bottom })
const SCREEN = box(0, 0, 1440, 900)
/** The paper's pane on By paper at 1440 px, as measured on 2026-11-15: it cuts what leaves it. */
const PANE = box(344, 141, 1416, 892)
const MENU = { width: 260, height: 200 }

describe('lienFootMenuBounds · what can show the menu', () => {
  it('is the screen cut down by every box around the menu that cuts its contents', () => {
    expect(lienFootMenuBounds(SCREEN, [])).toEqual(SCREEN)
    expect(lienFootMenuBounds(SCREEN, [PANE, box(24, 69, 1416, 892)])).toEqual(PANE)
    // A box that runs off the screen is cut by the screen.
    expect(lienFootMenuBounds(box(0, 0, 375, 812), [box(-40, 100, 600, 1400)])).toEqual(box(0, 100, 375, 812))
  })
})

describe('lienFootMenuPlace · the menu stays inside what can show it (v2.7421)', () => {
  it('Taunya’s find: the first press of the footer opens its menu flush with its own left edge, not 100 px out of the pane', () => {
    // *He already okayed it ▾* at 1440 px: 160 px wide, 36 px inside the pane. Pinned to its right edge the menu started at 280, 64 px left of the pane.
    const press = box(380, 841, 540, 870)
    const place = lienFootMenuPlace({ press, menu: MENU, bounds: lienFootMenuBounds(SCREEN, [PANE]) })
    expect(place).toEqual({ left: 0, up: true })
    expect(press.left + place.left).toBeGreaterThanOrEqual(PANE.left + LIEN_FOOT_MENU_EDGE_PX)
  })

  it('a press at the right end of the footer pulls its menu back inside', () => {
    const press = box(1250, 841, 1400, 870)
    const place = lienFootMenuPlace({ press, menu: MENU, bounds: PANE })
    // The menu ends 8 px inside the pane's right edge.
    expect(press.left + place.left + MENU.width).toBe(PANE.right - LIEN_FOOT_MENU_EDGE_PX)
    expect(place.left).toBe(-102)
  })

  it('a press that starts outside what shows it brings its menu in to the edge', () => {
    expect(lienFootMenuPlace({ press: box(340, 841, 500, 870), menu: MENU, bounds: PANE }).left).toBe(12)
  })

  it('on a phone a menu as wide as the screen allows keeps both edges in view; one wider than its box keeps its left edge', () => {
    const phone = box(0, 0, 375, 812)
    const press = box(180, 700, 340, 736)
    const place = lienFootMenuPlace({ press, menu: { width: 343, height: 200 }, bounds: phone })
    expect([press.left + place.left, press.left + place.left + 343]).toEqual([24, 367])
    expect(lienFootMenuPlace({ press, menu: { width: 400, height: 200 }, bounds: phone }).left).toBe(LIEN_FOOT_MENU_EDGE_PX - press.left)
  })

  it('opens over its press; under it only when it does not fit over and there is more room under', () => {
    expect(lienFootMenuPlace({ press: box(380, 841, 540, 870), menu: MENU, bounds: PANE }).up).toBe(true)
    // A footer near the top of its pane: 100 px over, 600 under.
    expect(lienFootMenuPlace({ press: box(380, 241, 540, 270), menu: MENU, bounds: PANE }).up).toBe(false)
    // It fits neither way: the side with more room.
    expect(lienFootMenuPlace({ press: box(380, 300, 540, 330), menu: { width: 260, height: 700 }, bounds: box(344, 141, 1416, 500) }).up).toBe(false)
    expect(lienFootMenuPlace({ press: box(380, 400, 540, 430), menu: { width: 260, height: 700 }, bounds: box(344, 141, 1416, 500) }).up).toBe(true)
  })

  it('with nothing measured, as before the page is laid out, it stays at its press', () => {
    const zero = box(0, 0, 0, 0)
    expect(lienFootMenuPlace({ press: zero, menu: { width: 0, height: 0 }, bounds: box(0, 0, 1024, 768) })).toEqual({ left: LIEN_FOOT_MENU_EDGE_PX, up: false })
  })
})
