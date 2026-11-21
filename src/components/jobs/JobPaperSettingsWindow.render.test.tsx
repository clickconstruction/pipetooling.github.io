// @vitest-environment jsdom
/**
 * The office's settings page on a job (punch list #389, step 4), over a fake io. The first time the paper is walked:
 * the notice's box, the basis, a topic moved, the blank typed on the review, and the review's press requires the paper
 * with its picks, its basis and the tick. A required paper opens on one page: the press says what it will do, saves in
 * place while nobody has signed, and names who signs again once someone has. A list with no levels is set on the one
 * page. A job that is not a ZZ Test job is told why it cannot take an unread paper. Every word is a placeholder.
 */
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseSettingsDef, type SettingsDef } from '../../lib/contracts/paperSettings'
import type { BookSettingsPaper, JobPaperSettingsIo, JobSettingsPaper } from '../../lib/jobs/jobPaperSettingsIo'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { JobPaperSettingsWindow } from './JobPaperSettingsWindow'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

const RAW = {
  settings: [
    { key: 'photos', label: 'Photos and video', choices: [
      { key: 'off', label: 'Off', says: 'No photo rule.', out: true },
      { key: 'ask', label: 'Ask first', says: 'Ask before a photo.', breach: ['A photo with no leave.'], site: ['A sign at the gate.'] },
      { key: 'none', label: 'None', says: 'No photos at all.', breach: ['A photo with no leave.', 'A camera on site.'], site: ['A sign at the gate.', 'A locker for phones.'] },
    ] },
    { key: 'term', label: 'How long secrecy lasts', choices: [
      { key: 'short', label: 'Short', says: 'One year.', fills: { term_words: 'one year' } },
      { key: 'long', label: 'Long', says: 'Three years.', fills: { term_words: 'three years' } },
    ] },
  ],
  fields: [{ key: 'term_words', label: 'Secrecy lasts' }, { key: 'party', label: 'The protected party' }],
  levels: [
    { key: 'standard', label: 'Standard', alignedWith: 'Aligned with a placeholder place', picks: { photos: 'ask', term: 'short' } },
    { key: 'strict', label: 'Strict', alignedWith: 'Aligned with another placeholder place', picks: { photos: 'none', term: 'long' } },
  ],
  notice: { title: 'Read this first', tick: 'I have read it.', lines: ['Notice one.', 'Notice two.'] },
}
const DEF = parseSettingsDef(RAW) as SettingsDef
const book = (def: SettingsDef = DEF, over: Partial<BookSettingsPaper> = {}): BookSettingsPaper => ({ id: 'book-1', name: 'Sample secrecy paper', def, revision: 4, readRevision: null, ...over })
const required = (over: Partial<JobSettingsPaper> = {}): JobSettingsPaper => ({ requiredPaperId: 'row-1', bookDocumentId: 'book-1', picks: { photos: 'ask', term: 'short' }, typed: { party: 'Ridgeway Sample Holdings' }, basis: 'standard', settingsRevision: 1, bookRevision: 4, signed: 0, ...over })

function fakeIo(over: Partial<JobPaperSettingsIo> = {}): JobPaperSettingsIo {
  return {
    readJob: vi.fn(async () => ({ number: 'J900', job_name: 'ZZ Test settings job', customer_name: null })),
    readBookPaper: vi.fn(async () => book()),
    readSettingsPapers: vi.fn(async () => []),
    requireWithSettings: vi.fn(async () => undefined),
    setSettings: vi.fn(async (id: string) => ({ state: 'saved' as const, requiredPaperId: id, signAgain: 0 })),
    setBasis: vi.fn(async () => undefined),
    ...over,
  }
}
const press = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))
const pressNext = () => fireEvent.click(screen.getByRole('button', { name: /^Next/ }))

afterEach(() => cleanup())

