// @vitest-environment jsdom
/**
 * Render tests for the wide-screen Pipeline "Job activity" box: teaser from
 * stats before the lazy load, numbered feed (1 = oldest) after, the floating
 * Post pill summoning the composer, and Escape dismissing it. Feed
 * shaping/numbering logic lives in src/lib/jobs/jobActivityBoxFeed.test.ts.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

import { JobsStagesActivityBox } from './JobsStagesActivityBox'
import type { StagesRowRenderContext } from './jobsStagesRowShared'
import { makeJob, renderWithProviders } from '../../test/renderSmokeMocks'

function makeCtx(over: Partial<StagesRowRenderContext> = {}): StagesRowRenderContext {
  return {
    showToast: vi.fn(),
    customers: [],
    openEditJobAndCreateCustomerFlow: vi.fn(),
    stagesManHoursByJobId: new Map(),
    stagesManHoursLoading: false,
    stagesLaborBreakdownByJobId: new Map(),
    expandedJobThreadId: null,
    toggleStagesJobThreadExpanded: vi.fn(),
    jobThreadStatsByJobId: {},
    jobThreadActivityByJobId: {},
    openJobThreadFullscreen: vi.fn(),
    openJobActivityExpand: vi.fn(),
    openJobCalendar: vi.fn(),
    stagesUpcomingByJobId: {},
    applyStagesInvoiceFocus: vi.fn(() => true),
    canOpenJobScheduleModal: false,
    setScheduleModalJob: vi.fn(),
    openQuickAssignForJob: vi.fn(),
    navigate: vi.fn(),
    authRole: 'dev',
    dispatchTaskModal: null,
    checklistAddModal: null,
    loadJobs: vi.fn(async () => []),
    ...over,
  } as StagesRowRenderContext
}

const note = (id: string, at: string, body: string, author = 'Roxi') => ({
  kind: 'note' as const,
  note: { id, created_at: at, body, author: { name: author } },
})

describe('JobsStagesActivityBox', () => {
  it('renders the stats teaser before the feed loads and requests the load on pointerover', () => {
    const loadActivityForJob = vi.fn()
    const job = makeJob({ job_name: 'Cop Properties' })
    renderWithProviders(
      <JobsStagesActivityBox
        job={job}
        ctx={makeCtx({
          jobThreadStatsByJobId: {
            [job.id]: {
              note_count: 2,
              last_note_at: '2026-08-11T14:28:00Z',
              last_note_body: 'I think the job is 1% complete',
              last_note_author_name: 'Paige',
              last_report_at: null,
            },
          } as StagesRowRenderContext['jobThreadStatsByJobId'],
        })}
        loadActivityForJob={loadActivityForJob}
        submitNoteWithBody={vi.fn(async () => {})}
      />,
    )
    expect(screen.getByText(/I think the job is 1% complete/)).toBeTruthy()
    fireEvent.pointerOver(screen.getByLabelText('Job activity for Cop Properties'))
    expect(loadActivityForJob).toHaveBeenCalledWith(job.id)
  })

  it('numbered feed after load: 1 = oldest, newest on top; empty state when nothing', () => {
    const job = makeJob({ job_name: 'Cop Properties' })
    renderWithProviders(
      <JobsStagesActivityBox
        job={job}
        ctx={makeCtx({
          jobThreadActivityByJobId: {
            [job.id]: [
              note('n1', '2026-08-10T12:00:00Z', 'older note'),
              note('n2', '2026-08-11T12:00:00Z', 'newer note'),
            ],
          } as StagesRowRenderContext['jobThreadActivityByJobId'],
        })}
      />,
    )
    const nums = screen.getAllByLabelText(/^Entry /).map((n) => n.textContent)
    expect(nums).toEqual(['2', '1'])
    expect(screen.getByText(/newer note/)).toBeTruthy()
  })

  it('Post pill opens the composer; Escape closes it and brings the pill back', () => {
    const job = makeJob({ job_name: 'Cop Properties' })
    renderWithProviders(
      <JobsStagesActivityBox
        job={job}
        ctx={makeCtx({ jobThreadActivityByJobId: { [job.id]: [] } as StagesRowRenderContext['jobThreadActivityByJobId'] })}
        submitNoteWithBody={vi.fn(async () => {})}
      />,
    )
    expect(screen.getByText('No activity yet — post the first note')).toBeTruthy()
    fireEvent.click(screen.getByLabelText("Post a note to this job's activity"))
    const input = screen.getByLabelText('Note text')
    expect(input).toBeTruthy()
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByLabelText('Note text')).toBeNull()
    expect(screen.getByLabelText("Post a note to this job's activity")).toBeTruthy()
  })

  it('corner expand button opens the shared full-page modal via ctx', () => {
    const openJobActivityExpand = vi.fn()
    const job = makeJob({ job_name: 'Shearer Pinpoint' })
    renderWithProviders(
      <JobsStagesActivityBox
        job={job}
        ctx={makeCtx({
          openJobActivityExpand,
          jobThreadActivityByJobId: { [job.id]: [] } as StagesRowRenderContext['jobThreadActivityByJobId'],
        })}
        submitNoteWithBody={vi.fn(async () => {})}
      />,
    )
    fireEvent.click(screen.getByLabelText('Expand job activity'))
    expect(openJobActivityExpand).toHaveBeenCalledWith(job)
  })

  it('submits through the note pipeline on Enter', async () => {
    const submitNoteWithBody = vi.fn(async () => {})
    const job = makeJob({ job_name: 'Cop Properties' })
    renderWithProviders(
      <JobsStagesActivityBox
        job={job}
        ctx={makeCtx({ jobThreadActivityByJobId: { [job.id]: [] } as StagesRowRenderContext['jobThreadActivityByJobId'] })}
        submitNoteWithBody={submitNoteWithBody}
      />,
    )
    fireEvent.click(screen.getByLabelText("Post a note to this job's activity"))
    const input = screen.getByLabelText('Note text')
    fireEvent.change(input, { target: { value: 'Check arrived' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await vi.waitFor(() => expect(submitNoteWithBody).toHaveBeenCalledWith(job.id, 'Check arrived', 'draft'))
  })
})
