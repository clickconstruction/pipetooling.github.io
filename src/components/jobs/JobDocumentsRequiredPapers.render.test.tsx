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
import type { JobPaperSettingsIo } from '../../lib/jobs/jobPaperSettingsIo'
import { parseSettingsDef, type SettingsDef } from '../../lib/contracts/paperSettings'
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

// A paper built from settings (punch list #389 step 4). Every word is a placeholder.
const SETTINGS_DEF = parseSettingsDef({
  settings: [{ key: 'photos', label: 'Photos and video', choices: [{ key: 'ask', label: 'Ask first', says: 'Ask before a photo.' }, { key: 'none', label: 'None', says: 'No photos at all.' }] }],
  fields: [],
  levels: [{ key: 'standard', label: 'Standard', alignedWith: 'Aligned with a placeholder place', picks: { photos: 'ask' } }, { key: 'strict', label: 'Strict', alignedWith: 'Aligned with another placeholder place', picks: { photos: 'none' } }],
}) as SettingsDef
const builtBook: BookPaperRow[] = [...book, { id: 'book-set', document_name: 'Sample secrecy paper', book_body_html: null, book_body_format: 'html', audience: 'sub', settings_def: SETTINGS_DEF }]
const withBuilt: JobPapersRoster = parseJobPapersRoster({
  job_number: 'J2391',
  papers: [{ id: 'row-set', paper_name: 'Sample secrecy paper', is_form: false, book_document_id: 'book-set' }, { id: 'site', paper_name: 'Site rules and photo policy', is_form: false, book_document_id: 'book-site' }],
  people: people.map((p) => ({ ...p, papers: [] })),
})
function fakeSettingsIo(over: Partial<JobPaperSettingsIo> = {}): JobPaperSettingsIo {
  return {
    readJob: vi.fn(async () => ({ number: 'J2391', job_name: 'ZZ Test job', customer_name: null })),
    readBookPaper: vi.fn(async () => ({ id: 'book-set', name: 'Sample secrecy paper', def: SETTINGS_DEF, revision: 2, readRevision: null })),
    readSettingsPapers: vi.fn(async () => []),
    requireWithSettings: vi.fn(async () => undefined),
    setSettings: vi.fn(async (id: string) => ({ state: 'saved' as const, requiredPaperId: id, signAgain: 0 })),
    setBasis: vi.fn(async () => undefined),
    ...over,
  }
}

afterEach(() => cleanup())

describe('JobDocumentsRequiredPapers', () => {
  it('a paper built from settings opens the settings page when it is picked, and is required from there', async () => {
    const readRoster = vi.fn<JobPapersIo['readRoster']>().mockResolvedValueOnce(empty).mockResolvedValue(withBuilt)
    const io = fakeIo({ readRoster, readBook: vi.fn(async () => builtBook) })
    const settingsIo = fakeSettingsIo()
    const overlay = vi.fn()
    renderWithProviders(<JobDocumentsRequiredPapers job={{ id: 'job-1' }} io={io} settingsIo={settingsIo} onOverlayOpenChange={overlay} />)
    await screen.findByText('Nothing has to be signed before this job opens.')
    // A job with no papers takes no second read.
    expect(settingsIo.readSettingsPapers).not.toHaveBeenCalled()
    // The empty section's press is the only way in, so it takes a finger.
    expect(screen.getByRole('button', { name: 'Add a paper' }).style.minHeight).toBe('44px')
    fireEvent.click(screen.getByRole('button', { name: 'Add a paper' }))
    fireEvent.click(await screen.findByRole('button', { name: /Sample secrecy paper/ }))
    const page = await screen.findByRole('dialog', { name: 'Sample secrecy paper, job J2391' })
    expect(overlay).toHaveBeenLastCalledWith(true)
    // It is not a pending pick: nothing is saved by the section's own press.
    expect(screen.queryByText('not saved yet')).toBeNull()
    await within(page).findByText("Pick the level this job's paper should express.")
    for (let i = 0; i < 3; i++) fireEvent.click(within(page).getByRole('button', { name: /^Next/ }))
    fireEvent.click(within(page).getByRole('button', { name: 'Require this paper' }))
    await waitFor(() => expect(settingsIo.requireWithSettings).toHaveBeenCalledWith('job-1', 'book-set', { picks: { photos: 'ask' }, typed: null, basis: 'standard', noticeRead: false }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Sample secrecy paper, job J2391' })).toBeNull())
    expect(overlay).toHaveBeenLastCalledWith(false)
    expect(io.requirePapers).not.toHaveBeenCalled()
    await screen.findByTestId('job-papers-summary')
  })

  it('a required paper built from settings says so, and its Settings press opens the one page', async () => {
    const io = fakeIo({ readRoster: vi.fn(async () => withBuilt) })
    const settingsIo = fakeSettingsIo({ readSettingsPapers: vi.fn(async () => [{ requiredPaperId: 'row-set', bookDocumentId: 'book-set', picks: { photos: 'ask' }, typed: null, basis: 'standard', settingsRevision: 1, bookRevision: 2, signed: 0 }]) })
    renderWithProviders(<JobDocumentsRequiredPapers job={{ id: 'job-1' }} io={io} settingsIo={settingsIo} />)
    await screen.findByText('Built from this job’s settings')
    expect(settingsIo.readSettingsPapers).toHaveBeenCalledWith('job-1')
    // The plain paper beside it has no Settings press.
    expect(screen.getAllByRole('button', { name: /^Settings of / })).toHaveLength(1)
    // Settings and Take off are words that are presses: each takes a finger, 44 px tall.
    for (const name of ['Settings of Sample secrecy paper', 'Take Sample secrecy paper off']) expect(screen.getByRole('button', { name }).style.minHeight).toBe('44px')
    // The two wrap together on a narrow screen: they share one parent, which is not the row.
    const settingsPress = screen.getByRole('button', { name: 'Settings of Sample secrecy paper' })
    expect(settingsPress.parentElement).toBe(screen.getByRole('button', { name: 'Take Sample secrecy paper off' }).parentElement)
    expect(settingsPress.parentElement?.hasAttribute('data-job-paper')).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Settings of Sample secrecy paper' }))
    const page = await screen.findByRole('dialog', { name: 'Sample secrecy paper, job J2391' })
    await within(page).findByText('Nothing is changed yet.')
    expect((within(page).getByLabelText('The basis') as HTMLSelectElement).value).toBe('standard')
  })

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
