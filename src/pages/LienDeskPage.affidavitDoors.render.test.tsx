// @vitest-environment jsdom
/**
 * `/lien-desk`, the doors to an affidavit (punch list #335, Also seen): where the Lien window's header button and the
 * Accounts Receivable chip land. The page's other wiring is held by `LienDeskPage.render.test.tsx`, whose mocks these are.
 */
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { renderWithProviders, settle } from '../test/renderSmokeMocks'
import { buildLienDeskQueue, summarizeLienDeskForNeedsYou } from '../lib/jobs/lienDesk'
import { buildLienAffidavitQueue, type LienAffidavitRow } from '../lib/jobs/lienDeskAffidavits'
import { lienArChipFor, lienArChipHref, type LienArJobInput } from '../lib/jobs/lienArChip'
import type { LienNextUpRow } from '../lib/jobs/lienNextUp'
import { lienWindowDeskDoorHref } from '../lib/lien/lienWindowDeskDoor'
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

// The Lien window, stood in for by its one door back to the desk: the real window's button calls `onOpenLienDesk(job.id, kind)`
// (held by `LienInstrumentsModal.render.test.tsx`), and what this file holds is where the page sends that call.
vi.mock('../components/jobs/LienInstrumentsModal', () => ({
  default: ({ open, job, onOpenLienDesk }: { open: boolean; job: { id: string } | null; onOpenLienDesk?: (jobId: string, kind: 'notice' | 'retainage' | 'affidavit') => void }) =>
    open && job ? (
      <div data-testid="lien-window" data-job={job.id}>
        <button type="button" onClick={() => onOpenLienDesk?.(job.id, 'affidavit')}>
          Open it on the Lien desk ›
        </button>
      </div>
    ) : null,
}))
vi.mock('../lib/fetchJobWithDetailsById', () => ({ fetchJobWithDetailsById: vi.fn(async (id: string) => ({ id, master_user_id: null })) }))

const TODAY = '2026-09-14'

// Two made-up jobs with an affidavit to draft. The first by its day is the row the list opens on by itself.
const affRow = (job_id: string, deadline: string): LienAffidavitRow => ({ job_id, last_month: '2026-05', deadline, is_sub: true, noticed: true, filed: false, open_balance: 12_000, customer_id: 'c1', gc_customer_id: 'g1', property_kind: 'non_residential', has_owner: true, has_legal: true, homestead: false, desk_item_id: null, desk_status: null })
const jobRow = (id: string, number: string, name: string) => ({ id, hcp_number: number, click_number: null, job_name: name, job_address: '12 Made-up Way, Nowhere, TX', customer_id: 'c1', customer_name: name, gc_customer_id: 'g1', customer_address_id: null, revenue: 12_000, payments_made: 0, master_user_id: null, last_work_date: '2026-05-20' })

