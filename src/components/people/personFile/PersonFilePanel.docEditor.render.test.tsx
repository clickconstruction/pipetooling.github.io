// @vitest-environment jsdom
/**
 * People → HR edits the summary and the narrative (v2.6609): the Edit press beside each heading opens the text in a
 * box; Save is dead until the words change, then sends the whole text and the updated_at it loaded to
 * dev_person_doc_write, the function the dev seat writes through; a refusal keeps the box open with its reason, and a
 * file with no summary yet offers Write. Made-up people only.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../../test/renderSmokeMocks'
import { PersonFilePanel } from './PersonFilePanel'

const NARRATIVE = '## 2026\n\nStarted in March.'
const TABLE_ROWS: Record<string, unknown[]> = {
  people: [{ id: 'p-marcus', name: 'Marcus Reed', kind: 'helper', archived_at: null, start_date: '2025-03-11', end_date: null, account_user_id: 'u-marcus' }],
  person_files: [{ kind: 'narrative', content: NARRATIVE, updated_at: '2026-11-06T22:00:00+00:00', covered_through: null, author_label: 'Robert' }],
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

const io = vi.hoisted(() => ({
  rpc: vi.fn(async () => ({ data: { ok: true } as { ok: boolean } | null, error: null as null | { message: string } })),
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
  return { supabase: { from: (table: string) => makeBuilder(TABLE_ROWS[table] ?? []), rpc: (...args: unknown[]) => io.rpc(...(args as [])), storage: { from: () => ({ upload: () => Promise.resolve({ error: null }), createSignedUrl: () => Promise.resolve({ data: null, error: null }) }) }, auth: { getSession: () => Promise.resolve({ data: { session: null }, error: null }) } } }
})
vi.mock('../../../lib/legal/legalThemesIo', () => ({ loadThemes: vi.fn(async () => ({ themes: [], marks: [], heldWhy: null })), addMarks: vi.fn(), removeMark: vi.fn(), keepMark: vi.fn() }))
vi.mock('../../../lib/people/personEvidenceIo', () => ({
  loadPersonEvidence: vi.fn(async () => ({ records: [], heldWhy: null })),
  savePersonEvidence: vi.fn(),
  fileEvidenceToDrive: vi.fn(async () => ({ ok: true, why: null })),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const VIEWER = { isDev: true, canAccessContracts: true, canAccessLicenses: true }

describe('PersonFilePanel · the summary and narrative editor', () => {
  it('Edit opens the narrative in a box, Save wakes when the words change and sends the whole text with the updated_at it loaded', async () => {
    renderWithProviders(<PersonFilePanel personId="p-marcus" userId="u-marcus" personName="Marcus Reed" viewer={VIEWER} initialView="narrative" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Edit the narrative' }))
    const box = screen.getByRole('textbox', { name: 'The narrative' }) as HTMLTextAreaElement
    expect(box.value).toBe(NARRATIVE)
    expect(screen.getByText(/Nothing changed yet\./)).toBeTruthy()
    const save = screen.getByRole('button', { name: 'Save the narrative' }) as HTMLButtonElement
    expect(save.disabled).toBe(true)
    // While one document is under edit the other heading offers no press.
    expect(screen.queryByRole('button', { name: /the summary$/ })).toBeNull()
    const next = `${NARRATIVE}\n\n## 2027\n\nStill here.`
    fireEvent.change(box, { target: { value: next } })
    expect(screen.getByText(/more than before/).textContent).toContain('Save keeps')
    expect(save.disabled).toBe(false)
    fireEvent.click(save)
    await waitFor(() => expect(io.rpc).toHaveBeenCalledTimes(1))
    expect(io.rpc).toHaveBeenCalledWith('dev_person_doc_write', { p: { person_id: 'p-marcus', kind: 'narrative', markdown: next, expect_updated_at: '2026-11-06T22:00:00+00:00' }, p_dry_run: false })
    expect(await screen.findByText(/The narrative is saved\./)).toBeTruthy()
    await waitFor(() => expect(screen.queryByTestId('hr-doc-editor-narrative')).toBeNull())
  })

  it('a refused save keeps the box open and names the reason, with the way out for a version saved since', async () => {
    io.rpc.mockResolvedValueOnce({ data: null, error: { message: 'dev_person_doc_write: the narrative was saved at 2026-11-06 22:10:00Z by Robert, after the version you loaded (2026-11-06 22:00:00Z). Read it again and edit from that.' } })
    renderWithProviders(<PersonFilePanel personId="p-marcus" userId="u-marcus" personName="Marcus Reed" viewer={VIEWER} initialView="narrative" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Edit the narrative' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'The narrative' }), { target: { value: 'Rewritten.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save the narrative' }))
    expect(await screen.findByText(/Copy your words, press Cancel, open it again and bring them over\./)).toBeTruthy()
    expect(screen.getByTestId('hr-doc-editor-narrative')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByTestId('hr-doc-editor-narrative')).toBeNull()
  })

  it('a file with no summary yet offers Write, which opens an empty box whose save carries no expectation', async () => {
    renderWithProviders(<PersonFilePanel personId="p-marcus" userId="u-marcus" personName="Marcus Reed" viewer={VIEWER} initialView="narrative" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Write the summary' }))
    const box = screen.getByRole('textbox', { name: 'The summary' }) as HTMLTextAreaElement
    expect(box.value).toBe('')
    fireEvent.change(box, { target: { value: '## Trajectory\n\nSteady.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save the summary' }))
    await waitFor(() => expect(io.rpc).toHaveBeenCalledWith('dev_person_doc_write', { p: { person_id: 'p-marcus', kind: 'summary', markdown: '## Trajectory\n\nSteady.' }, p_dry_run: false }))
  })
})
