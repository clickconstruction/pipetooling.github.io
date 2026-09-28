import { describe, expect, it } from 'vitest'
import { pageTabStyle } from '../pageTabStyle'
import { HIGHLIGHTED_TABS, SAFETY_ORANGE, bidsTabStyle, tabStyle } from './bidStyles'

const TABS = ['bid-board', 'counts', 'takeoffs', 'labor', 'pricing', 'cover-letter', 'submittals', 'rfi']

describe('Bids tab styles', () => {
  it('never set the background shorthand — it would reset the clip that keeps the pill slim', () => {
    for (const tab of TABS) {
      for (const active of [true, false]) {
        const style = bidsTabStyle(active, tab) as Record<string, unknown>
        expect('background' in style, `${tab} ${active ? 'open' : 'closed'}`).toBe(false)
        expect(style.backgroundClip).toBe('padding-box')
        expect(typeof style.backgroundColor).toBe('string')
      }
    }
    expect('background' in (tabStyle(true) as Record<string, unknown>)).toBe(false)
  })

  it('the three highlighted tabs fill orange when open and read orange when closed', () => {
    expect([...HIGHLIGHTED_TABS]).toEqual(['counts', 'pricing', 'cover-letter'])
    for (const tab of HIGHLIGHTED_TABS) {
      const open = bidsTabStyle(true, tab) as Record<string, unknown>
      expect(open.backgroundColor).toBe(SAFETY_ORANGE)
      expect(open.color).toBe('white')
      const closed = bidsTabStyle(false, tab) as Record<string, unknown>
      expect(closed.backgroundColor).toBe('transparent')
      expect(closed.color).toBe(SAFETY_ORANGE)
      expect(closed.fontWeight).toBe(600)
    }
  })

  it('every other tab is the plain Bids tab', () => {
    for (const tab of ['bid-board', 'takeoffs', 'labor', 'submittals']) {
      expect(bidsTabStyle(true, tab)).toEqual(tabStyle(true))
      expect(bidsTabStyle(false, tab)).toEqual(tabStyle(false))
    }
  })

  it('an open orange tab differs from an open blue one by its fill alone', () => {
    const { backgroundColor: orange, ...restOrange } = bidsTabStyle(true, 'pricing') as Record<string, unknown>
    const { backgroundColor: blue, ...restBlue } = tabStyle(true) as Record<string, unknown>
    expect(restOrange).toEqual(restBlue)
    expect(orange).not.toBe(blue)
  })

  it('the Bids tab is the page tab, narrower', () => {
    expect(tabStyle(true)).toEqual({ ...pageTabStyle(true), padding: '0.5rem 0.6rem', fontSize: '0.9375rem' })
  })
})
