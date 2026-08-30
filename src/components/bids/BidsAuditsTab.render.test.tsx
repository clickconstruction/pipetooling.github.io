// @vitest-environment jsdom
/**
 * Render smokes for BidsAuditsTab (v2.2517) — the robot feedback loop's human
 * side: pending card with quick links + question answer box + sectioned
 * composers + Finish audit; digested history stays collapsed behind a toggle.
 */
import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'

import { renderWithProviders } from '../../test/renderSmokeMocks'
import { BidsAuditsTab } from './BidsAuditsTab'
import type { BidAuditNoteRow } from '../../lib/bids/bidAudits'

const audits = [
  {
    id: 'a1',
    bid_id: 'bid-405',
    ct_project_id: 'ct-1',
    ct_view_url: 'https://counttooling.com/app/?t=tok',
    status: 'pending',
    requested_at: '2026-08-30T20:00:00Z',
    completed_at: null,
    completed_by: null,
    digested_at: null,
    created_by: null,
    created_at: '2026-08-30T20:00:00Z',
    updated_at: '2026-08-30T20:00:00Z',
    bids: { id: 'bid-405', bid_number: '405', project_name: 'ZZ Twin MPH CASA LINDA (backtest)', selected_bid_version_id: null },
  },
  {
    id: 'a2',
    bid_id: 'bid-300',
    ct_project_id: null,
    ct_view_url: null,
    status: 'digested',
    requested_at: '2026-08-20T20:00:00Z',
    completed_at: '2026-08-21T20:00:00Z',
    completed_by: 'u-w',
    digested_at: '2026-08-22T20:00:00Z',
    created_by: null,
    created_at: '2026-08-20T20:00:00Z',
    updated_at: '2026-08-22T20:00:00Z',
    bids: { id: 'bid-300', bid_number: '300', project_name: 'Old Backtest', selected_bid_version_id: null },
  },
]

const notes: Array<Partial<BidAuditNoteRow> & { audit_id: string }> = [
  { id: 'q1', audit_id: 'a1', bid_id: 'bid-405', section: 'general', kind: 'question', body: 'Wet tables owner-furnished?', parent_id: null, created_at: '2026-08-30T20:01:00Z', author_id: null, digested_at: null, digest_outcome: null },
  { id: 'n1', audit_id: 'a1', bid_id: 'bid-405', section: 'footage', kind: 'note', body: 'Waste footage way low.', parent_id: null, created_at: '2026-08-30T21:00:00Z', author_id: null, digested_at: null, digest_outcome: null },
  { id: 'r1', audit_id: 'a1', bid_id: 'bid-405', section: 'footage', kind: 'receipt', body: 'Learned: developed-length multiplier.', parent_id: 'n1', created_at: '2026-08-30T22:00:00Z', author_id: null, digested_at: null, digest_outcome: 'doctrine' },
]

// Chainable thenable PostgREST stub: every builder method returns itself; awaiting
// resolves to the table's canned rows.
function tableResult(table: string): unknown {
  const data =
    table === 'bid_audits' ? audits :
    table === 'bid_audit_notes' ? notes :
    []
  const chain: Record<string, unknown> = {}
  const self = () => chain
  for (const m of ['select', 'order', 'limit', 'in', 'eq', 'insert', 'update']) chain[m] = self
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ data, error: null }).then(resolve)
  return chain
}

vi.mock('../../lib/supabase', () => ({
  supabase: { from: (table: string) => tableResult(table) },
}))

describe('BidsAuditsTab', () => {
  it('renders the pending card: links, question, note + receipt, Finish audit', async () => {
    renderWithProviders(<BidsAuditsTab authUser={null} />)
    await waitFor(() => expect(screen.getByText(/ZZ Twin MPH CASA LINDA/)).toBeTruthy())

    const ctLink = screen.getByText('Open takeoff (CountTooling) ↗') as HTMLAnchorElement
    expect(ctLink.getAttribute('href')).toBe('https://counttooling.com/app/?t=tok')
    expect(ctLink.getAttribute('target')).toBe('_blank')
    const ptLink = screen.getByText('Open bid (PipeTooling) ↗') as HTMLAnchorElement
    expect(ptLink.getAttribute('href')).toBe('/bids?tab=counts&bidId=bid-405')
    expect(ptLink.getAttribute('target')).toBe('_blank')

    expect(screen.getByText(/Wet tables owner-furnished\?/)).toBeTruthy()
    expect(screen.getByPlaceholderText('Type your answer…')).toBeTruthy()
    expect(screen.getByText('Waste footage way low.')).toBeTruthy()
    expect(screen.getByText(/Learned: developed-length multiplier/)).toBeTruthy()
    expect(screen.getByText(/placement doctrine/)).toBeTruthy()
    expect(screen.getByText('Finish audit')).toBeTruthy()

    // Every section offers a composer on a pending card.
    expect(screen.getAllByPlaceholderText(/Type it like a text/).length).toBe(5)

    // Digested history is collapsed behind the toggle.
    expect(screen.queryByText('Old Backtest')).toBeNull()
    expect(screen.getByText(/Show digested audits \(1\)/)).toBeTruthy()
  })
})
