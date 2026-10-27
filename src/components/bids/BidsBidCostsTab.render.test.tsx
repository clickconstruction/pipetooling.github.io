// @vitest-environment jsdom
/**
 * Bids → Bid Costs → Bid vs actual (v2.3342), the Priced column (Burn against the bid, piece 1,
 * v2.5043): beside the burn read, the margin each bid was priced at with the inputs behind it, or
 * "not priced on the Workbench". The hook is stubbed; the kernel's suite holds the arithmetic.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
const stamp = { pct: 31.42, revenueUsd: 41_550, costUsd: 28_495, uncostedUsd: 0, rateSet: false, bidVersionId: null, at: '2026-08-01T15:00:00Z' }
vi.mock('../../hooks/useBidVsActual', () => ({
  useBidVsActual: (enabled: boolean) => ({
    loading: false,
    loaded: enabled,
    jobs: enabled
      ? [
          { id: 'j879', hcp_number: '879', job_name: 'Palmer · Moses Hughes', revenue: 41_550, status: 'waiting', pct_complete: 50, bid_id: 'b76' },
          { id: 'j523', hcp_number: '523', job_name: 'Mission Hills', revenue: 123_600, status: 'working', pct_complete: 90, bid_id: 'b66' },
        ]
      : [],
    // v2.5046 · the whole row, as the hook now reads it (not usable: no labor rate tile counts it).
    budgets: [{ job_id: 'j879', bid_id: 'b76', kind: 'bid', labor_hours: 300, labor_rate: 35, labor_usd: 10_500, materials_usd: 9_000, subs_usd: 2_000, other_usd: 500, total_direct_usd: 22_000, completeness: { usable: false } }],
    hoursByJob: new Map([['j879', 6], ['j523', 959]]),
    bidsById: new Map([
      ['b76', { id: 'b76', bid_number: '76', project_name: 'ADAMS' }],
      ['b66', { id: 'b66', bid_number: '66', project_name: 'Mission Hill Park' }],
    ]),
    pricedByBid: new Map([['b76', stamp]]),
  }),
}))

// v2.5046 · the burn read is stubbed with one loaded job (Moses Hughes), one still loading, none failed.
const day = (d: number) => `2026-09-${String(d).padStart(2, '0')}`
const burnInputs = {
  chargeEvents: [
    ...[1, 2, 3, 4, 5].map((d) => ({ source: 'team_labor' as const, dateKey: day(d), amount: 1_800, label: 'crew' })),
    { source: 'supply_house' as const, dateKey: day(2), amount: 6_000, label: 'Ferguson' },
    { source: 'sub_labor' as const, dateKey: day(4), amount: 1_500, label: 'sub' },
  ],
  valueEvents: [{ dateKey: day(5), percent: 50, label: 'report', kind: 'report' as const }],
  paymentEvents: [],
  revenue: 41_550,
  fallbackPercent: 40,
  teamHours: 240,
  cardChargesExcluded: false,
}
const burnRead = vi.fn((enabled: boolean, _ids: ReadonlyArray<string>) => ({ loading: enabled, inputsByJob: enabled ? new Map([['j879', burnInputs]]) : new Map() }))
vi.mock('../../hooks/useBidVsActualBurnInputs', () => ({ useBidVsActualBurnInputs: (enabled: boolean, ids: ReadonlyArray<string>) => burnRead(enabled, ids) }))
vi.mock('../../hooks/useJobStageEarnedValue', () => ({ useJobStageEarnedValue: () => ({ loading: false, failed: false, ev: null }) }))

import { BidsBidCostsTab } from './BidsBidCostsTab'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'

describe('BidsBidCostsTab · Bid vs actual · Priced (v2.5043)', () => {
  it('reads each bid’s priced margin beside the burn, and says which were never priced', async () => {
    renderWithProviders(<BidsBidCostsTab bids={[]} teamLaborData={[]} bidAssignedCosts={new Map()} onSelectBid={vi.fn()} onCostIt={vi.fn()} onOpenBid={vi.fn()} showDollars />)
    fireEvent.click(screen.getByRole('tab', { name: 'Bid vs actual' }))
    await settle()
    expect(screen.getByRole('columnheader', { name: 'Priced' })).toBeTruthy()
    const adams = screen.getByText('J879 Palmer · Moses Hughes').closest('tr')!
    expect(within(adams).getByTestId('bva-priced').textContent).toBe('31%$28,495 cost on $41,550 · no labor rate')
    const mission = screen.getByText('J523 Mission Hills').closest('tr')!
    expect(within(mission).getByTestId('bva-priced').textContent).toBe('—not priced on the Workbench')
    expect(screen.getByText('0 with a labor rate set · 1 priced on the Workbench')).toBeTruthy()
  })
})

describe('BidsBidCostsTab · Bid vs actual · Direct and the burn by section (v2.5046)', () => {
  it('reads each job’s direct margin at completion beside the priced margin, and a row opens into its burn', async () => {
    renderWithProviders(<BidsBidCostsTab bids={[]} teamLaborData={[]} bidAssignedCosts={new Map()} onSelectBid={vi.fn()} onCostIt={vi.fn()} onOpenBid={vi.fn()} showDollars />)
    fireEvent.click(screen.getByRole('tab', { name: 'Bid vs actual' }))
    await settle()
    expect(burnRead).toHaveBeenLastCalledWith(true, ['j879', 'j523'])
    expect(screen.getByRole('columnheader', { name: 'Direct' })).toBeTruthy()
    const adams = screen.getByText('J879 Palmer · Moses Hughes').closest('tr')!
    // $16,500 spent at 50% done → $33,000 at completion → $8,550 · 21%, ten points under the 31% it was priced at
    expect(within(adams).getByTestId('bva-direct').textContent).toBe('21%$8,550 at completion · 10 pts under the price')
    const mission = screen.getByText('J523 Mission Hills').closest('tr')!
    expect(within(mission).getByTestId('bva-direct').textContent).toBe('…')
    fireEvent.click(within(adams).getByRole('button', { name: "Open J879 Palmer · Moses Hughes's burn" }))
    expect(screen.getByTestId('bva-direct-margin').textContent).toBe('$8,550 · 21%')
    // The budget resolves off the whole row, as on the Costs tab: the bid's materials figure stands.
    expect(within(screen.getByTestId('bva-section-materials')).getByText('$9,000')).toBeTruthy()
  })
  it('the hours roles read no dollar burn: no Direct column, and the read stays off', async () => {
    burnRead.mockClear()
    renderWithProviders(<BidsBidCostsTab bids={[]} teamLaborData={[]} bidAssignedCosts={new Map()} onSelectBid={vi.fn()} onCostIt={vi.fn()} onOpenBid={vi.fn()} showDollars={false} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Bid vs actual' }))
    await settle()
    expect(screen.queryByRole('columnheader', { name: 'Direct' })).toBeNull()
    expect(burnRead.mock.calls.every(([enabled]) => enabled === false)).toBe(true)
    const adams = screen.getByText('J879 Palmer · Moses Hughes').closest('tr')!
    fireEvent.click(within(adams).getByRole('button', { name: "Open J879 Palmer · Moses Hughes's burn" }))
    expect(screen.queryByTestId('bva-sections')).toBeNull()
    expect(screen.getByTestId('bva-stage-ev')).toBeTruthy()
  })
})

describe('BidsBidCostsTab · the lens row fits a phone (v2.5979)', () => {
  it('wraps its four chips, so History & forecast drops a line instead of pushing a 375 px page sideways', async () => {
    renderWithProviders(<BidsBidCostsTab bids={[]} teamLaborData={[]} bidAssignedCosts={new Map()} onSelectBid={vi.fn()} onCostIt={vi.fn()} onOpenBid={vi.fn()} showDollars={false} />)
    await settle()
    // jsdom can't measure layout, so this pins the wrap; e2e/viewport-smoke.spec.ts measures the page at 375 px.
    const lenses = screen.getByRole('tablist', { name: 'Bid Costs lens' })
    expect(lenses.style.flexWrap).toBe('wrap')
    expect(within(lenses).getAllByRole('tab').map((t) => t.textContent)).toEqual(['Pursuit', 'Cost to win', 'Bid vs actual', 'History & forecast'])
  })
})

describe('BidsBidCostsTab · an empty window names itself (punch list #184, sweep C)', () => {
  const emptyLines = () => Array.from(document.querySelectorAll('[data-empty-state]')).map((e) => e.textContent)

  it('Pursuit: the table and the estimator rail say the window, and Widen the window steps out to All', async () => {
    renderWithProviders(<BidsBidCostsTab bids={[]} teamLaborData={[]} bidAssignedCosts={new Map()} onSelectBid={vi.fn()} onCostIt={vi.fn()} onOpenBid={vi.fn()} showDollars />)
    await settle()
    expect(emptyLines()).toEqual([
      'No bids with time in the last 12 months. Widen the window looks at all time.',
      'No clocked time in the last 12 months. Widen the window looks at all time.',
    ])
    fireEvent.click(screen.getAllByRole('button', { name: 'Widen the window' })[0]!)
    expect(screen.getByRole('button', { name: 'All', pressed: true })).toBeTruthy()
    expect(emptyLines()).toEqual(['No bids with time yet.', 'No clocked time yet.'])
  })

  it('Cost to win: the same window, and the same press', async () => {
    renderWithProviders(<BidsBidCostsTab bids={[]} teamLaborData={[]} bidAssignedCosts={new Map()} onSelectBid={vi.fn()} onCostIt={vi.fn()} onOpenBid={vi.fn()} showDollars />)
    fireEvent.click(screen.getByRole('tab', { name: 'Cost to win' }))
    await settle()
    expect(emptyLines()).toEqual(['No bids in the last 12 months. Widen the window looks at all time.'])
    fireEvent.click(screen.getByRole('button', { name: 'Widen the window' }))
    expect(emptyLines()).toEqual(['No bids yet.'])
  })
})
