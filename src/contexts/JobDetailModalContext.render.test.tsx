// @vitest-environment jsdom
/**
 * Render smoke for the Job window role branch (v2.2848). The provider decides
 * which surface a tapped job opens: the tabbed Job window (Job · Edit · Bill)
 * for roles whose full-ledger fetch RLS admits, or the read-only Job Detail
 * pane for everyone else. Before this branch, superintendent / estimator /
 * controller got the window, whose embedded edit form fetched null and closed
 * the whole thing ~1 s later — every desktop door to a job was dead for them.
 * What matters here: the read-only roles get a dialog with NO tab strip and no
 * "Job not found" toast, and the window roles still get the tabs.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

import { JobDetailModalProvider, useJobDetailModal } from './JobDetailModalContext'
import { JobsListCacheProvider } from './JobsListCacheContext'
import { UpdateFocusOpenerBridgeProvider } from './UpdateFocusOpenerBridgeContext'
import { makeJob, renderWithProviders } from '../test/renderSmokeMocks'

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

// Mutable role so one file covers both branches; `useAuth` reads it per render.
let mockRole: string = 'dev'
vi.mock('../hooks/useAuth', async () => {
  const { makeUseAuthValue } = await import('../test/renderSmokeMocks')
  return {
    useAuth: () => makeUseAuthValue({ role: mockRole }),
    AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  }
})

const windowJob = makeJob({ id: 'job-1', hcp_number: '9001', job_name: 'Kitchen rough-in' })

// The full-ledger fetch: resolves for the window roles (RLS would admit them);
// returns null for everyone else — exactly what prod RLS does, and what made the
// embedded edit form toast + close the window.
const fullFetch = vi.fn(async () => (mockRole === 'dev' ? windowJob : null))
vi.mock('../lib/fetchJobWithDetailsById', () => ({
  fetchJobWithDetailsById: () => fullFetch(),
}))

const recordNavClick = vi.fn()
vi.mock('../lib/navClickTelemetry', () => ({
  recordNavClick: (...args: unknown[]) => recordNavClick(...args),
}))

beforeAll(() => {
  vi.stubGlobal('scrollTo', vi.fn())
})

function Opener() {
  const ctx = useJobDetailModal()
  return (
    <button
      type="button"
      onClick={() =>
        ctx?.openJobDetail({
          jobId: 'job-1',
          prefillRowLabel: '9001 · Kitchen rough-in',
          assignedJobsRows: [
            {
              id: 'job-1',
              hcp_number: '9001',
              job_name: 'Kitchen rough-in',
              job_address: '1 Main St',
              google_drive_link: null,
              job_pictures_link: null,
              job_plans_link: null,
              revenue: null,
            } as never,
          ],
        })
      }
    >
      open job
    </button>
  )
}

function renderTree(role: string) {
  mockRole = role
  recordNavClick.mockClear()
  fullFetch.mockClear()
  return renderWithProviders(
    <UpdateFocusOpenerBridgeProvider>
      <JobsListCacheProvider>
        <JobDetailModalProvider>
          <Opener />
        </JobDetailModalProvider>
      </JobsListCacheProvider>
    </UpdateFocusOpenerBridgeProvider>,
  )
}

describe('JobDetailModalProvider role branch', () => {
  it('superintendent: opens the read-only pane — no tab strip, no self-close, telemetry says read-only', async () => {
    renderTree('superintendent')
    fireEvent.click(screen.getByRole('button', { name: 'open job' }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toBeTruthy()
    // The pane's own status pills are tabs too — the window's Edit / Bill are what must be absent.
    expect(screen.queryByRole('tab', { name: 'Edit' })).toBeNull()
    expect(screen.queryByRole('tab', { name: 'Bill' })).toBeNull()
    // The pane stays open (the window used to close itself ~1 s in).
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByRole('dialog')).toBeTruthy()
    expect(screen.queryByText('Job not found or you do not have access.')).toBeNull()
    // The edit form never mounted, so the full-ledger fetch never ran.
    expect(fullFetch).not.toHaveBeenCalled()
    expect(recordNavClick).toHaveBeenCalledWith(expect.any(String), 'superintendent', 'job_window_opened', '#read-only')
  })

  it('estimator and controller take the same read-only branch', async () => {
    for (const role of ['estimator', 'controller']) {
      const view = renderTree(role)
      fireEvent.click(screen.getByRole('button', { name: 'open job' }))
      await screen.findByRole('dialog')
      expect(screen.queryByRole('tab', { name: 'Edit' })).toBeNull()
      expect(screen.queryByRole('tab', { name: 'Bill' })).toBeNull()
      expect(recordNavClick).toHaveBeenCalledWith(expect.any(String), role, 'job_window_opened', '#read-only')
      view.unmount()
    }
  })

  it('dev: still gets the tabbed Job window', async () => {
    renderTree('dev')
    fireEvent.click(screen.getByRole('button', { name: 'open job' }))
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Edit' })).toBeTruthy())
    expect(screen.getByRole('tab', { name: 'Bill' })).toBeTruthy()
    expect(recordNavClick).toHaveBeenCalledWith(expect.any(String), 'dev', 'job_window_opened', '#window')
  })
})
