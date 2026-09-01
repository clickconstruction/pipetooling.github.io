// @vitest-environment jsdom
/**
 * Render smokes for BidsRobotScoreboardTab (v2.2560, dev only) — per-axis
 * Gate-B cards with the 5-slot bar, the bottleneck pills, and the unified
 * run ledger with VOID runs struck through rather than hidden.
 */
import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'

import { renderWithProviders } from '../../test/renderSmokeMocks'
import { BidsRobotScoreboardTab } from './BidsRobotScoreboardTab'

const scoreRows = [
  {
    id: 's1', run_label: 'BT-12', kind: 'backtest', axis: 'small TI',
    project_name: 'AutoZone 1604', twin_bid_number: '415', reference_bid_number: '67',
    locked_total: null, reference_value: null, delta_pct: -2.6, counts_note: null,
    scope_verdict: 'pass', gate_eligible: true, note: null, scored_at: '2026-08-31T14:00:00Z',
  },
  {
    id: 's2', run_label: 'BT-15', kind: 'backtest', axis: 'institutional',
    project_name: 'TSAOG campus', twin_bid_number: '421', reference_bid_number: '323',
    locked_total: 290839, reference_value: 404092, delta_pct: -28, counts_note: 'scope FAIL',
    scope_verdict: 'fail', gate_eligible: false, note: 'VOID — wrong package', scored_at: '2026-08-31T18:00:00Z',
  },
]

const shadowRows = [
  {
    id: 'sh1', status: 'locked', axis: 'small TI', created_at: '2026-08-31T20:00:00Z',
    locked_at: '2026-08-31T21:00:00Z', scored_at: null, shadow_bid_number: '423',
    reference_bid_number: '381', project_name: 'La Villita', requested_by_name: 'Robert',
    reference_sent_at: null, locked_total: null, reference_value: null, delta_pct: null,
  },
]

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        order: () => Promise.resolve({ data: scoreRows, error: null }),
      }),
    }),
    rpc: () => Promise.resolve({ data: shadowRows, error: null }),
  },
}))

describe('BidsRobotScoreboardTab', () => {
  it('renders axis cards, pending slots, pills, and the void ledger row', async () => {
    renderWithProviders(<BidsRobotScoreboardTab auditPending={18} />)
    await waitFor(() => expect(screen.getAllByText('small TI').length).toBeGreaterThan(0))

    // gate chip + pending shadow slot on the small TI card
    expect(screen.getByText('GATE B · 1/5')).toBeTruthy()
    expect(screen.getByText('b423')).toBeTruthy()

    // bottleneck pill
    expect(screen.getByText('18')).toBeTruthy()
    expect(screen.getByText('audits pending')).toBeTruthy()

    // ledger: void run visible with VOID verdict, not hidden
    expect(screen.getByText(/TSAOG campus/)).toBeTruthy()
    expect(screen.getByText('VOID')).toBeTruthy()
  })
})
