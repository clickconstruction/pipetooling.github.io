// @vitest-environment jsdom
/**
 * `/lien-desk`: what the page does when a job's Lien window changes something the Deadlines rows behind it read (v2.7208).
 *
 * The owner, 2026-11-13, with the Deadlines tab behind *Liens on job 226*: *"when a day is set the underlying jobs
 * don't refresh with the new dates … when I close the modal I don't want to lose my place on the page but I do want
 * the main page to update"*. The page re-read its lien clocks and the desk, but the row counts from the job's own
 * `lien_last_work_on` on the jobs list the page holds, and nothing wrote the saved day there. A filing recorded in the
 * window re-read the desk and not the clocks, so the row's flags stayed as they were.
 *
 * The desk and the window are stubs here: this is the page's wiring between them, the jobs list and the clocks.
 */
import type { ReactNode } from 'react'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, screen } from '@testing-library/react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { makeJob, renderWithProviders, settle } from '../test/renderSmokeMocks'
import type { JobWithDetails } from '../types/jobWithDetails'
import LienDeskPage from './LienDeskPage'

type SetJobs = (next: JobWithDetails[] | ((prev: JobWithDetails[]) => JobWithDetails[])) => void
const cache = vi.hoisted(() => ({ jobs: [] as unknown[], setJobs: vi.fn() }))
const desk = vi.hoisted(() => ({ data: null as unknown, refetch: vi.fn(), props: null as Record<string, unknown> | null }))
const win = vi.hoisted(() => ({ props: null as Record<string, unknown> | null }))
const rows = vi.hoisted(() => ({ refreshKeys: [] as number[], jobs: null as unknown }))
const record = vi.hoisted(() => ({ sync: vi.fn(async () => {}) }))

vi.mock('../hooks/useAuth', async () => {
  const { makeUseAuthValue } = await import('../test/renderSmokeMocks')
  return {
    useAuth: () => makeUseAuthValue({ role: 'dev', profileName: 'Taunya' }),
    useOptionalAuth: () => makeUseAuthValue({ role: 'dev', profileName: 'Taunya' }),
    AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  }
})
vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../hooks/useIsMobile', () => ({ useIsMobile: () => false }))
vi.mock('../lib/people/fetchActiveUsers', () => ({ fetchActiveUsers: async () => ({ data: [], error: null }) }))
vi.mock('../contexts/JobsListCacheContext', () => ({
  buildJobsListCacheKey: (userId: string, customerFilter: string | null) => `${userId}:${customerFilter || 'all'}`,
  useJobsListCache: () => ({ jobs: cache.jobs, setJobs: cache.setJobs, jobsListLoading: false, jobsListDataKey: 'smoke-auth-user-1:all', fetchScopeIfNeeded: async () => {}, runFetchScopes: async () => {}, mergedScopes: new Set(['billed']) }),
  JobsListCacheProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}))
vi.mock('../hooks/useLienDeskData', () => ({ useLienDeskData: () => ({ data: desk.data, loading: false, refetch: desk.refetch }) }))
vi.mock('../hooks/useLienCalendarRows', () => ({
  useLienCalendarRows: (jobs: unknown, opts: { refreshKey?: number }) => {
    rows.jobs = jobs
    rows.refreshKeys.push(opts.refreshKey ?? 0)
    return { rows: [], reloadPromises: () => {} }
  },
}))
vi.mock('../hooks/useForecastWorkMonths', () => ({ useForecastWorkMonths: () => ({ byJob: null, loading: false }) }))
vi.mock('../lib/physicalInvoiceIssuer', () => ({ getPhysicalInvoiceIssuerDraft: () => null, fetchPhysicalInvoiceIssuerFromAppSettings: async () => undefined }))
vi.mock('../hooks/useLegalMatters', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../hooks/useLegalMatters')>()),
  useLegalMatters: () => ({ available: false, readState: 'ok', loading: false, firm: null, firms: [], activeFirms: [], countiesByFirm: new Map(), matters: [], byPayerKey: new Map(), byJobId: new Map(), jobIdsByMatter: new Map(), entriesByMatter: new Map(), reload: async () => {} }),
}))
vi.mock('../lib/jobs/lienDeskIo', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/jobs/lienDeskIo')>()),
  syncLienDeskAfterRecord: record.sync,
}))
vi.mock('../components/jobs/LienDesk', () => ({
  default: (props: Record<string, unknown>) => {
    desk.props = props
    return <div data-testid="desk-stub" />
  },
}))
vi.mock('../components/jobs/LienInstrumentsModal', () => ({
  default: (props: Record<string, unknown>) => {
    win.props = props
    return props.open ? <div data-testid="window-stub">{String((props.job as { id?: string } | null)?.id ?? '')}</div> : null
  },
}))

