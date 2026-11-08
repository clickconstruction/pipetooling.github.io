// @vitest-environment jsdom
/**
 * Render tests for the wide-screen Pipeline "Job activity" box: teaser from
 * stats before the lazy load, numbered feed (1 = oldest) after, the floating
 * + Add pill summoning the composer, and Escape dismissing it. Feed
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
import { makeJob, renderWithProviders, settle } from '../../test/renderSmokeMocks'

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
  it('renders the stats teaser before the feed loads and requests the load on pointerover', async () => {
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
        submitNoteWithBody={vi.fn(async () => true)}
      />,
    )
    await settle()
    expect(screen.getByText(/I think the job is 1% complete/)).toBeTruthy()
    fireEvent.pointerOver(screen.getByLabelText('Job activity for Cop Properties'))
    expect(loadActivityForJob).toHaveBeenCalledWith(job.id)
  })

  it('numbered feed after load: 1 = oldest at top, newest at the bottom (v2.2062); empty state when nothing', async () => {
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
    await settle()
    const nums = screen.getAllByLabelText(/^Entry /).map((n) => n.textContent)
    expect(nums).toEqual(['1', '2'])
    expect(screen.getByText(/newer note/)).toBeTruthy()
  })

  it('a bill sent to the customer sits in the feed unnumbered with a Sent tag, and the notes keep their numbers (v2.5633)', async () => {
    const job = makeJob({ job_name: 'Calvin Barrett Pump' })
    renderWithProviders(
      <JobsStagesActivityBox
        job={job}
        ctx={makeCtx({
          jobThreadActivityByJobId: {
            [job.id]: [
              note('n1', '2026-08-10T12:00:00Z', 'older note'),
              {
                kind: 'event' as const,
                event: { dedupeKey: 'ev:sent', type: 'invoice_sent' as const, occurredAt: '2026-08-11T12:00:00Z', actorName: null, summary: 'Invoice sent to customer (stripe)', detail: { channel: 'stripe' }, financial: true },
              },
              {
                kind: 'event' as const,
                event: { dedupeKey: 'ev:pay', type: 'payment_added' as const, occurredAt: '2026-08-12T12:00:00Z', actorName: 'Taunya', summary: 'Payment $1,200.00 (check)', financial: true },
              },
              note('n2', '2026-08-13T12:00:00Z', 'newer note'),
            ],
          } as StagesRowRenderContext['jobThreadActivityByJobId'],
        })}
      />,
    )
    await settle()
    expect(screen.getAllByLabelText(/^Entry /).map((n) => n.textContent)).toEqual(['1', '2'])
    const sent = document.querySelector('[data-activity-entry-kind="sent"]') as HTMLElement
    expect(sent.textContent).toContain('Sent')
    expect(sent.textContent).toContain('The app')
    expect(sent.textContent).toContain('Bill emailed through Stripe')
    expect(screen.getByLabelText('Sent to the customer').textContent).toBe('Sent')
    expect(screen.queryByText(/Payment \$1,200/)).toBeNull()
    const kinds = [...document.querySelectorAll('[data-activity-entry-kind]')].map((e) => e.getAttribute('data-activity-entry-kind'))
    expect(kinds).toEqual(['note', 'sent', 'note'])
  })

  it('+ Add pill opens the composer; Escape closes it and brings the pill back', async () => {
    const job = makeJob({ job_name: 'Cop Properties' })
    renderWithProviders(
      <JobsStagesActivityBox
        job={job}
        ctx={makeCtx({ jobThreadActivityByJobId: { [job.id]: [] } as StagesRowRenderContext['jobThreadActivityByJobId'] })}
        submitNoteWithBody={vi.fn(async () => true)}
      />,
    )
    await settle()
    expect(screen.getByText('No activity yet — post the first note')).toBeTruthy()
    fireEvent.click(screen.getByLabelText("Add a note to this job's activity"))
    const input = screen.getByLabelText('Note text')
    expect(input).toBeTruthy()
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByLabelText('Note text')).toBeNull()
    expect(screen.getByLabelText("Add a note to this job's activity")).toBeTruthy()
  })

  it('See all under the box names the count and opens the shared full-page modal via ctx (v2.4302)', async () => {
    const openJobActivityExpand = vi.fn()
    const job = makeJob({ job_name: 'Shearer Pinpoint' })
    renderWithProviders(
      <JobsStagesActivityBox
        job={job}
        ctx={makeCtx({
          openJobActivityExpand,
          jobThreadActivityByJobId: {
            [job.id]: [
              note('n1', '2026-08-10T12:00:00Z', 'older note'),
              note('n2', '2026-08-11T12:00:00Z', 'newer note'),
            ],
          } as StagesRowRenderContext['jobThreadActivityByJobId'],
        })}
        submitNoteWithBody={vi.fn(async () => true)}
      />,
    )
    await settle()
    const seeAll = screen.getByLabelText('Expand job activity')
    expect(seeAll.textContent).toBe('See all 2')
    fireEvent.click(seeAll)
    expect(openJobActivityExpand).toHaveBeenCalledWith(job)
  })

  it('See all carries the report count and a report line wears the link blue (v2.4324)', async () => {
    const job = makeJob({ job_name: 'Water Sample Test' })
    renderWithProviders(
      <JobsStagesActivityBox
        job={job}
        ctx={makeCtx({
          jobThreadActivityByJobId: {
            [job.id]: [
              note('n1', '2026-09-30T17:09:00Z', 'Leaving job', 'Abraham'),
              { kind: 'report' as const, report: { id: 'r1', created_at: '2026-09-30T17:15:00Z', created_by_name: 'Abraham', template_name: 'Crew report' } },
            ],
          } as unknown as StagesRowRenderContext['jobThreadActivityByJobId'],
        })}
        submitNoteWithBody={vi.fn(async () => true)}
      />,
    )
    await settle()
    expect(screen.getByLabelText('Expand job activity').textContent).toBe('See all 2 · 1 report')
    expect(screen.getByLabelText('Entry 2, a report')).toBeTruthy()
    expect(screen.getByLabelText('Entry 1')).toBeTruthy()
  })

  it('before the feed loads, See all reads the job’s report count', async () => {
    const job = makeJob({ job_name: 'Water Sample Test', report_count: 1 })
    renderWithProviders(
      <JobsStagesActivityBox
        job={job}
        ctx={makeCtx({
          jobThreadStatsByJobId: {
            [job.id]: { note_count: 3, last_note_at: '2026-09-30T17:09:00Z', last_note_preview: 'Leaving job', last_note_author_name: 'Abraham' },
          } as unknown as StagesRowRenderContext['jobThreadStatsByJobId'],
        })}
        submitNoteWithBody={vi.fn(async () => true)}
      />,
    )
    await settle()
    expect(screen.getByLabelText('Expand job activity').textContent).toBe('See all · 1 report')
  })

  it('an empty box has no See all; the composer takes the strip’s place under the box (v2.4302)', async () => {
    const job = makeJob({ job_name: 'Cop Properties' })
    renderWithProviders(
      <JobsStagesActivityBox
        job={job}
        ctx={makeCtx({ jobThreadActivityByJobId: { [job.id]: [] } as StagesRowRenderContext['jobThreadActivityByJobId'] })}
        submitNoteWithBody={vi.fn(async () => true)}
      />,
    )
    await settle()
    expect(screen.queryByLabelText('Expand job activity')).toBeNull()
    fireEvent.click(screen.getByLabelText("Add a note to this job's activity"))
    expect(screen.getByLabelText('Note text')).toBeTruthy()
    expect(screen.queryByLabelText("Add a note to this job's activity")).toBeNull()
  })

  it('submits through the note pipeline on Enter', async () => {
    const submitNoteWithBody = vi.fn(async () => true)
    const job = makeJob({ job_name: 'Cop Properties' })
    renderWithProviders(
      <JobsStagesActivityBox
        job={job}
        ctx={makeCtx({ jobThreadActivityByJobId: { [job.id]: [] } as StagesRowRenderContext['jobThreadActivityByJobId'] })}
        submitNoteWithBody={submitNoteWithBody}
      />,
    )
    await settle()
    fireEvent.click(screen.getByLabelText("Add a note to this job's activity"))
    const input = screen.getByLabelText('Note text')
    fireEvent.change(input, { target: { value: 'Check arrived' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await vi.waitFor(() => expect(submitNoteWithBody).toHaveBeenCalledWith(job.id, 'Check arrived', 'draft'))
  })
})

describe('the customer’s conversation in the box (v2.6689, punch list #125)', () => {
  const dana = { id: 'c-dana', name: 'Dana Whitfield', goesBy: null, kind: 'customer' as const }
  const lines = [
    { id: 'm-out', contactId: 'c-dana', contact: dana, channel: 'text' as const, direction: 'out' as const, at: '2026-08-11T18:00:00Z', who: 'Tanya Ortiz', body: 'Dana, the city set your inspection for Thursday 8 to 10.', tied: true },
    { id: 'm-in', contactId: 'c-dana', contact: dana, channel: 'text' as const, direction: 'in' as const, at: '2026-08-12T01:15:00Z', who: '', body: 'Can you do Thursday after 10 instead?', tied: true },
  ]

  it('after the load, the lines sit unnumbered under their Text tags while the notes keep their numbers, and a press on one opens the customer’s sheet', async () => {
    const onOpenCustomerDoor = vi.fn()
    const job = makeJob({ job_name: 'Whitfield re-pipe' })
    renderWithProviders(
      <JobsStagesActivityBox
        job={job}
        ctx={makeCtx({
          jobThreadActivityByJobId: { [job.id]: [note('n1', '2026-08-10T12:00:00Z', 'older note'), note('n2', '2026-08-13T12:00:00Z', 'newer note')] } as StagesRowRenderContext['jobThreadActivityByJobId'],
          customerLinesByJobId: new Map([[job.id, lines]]),
          boardDotByJobId: new Map([[job.id, { who: 'Dana', channel: 'text', when: 'yesterday', line: 'Can you do Thursday after 10 instead?', status: 'Nobody has answered.' as const }]]),
          onOpenCustomerDoor,
        })}
      />,
    )
    await settle()
    expect(screen.getAllByLabelText(/^Entry /).map((n) => n.textContent)).toEqual(['1', '2'])
    expect(screen.getByLabelText('To the customer, a text').textContent).toBe('Text')
    expect(screen.getByLabelText('From the customer, a text').textContent).toBe('Text')
    expect(screen.getByText(/Can you do Thursday after 10 instead\?/)).toBeTruthy()
    expect(screen.getByText('Nobody has answered.')).toBeTruthy()
    fireEvent.click(screen.getByText(/Can you do Thursday after 10 instead\?/))
    expect(onOpenCustomerDoor).toHaveBeenCalledWith(job)
  })

  it('before the load, the teaser is the customer’s line when it is the newest thing on the job', async () => {
    const job = makeJob({ job_name: 'Whitfield re-pipe' })
    renderWithProviders(
      <JobsStagesActivityBox
        job={job}
        ctx={makeCtx({
          jobThreadStatsByJobId: {
            [job.id]: { note_count: 1, last_note_at: '2026-08-11T14:28:00Z', last_note_body: 'Inspector confirmed.', last_note_author_name: 'Rosa', last_report_at: null },
          } as StagesRowRenderContext['jobThreadStatsByJobId'],
          customerLinesByJobId: new Map([[job.id, lines]]),
        })}
      />,
    )
    await settle()
    expect(screen.getByText(/Can you do Thursday after 10 instead\?/)).toBeTruthy()
    expect(screen.queryByText(/Inspector confirmed/)).toBeNull()
    expect(screen.queryByText('Nobody has answered.')).toBeNull()
  })
})