function deskData(): LienDeskData {
  const affidavitRows = [affRow('jFirst', '2026-09-15'), affRow('jSecond', '2026-09-30')]
  const queue = buildLienDeskQueue([], [], { g1: 'ask' }, TODAY)
  return {
    queue,
    summary: summarizeLienDeskForNeedsYou(queue),
    rows: [],
    items: [],
    affidavits: buildLienAffidavitQueue(affidavitRows, [], TODAY),
    affidavitRows,
    retainage: EMPTY_LIEN_RETAINAGE_QUEUE(),
    retainageRows: [],
    letterTwoByJob: {},
    ownerCallByJob: {},
    jobsById: { jFirst: jobRow('jFirst', '901', 'Made-up First'), jSecond: jobRow('jSecond', '902', 'Made-up Second') },
    gcsById: { g1: { id: 'g1', name: 'Made-up Contracting', address: '1 Made-up Plaza, Nowhere, TX', email: 'office@madeup.test', policy: 'ask', policyNote: '' } },
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

const pane = () => document.querySelector('[data-lien-affidavit-pane]') as HTMLElement | null
const offListNote = () => document.querySelector('[data-lien-desk-off-list]') as HTMLElement | null

beforeEach(() => {
  auth.role = 'dev'
  screenSize.phone = false
  desk.data = deskData()
})
afterEach(cleanup)

/**
 * A door to an affidavit lands on the job's row (punch list #335, Also seen). The Lien window's header button for an
 * affidavit to draft, approve or review opened the desk's Affidavits list with no job, so the list opened on its own
 * first row, another job's paper. The desk has read a job for an affidavit since v2.7744; the two openers never sent it.
 */
describe('LienDeskPage: a door to an affidavit lands on the job’s row (punch list #335)', () => {
  it('the list by itself opens on its first row, which is why a door with no job landed on another job', async () => {
    renderWithProviders(<Harness start="/lien-desk?tab=affidavits" />)
    await settle()
    await waitFor(() => expect(pane()).not.toBeNull())
    expect(pane()!.textContent).toContain('Made-up First')
  })

  it('the header’s button: the Lien window of the second job sends the desk to that job’s affidavit, not the list’s first', async () => {
    // The second job is not on Monthly notices, so its link there offers its Lien window: the page opens the window on that job.
    renderWithProviders(<Harness start="/lien-desk?tab=notices&job=jSecond" />)
    await settle()
    await waitFor(() => expect(offListNote()).not.toBeNull())
    fireEvent.click(within(offListNote()!).getByRole('button', { name: 'Open its Lien window ›' }))
    const win = await screen.findByTestId('lien-window')
    expect(win.getAttribute('data-job')).toBe('jSecond')
    fireEvent.click(within(win).getByRole('button', { name: 'Open it on the Lien desk ›' }))
    await waitFor(() => expect(pane()).not.toBeNull())
    await settle()
    expect(screen.queryByTestId('lien-window')).toBeNull()
    expect(within(screen.getByRole('tablist', { name: 'Kind of paper' })).getByRole('tab', { name: /^Lien affidavits/ }).getAttribute('aria-selected')).toBe('true')
    expect(pane()!.textContent).toContain('Made-up Second')
    expect(pane()!.textContent).not.toContain('Made-up First')
    expect(offListNote()).toBeNull()
  })

  it('the Accounts Receivable chip’s door lands the same way', async () => {
    const row = { key: 'affidavit:jSecond', kind: 'affidavit', jobId: 'jSecond', gcId: 'g1', title: '902 · Made-up Second', sub: 'Affidavit to draft', dueOn: '2026-09-30', daysLeft: 16, severity: 'quiet', group: 'coming', action: 'draft', button: null, target: { open: 'affidavits', jobId: 'jSecond' } } as LienNextUpRow
    const chip = lienArChipFor({ jobId: 'jSecond', todayYmd: TODAY, nextUp: [row], entry: null, affidavit: null, filings: [], piecesByFiling: {}, letterTwo: null } as LienArJobInput)!
    // One address for both doors.
    expect(lienArChipHref(chip.door)).toBe('/lien-desk?tab=affidavits&job=jSecond')
    expect(lienWindowDeskDoorHref('jSecond', 'affidavit')).toBe(lienArChipHref(chip.door))
    renderWithProviders(<Harness start={lienArChipHref(chip.door)} />)
    await settle()
    await waitFor(() => expect(pane()).not.toBeNull())
    expect(pane()!.textContent).toContain('Made-up Second')
    expect(pane()!.textContent).not.toContain('Made-up First')
  })

  it('a job whose affidavit is not on the list lands on the list with a line that says so, and no other job opens', async () => {
    renderWithProviders(<Harness start={lienWindowDeskDoorHref('jGone', 'affidavit')} />)
    await settle()
    await waitFor(() => expect(offListNote()).not.toBeNull())
    expect(offListNote()!.getAttribute('data-lien-desk-off-list')).toBe('affidavit')
    expect(offListNote()!.textContent).toBe('The job this link names is not on the Lien affidavits list. Open its Lien window › shows where it stands.')
    expect(pane()).toBeNull()
    // The list is still there under the line.
    expect(screen.getAllByRole('button', { name: /Made-up First/ }).length).toBeGreaterThan(0)
    expect(screen.getByTestId('where').textContent).toBe('/lien-desk?tab=affidavits&job=jGone')
  })
})
