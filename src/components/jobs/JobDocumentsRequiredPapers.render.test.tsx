// @vitest-environment jsdom
/**
 * Papers before this job opens on the Documents tab, over a fake io: a job with none names the next press; picking
 * two papers draws the counted save and how many people it reaches; the
 * roster shows who has signed and copies a person's signing links; a paper comes off after the confirm; a failed
 * read draws the retry panel. Made-up names only.
 */
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { type BookPaperRow, type JobPapersRoster, parseJobPapersRoster } from '../../lib/jobs/jobPapers'
import type { JobPapersIo } from '../../lib/jobs/jobPapersIo'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { JobDocumentsRequiredPapers } from './JobDocumentsRequiredPapers'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'assistant' })
})

const people = [
  { key: 'p1', person_id: 'p1', user_id: 'u1', name: 'Renee Alvarez', role: 'assistant', ways: ['office'], has_login: true, linked: true },
  { key: 'p2', person_id: 'p2', user_id: 'u2', name: 'Luis Ortega', role: 'helpers', ways: ['crew'], has_login: true, linked: true },
  { key: 'u3', person_id: null, user_id: 'u3', name: 'Dana Whitlock', role: 'helpers', ways: ['crew'], has_login: true, linked: false },
]
const empty: JobPapersRoster = parseJobPapersRoster({ job_number: 'J2391', papers: [], people: people.map((p) => ({ ...p, papers: [] })) })
const saved: JobPapersRoster = parseJobPapersRoster({
  job_number: 'J2391',
  papers: [
    { id: 'nda', paper_name: 'Ridgeway Builders NDA', is_form: true, book_document_id: 'book-nda' },
    { id: 'site', paper_name: 'Site rules and photo policy', is_form: false, book_document_id: 'book-site' },
  ],
  people: [
    { ...people[0], papers: [] },
    { ...people[1], papers: [{ required_paper_id: 'nda', document_id: 'd3', status: 'signed', signed_at: '2026-11-16' }] },
    { ...people[2], papers: [] },
  ],
})
const book: BookPaperRow[] = [
  { id: 'book-nda', document_name: 'Ridgeway Builders NDA', book_body_html: null, book_body_format: 'html', form_template_id: 'form-1', audience: 'staff' },
  { id: 'book-site', document_name: 'Site rules and photo policy', book_body_html: '<p>No photos.</p>', book_body_format: 'html', audience: 'staff' },
  { id: 'book-blank', document_name: 'Blank paper', book_body_html: '', book_body_format: 'html', audience: 'staff' },
]

function fakeIo(over: Partial<JobPapersIo> = {}): JobPapersIo {
  return {
    readRoster: vi.fn(async () => empty),
    readBook: vi.fn(async () => book),
    requirePapers: vi.fn(async () => 2),
    removePaper: vi.fn(async () => undefined),
    signingLink: vi.fn(async (paperId: string) => `https://example.test/sign/${paperId}`),
    countRequired: vi.fn(async () => 0),
    readClosed: vi.fn(async () => []),
    readMine: vi.fn(async () => ({ jobNumber: 'J2391', linked: true, papers: [] })),
    ownSigningLink: vi.fn(async () => 'https://example.test/sign/own'),
    readNeedingMe: vi.fn(async () => []),
    ...over,
  }
}

afterEach(() => cleanup())

