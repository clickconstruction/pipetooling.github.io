// @vitest-environment jsdom
/**
 * Regression test for v2.1167: Job Detail's backdrop used to close on ANY click
 * inside it.
 *
 * The `role="dialog"` panel stops propagation, so normal Job Detail clicks were
 * safe — but the satellite modals (Reports, Job Calendar, Schedule, paid-email)
 * render their own fixed overlays as *siblings* of that panel, still inside the
 * backdrop, and none of them portal out. A bare `onClick={onClose}` on the
 * backdrop therefore tore the whole stack down on the first click inside any of
 * them, which is what made Reports → "Add additional report" look like a dead
 * button. The backdrop now closes only when it is itself the click target.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

import DetailJobModal from './DetailJobModal'
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

const detailJob = makeJob({ id: 'job-1', hcp_number: '9001', job_name: 'Kitchen rough-in' })

vi.mock('../../lib/fetchJobWithDetailsById', () => ({
  fetchJobWithDetailsById: async () => detailJob,
}))

beforeAll(() => {
  vi.stubGlobal('scrollTo', vi.fn())
})

function renderModal(onClose: () => void) {
  renderWithProviders(
    <UpdateFocusOpenerBridgeProvider>
      <DetailJobModal
        open
        onClose={onClose}
        jobId="job-1"
        authRole="dev"
        assignedJobsRows={[]}
        scheduleContext={null}
      />
    </UpdateFocusOpenerBridgeProvider>,
  )
}

/** Nearest ancestor that is a `position: fixed` overlay — i.e. the modal's own layer. */
function fixedOverlayOf(el: HTMLElement): HTMLElement {
  for (let n = el.parentElement; n; n = n.parentElement) {
    if (n.style.position === 'fixed') return n
  }
  throw new Error('no fixed overlay ancestor')
}

async function renderOpenReports(onClose: () => void) {
  renderModal(onClose)
  const reportsButton = await screen.findByRole('button', { name: 'Open reports for this job' })
  fireEvent.click(reportsButton)
  return await screen.findByRole('button', { name: 'Add additional report' })
}

describe('DetailJobModal backdrop vs. its stacked satellite modals', () => {
  it('keeps Job Detail open when a click lands inside the Reports modal', async () => {
    const onClose = vi.fn()
    const addReport = await renderOpenReports(onClose)

    fireEvent.click(addReport)

    expect(onClose).not.toHaveBeenCalled()
    // …and the click did what it was supposed to do.
    await waitFor(() => expect(screen.getByText(/New report ·/)).toBeTruthy())
  })

  it('stacks the Additional Report form above the Reports modal that opened it', async () => {
    // Job Detail opens Reports at 1100; before v2.1167 AdditionalReportModal
    // stayed on its hardcoded default of 65 and mounted *under* the Reports
    // modal's opaque backdrop — present in the DOM, invisible to the user.
    const addReport = await renderOpenReports(vi.fn())
    const reportsOverlay = fixedOverlayOf(addReport)

    fireEvent.click(addReport)

    const formOverlay = fixedOverlayOf(await screen.findByText(/New report ·/))
    expect(Number(formOverlay.style.zIndex)).toBeGreaterThan(Number(reportsOverlay.style.zIndex))
  })

  it('still closes when the backdrop itself is clicked', async () => {
    const onClose = vi.fn()
    renderModal(onClose)
    // role="presentation" is not in the a11y tree — reach it through the panel.
    const backdrop = (await screen.findByRole('dialog')).parentElement as HTMLElement

    fireEvent.click(backdrop)

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
