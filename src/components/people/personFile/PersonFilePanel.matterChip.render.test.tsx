// @vitest-environment jsdom
/**
 * The Matter chip on the HR file's fact strip (v2.6582, punch list #269 PR 3b) over a fake supabase: when a matter
 * stands on the person the strip wears `Matter · Under review` and a press opens the Matter view; when none stands the
 * strip has no such chip and the Matter view still offers Open a matter…. Made-up people only.
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

const MATTER = { id: 'm1', payer_key: 'p:p-marcus', customer_id: null, payer_name: 'Marcus Reed', kind: 'person', person_id: 'p-marcus', firm_id: null, stage: 'review', ready_marked_by: null, ready_marked_at: null, released_at: null, handling_name: '', note_to_firm: '', review_requested_by: null, review_requested_at: null, review_request_note: '', held_overrides: null, fees_to_statement: false, closed_at: null, closed_reason: '', updated_at: '2026-11-05T22:00:00Z', narrative_md: '', narrative_updated_at: null }

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  TABLE_ROWS.legal_matters = []
})

const VIEWER = { isDev: true, canAccessContracts: true, canAccessLicenses: true }

describe('PersonFilePanel · the Matter chip', () => {
  it('wears Matter · Under review on the fact strip once a matter stands, and a press opens the Matter view', async () => {
    TABLE_ROWS.legal_matters = [MATTER]
    renderWithProviders(<PersonFilePanel personId="p-marcus" userId="u-marcus" personName="Marcus Reed" viewer={VIEWER} />)
    const chip = await screen.findByTestId('person-file-matter-chip')
    expect(chip.textContent).toBe('Matter · Under review')
    expect(screen.getByTestId('person-file-tab-matter').getAttribute('aria-selected')).toBe('false')
    fireEvent.click(chip)
    expect(screen.getByTestId('person-file-tab-matter').getAttribute('aria-selected')).toBe('true')
    await waitFor(() => expect(screen.getByTestId('person-matter')).toBeTruthy())
    expect(screen.getByText('The matter on Marcus Reed')).toBeTruthy()
  })

  it('has no chip while none stands, and the Matter view still offers Open a matter…', async () => {
    renderWithProviders(<PersonFilePanel personId="p-marcus" userId="u-marcus" personName="Marcus Reed" viewer={VIEWER} />)
    await screen.findByText('Sit-down about Master hours.')
    expect(screen.queryByTestId('person-file-matter-chip')).toBeNull()
    fireEvent.click(screen.getByTestId('person-file-tab-matter'))
    expect(await screen.findByRole('button', { name: 'Open a matter…' })).toBeTruthy()
  })

  it('draws no chip for a viewer who is not a dev, since the legal tables are not read', async () => {
    TABLE_ROWS.legal_matters = [MATTER]
    renderWithProviders(<PersonFilePanel personId="p-marcus" userId="u-marcus" personName="Marcus Reed" viewer={{ isDev: false, canAccessContracts: true, canAccessLicenses: true }} />)
    await screen.findByRole('tab', { name: 'Narrative' })
    expect(screen.queryByTestId('person-file-matter-chip')).toBeNull()
  })
})