describe('JobDocumentsRequiredPapers', () => {
  it('a job with no papers names the next press, and the save counts the papers and the people', async () => {
    const readRoster = vi.fn<JobPapersIo['readRoster']>().mockResolvedValueOnce(empty).mockResolvedValue(saved)
    const io = fakeIo({ readRoster })
    renderWithProviders(<JobDocumentsRequiredPapers job={{ id: 'job-1' }} io={io} />)
    await screen.findByText('Nothing has to be signed before this job opens.')
    fireEvent.click(screen.getByRole('button', { name: 'Add a paper' }))
    const blank = await screen.findByRole('button', { name: /Blank paper/ })
    expect((blank as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('No words yet. Write it in the Contract Book first.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Ridgeway Builders NDA/ }))
    fireEvent.click(screen.getByRole('button', { name: /Site rules and photo policy/ }))
    expect(screen.getByText('not saved yet')).toBeTruthy()
    expect(screen.getByTestId('job-papers-foot').textContent).toBe('3 people can open this job today. Each one is locked out of it until they sign, the office and you included.')
    fireEvent.click(screen.getByRole('button', { name: 'Require 2 papers' }))
    await waitFor(() => expect(io.requirePapers).toHaveBeenCalledWith('job-1', ['book-nda', 'book-site']))
    // Saved: the roster.
    await screen.findByTestId('job-papers-summary')
    expect(screen.getByTestId('job-papers-summary').textContent).toBe('0 of 3 have signed. 3 still owe a paper.')
    // The database holds the lock now, so the section carries no note about what is still to land.
    expect(screen.queryByTestId('job-papers-stage-note')).toBeNull()
  })

  it('the roster shows who has signed, copies a person’s links, and says why a row has none', async () => {
    const writeText = vi.fn(async () => undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    const io = fakeIo({ readRoster: vi.fn(async () => saved) })
    renderWithProviders(<JobDocumentsRequiredPapers job={{ id: 'job-1' }} io={io} />)
    const luis = (await screen.findByText('Luis Ortega')).closest('tr')!
    expect(within(luis).getByText('signed ✓')).toBeTruthy()
    expect(within(luis).getByText('Nov 16')).toBeTruthy()
    expect(within(luis).getByText('not yet')).toBeTruthy()
    fireEvent.click(within(luis).getByRole('button', { name: 'Copy the signing link' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('https://example.test/sign/site'))
    expect(io.signingLink).toHaveBeenCalledWith('site', 'p2')
    const dana = screen.getByText('Dana Whitlock').closest('tr')!
    expect(within(dana).getByText('No file is linked to this login. Link it on People, then they can sign.')).toBeTruthy()
    const renee = screen.getByText('Renee Alvarez').closest('tr')!
    expect(within(renee).getByRole('button', { name: 'Copy 2 signing links' })).toBeTruthy()
  })

  it('a link that fails is named and the rest still copy', async () => {
    const writeText = vi.fn(async () => undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    const signingLink = vi.fn(async (paperId: string) => {
      if (paperId === 'nda') throw new Error('This job no longer requires that paper.')
      return `https://example.test/sign/${paperId}`
    })
    const io = fakeIo({ readRoster: vi.fn(async () => saved), signingLink })
    renderWithProviders(<JobDocumentsRequiredPapers job={{ id: 'job-1' }} io={io} />)
    const renee = (await screen.findByText('Renee Alvarez')).closest('tr')!
    fireEvent.click(within(renee).getByRole('button', { name: 'Copy 2 signing links' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('https://example.test/sign/site'))
    expect(await screen.findByText('1 signing link did not copy. It stays here with the reason.')).toBeTruthy()
    expect(screen.getByText('Ridgeway Builders NDA: This job no longer requires that paper.')).toBeTruthy()
  })

  it('a paper comes off after the confirm', async () => {
    const io = fakeIo({ readRoster: vi.fn(async () => saved) })
    renderWithProviders(<JobDocumentsRequiredPapers job={{ id: 'job-1' }} io={io} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Take Site rules and photo policy off' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Take the paper off' }))
    await waitFor(() => expect(io.removePaper).toHaveBeenCalledWith('site'))
  })

  it('a read that fails draws the retry panel', async () => {
    const io = fakeIo({ readRoster: vi.fn(async () => Promise.reject(new Error('Only the office reads who has signed a job’s papers.'))) })
    renderWithProviders(<JobDocumentsRequiredPapers job={{ id: 'job-1' }} io={io} />)
    expect(await screen.findByText(/Only the office reads who has signed/)).toBeTruthy()
    expect(screen.queryByText('Nothing has to be signed before this job opens.')).toBeNull()
  })
})
