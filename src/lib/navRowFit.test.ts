// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { NAV_ROW_ALL_ON_ROW, NAV_ROW_ICON_HOLD, NAV_ROW_MENU_ORDER, navRowFit, navRowNeeds, navRowPressGive, readNavRow, sameNavRowFit, type NavRowParts } from './navRowFit'

/**
 * The dev's row as measured on 2026-11-18 at 16 px a rem: the menu, home and search are 114 px; the right end is
 * 243 with the wrench (36 and its 8 px gap), the three coloured presses, the people press (36 and its 2 px gap)
 * and the gear. A phone's row is the window less 8 px of padding on each side.
 */
const DEV: NavRowParts = { left: 114, fixed: 243 - 44 - 38, wrench: 44, people: 38, customers: 0, gap: 8 }
/** An assistant's row holds the customers press too. */
const ASSISTANT: NavRowParts = { ...DEV, customers: 38 }
const row = (windowPx: number) => windowPx - 16

describe('navRowNeeds', () => {
  it('is the two ends and the gap between them', () => {
    expect(navRowNeeds(DEV)).toBe(365)
    expect(navRowNeeds(DEV, ['wrench'])).toBe(321)
    expect(navRowNeeds(DEV, ['wrench', 'people'])).toBe(283)
  })

  it('counts no gap beside an end that holds nothing', () => {
    expect(navRowNeeds({ left: 0, fixed: 100, wrench: 0, people: 0, customers: 0, gap: 8 })).toBe(100)
    expect(navRowNeeds({ left: 76, fixed: 0, wrench: 44, people: 0, customers: 0, gap: 8 }, ['wrench'])).toBe(76)
  })
})

describe('navRowFit', () => {
  it('keeps every press on the row where there is room', () => {
    expect(navRowFit(row(390), DEV)).toBe(NAV_ROW_ALL_ON_ROW)
    expect(navRowFit(row(430), DEV)).toEqual({ inMenu: [], tight: false })
    expect(navRowFit(1440, DEV)).toEqual({ inMenu: [], tight: false })
  })

  it('moves the wrench into the menu when the row would not fit', () => {
    // The owner's phone: 375 px, where the row needs 365 and has 359.
    expect(navRowFit(row(375), DEV)).toEqual({ inMenu: ['wrench'], tight: false })
    expect(navRowFit(row(360), DEV)).toEqual({ inMenu: ['wrench'], tight: false })
  })

  it('moves the people press too on a phone still too small', () => {
    expect(navRowFit(row(320), DEV)).toEqual({ inMenu: ['wrench', 'people'], tight: false })
  })

  it('moves the customers press last, for a row that holds one', () => {
    expect(navRowFit(row(430), ASSISTANT)).toEqual({ inMenu: [], tight: false })
    expect(navRowFit(row(390), ASSISTANT)).toEqual({ inMenu: ['wrench'], tight: false })
    expect(navRowFit(row(360), ASSISTANT)).toEqual({ inMenu: ['wrench', 'people'], tight: false })
    expect(navRowFit(row(320), ASSISTANT)).toEqual({ inMenu: ['wrench', 'people', 'customers'], tight: false })
  })

  it('moves a press only while the row does not fit, in the one order', () => {
    expect(NAV_ROW_MENU_ORDER).toEqual(['wrench', 'people', 'customers'])
    for (let w = 200; w <= 480; w += 1) {
      const fit = navRowFit(w, ASSISTANT)
      expect(fit.inMenu).toEqual(NAV_ROW_MENU_ORDER.slice(0, fit.inMenu.length))
      // The press before the last one moved had to go: with it back, the row is too long.
      if (fit.inMenu.length > 0) expect(navRowNeeds(ASSISTANT, fit.inMenu.slice(0, -1))).toBeGreaterThan(w)
      if (!fit.tight) expect(navRowNeeds(ASSISTANT, fit.inMenu)).toBeLessThanOrEqual(w)
    }
  })

  it('skips a press the person does not have', () => {
    // Fix Mode off: no wrench. The people press is the first to go.
    expect(navRowFit(row(320), { ...DEV, wrench: 0 })).toEqual({ inMenu: ['people'], tight: false })
    // An estimator has the customers press and no people press.
    expect(navRowFit(row(320), { ...ASSISTANT, people: 0 })).toEqual({ inMenu: ['wrench', 'customers'], tight: false })
  })

  it('closes the gaps when the row is too long with every press in the menu', () => {
    // Job Mode's call press on a leader's 320 px phone: 44 more at the right end.
    const leader: NavRowParts = { ...DEV, fixed: 161 + 44 }
    expect(navRowFit(row(320), leader)).toEqual({ inMenu: ['wrench', 'people'], tight: true })
    expect(navRowFit(row(360), leader)).toEqual({ inMenu: ['wrench', 'people'], tight: false })
    // A person with nothing to move still gets the closed gaps.
    expect(navRowFit(200, { left: 114, fixed: 161, wrench: 0, people: 0, customers: 0, gap: 8 })).toEqual({ inMenu: [], tight: true })
  })

  it('fits a row that needs exactly its width, a float hair over or not', () => {
    expect(navRowFit(365, DEV)).toEqual({ inMenu: [], tight: false })
    expect(navRowFit(365, { ...DEV, left: 114.004 })).toEqual({ inMenu: [], tight: false })
    expect(navRowFit(364.5, DEV)).toEqual({ inMenu: ['wrench'], tight: false })
  })
})

