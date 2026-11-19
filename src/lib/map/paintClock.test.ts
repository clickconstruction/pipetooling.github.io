import { describe, expect, it } from 'vitest'
import { PAINT_POLL_MS, PAINT_TIMEOUT_MS, paintClockLook, type PaintClockLook, type PaintClockVerdict } from './paintClock'

/** Runs the looks in order, as the canvas does, and answers each verdict. It stops at a final one. */
function run(looks: PaintClockLook[]): PaintClockVerdict[] {
  const verdicts: PaintClockVerdict[] = []
  let waitedMs = 0
  for (const look of looks) {
    const step = paintClockLook(waitedMs, look)
    waitedMs = step.waitedMs
    verdicts.push(step.verdict)
    if (step.verdict !== 'waiting') break
  }
  return verdicts
}

/** The verdict `back` places from the end: 1 is the last. */
const fromEnd = (verdicts: PaintClockVerdict[], back: number): PaintClockVerdict | undefined => verdicts[verdicts.length - back]
const times = (n: number, look: PaintClockLook): PaintClockLook[] => Array.from({ length: n }, () => look)
const EMPTY_IN_VIEW: PaintClockLook = { painted: false, inView: true }
const EMPTY_OFF_SCREEN: PaintClockLook = { painted: false, inView: false }
const PAINTED: PaintClockLook = { painted: true, inView: true }
/** The looks eight seconds hold. */
const LOOKS = PAINT_TIMEOUT_MS / PAINT_POLL_MS

describe('paintClockLook', () => {
  it('eight seconds are sixteen looks', () => {
    expect(LOOKS).toBe(16)
  })

  it('a frame in the window that stays empty is given up at eight seconds, and not a look sooner', () => {
    const verdicts = run(times(LOOKS + 4, EMPTY_IN_VIEW))
    expect(verdicts).toHaveLength(LOOKS)
    expect(verdicts.slice(0, -1).every((v) => v === 'waiting')).toBe(true)
    expect(fromEnd(verdicts, 1)).toBe('never-painted')
  })

  it('a frame off screen is never given up, however long it waits', () => {
    const verdicts = run(times(LOOKS * 50, EMPTY_OFF_SCREEN))
    expect(verdicts).toHaveLength(LOOKS * 50)
    expect(new Set(verdicts)).toEqual(new Set(['waiting']))
  })

  it('counts nothing while the frame is off screen', () => {
    let step = paintClockLook(0, EMPTY_OFF_SCREEN)
    expect(step).toEqual({ waitedMs: 0, verdict: 'waiting' })
    step = paintClockLook(3500, EMPTY_OFF_SCREEN)
    expect(step).toEqual({ waitedMs: 3500, verdict: 'waiting' })
  })

  it('a frame that waited off screen gets its whole eight seconds once it is in the window', () => {
    const verdicts = run([...times(40, EMPTY_OFF_SCREEN), ...times(LOOKS, EMPTY_IN_VIEW)])
    expect(verdicts).toHaveLength(40 + LOOKS)
    expect(fromEnd(verdicts, 2)).toBe('waiting')
    expect(fromEnd(verdicts, 1)).toBe('never-painted')
  })

  it('a rejected key is still caught on a card the person scrolls past and back to: the time in the window adds up', () => {
    const verdicts = run([...times(10, EMPTY_IN_VIEW), ...times(30, EMPTY_OFF_SCREEN), ...times(LOOKS, EMPTY_IN_VIEW)])
    // Ten looks counted before it left, so six more are enough.
    expect(verdicts).toHaveLength(10 + 30 + 6)
    expect(fromEnd(verdicts, 1)).toBe('never-painted')
  })

  it('a map in the frame ends the wait, at the first look or the last', () => {
    expect(run([PAINTED])).toEqual(['painted'])
    const late = run([...times(LOOKS - 1, EMPTY_IN_VIEW), PAINTED])
    expect(late).toHaveLength(LOOKS)
    expect(fromEnd(late, 1)).toBe('painted')
  })

  it('a map that painted is a map, wherever the frame has gone since', () => {
    expect(paintClockLook(7500, { painted: true, inView: false })).toEqual({ waitedMs: 7500, verdict: 'painted' })
  })

  it('takes another pace and another limit', () => {
    expect(paintClockLook(0, EMPTY_IN_VIEW, 1000, 2000)).toEqual({ waitedMs: 1000, verdict: 'waiting' })
    expect(paintClockLook(1000, EMPTY_IN_VIEW, 1000, 2000)).toEqual({ waitedMs: 2000, verdict: 'never-painted' })
  })
})
