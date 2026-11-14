// @vitest-environment jsdom
/**
 * `/lien-desk` (punch list #182, the Lien desk's PR 1): the office roles see the desk drawn as a page on the view the
 * address names, a view press writes the address, Records for an owner opens from its door in the address, and a role
 * outside the set lands on the Dashboard. The desk's own behavior is held by `jobs/LienDeskModal.render.test.tsx`; this
 * is the page's wiring.
 */
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { renderWithProviders, settle } from '../test/renderSmokeMocks'
import { buildLienDeskQueue, summarizeLienDeskForNeedsYou, type LienNoticeMonthRow } from '../lib/jobs/lienDesk'
import { EMPTY_LIEN_RETAINAGE_QUEUE } from '../lib/jobs/lienDeskRetainage'
import type { LienDeskData } from '../hooks/useLienDeskData'
import LienDeskPage from './LienDeskPage'

const auth = vi.hoisted(() => ({ role: 'dev' as string | null }))
const screenSize = vi.hoisted(() => ({ phone: false }))
const desk = vi.hoisted(() => ({ data: null as unknown, refetch: vi.fn() }))
const cache = vi.hoisted(() => ({ fetchScopeIfNeeded: vi.fn(async () => {}), runFetchScopes: vi.fn(async () => {}) }))

vi.mock('../hooks/useAuth', async () => {
  const { makeUseAuthValue } = await import('../test/renderSmokeMocks')
  return {
    useAuth: () => makeUseAuthValue({ role: auth.role, profileName: 'Taunya' }),
    useOptionalAuth: () => makeUseAuthValue({ role: auth.role, profileName: 'Taunya' }),
    AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  }
})
vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../hooks/useIsMobile', () => ({ useIsMobile: () => screenSize.phone }))
vi.mock('../lib/people/fetchActiveUsers', () => ({ fetchActiveUsers: async () => ({ data: [], error: null }) }))
vi.mock('../contexts/JobsListCacheContext', () => ({
  buildJobsListCacheKey: (userId: string, customerFilter: string | null) => `${userId}:${customerFilter || 'all'}`,
  useJobsListCache: () => ({ jobs: [], setJobs: () => {}, jobsListLoading: false, jobsListDataKey: 'smoke-auth-user-1:all', fetchScopeIfNeeded: cache.fetchScopeIfNeeded, runFetchScopes: cache.runFetchScopes, mergedScopes: new Set(['billed_all']) }),
  JobsListCacheProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}))
vi.mock('../hooks/useLienDeskData', () => ({ useLienDeskData: () => ({ data: desk.data, loading: false, refetch: desk.refetch }) }))
vi.mock('../hooks/useLienCalendarRows', () => ({ useLienCalendarRows: () => ({ rows: [], reloadPromises: () => {} }) }))
vi.mock('../hooks/useForecastWorkMonths', () => ({ useForecastWorkMonths: () => ({ byJob: null, loading: false }) }))
vi.mock('../lib/physicalInvoiceIssuer', () => ({ getPhysicalInvoiceIssuerDraft: () => null, fetchPhysicalInvoiceIssuerFromAppSettings: async () => undefined }))
vi.mock('../hooks/useLegalMatters', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../hooks/useLegalMatters')>()),
  useLegalMatters: () => ({ available: false, readState: 'ok', loading: false, firm: null, firms: [], activeFirms: [], countiesByFirm: new Map(), matters: [], byPayerKey: new Map(), byJobId: new Map(), jobIdsByMatter: new Map(), entriesByMatter: new Map(), documentsByMatter: new Map(), recipients: [], firmPaused: false, reload: async () => {} }),
}))
// The desk's own seams, as its render test sets them: the pay page, Bill Customer, the supply houses, the releases, the signing code, the pad.
vi.mock('../hooks/useNoticePayPage', () => ({ useNoticePayPage: () => ({ rows: [], assets: {}, bills: [], job: null, loading: false, refresh: () => {} }) }))
vi.mock('../contexts/BillCustomerModalContext', () => ({ useBillCustomerModal: () => null }))
vi.mock('../hooks/useLienJobSuppliers', () => ({ useLienJobSuppliers: () => ({ byJob: new Map(), loaded: true, reload: () => {} }) }))
vi.mock('../hooks/useNoticeReleases', () => ({ useNoticeReleases: () => ({ byId: new Map(), loaded: true, reload: () => {} }) }))
vi.mock('../lib/jobs/lienDeskSignIo', async () => ({
  ...(await vi.importActual<typeof import('../lib/jobs/lienDeskSignIo')>('../lib/jobs/lienDeskSignIo')),
  lienSignCodeStatus: async () => null,
}))
vi.mock('signature_pad', () => ({
  default: class {
    constructor(_c: HTMLCanvasElement) {}
    off() {}
    on() {}
    isEmpty() {
      return true
    }
    toDataURL() {
      return 'data:image/png;base64,AAAA'
    }
    toData() {
      return []
    }
    fromData() {}
    clear() {}
  },
}))

