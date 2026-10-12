// @vitest-environment jsdom
/**
 * Render smokes for Settings → Contracts and clauses (Messages, cut 4c): the papers built from clauses, with their
 * clauses for everyone and their trade exhibits on the one numbering; Rosa's change waiting under its clause, which she
 * sees as waiting on Maria or Robert and Maria approves; Edit, Retire, History and Preview per trade; and Build a paper
 * from clauses. The reads and the RPCs are mocked at the loader.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'

const auth = vi.hoisted(() => ({ role: 'assistant', profileName: 'Rosa' }))

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
}))

import { approveClauseProposal, declineClauseProposal, loadClauseLibrary, saveClauseChange } from '../../lib/contracts/clausesIo'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { clauseLibraryDemo } from '../../test/fixtures/clauseBookDemo'
import { SettingsClausesTab } from './SettingsClausesTab'

async function open() {
  renderWithProviders(<SettingsClausesTab />)
  await waitFor(() => expect(screen.getByText('Master services agreement')).toBeTruthy())
}
const card = (paperId: string) => document.querySelector(`[data-clause-paper-card="${paperId}"]`) as HTMLElement

beforeEach(() => {
  vi.mocked(loadClauseLibrary).mockReset().mockResolvedValue(clauseLibraryDemo())
  vi.mocked(saveClauseChange).mockReset()
  vi.mocked(approveClauseProposal).mockReset()
  vi.mocked(declineClauseProposal).mockReset()
})

describe('SettingsClausesTab', () => {
  it('lays each paper out with its version, its clauses for everyone and one exhibit per trade, numbered as each paper is', async () => {
    auth.role = 'assistant'
    auth.profileName = 'Rosa'
    await open()
    const msa = card('doc-msa')
    expect(within(msa).getByText(/Version 2 · 8 clauses/)).toBeTruthy()
    expect(within(msa).getByText('1 waiting on approval')).toBeTruthy()
    expect([...msa.querySelectorAll('[data-clause-exhibit]')].map((x) => x.getAttribute('data-clause-exhibit'))).toEqual(['Electrical', 'Sitework', 'Structural steel'])
    const sitework = msa.querySelector('[data-clause-exhibit="Sitework"]') as HTMLElement
    expect(within(sitework).getByText('6')).toBeTruthy()
    expect(card('doc-sow')).toBeTruthy()
    expect(screen.getByText('Signed in as Rosa. A controller or a dev approves your changes before they go out.')).toBeTruthy()
  })

  it('shows Rosa her change waiting on Maria or Robert, with no Approve', async () => {
    auth.role = 'assistant'
    auth.profileName = 'Rosa'
    await open()
    const waiting = document.querySelector('[data-clause-proposal="p-waiting"]') as HTMLElement
    expect(within(waiting).getByText('Rosa proposed a change')).toBeTruthy()
    expect(within(waiting).getByText('waiting on Maria or Robert')).toBeTruthy()
    expect(within(waiting).queryByText(/Approve/)).toBeNull()
  })

  it('lets Maria approve it as version 2, and reads the clauses again', async () => {
    auth.role = 'controller'
    auth.profileName = 'Maria'
    vi.mocked(approveClauseProposal).mockResolvedValue({ state: 'published', proposal_id: 'p-waiting', clause_id: 'msa-2', version: 2, revision: 3 })
    await open()
    expect(screen.getByText('Signed in as Maria, who may approve. Your changes go out at once.')).toBeTruthy()
    const waiting = document.querySelector('[data-clause-proposal="p-waiting"]') as HTMLElement
    fireEvent.click(within(waiting).getByText('Approve · v2'))
    await waitFor(() => expect(approveClauseProposal).toHaveBeenCalledWith('p-waiting'))
    await waitFor(() => expect(screen.getByText('Approved by Maria. The next paper sent carries it.')).toBeTruthy())
    expect(loadClauseLibrary).toHaveBeenCalledTimes(2)
  })

  it('lets Maria decline it only with a why', async () => {
    auth.role = 'controller'
    auth.profileName = 'Maria'
    vi.mocked(declineClauseProposal).mockResolvedValue({ state: 'declined', proposal_id: 'p-waiting' })
    await open()
    fireEvent.click(within(document.querySelector('[data-clause-proposal="p-waiting"]') as HTMLElement).getByText('Decline'))
    const dialog = await screen.findByRole('dialog', { name: 'Decline the change' })
    fireEvent.click(within(dialog).getByText('Decline'))
    expect(within(dialog).getByRole('alert').textContent).toBe('Say why, for Rosa.')
    expect(declineClauseProposal).not.toHaveBeenCalled()
    fireEvent.change(within(dialog).getByLabelText('Why, for Rosa'), { target: { value: 'Keep the old wording.' } })
    fireEvent.click(within(dialog).getByText('Decline'))
    await waitFor(() => expect(declineClauseProposal).toHaveBeenCalledWith('p-waiting', 'Keep the old wording.'))
    await waitFor(() => expect(screen.getByText("Declined. Rosa sees your why on the clause's history.")).toBeTruthy())
  })

  it('sends Rosa’s edit for approval, with the trades she picked, after the kernel’s check', async () => {
    auth.role = 'assistant'
    auth.profileName = 'Rosa'
    vi.mocked(saveClauseChange).mockResolvedValue({ state: 'proposed', proposal_id: 'p-new' })
    await open()
    const row = document.querySelector('[data-clause-row="msa-7"]') as HTMLElement
    fireEvent.click(within(row).getByText('Edit'))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByText('Send for approval'))
    expect(within(dialog).getByRole('alert').textContent).toBe('Nothing changed.')
    fireEvent.click(within(dialog).getByText('Electrical, low voltage'))
    fireEvent.change(within(dialog).getByLabelText('Why'), { target: { value: 'Tejas Power does low voltage.' } })
    fireEvent.click(within(dialog).getByText('Send for approval'))
    await waitFor(() =>
      expect(saveClauseChange).toHaveBeenCalledWith('doc-msa', expect.objectContaining({ kind: 'edit', clauseId: 'msa-7', scope: ['Electrical', 'Electrical, low voltage'] }), 'Tejas Power does low voltage.'),
    )
    await waitFor(() => expect(screen.getByText('It waits for Maria or Robert to approve it. Until then it is on their Needs you.')).toBeTruthy())
  })

  it('refuses an empty new clause in the kernel’s words, before any write', async () => {
    auth.role = 'assistant'
    await open()
    fireEvent.click(within(card('doc-msa')).getByText('+ a clause'))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByText('Send for approval'))
    expect(within(dialog).getByRole('alert').textContent).toBe('Write the clause.')
    expect(saveClauseChange).not.toHaveBeenCalled()
  })

  it('shows a clause’s history, the newest first', async () => {
    await open()
    const row = document.querySelector('[data-clause-row="msa-3"]') as HTMLElement
    fireEvent.click(within(row).getByText('History'))
    const history = row.querySelector('[data-clause-history="msa-3"]') as HTMLElement
    expect([...history.querySelectorAll('strong')].map((s) => s.textContent)).toEqual(['Version 2, proposed by Rosa and approved by Maria.', 'A change, proposed by Rosa and declined by Maria.'])
  })

  it('previews the paper as it would go to a company, with its trade’s exhibit and version line', async () => {
    await open()
    fireEvent.click(within(card('doc-msa')).getByText('Preview per trade'))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Between Click Construction and Hillside Excavation.')).toBeTruthy()
    expect(within(dialog).getByText('Exhibit for Sitework')).toBeTruthy()
    expect(within(dialog).getByText('Version 2, with the Sitework exhibit.')).toBeTruthy()
    fireEvent.change(within(dialog).getByLabelText('As it would go to'), { target: { value: 'co-tejas' } })
    expect(within(dialog).queryByText(/Exhibit for/)).toBeNull()
    expect(within(dialog).getByText('Version 2.')).toBeTruthy()
  })

  it('builds a paper from a library document that is not a form', async () => {
    auth.role = 'controller'
    auth.profileName = 'Maria'
    vi.mocked(saveClauseChange).mockResolvedValue({ state: 'published', proposal_id: 'p-first', clause_id: 'c-first', version: 1, revision: 1 })
    await open()
    const build = document.querySelector('[data-clause-build]') as HTMLElement
    const pick = within(build).getByLabelText('A document from the library') as HTMLSelectElement
    expect([...pick.options].map((o) => o.textContent)).toEqual(['Pick a document', 'Subs · Safety acknowledgment'])
    fireEvent.change(pick, { target: { value: 'doc-safety' } })
    fireEvent.click(within(build).getByText('Write its first clause'))
    const dialog = await screen.findByRole('dialog', { name: 'A new clause on Safety acknowledgment' })
    fireEvent.change(within(dialog).getByLabelText('English'), { target: { value: 'Safety: a toolbox talk each week.' } })
    fireEvent.click(within(dialog).getByText('Publish'))
    await waitFor(() => expect(saveClauseChange).toHaveBeenCalledWith('doc-safety', { kind: 'new', en: 'Safety: a toolbox talk each week.', es: '', scope: 'all' }, ''))
    await waitFor(() => expect(screen.getByText('Published as version 1. The next safety acknowledgment sent carries it. Signed copies keep their words.')).toBeTruthy())
  })

  it('says so when no paper is built from clauses yet', async () => {
    vi.mocked(loadClauseLibrary).mockResolvedValue({ ...clauseLibraryDemo(), clauses: [], proposals: [] })
    renderWithProviders(<SettingsClausesTab />)
    await waitFor(() => expect(screen.getByText('No paper is built from clauses yet. Pick one from the library below to start.')).toBeTruthy())
  })
})