describe('sameNavRowFit', () => {
  it('compares the presses and the gaps', () => {
    expect(sameNavRowFit({ inMenu: ['wrench'], tight: false }, { inMenu: ['wrench'], tight: false })).toBe(true)
    expect(sameNavRowFit({ inMenu: ['wrench'], tight: false }, { inMenu: ['wrench', 'people'], tight: false })).toBe(false)
    expect(sameNavRowFit({ inMenu: ['wrench'], tight: false }, { inMenu: ['wrench'], tight: true })).toBe(false)
    expect(sameNavRowFit(NAV_ROW_ALL_ON_ROW, { inMenu: [], tight: false })).toBe(true)
  })
})

/** jsdom lays nothing out, so each element's width is written on it and read back by a stubbed rect. */
function widths(el: Element, px: number): void {
  el.getBoundingClientRect = () => ({ width: px, height: 36, top: 0, left: 0, right: px, bottom: 36, x: 0, y: 0, toJSON: () => ({}) })
}

function buildRow(o: { windowPx: number; wrench?: boolean; people?: boolean; customers?: boolean; label?: { full: number; shown: number } }): HTMLElement {
  document.body.innerHTML = `
    <nav style="padding: 12px 8px">
      <div data-nav-row-left></div>
      <span data-nav-row-right>
        ${o.wrench ? '<span data-nav-row-press="wrench"></span>' : ''}
        <button id="a"></button><button id="b"></button><button id="c"></button>
        <span id="cluster">
          ${o.customers ? '<a data-nav-row-press="customers"></a>' : ''}
          ${o.people ? '<a data-nav-row-press="people"></a>' : ''}
          <div id="gear"></div>
        </span>
        ${o.label ? '<button data-nav-row-squeeze style="max-width: 136px; border: 1px solid"></button>' : ''}
      </span>
    </nav>`
  const nav = document.querySelector('nav') as HTMLElement
  const q = (sel: string) => nav.querySelector(sel)
  widths(nav, o.windowPx)
  widths(q('[data-nav-row-left]')!, 114)
  if (o.wrench) widths(q('[data-nav-row-press="wrench"]')!, 36)
  for (const id of ['a', 'b', 'c']) widths(q(`#${id}`)!, 35)
  let cluster = 36
  if (o.customers) {
    widths(q('[data-nav-row-press="customers"]')!, 36)
    cluster += 38
  }
  if (o.people) {
    widths(q('[data-nav-row-press="people"]')!, 36)
    cluster += 38
  }
  widths(q('#cluster')!, cluster)
  if (o.label) {
    const label = q('[data-nav-row-squeeze]')!
    widths(label, o.label.shown)
    Object.defineProperty(label, 'scrollWidth', { value: o.label.full - 2, configurable: true })
  }
  return nav
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('readNavRow', () => {
  const ALL = { wrench: true, people: true, customers: true }

  it('is null while the row has no width', () => {
    const nav = buildRow({ windowPx: 375, wrench: true, people: true })
    widths(nav, 0)
    expect(readNavRow(nav, ALL)).toBeNull()
  })

  it('reads the row as drawn: its width less the padding, and each part with its gap', () => {
    const nav = buildRow({ windowPx: 375, wrench: true, people: true })
    const read = readNavRow(nav, { wrench: true, people: true, customers: false })
    // Three coloured presses of 35 and the gear's 36, with three 8 px gaps between the four parts left.
    expect(read).toEqual({
      width: 359,
      parts: { left: 114, fixed: 35 * 3 + 36 + 8 * 3, wrench: 44, people: 38, customers: 0, gap: 8 },
      measured: { wrench: 44, people: 38 },
    })
    expect(navRowFit(read!.width, read!.parts)).toEqual({ inMenu: ['wrench'], tight: false })
  })

  it('answers the same with a press in the menu as with it on the row', () => {
    const before = readNavRow(buildRow({ windowPx: 375, wrench: true, people: true, customers: true }), ALL)!
    // The wrench and the people press have left the row: they are counted at the widths they had.
    const after = readNavRow(buildRow({ windowPx: 375, customers: true }), ALL, before.measured)!
    expect(after.parts).toEqual(before.parts)
    expect(after.measured).toEqual({ customers: 38 })
  })

  it('counts a press never measured as an icon press', () => {
    const read = readNavRow(buildRow({ windowPx: 320 }), { wrench: true, people: true, customers: false })!
    expect(read.parts).toMatchObject({ wrench: 36 + 8, people: 36 + 2, customers: 0 })
  })

  it('counts a press the person does not have as nothing, drawn or not', () => {
    const read = readNavRow(buildRow({ windowPx: 375, wrench: true }), { wrench: false, people: false, customers: false })!
    // A wrench the row may not move is a part that stays: Fix Mode's wrench with the dock up.
    expect(read.parts).toMatchObject({ wrench: 0, people: 0, customers: 0, fixed: 36 + 35 * 3 + 36 + 8 * 4 })
  })

  it('counts the way back from View as at its full width however short it is drawn', () => {
    const full = readNavRow(buildRow({ windowPx: 375, label: { full: 120, shown: 120 } }), { wrench: false, people: false, customers: false })!
    const short = readNavRow(buildRow({ windowPx: 375, label: { full: 120, shown: 61 } }), { wrench: false, people: false, customers: false })!
    expect(short.parts).toEqual(full.parts)
    expect(full.parts.fixed).toBe(35 * 3 + 36 + 120 + 8 * 4)
    // Never past its max-width, whatever its words would take.
    const long = readNavRow(buildRow({ windowPx: 375, label: { full: 300, shown: 136 } }), { wrench: false, people: false, customers: false })!
    expect(long.parts.fixed).toBe(35 * 3 + 36 + 136 + 8 * 4)
  })
})

describe('the header in index.css', () => {
  it('never wraps: the kernel moves a press, the row never breaks', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8')
    const rules = Array.from(css.matchAll(/\.appNav\s*\{([^}]*)\}/g)).map((m) => m[1] ?? '')
    expect(rules.length).toBeGreaterThanOrEqual(2)
    for (const body of rules) expect(body).not.toMatch(/flex-wrap:\s*wrap\b/)
    // The phone's rule says so outright, so a later sheet-wide default cannot bring the second line back.
    expect(rules.some((body) => /flex-wrap:\s*nowrap/.test(body))).toBe(true)
  })
})

