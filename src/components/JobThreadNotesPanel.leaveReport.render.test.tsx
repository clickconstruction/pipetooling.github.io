// @vitest-environment jsdom
/**
 * Leave Report from the job window (punch list #135, v2.5688): with `onLeaveReport`, a ＋ Report chip in the pills'
 * own family sits right after the Reports pill and calls it; without the prop the row is as it was.
 */
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../test/renderSmokeMocks'
import type { UserRole } from '../hooks/useAuth'
import { JobThreadNotesPanel, type JobThreadActivityItem } from './JobThreadNotesPanel'

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

afterEach(cleanup)

function draw(onLeaveReport?: () => void, viewerRole: UserRole = 'assistant', activity: JobThreadActivityItem[] = []) {
  renderWithProviders(
    <JobThreadNotesPanel
      activity={activity}
      viewerRole={viewerRole}
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

/** The row's chips by their words, the count left off ("Notes 1" reads Notes). */
function chipWords(): string[] {
  const row = screen.getByRole('tablist', { name: 'Filter activity' })
  return Array.from(row.querySelectorAll('button')).map((b) => b.getAttribute('aria-label') ?? (b.firstChild?.textContent ?? '').trim())
}

const ownReport: JobThreadActivityItem = {
  kind: 'report',
  report: { id: 'r1', template_name: 'Note', job_display_name: '', created_at: '2026-11-20T15:00:00Z', created_by_name: 'Isiah', field_values: {}, reported_at_lat: null, reported_at_lng: null },
} as JobThreadActivityItem

describe('JobThreadNotesPanel: the chips a viewer is drawn (2026-11-20)', () => {
  it('the office is drawn all six, the two empty ones dim as before', () => {
    draw()
    expect(chipWords()).toEqual(['All', 'Notes', 'Reports', 'Status', 'Billing', 'Crew'])
  })

  it('a helper is drawn All, Notes, Status and Crew: no Reports, no Billing', () => {
    draw(undefined, 'helpers')
    expect(chipWords()).toEqual(['All', 'Notes', 'Status', 'Crew'])
  })

  it('a helper who can leave a report keeps the ＋ Report door where the Reports pill would stand', () => {
    draw(() => undefined, 'helpers')
    expect(chipWords()).toEqual(['All', 'Notes', 'Leave Report', 'Status', 'Crew'])
  })

  it('a helper whose own report is in the feed is drawn Reports with its count', () => {
    draw(undefined, 'helpers', [ownReport])
    expect(chipWords()).toEqual(['All', 'Notes', 'Reports', 'Status', 'Crew'])
    const row = screen.getByRole('tablist', { name: 'Filter activity' })
    expect(within(row).getByText('Reports').closest('button')?.textContent).toBe('Reports1')
  })
})
