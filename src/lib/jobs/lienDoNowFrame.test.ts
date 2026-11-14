import { describe, expect, it } from 'vitest'
import { lienDoNowFrame } from './lienDoNowFrame'

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
