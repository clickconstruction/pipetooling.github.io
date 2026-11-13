// @vitest-environment jsdom
/**
 * When each section last changed (punch list #315, upgrade 5a): a fold on the summary and the narrative that reads the
 * earlier versions only when opened, then says for each section when it took its present words and how many entries
 * were written since, flagged when one of them cites the section. Made-up people and words.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../../test/renderSmokeMocks'
import { PersonFilePanel } from './PersonFilePanel'
import { loadDocRevisions } from '../../../lib/people/sectionFreshnessIo'

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
vi.mock('../../../lib/people/personAmendmentsIo', () => ({ loadPersonAmendments: vi.fn(async () => ({ rows: [], heldWhy: null })), addAmendments: vi.fn(), withdrawAmendment: vi.fn() }))
// One earlier version, replaced Apr 1: section 2 read "One trip." then, and sections 1 and 3 read as they do now.
vi.mock('../../../lib/people/sectionFreshnessIo', () => ({
  SECTION_FRESHNESS_REVISIONS: 12,
  loadDocRevisions: vi.fn(async () => ({ revisions: [{ content: '## 1. Background\n\nJoined in March.\n\n## 2. The spring\n\nOne trip.\n\n## 3. After\n\nQuiet.', replaced_at: '2026-04-01T15:00:00.000Z' }], capped: false, heldWhy: null })),
}))

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const VIEWER = { isDev: true, canAccessContracts: true, canAccessLicenses: true }
const panel = (isDev = true) => <PersonFilePanel personId="p-marcus" userId="u-marcus" personName="Marcus Reed" viewer={{ ...VIEWER, isDev }} initialView="narrative" />
// The panel draws its body again as its sources settle, so the fold is asked for afresh each time it is used.
const fold = () => screen.getByTestId('hr-doc-freshness-narrative')
const open = () => {
  const el = fold() as HTMLDetailsElement
  el.open = true
  fireEvent(el, new Event('toggle'))
}

describe('PersonFilePanel · when each section last changed (punch list #315)', () => {
  it('reads nothing until the fold is opened, then says when each section changed and what was written since', async () => {
    renderWithProviders(panel())
    await screen.findByTestId('hr-doc-freshness-narrative')
    await screen.findByText('Two trips.')
    expect(loadDocRevisions).not.toHaveBeenCalled()
    open()
    await waitFor(() => expect(within(fold()).getByText('3 sections · 1 cited by an entry written since it last changed.')).toBeTruthy())
    expect(loadDocRevisions).toHaveBeenCalledTimes(1)
    expect(vi.mocked(loadDocRevisions).mock.calls[0]).toEqual(['p-marcus', 'narrative'])
    const rows = within(fold()).getAllByRole('listitem').map((li) => li.textContent)
    // Section 2 changed when the earlier version was replaced; the Apr 15 entry cites it. Sections 1 and 3 are older than that version.
    expect(rows).toEqual([
      '1. Backgroundnot changed since before Apr 1, 2026at least 1 entry since',
      '2. The springchanged Apr 1, 20261 entry since, 1 cites it',
      '3. Afternot changed since before Apr 1, 2026at least 1 entry since',
    ])
    // Opened a second time, the versions already read are not read again.
    open()
    expect(loadDocRevisions).toHaveBeenCalledTimes(1)
  })

  it('a read that fails says why and leaves the document as it was', async () => {
    vi.mocked(loadDocRevisions).mockResolvedValueOnce({ revisions: [], capped: false, heldWhy: 'permission denied for table person_file_revisions' })
    renderWithProviders(panel())
    await screen.findByTestId('hr-doc-freshness-narrative')
    await screen.findByText('Two trips.')
    open()
    await waitFor(() => expect(within(fold()).getByRole('alert').textContent).toBe('The earlier versions could not be read: permission denied for table person_file_revisions'))
    expect(screen.getByText('Two trips.')).toBeTruthy()
  })
})
