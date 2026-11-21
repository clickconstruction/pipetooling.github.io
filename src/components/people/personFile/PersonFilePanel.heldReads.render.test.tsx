// @vitest-environment jsdom
/**
 * A read of its own that fails on the HR file (v2.8061, the audit of punch list #315): the correction links, the
 * evidence numbers and the standing are each read apart from the Timeline's sources, and a failure of one used to draw
 * as a file with no correction, no number and no standing. The file names each under *Not read here*, and the strip's
 * press says the standing was not read. Made-up people only.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../../test/renderSmokeMocks'
import { PersonFilePanel } from './PersonFilePanel'
import { loadPersonAmendments } from '../../../lib/people/personAmendmentsIo'
import { loadExhibitNumbers } from '../../../lib/people/personCaseIo'
import { loadPersonEngagements } from '../../../lib/people/personEngagementsIo'

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

vi.mock('../../../lib/people/personAmendmentsIo', () => ({
  loadPersonAmendments: vi.fn(async () => ({ rows: [], heldWhy: null })),
  addAmendments: vi.fn(),
  withdrawAmendment: vi.fn(),
}))
vi.mock('../../../lib/people/personCaseIo', () => ({
  loadExhibitNumbers: vi.fn(async () => ({ byId: new Map(), unnumbered: 0, heldWhy: null })),
  loadPersonCase: vi.fn(async () => ({ items: [], log: [], heldWhy: null })),
  writePersonCase: vi.fn(),
  runExhibitBackfill: vi.fn(),
}))
vi.mock('../../../lib/people/personEngagementsIo', () => ({
  loadPersonEngagements: vi.fn(async () => ({ rows: [], heldWhy: null })),
  writePersonEngagement: vi.fn(),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  // clearAllMocks keeps a resolved value a test set, so each read goes back to answering.
  vi.mocked(loadPersonAmendments).mockResolvedValue({ rows: [], heldWhy: null })
  vi.mocked(loadExhibitNumbers).mockResolvedValue({ byId: new Map(), unnumbered: 0, heldWhy: null })
  vi.mocked(loadPersonEngagements).mockResolvedValue({ rows: [], heldWhy: null })
})

const VIEWER = { isDev: true, canAccessContracts: true, canAccessLicenses: true }
const panel = () => renderWithProviders(<PersonFilePanel personId="p-marcus" userId="u-marcus" personName="Marcus Reed" viewer={VIEWER} />)

describe('PersonFilePanel · a read of its own that fails', () => {
  it('says nothing was left out when every read answers', async () => {
    panel()
    const chip = await screen.findByTestId('person-file-standing-chip')
    expect(chip.textContent).toBe('Standing…')
    await screen.findByText('Sit-down about Master hours.')
    expect(screen.queryByText(/Not read here/)).toBeNull()
  })

  it('names the correction links when their read fails, so an entry is not taken as uncorrected', async () => {
    vi.mocked(loadPersonAmendments).mockResolvedValue({ rows: [], heldWhy: 'the links timed out' })
    panel()
    const line = await screen.findByText(/Not read here/)
    expect(line.textContent).toBe('Not read here: the correction links, so a corrected entry is not marked (the links timed out).')
  })

  it('names the evidence numbers and the standing, and the strip says the standing was not read', async () => {
    vi.mocked(loadExhibitNumbers).mockResolvedValue({ byId: new Map(), unnumbered: 0, heldWhy: 'no signal' })
    vi.mocked(loadPersonEngagements).mockResolvedValue({ rows: [], heldWhy: 'no signal either' })
    panel()
    const line = await screen.findByText(/Not read here/)
    await waitFor(() => expect(line.textContent).toBe('Not read here: the evidence numbers (no signal) · the standing (no signal either).'))
    expect(screen.getByTestId('person-file-standing-chip').textContent).toBe('Standing not read')
  })
})
