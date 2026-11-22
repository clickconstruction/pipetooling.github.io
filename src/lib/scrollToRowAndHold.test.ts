// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HOLD_EVERY_MS, HOLD_RESTS, holdStep, rowInView, scrollToRowAndHold } from './scrollToRowAndHold'

describe('holdStep, the rule (v2.8259)', () => {
  const still = { viewportH: 700, moved: false }

  it('waits while the row is still moving, wherever it is', () => {
    expect(holdStep({ rowTop: 16000, rowBottom: 16100, viewportH: 700, moved: true })).toBe('wait')
    expect(holdStep({ rowTop: 300, rowBottom: 400, viewportH: 700, moved: true })).toBe('wait')
  })

  it('scrolls again when the row came to rest below or above the view', () => {
    expect(holdStep({ ...still, rowTop: 2241, rowBottom: 2341 })).toBe('scroll')
    expect(holdStep({ ...still, rowTop: -400, rowBottom: -300 })).toBe('scroll')
  })

  it('scrolls again for a row cut by the edge of the view', () => {
    expect(holdStep({ ...still, rowTop: 650, rowBottom: 750 })).toBe('scroll')
    expect(holdStep({ ...still, rowTop: -20, rowBottom: 80 })).toBe('scroll')
  })

  it('rests once the row is at rest and all of it shows', () => {
    expect(holdStep({ ...still, rowTop: 300, rowBottom: 400 })).toBe('rest')
    expect(holdStep({ ...still, rowTop: 0, rowBottom: 700 })).toBe('rest')
  })

  it('takes a row taller than the view by its middle', () => {
    expect(rowInView({ rowTop: -200, rowBottom: 900, viewportH: 700 })).toBe(true)
    expect(rowInView({ rowTop: 600, rowBottom: 1700, viewportH: 700 })).toBe(false)
  })
})

/** A row whose place on the page the test moves. `scrollIntoView` records the call and centres the row. */
function fakeRow(startTop: number, height = 100) {
  const calls: string[] = []
  const row = {
    top: startTop,
    calls,
    el: null as unknown as HTMLElement,
  }
  row.el = {
    getBoundingClientRect: () => ({ top: row.top, bottom: row.top + height, height }),
    scrollIntoView: (o: { behavior?: string }) => {
      calls.push(o.behavior ?? '')
      row.top = Math.round((window.innerHeight - height) / 2)
    },
  } as unknown as HTMLElement
  return row
}

describe('scrollToRowAndHold, the clock (v2.8259)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('waits for a row that is not drawn yet, then scrolls to it', () => {
    const row = fakeRow(16600)
    let drawn = false
    scrollToRowAndHold(() => (drawn ? row.el : null))
    vi.advanceTimersByTime(HOLD_EVERY_MS * 4)
    expect(row.calls).toHaveLength(0)
    drawn = true
    vi.advanceTimersByTime(HOLD_EVERY_MS)
    expect(row.calls).toHaveLength(1)
  })

  it('scrolls again, at once, when the page grew above the row and pushed it out of view', () => {
    const row = fakeRow(16600)
    const onRest = vi.fn()
    scrollToRowAndHold(() => row.el, { onRest })
    vi.advanceTimersByTime(HOLD_EVERY_MS)
    expect(row.calls).toHaveLength(1)
    // The list above loads and the row is pushed down.
    row.top = 2241
    vi.advanceTimersByTime(HOLD_EVERY_MS)
    // It moved since the last look, so this look waits.
    expect(row.calls).toHaveLength(1)
    vi.advanceTimersByTime(HOLD_EVERY_MS)
    expect(row.calls).toEqual([expect.any(String), 'auto'])
    expect(onRest).not.toHaveBeenCalled()
    vi.advanceTimersByTime(HOLD_EVERY_MS * HOLD_RESTS)
    expect(onRest).toHaveBeenCalledTimes(1)
    // Let go: a later push is the reader's page, not ours.
    row.top = 5000
    vi.advanceTimersByTime(HOLD_EVERY_MS * 10)
    expect(row.calls).toHaveLength(2)
  })

  it('lets go the moment the reader scrolls, and does not call onRest', () => {
    const row = fakeRow(16600)
    const onRest = vi.fn()
    scrollToRowAndHold(() => row.el, { onRest })
    vi.advanceTimersByTime(HOLD_EVERY_MS)
    window.dispatchEvent(new Event('wheel'))
    row.top = 3000
    vi.advanceTimersByTime(HOLD_EVERY_MS * 10)
    expect(row.calls).toHaveLength(1)
    expect(onRest).not.toHaveBeenCalled()
  })

  it('gives up when the time is up, and the cancel stops it early', () => {
    const row = fakeRow(16600)
    let drawn = false
    scrollToRowAndHold(() => (drawn ? row.el : null), { forMs: HOLD_EVERY_MS * 5 })
    vi.advanceTimersByTime(HOLD_EVERY_MS * 6)
    drawn = true
    vi.advanceTimersByTime(HOLD_EVERY_MS * 5)
    expect(row.calls).toHaveLength(0)

    const other = fakeRow(900)
    const cancel = scrollToRowAndHold(() => other.el)
    cancel()
    vi.advanceTimersByTime(HOLD_EVERY_MS * 5)
    expect(other.calls).toHaveLength(0)
  })
})
