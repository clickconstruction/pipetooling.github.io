// @vitest-environment jsdom
/**
 * The papers under a job's plans over a fake io (punch list #239, the papers train): papers under the set each goes
 * with, the open ask in amber and the answered one in green, the owed group with It came, Keep a paper through the io
 * with the ask, and the empty words. Made-up names only.
 */
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PlanSetRow } from '../../lib/plans/planSets'
import type { JobPlansIo, PapersRead } from '../../lib/plans/planSetsIo'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { JobPapersSection } from './JobPapersSection'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
const opened: string[] = []
vi.mock('../../lib/openInExternalBrowser', () => ({ openInExternalBrowser: (url: string) => opened.push(url) }))

function row(over: Partial<PlanSetRow> & { id: string }): PlanSetRow {
  return {
    part_id: 'p1', name: 'Fixture spec book', kind: 'spec', source: 'supplier', dated: null, came_at: '2025-07-07T12:00:00Z', memo: '', link: 'https://drive.google.com/spec',
    replaces_set_id: null, marks_up_set_id: 's1', job_id: null, file_name: null, file_size: null, file_count: null, checked_at: null, check_note: null,
    owed: false, ask_lane: null, ask_request_id: null, created_by: null, created_at: '2025-07-07T12:00:00Z', updated_at: '2025-07-07T12:00:00Z', ...over,
  }
}
const sets: PlanSetRow[] = [row({ id: 's1', name: 'Issued set', kind: 'issued', source: 'gc', marks_up_set_id: null, link: 'https://drive.google.com/issued' }), row({ id: 's2', name: 'Addendum 1', kind: 'addendum', source: 'gc', marks_up_set_id: null })]
const papersRead: PapersRead = {
  rows: [
    row({ id: 'a', name: 'The owner’s task list', kind: 'task_list', source: 'gc', came_at: '2026-06-24T12:00:00Z', marks_up_set_id: 's2', memo: 'doors already bought', link: '', ask_lane: 'estimators', ask_request_id: 'q1' }),
    row({ id: 'b', name: 'Soil report', kind: 'report', source: 'gc', owed: true, link: '', came_at: '2025-09-15T12:00:00Z', marks_up_set_id: null, ask_lane: 'estimators', ask_request_id: 'q2' }),
    row({ id: 'c', name: 'Fixture spec book', marks_up_set_id: 's1' }),
  ],
  requests: [
    { id: 'q1', lane: 'estimators', title: 'Paint spec for the overhead piping?', status: 'open', created_at: '2026-06-25T15:00:00Z', closed_at: null, closed_note: null },
    { id: 'q2', lane: 'estimators', title: 'The owner owes the soil report', status: 'closed', created_at: '2025-09-15T12:00:00Z', closed_at: '2025-09-20T12:00:00Z', closed_note: 'Came by hand.' },
  ],
}

function fakeIo(read: PapersRead = papersRead, over: Partial<JobPlansIo> = {}): JobPlansIo {
  return {
    read: vi.fn(),
    readSite: vi.fn(),
    makeSitePart: vi.fn(),
    makePart: vi.fn(),
    pickPart: vi.fn(),
    addSet: vi.fn(),
    makeCurrent: vi.fn(),
    removeSet: vi.fn(async () => undefined),
    movePaper: vi.fn(async () => undefined),
    updateMemo: vi.fn(),
    readPapers: vi.fn(async () => read),
    keepPaper: vi.fn(async (a) => row({ id: 'new', name: a.draft.name, kind: a.draft.kind })),
    markPaperCame: vi.fn(async () => undefined),
    ...over,
  } as unknown as JobPlansIo
}

const props = { partId: 'p1', partName: 'Bunker', sets, currentSetId: 's2', jobId: 'j1', jobLabel: 'JP991', developmentId: 'd1', siteName: 'Quail Ridge', userId: 'u1', canWrite: true }

afterEach(() => {
  cleanup()
  opened.length = 0
})

describe('JobPapersSection', () => {
  it('reads the papers under the set each goes with, the asks, the owed one, and opens a link', async () => {
    const io = fakeIo()
    renderWithProviders(<JobPapersSection io={io} {...props} />)
    expect(await screen.findByText('2 papers on Bunker · 1 waiting on an answer · 1 owed')).toBeTruthy()
    expect(screen.getByText('With Addendum 1 · building from')).toBeTruthy()
    expect(screen.getByText('With Issued set')).toBeTruthy()
    expect(screen.getByText(/asked the estimators Jun 25 · waiting/)).toBeTruthy()
    expect(screen.getByText('Owed to us')).toBeTruthy()
    expect(screen.getByText('answered Sep 20')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Open ↗' }))
    expect(opened).toEqual(['https://drive.google.com/spec'])
    expect(io.readPapers).toHaveBeenCalledWith(['p1'])
  })

  it('keeps a paper with an ask through the io, and refuses one with no name', async () => {
    const io = fakeIo()
    renderWithProviders(<JobPapersSection io={io} {...props} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Keep a paper' }))
    const form = await screen.findByTestId('paper-form')
    fireEvent.click(screen.getByRole('button', { name: 'Keep the paper' }))
    expect(await screen.findByText('Give the paper a name.')).toBeTruthy()
    const inputs = form.querySelectorAll('input')
    fireEvent.change(inputs[0]!, { target: { value: 'Finishes sheet' } })
    fireEvent.click(form.querySelector('input[type=checkbox]')!)
    const asks = form.querySelectorAll('input')
    fireEvent.change(asks[asks.length - 1]!, { target: { value: 'Which finish on the overhead piping?' } })
    expect(form.textContent).toContain('Will write on the site’s History: Kept spec Finishes sheet, the owner, on Addendum 1 · asked the estimators: Which finish on the overhead piping?')
    fireEvent.click(screen.getByRole('button', { name: 'Keep the paper' }))
    await waitFor(() => expect(io.keepPaper).toHaveBeenCalled())
    const a = (io.keepPaper as ReturnType<typeof vi.fn>).mock.calls[0]![0]
    expect([a.partId, a.owed, a.jobId, a.developmentId, a.draft.name, a.draft.asks, a.draft.askWords, a.draft.goesWithSetId]).toEqual(['p1', false, 'j1', 'd1', 'Finishes sheet', true, 'Which finish on the overhead piping?', 's2'])
  })

  it('marks an owed paper as come with its link', async () => {
    const io = fakeIo()
    renderWithProviders(<JobPapersSection io={io} {...props} />)
    fireEvent.click(await screen.findByRole('button', { name: 'It came' }))
    fireEvent.change(screen.getByLabelText("The paper's link"), { target: { value: 'https://drive.google.com/soil' } })
    fireEvent.click(screen.getByRole('button', { name: 'It came' }))
    await waitFor(() => expect(io.markPaperCame).toHaveBeenCalledWith('b', 'https://drive.google.com/soil'))
  })

  it('says what fills an empty part, and a reader sees no press', async () => {
    renderWithProviders(<JobPapersSection io={fakeIo({ rows: [], requests: [] })} {...props} canWrite={false} />)
    expect(await screen.findByText(/Nothing is kept with Bunker’s plans yet\./)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Keep a paper' })).toBeNull()
  })
})
