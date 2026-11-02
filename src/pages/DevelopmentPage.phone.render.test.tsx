// @vitest-environment jsdom
/**
 * The Development page at a phone's width (punch list #208, the owner's walk of 2026-10-30; the fixes
 * v2.6182, held here since v2.6324). The window is 375 wide, so `useMatchMedia` answers the page's own
 * phone query and the page hands `phone` down itself: the five count tiles sit two a row with the fifth
 * spanning the last row, so no cell is blank; and the History composer's six Source chips sit three a
 * row, so *Note* never wraps onto a line of its own. The same page at 1280 wide is the control. The
 * fetch is mocked at its seam; the rows are made up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import DevelopmentPage from './DevelopmentPage'
import type { DevelopmentPageData } from '../lib/developments/fetchDevelopmentPage'
import type { MemberBid, MemberJob } from '../lib/developments/overview'
import { HISTORY_SOURCES } from '../lib/developments/history'
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

/**
 * A window this many CSS pixels wide: `innerWidth` says so, and `matchMedia` answers every
 * `(max-width: …)` / `(min-width: …)` query the way a real screen of that width would, so the page's
 * own `useMatchMedia(DEVELOPMENT_PHONE_QUERY)` decides `phone`, not the test.
 */
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
    inIt: { bids: [bid({ id: 'b1', bid_value: 42000 })], jobs: [job({ id: 'j1', revenue: 5000, payments_made: 3000 })] },
    atAddress: { bids: [], jobs: [] },
    requests: [],
    submissionEntries: [],
    bidChanges: [],
    statusEvents: [],
    invoices: [{ id: 'i1', job_id: 'j1', amount: 5000, status: 'open', billed_at: '2026-10-21T00:00:00Z', sent_to_customer_at: null, created_at: '2026-10-21T00:00:00Z' }],
    payments: [],
    threadNotes: [],
    bidNotes: [],
    teamMembers: [],
    names: new Map([['u-est', 'Dana']]),
    paySpeed: null,
  }
}

/** The grid cells the tiles take: a spanning tile takes the row, the rest one cell each. */
const cellsTaken = (tiles: Element[]) => tiles.reduce((n, t) => n + (t.getAttribute('data-spans') === '1' ? 2 : 1), 0)

async function drawPage(role: string) {
  authState.current = { role }
  served.data = data()
  renderWithProviders(<DevelopmentPage />)
  await settle()
  await screen.findByTestId('development-counts')
}

beforeEach(() => {
  window.localStorage.clear()
})
afterEach(() => {
  vi.clearAllMocks()
})

describe('DevelopmentPage at 375 wide', () => {
  it('the five count tiles sit two a row and the fifth spans the last row, so no cell is blank', async () => {
    windowWide(375)
    await drawPage('dev')
    const grid = screen.getByTestId('development-counts')
    expect(grid.style.gridTemplateColumns).toBe('repeat(2, minmax(0, 1fr))')
    const tiles = Array.from(grid.querySelectorAll('.developmentCountTile'))
    expect(tiles).toHaveLength(5)
    expect(tiles.slice(0, 4).map((t) => t.getAttribute('data-spans'))).toEqual([null, null, null, null])
    const last = tiles[4] as HTMLElement
    expect(last.getAttribute('data-testid')).toBe('development-count-openOnBills')
    expect(last.getAttribute('data-spans')).toBe('1')
    expect(last.style.gridColumn).toBe('1 / -1')
    // Three rows of two: six cells, six taken.
    expect(cellsTaken(tiles) % 2).toBe(0)
  })

  it("an estimator's three tiles: the third spans the last row the same way", async () => {
    windowWide(375)
    await drawPage('estimator')
    const tiles = Array.from(screen.getByTestId('development-counts').querySelectorAll('.developmentCountTile'))
    expect(tiles).toHaveLength(3)
    expect(tiles[2]!.getAttribute('data-spans')).toBe('1')
    expect((tiles[2] as HTMLElement).style.gridColumn).toBe('1 / -1')
    expect(cellsTaken(tiles) % 2).toBe(0)
  })

  it("the composer's six Source chips sit three a row, Note among them, none on a line of its own", async () => {
    windowWide(375)
    await drawPage('dev')
    fireEvent.click(screen.getByRole('button', { name: 'Write a line' }))
    const sources = await screen.findByRole('radiogroup', { name: 'Source' })
    expect(sources.style.display).toBe('grid')
    expect(sources.style.gridTemplateColumns).toBe('repeat(3, minmax(0, 1fr))')
    expect(sources.style.width).toBe('100%')
    const chips = within(sources).getAllByRole('radio')
    expect(chips.map((c) => c.textContent)).toEqual(HISTORY_SOURCES.map((s) => s.label))
    expect(chips).toHaveLength(6)
    const note = within(sources).getByTestId('history-source-note')
    expect(note.parentElement).toBe(sources)
    expect(note.style.justifyContent).toBe('center')
  })
})

describe('DevelopmentPage at 1280 wide, the control', () => {
  it('the five tiles sit in one row of five, nothing spans, and the Source chips are one wrapping row', async () => {
    windowWide(1280)
    await drawPage('dev')
    const grid = screen.getByTestId('development-counts')
    expect(grid.style.gridTemplateColumns).toBe('repeat(5, minmax(0, 1fr))')
    const tiles = Array.from(grid.querySelectorAll('.developmentCountTile'))
    expect(tiles).toHaveLength(5)
    expect(tiles.every((t) => t.getAttribute('data-spans') === null)).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Write a line' }))
    const sources = await screen.findByRole('radiogroup', { name: 'Source' })
    expect(sources.style.display).toBe('inline-flex')
    expect(sources.style.flexWrap).toBe('wrap')
    expect(within(sources).getAllByRole('radio')).toHaveLength(6)
  })
})
