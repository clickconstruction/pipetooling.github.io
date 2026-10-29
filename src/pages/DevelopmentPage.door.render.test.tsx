// @vitest-environment jsdom
/**
 * The Development page's two doors (punch list #208 PR 6, v2.6053): the office reads every table and
 * sees the money; an estimator, who has no jobs_ledger read, is read through the overview and sees
 * no dollar, no Money look, no Pipeline and no Job window. The fetch is mocked at its seam, so this
 * holds the page's wiring: which door it asks for, and what it draws for each.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import DevelopmentPage from './DevelopmentPage'
import type { DevelopmentPageData } from '../lib/developments/fetchDevelopmentPage'
import type { MemberBid, MemberJob } from '../lib/developments/overview'
import { makeUseAuthValue, renderWithProviders, settle } from '../test/renderSmokeMocks'

const authState: { current: Record<string, unknown> } = { current: { role: 'dev' } }
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => makeUseAuthValue(authState.current),
  useOptionalAuth: () => makeUseAuthValue(authState.current),
}))
vi.mock('react-router-dom', async (orig) => ({ ...(await orig<typeof import('react-router-dom')>()), useParams: () => ({ id: 'dev-zz' }) }))

const fetchCalls: Array<{ door: string | undefined }> = []
const served: { data: DevelopmentPageData | null } = { data: null }
vi.mock('../lib/developments/fetchDevelopmentPage', () => ({
  fetchDevelopmentPage: async (_id: string, _include: boolean, door?: string) => {
    fetchCalls.push({ door })
    if (!served.data) throw new Error('no data served')
    return served.data
  },
}))

function bid(over: Partial<MemberBid> & { id: string }): MemberBid {
  return {
    bid_number: '161', project_name: 'Lot 4', address: '1 Gun Dog Trl', customer_id: null, estimator_id: 'u-est', account_manager_id: null, development_id: 'dev-zz',
    outcome: null, outcome_at: null, bid_value: null, agreed_value: null, priced_revenue_usd: null, bid_date_sent: '2026-10-01', bid_due_date: null, estimated_job_start_date: null,
    plans_link: null, design_drawing_plan_date: null, gc_contact_name: null, gc_contact_phone: null, gc_contact_email: null, created_at: '2026-09-01T00:00:00Z', updated_at: null,
    working_board_archived_at: null, service_type_id: null, last_contact: null, ...over,
  }
}
function job(over: Partial<MemberJob> & { id: string }): MemberJob {
  return {
    hcp_number: '956', click_number: null, job_name: 'Lot 4', job_address: '1 Gun Dog Trl', customer_id: null, customer_name: null, gc_customer_id: null, development_id: 'dev-zz', bid_id: 'b1',
    status: 'billed', revenue: null, payments_made: null, last_work_date: '2026-10-20', last_bill_date: null, job_plans_link: null, created_at: '2026-09-02T00:00:00Z', updated_at: null, service_type_id: null, ...over,
  }
}
function data(members: { bids: MemberBid[]; jobs: MemberJob[] }, invoices: DevelopmentPageData['invoices'] = []): DevelopmentPageData {
  return {
    development: { id: 'dev-zz', name: 'ZZ Test development', gc_customer_id: null, city: null, notes: null, archived_at: null, created_at: '2026-08-01T00:00:00Z' },
    gcCustomer: null,
    customer: null,
    customers: [],
    historyEntries: [],
    customerContacts: [],
    inIt: members,
    atAddress: { bids: [], jobs: [] },
    requests: [],
    submissionEntries: [],
    bidChanges: [],
    statusEvents: [],
    invoices,
    payments: [],
    threadNotes: [],
    bidNotes: [],
    teamMembers: [],
    names: new Map([['u-est', 'Dana']]),
    paySpeed: null,
  }
}

beforeEach(() => {
  fetchCalls.length = 0
  window.localStorage.clear()
})
afterEach(() => {
  vi.clearAllMocks()
})

describe('DevelopmentPage: the two doors', () => {
  it('the office door: five tiles, the Money look with its figures, the Pipeline links, the pair press', async () => {
    authState.current = { role: 'dev' }
    served.data = data({ bids: [bid({ id: 'b1', bid_value: 42000 })], jobs: [job({ id: 'j1', revenue: 5000, payments_made: 3000 })] }, [{ id: 'i1', job_id: 'j1', amount: 5000, status: 'open', billed_at: '2026-10-21T00:00:00Z', sent_to_customer_at: null, created_at: '2026-10-21T00:00:00Z' }])
    renderWithProviders(<DevelopmentPage />)
    await settle()
    await screen.findByTestId('development-counts')
    expect(fetchCalls.map((c) => c.door)).toEqual(['office'])
    expect(document.querySelectorAll('.developmentCountTile')).toHaveLength(5)
    expect(screen.getByText('Open on bills')).toBeTruthy()
    expect(screen.getByText('Bid, undecided')).toBeTruthy()
    expect(screen.getAllByText('$42,000').length).toBeGreaterThan(0)
    expect(screen.getByText('GC Review · this development ›')).toBeTruthy()
    expect(screen.getByText('Pair bids with jobs')).toBeTruthy()
    expect(screen.queryByTestId('money-office-line')).toBeNull()
    expect(screen.getAllByText('Pipeline').length).toBeGreaterThan(0)
  })

  it('the overview door (an estimator): three tiles, the Money line, no dollar anywhere, no Pipeline, no pairing, and a job number that says where the job opens', async () => {
    authState.current = { role: 'estimator' }
    // The overview read hands the page rows with no money column; the page must not draw a figure or a *no price yet* for them.
    served.data = data({ bids: [bid({ id: 'b1' })], jobs: [job({ id: 'j1' })] })
    renderWithProviders(<DevelopmentPage />)
    await settle()
    await screen.findByTestId('development-counts')
    expect(fetchCalls.map((c) => c.door)).toEqual(['overview'])
    expect(document.querySelectorAll('.developmentCountTile')).toHaveLength(3)
    expect(screen.queryByText('Open on bills')).toBeNull()
    expect(screen.queryByText('Bid, undecided')).toBeNull()
    expect(screen.getByTestId('money-office-line').textContent).toBe('The office reads the money on this site.')
    expect(screen.getByText('the office reads it')).toBeTruthy()
    expect(screen.queryByText('GC Review · this development ›')).toBeNull()
    expect(screen.queryByText('Pair bids with jobs')).toBeNull()
    expect(screen.queryByText('Pipeline')).toBeNull()
    expect(document.body.textContent).not.toMatch(/\$|no price yet/)
    // The job's number: the Job window reads jobs_ledger itself, so the press says where the job opens.
    const jobDoor = screen.getAllByRole('button', { name: /956/ })[0]!
    fireEvent.click(jobDoor)
    await waitFor(() => expect(screen.getByText(/opens for the office and Dispatch\./)).toBeTruthy())
    expect(screen.getByText(/Its stage, crew, plans and history are on this page\./)).toBeTruthy()
  })

  it('waits for the role before its first read, so the office is never read through the overview', async () => {
    authState.current = { role: null, loading: true }
    served.data = data({ bids: [], jobs: [] })
    renderWithProviders(<DevelopmentPage />)
    await settle()
    expect(fetchCalls).toEqual([])
    expect(screen.getByText('Reading the site…')).toBeTruthy()
  })
})
