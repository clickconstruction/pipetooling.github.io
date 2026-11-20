// @vitest-environment jsdom
/**
 * Render smokes for a paper built from settings on Settings → Contracts and clauses (punch list #389, step 1): the
 * strip that says it is built from settings, whether an attorney read its revision and what gap would stop it; a
 * clause's Only when; the wordings of one place under one number; the read mark; the Settings list window; and the
 * preview put together for a mix of picks. The reads and the RPCs are mocked at the loader. Every word is a made-up
 * placeholder.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'

const auth = vi.hoisted(() => ({ role: 'controller', profileName: 'Maria' }))

vi.mock('../../lib/supabase', async () => ({ supabase: (await import('../../test/renderSmokeMocks')).makeSupabaseStub() }))
vi.mock('../../hooks/useAuth', async () => {
  const m = await import('../../test/renderSmokeMocks')
  return { ...m.useAuthModuleMock(), useAuth: () => m.makeUseAuthValue({ role: auth.role, profileName: auth.profileName }) }
})
vi.mock('../../lib/contracts/clausesIo', () => ({
  loadClauseLibrary: vi.fn(),
  saveClauseChange: vi.fn(),
  approveClauseProposal: vi.fn(),
  declineClauseProposal: vi.fn(),
  loadClauseNeeds: vi.fn(),
  tellClauseApprovers: vi.fn(),
  tellClauseEditor: vi.fn(),
  markPaperRead: vi.fn(),
  savePaperSettings: vi.fn(),
}))

import { loadClauseLibrary, markPaperRead, saveClauseChange, savePaperSettings } from '../../lib/contracts/clausesIo'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { clauseLibraryDemo } from '../../test/fixtures/clauseBookDemo'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { SettingsClausesTab } from './SettingsClausesTab'

const PAPER = 'doc-secrecy'
const LIST = {
  settings: [
    { key: 'photos', label: 'Photos and video', choices: [
      { key: 'off', label: 'Off', says: 'Nothing is asked.', out: true },
      { key: 'standard', label: 'Standard', says: 'A placeholder line.' },
      { key: 'strict', label: 'Strict', says: 'A placeholder line.' },
    ] },
    { key: 'term', label: 'How long secrecy lasts', choices: [
      { key: 'short', label: 'Short', says: 'A placeholder line.', fills: { term_words: 'one year' } },
      { key: 'long', label: 'Long', says: 'A placeholder line.', fills: { term_words: 'three years' } },
    ] },
  ],
  fields: [{ key: 'term_words', label: 'How long' }],
  levels: [{ key: 'standard', label: 'Standard', alignedWith: 'Aligned with regular businesses', picks: { photos: 'standard', term: 'short' } }],
}

/** The demo library with one more paper, built from settings: a fixed clause, two wordings of one place, a blank. */
function library(over: { withoutStrict?: boolean; read?: boolean } = {}) {
  const lib = clauseLibraryDemo()
  const row = (id: string, order: number, en: string, slot: string | null, when: Record<string, string> | null) => ({
    id, paper_id: PAPER, sequence_order: order, text_en: en, text_es: '', scope: ['all'], version: 1, published_by_name: 'Maria', published_at: '2026-11-19T15:00:00Z', retired_at: null, retired_by_name: null, slot, when_opts: when,
  })
  return {
    ...lib,
    papers: [
      ...lib.papers,
      { id: PAPER, document_name: 'Job Secrecy Agreement (test)', template_id: 'tpl-subs', form_template_id: null, sequence_order: 9, revision: 4, published_at: '2026-11-19T15:00:00Z', settings_def: LIST, read_revision: over.read ? 4 : null, read_by_name: over.read ? 'Avery Stone' : null, read_on: over.read ? '2026-11-19' : null },
    ],
    clauses: [
      ...lib.clauses,
      row('s1', 1, 'Fixed placeholder one.', null, null),
      row('s2', 2, 'Photo placeholder A.', 'photos', { photos: 'standard' }),
      row('s3', 3, 'Secrecy lasts {term_words}.', null, null),
      ...(over.withoutStrict ? [] : [row('s4', 4, 'Photo placeholder B.', 'photos', { photos: 'strict' })]),
    ],
  }
}

