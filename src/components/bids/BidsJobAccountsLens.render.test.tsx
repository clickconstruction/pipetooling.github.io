// @vitest-environment jsdom
/**
 * Render smoke for the Job accounts lens (PR 1b): the rollup and the house
 * bands from the page's strip read, the row words per state, "Open the job
 * first" on a won bid with no job (absent here — no job-form provider), the
 * ask band's ticks and the composed email, and Only my bids. The writes
 * (Mark opened, Sent — log) are the shared sheet and function, not exercised.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { BidsJobAccountsLens } from './BidsJobAccountsLens'
import type { BidJobAccountRow } from '../../hooks/useBidJobAccountStrip'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import { settle } from '../../test/renderSmokeMocks'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u-tristen', email: 'tristen@x.test' }, profileName: 'Tristen', role: 'estimator' }),
}))
vi.mock('../../contexts/ToastContext', () => ({ useToastContext: () => ({ showToast: () => {} }) }))
vi.mock('../../lib/jobs/bidPacketFacts', () => ({
  fetchBidPacketFacts: (bidId: string) =>
    Promise.resolve({
      bidLabel: bidId,
      propertyName: bidId === 'b398' ? 'Pondhill Building 2' : 'Vaughn residence',
      address: bidId === 'b398' ? '4114 Pond Hill Rd, San Antonio, TX 78231' : '118 Vaughn Ln, Buda, TX 78610',
      startDate: bidId === 'b398' ? '2026-09-22' : '2026-09-24',
      gc: { company: bidId === 'b398' ? 'H & I Construction' : 'Dudley Mason', contactName: null, phone: null, email: null },
      owner: null,
    }),
}))
vi.mock('../../lib/physicalInvoiceIssuer', () => ({
  fetchPhysicalInvoiceIssuerFromAppSettings: () => Promise.resolve(undefined),
  getPhysicalInvoiceIssuerForDocument: () => ({ companyName: 'Click Plumbing and Electrical', phone: '(512) 360-0599' }),
}))

afterEach(() => cleanup())

function row(over: Partial<BidJobAccountRow>): BidJobAccountRow {
  return {
    bid_id: 'b398', job_id: 'j1018', job_hcp_number: '1018', job_click_number: null, job_name: 'Pondhill Building 2', job_address: '4114 Pond Hill Rd',
    supply_house_id: 'h-ferg', house_name: 'Ferguson', policy: 'expects', quoted: false, status: null, account_ref: null,
    opened_via: null, opened_at: null, requested_at: null, rep_contact_id: 'c-curly', rep_name: 'Curly Conley', rep_phone: null, rep_email: 'curly@ferguson.com',
    ...over,
  }
}
function bid(over: Partial<BidWithBuilder>): BidWithBuilder {
  return {
    id: 'b398', bid_number: '398', project_name: 'Pondhill Building 2', outcome: 'started_or_complete', outcome_at: '2026-09-08', address: null,
    estimated_job_start_date: '2026-09-18', estimator_id: 'u-tristen', account_manager_id: null, service_type_id: 'st-plumbing',
    customers: null, bids_gc_builders: { name: 'H & I Construction' } as BidWithBuilder['bids_gc_builders'], estimator: { id: 'u-tristen', name: 'Tristen', email: 't@x.test' },
    ...over,
  } as BidWithBuilder
}

const byBid = new Map<string, BidJobAccountRow[]>([
  ['b398', [row({ supply_house_id: 'h-moore', house_name: 'Moore Supply', status: 'open' }), row({}), row({ supply_house_id: 'h-reece', house_name: 'Reece', rep_contact_id: null, rep_name: null, rep_email: null })]],
  ['b375', [row({ bid_id: 'b375', job_id: 'j1007', job_hcp_number: '1007', job_name: 'SpaceX BA-02N', status: 'requested', requested_at: '2026-09-12T10:00:00Z' })]],
  ['b412', [row({ bid_id: 'b412', job_id: 'j990', job_hcp_number: '990', job_name: 'Vaughn residence' })]],
  ['b402', [row({ bid_id: 'b402', job_id: null, job_hcp_number: null, job_name: null, job_address: null, quoted: true })]],
])
const bids = [
  bid({}),
  bid({ id: 'b375', bid_number: '375', project_name: 'SpaceX BA-02N', estimated_job_start_date: '2026-10-07', bids_gc_builders: { name: 'Structura' } as BidWithBuilder['bids_gc_builders'] }),
  bid({ id: 'b412', bid_number: '412', project_name: 'Vaughn residence', estimated_job_start_date: '2026-09-24', estimator_id: 'u-bill', estimator: { id: 'u-bill', name: 'Bill', email: 'b@x.test' } }),
  bid({ id: 'b402', bid_number: '402', project_name: 'Take 5 · Buda', outcome: 'won', estimated_job_start_date: null, outcome_at: '2026-09-13', estimator_id: 'u-wendi', estimator: { id: 'u-wendi', name: 'Wendi', email: 'w@x.test' } }),
]
const strips = { byBid, loaded: true, reload: () => {} }
const prefixMap = new Map() as unknown as Parameters<typeof BidsJobAccountsLens>[0]['ledgerPrefixMap']

describe('BidsJobAccountsLens', () => {
  it('draws the rollup, a band per house with the rep, and the rows in start order with their words', async () => {
    render(<BidsJobAccountsLens bids={bids} strips={strips} ledgerPrefixMap={prefixMap} authUserId="u-tristen" />)
    await settle()
    expect(screen.getByTestId('lens-rollup').textContent).toBe('3 jobs · 2 houses · 1 won bid with no job yet')
    const houses = screen.getAllByTestId('lens-house').map((el) => el.getAttribute('data-house'))
    expect(houses).toEqual(['Ferguson', 'Reece'])
    expect(screen.getAllByText(/Curly Conley/).length).toBeGreaterThan(0)
    expect(screen.getByText(/no job-accounts rep with an email on file/)).toBeTruthy()
    const rows = screen.getAllByTestId('lens-row')
    expect(rows).toHaveLength(5)
    expect(rows[0]!.textContent).toContain('Pondhill Building 2')
    expect(rows[0]!.textContent).toContain('expects one per property')
    expect(rows[2]!.textContent).toContain('Ferguson · asked')
    expect(rows[2]!.textContent).toContain('Curly Conley opens them')
    expect(rows[3]!.textContent).toContain('no job yet')
    expect(rows[3]!.textContent).toContain('after the job is opened · Ferguson quoted')
    expect(screen.getAllByTestId('lens-mark-opened')).toHaveLength(4)
    expect(screen.getByTestId('lens-ask-rep').textContent).toBe('Ask Curly for both')
  })

  it('the ask band ticks the emailable rows and composes one numbered note', async () => {
    render(<BidsJobAccountsLens bids={bids} strips={strips} ledgerPrefixMap={prefixMap} authUserId={null} />)
    await settle()
    fireEvent.click(screen.getByTestId('lens-ask-rep'))
    const email = await waitFor(() => screen.getByTestId('lens-email'))
    expect(email.textContent).toContain('Subject: Job accounts — 2 properties (Click Plumbing and Electrical)')
    expect(email.textContent).toContain('1. 4114 Pond Hill Rd, San Antonio, TX 78231')
    expect(email.textContent).toContain('2. 118 Vaughn Ln, Buda, TX 78610')
    expect(email.textContent).toContain('General contractor: Dudley Mason')
    const ticks = screen.getAllByRole('checkbox', { name: /Include/ })
    expect(ticks.map((t) => (t as HTMLInputElement).checked)).toEqual([true, true, false, false])
    expect(ticks.map((t) => (t as HTMLInputElement).disabled)).toEqual([false, false, true, true])
    fireEvent.click(ticks[1]!)
    await waitFor(() => expect(screen.getByTestId('lens-email').textContent).toContain('Job account — 4114 Pond Hill Rd, San Antonio, TX 78231'))
  })

  it('Only my bids narrows the list, and an all-open page says so', async () => {
    render(<BidsJobAccountsLens bids={bids} strips={strips} ledgerPrefixMap={prefixMap} authUserId="u-bill" />)
    await settle()
    fireEvent.click(screen.getByLabelText('Only my bids'))
    expect(screen.getAllByTestId('lens-row')).toHaveLength(1)
    expect(screen.getByTestId('lens-rollup').textContent).toBe('1 job · 1 house')
    cleanup()
    render(<BidsJobAccountsLens bids={[bid({})]} strips={{ byBid: new Map([['b398', [row({ status: 'open' })]]]), loaded: true, reload: () => {} }} ledgerPrefixMap={prefixMap} authUserId={null} />)
    await settle()
    expect(screen.getByTestId('lens-empty').textContent).toContain('nothing to ask')
  })
})