const TODAY = '2026-09-14'

function row(job_id: string, work_month: string, deadline: string): LienNoticeMonthRow {
  return { job_id, work_month, deadline, approved_hours: 82.6, noticed: false, open_balance: 33_500, customer_id: 'axo', gc_customer_id: 'lowbeck', property_kind: '', has_owner: false, desk_item_id: null, desk_status: null, desk_months: null }
}

function deskData(): LienDeskData {
  const rows = [row('j650', '2026-06', '2026-09-15'), row('j650', '2026-07', '2026-10-15')]
  const queue = buildLienDeskQueue(rows, [], { lowbeck: 'ask' }, TODAY)
  return {
    queue,
    summary: summarizeLienDeskForNeedsYou(queue),
    rows,
    items: [],
    affidavits: { entries: [], piles: { needs_property: [], to_draft: [], awaiting: [], ready: [], held: [], filed: [], missed: [] }, counts: { needs_property: 0, to_draft: 0, awaiting: 0, ready: 0, held: 0, filed: 0, missed: 0 } },
    affidavitRows: [],
    retainage: EMPTY_LIEN_RETAINAGE_QUEUE(),
    retainageRows: [],
    letterTwoByJob: {},
    ownerCallByJob: {},
    jobsById: {
      j650: { id: 'j650', hcp_number: '650', click_number: null, job_name: 'AXO Schertz', job_address: '1204 Elwick Rd, Schertz, TX', customer_id: 'axo', customer_name: 'AXO Schertz', gc_customer_id: 'lowbeck', customer_address_id: null, revenue: 33_500, payments_made: 0, master_user_id: null, last_work_date: null },
    },
    gcsById: { lowbeck: { id: 'lowbeck', name: 'Lowbeck Contracting', address: '2904 Corporate Cr, Flower Mound, TX', email: 'office@lowbeck.test', policy: 'ask', policyNote: '' } },
    addressesById: {},
    ownerByJob: {},
    promisesByJob: {},
    gcsWithPriorNotice: new Set(),
    gcsHeldBefore: new Set(),
    claimCorrectionsByJob: {},
    filingsByJob: {},
  }
}

function Where() {
  const l = useLocation()
  return <output data-testid="where">{l.pathname}{l.search}</output>
}

/** The MemoryRouter starts at `/`; the index route takes us to the address under test, as a pasted link would. */
function Harness({ start }: { start: string }) {
  return (
    <>
      <Routes>
        <Route path="/" element={<Navigate to={start} replace />} />
        <Route path="/lien-desk" element={<LienDeskPage />} />
        <Route path="/dashboard" element={<p>the Dashboard</p>} />
        <Route path="/jobs" element={<p>the Pipeline</p>} />
      </Routes>
      <Where />
    </>
  )
}

beforeEach(() => {
  auth.role = 'dev'
  screenSize.phone = false
  desk.data = deskData()
  desk.refetch.mockClear()
  cache.fetchScopeIfNeeded.mockClear()
  cache.runFetchScopes.mockClear()
})
afterEach(cleanup)

