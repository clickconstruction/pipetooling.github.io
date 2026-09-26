// @vitest-environment jsdom
/**
 * Escape is one layer at a time on Job Detail (v2.3839). Its window listener
 * closed Job Detail underneath the Add link dialog (and the supply-house packet
 * and job-account sheets): a half-typed URL was lost with the whole modal. The
 * dialog now gates Job Detail's Escape, and Esc in its field closes just it.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

import DetailJobModal from './DetailJobModal'
import { UpdateFocusOpenerBridgeProvider } from '../../contexts/UpdateFocusOpenerBridgeContext'
import { makeJob, renderWithProviders, settle } from '../../test/renderSmokeMocks'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

const detailJob = makeJob({ id: 'job-1', hcp_number: '9001', job_name: 'Kitchen rough-in', google_drive_link: null })

vi.mock('../../lib/fetchJobWithDetailsById', () => ({
  fetchJobWithDetailsById: async () => detailJob,
}))

beforeAll(() => {
  vi.stubGlobal('scrollTo', vi.fn())
})

describe('DetailJobModal · Escape with the Add link dialog open', () => {
  it('closes only the dialog, then Job Detail on the next Escape', async () => {
    const onClose = vi.fn()
    renderWithProviders(
      <UpdateFocusOpenerBridgeProvider>
        <DetailJobModal open onClose={onClose} jobId="job-1" authRole="dev" assignedJobsRows={[]} scheduleContext={null} />
      </UpdateFocusOpenerBridgeProvider>,
    )
    await settle()
    fireEvent.click(await screen.findByRole('button', { name: /Customer Files — no link yet, click to add one/ }))
    const field = await screen.findByLabelText('Customer Files link URL')
    fireEvent.change(field, { target: { value: 'https://drive.google.com/drive/folders/abc' } })

    // Escape anywhere while the dialog is up: Job Detail stays.
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Add Customer Files link' })).toBeTruthy()

    // Escape in the field closes just the dialog.
    fireEvent.keyDown(field, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add Customer Files link' })).toBeNull())
    expect(onClose).not.toHaveBeenCalled()

    // Nothing stacked any more: Escape closes Job Detail.
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
