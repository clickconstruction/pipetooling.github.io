// @vitest-environment jsdom
/**
 * Render tests for the full-page Job activity modal (opened by the activity
 * box's expand button and the row's "N Reports" chip): day-grouped numbered
 * feed with interleaved timeline items, the All/Notes/Reports/Status/Billing/
 * Crew filter, the % complete editor, team/people header, ✕ / Escape close,
 * and the composer posting through the shared thread-note pipeline.
 * Timeline shaping logic lives in src/lib/jobs/jobActivityBoxFeed.test.ts.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

import { JobsStagesActivityExpandModal } from './JobsStagesActivityExpandModal'
import type { JobThreadActivityItem } from '../JobThreadNotesPanel'
import { makeJob, renderWithProviders } from '../../test/renderSmokeMocks'

const note = (id: string, at: string, body: string, author = 'Roxi') =>
  ({
    kind: 'note' as const,
    note: { id, created_at: at, body, author: { name: author } },
  }) as unknown as JobThreadActivityItem

const statusEvent = (dedupeKey: string, at: string, summary: string) =>
  ({
    kind: 'event',
    event: { dedupeKey, occurredAt: at, type: 'status_change', summary, actorName: 'Danielle' },
  }) as unknown as JobThreadActivityItem

const mixedActivity = [
  note('n1', '2026-08-12T14:45:00Z', 'Arrived at job', 'Abraham'),
  statusEvent('ev1', '2026-08-12T15:00:00Z', 'Status: waiting → working'),
  note('n2', '2026-08-14T16:53:00Z', 'Still Pending Pinpoint-DRF', 'Roxi'),
]

describe('JobsStagesActivityExpandModal', () => {
  it('renders day groups with every line numbered; ✕ and Escape close', () => {
    const onClose = vi.fn()
    renderWithProviders(
      <JobsStagesActivityExpandModal
        job={makeJob({ job_name: 'Shearer Pinpoint' })}
        activity={mixedActivity}
        upcoming={null}
        onClose={onClose}
        submitNoteWithBody={vi.fn(async () => true)}
      />,
    )
    expect(screen.getByLabelText('Job activity for Shearer Pinpoint')).toBeTruthy()
    expect(screen.getByText(/Wed, Aug 12/)).toBeTruthy()
    expect(screen.getByLabelText('Entry 1')).toBeTruthy()
    expect(screen.getByLabelText('Entry 2')).toBeTruthy()
    // The status event is numbered too — every line carries its thread number.
    expect(screen.getByText('Status: waiting → working')).toBeTruthy()
    expect(screen.getByLabelText('Entry 3')).toBeTruthy()

    fireEvent.click(screen.getByLabelText('Close job activity'))
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('shows report answers open by default — the modal has the room (v2.1685)', () => {
    const reportItem = {
      kind: 'report',
      report: {
        id: 'r1',
        template_name: 'Status Report',
        created_at: '2026-08-12T15:10:00Z',
        created_by_name: 'Abraham',
        field_values: { 'How complete is the job?': '1%' },
      },
    } as unknown as JobThreadActivityItem
    renderWithProviders(
      <JobsStagesActivityExpandModal
        job={makeJob({ job_name: 'Shearer Pinpoint' })}
        activity={[...mixedActivity, reportItem]}
        upcoming={null}
        onClose={vi.fn()}
        submitNoteWithBody={vi.fn(async () => true)}
      />,
    )
    // Visible without a click; clicking the line folds it back.
    expect(screen.getByText(/1%/)).toBeTruthy()
    fireEvent.click(screen.getByText('Status Report'))
    expect(screen.queryByText(/1%/)).toBeNull()
  })

  it('filter pills narrow the feed; numbers stay stable', () => {
    renderWithProviders(
      <JobsStagesActivityExpandModal
        job={makeJob({ job_name: 'Shearer Pinpoint' })}
        activity={mixedActivity}
        upcoming={null}
        onClose={vi.fn()}
        submitNoteWithBody={vi.fn(async () => true)}
      />,
    )
    fireEvent.click(screen.getByRole('tab', { name: /Notes/ }))
    expect(screen.queryByText('Status: waiting → working')).toBeNull()
    // Numbers were assigned pre-filter across the whole thread, so the second
    // note keeps its 3 — the hidden status change stays Entry 2.
    expect(screen.getByLabelText('Entry 1')).toBeTruthy()
    expect(screen.queryByLabelText('Entry 2')).toBeNull()
    expect(screen.getByLabelText('Entry 3')).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: /Status/ }))
    expect(screen.getByText('Status: waiting → working')).toBeTruthy()
    expect(screen.getByLabelText('Entry 2')).toBeTruthy()
    expect(screen.queryByLabelText('Entry 1')).toBeNull()
  })

  it('shows team members, manage-people action, and the % readout', () => {
    const onPeople = vi.fn()
    renderWithProviders(
      <JobsStagesActivityExpandModal
        job={makeJob({ job_name: 'Shearer Pinpoint' })}
        activity={[]}
        upcoming={null}
        onClose={vi.fn()}
        submitNoteWithBody={vi.fn(async () => true)}
        pctComplete={45}
        teamMembers={[
          { user_id: 'u1', name: 'Abraham' },
          { user_id: 'u2', name: 'Paige' },
        ]}
        peopleAction={{ onClick: onPeople }}
      />,
    )
    expect(screen.getByText('Abraham, Paige')).toBeTruthy()
    expect(screen.getByText('45% complete')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Manage people on this job'))
    expect(onPeople).toHaveBeenCalled()
  })

  it('% editor: requires a note below 100, commits value + note through onCommitPct', async () => {
    const onCommitPct = vi.fn(async () => {})
    renderWithProviders(
      <JobsStagesActivityExpandModal
        job={makeJob({ job_name: 'Shearer Pinpoint' })}
        activity={[]}
        upcoming={null}
        onClose={vi.fn()}
        submitNoteWithBody={vi.fn(async () => true)}
        pctComplete={20}
        canEditPct
        onCommitPct={onCommitPct}
      />,
    )
    fireEvent.click(screen.getByText('Set % complete'))
    const pctInput = screen.getByLabelText('Percent complete')
    fireEvent.change(pctInput, { target: { value: '45' } })
    // Commit without a note → blocked below 100%.
    fireEvent.click(screen.getByText('Set to 45%'))
    expect(screen.getByText('Add a note for anything under 100%.')).toBeTruthy()
    expect(onCommitPct).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Note for percent change'), { target: { value: 'hall bath roughed in' } })
    fireEvent.click(screen.getByText('Set to 45%'))
    await vi.waitFor(() => expect(onCommitPct).toHaveBeenCalledWith(45, 'hall bath roughed in'))
  })

  it('shows the loading state before the lazy thread load lands', () => {
    renderWithProviders(
      <JobsStagesActivityExpandModal
        job={makeJob({ job_name: 'Shearer Pinpoint' })}
        activity={null}
        upcoming={null}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByText('Loading activity…')).toBeTruthy()
    // No composer without the pipeline.
    expect(screen.queryByLabelText('Note text')).toBeNull()
  })

  it('composer posts through the pipeline on Enter; Escape in the composer blurs without closing', async () => {
    const submitNoteWithBody = vi.fn(async () => true)
    const onClose = vi.fn()
    const job = makeJob({ job_name: 'Shearer Pinpoint' })
    renderWithProviders(
      <JobsStagesActivityExpandModal
        job={job}
        activity={[]}
        upcoming={null}
        onClose={onClose}
        submitNoteWithBody={submitNoteWithBody}
      />,
    )
    const input = screen.getByLabelText('Note text')
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.change(input, { target: { value: 'Deep note' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await vi.waitFor(() => expect(submitNoteWithBody).toHaveBeenCalledWith(job.id, 'Deep note', 'draft'))
  })
})
