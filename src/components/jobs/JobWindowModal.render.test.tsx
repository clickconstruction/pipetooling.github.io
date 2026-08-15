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
import { fireEvent, screen, waitFor } from '@testing-library/react'

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

beforeAll(() => {
  vi.stubGlobal('scrollTo', vi.fn())
})

function renderWindow(onClose: () => void, initialTab: 'job' | 'edit' | 'bill' = 'job') {
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
  it('opens on the Job tab with Edit and Bill available, one ✕, no per-pane Close', async () => {
    renderWindow(vi.fn())
    expect(tab('Job').getAttribute('aria-selected')).toBe('true')
    expect(tab('Edit')).toBeTruthy()
    expect(tab('Bill')).toBeTruthy()
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

  it('the ✕ routes through the form close and closes the window', async () => {
    const onClose = vi.fn()
    renderWindow(onClose, 'edit')
    await screen.findByDisplayValue('Kitchen rough-in')
    fireEvent.click(screen.getByLabelText('Close job window'))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('the Job pane ⚙ switches to the Edit tab instead of swapping modals', async () => {
    renderWindow(vi.fn(), 'job')
    const editGear = await screen.findByLabelText('Edit job')
    fireEvent.click(editGear)
    expect(tab('Edit').getAttribute('aria-selected')).toBe('true')
  })
})