describe('LienDeskPage (/lien-desk)', () => {
  it('a dev lands on the view the address names, drawn as a page with a door back and no window chrome', async () => {
    const { container } = renderWithProviders(<Harness start="/lien-desk?tab=affidavits" />)
    await settle()
    await waitFor(() => expect(container.querySelector('[data-lien-desk-panel="page"]')).not.toBeNull())
    expect(screen.getByRole('tab', { name: /^Affidavits/ }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tab', { name: 'By paper' }).getAttribute('aria-selected')).toBe('true')
    expect(container.querySelector('[data-lien-desk-back]')).not.toBeNull()
    expect(screen.queryByRole('dialog', { name: 'Lien desk' })).toBeNull()
    expect(screen.getByRole('region', { name: 'Lien desk' })).toBeTruthy()
    expect(screen.queryByLabelText('Close')).toBeNull()
    expect(screen.queryByLabelText('Full screen')).toBeNull()
    // The page asked the warm cache for the billed scope, nothing more.
    expect(cache.fetchScopeIfNeeded).toHaveBeenCalledWith('billed_all', null)
    expect(cache.runFetchScopes).not.toHaveBeenCalled()
    // The address it opened on is left as it was.
    expect(screen.getByTestId('where').textContent).toBe('/lien-desk?tab=affidavits')
  })

  it('a view press writes the address; To do leaves it bare; Notices carries the open notice', async () => {
    renderWithProviders(<Harness start="/lien-desk" />)
    await settle()
    await waitFor(() => expect(screen.getByRole('tab', { name: /^To do/ }).getAttribute('aria-selected')).toBe('true'))
    expect(screen.getByTestId('where').textContent).toBe('/lien-desk')
    fireEvent.click(screen.getByRole('tab', { name: 'By date' }))
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/lien-desk?tab=deadlines'))
    fireEvent.click(screen.getByRole('tab', { name: 'By paper' }))
    // On a computer the Notices list opens on its first notice, and the address names it.
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/lien-desk?tab=notices&job=j650'))
    fireEvent.click(screen.getByRole('tab', { name: /^Timeline/ }))
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/lien-desk?tab=timeline'))
    fireEvent.click(screen.getByRole('tab', { name: /^To do/ }))
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/lien-desk'))
  })

  it('a pasted notice address opens that notice and keeps the address', async () => {
    renderWithProviders(<Harness start="/lien-desk?tab=notices&job=j650" />)
    await settle()
    await waitFor(() => expect(screen.getByRole('tab', { name: /^Notices/ }).getAttribute('aria-selected')).toBe('true'))
    await settle()
    expect(screen.getByTestId('where').textContent).toBe('/lien-desk?tab=notices&job=j650')
  })

  it('the ← door is drawn before the title and goes back', async () => {
    const { container } = renderWithProviders(<Harness start="/lien-desk" />)
    await settle()
    await waitFor(() => expect(container.querySelector('[data-lien-desk-back]')).not.toBeNull())
    // The harness arrives by its index route's redirect, so there is a page behind: the door reads Back (a cold open reads Pipeline).
    const door = container.querySelector('[data-lien-desk-back]') as HTMLButtonElement
    expect(['Back', 'Back to the Pipeline']).toContain(door.getAttribute('aria-label'))
    const title = screen.getByRole('heading', { name: /Lien desk/ })
    expect(door.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('on a phone (PR 3): the Notices list is the whole desk; a notice opens as a new entry with ← Notices, and ← Notices goes back to the list', async () => {
    screenSize.phone = true
    const { container } = renderWithProviders(<Harness start="/lien-desk?tab=notices" />)
    await settle()
    await waitFor(() => expect(container.querySelector('[data-lien-desk-list]')).not.toBeNull())
    // The list writes nothing: no notice is picked for it.
    expect(screen.getByTestId('where').textContent).toBe('/lien-desk?tab=notices')
    fireEvent.click(screen.getByRole('button', { name: /AXO Schertz/ }))
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/lien-desk?tab=notices&job=j650'))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Back to the notices' })).toBeTruthy())
    expect(container.querySelector('[data-lien-desk-list]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Back to the notices' }))
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/lien-desk?tab=notices'))
    await waitFor(() => expect(container.querySelector('[data-lien-desk-list]')).not.toBeNull())
  })

  it('on a phone, a notice reached by a link goes to the list in its own place', async () => {
    screenSize.phone = true
    const { container } = renderWithProviders(<Harness start="/lien-desk?tab=notices&job=j650&pile=to_draft" />)
    await settle()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Back to the notices' })).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Back to the notices' }))
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/lien-desk?tab=notices&pile=to_draft'))
    await waitFor(() => expect(container.querySelector('[data-lien-desk-list]')).not.toBeNull())
  })

  it('a role outside the office set lands on the Dashboard', async () => {
    auth.role = 'estimator'
    renderWithProviders(<Harness start="/lien-desk" />)
    await settle()
    await waitFor(() => expect(screen.getByText('the Dashboard')).toBeTruthy())
  })
})
