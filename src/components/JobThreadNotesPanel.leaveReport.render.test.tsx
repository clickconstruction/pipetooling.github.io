// @vitest-environment jsdom
/**
 * Leave Report from the job window (punch list #135, v2.5688): with `onLeaveReport`, a ＋ Report chip in the pills'
 * own family sits right after the Reports pill and calls it; without the prop the row is as it was.
 */
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../test/renderSmokeMocks'
import { JobThreadNotesPanel } from './JobThreadNotesPanel'

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

afterEach(cleanup)

function draw(onLeaveReport?: () => void) {
  renderWithProviders(
    <JobThreadNotesPanel
      activity={[]}
      loading={false}
      canPost
      draft=""
      onDraftChange={() => undefined}
      onSubmit={() => undefined}
      submitting={false}
      showSectionTitle={false}
      showEmptyPlaceholder={false}
      pctComplete={100}
      {...(onLeaveReport ? { onLeaveReport } : {})}
    />,
  )
}

describe('JobThreadNotesPanel: ＋ Report after the Reports pill (punch list #135)', () => {
  it('draws the chip right after Reports, in the row, and calls the host on press', () => {
    const onLeaveReport = vi.fn()
    draw(onLeaveReport)
    const row = screen.getByRole('tablist', { name: 'Filter activity' })
    const chip = within(row).getByRole('button', { name: 'Leave Report' })
    expect(chip.textContent).toBe('＋ Report')
    // Order in the row: … Reports, then the chip, then Status.
    const labels = Array.from(row.querySelectorAll('button')).map((b) => b.getAttribute('aria-label') ?? b.textContent?.trim())
    const reportsAt = labels.indexOf('Reports')
    expect(labels[reportsAt + 1]).toBe('Leave Report')
    expect(labels[reportsAt + 2]).toBe('Status')
    fireEvent.click(chip)
    expect(onLeaveReport).toHaveBeenCalledTimes(1)
    // The percent readout still ends the row.
    expect(within(row).getByText(/100% complete/)).toBeTruthy()
  })

  it('draws no chip without the prop', () => {
    draw()
    const row = screen.getByRole('tablist', { name: 'Filter activity' })
    expect(within(row).queryByRole('button', { name: 'Leave Report' })).toBeNull()
    expect(within(row).getByText('Reports')).toBeTruthy()
  })
})
