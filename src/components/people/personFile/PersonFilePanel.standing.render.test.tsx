// @vitest-environment jsdom
/**
 * The standing press on the HR file's fact strip (punch list #315, upgrade 4b) over a fake supabase: the strip reads
 * what the person is, the press opens Standing…, the Timeline draws each change under Employment, and a file with no
 * stretch still offers the door. Made-up people only.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
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
  legal_matters: [],
  legal_matter_entries: [],
  legal_matter_documents: [],
  person_engagements: [],
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
  return { supabase: { from: (table: string) => makeBuilder(TABLE_ROWS[table] ?? []), rpc: () => Promise.resolve({ data: null, error: null }), auth: { getUser: () => Promise.resolve({ data: { user: { id: 'u-dev' } } }) }, storage: { from: () => ({ upload: () => Promise.resolve({ error: null }) }) }, functions: { invoke: () => Promise.resolve({ data: null, error: null }) } } }
})
vi.mock('../../../lib/legal/legalThemesIo', () => ({ loadThemes: vi.fn(async () => ({ themes: [], marks: [], heldWhy: null })), addMarks: vi.fn(), removeMark: vi.fn(), keepMark: vi.fn() }))
vi.mock('../../../lib/people/personEvidenceIo', () => ({
  loadPersonEvidence: vi.fn(async () => ({ records: [], heldWhy: null })),
  savePersonEvidence: vi.fn(),
  fileEvidenceToDrive: vi.fn(async () => ({ ok: true, why: null })),
}))

const STRETCHES = [
  { id: 'g1', kind: 'subcontractor', started_on: '2025-03-11', ended_on: '2026-05-31', source: 'contract', source_ref: '', note: '', withdrawn_at: null },
  { id: 'g2', kind: 'employee', started_on: '2026-06-01', ended_on: null, source: 'payroll', source_ref: '', note: '', withdrawn_at: null },
]

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  TABLE_ROWS.person_engagements = []
})

const VIEWER = { isDev: true, canAccessContracts: true, canAccessLicenses: true }

describe('PersonFilePanel · the standing press', () => {
  it('reads the standing on the fact strip, opens Standing…, and the Timeline draws the change under Employment', async () => {
    TABLE_ROWS.person_engagements = STRETCHES
    renderWithProviders(<PersonFilePanel personId="p-marcus" userId="u-marcus" personName="Marcus Reed" viewer={VIEWER} />)
    const chip = await screen.findByTestId('person-file-standing-chip')
    await waitFor(() => expect(chip.textContent).toBe('Employee · since Jun 1, 2026 · still engaged'))
    expect(await screen.findByText('Employee from this day. Subcontractor until the day before.')).toBeTruthy()
    expect(screen.queryByTestId('person-standing-window')).toBeNull()
    fireEvent.click(chip)
    expect(screen.getByTestId('person-standing-window')).toBeTruthy()
    expect(screen.getByTestId('person-standing-now').textContent).toBe('Employee · since Jun 1, 2026 · still engaged')
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByTestId('person-standing-window')).toBeNull()
  })

  it('offers Standing… on a file with no stretch, and the window says what fills it', async () => {
    renderWithProviders(<PersonFilePanel personId="p-marcus" userId="u-marcus" personName="Marcus Reed" viewer={VIEWER} />)
    const chip = await screen.findByTestId('person-file-standing-chip')
    expect(chip.textContent).toBe('Standing…')
    fireEvent.click(chip)
    expect(screen.getByTestId('person-standing-window').textContent).toContain('Nothing on file yet.')
  })

  it('draws no press for a viewer who is not a dev, since the table is not read', async () => {
    TABLE_ROWS.person_engagements = STRETCHES
    renderWithProviders(<PersonFilePanel personId="p-marcus" userId="u-marcus" personName="Marcus Reed" viewer={{ isDev: false, canAccessContracts: true, canAccessLicenses: true }} />)
    await screen.findByRole('tab', { name: /^Documents/ })
    expect(screen.queryByTestId('person-file-standing-chip')).toBeNull()
  })
})
