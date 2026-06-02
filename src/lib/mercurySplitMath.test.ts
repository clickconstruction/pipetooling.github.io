import { describe, it, expect } from 'vitest'
import {
  lineDisplayDollars,
  redistributeEqualSplit,
  round2,
  type SplitLine,
} from './mercurySplitMath'

function line(partial: Partial<SplitLine>): SplitLine {
  return { jobId: 'j', jobLabel: 'J', mode: 'dollars', valueStr: '', note: '', ...partial }
}

describe('lineDisplayDollars', () => {
  it('dollars mode returns the rounded value', () => {
    expect(lineDisplayDollars(line({ mode: 'dollars', valueStr: '40.275' }), 100)).toBe(40.28)
  })
  it('percent mode is a fraction of the display total', () => {
    expect(lineDisplayDollars(line({ mode: 'percent', valueStr: '25' }), 200)).toBe(50)
  })
  it('returns null for blank / negative / non-numeric', () => {
    expect(lineDisplayDollars(line({ valueStr: '' }), 100)).toBeNull()
    expect(lineDisplayDollars(line({ valueStr: '-5' }), 100)).toBeNull()
    expect(lineDisplayDollars(line({ valueStr: 'abc' }), 100)).toBeNull()
  })
  it('percent with non-positive total returns null', () => {
    expect(lineDisplayDollars(line({ mode: 'percent', valueStr: '50' }), 0)).toBeNull()
  })
})

describe('redistributeEqualSplit', () => {
  it('single line becomes 100%', () => {
    const out = redistributeEqualSplit([line({ jobId: 'a' })], 100)
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ mode: 'percent', valueStr: '100' })
  })

  it('two lines split evenly and sum to the total', () => {
    const out = redistributeEqualSplit([line({ jobId: 'a' }), line({ jobId: 'b' })], 100)
    const sum = round2(out.reduce((acc, ln) => acc + (lineDisplayDollars(ln, 100) ?? 0), 0))
    expect(sum).toBe(100)
  })

  it('closes cent drift on an odd total (3 ways over 100)', () => {
    const out = redistributeEqualSplit(
      [line({ jobId: 'a' }), line({ jobId: 'b' }), line({ jobId: 'c' })],
      100,
    )
    const sum = round2(out.reduce((acc, ln) => acc + (lineDisplayDollars(ln, 100) ?? 0), 0))
    expect(sum).toBe(100) // last line flips to dollars to absorb the rounding remainder
  })

  it('empty input returns empty; non-positive total left as-is', () => {
    expect(redistributeEqualSplit([], 100)).toEqual([])
    const ls = [line({ jobId: 'a' })]
    expect(redistributeEqualSplit(ls, 0)).toBe(ls)
  })
})
