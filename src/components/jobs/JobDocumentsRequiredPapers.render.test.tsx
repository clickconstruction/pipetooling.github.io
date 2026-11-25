// @vitest-environment jsdom
/**
 * Papers before this job opens on the Documents tab, over a fake io: a job with none names the next press; picking
 * two papers draws the counted save and how many people it reaches; the
 * roster shows who has signed and copies a person's signing links; a paper comes off after the confirm; a failed
 * read draws the retry panel. Made-up names only.
 */
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { type BookPaperRow, type JobPapersRoster, parseJobPapersRoster } from '../../lib/jobs/jobPapers'
import type { JobPapersIo } from '../../lib/jobs/jobPapersIo'
import type { JobPaperProposal, JobPaperProposalsIo } from '../../lib/jobs/jobPaperProposalsIo'
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
    readGcOwn: vi.fn(async () => []),
    setGcOwn: vi.fn(async () => undefined),
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
    setGcView: vi.fn(async () => undefined),
    ...over,
  }
}

// What the job's GC proposed and the office has not answered (step 6). Made-up name.
const PROPOSAL: JobPaperProposal = { id: 'prop-1', requiredPaperId: 'row-set', byName: 'Greta Sample', proposedAt: '2026-11-24T18:00:00+00:00', fromPicks: { photos: 'ask' }, picks: { photos: 'none' } }
function fakeProposalsIo(over: Partial<JobPaperProposalsIo> = {}): JobPaperProposalsIo {
  return { readWaiting: vi.fn(async () => [PROPOSAL]), decide: vi.fn(async (_id: string, take: boolean) => ({ took: take, signAgain: 0 })), ...over }
}
const builtPaper = (signed: number) => [{ requiredPaperId: 'row-set', bookDocumentId: 'book-set', picks: { photos: 'ask' }, typed: null, basis: 'standard', gcView: 'businesses' as const, settingsRevision: 1, bookRevision: 2, signed }]

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
    const settingsIo = fakeSettingsIo({ readSettingsPapers: vi.fn(async () => [{ requiredPaperId: 'row-set', bookDocumentId: 'book-set', picks: { photos: 'ask' }, typed: null, basis: 'standard', gcView: 'businesses' as const, settingsRevision: 1, bookRevision: 2, signed: 0 }]) })
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

  it('a GC’s proposal waits under its paper, and Take it says who signs again before it saves', async () => {
    const io = fakeIo({ readRoster: vi.fn(async () => withBuilt) })
    const settingsIo = fakeSettingsIo({ readSettingsPapers: vi.fn(async () => builtPaper(2)) })
    const proposalsIo = fakeProposalsIo({ decide: vi.fn(async () => ({ took: true, signAgain: 2 })) })
    renderWithProviders(<JobDocumentsRequiredPapers job={{ id: 'job-1' }} io={io} settingsIo={settingsIo} proposalsIo={proposalsIo} />)
    const card = await screen.findByRole('group', { name: 'A proposal on Sample secrecy paper' })
    expect(proposalsIo.readWaiting).toHaveBeenCalledWith('job-1')
    expect(within(card).getByText('Greta Sample proposed stricter settings on Nov 24, 2026')).toBeTruthy()
    // Each topic it moves, from the job's choice to the stricter one, with that choice's plain words.
    await within(card).findByText('Photos and video')
    expect(card.textContent).toContain('Ask first to None')
    expect(card.textContent).toContain('No photos at all.')
    expect(within(card).getByText('The paper stays as it is until you take it.')).toBeTruthy()
    const take = within(card).getByRole('button', { name: 'Take it, and ask 2 people to sign again' })
    expect(take.style.minHeight).toBe('44px')
    fireEvent.click(take)
    // The confirm names the act and says what it does.
    expect(await screen.findByText(/2 people have signed this paper\. Each signs the new version again/)).toBeTruthy()
    expect(proposalsIo.decide).not.toHaveBeenCalled()
    // The card's press and the confirm's share their words: the confirm's is the last one drawn.
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Take it, and ask 2 people to sign again' })).toHaveLength(2))
    fireEvent.click(screen.getAllByRole('button', { name: 'Take it, and ask 2 people to sign again' }).pop()!)
    await waitFor(() => expect(proposalsIo.decide).toHaveBeenCalledWith('prop-1', true, undefined))
    expect(await screen.findByText('The proposal is taken. 2 people sign the new version again.')).toBeTruthy()
    // The section reads again after the answer.
    await waitFor(() => expect(io.readRoster).toHaveBeenCalledTimes(2))
  })

  it('Decline asks for a reason the GC reads and does not go through without one, and a paper with no proposal draws no card', async () => {
    const io = fakeIo({ readRoster: vi.fn(async () => withBuilt) })
    const settingsIo = fakeSettingsIo({ readSettingsPapers: vi.fn(async () => builtPaper(0)) })
    const proposalsIo = fakeProposalsIo()
    renderWithProviders(<JobDocumentsRequiredPapers job={{ id: 'job-1' }} io={io} settingsIo={settingsIo} proposalsIo={proposalsIo} />)
    const card = await screen.findByRole('group', { name: 'A proposal on Sample secrecy paper' })
    // Nobody has signed, so the take is plain.
    expect(within(card).getByRole('button', { name: 'Take it' })).toBeTruthy()
    // One card: the paper in prose beside it takes no proposal.
    expect(screen.getAllByRole('group', { name: /^A proposal on / })).toHaveLength(1)
    fireEvent.click(within(card).getByRole('button', { name: 'Decline…' }))
    const box = await screen.findByRole('textbox')
    // The reason is required (finding 125): the press is dead on an empty box and on spaces alone, and Enter sends nothing.
    const press = screen.getByRole<HTMLButtonElement>('button', { name: 'Decline the proposal' })
    expect(press.disabled).toBe(true)
    fireEvent.click(press)
    fireEvent.keyDown(box, { key: 'Enter' })
    fireEvent.change(box, { target: { value: '   ' } })
    expect(press.disabled).toBe(true)
    fireEvent.keyDown(box, { key: 'Enter' })
    await act(async () => {})
    expect(screen.getByRole('dialog', { name: 'Decline the GC’s proposal?' })).toBeTruthy()
    expect(proposalsIo.decide).not.toHaveBeenCalled()
    fireEvent.change(box, { target: { value: '  Placeholder reason.  ' } })
    expect(press.disabled).toBe(false)
    fireEvent.click(press)
    await waitFor(() => expect(proposalsIo.decide).toHaveBeenCalledWith('prop-1', false, 'Placeholder reason.'))
    expect(await screen.findByText('The proposal is declined. The GC’s page says so.')).toBeTruthy()
  })

  it('a refused answer says its reason on the card, and a failed read of proposals draws none', async () => {
    const io = fakeIo({ readRoster: vi.fn(async () => withBuilt) })
    const settingsIo = fakeSettingsIo({ readSettingsPapers: vi.fn(async () => builtPaper(0)) })
    const proposalsIo = fakeProposalsIo({ decide: vi.fn(async () => Promise.reject(new Error('That proposal is no longer waiting.'))) })
    const { unmount } = renderWithProviders(<JobDocumentsRequiredPapers job={{ id: 'job-1' }} io={io} settingsIo={settingsIo} proposalsIo={proposalsIo} />)
    const card = await screen.findByRole('group', { name: 'A proposal on Sample secrecy paper' })
    fireEvent.click(within(card).getByRole('button', { name: 'Take it' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Take the proposal' }))
    expect(await within(card).findByRole('alert')).toBeTruthy()
    expect(card.textContent).toContain('That proposal is no longer waiting.')
    unmount()
    renderWithProviders(<JobDocumentsRequiredPapers job={{ id: 'job-1' }} io={io} settingsIo={settingsIo} proposalsIo={fakeProposalsIo({ readWaiting: vi.fn(async () => Promise.reject(new Error('offline'))) })} />)
    await screen.findByText('Built from this job’s settings')
    expect(screen.queryByRole('group', { name: /^A proposal on / })).toBeNull()
  })

  // The GC's own form (punch list #389 step 7).
  it('a tick beside a form’s line picks it as the GC’s own, and the save requires it and then marks it', async () => {
    const readRoster = vi.fn<JobPapersIo['readRoster']>().mockResolvedValueOnce(empty).mockResolvedValue(saved)
    const io = fakeIo({ readRoster, requirePapers: vi.fn(async () => 1), readGcOwn: vi.fn(async () => ['nda']) })
    const { container } = renderWithProviders(<JobDocumentsRequiredPapers job={{ id: 'job-1' }} io={io} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Add a paper' }))
    // Only a form takes the tick: the paper in prose and the entry with no words have none.
    const tick = await screen.findByRole('checkbox', { name: 'Ridgeway Builders NDA: This is the GC’s own form' })
    expect(screen.getAllByRole('checkbox')).toHaveLength(1)
    expect((tick.closest('label') as HTMLElement).style.minHeight).toBe('44px')
    fireEvent.click(tick)
    // It moves up to the unsaved rows with its tick on, and says whose form it is.
    const row = container.querySelector('[data-job-paper="pending"]') as HTMLElement
    expect(within(row).getByText('The GC’s own form')).toBeTruthy()
    expect((within(row).getByRole('checkbox') as HTMLInputElement).checked).toBe(true)
    expect(screen.getByText('not saved yet')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Require 1 paper' }))
    await waitFor(() => expect(io.requirePapers).toHaveBeenCalledWith('job-1', ['book-nda']))
    await waitFor(() => expect(io.setGcOwn).toHaveBeenCalledWith('nda', true))
    // Saved: the required row says it and keeps the tick.
    await waitFor(() => expect(container.querySelector('[data-job-paper="live"] [data-job-paper-from]')?.textContent).toBe('The GC’s own form'))
    expect((screen.getByRole('checkbox', { name: 'Ridgeway Builders NDA: This is the GC’s own form' }) as HTMLInputElement).checked).toBe(true)
  })

  it('a form picked by its line is not marked, and the unsaved row’s tick can change that', async () => {
    const readRoster = vi.fn<JobPapersIo['readRoster']>().mockResolvedValueOnce(empty).mockResolvedValue(saved)
    const io = fakeIo({ readRoster, requirePapers: vi.fn(async () => 1) })
    const { container } = renderWithProviders(<JobDocumentsRequiredPapers job={{ id: 'job-1' }} io={io} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Add a paper' }))
    fireEvent.click(await screen.findByRole('button', { name: /Ridgeway Builders NDA/ }))
    const row = container.querySelector('[data-job-paper="pending"]') as HTMLElement
    expect(within(row).getByText('A form from the Contract Book')).toBeTruthy()
    const tick = within(row).getByRole('checkbox') as HTMLInputElement
    expect(tick.checked).toBe(false)
    fireEvent.click(tick)
    expect(within(row).getByText('The GC’s own form')).toBeTruthy()
    fireEvent.click(tick)
    fireEvent.click(screen.getByRole('button', { name: 'Require 1 paper' }))
    await waitFor(() => expect(io.requirePapers).toHaveBeenCalledWith('job-1', ['book-nda']))
    await screen.findByTestId('job-papers-summary')
    expect(io.setGcOwn).not.toHaveBeenCalled()
  })

  it('a required form’s tick saves in place and comes off the same way, and a paper in prose has none', async () => {
    const readGcOwn = vi.fn<JobPapersIo['readGcOwn']>().mockResolvedValueOnce([]).mockResolvedValueOnce(['nda']).mockResolvedValue([])
    const io = fakeIo({ readRoster: vi.fn(async () => saved), readGcOwn })
    const { container } = renderWithProviders(<JobDocumentsRequiredPapers job={{ id: 'job-1' }} io={io} />)
    const tick = (await screen.findByRole('checkbox', { name: 'Ridgeway Builders NDA: This is the GC’s own form' })) as HTMLInputElement
    expect(screen.getAllByRole('checkbox')).toHaveLength(1)
    expect(tick.checked).toBe(false)
    fireEvent.click(tick)
    await waitFor(() => expect(io.setGcOwn).toHaveBeenCalledWith('nda', true))
    await screen.findByText('Ridgeway Builders NDA is marked as the GC’s own form. Nobody signs again.')
    await waitFor(() => expect(container.querySelector('[data-job-paper="live"] [data-job-paper-from]')?.textContent).toBe('The GC’s own form'))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Ridgeway Builders NDA: This is the GC’s own form' }))
    await waitFor(() => expect(io.setGcOwn).toHaveBeenLastCalledWith('nda', false))
    await screen.findByText('Ridgeway Builders NDA is no longer marked as the GC’s own form. Nobody signs again.')
    await waitFor(() => expect(container.querySelector('[data-job-paper="live"] [data-job-paper-from]')?.textContent).toBe('A form from the Contract Book'))
  })

  it('a mark that fails leaves the form required and names it, and a refused tick says why', async () => {
    const readRoster = vi.fn<JobPapersIo['readRoster']>().mockResolvedValueOnce(empty).mockResolvedValue(saved)
    const setGcOwn = vi.fn(async () => Promise.reject(new Error('Training mode is read-only. Nothing was changed.')))
    const io = fakeIo({ readRoster, requirePapers: vi.fn(async () => 1), setGcOwn })
    renderWithProviders(<JobDocumentsRequiredPapers job={{ id: 'job-1' }} io={io} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Add a paper' }))
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Ridgeway Builders NDA: This is the GC’s own form' }))
    fireEvent.click(screen.getByRole('button', { name: 'Require 1 paper' }))
    await screen.findByText('Required, but not marked as the GC’s own form. Tick it on the paper’s row.')
    expect(screen.getByText('Ridgeway Builders NDA: Training mode is read-only. Nothing was changed.')).toBeTruthy()
    // The form is on the job all the same, with its tick still off.
    const tick = (await screen.findByRole('checkbox', { name: 'Ridgeway Builders NDA: This is the GC’s own form' })) as HTMLInputElement
    expect(tick.checked).toBe(false)
    fireEvent.click(tick)
    await waitFor(() => expect(screen.getAllByRole('alert').some((a) => a.textContent === 'Training mode is read-only. Nothing was changed.')).toBe(true))
  })

  it('a read of the marks that fails draws no tick on a required row, never a wrong one', async () => {
    const io = fakeIo({ readRoster: vi.fn(async () => saved), readGcOwn: vi.fn(async () => Promise.reject(new Error('column gc_own does not exist'))) })
    renderWithProviders(<JobDocumentsRequiredPapers job={{ id: 'job-1' }} io={io} />)
    await screen.findByTestId('job-papers-summary')
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(screen.getByText('A form from the Contract Book')).toBeTruthy()
  })
})