async function open(lib = library()) {
  vi.mocked(loadClauseLibrary).mockResolvedValue(lib as never)
  renderWithProviders(<SettingsClausesTab />)
  await waitFor(() => expect(screen.getByText('Job Secrecy Agreement (test)')).toBeTruthy())
}
const card = (paperId = PAPER) => document.querySelector(`[data-clause-paper-card="${paperId}"]`) as HTMLElement
const rowOf = (clauseId: string) => document.querySelector(`[data-clause-row="${clauseId}"]`) as HTMLElement

beforeEach(() => {
  auth.role = 'controller'
  auth.profileName = 'Maria'
  vi.mocked(loadClauseLibrary).mockReset()
  vi.mocked(saveClauseChange).mockReset().mockResolvedValue({ state: 'published', proposal_id: 'p1', revision: 5 })
  vi.mocked(markPaperRead).mockReset().mockResolvedValue({ revision: 4 })
  vi.mocked(savePaperSettings).mockReset().mockResolvedValue({ revision: 3 })
})

describe('a paper built from settings, on Contracts and clauses', () => {
  it('says it is built from settings, that no attorney read its revision, and that every choice has its wording', async () => {
    await open()
    const strip = card().querySelector('[data-paper-settings-strip]') as HTMLElement
    expect(within(strip).getByText('Built from settings')).toBeTruthy()
    expect(strip.querySelector('[data-paper-read]')?.textContent).toBe('Revision 4, not read by an attorney')
    expect(within(strip).getByText('Every choice has its wording.')).toBeTruthy()
    expect(within(card()).getByRole('button', { name: 'Settings list' })).toBeTruthy()
    expect(within(card()).getByRole('button', { name: 'Preview with settings' })).toBeTruthy()
    expect(card('doc-msa').querySelector('[data-paper-settings-strip]')).toBeNull()
  })

  it('ties each clause to what puts it in the paper, and numbers the wordings of one place together', async () => {
    await open()
    expect(rowOf('s1').querySelector('[data-clause-when]')?.textContent).toBe('In every paper')
    expect(rowOf('s2').querySelector('[data-clause-when]')?.textContent).toBe('Only when Photos and video is Standard')
    expect(rowOf('s4').querySelector('[data-clause-when]')?.textContent).toBe('Only when Photos and video is Strict')
    const numbers = ['s1', 's2', 's4', 's3'].map((id) => rowOf(id).querySelector('span')?.textContent)
    expect(numbers).toEqual(['1', '2A', '2B', '3'])
    expect(rowOf('msa-1').querySelector('[data-clause-when]')).toBeNull()
  })

  it('names a gap in words when a choice has no wording', async () => {
    await open(library({ withoutStrict: true }))
    const gaps = card().querySelector('[data-paper-gaps]') as HTMLElement
    expect(gaps.textContent).toBe('Photos and video has no wording for Strict.')
  })

  it('gives the office the strip and neither press that is a controller’s', async () => {
    auth.role = 'assistant'
    auth.profileName = 'Rosa'
    await open()
    expect(within(card()).getByText('Built from settings')).toBeTruthy()
    expect(within(card()).queryByRole('button', { name: 'Settings list' })).toBeNull()
    expect(within(card()).queryByRole('button', { name: /Mark revision 4/ })).toBeNull()
  })

  it('marks the revision as read by an attorney, by name and day', async () => {
    await open()
    fireEvent.click(within(card()).getByRole('button', { name: 'Mark revision 4 as read by an attorney' }))
    const press = within(card()).getByRole('button', { name: 'Mark revision 4 as read' }) as HTMLButtonElement
    expect(press.disabled).toBe(true)
    fireEvent.change(within(card()).getByLabelText('The attorney who read it'), { target: { value: ' Avery Stone ' } })
    fireEvent.click(press)
    await waitFor(() => expect(markPaperRead).toHaveBeenCalledWith(PAPER, 'Avery Stone', todayYmdInAppTz()))
    await waitFor(() => expect(loadClauseLibrary).toHaveBeenCalledTimes(2))
  })

  it('says who read the revision once it is marked, with no press to mark it again', async () => {
    await open(library({ read: true }))
    expect(card().querySelector('[data-paper-read]')?.textContent).toBe('Revision 4, read by Avery Stone, Nov 19')
    expect(within(card()).queryByRole('button', { name: /Mark revision 4/ })).toBeNull()
  })

  it('ties a new clause to a choice as another wording of a place', async () => {
    await open()
    fireEvent.click(within(card()).getByRole('button', { name: '+ a clause' }))
    const win = screen.getByRole('dialog')
    fireEvent.change(within(win).getAllByRole('textbox')[0] as HTMLElement, { target: { value: 'Photo placeholder C.' } })
    expect(within(win).queryByLabelText('Choice')).toBeNull()
    fireEvent.change(within(win).getByLabelText('Setting'), { target: { value: 'photos' } })
    fireEvent.click(within(win).getByRole('button', { name: 'Publish' }))
    expect((await within(win).findByRole('alert')).textContent).toBe('Pick the choice of Photos and video that puts this clause in the paper.')
    fireEvent.change(within(win).getByLabelText('Choice'), { target: { value: 'off' } })
    const place = within(win).getByLabelText('For the other choices') as HTMLSelectElement
    expect([...place.options].map((o) => o.textContent)).toEqual(['No other wording. It is left out for every other choice.', 'Another wording of clause 2', 'The first wording of a new place'])
    fireEvent.change(place, { target: { value: 'photos' } })
    fireEvent.click(within(win).getByRole('button', { name: 'Publish' }))
    await waitFor(() => expect(saveClauseChange).toHaveBeenCalledTimes(1))
    expect(vi.mocked(saveClauseChange).mock.calls[0]?.[0]).toBe(PAPER)
    expect(vi.mocked(saveClauseChange).mock.calls[0]?.[1]).toMatchObject({ kind: 'new', en: 'Photo placeholder C.', when: { photos: 'off' }, slot: 'photos' })
  })

  it('leaves a clause in every paper, and makes a new place by the setting’s own key', async () => {
    await open()
    fireEvent.click(within(rowOf('s3')).getByRole('button', { name: 'Edit' }))
    const win = screen.getByRole('dialog')
    expect((within(win).getByLabelText('Setting') as HTMLSelectElement).value).toBe('')
    fireEvent.change(within(win).getByLabelText('Setting'), { target: { value: 'term' } })
    fireEvent.change(within(win).getByLabelText('Choice'), { target: { value: 'long' } })
    fireEvent.change(within(win).getByLabelText('For the other choices'), { target: { value: 'a new place' } })
    fireEvent.click(within(win).getByRole('button', { name: 'Publish' }))
    await waitFor(() => expect(saveClauseChange).toHaveBeenCalledTimes(1))
    expect(vi.mocked(saveClauseChange).mock.calls[0]?.[1]).toMatchObject({ kind: 'edit', clauseId: 's3', when: { term: 'long' }, slot: 'term' })
  })

  it('previews the paper for a mix of picks, swapping the wording and filling the blank', async () => {
    await open()
    fireEvent.click(within(card()).getByRole('button', { name: 'Preview with settings' }))
    const win = screen.getByRole('dialog')
    const paper = () => [...win.querySelectorAll('[data-clause-base] li')].map((li) => li.textContent)
    expect(paper()).toEqual(['Fixed placeholder one.', 'Photo placeholder A.', 'Secrecy lasts one year.'])
    expect(within(win).getByRole('button', { name: 'Standard' }).getAttribute('aria-pressed')).toBe('true')
    expect(within(win).getByText('Aligned with regular businesses')).toBeTruthy()
    fireEvent.change(within(win).getByLabelText('Photos and video'), { target: { value: 'strict' } })
    fireEvent.change(within(win).getByLabelText('How long secrecy lasts'), { target: { value: 'long' } })
    expect(paper()).toEqual(['Fixed placeholder one.', 'Photo placeholder B.', 'Secrecy lasts three years.'])
    expect(within(win).getByText('A mix of its own')).toBeTruthy()
    fireEvent.change(within(win).getByLabelText('Photos and video'), { target: { value: 'off' } })
    expect(paper()).toEqual(['Fixed placeholder one.', 'Secrecy lasts three years.'])
    expect(within(win).queryByRole('status')).toBeNull()
  })

  it('says in the preview what stops the paper for a pick with no wording', async () => {
    await open(library({ withoutStrict: true }))
    fireEvent.click(within(card()).getByRole('button', { name: 'Preview with settings' }))
    const win = screen.getByRole('dialog')
    fireEvent.change(within(win).getByLabelText('Photos and video'), { target: { value: 'strict' } })
    expect(within(win).getByRole('status').textContent).toBe('Photos and video has no wording for Strict.')
  })

  it('gives an ordinary paper its first settings list, the keys made from the names', async () => {
    await open()
    fireEvent.click(within(card('doc-msa')).getByRole('button', { name: 'Settings list' }))
    const win = screen.getByRole('dialog')
    expect(within(win).getByText(/None yet\. Name the first setting below/)).toBeTruthy()
    const save = () => within(win).getByRole('button', { name: 'Save the settings list' }) as HTMLButtonElement
    expect(save().disabled).toBe(true)
    fireEvent.change(within(win).getByLabelText('A new setting'), { target: { value: 'Badges on site' } })
    fireEvent.click(within(win).getByRole('button', { name: 'Add a setting' }))
    for (const name of ['Off', 'On']) {
      fireEvent.change(within(win).getByLabelText('A new choice of Badges on site'), { target: { value: name } })
      fireEvent.click(within(win).getByRole('button', { name: 'Add a choice' }))
    }
    expect(within(win).getByText('Badges on site, Off, does not say what it means.')).toBeTruthy()
    expect(save().disabled).toBe(true)
    fireEvent.change(within(win).getByLabelText('What the summary says for Off of Badges on site'), { target: { value: 'No badge is asked for.' } })
    fireEvent.change(within(win).getByLabelText('What the summary says for On of Badges on site'), { target: { value: 'A placeholder line.' } })
    fireEvent.click(within(win).getAllByRole('checkbox', { name: 'This choice leaves the topic out of the paper' })[0] as HTMLElement)
    expect(win.querySelector('[data-paper-settings-problems]')).toBeNull()
    fireEvent.click(save())
    await waitFor(() => expect(savePaperSettings).toHaveBeenCalledTimes(1))
    const [paperId, def] = vi.mocked(savePaperSettings).mock.calls[0] ?? []
    expect(paperId).toBe('doc-msa')
    expect(def?.settings.map((s) => [s.key, s.label, s.choices.map((c) => [c.key, c.out])])).toEqual([['badges_on_site', 'Badges on site', [['off', true], ['on', false]]]])
  })

  it('opens a paper’s own list, and takes it away only after a confirm', async () => {
    await open()
    fireEvent.click(within(card()).getByRole('button', { name: 'Settings list' }))
    const win = screen.getByRole('dialog')
    expect((within(win).getByLabelText('Name of setting photos') as HTMLInputElement).value).toBe('Photos and video')
    expect(within(win).getByText('{term_words}')).toBeTruthy()
    fireEvent.click(within(win).getByRole('button', { name: 'Take the settings list away' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Take the list away' }))
    await waitFor(() => expect(savePaperSettings).toHaveBeenCalledWith(PAPER, null))
  })
})
