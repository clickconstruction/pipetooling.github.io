import { describe, expect, it } from 'vitest'
import {
  buildProfitLegend,
  clampTooltipLeft,
  formatProfitShare,
  pinnedProfitSlice,
  profitBarDetailStats,
  profitConcentrationWarning,
  readProfitLegendCollapsed,
  writeProfitLegendCollapsed,
  type ProfitBarRow,
} from './profitBarLegend'

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

const barRow = (id: string, over: Partial<ProfitBarRow> = {}): ProfitBarRow => ({ id, count: 4, cost: 400, effUnit: 250, effRevenue: 1000, effMargin: 0.6, bookEntryName: null, ...over })
const money = (n: number) => n.toFixed(2)

describe('profitConcentrationWarning', () => {
  const conc = (top2Share: number | null, n = 3) => ({ top2Share, totalProfit: 1000, segments: ['wc', 'lav', 'sink'].slice(0, n).map((id) => seg(id, 0.3)) })

  it('warns past 60 % in the top two, naming them', () => {
    expect(profitConcentrationWarning(conc(0.72))).toBe('⚠ 72% of profit sits in WC + LAV — a VE cut there guts the job.')
  })

  it('stays quiet at exactly 60 %, under it, with no profit, or with a single slice', () => {
    expect(profitConcentrationWarning(conc(0.6))).toBeNull()
    expect(profitConcentrationWarning(conc(0.45))).toBeNull()
    expect(profitConcentrationWarning(conc(null))).toBeNull()
    expect(profitConcentrationWarning(conc(1, 1))).toBeNull()
  })
})

describe('pinnedProfitSlice', () => {
  const segments = [seg('c1', 0.7), seg('c2', 0.3)]
  const rows = [barRow('c1'), barRow('c2'), barRow('c3')]

  it('finds the pinned slice with its row and its place in the bar', () => {
    expect(pinnedProfitSlice(segments, rows, 'c2')).toEqual({ index: 1, segment: segments[1], row: rows[1] })
  })

  it('shows nothing with no pin, a pin whose row has no slice (no profit), or a slice whose row is gone', () => {
    expect(pinnedProfitSlice(segments, rows, null)).toBeNull()
    expect(pinnedProfitSlice(segments, rows, 'c3')).toBeNull()
    expect(pinnedProfitSlice(segments, [barRow('c2')], 'c1')).toBeNull()
  })
})

describe('profitBarDetailStats', () => {
  it('is eight cells; Profit and Margin take the margin’s colour', () => {
    const stats = profitBarDetailStats(barRow('c1'), seg('c1', 0.7), money)
    expect(stats.map((s) => [s.label, s.value])).toEqual([
      ['Qty', '4'],
      ['Unit cost', '$100.00'],
      ['Sale / unit', '$250.00'],
      ['Revenue', '$1000.00'],
      ['Cost', '$400.00'],
      ['Profit', '$700.00'],
      ['Margin', '60%'],
      ['Share of job profit', '70%'],
    ])
    expect(stats.filter((s) => s.byMargin).map((s) => s.label)).toEqual(['Profit', 'Margin'])
  })

  it('says so for a row with no cost, no price or no margin', () => {
    const stats = profitBarDetailStats(barRow('c1', { cost: 0, effUnit: null, effMargin: null, effRevenue: 0 }), seg('c1', 0.004), money)
    const value = (label: string) => stats.find((s) => s.label === label)?.value
    expect(value('Unit cost')).toBe('no cost')
    expect(value('Cost')).toBe('—')
    expect(value('Sale / unit')).toBe('—')
    expect(value('Margin')).toBe('—')
    expect(value('Share of job profit')).toBe('<1%')
  })
})

describe('the legend’s fold', () => {
  it('reads "1" as folded and anything else as open', () => {
    expect(readProfitLegendCollapsed({ getItem: () => '1' })).toBe(true)
    expect(readProfitLegendCollapsed({ getItem: () => '0' })).toBe(false)
    expect(readProfitLegendCollapsed({ getItem: () => null })).toBe(false)
    expect(readProfitLegendCollapsed(null)).toBe(false)
  })

  it('a device that refuses reads as open, and a refused write is dropped', () => {
    const refuses = {
      getItem: () => {
        throw new Error('private browsing')
      },
      setItem: () => {
        throw new Error('private browsing')
      },
    }
    expect(readProfitLegendCollapsed(refuses)).toBe(false)
    expect(() => writeProfitLegendCollapsed(refuses, true)).not.toThrow()
  })

  it('writes under the one key', () => {
    const written: Array<[string, string]> = []
    const storage = { setItem: (k: string, v: string) => void written.push([k, v]) }
    writeProfitLegendCollapsed(storage, true)
    writeProfitLegendCollapsed(storage, false)
    expect(written).toEqual([
      ['wbProfitLegendCollapsed_v1', '1'],
      ['wbProfitLegendCollapsed_v1', '0'],
    ])
  })
})
