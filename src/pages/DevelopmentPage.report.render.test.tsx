// @vitest-environment jsdom
/**
 * The Development page opened at `?report=materials` (punch list #330): the material location report's window opens
 * by itself. Closing it takes the mark out of the address (finding 325), so a reload does not draw the paper again,
 * and every other mark in the address stays. The fetch is mocked at its seam, as in `DevelopmentPage.door.render.test.tsx`,
 * and the paper's window is a stub: its own read is `SiteMaterialsReportModal`'s test's.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { useLocation } from 'react-router-dom'
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
// The trips hook reads over the network, and this file is not about trips (DevelopmentPage.trips.render.test.tsx is): the trips are not read yet here.
vi.mock('../hooks/useSiteTrips', () => ({
  useSiteTrips: () => ({ records: null, failure: null, miles: null, sitePoint: null, sitePointKnown: true, shows: false, deleted: [], deletedKnown: true, deletedFailed: false, roster: [], punches: [], punchesFailed: false, dismissals: [], names: new Map(), askRoster: () => {}, reload: () => {}, save: async () => {}, remove: async () => {}, split: async () => null, join: async () => null, dismiss: async () => [], undismiss: async () => {} }),
}))

vi.mock('../components/materials/SiteMaterialsReportModal', () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <div role="dialog" aria-label="Material location report">
      <button type="button" onClick={onClose}>Close</button>
    </div>
  ),
}))

const fetchCalls: Array<{ door: string | undefined }> = []
const served: { data: DevelopmentPageData | null } = { data: null }
vi.mock('../lib/developments/fetchDevelopmentPage', () => ({
  // The whole bodies the list did not read (punch list #280): nothing here is long enough to ask.
  readHistoryBody: async () => '',
  readHistoryBodies: async () => new Map<string, string>(),
  fetchDevelopmentPage: async (_id: string, _include: boolean, door?: string) => {
    fetchCalls.push({ door })
    if (!served.data) throw new Error('no data served')
    return served.data
  },
}))

function bid(over: Partial<MemberBid> & { id: string }): MemberBid {
  return {
    bid_number: '161', project_name: 'Lot 4', address: '1 Gray Fox Trl', customer_id: null, estimator_id: 'u-est', account_manager_id: null, development_id: 'dev-zz',
    outcome: null, outcome_at: null, bid_value: null, agreed_value: null, priced_revenue_usd: null, bid_date_sent: '2026-10-01', bid_due_date: null, estimated_job_start_date: null,
    plans_link: null, design_drawing_plan_date: null, gc_contact_name: null, gc_contact_phone: null, gc_contact_email: null, created_at: '2026-09-01T00:00:00Z', updated_at: null,
    working_board_archived_at: null, service_type_id: null, last_contact: null, ...over,
  }
}
function job(over: Partial<MemberJob> & { id: string }): MemberJob {
  return {
    hcp_number: '956', click_number: null, job_name: 'Lot 4', job_address: '1 Gray Fox Trl', customer_id: null, customer_name: null, gc_customer_id: null, development_id: 'dev-zz', bid_id: 'b1',
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
    twinUserIds: new Set<string>(),
  }
}

beforeEach(() => {
  fetchCalls.length = 0
  window.localStorage.clear()
})
afterEach(() => {
  vi.clearAllMocks()
})

function Where() {
  const location = useLocation()
  return <output data-testid="where">{`${location.pathname}${location.search}`}</output>
}
const where = () => screen.getByTestId('where').textContent
const open = async (route: string) => {
  authState.current = { role: 'dev' }
  served.data = data({ bids: [bid({ id: 'b1', bid_value: 42000 })], jobs: [job({ id: 'j1', revenue: 5000, payments_made: 3000 })] })
  renderWithProviders(
    <>
      <DevelopmentPage />
      <Where />
    </>,
    { route },
  )
  await settle()
  await screen.findByTestId('development-counts')
}

describe('DevelopmentPage: the material location report’s door (finding 325)', () => {
  it('opens the paper’s window by itself, and Close takes the mark out of the address', async () => {
    await open('/developments/dev-zz?report=materials')
    const paper = await screen.findByRole('dialog', { name: 'Material location report' })
    expect(where()).toBe('/developments/dev-zz?report=materials')
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    await settle()
    expect(screen.queryByRole('dialog', { name: 'Material location report' })).toBeNull()
    expect(paper.isConnected).toBe(false)
    // A reload of this address draws no paper.
    expect(where()).toBe('/developments/dev-zz')
  })

  it('keeps every other mark in the address', async () => {
    await open('/developments/dev-zz?all=1&report=materials')
    await screen.findByRole('dialog', { name: 'Material location report' })
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    await settle()
    expect(where()).toBe('/developments/dev-zz?all=1')
  })

  it('an address with no mark opens no window', async () => {
    await open('/developments/dev-zz')
    expect(screen.queryByRole('dialog', { name: 'Material location report' })).toBeNull()
    expect(where()).toBe('/developments/dev-zz')
  })
})
