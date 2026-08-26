import { describe, expect, it } from 'vitest'
import { buildProfitLegend, clampTooltipLeft, formatProfitShare } from './profitBarLegend'

const seg = (id: string, share: number) => ({ id, label: id.toUpperCase(), profit: share * 1000, share })

describe('buildProfitLegend', () => {
  it('keeps segment order and assigns matching color indexes', () => {
    const { chips, moreCount } = buildProfitLegend([seg('a', 0.5), seg('b', 0.3), seg('c', 0.2)])
    expect(chips.map((c) => c.id)).toEqual(['a', 'b', 'c'])
    expect(chips.map((c) => c.colorIndex)).toEqual([0, 1, 2])
    expect(moreCount).toBe(0)
  })

  it('collapses the tail past maxChips into moreCount', () => {
    const segments = Array.from({ length: 17 }, (_, i) => seg(`s${i}`, 1 / 17))
    const { chips, moreCount } = buildProfitLegend(segments, 12)
    expect(chips).toHaveLength(12)
    expect(moreCount).toBe(5)
  })

  it('handles fewer segments than maxChips and empty input', () => {
    expect(buildProfitLegend([], 12)).toEqual({ chips: [], moreCount: 0 })
    expect(buildProfitLegend([seg('a', 1)], 12).chips).toHaveLength(1)
  })
})

describe('formatProfitShare', () => {
  it('rounds whole percents', () => {
    expect(formatProfitShare(0.23)).toBe('23%')
    expect(formatProfitShare(0.965)).toBe('97%')
  })

  it('never shows 0% for a real sliver', () => {
    expect(formatProfitShare(0.004)).toBe('<1%')
    expect(formatProfitShare(0.0099)).toBe('<1%')
  })

  it('shows 0% only for a genuinely zero share', () => {
    expect(formatProfitShare(0)).toBe('0%')
  })
})

describe('clampTooltipLeft', () => {
  it('centers over the slice when there is room', () => {
    expect(clampTooltipLeft(500, 1000, 130)).toBe(500)
  })

  it('clamps at both edges', () => {
    expect(clampTooltipLeft(10, 1000, 130)).toBe(130)
    expect(clampTooltipLeft(990, 1000, 130)).toBe(870)
  })

  it('falls back to the bar center when the bar is narrower than the tooltip', () => {
    expect(clampTooltipLeft(10, 200, 130)).toBe(100)
  })
})
