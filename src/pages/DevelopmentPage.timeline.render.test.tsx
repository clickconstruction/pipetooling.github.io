// @vitest-environment jsdom
/**
 * The Money look's third view, the Timeline (v2.6493, punch list #257): a dev or a controller sees three
 * view chips and the Timeline draws the site's jobs from the reads the page already holds; a master sees
 * two chips, and a device that remembered the Timeline for another role opens on the money. The reads
 * are mocked at their hooks; the rows are made up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import DevelopmentPage from './DevelopmentPage'
import type { DevelopmentPageData } from '../lib/developments/fetchDevelopmentPage'
import type { MemberBid, MemberJob } from '../lib/developments/overview'
import type { SiteCostsRead } from '../lib/developments/siteCosts'
import { EMPTY_CARD_CHARGE_EXCLUSIONS } from '../lib/jobs/cardChargeAllocationFilter'
import { makeUseAuthValue, renderWithProviders, settle } from '../test/renderSmokeMocks'

const authState: { current: Record<string, unknown> } = { current: { role: 'dev' } }
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => makeUseAuthValue(authState.current),
  useOptionalAuth: () => makeUseAuthValue(authState.current),
}))
vi.mock('react-router-dom', async (orig) => ({ ...(await orig<typeof import('react-router-dom')>()), useParams: () => ({ id: 'dev-zz' }) }))

const served: { data: DevelopmentPageData | null } = { data: null }
vi.mock('../lib/developments/fetchDevelopmentPage', () => ({
  fetchDevelopmentPage: async () => {
    if (!served.data) throw new Error('no data served')
    return served.data
  },
}))

const costs: SiteCostsRead = {
  state: 'read',
  byJobId: new Map(),
  rows: {
    jobIds: ['j1', 'j2'],
    invoiceAmounts: [{ job_id: 'j1', invoice_amount: 1200 }],
    cardAlloc: [{ job_id: 'j1', id: 'a1', mercury_transaction_id: 'tx1', amount: -412.5, note: null, mercury_transactions: { posted_at: '2026-10-02T15:00:00Z', counterparty_name: 'Lowe’s', amount: -412.5 } }],
    cardExclusions: EMPTY_CARD_CHARGE_EXCLUSIONS,
    tally: [],
    otherCharges: [],
    sheets: [],
    items: [],
    settings: [],
    supplyAlloc: [{ job_id: 'j1', pct: 100, supply_house_invoices: { invoice_number: '1001', invoice_date: '2026-10-01', amount: 1200, is_paid: true, on_job_account: false, supply_houses: { name: 'Ferguson' } } }],
  },
}
const hookCalls = { costs: [] as boolean[], labor: [] as boolean[], timeline: [] as boolean[], overhead: [] as boolean[], values: [] as boolean[] }
vi.mock('../hooks/useSiteCosts', () => ({
  useSiteCosts: (_ids: string[], enabled: boolean) => {
    hookCalls.costs.push(enabled)
    return enabled ? costs : undefined
  },
}))
vi.mock('../hooks/useSiteLabor', () => ({
  useSiteLabor: (_ids: string[], enabled: boolean) => {
    hookCalls.labor.push(enabled)
    return enabled ? { state: 'read', labor: { byJobId: new Map(), siteDays: 0, people: 0, daysKnown: true } } : undefined
  },
}))
vi.mock('../hooks/useSiteOverhead', () => ({
  useSiteOverhead: (_ids: string[], enabled: boolean) => {
    hookCalls.overhead.push(enabled)
    return enabled ? { state: 'read', byJobId: new Map([['j1', { usd: 120.5, days: 1, lines: [{ ymd: '2026-10-02', jobHours: 8, fieldHours: 8, poolUsd: 120.5, shareUsd: 120.5 }] }]]) } : { state: 'off' }
  },
}))
vi.mock('../hooks/useSiteValueEvents', () => ({
  useSiteValueEvents: (_ids: string[], enabled: boolean) => {
    hookCalls.values.push(enabled)
    return enabled ? { state: 'read', byJobId: new Map([['j1', [{ dateKey: '2026-10-03', percent: 40, label: 'Report by Dana', jobId: 'j1' }]]]) } : { state: 'off' }
  },
}))
vi.mock('../hooks/useSiteTimeline', () => ({
  useSiteTimeline: (_costs: unknown, enabled: boolean) => {
    hookCalls.timeline.push(enabled)
    return enabled ? { state: 'read', fuelTxIds: new Set(), fuelKnown: true } : { state: 'off' }
  },
}))

function windowWide(px: number) {
  Object.defineProperty(window, 'innerWidth', { value: px, configurable: true, writable: true })
  window.matchMedia = ((query: string) => {
    const max = /\(max-width:\s*(\d+)px\)/.exec(query)
    const min = /\(min-width:\s*(\d+)px\)/.exec(query)
    const matches = (max ? px <= Number(max[1]) : true) && (min ? px >= Number(min[1]) : true) && !!(max || min)
    return { matches, media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false }
  }) as typeof window.matchMedia
}

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
function data(): DevelopmentPageData {
  return {
    development: { id: 'dev-zz', name: 'ZZ Test development', gc_customer_id: null, city: null, notes: null, archived_at: null, created_at: '2026-08-01T00:00:00Z' },
    gcCustomer: null,
    customer: null,
    customers: [],
    historyEntries: [],
    customerContacts: [],
    inIt: { bids: [bid({ id: 'b1', bid_value: 42000 })], jobs: [job({ id: 'j1', revenue: 5000, payments_made: 3000 }), job({ id: 'j2', hcp_number: '957', job_name: 'Lot 5', status: 'working' })] },
    atAddress: { bids: [], jobs: [] },
    requests: [],
    submissionEntries: [],
    bidChanges: [],
    statusEvents: [],
    invoices: [{ id: 'i1', job_id: 'j1', amount: 5000, status: 'open', billed_at: '2026-10-21T00:00:00Z', sent_to_customer_at: null, created_at: '2026-10-21T00:00:00Z' }],
    payments: [{ id: 'p1', job_id: 'j1', amount: 3000, paid_on: '2026-10-25', created_at: '2026-10-25T00:00:00Z', payment_type: 'check', note: null }],
    threadNotes: [],
    bidNotes: [],
    teamMembers: [],
    names: new Map([['u-est', 'Dana']]),
    paySpeed: null,
    twinUserIds: new Set<string>(),
  }
}

async function drawPage(role: string, px = 1280) {
  windowWide(px)
  authState.current = { role }
  served.data = data()
  renderWithProviders(<DevelopmentPage />)
  await settle()
  await screen.findByTestId('development-counts')
}

beforeEach(() => {
  window.localStorage.clear()
  hookCalls.costs.length = 0
  hookCalls.labor.length = 0
  hookCalls.timeline.length = 0
  hookCalls.overhead.length = 0
  hookCalls.values.length = 0
})
afterEach(() => {
  vi.clearAllMocks()
})

describe('the Money look’s Timeline view', () => {
  it('a dev sees three view chips; the Timeline reads only once pressed and draws the jobs with a dated event', async () => {
    await drawPage('dev')
    const views = screen.getByTestId('money-views')
    expect(within(views).getAllByRole('button').map((b) => b.textContent)).toEqual(['Where the money is', 'Scoreboard', 'Timeline'])
    expect(hookCalls.labor.every((e) => !e)).toBe(true)
    expect(hookCalls.timeline.every((e) => !e)).toBe(true)
    expect(hookCalls.overhead.every((e) => !e)).toBe(true)
    expect(hookCalls.values.every((e) => !e)).toBe(true)
    fireEvent.click(screen.getByTestId('money-view-timeline'))
    await settle()
    expect(screen.getByTestId('money-view-timeline').getAttribute('aria-pressed')).toBe('true')
    expect(hookCalls.labor.some((e) => e)).toBe(true)
    expect(hookCalls.timeline.some((e) => e)).toBe(true)
    const chart = await screen.findByTestId('development-timeline')
    const chips = within(chart).getByRole('group', { name: 'Jobs on the chart' })
    // The label is the page's own (no prefix map in the smoke, so the bare J); the job with no dated event is not a chip.
    expect(within(chips).getAllByRole('button').map((b) => b.textContent)).toEqual(['All jobs', 'J956'])
    expect(screen.getByTestId('timeline-scope').textContent).toBe('All 1 job on one chart. 1 job has no dated charge or payment. It is listed under the chart.')
    expect(screen.getByText(/cost to date/).textContent).toContain('Red')
    // The day ledger reads only once the view is open, and its lines draw the amber band (v2.6498).
    expect(hookCalls.overhead.some((e) => e)).toBe(true)
    expect(screen.getByText(/cost to date/).textContent).toContain('Amber')
    expect(screen.getByText(/cost to date/).textContent).toContain('since Feb 19, 2026')
    // The reports read only once the view is open, and a priced job with a percent puts the value line behind its toggle (v2.6499).
    expect(hookCalls.values.some((e) => e)).toBe(true)
    expect(screen.getByLabelText('Value created (right axis)')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Print or save as PDF' })).toBeTruthy()
    expect(window.localStorage.getItem('pt.development.dev-zz.money.view')).toBe('timeline')
  })

  it('a controller sees the Timeline chip too', async () => {
    await drawPage('controller')
    expect(within(screen.getByTestId('money-views')).getAllByRole('button')).toHaveLength(3)
  })

  it('a master sees two chips, and a device that remembered the Timeline opens on the money', async () => {
    window.localStorage.setItem('pt.development.dev-zz.money.view', 'timeline')
    await drawPage('master_technician')
    const views = screen.getByTestId('money-views')
    expect(within(views).getAllByRole('button').map((b) => b.textContent)).toEqual(['Where the money is', 'Scoreboard'])
    expect(screen.queryByTestId('money-view-timeline')).toBeNull()
    expect(screen.getByTestId('money-view-money').getAttribute('aria-pressed')).toBe('true')
    expect(screen.queryByTestId('development-timeline')).toBeNull()
    expect(hookCalls.timeline.every((e) => !e)).toBe(true)
  })

  it('at 375 wide the Timeline opens with its chips wrapping and nothing fixed wider than the screen', async () => {
    await drawPage('dev', 375)
    fireEvent.click(screen.getByTestId('money-view-timeline'))
    await settle()
    const chart = await screen.findByTestId('development-timeline')
    expect((within(chart).getByTestId('timeline-jobs') as HTMLElement).style.flexWrap).toBe('wrap')
    for (const el of Array.from(chart.querySelectorAll<HTMLElement>('[style]'))) {
      const w = el.style.width
      if (w.endsWith('px')) expect(Number.parseFloat(w)).toBeLessThanOrEqual(375)
    }
  })
})
