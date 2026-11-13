// @vitest-environment jsdom
/**
 * The numbers the HR file hands out (punch list #315, upgrade 2), on the panel: a record wears *Ev #81* beside a
 * title that does not already carry it; *Ev #41* in an entry's words opens the record that number names, by the
 * file's number or by the one an old title wears; the Evidence view offers to number the old records after showing
 * what that would do; the Case tab counts the open items. Made-up people and words.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../../test/renderSmokeMocks'
import { PersonFilePanel } from './PersonFilePanel'
import { runExhibitBackfill } from '../../../lib/people/personCaseIo'

const TABLE_ROWS: Record<string, unknown[]> = {
  people: [{ id: 'p-marcus', name: 'Marcus Reed', kind: 'helper', archived_at: null, start_date: '2025-03-11', end_date: null, account_user_id: 'u-marcus' }],
  person_files: [],
  person_file_entries: [
    { id: 'e1', person_id: 'p-marcus', entry_date: '2026-03-30', content: 'The gate log shows 5:40 (Ev #41). The voicemail is Ev #81. Nothing is numbered Ev #99.', source: 'incident', created_by: 'u-dev', created_at: '2026-03-30T12:00:00.000Z', author_label: null },
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
const record = (id: string, title: string, dated_on: string) => ({
  id, person_id: 'p-marcus', entry_id: null, dated_on, title, memo: 'What it shows.', created_by: 'u-dev', author_label: 'Robert', created_at: `${dated_on}T20:00:00Z`,
  drive_folder_id: null, drive_folder_url: null, filed_at: null, fail_why: null, counsel_only: false, files: [],
})
// An old record whose title carries its number, and a new one the file numbered 81.
const RECORDS = [record('r-old', 'Ev #41 Gate log', '2026-03-02'), record('r-new', 'Voicemail from Friday', '2026-03-20')]

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
  loadPersonEvidence: vi.fn(async () => ({ records: RECORDS, heldWhy: null })),
  savePersonEvidence: vi.fn(),
  fileEvidenceToDrive: vi.fn(async () => ({ ok: true, why: null })),
}))
vi.mock('../../../lib/people/personDocumentsIo', () => ({
  loadPersonDocuments: vi.fn(async () => ({ documents: [], heldWhy: null })),
  loadPersonDocument: vi.fn(),
  savePersonDocument: vi.fn(),
}))
vi.mock('../../../lib/people/personAmendmentsIo', () => ({ loadPersonAmendments: vi.fn(async () => ({ rows: [], heldWhy: null })), addAmendments: vi.fn(), withdrawAmendment: vi.fn() }))
const REPORT = { dry_run: true, numbered: 1, clashes: [], lettered: [], no_number: [], no_number_numbered: 0, highest: 81, next: 82, still_unnumbered: 0 }
vi.mock('../../../lib/people/personCaseIo', () => ({
  loadExhibitNumbers: vi.fn(async () => ({ byId: new Map([['r-new', 81]]), unnumbered: 1, heldWhy: null })),
  loadPersonCase: vi.fn(async () => ({
    items: [{ id: 'i3', item_no: 3, title: 'Pull the March gate logs', detail: '', owner_label: '', state: 'open', opened_at: '2026-03-02T18:00:00+00:00', closed_at: null, closed_why: null, author_label: 'Robert', session_label: null }],
    log: [],
    heldWhy: null,
  })),
  runExhibitBackfill: vi.fn(async (input: { dryRun: boolean }) => ({ ok: true, report: { ...REPORT, dry_run: input.dryRun } })),
  writePersonCase: vi.fn(async () => ({ ok: true })),
}))

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const VIEWER = { isDev: true, canAccessContracts: true, canAccessLicenses: true }
const panel = (initialView: 'timeline' | 'evidence' | 'case') => <PersonFilePanel personId="p-marcus" userId="u-marcus" personName="Marcus Reed" viewer={VIEWER} initialView={initialView} />

describe('PersonFilePanel · the numbers the file hands out (punch list #315)', () => {
  it('a record wears its number beside a title that does not already carry it', async () => {
    renderWithProviders(panel('evidence'))
    expect((await screen.findByTestId('evidence-exhibit-r-new')).textContent).toBe('Ev #81')
    // The old record's title already says Ev #41, and the file has not numbered it: nothing is drawn twice.
    expect(screen.queryByTestId('evidence-exhibit-r-old')).toBeNull()
  })

  it("Ev #41 in an entry opens the record it names, by the file's number or an old title's; a number nobody wears stays words", async () => {
    renderWithProviders(panel('timeline'))
    const byTitle = await screen.findByRole('button', { name: 'Open the evidence record Ev #41' })
    expect(byTitle.textContent).toBe('Ev #41')
    expect(screen.getByRole('button', { name: 'Open the evidence record Ev #81' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Open the evidence record Ev #99' })).toBeNull()
    fireEvent.click(byTitle)
    expect((await screen.findByRole('tab', { name: /^Evidence/ })).getAttribute('aria-selected')).toBe('true')
  })

  it('offers to number the old records, shows what that would do first, and numbers on the press', async () => {
    renderWithProviders(panel('evidence'))
    const strip = await screen.findByTestId('evidence-numbering')
    expect(strip.textContent).toContain('1 record has no number from the file yet.')
    fireEvent.click(within(strip).getByRole('button', { name: 'See what numbering would do' }))
    await waitFor(() => expect(strip.textContent).toContain('1 record would take the number the title already wears.'))
    expect(strip.textContent).toContain('The next new record takes Ev #82.')
    expect(vi.mocked(runExhibitBackfill).mock.calls[0]?.[0]).toEqual({ personId: 'p-marcus', dryRun: true, numberRest: false })
    fireEvent.click(within(strip).getByRole('button', { name: 'Number 1 record' }))
    await waitFor(() => expect(runExhibitBackfill).toHaveBeenCalledTimes(2))
    expect(vi.mocked(runExhibitBackfill).mock.calls[1]?.[0]).toEqual({ personId: 'p-marcus', dryRun: false, numberRest: false })
  })

  it('the Case tab counts the open items and opens the Case view', async () => {
    renderWithProviders(panel('timeline'))
    const tab = await screen.findByRole('tab', { name: 'Case (1)' })
    fireEvent.click(tab)
    expect((await screen.findByTestId('person-case-view')).textContent).toContain('Pull the March gate logs')
  })
})
