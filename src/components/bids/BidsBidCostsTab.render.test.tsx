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
    budgets: [],
    hoursByJob: new Map([['j879', 6], ['j523', 959]]),
    bidsById: new Map([
      ['b76', { id: 'b76', bid_number: '76', project_name: 'ADAMS' }],
      ['b66', { id: 'b66', bid_number: '66', project_name: 'Mission Hill Park' }],
    ]),
    pricedByBid: new Map([['b76', stamp]]),
  }),
}))

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
