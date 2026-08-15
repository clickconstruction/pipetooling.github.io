// @vitest-environment jsdom
/**
 * Render tests for the Pipeline row's Job activity panel (v2.1673) — the
 * surface that used to be JobThreadNotesPanel with its own unnumbered feed.
 * What matters here is that the panel and the floating modal now render the
 * SAME body: numbered notes, unnumbered timeline texture, folded report
 * answers, Schedule / Week dispatch, and a fullscreen toggle that keeps all of
 * it. Line shaping is covered in src/lib/jobs/jobActivityLine.test.ts.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

import { JobsStagesThreadPanel } from './JobsStagesThreadPanel'
import type { JobThreadActivityItem } from '../JobThreadNotesPanel'
import { resetBodyScrollLockForTests } from '../../lib/bodyScrollLock'
import { makeJob, renderWithProviders } from '../../test/renderSmokeMocks'

const note = (id: string, at: string, body: string, author = 'Roxi') =>
  ({ kind: 'note' as const, note: { id, created_at: at, body, author: { name: author } } }) as unknown as JobThreadActivityItem

const statusEvent = (dedupeKey: string, at: string, summary: string) =>
  ({
    kind: 'event',
    event: { dedupeKey, occurredAt: at, type: 'status_change', summary, actorName: 'Danielle' },
  }) as unknown as JobThreadActivityItem

const report = (id: string, at: string) =>
  ({
    kind: 'report',
    report: {
      id,
      template_name: 'Status Report',
      created_at: at,
      created_by_name: 'Abraham',
      field_values: {
        'How complete is the job?': '100%',
        'What is the status of the job?': 'Front cleanout is broken.',
      },
    },
  }) as unknown as JobThreadActivityItem

const activity = [
  note('n1', '2026-08-12T14:45:00Z', 'Arrived at job', 'Abraham'),
  statusEvent('ev1', '2026-08-12T15:00:00Z', 'Working → Ready to Bill'),
  report('r1', '2026-08-12T15:10:00Z'),
  note('n2', '2026-08-14T16:53:00Z', 'Still Pending Pinpoint-DRF', 'Roxi'),
]

const baseProps = {
  job: makeJob({ job_name: 'Shearer Pinpoint' }),
  activity,
  loading: false,
  upcoming: null,
  fullscreen: false,
  onToggleFullscreen: vi.fn(),
  fullscreenHeader: <span>Job: 951 Shearer Pinpoint</span>,
}

describe('JobsStagesThreadPanel', () => {
  it('numbers notes and reports and leaves timeline events unnumbered', () => {
    renderWithProviders(<JobsStagesThreadPanel {...baseProps} onToggleFullscreen={vi.fn()} />)
    expect(screen.getByLabelText('Entry 1')).toBeTruthy()
    expect(screen.getByLabelText('Entry 2')).toBeTruthy()
    expect(screen.getByLabelText('Entry 3')).toBeTruthy()
    // Four items, three numbers — the status change is texture.
    expect(screen.queryByLabelText('Entry 4')).toBeNull()
    expect(screen.getByText('Working → Ready to Bill')).toBeTruthy()
  })

  it('folds a report to its template name until the line is opened', () => {
    renderWithProviders(<JobsStagesThreadPanel {...baseProps} onToggleFullscreen={vi.fn()} />)
    expect(screen.getByText('Status Report')).toBeTruthy()
    expect(screen.queryByText(/Front cleanout is broken/)).toBeNull()
    fireEvent.click(screen.getByText('Status Report'))
    expect(screen.getByText(/Front cleanout is broken/)).toBeTruthy()
  })

  it('shows the fullscreen toggle and swaps its label once active', () => {
    const onToggleFullscreen = vi.fn()
    const { rerender } = renderWithProviders(
      <JobsStagesThreadPanel {...baseProps} onToggleFullscreen={onToggleFullscreen} />,
    )
    fireEvent.click(screen.getByLabelText('Expand activity to full screen'))
    expect(onToggleFullscreen).toHaveBeenCalledTimes(1)

    rerender(<JobsStagesThreadPanel {...baseProps} fullscreen onToggleFullscreen={onToggleFullscreen} />)
    expect(screen.getByLabelText('Exit full screen')).toBeTruthy()
    // Escape leaves fullscreen rather than collapsing the row.
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onToggleFullscreen).toHaveBeenCalledTimes(2)
  })

  it('keeps Schedule and Week dispatch, disabling dispatch with no crew', () => {
    const onSchedule = vi.fn()
    renderWithProviders(
      <JobsStagesThreadPanel
        {...baseProps}
        onToggleFullscreen={vi.fn()}
        scheduleAction={{ onClick: onSchedule }}
        scheduleDispatchAction={{ onClick: vi.fn(), disabled: true }}
      />,
    )
    fireEvent.click(screen.getByText('Schedule'))
    expect(onSchedule).toHaveBeenCalled()
    expect(screen.getByText('Week dispatch').hasAttribute('disabled')).toBe(true)
  })

  it('puts the crew and the % complete on the same row', () => {
    renderWithProviders(
      <JobsStagesThreadPanel
        {...baseProps}
        onToggleFullscreen={vi.fn()}
        pctComplete={45}
        teamMembers={[
          { user_id: 'u1', name: 'Abraham' },
          { user_id: 'u2', name: 'Paige' },
        ]}
      />,
    )
    const crew = screen.getByText('Abraham, Paige')
    const pct = screen.getByText('45% complete')
    expect(crew.parentElement).toBe(pct.parentElement)
  })

  it('restores the typed note when the post fails', async () => {
    const submitNoteWithBody = vi.fn(async () => false)
    renderWithProviders(
      <JobsStagesThreadPanel {...baseProps} onToggleFullscreen={vi.fn()} submitNoteWithBody={submitNoteWithBody} />,
    )
    const input = screen.getByLabelText('Note text') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Needs a second trip' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await vi.waitFor(() => expect(submitNoteWithBody).toHaveBeenCalled())
    await vi.waitFor(() => expect(input.value).toBe('Needs a second trip'))
  })

  it('gives page scroll back when a billed job mounts the panel twice', () => {
    // The Stages board renders this panel in both the job-row and invoice-row
    // branch, so two fullscreen locks are live at once. The shared
    // reference-counted hook releases only when the LAST one exits — the old
    // hand-rolled save/restore left the page frozen forever here.
    resetBodyScrollLockForTests()
    const both = (fullscreen: boolean) => (
      <>
        <JobsStagesThreadPanel {...baseProps} fullscreen={fullscreen} onToggleFullscreen={() => {}} />
        <JobsStagesThreadPanel {...baseProps} fullscreen={fullscreen} onToggleFullscreen={() => {}} />
      </>
    )
    const { rerender } = renderWithProviders(both(true))
    expect(document.body.style.overflow).toBe('hidden')
    rerender(both(false))
    expect(document.body.style.overflow).toBe('')
  })

  it('shows the loading placeholder while the thread loads', () => {
    renderWithProviders(<JobsStagesThreadPanel {...baseProps} loading onToggleFullscreen={vi.fn()} />)
    expect(screen.getByText('Loading activity…')).toBeTruthy()
  })
})
