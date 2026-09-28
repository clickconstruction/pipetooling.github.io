// @vitest-environment jsdom
/**
 * Render smoke for "Where the profit lives" (region P2 of the Pricing map): a slice and a
 * chip per profitable row, the concentration warning, the fold, the tooltip, the pinned card
 * and its jump. The bar's four values are handed in, as the tab hands them.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { PricingProfitBar } from './PricingProfitBar'
import type { PricingProfitBarState } from '../../hooks/usePricingProfitBar'
import type { ProfitBarRow } from '../../lib/bids/profitBarLegend'

const seg = (id: string, label: string, profit: number, share: number) => ({ id, label, profit, share })
const row = (id: string, over: Partial<ProfitBarRow> = {}): ProfitBarRow => ({ id, count: 4, cost: 400, effUnit: 250, effRevenue: 1000, effMargin: 0.6, bookEntryName: null, ...over })

function makeBar(over: Partial<PricingProfitBarState> = {}): PricingProfitBarState {
  return {
    wbBarHover: null,
    setWbBarHover: vi.fn(),
    wbBarTipLeft: 0,
    setWbBarTipLeft: vi.fn(),
    wbBarPinnedId: null,
    setWbBarPinnedId: vi.fn(),
    wbLegendCollapsed: false,
    toggleLegend: vi.fn(),
    ...over,
  }
}

const conc = { segments: [seg('c1', 'WC-1', 700, 0.7), seg('c2', 'LAV-1', 300, 0.3)], top2Share: 1, totalProfit: 1000 }
const rows = [row('c1', { bookEntryName: 'Water closet' }), row('c2')]
const colors = ['red', 'blue']

function mount(bar: PricingProfitBarState, over: Partial<Parameters<typeof PricingProfitBar>[0]> = {}) {
  const onJumpToRow = vi.fn()
  const marginColor = vi.fn((m: number | null) => (m == null ? 'muted' : 'green'))
  render(<PricingProfitBar bar={bar} conc={conc} rows={rows} concColors={colors} marginColor={marginColor} onJumpToRow={onJumpToRow} {...over} />)
  return { onJumpToRow, marginColor }
}

afterEach(() => cleanup())

describe('PricingProfitBar', () => {
  it('with no profit yet it says so: no slices, no fold, no chips', () => {
    mount(makeBar(), { conc: { segments: [], top2Share: null, totalProfit: 0 } })
    expect(screen.getByText('No profit yet — price some rows.')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('draws a slice and a chip per profitable row, the warning, and the fold', () => {
    mount(makeBar())
    expect(screen.getByRole('button', { name: 'WC-1: $700.00 profit (70% of job) — click for details' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'LAV-1: $300.00 profit (30% of job) — click for details' })).toBeTruthy()
    expect(screen.getByText('⚠ 100% of profit sits in WC-1 + LAV-1 — a VE cut there guts the job.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Hide legend ▾' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^WC-1\s*70%$/ })).toBeTruthy()
  })

  it('a folded legend hides the chips and offers to show them; the fold reports', () => {
    const bar = makeBar({ wbLegendCollapsed: true })
    mount(bar)
    expect(screen.queryByRole('button', { name: /^WC-1\s*70%$/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Show legend ▸' }))
    expect(bar.toggleLegend).toHaveBeenCalledTimes(1)
  })

  it('a slice and its chip pin the same row — and let go of it when it is the one pinned', () => {
    const bar = makeBar()
    mount(bar)
    fireEvent.click(screen.getByRole('button', { name: /^LAV-1: / }))
    fireEvent.click(screen.getByRole('button', { name: /^LAV-1\s*30%$/ }))
    const updaters = (bar.setWbBarPinnedId as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0] as (cur: string | null) => string | null)
    expect(updaters).toHaveLength(2)
    for (const u of updaters) {
      expect(u(null)).toBe('c2')
      expect(u('c1')).toBe('c2')
      expect(u('c2')).toBeNull()
    }
  })

  it('hovering a slice reports its index; leaving the track and blurring let go', () => {
    const bar = makeBar()
    mount(bar)
    const slice = screen.getByRole('button', { name: /^LAV-1: / })
    fireEvent.mouseEnter(slice)
    expect(bar.setWbBarHover).toHaveBeenLastCalledWith(1)
    expect(bar.setWbBarTipLeft).toHaveBeenCalledTimes(1)
    fireEvent.blur(slice)
    expect(bar.setWbBarHover).toHaveBeenLastCalledWith(null)
    fireEvent.mouseEnter(screen.getByRole('button', { name: /^WC-1\s*70%$/ }))
    expect(bar.setWbBarHover).toHaveBeenLastCalledWith(0)
  })

  it('the hovered slice has a tooltip with its profit and share', () => {
    mount(makeBar({ wbBarHover: 1, wbBarTipLeft: 140 }))
    const tip = screen.getByRole('tooltip')
    expect(tip.textContent).toBe('LAV-1$300.00 profit · 30% of job')
    expect((tip as HTMLElement).style.left).toBe('140px')
  })

  it('the pinned row has a detail card: its book entry, eight cells, the margin’s colour on two, and the jump', () => {
    const bar = makeBar({ wbBarPinnedId: 'c1' })
    const { onJumpToRow, marginColor } = mount(bar)
    const card = screen.getByRole('region', { name: 'Detail for WC-1' })
    expect(within(card).getByText('Water closet')).toBeTruthy()
    for (const [label, value] of [['Qty', '4'], ['Unit cost', '$100.00'], ['Sale / unit', '$250.00'], ['Revenue', '$1,000.00'], ['Cost', '$400.00'], ['Profit', '$700.00'], ['Margin', '60%'], ['Share of job profit', '70%']] as const) {
      expect(within(card).getByText(label).parentElement?.textContent).toBe(`${label}${value}`)
    }
    expect(marginColor).toHaveBeenCalledTimes(2)
    expect(marginColor).toHaveBeenCalledWith(0.6)
    fireEvent.click(within(card).getByRole('button', { name: '↑ Jump to row in worksheet' }))
    expect(onJumpToRow).toHaveBeenCalledWith('c1')
    fireEvent.click(within(card).getByRole('button', { name: 'Close line item detail' }))
    expect(bar.setWbBarPinnedId).toHaveBeenLastCalledWith(null)
  })

  it('a row with no book entry has no entry chip, and a pin with no slice draws no card', () => {
    const { unmount } = render(<PricingProfitBar bar={makeBar({ wbBarPinnedId: 'c2' })} conc={conc} rows={rows} concColors={colors} marginColor={() => 'green'} onJumpToRow={() => {}} />)
    expect(screen.getByRole('region', { name: 'Detail for LAV-1' }).textContent).not.toContain('book entry')
    unmount()
    mount(makeBar({ wbBarPinnedId: 'gone' }))
    expect(screen.queryByRole('region')).toBeNull()
  })
})
