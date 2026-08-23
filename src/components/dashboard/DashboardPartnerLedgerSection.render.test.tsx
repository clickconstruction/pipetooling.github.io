// @vitest-environment jsdom
/**
 * Render smoke for the partner's Dashboard entry card (v2.2157): it is a door
 * to /my-statement carrying the settle-up position in words, and it renders
 * nothing for non-partners (RPC error / no payload).
 */
import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'

const rpc = vi.fn()
vi.mock('../../lib/supabase', () => ({ supabase: { rpc: (...args: unknown[]) => rpc(...args) } }))

import { DashboardPartnerLedgerSection } from './DashboardPartnerLedgerSection'
import { renderWithProviders } from '../../test/renderSmokeMocks'

const summary = {
  exists: true,
  partnership_id: 'p1',
  display_name: 'Bryan',
  balance: -808.13,
  modules: { weekly_statement: true, costing: true, profit_shares: true },
  current_week: { week_start: '2026-08-23', field_hours: 0, office_hours: 0, farm_hours: 0, gross_so_far: 0, pending_sessions: 2 },
  latest_statement: { pay_stub_id: 's1', period_start: '2026-08-09', period_end: '2026-08-15', partner_ack_at: null, company_ack_at: null },
  rates: { field: 50, estimating: 35, farm: 0 },
  pending_offsets: { count: 1, net: -200 },
}

describe('DashboardPartnerLedgerSection (entry card)', () => {
  it('links to /my-statement with the settle-up position in words and the sign-off nudge', async () => {
    rpc.mockResolvedValue({ data: summary, error: null })
    renderWithProviders(<DashboardPartnerLedgerSection />)
    await waitFor(() => expect(screen.getByText('Your statement')).toBeTruthy())
    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe('/my-statement')
    // posted balance −808.13 + pending charges −200 = the statement's headline
    expect(screen.getByText('−$1,008.13')).toBeTruthy()
    expect(screen.getByText('you owe Click · Open ›')).toBeTruthy()
    expect(screen.getByText(/waiting on your sign-off/)).toBeTruthy()
    // summary only — the 520-week ledger is not fetched for the entry card
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc.mock.calls[0]?.[0]).toBe('get_my_partner_summary')
  })

  it('renders nothing for a non-partner', async () => {
    rpc.mockReset()
    rpc.mockResolvedValue({ data: { exists: false }, error: null })
    const { container } = renderWithProviders(<DashboardPartnerLedgerSection />)
    await waitFor(() => expect(rpc).toHaveBeenCalled())
    expect(container.textContent).toBe('')
  })
})