const job226 = () => makeJob({ id: 'j226', hcp_number: '226', job_name: 'Dudley Mason', status: 'billed', last_work_date: '2026-02-11', lien_last_work_on: null }) as JobWithDetails
const job608 = () => makeJob({ id: 'j608', hcp_number: '608', job_name: 'Dudley Mason', status: 'billed', last_work_date: '2026-04-02', lien_last_work_on: null }) as JobWithDetails
const SAVED = { last_work_date: '2026-02-11', lien_last_work_on: '2026-09-04', lien_last_work_note: 'Went back for the valve', lien_last_work_set_at: '2026-11-13T20:00:00+00:00', lien_last_work_set_by: 'u-office' }

function Harness() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/lien-desk?tab=deadlines" replace />} />
      <Route path="/lien-desk" element={<LienDeskPage />} />
    </Routes>
  )
}

/** The updater the page handed the jobs list, played over a list. */
function lastSetJobs(over: JobWithDetails[]): JobWithDetails[] {
  const arg = (cache.setJobs.mock.calls[cache.setJobs.mock.calls.length - 1] as unknown as Parameters<SetJobs>)[0]
  return typeof arg === 'function' ? arg(over) : arg
}
const refreshKey = () => rows.refreshKeys[rows.refreshKeys.length - 1]

beforeEach(() => {
  cache.jobs = [job226(), job608()]
  cache.setJobs.mockClear()
  desk.data = null
  desk.refetch.mockClear()
  desk.props = null
  win.props = null
  rows.refreshKeys = []
  record.sync.mockClear()
})
afterEach(cleanup)

describe('LienDeskPage · the rows behind a job’s Lien window follow what the window changes', () => {
  it('a last day saved in the window is written onto that job in the jobs list, the clocks and the desk re-read, and the window stays open', async () => {
    renderWithProviders(<Harness />)
    await settle()
    const before = cache.jobs as JobWithDetails[]
    act(() => (desk.props!.onOpenCalendarJob as (jobId: string) => void)('j226'))
    expect(screen.getByTestId('window-stub').textContent).toBe('j226')
    const keyBefore = refreshKey()
    act(() => (win.props!.onLastWorkSaved as (jobId: string, facts: unknown) => void)('j226', SAVED))
    // The day is on the one job the page holds; every other job is the object it was.
    expect(cache.setJobs).toHaveBeenCalledTimes(1)
    const after = lastSetJobs(before)
    expect(after[0]).toMatchObject({ id: 'j226', ...SAVED })
    expect(after[1]).toBe(before[1])
    // The clocks and the desk's own rows are read again, as before.
    expect(refreshKey()).toBe(keyBefore! + 1)
    expect(desk.refetch).toHaveBeenCalledTimes(1)
    // Nothing closed: the window is still over the page, which was never taken down.
    expect(screen.getByTestId('window-stub')).toBeTruthy()
    expect(screen.getByTestId('desk-stub')).toBeTruthy()
  })

  it('with no facts read back the page still re-reads, and writes nothing onto the list', async () => {
    renderWithProviders(<Harness />)
    await settle()
    act(() => (desk.props!.onOpenCalendarJob as (jobId: string) => void)('j226'))
    act(() => (win.props!.onLastWorkSaved as (jobId: string, facts: unknown) => void)('j226', null))
    const before = cache.jobs as JobWithDetails[]
    expect(cache.setJobs.mock.calls.length === 0 || lastSetJobs(before) === before).toBe(true)
    expect(desk.refetch).toHaveBeenCalledTimes(1)
  })

  it('a filing recorded in the window re-reads the lien clocks too, so the row’s flags follow', async () => {
    renderWithProviders(<Harness />)
    await settle()
    act(() => (desk.props!.onOpenCalendarJob as (jobId: string) => void)('j226'))
    const keyBefore = refreshKey()
    await act(async () => {
      ;(win.props!.onRecorded as () => void)()
      await Promise.resolve()
    })
    expect(record.sync).toHaveBeenCalledWith('j226')
    expect(refreshKey()).toBe(keyBefore! + 1)
    expect(desk.refetch).toHaveBeenCalled()
  })

  it('a day set on the desk’s own line reaches the list from the desk’s fresh read of its jobs', async () => {
    const { rerender } = renderWithProviders(<Harness />)
    await settle()
    // The desk re-read after its line saved: its copy of job 608 carries the new day.
    desk.data = { jobsById: { j608: { id: 'j608', last_work_date: '2026-04-02', lien_last_work_on: '2026-05-01' } } }
    cache.setJobs.mockClear()
    rerender(<Harness />)
    await settle()
    expect(cache.setJobs).toHaveBeenCalled()
    const before = cache.jobs as JobWithDetails[]
    const after = lastSetJobs(before)
    expect(after[1]).toMatchObject({ id: 'j608', lien_last_work_on: '2026-05-01' })
    expect(after[0]).toBe(before[0])
    // A list that already reads that way is handed back as it is: no second draw.
    expect(lastSetJobs(after)).toBe(after)
  })
})
