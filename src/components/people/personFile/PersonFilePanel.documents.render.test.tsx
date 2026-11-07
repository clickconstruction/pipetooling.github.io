// @vitest-environment jsdom
/**
 * Named documents on the HR file (v2.6614, punch list #277 PR 2) over a fake documents io: the Documents view lists
 * them with the counsel-only chip under the two the agent keeps; Open draws the document with its Jump to and Edit the
 * document; Add a document from a file reads the file in the browser, proposes the title and saves through the io;
 * Write it needs a title and words before Add wakes. Made-up people only.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../../test/renderSmokeMocks'
import { PersonFilePanel } from './PersonFilePanel'

const TABLE_ROWS: Record<string, unknown[]> = {
  people: [{ id: 'p-marcus', name: 'Marcus Reed', kind: 'helper', archived_at: null, start_date: '2025-03-11', end_date: null, account_user_id: 'u-marcus' }],
  person_files: [{ kind: 'narrative', content: '## 2026\n\nStarted in March.', updated_at: '2026-11-06T22:00:00+00:00', covered_through: null, author_label: 'Robert' }],
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

const GUIDE = '## Before the call\n\nRead the file.\n\n## During the call\n\nAsk, then listen.\n\n## After the call\n\nWrite it down the same day.'
const io = vi.hoisted(() => ({
  documents: [] as unknown[],
  loadPersonDocument: vi.fn(async (id: string) => ({ document: { id, person_id: 'p-marcus', title: 'Interview guide', content: '## Before the call\n\nRead the file.\n\n## During the call\n\nAsk, then listen.\n\n## After the call\n\nWrite it down the same day.', counsel_only: false, author_label: 'Robert', updated_by: 'u-dev', created_at: '2026-11-01T00:00:00Z', updated_at: '2026-11-07T20:00:00Z', archived_at: null, chars: 90, sections: 3 }, why: null })),
  savePersonDocument: vi.fn(async () => ({ ok: true as const, docId: 'doc-new', updatedAt: '2026-11-07T21:00:00Z' })),
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
  loadPersonEvidence: vi.fn(async () => ({ records: [], heldWhy: null })),
  savePersonEvidence: vi.fn(),
  fileEvidenceToDrive: vi.fn(async () => ({ ok: true, why: null })),
}))
vi.mock('../../../lib/people/personDocumentsIo', () => ({
  loadPersonDocuments: vi.fn(async () => ({ documents: io.documents, heldWhy: null })),
  loadPersonDocument: io.loadPersonDocument,
  savePersonDocument: io.savePersonDocument,
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  io.documents = []
})

const VIEWER = { isDev: true, canAccessContracts: true, canAccessLicenses: true }
const row = (over: Record<string, unknown>) => ({ id: 'doc-1', person_id: 'p-marcus', title: 'Interview guide', counsel_only: false, author_label: 'Robert', updated_by: 'u-dev', created_at: '2026-11-01T00:00:00Z', updated_at: '2026-11-07T20:00:00Z', archived_at: null, chars: 4096, sections: 3, ...over })

describe('PersonFilePanel · named documents', () => {
  it('lists the named documents under the two the agent keeps, with the counsel-only chip, and the tab counts them', async () => {
    io.documents = [row({}), row({ id: 'doc-2', title: 'Counsel memo', counsel_only: true, chars: 18432, sections: 6 })]
    renderWithProviders(<PersonFilePanel personId="p-marcus" userId="u-marcus" personName="Marcus Reed" viewer={VIEWER} initialView="narrative" />)
    expect(await screen.findByRole('tab', { name: 'Documents (3)' })).toBeTruthy()
    const list = await screen.findByRole('region', { name: 'Named documents' })
    expect(within(list).getByText('Interview guide')).toBeTruthy()
    expect(within(list).getByText('Counsel memo')).toBeTruthy()
    expect(within(list).getAllByText('🔒 Counsel-only')).toHaveLength(1)
    expect(within(list).getByText(/Kept by Robert · .* · 6 sections · 18 KB/)).toBeTruthy()
    expect(within(list).getByRole('button', { name: 'Write it' })).toBeTruthy()
  })

  it('Open draws the document with its Jump to, Edit the document opens the same box and saves by id', async () => {
    io.documents = [row({})]
    renderWithProviders(<PersonFilePanel personId="p-marcus" userId="u-marcus" personName="Marcus Reed" viewer={VIEWER} initialView="narrative" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Open Interview guide' }))
    const open = await screen.findByTestId('hr-doc-open')
    expect(io.loadPersonDocument).toHaveBeenCalledWith('doc-1')
    expect(within(open).getByRole('heading', { name: 'Interview guide' })).toBeTruthy()
    expect(within(open).getByRole('navigation', { name: 'Jump to section' }).textContent).toContain('During the call')
    expect(within(open).getByRole('button', { name: 'Copy as text' })).toBeTruthy()
    fireEvent.click(within(open).getByRole('button', { name: 'Edit the document' }))
    const box = screen.getByRole('textbox', { name: 'The document' }) as HTMLTextAreaElement
    expect(box.value).toBe(GUIDE)
    fireEvent.change(box, { target: { value: `${GUIDE}\n\n## A week later\n\nCall again.` } })
    fireEvent.click(screen.getByRole('button', { name: 'Save the document' }))
    await waitFor(() => expect(io.savePersonDocument).toHaveBeenCalledTimes(1))
    expect(io.savePersonDocument).toHaveBeenCalledWith({ personId: 'p-marcus', docId: 'doc-1', title: 'Interview guide', markdown: `${GUIDE}\n\n## A week later\n\nCall again.`, expectUpdatedAt: '2026-11-07T20:00:00Z' })
    expect(await screen.findByText(/The document is saved\./)).toBeTruthy()
  })

  it('From a file reads the file in the browser, proposes the title from its name, and Add saves it with the mark', async () => {
    renderWithProviders(<PersonFilePanel personId="p-marcus" userId="u-marcus" personName="Marcus Reed" viewer={VIEWER} initialView="narrative" />)
    fireEvent.click(await screen.findByRole('button', { name: 'From a file (.md or .txt)' }))
    const form = screen.getByTestId('hr-doc-add')
    const add = within(form).getByRole('button', { name: 'Add the document' }) as HTMLButtonElement
    expect(add.disabled).toBe(true)
    const file = new File(['## Before the call\n\nRead the file.'], 'Interview-guide_v2.md', { type: 'text/markdown' })
    fireEvent.change(within(form).getByLabelText('The file'), { target: { files: [file] } })
    await waitFor(() => expect((within(form).getByLabelText('Document title') as HTMLInputElement).value).toBe('Interview guide v2'))
    expect(within(form).getByText(/Interview-guide_v2\.md · 34 characters/)).toBeTruthy()
    fireEvent.click(within(form).getByTestId('hr-doc-add-counsel'))
    expect(add.disabled).toBe(false)
    fireEvent.click(add)
    await waitFor(() => expect(io.savePersonDocument).toHaveBeenCalledTimes(1))
    expect(io.savePersonDocument).toHaveBeenCalledWith({ personId: 'p-marcus', docId: null, title: 'Interview guide v2', markdown: '## Before the call\n\nRead the file.', expectUpdatedAt: null, counselOnly: true })
    expect(await screen.findByText(/Interview guide v2 is on the file\./)).toBeTruthy()
  })

  it('a file that is not text is refused with its reason, and Write it needs a title and words', async () => {
    renderWithProviders(<PersonFilePanel personId="p-marcus" userId="u-marcus" personName="Marcus Reed" viewer={VIEWER} initialView="narrative" />)
    fireEvent.click(await screen.findByRole('button', { name: 'From a file (.md or .txt)' }))
    const form = screen.getByTestId('hr-doc-add')
    fireEvent.change(within(form).getByLabelText('The file'), { target: { files: [new File(['%PDF'], 'scan.pdf', { type: 'application/pdf' })] } })
    expect(await within(form).findByRole('alert')).toBeTruthy()
    expect(within(form).getByRole('alert').textContent).toContain('scan.pdf is not a markdown or plain text file')
    fireEvent.click(within(form).getByRole('button', { name: 'Cancel' }))
    fireEvent.click(screen.getByRole('button', { name: 'Write it' }))
    const write = screen.getByTestId('hr-doc-add')
    const add = within(write).getByRole('button', { name: 'Add the document' }) as HTMLButtonElement
    fireEvent.change(within(write).getByLabelText('Document title'), { target: { value: '  Site notes ' } })
    expect(add.disabled).toBe(true)
    fireEvent.change(within(write).getByLabelText('The document'), { target: { value: 'Clean.' } })
    expect(add.disabled).toBe(false)
  })
})
