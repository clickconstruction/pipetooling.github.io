// @vitest-environment jsdom
/**
 * Evidence superseded by a named document (v2.6704, punch list #277 open call 2) over fake evidence and documents ios:
 * a record whose files are all Drive links offers *Now a named document…*, the picker lists the kept named documents,
 * Mark it writes the mark through the io; a marked record wears the Superseded chip that opens the document; a record
 * with a staged file, or already marked, has no door. Made-up people only.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { PersonEvidenceRecord } from '../../../lib/people/personEvidence'
import { renderWithProviders } from '../../../test/renderSmokeMocks'
import { PersonFilePanel } from './PersonFilePanel'

const TABLE_ROWS: Record<string, unknown[]> = {
  people: [{ id: 'p-marcus', name: 'Marcus Reed', kind: 'helper', archived_at: null, start_date: '2025-03-11', end_date: null, account_user_id: 'u-marcus' }],
  person_files: [],
  person_file_entries: [],
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
    for (const m of ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'in', 'order', 'range', 'limit']) builder[m] = () => builder
    builder.single = () => Promise.resolve({ data: rows[0] ?? null, error: null })
    builder.maybeSingle = () => Promise.resolve({ data: rows[0] ?? null, error: null })
    builder.then = (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) => Promise.resolve({ data: rows, error: null, count: rows.length }).then(onFulfilled, onRejected)
    return builder
  }
  return { supabase: { from: (table: string) => makeBuilder(TABLE_ROWS[table] ?? []), rpc: () => Promise.resolve({ data: null, error: null }), storage: { from: () => ({ upload: () => Promise.resolve({ error: null }) }) }, functions: { invoke: () => Promise.resolve({ data: null, error: null }) } } }
})
vi.mock('../../../lib/legal/legalThemesIo', () => ({ loadThemes: vi.fn(async () => ({ themes: [], marks: [], heldWhy: null })), addMarks: vi.fn(), removeMark: vi.fn(), keepMark: vi.fn() }))
const io = vi.hoisted(() => ({
  records: [] as unknown[],
  supersedeEvidenceWithDocument: vi.fn(async () => ({ ok: true as const, title: 'Company history' })),
  loadPersonDocument: vi.fn(async (id: string) => ({ document: { id, person_id: 'p-marcus', title: 'Company history', content: '## 2024\n\nThe start.', counsel_only: false, author_label: 'Robert', updated_by: 'u-dev', created_at: '2026-11-08T00:00:00Z', updated_at: '2026-11-08T00:00:00Z', archived_at: null, chars: 20, sections: 1 }, why: null })),
}))
vi.mock('../../../lib/people/personEvidenceIo', () => ({
  loadPersonEvidence: vi.fn(async () => ({ records: io.records, heldWhy: null })),
  savePersonEvidence: vi.fn(),
  fileEvidenceToDrive: vi.fn(async () => ({ ok: true, why: null })),
  supersedeEvidenceWithDocument: io.supersedeEvidenceWithDocument,
}))
const DOCS = [
  { id: 'doc-hist', person_id: 'p-marcus', title: 'Company history', counsel_only: false, author_label: 'Robert', updated_by: 'u-dev', created_at: '2026-11-08T00:00:00Z', updated_at: '2026-11-08T00:00:00Z', archived_at: null, chars: 300000, sections: 40 },
  { id: 'doc-kb', person_id: 'p-marcus', title: 'Knowledge base', counsel_only: false, author_label: 'Robert', updated_by: 'u-dev', created_at: '2026-11-08T00:00:00Z', updated_at: '2026-11-08T01:00:00Z', archived_at: null, chars: 200000, sections: 30 },
  { id: 'doc-old', person_id: 'p-marcus', title: 'Old notes', counsel_only: false, author_label: 'Robert', updated_by: 'u-dev', created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z', archived_at: '2026-11-08T02:00:00Z', chars: 10, sections: 0 },
]
vi.mock('../../../lib/people/personDocumentsIo', () => ({
  loadPersonDocuments: vi.fn(async () => ({ documents: DOCS, heldWhy: null })),
  loadPersonDocument: io.loadPersonDocument,
  savePersonDocument: vi.fn(),
  setPersonDocumentArchived: vi.fn(),
}))

const linked = { id: 'f1', evidence_id: 'r1', entry_id: null, filename: 'Company history.md', mime_type: null, size_bytes: null, storage_path: null, drive_file_id: 'd1', drive_url: 'https://drive.google.com/file/d/d1/view', filed_at: '2026-11-07T00:00:00Z', fail_why: null, created_at: '2026-11-07T00:00:00Z', sha256: null }
const record = (over: Partial<PersonEvidenceRecord>): PersonEvidenceRecord => ({ id: 'r1', person_id: 'p-marcus', entry_id: null, dated_on: '2026-11-07', title: 'Company history (Drive)', memo: 'The owners’ history of their time.', created_by: 'u-dev', author_label: null, created_at: '2026-11-07T00:00:00Z', drive_folder_id: null, drive_folder_url: null, filed_at: null, fail_why: null, counsel_only: false, superseded_by_document_id: null, superseded_at: null, superseded_by: null, files: [linked], ...over })

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  io.records = []
})

const VIEWER = { isDev: true, canAccessContracts: true, canAccessLicenses: true }

describe('PersonFilePanel · evidence superseded by a named document', () => {
  it('a Drive-link-only record offers Now a named document…; the picker lists the kept documents and Mark it writes the mark', async () => {
    io.records = [record({}), record({ id: 'r2', title: 'Scan of the letter', files: [{ ...linked, id: 'f2', evidence_id: 'r2', storage_path: 'p/evidence/r2/f2-letter.pdf', drive_url: null, drive_file_id: null }] })]
    renderWithProviders(<PersonFilePanel personId="p-marcus" userId="u-marcus" personName="Marcus Reed" viewer={VIEWER} initialView="evidence" />)
    const doors = await screen.findAllByRole('button', { name: 'Now a named document…' })
    expect(doors).toHaveLength(1)
    fireEvent.click(doors[0]!)
    const picker = await screen.findByTestId('evidence-supersede-picker')
    const select = within(picker).getByRole('combobox', { name: 'The named document' }) as HTMLSelectElement
    expect(Array.from(select.options).map((o) => o.textContent)).toEqual(['Pick a document', 'Knowledge base', 'Company history'])
    const mark = within(picker).getByRole('button', { name: 'Mark it' }) as HTMLButtonElement
    expect(mark.disabled).toBe(true)
    fireEvent.change(select, { target: { value: 'doc-hist' } })
    expect(mark.disabled).toBe(false)
    fireEvent.click(mark)
    await waitFor(() => expect(io.supersedeEvidenceWithDocument).toHaveBeenCalledWith({ evidenceId: 'r1', documentId: 'doc-hist' }))
    expect(await screen.findByText('Company history (Drive) is marked: superseded by Company history.')).toBeTruthy()
  })

  it('a marked record wears the Superseded chip, which opens the document, and has no door', async () => {
    io.records = [record({ superseded_by_document_id: 'doc-hist', superseded_at: '2026-11-08T20:00:00Z', superseded_by: 'u-dev' })]
    renderWithProviders(<PersonFilePanel personId="p-marcus" userId="u-marcus" personName="Marcus Reed" viewer={VIEWER} initialView="evidence" />)
    const chip = await screen.findByTestId('evidence-superseded-chip')
    expect(chip.textContent).toBe('Superseded by Company history · Nov 8, 2026 · Robert')
    expect(screen.queryByRole('button', { name: 'Now a named document…' })).toBeNull()
    expect(screen.getByText('In Drive, linked')).toBeTruthy()
    fireEvent.click(chip)
    expect(await screen.findByTestId('hr-doc-open')).toBeTruthy()
    expect(io.loadPersonDocument).toHaveBeenCalledWith('doc-hist')
  })
})
