// @vitest-environment jsdom
/**
 * Corrections as links on the Timeline (punch list #315, upgrade 1): the older entry wears *Corrected <day> ›* and
 * opens the entry that corrects it; the newer entry says what it corrects and its link can be withdrawn with a reason;
 * a line's *Correct this entry…* opens the composer with the link picked, and Add entry writes it; the narrative's
 * Jump to flags a section cited by an entry corrected since. Made-up people and words.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../../test/renderSmokeMocks'
import { PersonFilePanel } from './PersonFilePanel'
import { addAmendments, withdrawAmendment } from '../../../lib/people/personAmendmentsIo'

const NARRATIVE = '## 1. Background\n\nJoined in March.\n\n## 2. The spring\n\nTwo trips.\n\n## 3. After\n\nQuiet.'
const TABLE_ROWS: Record<string, unknown[]> = {
  people: [{ id: 'p-marcus', name: 'Marcus Reed', kind: 'helper', archived_at: null, start_date: '2025-03-11', end_date: null, account_user_id: 'u-marcus' }],
  person_files: [{ kind: 'narrative', content: NARRATIVE, updated_at: '2026-11-06T22:00:00+00:00', covered_through: null, author_label: 'Robert' }],
  person_file_entries: [
    { id: 'e1', person_id: 'p-marcus', entry_date: '2026-03-30', content: 'The truck came back at 4:10. N§2', source: 'incident', created_by: 'u-dev', created_at: '2026-03-30T12:00:00.000Z', author_label: null },
    { id: 'e2', person_id: 'p-marcus', entry_date: '2026-04-15', content: 'The gate log reads 5:40, not 4:10. §2', source: 'incident', created_by: 'u-dev', created_at: '2026-04-15T12:00:00.000Z', author_label: null },
  ],
  users: [{ id: 'u-dev', name: 'Robert' }],
  person_file_attachments: [],
  person_reports: [],
  person_contract_documents: [],
  person_licenses: [],
  writeups: [],
  writeup_templates: [],
  attendance_incidents: [],
  attendance_annotations: [],
}

vi.mock('../../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../../test/renderSmokeMocks')
  return useAuthModuleMock()
})
vi.mock('../../../lib/supabase', () => {
  function makeBuilder(rows: unknown[]): Record<string, unknown> {
    const builder: Record<string, unknown> = {}
    for (const m of ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'in', 'is', 'order', 'range', 'limit']) builder[m] = () => builder
    builder.single = () => Promise.resolve({ data: rows[0] ?? null, error: null })
    builder.maybeSingle = () => Promise.resolve({ data: rows[0] ?? null, error: null })
    builder.then = (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) => Promise.resolve({ data: rows, error: null, count: rows.length }).then(onFulfilled, onRejected)
    return builder
  }
  return { supabase: { from: (table: string) => makeBuilder(TABLE_ROWS[table] ?? []), rpc: () => Promise.resolve({ data: null, error: null }), storage: { from: () => ({ upload: () => Promise.resolve({ error: null }), createSignedUrl: () => Promise.resolve({ data: null, error: null }) }) }, functions: { invoke: () => Promise.resolve({ data: null, error: null }) } } }
})
vi.mock('../../../lib/legal/legalThemesIo', () => ({ loadThemes: vi.fn(async () => ({ themes: [], marks: [], heldWhy: null })), addMarks: vi.fn(), removeMark: vi.fn(), keepMark: vi.fn() }))
vi.mock('../../../lib/people/personEvidenceIo', () => ({
  loadPersonEvidence: vi.fn(async () => ({ records: [], heldWhy: null })),
  savePersonEvidence: vi.fn(),
  fileEvidenceToDrive: vi.fn(async () => ({ ok: true, why: null })),
}))
vi.mock('../../../lib/people/personDocumentsIo', () => ({
  loadPersonDocuments: vi.fn(async () => ({ documents: [], heldWhy: null })),
  loadPersonDocument: vi.fn(),
  savePersonDocument: vi.fn(),
}))
// e2 corrects e1; a withdrawn link (e2 completes e1) stays on the record and is not drawn.
vi.mock('../../../lib/people/personAmendmentsIo', () => ({
  loadPersonAmendments: vi.fn(async () => ({
    rows: [
      { id: 'a1', from_kind: 'hr_entry', from_id: 'e2', to_kind: 'hr_entry', to_id: 'e1', how: 'corrects', created_at: '2026-04-15T12:00:01.000Z', withdrawn_at: null },
      { id: 'a0', from_kind: 'hr_entry', from_id: 'e2', to_kind: 'hr_entry', to_id: 'e1', how: 'completes', created_at: '2026-04-15T12:00:00.500Z', withdrawn_at: '2026-04-15T12:00:00.900Z' },
    ],
    heldWhy: null,
  })),
  addAmendments: vi.fn(async () => ({ ok: true, made: 1 })),
  withdrawAmendment: vi.fn(async () => ({ ok: true })),
}))

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const VIEWER = { isDev: true, canAccessContracts: true, canAccessLicenses: true }
const panel = (initialView: 'timeline' | 'narrative') => <PersonFilePanel personId="p-marcus" userId="u-marcus" personName="Marcus Reed" viewer={VIEWER} initialView={initialView} />

describe('PersonFilePanel · corrections as links (punch list #315)', () => {
  it('the older entry reads as corrected and the newer one says what it corrects', async () => {
    renderWithProviders(panel('timeline'))
    const older = await screen.findByTestId('line-amends-entry:e1')
    const corrected = await within(older).findByRole('button', { name: 'Corrected Apr 15, 2026 ›' })
    expect(corrected).toBeTruthy()
    // One live link, so one chip: the withdrawn "completes" is not drawn.
    expect(within(older).queryByText(/Completed/)).toBeNull()
    const newer = screen.getByTestId('line-amends-entry:e2')
    expect(within(newer).getByRole('button', { name: 'Corrects the entry of Mar 30, 2026 ›' })).toBeTruthy()
    fireEvent.click(corrected)
    expect((await screen.findByRole('tab', { name: /^Timeline/ })).getAttribute('aria-selected')).toBe('true')
  })

  it('Correct this entry… opens the composer with the link picked, and Add entry writes it', async () => {
    renderWithProviders(panel('timeline'))
    const older = await screen.findByTestId('line-amends-entry:e1')
    fireEvent.click(within(older).getByRole('button', { name: 'Correct this entry…' }))
    const picks = await screen.findByTestId('composer-amends')
    expect(picks.textContent).toContain('the entry of')
    expect(picks.textContent).toContain('The truck came back at 4:10.')
    const how = within(picks).getByRole('combobox', { name: 'What this entry does to the entry' }) as HTMLSelectElement
    expect(how.value).toBe('corrects')
    fireEvent.change(how, { target: { value: 'completes' } })
    fireEvent.change(screen.getByPlaceholderText('What happened. Facts and dates, no guesses.'), { target: { value: 'The gate log also shows the trailer.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add entry' }))
    await waitFor(() => expect(addAmendments).toHaveBeenCalledTimes(1))
    const call = vi.mocked(addAmendments).mock.calls[0]?.[0]
    expect(call?.personId).toBe('p-marcus')
    expect(call?.fromKind).toBe('hr_entry')
    expect(call?.targets).toEqual([{ kind: 'hr_entry', id: 'e1', how: 'completes' }])
  })

  it('a link is withdrawn with a reason', async () => {
    renderWithProviders(panel('timeline'))
    const newer = await screen.findByTestId('line-amends-entry:e2')
    fireEvent.click(await within(newer).findByRole('button', { name: 'Withdraw the link: Corrects the entry of Mar 30, 2026' }))
    const press = within(newer).getByRole('button', { name: 'Withdraw the link' }) as HTMLButtonElement
    expect(press.disabled).toBe(true)
    fireEvent.change(within(newer).getByLabelText('Why the link comes off'), { target: { value: 'two different trucks' } })
    expect(press.disabled).toBe(false)
    fireEvent.click(press)
    await waitFor(() => expect(withdrawAmendment).toHaveBeenCalledTimes(1))
    expect(vi.mocked(withdrawAmendment).mock.calls[0]?.slice(0, 2)).toEqual(['a1', 'two different trucks'])
  })

  it("the narrative's Jump to flags a section cited by an entry corrected since", async () => {
    renderWithProviders(panel('narrative'))
    const nav = await screen.findByRole('navigation', { name: 'Jump to section' })
    const count = await within(nav).findByRole('button', { name: 'Section 2: cited by 2 entries, 1 of them corrected since' })
    fireEvent.click(count)
    const strip = within(nav).getByTestId('hr-doc-cited-by')
    expect(strip.textContent).toContain('Section 2 · cited by 2 entries, 1 of them corrected since')
    expect(within(strip).getByRole('button', { name: /The truck came back at 4:10\..*corrected since/ })).toBeTruthy()
    expect(within(strip).getByRole('button', { name: /The gate log reads 5:40/ }).textContent).not.toContain('corrected since')
  })
})
