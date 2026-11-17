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

/** What the tags read answers: null for the rows above, or a test's own. */
const held = vi.hoisted(() => ({ rows: null as unknown[] | null }))

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
  stub.from = (table: string) => (table === 'jobs_ledger_note_tags' ? rows(held.rows ?? TAG_ROWS) : from(table))
  stub.rpc = (name: string, args?: unknown) => (name === 'job_note_taggable' ? Promise.resolve({ data: TAGGABLE, error: null }) : rpc(name, args))
  return { supabase: stub }
})

import { JobsStagesActivityBox } from './JobsStagesActivityBox'
import type { StagesRowRenderContext } from './jobsStagesRowShared'
import { makeJob, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { noteTagsChanged } from '../../lib/jobs/noteTagsIo'

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
    // Each name is a press with what the person does under it (punch list #375), the crew first.
    expect(list.textContent).toContain('on this job')
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['@Chris Alvarezcrew · on this job', '@Chris Belloffice', '@Dana Whitlockoffice'])
    expect(screen.getAllByRole('option').every((o) => o.tagName === 'BUTTON' && o.style.minHeight === '44px')).toBe(true)
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

  it('keeps the names up through a space while the words still start a name, and shuts on nobody (punch list #375)', async () => {
    mount()
    await settle()
    fireEvent.click(screen.getByLabelText("Add a note to this job's activity"))
    const input = screen.getByLabelText('Note text')
    type(input, 'ask @chris')
    await vi.waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(2))
    type(input, 'ask @chris ')
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['@Chris Alvarezcrew · on this job', '@Chris Belloffice'])
    type(input, 'ask @chris b')
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['@Chris Belloffice'])
    // The @ being typed is underlined in the words while names fit it.
    expect(document.querySelector('[data-note-tag-mark] [data-mark="typing"]')?.textContent).toBe('@chris b')
    type(input, 'ask @chris bx')
    expect(screen.queryByRole('listbox')).toBeNull()
    // Letters that are nobody's name show no row, and no mark.
    type(input, 'gone @home')
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(document.querySelector('[data-note-tag-mark]')).toBeNull()
  })

  it('tags on a tap that keeps the box in focus, marks the name in the words, and one Backspace takes it off (punch list #375)', async () => {
    const { job, submitNoteWithBody } = mount()
    await settle()
    fireEvent.click(screen.getByLabelText("Add a note to this job's activity"))
    const input = screen.getByLabelText('Note text') as HTMLInputElement
    type(input, 'ask @chris b')
    await vi.waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(1))
    // pointerdown, with its default prevented: the box keeps its focus and a phone's keyboard stays up.
    const down = fireEvent.pointerDown(screen.getByRole('option'))
    expect(down).toBe(false)
    await vi.waitFor(() => expect(input.value).toBe('ask @Chris Bell '))
    expect(document.querySelector('[data-note-tag-mark] [data-mark="tag"]')?.textContent).toBe('@Chris Bell')
    expect(screen.getByLabelText('Take Chris Bell off')).toBeTruthy()
    input.setSelectionRange(16, 16)
    const key = fireEvent.keyDown(input, { key: 'Backspace' })
    expect(key).toBe(false)
    await vi.waitFor(() => expect(input.value).toBe('ask '))
    expect(document.querySelector('[data-note-tag-mark]')).toBeNull()
    expect(screen.queryByLabelText('Take Chris Bell off')).toBeNull()
    // Typing the same name back by hand makes no tag: a tag is a tap or Enter.
    type(input, 'ask @Chris Bell now')
    expect(screen.queryByLabelText('Take Chris Bell off')).toBeNull()
    fireEvent.keyDown(input, { key: 'Enter' })
    await vi.waitFor(() => expect(submitNoteWithBody).toHaveBeenCalledWith(job.id, 'ask @Chris Bell now', 'draft', { tagged: [] }))
  })

  it('takes the whole tag off when a phone keyboard that names no key deletes one letter (punch list #375)', async () => {
    mount()
    await settle()
    fireEvent.click(screen.getByLabelText("Add a note to this job's activity"))
    const input = screen.getByLabelText('Note text') as HTMLInputElement
    type(input, 'ask @da')
    await vi.waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(1))
    fireEvent.keyDown(input, { key: 'Enter' })
    await vi.waitFor(() => expect(input.value).toBe('ask @Dana Whitlock '))
    fireEvent.keyDown(input, { key: 'Unidentified' })
    type(input, 'ask @Dana Whitlock')
    await vi.waitFor(() => expect(input.value).toBe('ask '))
    expect(screen.queryByLabelText('Take Dana Whitlock off')).toBeNull()
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

  it('reads the tags again when a tag changes in the tab, so the reader sees their own post tagged at once (v2.7426)', async () => {
    // The feed already holds the note, as it does once the optimistic row is swapped for the real one, and no tag yet.
    held.rows = []
    try {
      mount()
      await settle()
      expect(document.body.querySelector('[data-note-tag-chip]')).toBeNull()
      held.rows = null
      noteTagsChanged()
      await vi.waitFor(() => expect(document.body.querySelector('[data-note-tag-chip]')?.textContent).toBe('@Dana Whitlock'))
    } finally {
      held.rows = null
    }
  })
})
