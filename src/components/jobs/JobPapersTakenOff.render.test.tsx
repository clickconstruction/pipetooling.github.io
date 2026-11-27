// @vitest-environment jsdom
/**
 * The dev's fold of a test job's taken-off papers (punch list #443, row 10): a dev on a ZZ test job reads it and
 * nobody else does, a paper something points at draws its press dead with the function's sentence, a live press
 * asks first and then calls the function, and a read that fails draws nothing. Made-up names.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import type { RemovedPaper } from '../../lib/jobs/jobPaperRemovedDelete'
import { JobPaperDeleteRefused, type JobPaperRemovedDeleteIo } from '../../lib/jobs/jobPaperRemovedDeleteIo'
import { JobPapersTakenOff } from './JobPapersTakenOff'

const paper = (over: Partial<RemovedPaper> = {}): RemovedPaper => ({ id: 'p1', paperName: 'ZZ Test site rules', requiredAt: '2026-11-20T15:00:00Z', removedAt: '2026-11-24T20:00:00Z', copies: 0, proposals: 0, takenAs: 0, revisions: 0, ...over })
/** Newest taken off first, as the function answers: one nothing points at, one a person's copy names, one with a later revision. */
const PAPERS = [paper(), paper({ id: 'p2', paperName: 'ZZ Test photo rules', removedAt: '2026-11-23T18:00:00Z', copies: 1 }), paper({ id: 'p3', paperName: 'ZZ Test gate rules', removedAt: '2026-11-22T18:00:00Z', revisions: 2 })]
const ZZ = { id: 'job-1', job_name: 'ZZ Test papers walk', customer_name: 'ZZ Test Customer' }
const REAL = { id: 'job-1', job_name: 'Larkfield Lot 9', customer_name: 'Larkfield Homes' }

/** A fake of the two calls. The list it answers drops a paper once that paper is deleted, as the database would. */
function fakeIo(over: Partial<JobPaperRemovedDeleteIo> = {}, papers: RemovedPaper[] = PAPERS) {
  let standing = papers
  const io = {
    readRemoved: vi.fn(async (_jobId: string) => standing),
    deletePaper: vi.fn(async (paperId: string) => {
      standing = standing.filter((p) => p.id !== paperId)
    }),
    ...over,
  }
  return io
}

const fold = () => screen.queryByTestId('job-papers-taken-off')
const open = () => fireEvent.click(screen.getByRole('button', { name: 'Show the taken-off papers' }))
const rows = () => screen.getAllByTestId('job-paper-taken-off')
const press = (i: number) => within(rows()[i]!).getByRole('button') as HTMLButtonElement

afterEach(cleanup)

