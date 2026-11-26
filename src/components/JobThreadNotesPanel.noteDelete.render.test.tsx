// @vitest-environment jsdom
/**
 * Deleting a test job's note (punch list #443, row 13): a dev reads Delete… on each note of a ZZ test job and deletes
 * one after a confirm that names the act; on a real job the press is dead with its reason; nobody else sees it.
 */
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../test/renderSmokeMocks'
import { JobThreadNotesPanel, type JobThreadActivityItem } from './JobThreadNotesPanel'

const io = vi.hoisted(() => ({ deleted: [] as Array<[string, string]>, refuse: null as null | Error, tags: [] as Array<Record<string, unknown>> }))
vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  const stub = makeSupabaseStub() as Record<string, unknown>
  const baseFrom = stub.from as (table: string) => Record<string, unknown>
  // The job's tag rows, which the panel reads for its chips: the answers are counted from them.
  stub.from = (table: string) => {
    if (table !== 'jobs_ledger_note_tags') return baseFrom(table)
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq']) b[m] = () => b
    b.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: io.tags, error: null }).then(ok)
    return b
  }
  return { supabase: stub }
})
vi.mock('../lib/notes/testNoteDeleteIo', () => ({
  deleteTestJobNote: async (noteId: string, jobId: string) => {
    if (io.refuse) throw io.refuse
    io.deleted.push([noteId, jobId])
  },
}))

const notes: JobThreadActivityItem[] = [
  { kind: 'note', note: { id: 'n1', body: 'ZZ walk note one', created_at: '2026-11-24T15:00:00Z', author: { name: 'Dana Office' }, author_user_id: 'u-dana' } },
  { kind: 'note', note: { id: 'n2', body: 'ZZ walk note two', created_at: '2026-11-25T15:00:00Z', author: { name: 'Hector Helper' }, author_user_id: 'u-hector' } },
] as unknown as JobThreadActivityItem[]

function draw(role: 'dev' | 'helpers' | 'assistant', job: { job_name: string | null; customer_name: string | null } | null, onNoteDeleted = vi.fn()) {
  renderWithProviders(
    <JobThreadNotesPanel
      activity={notes}
      viewerRole={role}
      loading={false}
      canPost
      draft=""
      onDraftChange={() => undefined}
      onSubmit={() => undefined}
      submitting={false}
      showSectionTitle={false}
      showEmptyPlaceholder={false}
      tagJobId="j1"
      noteDeleteJob={job}
      onNoteDeleted={onNoteDeleted}
    />,
  )
  return onNoteDeleted
}

afterEach(() => {
  cleanup()
  io.deleted = []
  io.refuse = null
  io.tags = []
})

describe('JobThreadNotesPanel: deleting a test job’s note (punch list #443, row 13)', () => {
  it('a dev deletes a note on a ZZ test job after a confirm that names the author and the act', async () => {
    const onNoteDeleted = draw('dev', { job_name: 'ZZ Test walk job', customer_name: 'Harbor Row' })
    const presses = screen.getAllByTestId('job-note-delete')
    expect(presses).toHaveLength(2)
    expect(presses[0]!.getAttribute('aria-disabled')).toBe('false')
    fireEvent.click(screen.getByRole('button', { name: 'Delete… Dana Office’s note' }))
    const yes = await screen.findByRole('button', { name: 'Delete the note' })
    expect(screen.getByText('Delete Dana Office’s note?')).toBeTruthy()
    expect(io.deleted).toEqual([])
    fireEvent.click(yes)
    await waitFor(() => expect(io.deleted).toEqual([['n1', 'j1']]))
    expect(await screen.findByText('The note was deleted.')).toBeTruthy()
    await waitFor(() => expect(onNoteDeleted).toHaveBeenCalledTimes(1))
  })

  it('deletes nothing when the confirm is cancelled, and says the reason when the delete is refused', async () => {
    const onNoteDeleted = draw('dev', { job_name: 'ZZ Test walk job', customer_name: null })
    fireEvent.click(screen.getByRole('button', { name: 'Delete… Dana Office’s note' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Delete the note' })).toBeNull())
    expect(io.deleted).toEqual([])
    io.refuse = new Error('1 tag names this as its answer. It stays.')
    fireEvent.click(screen.getByRole('button', { name: 'Delete… Hector Helper’s note' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Delete the note' }))
    expect(await screen.findByText('1 tag names this as its answer. It stays.')).toBeTruthy()
    expect(onNoteDeleted).not.toHaveBeenCalled()
  })

  it('a note a tag names as its answer reads a dead press with the reason, before any confirm, and the ask stays live (finding 273)', async () => {
    // Dana's note tagged Hector, and Hector's note answered it.
    io.tags = [{ note_id: 'n1', tagged_user_id: 'u-hector', tagged_name: 'Hector Helper', tagger_user_id: 'u-dana', created_at: '2026-11-24T15:00:00Z', cleared_at: '2026-11-25T15:00:00Z', cleared_how: 'answered', answer_note_id: 'n2' }]
    draw('dev', { job_name: 'ZZ Test walk job', customer_name: null })
    const answer = screen.getByRole('button', { name: 'Delete… Hector Helper’s note' })
    await waitFor(() => expect(answer.getAttribute('aria-disabled')).toBe('true'))
    const whys = screen.getAllByTestId('job-note-delete-why')
    expect(whys).toHaveLength(1)
    expect(whys[0]!.textContent).toBe('1 tag names this as its answer. It stays.')
    fireEvent.click(answer)
    expect(screen.queryByRole('button', { name: 'Delete the note' })).toBeNull()
    expect(io.deleted).toEqual([])
    // The ask is named by nothing: its press is live, and its tags go with it.
    const ask = screen.getByRole('button', { name: 'Delete… Dana Office’s note' })
    expect(ask.getAttribute('aria-disabled')).toBe('false')
    fireEvent.click(ask)
    expect(await screen.findByRole('button', { name: 'Delete the note' })).toBeTruthy()
  })

  it('on a real job the press is dead with its reason, and a press on it opens no confirm', () => {
    draw('dev', { job_name: 'Loft rough-in', customer_name: 'Harbor Row' })
    const press = screen.getAllByTestId('job-note-delete')[0]!
    expect(press.getAttribute('aria-disabled')).toBe('true')
    expect(screen.getAllByTestId('job-note-delete-why')[0]!.textContent).toBe('Only a note on a test job can be deleted. The job’s name or its customer’s name must start with ZZ.')
    fireEvent.click(press)
    expect(screen.queryByRole('button', { name: 'Delete the note' })).toBeNull()
  })

  it('nobody but a dev reads the press, and a host that names no job offers none', () => {
    draw('assistant', { job_name: 'ZZ Test walk job', customer_name: null })
    expect(screen.queryByTestId('job-note-delete')).toBeNull()
    cleanup()
    draw('helpers', { job_name: 'ZZ Test walk job', customer_name: null })
    expect(screen.queryByTestId('job-note-delete')).toBeNull()
    cleanup()
    draw('dev', null)
    expect(screen.queryByTestId('job-note-delete')).toBeNull()
  })
})
