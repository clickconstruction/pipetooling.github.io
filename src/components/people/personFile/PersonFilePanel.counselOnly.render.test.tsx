// @vitest-environment jsdom
/**
 * Counsel-only evidence on the HR file (v2.6554, punch list #269 PR 2) over a fake evidence io: the Add evidence
 * window's tick turns Where it goes into kept here only and rides on the save; a counsel-only record wears the lock
 * chip with no Drive door and its Timeline line reads the title alone; the Evidence tab's filter narrows to them.
 * Made-up people only.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { PersonEvidenceRecord } from '../../../lib/people/personEvidence'
import { renderWithProviders } from '../../../test/renderSmokeMocks'
import { PersonFilePanel } from './PersonFilePanel'

const TABLE_ROWS: Record<string, unknown[]> = {
  people: [{ id: 'p-marcus', name: 'Marcus Reed', kind: 'helper', archived_at: null, start_date: '2025-03-11', end_date: null, account_user_id: 'u-marcus' }],
  person_files: [],
  person_file_entries: [{ id: 'e1', person_id: 'p-marcus', entry_date: '2026-07-18', content: 'Sit-down about Master hours.', source: 'review', created_by: 'u-dev', created_at: '2026-07-18T12:00:00.000Z', author_label: null }],
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
  savePersonEvidence: vi.fn(async () => ({ ok: true as const, recordId: 'r-new', staged: 0, linked: 1, drive: null })),
}))
vi.mock('../../../lib/people/personEvidenceIo', () => ({
  loadPersonEvidence: vi.fn(async () => ({ records: io.records, heldWhy: null })),
  savePersonEvidence: io.savePersonEvidence,
  fileEvidenceToDrive: vi.fn(async () => ({ ok: true, why: null })),
}))

const record = (over: Partial<PersonEvidenceRecord>): PersonEvidenceRecord => ({ id: 'r1', person_id: 'p-marcus', entry_id: null, dated_on: '2026-06-26', title: 'Recording of the call', memo: 'What was said on the call.', created_by: 'u-dev', author_label: null, created_at: '2026-08-08T00:00:00Z', drive_folder_id: null, drive_folder_url: null, filed_at: null, fail_why: null, counsel_only: false, files: [{ id: 'f1', evidence_id: 'r1', entry_id: null, filename: 'call.m4a', mime_type: 'audio/mp4', size_bytes: 1000, storage_path: 'p/r1/f1', drive_file_id: null, drive_url: null, filed_at: null, fail_why: null, created_at: '2026-08-08T00:00:00Z', sha256: null }], ...over })

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  io.records = []
})

const VIEWER = { isDev: true, canAccessContracts: true, canAccessLicenses: true }

describe('PersonFilePanel · counsel-only evidence', () => {
  it('the tick turns Where it goes into kept here only and rides on the save', async () => {
    renderWithProviders(<PersonFilePanel personId="p-marcus" userId="u-marcus" personName="Marcus Reed" viewer={VIEWER} initialView="evidence" />)
    fireEvent.click((await screen.findAllByRole('button', { name: '+ Add evidence' }))[0]!)
    const dialog = await screen.findByRole('dialog', { name: 'Add evidence' })
    expect(within(dialog).getByText(/Where it goes:/).textContent).toContain('People')
    fireEvent.click(within(within(dialog).getByTestId('evidence-counsel-only')).getByRole('checkbox'))
    expect(within(dialog).getByText(/Where it goes:/).textContent).toContain('kept here only, counsel-only. Not filed in Drive.')
    fireEvent.change(within(dialog).getByPlaceholderText('What this is, in a few words'), { target: { value: 'Recording for counsel' } })
    fireEvent.change(within(dialog).getByPlaceholderText(/What it shows and why it matters/), { target: { value: 'Privileged.' } })
    fireEvent.change(within(dialog).getByPlaceholderText('Its name'), { target: { value: 'call.m4a' } })
    fireEvent.change(within(dialog).getByPlaceholderText(/drive\.google\.com/), { target: { value: 'https://drive.google.com/file/d/abcdefghijklmnop/view' } })
    fireEvent.click(within(dialog).getByTestId('evidence-add-link'))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Keep the evidence' }))
    await waitFor(() => expect(io.savePersonEvidence).toHaveBeenCalledTimes(1))
    expect(io.savePersonEvidence).toHaveBeenCalledWith(expect.objectContaining({ draft: expect.objectContaining({ title: 'Recording for counsel', counselOnly: true }) }))
  })

  it('a counsel-only record wears the lock chip with no Drive door, its line reads the title alone, and the filter narrows to it', async () => {
    io.records = [record({ id: 'r1', counsel_only: true }), record({ id: 'r2', title: 'Bank statement, April', memo: 'The charges.', dated_on: '2026-04-30', counsel_only: false })]
    renderWithProviders(<PersonFilePanel personId="p-marcus" userId="u-marcus" personName="Marcus Reed" viewer={VIEWER} initialView="evidence" />)
    const chip = await screen.findByTestId('evidence-counsel-chip')
    expect(chip.textContent).toBe('🔒 Kept here only, counsel-only')
    const held = chip.closest('li')!
    expect(within(held).queryByRole('button', { name: 'Try Drive again' })).toBeNull()
    expect(within(held).getByRole('button', { name: /call\.m4a/ }).getAttribute('title')).toContain('kept here only, counsel-only')
    expect(screen.getByText(/2 pieces of evidence, 2 files\. 1 not in Drive yet\. 1 counsel-only\./)).toBeTruthy()
    const filter = screen.getByTestId('evidence-filter')
    fireEvent.click(within(filter).getByRole('button', { name: /Counsel-only · 1/ }))
    expect(screen.queryByText('Bank statement, April')).toBeNull()
    expect(screen.getByText('Recording of the call')).toBeTruthy()
    fireEvent.click(within(filter).getByRole('button', { name: /All · 2/ }))
    expect(screen.getByText('Bank statement, April')).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: /Timeline/ }))
    const line = (await screen.findByText('Recording of the call')).closest('li')!
    expect(line.textContent).toContain('evidence · counsel-only')
    expect(line.textContent).not.toContain('What was said on the call.')
  })
})