describe('JobPapersTakenOff', () => {
  it('draws nothing for an assistant, or any role but a dev, and reads nothing for them', async () => {
    for (const role of ['assistant', 'controller', 'master_technician', 'estimator', 'primary', 'superintendent', 'subcontractor', 'helpers', null]) {
      const io = fakeIo()
      const { container } = renderWithProviders(<JobPapersTakenOff role={role} job={ZZ} io={io} />)
      await settle()
      expect(fold()).toBeNull()
      expect(container.querySelector('button')).toBeNull()
      expect(io.readRemoved).not.toHaveBeenCalled()
      cleanup()
    }
  })

  it('draws nothing for a dev on a real job, or a job whose names are not known, and reads nothing', async () => {
    for (const job of [REAL, { id: 'job-1' }]) {
      const io = fakeIo()
      renderWithProviders(<JobPapersTakenOff role="dev" job={job} io={io} />)
      await settle()
      expect(fold()).toBeNull()
      expect(io.readRemoved).not.toHaveBeenCalled()
      cleanup()
    }
  })

  it('draws nothing for a dev on a test job with no taken-off paper', async () => {
    const io = fakeIo({}, [])
    const { container } = renderWithProviders(<JobPapersTakenOff role="dev" job={ZZ} io={io} />)
    await waitFor(() => expect(io.readRemoved).toHaveBeenCalledWith('job-1'))
    await settle()
    expect(fold()).toBeNull()
    expect(container.querySelector('button')).toBeNull()
  })

  it('draws nothing when the read fails, as it does before the function exists', async () => {
    const io = fakeIo({ readRemoved: vi.fn(async () => Promise.reject(Object.assign(new Error('Could not find the function public.list_test_job_removed_papers(p_job_id) in the schema cache'), { code: 'PGRST202' }))) })
    const { container } = renderWithProviders(<JobPapersTakenOff role="dev" job={ZZ} io={io} />)
    await waitFor(() => expect(io.readRemoved).toHaveBeenCalledTimes(1))
    await settle()
    expect(fold()).toBeNull()
    expect(container.textContent).toBe('')
  })

  it('draws the folded line with its count for a dev on a ZZ test job, and lists each paper with its day once open', async () => {
    const io = fakeIo()
    renderWithProviders(<JobPapersTakenOff role="dev" job={ZZ} io={io} />)
    await waitFor(() => expect(fold()).not.toBeNull())
    expect(fold()!.textContent).toContain('Taken-off papers · 3')
    expect(screen.queryAllByTestId('job-paper-taken-off')).toHaveLength(0)
    open()
    expect(rows().map((r) => r.querySelector('b')!.textContent)).toEqual(['ZZ Test site rules', 'ZZ Test photo rules', 'ZZ Test gate rules'])
    expect(rows()[0]!.textContent).toContain('Taken off')
    // The name and the day are values, drawn apart from the words around them.
    expect([...rows()[0]!.querySelectorAll('[data-value="worked-out"]')].map((el) => el.textContent)).toEqual(['ZZ Test site rules', 'Tue, Nov 24'])
    expect(fold()!.textContent).toContain('Only a developer sees this list, on a test job.')
    fireEvent.click(screen.getByRole('button', { name: 'Hide the taken-off papers' }))
    expect(screen.queryAllByTestId('job-paper-taken-off')).toHaveLength(0)
  })

  it('draws Delete… dead on a paper something points at, in the dead pair, with the function’s sentence beside it', async () => {
    const io = fakeIo()
    renderWithProviders(<JobPapersTakenOff role="dev" job={ZZ} io={io} />)
    await waitFor(() => expect(fold()).not.toBeNull())
    open()
    expect(press(0).disabled).toBe(false)
    expect(press(1).disabled).toBe(true)
    expect(press(2).disabled).toBe(true)
    expect(press(1).style.background).toBe(DEAD_PRESS_FILL)
    expect(press(1).style.color).toBe(DEAD_PRESS_TEXT)
    expect(within(rows()[1]!).getByTestId('job-paper-taken-off-why').textContent).toBe('A copy on a person’s file names this paper. It stays.')
    expect(within(rows()[2]!).getByTestId('job-paper-taken-off-why').textContent).toBe('2 other papers are a revision of this one. Delete the later one first.')
    expect(within(rows()[0]!).queryByTestId('job-paper-taken-off-why')).toBeNull()
    fireEvent.click(press(1))
    await settle()
    expect(screen.queryByRole('button', { name: 'Delete the paper' })).toBeNull()
    expect(io.deletePaper).not.toHaveBeenCalled()
  })

  it('a live press asks first, naming the paper, then calls the function and reads the list again', async () => {
    const io = fakeIo()
    const overlay = vi.fn()
    renderWithProviders(<JobPapersTakenOff role="dev" job={ZZ} io={io} onOverlayOpenChange={overlay} />)
    await waitFor(() => expect(fold()).not.toBeNull())
    open()
    fireEvent.click(press(0))
    const yes = await screen.findByRole('button', { name: 'Delete the paper' })
    expect(screen.getByText('Delete ZZ Test site rules for good?')).toBeTruthy()
    expect(screen.getByText('This taken-off paper is deleted, and it cannot be brought back. Nobody’s signature goes with it.')).toBeTruthy()
    expect(overlay).toHaveBeenLastCalledWith(true)
    expect(io.deletePaper).not.toHaveBeenCalled()
    fireEvent.click(yes)
    await waitFor(() => expect(io.deletePaper).toHaveBeenCalledWith('p1'))
    expect(io.deletePaper).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('ZZ Test site rules was deleted.')).toBeTruthy()
    await waitFor(() => expect(fold()!.textContent).toContain('Taken-off papers · 2'))
    expect(io.readRemoved).toHaveBeenCalledTimes(2)
    expect(rows()).toHaveLength(2)
    expect(overlay).toHaveBeenLastCalledWith(false)
  })

  it('deletes nothing when the confirm is cancelled', async () => {
    const io = fakeIo()
    renderWithProviders(<JobPapersTakenOff role="dev" job={ZZ} io={io} />)
    await waitFor(() => expect(fold()).not.toBeNull())
    open()
    fireEvent.click(press(0))
    await screen.findByRole('button', { name: 'Delete the paper' })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Delete the paper' })).toBeNull())
    expect(io.deletePaper).not.toHaveBeenCalled()
    expect(io.readRemoved).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(press(0).disabled).toBe(false))
  })

  it('shows a refusal the function raises as its own sentence, on the paper’s line, and reads the list again', async () => {
    const said = 'A GC proposal was made on this paper. It stays.'
    const io = fakeIo({ deletePaper: vi.fn(async () => Promise.reject(new JobPaperDeleteRefused(said))) })
    renderWithProviders(<JobPapersTakenOff role="dev" job={ZZ} io={io} />)
    await waitFor(() => expect(fold()).not.toBeNull())
    open()
    fireEvent.click(press(0))
    fireEvent.click(await screen.findByRole('button', { name: 'Delete the paper' }))
    await waitFor(() => expect(within(rows()[0]!).getByTestId('job-paper-taken-off-why').textContent).toBe(said))
    expect(within(rows()[0]!).getByRole('alert').textContent).toBe(said)
    await waitFor(() => expect(io.readRemoved).toHaveBeenCalledTimes(2))
    expect(rows()).toHaveLength(3)
  })

  it('reads the list again when the pane says its papers changed', async () => {
    const io = fakeIo()
    const { rerender } = renderWithProviders(<JobPapersTakenOff role="dev" job={ZZ} io={io} readAgain={1} />)
    await waitFor(() => expect(io.readRemoved).toHaveBeenCalledTimes(1))
    rerender(<JobPapersTakenOff role="dev" job={ZZ} io={io} readAgain={2} />)
    await waitFor(() => expect(io.readRemoved).toHaveBeenCalledTimes(2))
  })

  it('stands each press a thumb tall, and lets a long name wrap inside a phone’s width', async () => {
    const io = fakeIo({}, [paper({ paperName: 'ZZ Test a paper with a very long name that will not fit on one line of a phone' })])
    renderWithProviders(<JobPapersTakenOff role="dev" job={ZZ} io={io} />)
    await waitFor(() => expect(fold()).not.toBeNull())
    open()
    for (const b of within(fold()!).getAllByRole('button') as HTMLButtonElement[]) expect(b.style.minHeight).toBe('44px')
    const row = rows()[0]!
    // The name's column may shrink to nothing and wraps anywhere, so the press beside it never pushes the row wide.
    expect(row.style.gridTemplateColumns).toBe('minmax(0, 1fr) auto')
    expect((row.firstElementChild as HTMLElement).style.overflowWrap).toBe('anywhere')
  })
})