describe('a tight row that is still too long (2026-11-19)', () => {
  /**
   * The dev's row on the Bids page, measured at 320 px: the left end 113.5, and at the right the three coloured
   * presses (33.5 each), the worded Bid press (53.3) and the gear (36), with four 8 px gaps between.
   */
  const BIDS_DEV: NavRowParts = { left: 113.5, fixed: 33.5 * 3 + 53.3 + 36 + 4 * 8, wrench: 44, people: 38, customers: 0, gap: 8 }
  const TIGHT_GAP = 2

  it('is tight on a 320 px phone, and with its gaps closed is still 9 px longer than the row', () => {
    expect(navRowFit(row(320), BIDS_DEV)).toEqual({ inMenu: ['wrench', 'people'], tight: true })
    const closed = 113.5 + TIGHT_GAP + 33.5 * 3 + 53.3 + 36 + 4 * TIGHT_GAP
    expect(closed - row(320)).toBeCloseTo(9.3, 1)
  })

  it('so the coloured presses of a tight row may shrink under their padding, and no other row’s may', () => {
    expect(navRowPressGive(true)).toEqual({ minWidth: 0 })
    // On a row that fits, a press that could shrink would be measured short and the fit would answer from that.
    expect(navRowPressGive(false)).toBeUndefined()
    expect(NAV_ROW_ICON_HOLD).toEqual({ flexShrink: 0 })
  })

  it('stays tight once the presses have given: the fit counts plain gaps, which the shrunk row cannot hold', () => {
    // After the give the four presses are 9.3 px narrower between them and the row exactly fills its 304 px.
    const given: NavRowParts = { ...BIDS_DEV, fixed: BIDS_DEV.fixed - 9.3 }
    expect(navRowFit(row(320), given)).toEqual({ inMenu: ['wrench', 'people'], tight: true })
  })

  it('the phone row’s five coloured presses carry the give, and their four icons hold their size', () => {
    const layout = readFileSync(resolve(__dirname, '../components/Layout.tsx'), 'utf8')
    const rightEnd = layout.slice(layout.indexOf('data-nav-row-right'), layout.indexOf('data-navtrack="icon-cluster"'))
    expect(rightEnd.match(/\.\.\.navRowPressGive\(navRow\.tight\)/g)).toHaveLength(5)
    expect(rightEnd.match(/style=\{NAV_ROW_ICON_HOLD\}/g)).toHaveLength(4)
    expect(rightEnd).toContain('title="New Bid"')
  })
})
