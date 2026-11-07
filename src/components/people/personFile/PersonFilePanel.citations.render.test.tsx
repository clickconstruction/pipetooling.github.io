// @vitest-environment jsdom
/**
 * Citations between the entries and the narrative (v2.6615, punch list #277 PR 3): an entry's N§2 draws as a press that
 * opens the Documents view on the narrative and scrolls to section 2; the narrative's Jump to shows the count of citing
 * entries on that section, the count opens them as chips, and a chip opens the Timeline on the entry. Made-up people.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../../test/renderSmokeMocks'
import { PersonFilePanel } from './PersonFilePanel'

const NARRATIVE = '## 1. Background\n\nJoined in March.\n\n## 2. The spring\n\nTwo trips.\n\n## 3. After\n\nQuiet.'
const TABLE_ROWS: Record<string, unknown[]> = {
  people: [{ id: 'p-marcus', name: 'Marcus Reed', kind: 'helper', archived_at: null, start_date: '2025-03-11', end_date: null, account_user_id: 'u-marcus' }],
  person_files: [{ kind: 'narrative', content: NARRATIVE, updated_at: '2026-11-06T22:00:00+00:00', covered_through: null, author_label: 'Robert' }],
  person_file_entries: [
    { id: 'e1', person_id: 'p-marcus', entry_date: '2026-03-30', content: 'Trip charge on the card. N§2', source: 'incident', created_by: 'u-dev', created_at: '2026-03-30T12:00:00.000Z', author_label: null },
    { id: 'e2', person_id: 'p-marcus', entry_date: '2026-04-15', content: 'Told to stop (see §2); background in N§1.', source: 'conversation', created_by: 'u-dev', created_at: '2026-04-15T12:00:00.000Z', author_label: null },
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
  loadPersonDocuments: vi.fn(async () => ({ documents: [], heldWhy: null })),
  loadPersonDocument: vi.fn(),
  savePersonDocument: vi.fn(),
}))

const scrolled = vi.fn()
beforeAll(() => {
  Element.prototype.scrollIntoView = scrolled
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const VIEWER = { isDev: true, canAccessContracts: true, canAccessLicenses: true }

describe('PersonFilePanel · citations between the entries and the narrative', () => {
  it('N§2 on a line is a press that opens the narrative on section 2', async () => {
    renderWithProviders(<PersonFilePanel personId="p-marcus" userId="u-marcus" personName="Marcus Reed" viewer={VIEWER} initialView="timeline" />)
    const presses = await screen.findAllByRole('button', { name: 'Open section 2 of the narrative' })
    expect(presses).toHaveLength(2)
    // Newest first on the Timeline: the April line's §2, then the March line's N§2.
    expect(presses.map((b) => b.textContent)).toEqual(['§2', 'N§2'])
    expect(screen.getByRole('button', { name: 'Open section 1 of the narrative' }).textContent).toBe('N§1')
    fireEvent.click(presses[0]!)
    expect((await screen.findByRole('tab', { name: /^Documents/ })).getAttribute('aria-selected')).toBe('true')
    await waitFor(() => expect(scrolled).toHaveBeenCalled())
    const target = scrolled.mock.instances[0] as unknown as HTMLElement
    expect(target.id).toBe('2-the-spring')
  })

  it("the narrative's Jump to counts the citing entries on a section; the count opens them, and a chip opens the Timeline on the entry", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    renderWithProviders(<PersonFilePanel personId="p-marcus" userId="u-marcus" personName="Marcus Reed" viewer={VIEWER} initialView="narrative" />)
    const nav = await screen.findByRole('navigation', { name: 'Jump to section' })
    const count = within(nav).getByRole('button', { name: 'Section 2: cited by 2 entries' })
    expect(count.textContent).toBe('2')
    expect(within(nav).getByRole('button', { name: 'Section 1: cited by 1 entry' })).toBeTruthy()
    expect(within(nav).queryByRole('button', { name: /^Section 3:/ })).toBeNull()
    fireEvent.click(count)
    const strip = within(nav).getByTestId('hr-doc-cited-by')
    expect(strip.textContent).toContain('Section 2 · cited by 2 entries')
    const chip = within(strip).getByRole('button', { name: /Trip charge on the card/ })
    fireEvent.click(chip)
    expect((await screen.findByRole('tab', { name: /^Timeline/ })).getAttribute('aria-selected')).toBe('true')
    vi.useRealTimers()
  })
})
