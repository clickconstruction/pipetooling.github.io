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
// Payoffs reads no lien unless a test files one, so the strip is drawn only where a test asks for it.
const payoffs = vi.hoisted(() => ({ filed: false }))
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
vi.mock('../lib/jobs/lienPayoffIo', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/jobs/lienPayoffIo')>()),
  // A made-up filed lien on a made-up job, paid in full and still on record.
  readLienPayoffFacts: async (todayYmd: string) => ({
    affidavits: payoffs.filed ? [{ id: 'a1', job_id: 'zz1', amount: 100, county: 'Travis', recording_number: '2026-0000001', filed_at: '2026-09-01' }] : [],
    releases: [],
    jobs: payoffs.filed ? [{ id: 'zz1', hcp_number: null, click_number: '9001', job_name: 'ZZ Test house', job_address: '1 Sample Street', customer_id: 'zc1', customer_name: 'ZZ Test customer' }] : [],
    openByJob: {},
    paymentsByJob: {},
    todayYmd,
  }),
}))
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
    affidavits: { entries: [], piles: { needs_property: [], needs_notice: [], to_draft: [], awaiting: [], ready: [], held: [], filed: [], missed: [] }, counts: { needs_property: 0, needs_notice: 0, to_draft: 0, awaiting: 0, ready: 0, held: 0, filed: 0, missed: 0 } },
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
    claimCorrectionsByJob: {}, affidavitMonthsByJob: {},
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
  payoffs.filed = false
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
    expect(screen.getByRole('tab', { name: /^Lien affidavits/ }).getAttribute('aria-selected')).toBe('true')
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
    await waitFor(() => expect(screen.getByRole('tab', { name: /^Lien desk/ }).getAttribute('aria-selected')).toBe('true'))
    expect(screen.getByTestId('where').textContent).toBe('/lien-desk')
    fireEvent.click(screen.getByRole('tab', { name: 'By date' }))
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/lien-desk?tab=deadlines'))
    fireEvent.click(screen.getByRole('tab', { name: 'By paper' }))
    // On a computer the Notices list opens on its first notice, and the address names it.
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/lien-desk?tab=notices&job=j650'))
    fireEvent.click(screen.getByRole('tab', { name: /^By job/ }))
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/lien-desk?tab=timeline'))
    fireEvent.click(screen.getByRole('tab', { name: /^Lien desk/ }))
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/lien-desk'))
  })

  it('a pasted notice address opens that notice and keeps the address', async () => {
    renderWithProviders(<Harness start="/lien-desk?tab=notices&job=j650" />)
    await settle()
    await waitFor(() => expect(screen.getByRole('tab', { name: /^Monthly notices/ }).getAttribute('aria-selected')).toBe('true'))
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

  it('on a phone a row’s job opens as a history entry of its own at the same address: Back closes it, and its press opens the notice with Back returning to the job (punch list #352, PR 4)', async () => {
    screenSize.phone = true
    const { container } = renderWithProviders(<Harness start="/lien-desk" />)
    await settle()
    await waitFor(() => expect(container.querySelector('[data-lien-next-up-open]')).not.toBeNull())
    fireEvent.click(container.querySelector('[data-lien-next-up-open]')!)
    await waitFor(() => expect(container.querySelector('[data-lien-job-screen]')).not.toBeNull())
    // The address did not move: the open row rides in the entry's state.
    expect(screen.getByTestId('where').textContent).toBe('/lien-desk')
    fireEvent.click(screen.getByRole('button', { name: 'Back to the list' }))
    await waitFor(() => expect(container.querySelector('[data-lien-job-screen]')).toBeNull())
    expect(container.querySelector('[data-lien-do-now]')).not.toBeNull()
    // Open it again and press: the notice is a new entry, and its way back lands on the job's screen.
    fireEvent.click(container.querySelector('[data-lien-next-up-open]')!)
    await waitFor(() => expect(container.querySelector('[data-lien-job-screen-act]')).not.toBeNull())
    fireEvent.click(container.querySelector('[data-lien-job-screen-act]')!)
    await waitFor(() => expect(screen.getByTestId('where').textContent).toContain('tab=notices&job=j650'))
    expect(container.querySelector('[data-lien-job-screen]')).toBeNull()
    fireEvent.click(await screen.findByRole('button', { name: 'Back to the notices' }))
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/lien-desk'))
    await waitFor(() => expect(container.querySelector('[data-lien-job-screen]')).not.toBeNull())
    // A view press from there drops the open row, so coming back to the first view shows the list.
    fireEvent.click(screen.getByRole('button', { name: 'Back to the list' }))
    await waitFor(() => expect(container.querySelector('[data-lien-job-screen]')).toBeNull())
  })

  it('on a phone a stage of the flow is a history entry of its own at the same address (punch list #428): a job opened from it returns to it, a cell takes its place, and ‹ The flow goes back to the flow', async () => {
    screenSize.phone = true
    window.localStorage.setItem('pipetooling_lien_desk_phone_view', 'flow')
    try {
      const { container } = renderWithProviders(<Harness start="/lien-desk" />)
      await settle()
      const full = () => container.querySelector<HTMLElement>('[data-lien-board-phone-flow] [data-lien-board-stage]:not([data-empty])')
      await waitFor(() => expect(full()).not.toBeNull())
      const key = full()!.getAttribute('data-lien-board-stage')!
      fireEvent.click(full()!)
      const line = () => container.querySelector<HTMLElement>('[data-lien-board-line]')
      await waitFor(() => expect(line()?.getAttribute('data-lien-board-line')).toBe(key))
      // The address did not move: the stage rides in the entry's state, as the open row does.
      expect(screen.getByTestId('where').textContent).toBe('/lien-desk')
      expect(container.querySelector('[data-lien-board-phone-flow]')).toBeNull()
      // A job opened from the stage is the next entry. Its way back returns to the stage's papers, the line still pinned.
      fireEvent.click(container.querySelector('[data-lien-next-up-open]')!)
      await waitFor(() => expect(container.querySelector('[data-lien-job-screen]')).not.toBeNull())
      fireEvent.click(screen.getByRole('button', { name: 'Back to the list' }))
      await waitFor(() => expect(container.querySelector('[data-lien-job-screen]')).toBeNull())
      expect(line()?.getAttribute('data-lien-board-line')).toBe(key)
      // A cell moves along the flow in the same entry, so the way back is still one step to the flow.
      const other = Array.from(line()!.querySelectorAll<HTMLElement>('[data-lien-board-line-cell]')).find((c) => c.getAttribute('data-lit') !== 'yes')!
      const otherKey = other.getAttribute('data-lien-board-line-cell')!
      fireEvent.click(other)
      await waitFor(() => expect(line()?.getAttribute('data-lien-board-line')).toBe(otherKey))
      fireEvent.click(line()!.querySelector<HTMLElement>('[data-lien-board-line-back]')!)
      await waitFor(() => expect(line()).toBeNull())
      expect(container.querySelector('[data-lien-board-phone-flow]')).not.toBeNull()
      expect(container.querySelector(`[data-lien-board-stage="${otherKey}"]`)!.getAttribute('data-lit')).toBe('yes')
      expect(screen.getByTestId('where').textContent).toBe('/lien-desk')
    } finally {
      window.localStorage.clear()
    }
  })

  it('Payoffs stands in its own row over the desk on a computer, and on a phone scrolls away with the list (punch list #428)', async () => {
    payoffs.filed = true
    // A computer: the strip is in the page's first row, over the desk, and the desk draws no slot.
    const wide = renderWithProviders(<Harness start="/lien-desk" />)
    await settle()
    await waitFor(() => expect(wide.container.querySelector('[data-lien-payoffs-strip]')).not.toBeNull())
    expect(wide.container.querySelector('[data-lien-payoffs]')!.contains(wide.container.querySelector('[data-lien-payoffs-strip]'))).toBe(true)
    expect(wide.container.querySelector('[data-lien-desk-list-top]')).toBeNull()
    wide.unmount()

    // A phone, on To do: one strip, inside the one scroller and first in it, and the row over the desk is empty.
    screenSize.phone = true
    const phone = renderWithProviders(<Harness start="/lien-desk" />)
    await settle()
    await waitFor(() => expect(phone.container.querySelector('[data-lien-payoffs-strip]')).not.toBeNull())
    const strip = phone.container.querySelector<HTMLElement>('[data-lien-payoffs-strip]')!
    expect(phone.container.querySelectorAll('[data-lien-payoffs-strip]')).toHaveLength(1)
    const scroller = phone.container.querySelector<HTMLElement>('[data-lien-do-now]')!
    expect(scroller.firstElementChild!.contains(strip)).toBe(true)
    expect(phone.container.querySelector('[data-lien-payoffs]')!.contains(strip)).toBe(false)
    phone.unmount()

    // A phone, an open notice: no list is up, so the strip is not drawn over the paper.
    const paper = renderWithProviders(<Harness start="/lien-desk?tab=notices&job=j650" />)
    await settle()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Back to the notices' })).toBeTruthy())
    expect(paper.container.querySelector('[data-lien-payoffs-strip]')).toBeNull()
    // Back at the list the strip is there again, first in the list.
    fireEvent.click(screen.getByRole('button', { name: 'Back to the notices' }))
    await waitFor(() => expect(paper.container.querySelector('[data-lien-desk-list] [data-lien-payoffs-strip]')).not.toBeNull())
    expect(paper.container.querySelector<HTMLElement>('[data-lien-desk-list]')!.firstElementChild!.contains(paper.container.querySelector('[data-lien-payoffs-strip]'))).toBe(true)
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
