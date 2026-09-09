// @vitest-environment jsdom
/**
 * Render tests for the tabbed Job window (v2.1675) — Job · Edit · Bill in one
 * modal. What matters here: the three tabs show the right pane, everything
 * stays MOUNTED across tab switches (typed-but-unsaved form state must
 * survive), the Bill tab carries the billing half and the Edit tab doesn't,
 * and the ✕ routes through the form's guarded close. Section internals are
 * covered by the form's own section tests.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'

import { JobWindowModal } from './JobWindowModal'
import { UpdateFocusOpenerBridgeProvider } from '../../contexts/UpdateFocusOpenerBridgeContext'
import { makeJob, renderWithProviders } from '../../test/renderSmokeMocks'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

const windowJob = makeJob({ id: 'job-1', hcp_number: '9001', job_name: 'Kitchen rough-in' })

vi.mock('../../lib/fetchJobWithDetailsById', () => ({
  fetchJobWithDetailsById: async () => windowJob,
}))

vi.mock('../projects/ProjectsJobHistoryTab', () => ({
  ProjectsJobHistoryTab: ({ jobId }: { jobId?: string | null }) => <div data-testid="history-grid-stub">history for {jobId}</div>,
}))

beforeAll(() => {
  vi.stubGlobal('scrollTo', vi.fn())
})

function renderWindow(onClose: () => void, initialTab: 'job' | 'edit' | 'bill' | 'costs' | 'history' = 'job') {
  return renderWithProviders(
    <UpdateFocusOpenerBridgeProvider>
      <JobWindowModal
        jobId="job-1"
        initialTab={initialTab}
        onClose={onClose}
        authRole="dev"
        scheduleContext={null}
        assignedJobsRows={[]}
        initialJob={windowJob}
        billingCustomerHighlightInitial={false}
        fixturesSectionHighlightInitial={false}
        jobPicturesLinkHighlightInitial={false}
        alsoOpenCreateCustomerModal={false}
        onSaved={null}
      />
    </UpdateFocusOpenerBridgeProvider>,
  )
}

const tab = (name: string) => screen.getByRole('tab', { name })

describe('JobWindowModal', () => {
  it('History is the fourth tab: it mounts the single-job day grid on first visit and hides the form pane (T5-05)', async () => {
    renderWindow(vi.fn())
    expect(tab('History')).toBeTruthy()
    expect(screen.queryByTestId('history-grid-stub')).toBeNull()
    fireEvent.click(tab('History'))
    await waitFor(() => expect(screen.getByTestId('history-grid-stub').textContent).toBe('history for job-1'))
    expect(tab('History').getAttribute('aria-selected')).toBe('true')
    fireEvent.click(tab('Job'))
    // Stays mounted (state survives), just hidden.
    expect(screen.getByTestId('history-grid-stub')).toBeTruthy()
  })
  it('opens on the Job tab with Edit, Bill and Costs available, one ✕, no per-pane Close', async () => {
    renderWindow(vi.fn())
    expect(tab('Job').getAttribute('aria-selected')).toBe('true')
    expect(tab('Edit')).toBeTruthy()
    expect(tab('Bill')).toBeTruthy()
    expect(tab('Costs')).toBeTruthy()
    // Job · Edit · Bill · Costs · History, in that order (v2.3182).
    expect(within(screen.getByRole('tablist', { name: 'Job window tabs' })).getAllByRole('tab').map((t) => t.textContent)).toEqual(['Job', 'Edit', 'Bill', 'Costs', 'History'])
    expect(screen.getByLabelText('Close job window')).toBeTruthy()
    // The panes' own close affordances are gone — one window, one ✕.
    expect(screen.queryByLabelText('Close job detail')).toBeNull()
    await waitFor(() => expect(screen.getAllByText(/Kitchen rough-in/).length).toBeGreaterThan(0))
  })

  it('Edit shows the form half, Bill shows the billing half, and typed state survives switching', async () => {
    renderWindow(vi.fn(), 'edit')
    const name = (await screen.findByDisplayValue('Kitchen rough-in')) as HTMLInputElement

    fireEvent.change(name, { target: { value: 'Kitchen rough-in B' } })

    // Billing lives on the Bill tab, not Edit.
    const billingRow = () => screen.getByText('Remaining to bill')
    expect(billingRow().closest('div[style*="none"]')).toBeTruthy()

    fireEvent.click(tab('Bill'))
    expect(tab('Bill').getAttribute('aria-selected')).toBe('true')
    expect(billingRow().closest('div[style*="none"]')).toBeNull()

    // Back to Edit: the unsaved keystroke is still there — nothing unmounted.
    fireEvent.click(tab('Edit'))
    expect((screen.getByDisplayValue('Kitchen rough-in B') as HTMLInputElement)).toBeTruthy()
  })

  it('Costs is its own tab (v2.3182): the parts accordions and Cost Timeline live there, not on Bill', async () => {
    renderWindow(vi.fn(), 'bill')
    await screen.findByDisplayValue('Kitchen rough-in')
    const partsRow = () => screen.getByText('Supply house invoices')
    // Hidden while Bill shows…
    expect(partsRow().closest('div[style*="none"]')).toBeTruthy()
    fireEvent.click(tab('Costs'))
    expect(tab('Costs').getAttribute('aria-selected')).toBe('true')
    // …visible on Costs, and the billing half is now the hidden one.
    expect(partsRow().closest('div[style*="none"]')).toBeNull()
    expect(screen.getByText('Remaining to bill').closest('div[style*="none"]')).toBeTruthy()
  })

  it('the ✕ routes through the form close and closes the window', async () => {
    const onClose = vi.fn()
    renderWindow(onClose, 'edit')
    await screen.findByDisplayValue('Kitchen rough-in')
    fireEvent.click(screen.getByLabelText('Close job window'))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('carries no ⚙ Edit gear — the Edit tab replaced it (v2.1677)', async () => {
    renderWindow(vi.fn(), 'job')
    await screen.findByRole('button', { name: 'Share with supply house' })
    expect(screen.queryByLabelText('Edit job')).toBeNull()
  })

  it('keeps the job header — title + live action icons — on the Bill tab (v2.1676)', async () => {
    renderWindow(vi.fn(), 'bill')
    // The header's icon cluster renders even though the read-view body is hidden…
    const share = await screen.findByRole('button', { name: 'Share with supply house' })
    expect(share.closest('div[style*="none"]')).toBeNull()
    // …the read-view body itself is display-toggled off…
    const jobPane = document.querySelector('[role="tabpanel"][aria-label="Job"]')!
    expect(jobPane.querySelector('div[style*="none"]')).toBeTruthy()
    // …and a header icon still WORKS from Bill: the calendar opens on top.
    fireEvent.click(screen.getByLabelText('Open the job calendar'))
    await screen.findByText('Open week dispatch')
  })
})
