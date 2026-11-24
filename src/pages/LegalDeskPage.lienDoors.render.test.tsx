// @vitest-environment jsdom
/**
 * `/legal-desk`, the Paper tab's doors to a job's next lien step: where the page sends each one. The desk is a stand-in
 * that presses the page's opener with the door the real kernel builds (`legalPaperNextDoor`), so this holds the page's
 * wiring alone. The retainage notice's door opened Monthly notices on the job, where the Lien desk then said the job
 * was not on that list. The page's other wiring is held by `LegalDeskPage.render.test.tsx`, whose mocks these are.
 */
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { makeInvoice, makeJob, renderWithProviders, settle } from '../test/renderSmokeMocks'
import { lienDeskFromSearch } from '../lib/lien/lienDeskRoute'
import LegalDeskPage from './LegalDeskPage'

const cache = vi.hoisted(() => ({ jobs: [] as unknown[], fetchScopeIfNeeded: vi.fn(async () => {}), runFetchScopes: vi.fn(async () => {}), refreshMergedScopes: vi.fn(async () => {}) }))

vi.mock('../hooks/useAuth', async () => {
  const { makeUseAuthValue } = await import('../test/renderSmokeMocks')
  return {
    useAuth: () => makeUseAuthValue({ role: 'dev' }),
    useOptionalAuth: () => makeUseAuthValue({ role: 'dev' }),
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
  useJobsListCache: () => ({ jobs: cache.jobs, jobsListLoading: false, jobsListDataKey: 'smoke-auth-user-1:all', fetchScopeIfNeeded: cache.fetchScopeIfNeeded, runFetchScopes: cache.runFetchScopes, refreshMergedScopes: cache.refreshMergedScopes, mergedScopes: new Set(['billed_all']) }),
  JobsListCacheProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}))
vi.mock('../hooks/useLegalMatters', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../hooks/useLegalMatters')>()),
  useLegalMatters: () => ({
    available: false,
    readState: 'ok',
    loading: false,
    firm: null,
    firms: [],
    activeFirms: [],
    countiesByFirm: new Map(),
    matters: [],
    byPayerKey: new Map(),
    byJobId: new Map(),
    jobIdsByMatter: new Map(),
    entriesByMatter: new Map(),
    documentsByMatter: new Map(),
    recipients: [],
    firmPaused: false,
    reload: async () => {},
  }),
}))
// The desk, stood in for: one button per next step, each pressing the page's opener as the Paper tab does.
vi.mock('../components/jobs/legal/LegalDesk', async () => {
  const { legalPaperNextDoor } = await import('../lib/legal/legalPaperNextDoor')
  type Job = { id: string }
  type Props = { collectionsJobs: Job[]; onOpenLienInstruments: (job: Job, door?: unknown) => void }
  const KINDS = ['notice', 'late_notice', 'retainage', 'affidavit', 'serve', 'release'] as const
  return {
    default: ({ collectionsJobs, onOpenLienInstruments }: Props) => {
      const job = collectionsJobs[0]
      if (!job) return <p>no job yet</p>
      return (
        <div data-legal-desk-stand-in>
          {KINDS.map((kind) => {
            const door = legalPaperNextDoor({ kind })
            return door ? <button key={kind} type="button" data-next-kind={kind} onClick={() => onOpenLienInstruments(job, door)}>{door.label}</button> : null
          })}
          <button type="button" data-next-kind="plain" onClick={() => onOpenLienInstruments(job)}>Liens on the job</button>
        </div>
      )
    },
  }
})

function Where() {
  const l = useLocation()
  return <output data-testid="where">{l.pathname}{l.search}</output>
}

function Harness() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Navigate to="/legal-desk" replace />} />
        <Route path="/legal-desk" element={<LegalDeskPage />} />
        <Route path="/lien-desk" element={<p>the Lien desk</p>} />
        <Route path="/jobs" element={<p>the Pipeline</p>} />
        <Route path="/dashboard" element={<p>the Dashboard</p>} />
      </Routes>
      <Where />
    </>
  )
}

/** Open the page, press the door for one next step, and read the address the page went to. */
async function pressDoor(kind: string): Promise<string> {
  const { container } = renderWithProviders(<Harness />)
  await settle()
  await waitFor(() => expect(container.querySelector(`[data-next-kind="${kind}"]`)).not.toBeNull())
  fireEvent.click(container.querySelector(`[data-next-kind="${kind}"]`)!)
  await waitFor(() => expect(screen.getByTestId('where').textContent?.startsWith('/legal-desk')).toBe(false))
  return screen.getByTestId('where').textContent ?? ''
}

/** What the Lien desk reads from the address a door went to. */
function deskReads(address: string) {
  const { kind, job } = lienDeskFromSearch(new URLSearchParams(address.split('?')[1] ?? ''))
  return { path: address.split('?')[0], kind, job }
}

beforeEach(() => {
  cache.jobs = [
    makeJob({
      id: 'job-a',
      hcp_number: '1312',
      status: 'billed',
      collections_at: '2026-08-20T15:00:00Z',
      customer_id: 'ridgeway',
      customer_name: 'Ridgeway Builders',
      invoices: [makeInvoice({ id: 'inv-job-a', job_id: 'job-a', amount: 9000, status: 'billed', billed_at: '2026-04-17T12:00:00Z', stripe_invoice_status: 'open' })],
    }),
  ]
})
afterEach(cleanup)

describe('LegalDeskPage, the Paper tab’s doors to the next lien step', () => {
  it('the retainage notice’s door opens the Lien desk’s Retainage notices on the job, not Monthly notices', async () => {
    expect(deskReads(await pressDoor('retainage'))).toEqual({ path: '/lien-desk', kind: 'retainage', job: 'job-a' })
  })

  it('a notice’s door, on time or late, opens Monthly notices on the job, as before', async () => {
    expect(deskReads(await pressDoor('notice'))).toEqual({ path: '/lien-desk', kind: 'notice', job: 'job-a' })
    cleanup()
    expect(deskReads(await pressDoor('late_notice'))).toEqual({ path: '/lien-desk', kind: 'notice', job: 'job-a' })
  })

  it('the affidavit, the mail numbers and the release open the job’s Lien window on their tab, as before', async () => {
    expect(await pressDoor('affidavit')).toBe('/jobs?tab=stages&lienwindow=job-a&lientab=affidavit')
    cleanup()
    expect(await pressDoor('serve')).toBe('/jobs?tab=stages&lienwindow=job-a&lientab=affidavit')
    cleanup()
    expect(await pressDoor('release')).toBe('/jobs?tab=stages&lienwindow=job-a&lientab=release_record')
  })

  it('a press with no door opens the job’s Lien window, as before', async () => {
    expect(await pressDoor('plain')).toBe('/jobs?tab=stages&lienwindow=job-a')
  })
})
