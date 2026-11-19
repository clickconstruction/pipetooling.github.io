import { describe, expect, it } from 'vitest'
import { scrollLeftToShow } from './scrollLeftToShow'

/** The Prospects pills on a 375 px phone, as measured on 2026-11-18: 538 px of pills in a 222 px scroller. */
const PHONE = { viewWidth: 222, contentWidth: 538 }
const PERMITS = { itemLeft: 437, itemWidth: 101 }
const SUBS = { itemLeft: 266, itemWidth: 76 }
const CUSTOMERS = { itemLeft: 0, itemWidth: 124 }

describe('scrollLeftToShow', () => {
  it('brings the last pill in from past the right edge, and stops at the end', () => {
    expect(scrollLeftToShow({ ...PHONE, ...PERMITS, scrollLeft: 0, peek: 24 })).toBe(316)
  })

  it('brings a middle pill in with a peek of the next one', () => {
    // Subs ends at 342. With 24 px of Hiring showing, the view ends at 366.
    expect(scrollLeftToShow({ ...PHONE, ...SUBS, scrollLeft: 0, peek: 24 })).toBe(144)
  })

  it('comes back for a pill left of the view, with a peek of the one before it', () => {
    expect(scrollLeftToShow({ ...PHONE, ...SUBS, scrollLeft: 316, peek: 24 })).toBe(242)
  })

  it('leaves the scroller alone when the pill already reads whole', () => {
    expect(scrollLeftToShow({ ...PHONE, ...CUSTOMERS, scrollLeft: 0, peek: 24 })).toBe(0)
    expect(scrollLeftToShow({ ...PHONE, ...SUBS, scrollLeft: 200, peek: 24 })).toBe(200)
  })

  it('never passes the start or the end', () => {
    expect(scrollLeftToShow({ ...PHONE, ...CUSTOMERS, scrollLeft: 316, peek: 24 })).toBe(0)
    expect(scrollLeftToShow({ ...PHONE, ...PERMITS, scrollLeft: 0, peek: 500 })).toBe(316)
  })

  it('stays at zero when everything fits, as on a desk', () => {
    expect(scrollLeftToShow({ viewWidth: 900, contentWidth: 538, ...PERMITS, scrollLeft: 0, peek: 24 })).toBe(0)
  })

  it('gives up the peek when the view can only just hold the pill', () => {
    // 110 px of view and a 101 px pill leave 4.5 px a side.
    expect(scrollLeftToShow({ viewWidth: 110, contentWidth: 538, ...SUBS, itemWidth: 101, scrollLeft: 0, peek: 24 })).toBe(262)
  })

  it('shows the start of a pill wider than the view', () => {
    expect(scrollLeftToShow({ viewWidth: 80, contentWidth: 538, ...SUBS, itemWidth: 101, scrollLeft: 0, peek: 24 })).toBe(266)
  })

  it('holds its place while the scroller has no width, as in a hidden pane', () => {
    expect(scrollLeftToShow({ viewWidth: 0, contentWidth: 0, itemLeft: 0, itemWidth: 0, scrollLeft: 0 })).toBe(0)
  })
})
