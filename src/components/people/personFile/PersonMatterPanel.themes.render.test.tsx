// @vitest-environment jsdom
/**
 * The HR file's Matter view and its themes (v2.6588, punch list #269) over a fake supabase: the By theme sub tab draws
 * for a dev once the catalog has a theme, with the count of things marked, and opens the matter's view; Record what
 * happened carries the picker and writes its marks after the event stands; the office sees neither. Made-up people only.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { LegalTheme, LegalThemeMark } from '../../../lib/legal/legalThemes'
import { renderWithProviders } from '../../../test/renderSmokeMocks'
import { PersonMatterPanel } from './PersonMatterPanel'

const MATTER = { id: 'm1', payer_key: 'p:p-marcus', customer_id: null, payer_name: 'Marcus Reed', kind: 'person', person_id: 'p-marcus', firm_id: null, stage: 'review', ready_marked_by: null, ready_marked_at: null, released_at: null, handling_name: '', note_to_firm: '', review_requested_by: null, review_requested_at: null, review_request_note: '', held_overrides: null, fees_to_statement: false, closed_at: null, closed_reason: '', updated_at: '2026-11-05T22:00:00Z', narrative_md: '', narrative_updated_at: null }
const EVENT = { id: 'e1', matter_id: 'm1', kind: 'event', amount: null, body: 'Said the truck was in the shop.', occurred_on: '2026-07-01', meta: { notes: '', document_ids: [], source: 'office' }, via_portal: false, created_by: 'u1', acknowledged_at: null, created_at: '2026-07-01T15:00:00Z', voided_at: null }

const TABLE_ROWS: Record<string, unknown[]> = {
  legal_matters: [MATTER],
  legal_matter_entries: [EVENT],
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
  return { supabase: { from: (table: string) => makeBuilder(TABLE_ROWS[table] ?? []), rpc: () => Promise.resolve({ data: null, error: null }), auth: { getUser: () => Promise.resolve({ data: { user: { id: 'u1' } } }) }, storage: { from: () => ({ upload: () => Promise.resolve({ error: null }), createSignedUrl: () => Promise.resolve({ data: { signedUrl: 'x' }, error: null }) }) } } }
})
vi.mock('../../../hooks/useLegalMatters', () => ({
  legalRpc: vi.fn(async () => null),
  legalRpcData: vi.fn(async () => ({ error: null, data: { ok: true, entry_id: 'e-new' } })),
}))

const theme = (id: string, name: string): LegalTheme => ({ id, name, what_counts: 'What counts here.', counsel_words: '', created_by: null, created_at: '2026-11-05T00:00:00Z', updated_at: '2026-11-05T00:00:00Z', retired_at: null, retired_by: null, proposed_by_agent: false, kept_at: null })
const mark = (over: Partial<LegalThemeMark>): LegalThemeMark => ({ id: 'm', theme_id: 't1', target_kind: 'matter_entry', target_id: 'e1', person_id: null, matter_id: 'm1', why: 'the shop said so', proves_by: 'firsthand', marked_by: 'u1', marked_at: '2026-11-05T00:00:00Z', author_label: null, proposed: false, kept_at: '2026-11-05T00:00:00Z', kept_by: 'u1', removed_at: null, removed_by: null, removed_why: '', ...over })

const io = vi.hoisted(() => ({
  catalog: { themes: [] as unknown[], marks: [] as unknown[] },
  loadThemes: vi.fn(async () => ({ themes: io.catalog.themes, marks: io.catalog.marks, heldWhy: null })),
  addMarks: vi.fn(async () => ({ ok: true as const, made: 1, already: 0, failWhy: null })),
  keepMark: vi.fn(async () => ({ ok: true as const })),
  removeMark: vi.fn(async () => ({ ok: true as const })),
  authUserIdNow: vi.fn(async () => 'u1'),
}))
vi.mock('../../../lib/legal/legalThemesIo', () => ({ loadThemes: io.loadThemes, addMarks: io.addMarks, keepMark: io.keepMark, removeMark: io.removeMark, authUserIdNow: io.authUserIdNow }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  io.catalog = { themes: [], marks: [] }
})

describe('PersonMatterPanel · themes', () => {
  it('draws By theme for a dev once the catalog has a theme, with the count of things marked, and opens the matter’s view', async () => {
    io.catalog = { themes: [theme('t1', 'Dishonesty')], marks: [mark({ id: 'm1' })] }
    renderWithProviders(<PersonMatterPanel personId="p-marcus" personName="Marcus Reed" canEdit namesById={{ u1: 'Dana O.' }} />)
    const tab = await screen.findByTestId('person-matter-tab-themes')
    expect(tab.textContent).toBe('By theme (1)')
    fireEvent.click(tab)
    expect(await screen.findByTestId('matter-themes-view')).toBeTruthy()
    expect(screen.getByTestId('by-theme-pick-t1').textContent).toBe('Dishonesty · 1')
    fireEvent.click(screen.getByTestId('by-theme-item-entry:e1'))
    const win = screen.getByTestId('by-theme-item-window')
    expect(within(win).getByTestId('by-theme-item-body').textContent).toContain('Said the truck was in the shop.')
    expect(within(win).getByText(/Dana O\./)).toBeTruthy()
    fireEvent.click(within(win).getByRole('button', { name: 'Open on the matter ›' }))
    expect(screen.getByTestId('person-matter-tab-timeline').getAttribute('aria-selected')).toBe('true')
  })

  it('Record what happened carries the picker and writes the marks after the event stands', async () => {
    io.catalog = { themes: [theme('t1', 'Dishonesty')], marks: [] }
    renderWithProviders(<PersonMatterPanel personId="p-marcus" personName="Marcus Reed" canEdit />)
    fireEvent.click(await screen.findByTestId('person-matter-tab-timeline'))
    fireEvent.click(await screen.findByRole('button', { name: /Add to the timeline/ }))
    const form = document.querySelector('[data-legal-composer]') as HTMLElement
    const picker = within(form).getByTestId('event-theme-picker')
    fireEvent.change(within(form).getByLabelText('What happened'), { target: { value: 'Card charges on a day with no job.' } })
    fireEvent.click(within(picker).getByTestId('theme-pick-t1'))
    fireEvent.change(within(picker).getByTestId('theme-mark-why'), { target: { value: 'no job that day' } })
    fireEvent.click(within(picker).getByTestId('theme-proves-document'))
    fireEvent.submit(form)
    await waitFor(() => expect(io.addMarks).toHaveBeenCalledTimes(1))
    expect(io.addMarks).toHaveBeenCalledWith(expect.objectContaining({ themeIds: ['t1'], targets: [{ kind: 'matter_entry', id: 'e-new' }], matterId: 'm1', personId: null, why: 'no job that day', provesBy: 'document', authUserId: 'u1' }))
    expect(await screen.findByText('Dishonesty marked on 1 event.')).toBeTruthy()
  })

  it('draws no By theme tab while the catalog is empty, and reads no themes for the office', async () => {
    io.catalog = { themes: [], marks: [] }
    renderWithProviders(<PersonMatterPanel personId="p-marcus" personName="Marcus Reed" canEdit />)
    await screen.findByTestId('person-matter-tab-timeline')
    expect(screen.queryByTestId('person-matter-tab-themes')).toBeNull()
    cleanup()
    renderWithProviders(<PersonMatterPanel personId="p-marcus" personName="Marcus Reed" canEdit={false} />)
    await screen.findByTestId('person-matter-tab-timeline')
    expect(io.loadThemes).toHaveBeenCalledTimes(1)
  })
})