describe('JobPaperSettingsWindow, the first time', () => {
  it('walks the flow and requires the paper with its picks, its basis and the tick', async () => {
    const io = fakeIo()
    const onDone = vi.fn()
    renderWithProviders(<JobPaperSettingsWindow job={{ id: 'job-1' }} target={{ kind: 'first', bookDocumentId: 'book-1', paperName: 'Sample secrecy paper' }} io={io} onClose={() => {}} onDone={onDone} />)
    await screen.findByText('Notice one.')
    expect(screen.getByRole('dialog', { name: 'Sample secrecy paper, job J900' })).toBeTruthy()
    // The box holds the walk.
    expect((screen.getByRole('button', { name: /^Next/ }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('checkbox'))
    pressNext() // the basis
    pressNext() // the site
    pressNext() // photos
    expect(screen.getByText('A photo with no leave.')).toBeTruthy()
    pressNext() // the term
    pressNext() // the review
    // The blank no choice fills is typed here, and holds the press until it is.
    const require = () => screen.getByRole('button', { name: 'Require this paper' }) as HTMLButtonElement
    expect(require().disabled).toBe(true)
    expect(screen.getByText('Type The protected party first.')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('The protected party'), { target: { value: ' Ridgeway Sample Holdings ' } })
    expect(require().disabled).toBe(false)
    fireEvent.click(require())
    await waitFor(() => expect(io.requireWithSettings).toHaveBeenCalledTimes(1))
    expect(io.requireWithSettings).toHaveBeenCalledWith('job-1', 'book-1', { picks: { photos: 'ask', term: 'short' }, typed: { party: 'Ridgeway Sample Holdings' }, basis: 'standard', noticeRead: true })
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1))
  })

  it('a list with no notice opens on the basis, and sends no tick', async () => {
    const io = fakeIo({ readBookPaper: vi.fn(async () => book({ ...DEF, notice: undefined, fields: [DEF.fields[0]!] })) })
    renderWithProviders(<JobPaperSettingsWindow job={{ id: 'job-1' }} target={{ kind: 'first', bookDocumentId: 'book-1', paperName: 'Sample secrecy paper' }} io={io} onClose={() => {}} onDone={() => {}} />)
    await screen.findByText("Pick the level this job's paper should express.")
    for (let i = 0; i < 4; i++) pressNext()
    press('Require this paper')
    await waitFor(() => expect(io.requireWithSettings).toHaveBeenCalledWith('job-1', 'book-1', { picks: { photos: 'ask', term: 'short' }, typed: null, basis: 'standard', noticeRead: false }))
  })

  it('says the database’s refusal and keeps the walk', async () => {
    const io = fakeIo({
      readBookPaper: vi.fn(async () => book({ ...DEF, notice: undefined, fields: [DEF.fields[0]!] })),
      requireWithSettings: vi.fn(async () => {
        throw new Error('This job requires Sample secrecy paper already, with other settings. Change them on that paper.')
      }),
    })
    renderWithProviders(<JobPaperSettingsWindow job={{ id: 'job-1' }} target={{ kind: 'first', bookDocumentId: 'book-1', paperName: 'Sample secrecy paper' }} io={io} onClose={() => {}} onDone={() => {}} />)
    await screen.findByText("Pick the level this job's paper should express.")
    for (let i = 0; i < 4; i++) pressNext()
    press('Require this paper')
    expect((await screen.findByRole('alert')).textContent).toContain('with other settings')
    expect((screen.getByRole('button', { name: 'Require this paper' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('tells a job that is not a ZZ Test job why it cannot take an unread paper, and holds the press', async () => {
    const io = fakeIo({ readJob: vi.fn(async () => ({ number: 'J901', job_name: 'Cedar Bluff Lofts', customer_name: 'Ridgeway Builders' })), readBookPaper: vi.fn(async () => book({ ...DEF, notice: undefined, fields: [DEF.fields[0]!] })) })
    renderWithProviders(<JobPaperSettingsWindow job={{ id: 'job-1' }} target={{ kind: 'first', bookDocumentId: 'book-1', paperName: 'Sample secrecy paper' }} io={io} onClose={() => {}} onDone={() => {}} />)
    expect((await screen.findByRole('alert')).textContent).toBe('Sample secrecy paper has not been read by an attorney as it reads today. Until it is, only a ZZ Test job takes it.')
    for (let i = 0; i < 4; i++) pressNext()
    expect((screen.getByRole('button', { name: 'Require this paper' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('a list with no levels is set on one page, with the notice’s box', async () => {
    const io = fakeIo({ readBookPaper: vi.fn(async () => book({ ...DEF, levels: [], fields: [DEF.fields[0]!] })) })
    renderWithProviders(<JobPaperSettingsWindow job={{ id: 'job-1' }} target={{ kind: 'first', bookDocumentId: 'book-1', paperName: 'Sample secrecy paper' }} io={io} onClose={() => {}} onDone={() => {}} />)
    await screen.findByText('This paper has no levels yet, so it is set on one page.')
    const require = () => screen.getByRole('button', { name: 'Require this paper' }) as HTMLButtonElement
    expect(require().disabled).toBe(true)
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.change(screen.getByLabelText('Photos and video'), { target: { value: 'none' } })
    fireEvent.click(require())
    await waitFor(() => expect(io.requireWithSettings).toHaveBeenCalledWith('job-1', 'book-1', { picks: { photos: 'none', term: 'short' }, typed: null, basis: null, noticeRead: true }))
  })
})

describe('JobPaperSettingsWindow, a required paper', () => {
  const open = (paper: JobSettingsPaper, io: JobPaperSettingsIo) =>
    renderWithProviders(<JobPaperSettingsWindow job={{ id: 'job-1' }} target={{ kind: 'change', paper, paperName: 'Sample secrecy paper' }} io={io} onClose={() => {}} onDone={() => {}} />)

  it('opens on one page with no box, and holds the press while nothing is changed', async () => {
    open(required(), fakeIo())
    await screen.findByText('Nothing is changed yet.')
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect((screen.getByLabelText('The basis') as HTMLSelectElement).value).toBe('standard')
    expect((screen.getByLabelText('The protected party') as HTMLInputElement).value).toBe('Ridgeway Sample Holdings')
    expect((screen.getByRole('button', { name: 'Save the settings' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('before any signature a new blank is saved in place', async () => {
    const io = fakeIo()
    open(required(), io)
    fireEvent.change(await screen.findByLabelText('The protected party'), { target: { value: 'Ridgeway Sample Group' } })
    expect(screen.getByText('Nobody has signed yet, so nobody signs again.')).toBeTruthy()
    press('Save the settings')
    await waitFor(() => expect(io.setSettings).toHaveBeenCalledWith('row-1', { photos: 'ask', term: 'short' }, { party: 'Ridgeway Sample Group' }))
    expect(io.setBasis).not.toHaveBeenCalled()
  })

  it('after a signature the press names who signs again', async () => {
    const io = fakeIo({ setSettings: vi.fn(async () => ({ state: 'revised' as const, requiredPaperId: 'row-2', signAgain: 3 })) })
    open(required({ signed: 3 }), io)
    fireEvent.change(await screen.findByLabelText('The protected party'), { target: { value: 'Ridgeway Sample Group' } })
    expect(screen.getByText('3 people have signed this paper. Each signs the new version again, and the job stays closed to each until then.')).toBeTruthy()
    press('Save, and ask 3 people to sign again')
    await waitFor(() => expect(io.setSettings).toHaveBeenCalledTimes(1))
  })

  it('moving the basis alone asks nobody to sign again, and moves it on the row', async () => {
    const io = fakeIo()
    open(required({ signed: 2 }), io)
    fireEvent.change(await screen.findByLabelText('The basis'), { target: { value: 'strict' } })
    expect(screen.getByText('The basis marks this page. Nobody signs again.')).toBeTruthy()
    press('Save the basis')
    await waitFor(() => expect(io.setBasis).toHaveBeenCalledWith('row-1', 'strict'))
    expect(io.setSettings).not.toHaveBeenCalled()
  })

  it('a paper gone from the Book says so', async () => {
    open(required(), fakeIo({ readBookPaper: vi.fn(async () => null) }))
    expect(await screen.findByText('This paper is no longer built from settings in the Contract Book. Take it off the job.')).toBeTruthy()
  })
})
