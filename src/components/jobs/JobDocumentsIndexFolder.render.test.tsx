// @vitest-environment jsdom
/**
 * Index this job's files on the Documents tab over a fake io (punch list #240, PR 1): the press runs round after
 * round until nothing remains, counts as it goes, lists what was held with the reason and offers the held files
 * again; a refusal shows its reason with Try again; a job with no folder links draws nothing. Made-up names only.
 */
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { IndexJobAnswer } from '../../lib/jobs/jobIndexFolder'
import type { JobIndexFolderIo } from '../../lib/jobs/jobIndexFolderIo'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { JobDocumentsIndexFolder } from './JobDocumentsIndexFolder'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

const job = { id: 'job-1', google_drive_link: 'https://drive.google.com/drive/folders/1JobFolder0000000001', job_pictures_link: null, job_plans_link: null }

afterEach(() => cleanup())

describe('JobDocumentsIndexFolder', () => {
  it('runs the rounds until none remain, then says what was indexed and lists the held files', async () => {
    const answers: IndexJobAnswer[] = [
      { indexed: 40, held: [], remaining: 3, total: 43 },
      { indexed: 3, held: [{ id: 'a', name: 'Permit scan.pdf', why: 'scan' }, { id: 'b', name: 'Spec book.pdf', why: 'big' }], remaining: 0, total: 43 },
    ]
    const indexJob = vi.fn(async () => answers.shift()!)
    const io: JobIndexFolderIo = { indexJob }
    renderWithProviders(<JobDocumentsIndexFolder job={job} io={io} />)
    expect(screen.getByText(/reads the words inside the job’s files/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Index this job’s files' }))
    await screen.findByText('Indexed 43 files, 41 with their words, 2 held.')
    expect(indexJob).toHaveBeenCalledTimes(2)
    expect(indexJob).toHaveBeenNthCalledWith(1, 'job-1', false)
    expect(screen.getByText('Permit scan.pdf: a scan with no text to read.')).toBeTruthy()
    expect(screen.getByText('Spec book.pdf: too big to read.')).toBeTruthy()
    // A big file is worth a second try; the press asks for the held rows again on the first round.
    answers.push({ indexed: 1, held: [{ id: 'a', name: 'Permit scan.pdf', why: 'scan' }], remaining: 0, total: 43 })
    fireEvent.click(screen.getByRole('button', { name: 'Try the held files again' }))
    await screen.findByText('Indexed 1 file, 1 held.')
    expect(indexJob).toHaveBeenNthCalledWith(3, 'job-1', true)
    expect(screen.queryByRole('button', { name: 'Try the held files again' })).toBeNull()
  })

  it('a refusal shows its reason with Try again, and the press is dead while a round runs', async () => {
    const indexJob = vi.fn(async (): Promise<IndexJobAnswer> => { throw new Error('That job has no Drive folder yet.') })
    renderWithProviders(<JobDocumentsIndexFolder job={job} io={{ indexJob }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Index this job’s files' }))
    await screen.findByRole('alert')
    expect(screen.getByRole('alert').textContent).toContain('The index did not run. That job has no Drive folder yet.')
    indexJob.mockResolvedValueOnce({ indexed: 0, held: [], remaining: 0, total: 0 })
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(screen.getByText('The job’s folders hold no files to index.')).toBeTruthy())
  })

  it('draws nothing for a job with no folder links', () => {
    const { container } = renderWithProviders(<JobDocumentsIndexFolder job={{ ...job, google_drive_link: null }} io={{ indexJob: vi.fn() }} />)
    expect(container.querySelector('[data-job-index-folder]')).toBeNull()
  })
})
