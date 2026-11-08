// @vitest-environment jsdom
/**
 * A document names the evidence record it transcribes (v2.6713, punch list #287), over a fake evidence io and a fake
 * documents io: the record's Timeline line and its Evidence row carry *Transcript on file* and open the document; the
 * document's header names the record with its day and hash and opens the record; *Transcribes…* ties a document to a
 * record through the io, and a counsel-only record under an unmarked document is refused in words. Made-up people only.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
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

const HASH = '3f9a1c2b4d5e' + '0'.repeat(52)
const RECORD = {
  id: 'r-call', person_id: 'p-marcus', entry_id: null, dated_on: '2026-10-28', title: 'Recording of the call', memo: 'The call about the generator.', created_by: 'u-dev', author_label: 'Robert',
  created_at: '2026-10-28T20:00:00Z', drive_folder_id: 'folder', drive_folder_url: 'https://drive.google.com/drive/folders/folder', filed_at: '2026-10-28T20:01:00Z', fail_why: null, counsel_only: false,
  files: [{ id: 'f-audio', evidence_id: 'r-call', entry_id: null, filename: 'call.m4a', mime_type: 'audio/mp4', size_bytes: 5_000_000, storage_path: 'p-marcus/evidence/r-call/f-audio-call.m4a', drive_file_id: 'x1', drive_url: 'https://drive.google.com/file/d/x1/view', filed_at: '2026-10-28T20:01:00Z', fail_why: null, created_at: '2026-10-28T20:00:00Z', sha256: HASH }],
}
const DOC = { id: 'doc-1', person_id: 'p-marcus', title: 'Transcript of the call', counsel_only: false, author_label: 'Robert', updated_by: 'u-dev', created_at: '2026-11-01T00:00:00Z', updated_at: '2026-11-07T20:00:00Z', archived_at: null, chars: 4096, sections: 2, evidence_id: 'r-call' as string | null }

const io = vi.hoisted(() => ({
  records: [] as unknown[],
  documents: [] as unknown[],
  loadPersonDocument: vi.fn(async (id: string) => ({ document: { ...(io.documents.find((d) => (d as { id: string }).id === id) as object), content: '## The call\n\nWords.\n\n## After\n\nMore.' }, why: null })),
  tieDocumentToEvidence: vi.fn(async () => ({ ok: true as const, docId: 'doc-1', updatedAt: '2026-11-08T00:00:00Z' })),
}))

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
  return { supabase: { from: (table: string) => makeBuilder(TABLE_ROWS[table] ?? []), rpc: () => Promise.resolve({ data: null, error: null }), storage: { from: () => ({ upload: () => Promise.resolve({ error: null }), createSignedUrl: () => Promise.resolve({ data: null, error: null }) }) }, auth: { getSession: () => Promise.resolve({ data: { session: null }, error: null }) } } }
})
vi.mock('../../../lib/legal/legalThemesIo', () => ({ loadThemes: vi.fn(async () => ({ themes: [], marks: [], heldWhy: null })), addMarks: vi.fn(), removeMark: vi.fn(), keepMark: vi.fn() }))
vi.mock('../../../lib/people/personEvidenceIo', () => ({
  loadPersonEvidence: vi.fn(async () => ({ records: io.records, heldWhy: null })),
  savePersonEvidence: vi.fn(),
  fileEvidenceToDrive: vi.fn(async () => ({ ok: true, why: null })),
}))
vi.mock('../../../lib/people/personDocumentsIo', () => ({
  loadPersonDocuments: vi.fn(async () => ({ documents: io.documents, heldWhy: null })),
  loadPersonDocument: io.loadPersonDocument,
  savePersonDocument: vi.fn(),
  tieDocumentToEvidence: io.tieDocumentToEvidence,
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  io.records = []
  io.documents = []
})

const VIEWER = { isDev: true, canAccessContracts: true, canAccessLicenses: true }

describe('PersonFilePanel · a document names the record it transcribes', () => {
  it('the record\'s line and row read Transcript on file and open the document; the document names the record with its day and hash and opens the record', async () => {
    io.records = [RECORD]
    io.documents = [DOC]
    renderWithProviders(<PersonFilePanel personId="p-marcus" userId="u-marcus" personName="Marcus Reed" viewer={VIEWER} initialView="timeline" />)
    // The Timeline line.
    const linePress = await screen.findByRole('button', { name: 'Open the transcript of Recording of the call' })
    expect(linePress.textContent).toContain('Transcript on file')
    fireEvent.click(linePress)
    const open = await screen.findByTestId('hr-doc-open')
    expect(within(open).getByRole('heading', { name: 'Transcript of the call' })).toBeTruthy()
    // The header names the record: title, day, the first twelve of the hash; the audio's chip rides along.
    const strip = within(open).getByTestId('hr-doc-transcribes')
    const recordPress = within(strip).getByRole('button', { name: 'Open the evidence record Recording of the call' })
    expect(recordPress.textContent).toBe('Transcribes Recording of the call · Oct 28, 2026 · sha256 3f9a1c2b4d5e… ›')
    expect(within(strip).getByText('call.m4a')).toBeTruthy()
    expect(within(strip).getByRole('button', { name: 'Change the record…' })).toBeTruthy()
    // The press lands on the Evidence tab, on the record's row, which carries the chip back to the document.
    fireEvent.click(recordPress)
    await waitFor(() => expect(screen.getByRole('tab', { name: /^Evidence/ }).getAttribute('aria-selected')).toBe('true'))
    const row = document.querySelector('[data-person-evidence="r-call"]') as HTMLElement
    expect(row).toBeTruthy()
    const rowPress = within(row).getByTestId('evidence-transcript-chip')
    expect(rowPress.textContent).toContain('Transcript on file')
    fireEvent.click(rowPress)
    expect(await screen.findByTestId('hr-doc-open')).toBeTruthy()
    expect(screen.getByRole('tab', { name: /^Documents/ }).getAttribute('aria-selected')).toBe('true')
  })

  it('Transcribes… offers the person\'s records and ties the one picked through the io, quoting the version loaded', async () => {
    io.records = [RECORD]
    io.documents = [{ ...DOC, evidence_id: null }]
    renderWithProviders(<PersonFilePanel personId="p-marcus" userId="u-marcus" personName="Marcus Reed" viewer={VIEWER} initialView="narrative" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Open Transcript of the call' }))
    const open = await screen.findByTestId('hr-doc-open')
    expect(within(open).queryByRole('button', { name: /Open the evidence record/ })).toBeNull()
    fireEvent.click(within(open).getByRole('button', { name: 'Transcribes…' }))
    const picker = within(open).getByRole('combobox', { name: 'The record this document transcribes' }) as HTMLSelectElement
    expect([...picker.options].map((o) => o.textContent)).toEqual(['— none —', 'Oct 28, 2026 · Recording of the call'])
    fireEvent.change(picker, { target: { value: 'r-call' } })
    await waitFor(() => expect(io.tieDocumentToEvidence).toHaveBeenCalledWith({ personId: 'p-marcus', docId: 'doc-1', evidenceId: 'r-call', expectUpdatedAt: '2026-11-07T20:00:00Z' }))
    expect(await screen.findByText('The document now names its record.')).toBeTruthy()
  })

  it('a counsel-only record under a document not so marked is refused in words before anything is written', async () => {
    io.records = [{ ...RECORD, counsel_only: true }]
    io.documents = [{ ...DOC, evidence_id: null }]
    renderWithProviders(<PersonFilePanel personId="p-marcus" userId="u-marcus" personName="Marcus Reed" viewer={VIEWER} initialView="narrative" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Open Transcript of the call' }))
    const open = await screen.findByTestId('hr-doc-open')
    fireEvent.click(within(open).getByRole('button', { name: 'Transcribes…' }))
    const picker = within(open).getByRole('combobox', { name: 'The record this document transcribes' })
    expect(within(picker).getByText('Oct 28, 2026 · Recording of the call · 🔒 counsel-only')).toBeTruthy()
    fireEvent.change(picker, { target: { value: 'r-call' } })
    expect(await screen.findByText('That record is counsel-only, so its transcript is counsel-only too. Mark the document counsel-only first.')).toBeTruthy()
    expect(io.tieDocumentToEvidence).not.toHaveBeenCalled()
  })
})
