import { describe, expect, it } from 'vitest'
import { LIEN_DO_NOW_MIN_LIST_PX, lienDoNowBarStuck, lienDoNowFrame, lienDoNowListRoom, lienDoNowListTop } from './lienDoNowFrame'

const scrolls = (v: unknown) => v === 'auto' || v === 'scroll'

describe('lienDoNowFrame', () => {
  it('a computer: the month and the find box stay put and the list scrolls under them', () => {
    const f = lienDoNowFrame(false)
    expect(f.mode).toBe('pinned')
    expect(f.frame.gridTemplateRows).toBe('auto auto minmax(0, 1fr)')
    expect(f.frame.overflow).toBe('hidden')
    expect(f.listScrolls).toBe(true)
  })

  it('a phone: the month, the find box and the list scroll as one page, so the rows are in reach', () => {
    const f = lienDoNowFrame(true)
    expect(f.mode).toBe('one-page')
    expect(f.frame.overflowY).toBe('auto')
    // No grid whose last row is "what is left": that row was 26 px tall under five stacked month cards.
    expect(f.frame.gridTemplateRows).toBeUndefined()
    expect(f.listScrolls).toBe(false)
  })

  it('exactly one thing scrolls in either mode', () => {
    for (const oneColumn of [true, false]) {
      const f = lienDoNowFrame(oneColumn)
      const frameScrolls = scrolls(f.frame.overflowY) || scrolls(f.frame.overflow)
      expect(frameScrolls).not.toBe(f.listScrolls)
    }
  })

  it('a phone never slides sideways', () => {
    expect(lienDoNowFrame(true).frame.overflowX).toBe('hidden')
  })
})

describe('lienDoNowListRoom', () => {
  it('is what the Board and the find box leave of the frame', () => {
    // Measured on 2026-11-15 at 1440 x 900: a 751 px frame, a 614 px Board, a 47 px find box.
    expect(lienDoNowListRoom({ frame: 751, board: 614, bar: 47 })).toBe(90)
    expect(lienDoNowListRoom({ frame: 1170, board: 560, bar: 47 })).toBe(563)
  })

  it('is zero, never negative, when the Board is taller than the frame', () => {
    expect(lienDoNowListRoom({ frame: 600, board: 646, bar: 47 })).toBe(0)
  })

  it('is unknown until the frame and the Board are measured; the find box may be missing', () => {
    expect(lienDoNowListRoom({ frame: null, board: 614, bar: 47 })).toBeNull()
    expect(lienDoNowListRoom({ frame: 751, board: 0, bar: 47 })).toBeNull()
    expect(lienDoNowListRoom({ frame: 751, board: 400, bar: null })).toBe(351)
  })
})

describe('lienDoNowFrame on a computer, by the room the Board leaves (v2.7367)', () => {
  it('a laptop, where the list would have 90 px: one page, the list not its own scroller', () => {
    const f = lienDoNowFrame(false, { frame: 751, board: 614, bar: 47 })
    expect(f.mode).toBe('one-page')
    expect(f.listScrolls).toBe(false)
    expect(f.frame.overflowY).toBe('auto')
  })

  it('a tall screen, where the picture and a working list fit together: the Board stays put', () => {
    const f = lienDoNowFrame(false, { frame: 1170, board: 560, bar: 47 })
    expect(f.mode).toBe('pinned')
    expect(f.listScrolls).toBe(true)
  })

  it('the line is the least a list can work in, and at the line it stays pinned', () => {
    expect(lienDoNowFrame(false, { frame: 600 + 47 + LIEN_DO_NOW_MIN_LIST_PX, board: 600, bar: 47 }).mode).toBe('pinned')
    expect(lienDoNowFrame(false, { frame: 600 + 47 + LIEN_DO_NOW_MIN_LIST_PX - 1, board: 600, bar: 47 }).mode).toBe('one-page')
  })

  it('nothing measured yet keeps the desk as it was, and a phone is one page whatever the room', () => {
    expect(lienDoNowFrame(false, null).mode).toBe('pinned')
    expect(lienDoNowFrame(false, { frame: null, board: null, bar: null }).mode).toBe('pinned')
    expect(lienDoNowFrame(true, { frame: 2000, board: 300, bar: 47 }).mode).toBe('one-page')
  })
})

describe('lienDoNowBarStuck', () => {
  it('is pinned once the page has moved and the bar has reached the top of the scroller', () => {
    expect(lienDoNowBarStuck({ barTop: 140, scrollerTop: 140, scrollTop: 620 })).toBe(true)
    expect(lienDoNowBarStuck({ barTop: 140.6, scrollerTop: 140, scrollTop: 620 })).toBe(true)
  })

  it('is not while the Board is still above it, or before anything has scrolled', () => {
    expect(lienDoNowBarStuck({ barTop: 420, scrollerTop: 140, scrollTop: 300 })).toBe(false)
    expect(lienDoNowBarStuck({ barTop: 140, scrollerTop: 140, scrollTop: 0 })).toBe(false)
  })
})

describe('lienDoNowListTop', () => {
  it('is where the Board ends inside the scroller, wherever the page stands now', () => {
    // At the top: the Board's bottom edge is 614 px under the scroller's top.
    expect(lienDoNowListTop({ boardBottom: 754, scrollerTop: 140, scrollTop: 0 })).toBe(614)
    // Deep in the list: the Board is far above the screen, and the answer is the same place.
    expect(lienDoNowListTop({ boardBottom: -446, scrollerTop: 140, scrollTop: 1200 })).toBe(614)
  })

  it('never asks for a place above the top', () => {
    expect(lienDoNowListTop({ boardBottom: 100, scrollerTop: 140, scrollTop: 0 })).toBe(0)
  })
})
