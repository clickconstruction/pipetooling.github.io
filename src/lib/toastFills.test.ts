import { describe, expect, it } from 'vitest'
import { contrastRatio } from './lens/lensAudit'
import { hexToRgba } from './lens/lensTokens'
import { TOAST_FILLS, TOAST_WORDS, type ToastKind } from './toastFills'

const WHITE = hexToRgba('#ffffff')
const under = (hex: string) => contrastRatio(WHITE, hexToRgba(hex))
const KINDS = Object.keys(TOAST_FILLS) as ToastKind[]

describe('a toast’s fills under its white words (finding 321)', () => {
  it('the words are white on every kind', () => {
    expect(TOAST_WORDS).toBe('white')
    expect(KINDS.sort()).toEqual(['error', 'info', 'success', 'warning'])
  })

  it.each(KINDS)('%s reads 4.5 to 1 or more, the floor for small words', (kind) => {
    expect(under(TOAST_FILLS[kind].bg)).toBeGreaterThanOrEqual(4.5)
  })

  it('the green and the blue are the fills the presses wear (v2.8364, v2.6218)', () => {
    expect(TOAST_FILLS.success.bg).toBe('#15803d')
    expect(TOAST_FILLS.info.bg).toBe('#2563eb')
  })

  it.each(KINDS)('%s’s edge is deeper than its fill, so the edge still shows', (kind) => {
    expect(under(TOAST_FILLS[kind].border)).toBeGreaterThan(under(TOAST_FILLS[kind].bg))
  })

  it('the four fills it replaced were all under the floor', () => {
    for (const old of ['#10b981', '#3b82f6', '#f59e0b', '#ef4444']) expect(under(old)).toBeLessThan(4.5)
  })
})
