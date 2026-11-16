// @vitest-environment jsdom
/**
 * Tagging a teammate from the Pipeline row's note box (punch list #363): the @ opens the list of
 * names, a pick writes the full name and holds the tag, Post sends the picked ids, and a posted
 * note that carries a tag draws its chip and its waiting words. The rules live in
 * src/lib/jobs/noteTags.test.ts.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'

const TAGGABLE = [
  { user_id: 'u-alv', name: 'Chris Alvarez', role: 'helpers', on_job: true },
  { user_id: 'u-bell', name: 'Chris Bell', role: 'assistant', on_job: false },
  { user_id: 'u-dana', name: 'Dana Whitlock', role: 'assistant', on_job: false },
]
const TAG_ROWS = [
  {
    note_id: 'n-2',
    tagged_user_id: 'u-dana',
    tagged_name: 'Dana Whitlock',
    tagger_user_id: 'u-marcus',
    created_at: '2026-11-15T16:04:00Z',
    cleared_at: null,
    cleared_how: null,
  },
]

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  const stub = makeSupabaseStub() as unknown as { from: (t: string) => unknown; rpc: (n: string, a?: unknown) => unknown }
  const from = stub.from.bind(stub)
  const rpc = stub.rpc.bind(stub)
  const rows = (data: unknown) => {
    const b: Record<string, unknown> = {}
    b.select = () => b
    b.eq = () => b
    b.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data, error: null }).then(ok)
    return b
  }
  stub.from = (table: string) => (table === 'jobs_ledger_note_tags' ? rows(TAG_ROWS) : from(table))
  stub.rpc = (name: string, args?: unknown) => (name === 'job_note_taggable' ? Promise.resolve({ data: TAGGABLE, error: null }) : rpc(name, args))
  return { supabase: stub }
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

const note = (id: string, at: string, body: string, author: string) => ({
  kind: 'note' as const,
  note: { id, created_at: at, body, author: { name: author } },
})

function mount(over: Partial<StagesRowRenderContext> = {}) {
  const submitNoteWithBody = vi.fn(async () => true)
  const job = makeJob({ job_name: 'Cedar Bluff Lofts' })
  const activity = [note('n-1', '2026-11-14T15:00:00Z', 'on going', 'Dana'), note('n-2', '2026-11-15T16:04:00Z', 'Did the check come? @Dana Whitlock', 'Marcus')]
  renderWithProviders(
    <JobsStagesActivityBox
      job={job}
      ctx={makeCtx({ jobThreadActivityByJobId: { [job.id]: activity } as unknown as StagesRowRenderContext['jobThreadActivityByJobId'], ...over })}
      submitNoteWithBody={submitNoteWithBody}
    />,
  )
  return { job, submitNoteWithBody }
}

function type(input: HTMLElement, value: string) {
  fireEvent.change(input, { target: { value, selectionStart: value.length } })
}

describe('JobsStagesActivityBox, tagging a teammate', () => {
  it('opens the list on @, crew first, and narrows it to the letters typed', async () => {
    mount()
    await settle()
    fireEvent.click(screen.getByLabelText("Add a note to this job's activity"))
    const input = screen.getByLabelText('Note text')
    type(input, 'meter date? @')
    const list = await screen.findByRole('listbox', { name: 'Teammates' })
    await vi.waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(3))
    expect(list.textContent).toContain('On this job')
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Chris Alvarezcrew · on this job', 'Chris Belloffice', 'Dana Whitlockoffice'])
    type(input, 'meter date? @da')
    await vi.waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(1))
  })

  it('picks with Enter, shows the name above the box, and posts its id', async () => {
    const { job, submitNoteWithBody } = mount()
    await settle()
    fireEvent.click(screen.getByLabelText("Add a note to this job's activity"))
    const input = screen.getByLabelText('Note text') as HTMLInputElement
    type(input, 'meter date? @ch')
    await vi.waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(2))
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    // Enter picked a name. It did not post.
    expect(submitNoteWithBody).not.toHaveBeenCalled()
    await vi.waitFor(() => expect(input.value).toBe('meter date? @Chris Bell '))
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(screen.getByLabelText('Take Chris Bell off')).toBeTruthy()
    fireEvent.keyDown(input, { key: 'Enter' })
    await vi.waitFor(() => expect(submitNoteWithBody).toHaveBeenCalledWith(job.id, 'meter date? @Chris Bell', 'draft', { tagged: ['u-bell'] }))
  })

  it('sends no tag for a name the writer took back out of the words', async () => {
    const { job, submitNoteWithBody } = mount()
    await settle()
    fireEvent.click(screen.getByLabelText("Add a note to this job's activity"))
    const input = screen.getByLabelText('Note text') as HTMLInputElement
    fireEvent.click(screen.getByLabelText('Tag a teammate'))
    await vi.waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(3))
    fireEvent.keyDown(input, { key: 'Enter' })
    await vi.waitFor(() => expect(input.value).toBe('@Chris Alvarez '))
    fireEvent.click(screen.getByLabelText('Take Chris Alvarez off'))
    await vi.waitFor(() => expect(input.value).toBe(''))
    type(input, 'arrive @ 8:45')
    expect(screen.queryByRole('listbox')).toBeNull()
    fireEvent.keyDown(input, { key: 'Enter' })
    await vi.waitFor(() => expect(submitNoteWithBody).toHaveBeenCalledWith(job.id, 'arrive @ 8:45', 'draft', { tagged: [] }))
  })

  it('shuts the list on Escape and keeps the box open', async () => {
    mount()
    await settle()
    fireEvent.click(screen.getByLabelText("Add a note to this job's activity"))
    const input = screen.getByLabelText('Note text')
    type(input, '@')
    await screen.findByRole('listbox')
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(screen.getByLabelText('Note text')).toBeTruthy()
  })

  it('draws no @ button for a role nobody can tag back', async () => {
    mount({ authRole: 'subcontractor' })
    await settle()
    fireEvent.click(screen.getByLabelText("Add a note to this job's activity"))
    expect(screen.queryByLabelText('Tag a teammate')).toBeNull()
    type(screen.getByLabelText('Note text'), '@')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('draws the chip and the waiting words on a note that carries a tag', async () => {
    const { container } = (() => {
      mount()
      return { container: document.body }
    })()
    await settle()
    await vi.waitFor(() => expect(container.querySelector('[data-note-tag-chip]')?.textContent).toBe('@Dana Whitlock'))
    expect(container.querySelector('[data-note-tag-words]')?.textContent).toMatch(/^waiting on Dana/)
    // The untagged note reads as it did.
    expect(container.querySelectorAll('[data-note-tag-chip]')).toHaveLength(1)
  })
})
