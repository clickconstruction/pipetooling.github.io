// @vitest-environment jsdom
/**
 * A matter's By theme view (v2.6588, punch list #269) over made-up documents, events and marks: the matter's record
 * becomes the lines, one theme holds its items with the counts, a press opens the item window with the document a
 * press away, Open on the matter hands the line back, Keep and Take it off… write through the themes io. Made-up
 * matters only.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { LegalTheme, LegalThemeMark } from '../../../lib/legal/legalThemes'
import type { LegalEntryRow } from '../../../lib/legal/legalMatters'
import type { LegalMatterDocumentRow } from '../../../lib/legal/legalMatterDocumentsIo'
import { renderWithProviders } from '../../../test/renderSmokeMocks'
import { MatterThemesView } from './MatterThemesView'

const io = vi.hoisted(() => ({ keepMark: vi.fn(async () => ({ ok: true as const })), removeMark: vi.fn(async () => ({ ok: true as const })), authUserIdNow: vi.fn(async () => 'u1') }))
vi.mock('../../../lib/legal/legalThemesIo', () => ({ keepMark: io.keepMark, removeMark: io.removeMark, authUserIdNow: io.authUserIdNow }))

const theme = (id: string, name: string): LegalTheme => ({ id, name, what_counts: 'What counts here.', counsel_words: '', created_by: null, created_at: '2026-11-05T00:00:00Z', updated_at: '2026-11-05T00:00:00Z', retired_at: null, retired_by: null, proposed_by_agent: false, kept_at: null })
const mark = (over: Partial<LegalThemeMark>): LegalThemeMark => ({ id: 'm', theme_id: 't1', target_kind: 'matter_entry', target_id: 'e', person_id: null, matter_id: 'm1', why: '', proves_by: null, marked_by: 'u1', marked_at: '2026-11-05T00:00:00Z', author_label: null, proposed: false, kept_at: '2026-11-05T00:00:00Z', kept_by: 'u1', removed_at: null, removed_by: null, removed_why: '', ...over })
const entry = (id: string, kind: string, on: string, body: string, meta: unknown = null): LegalEntryRow => ({ id, matter_id: 'm1', kind, amount: null, body, occurred_on: on, meta, via_portal: false, created_by: 'u1', acknowledged_at: null, created_at: `${on}T15:00:00Z`, voided_at: null })
const doc = (id: string, title: string, dated: string | null): LegalMatterDocumentRow => ({ id, matter_id: 'm1', title, shows: `${title}: what it shows.`, storage_path: `m1/${id}.pdf`, mime: 'application/pdf', size_bytes: 10, original_name: `${id}.pdf`, added_by: 'u1', added_at: '2026-10-02T15:00:00Z', held_reason: '', voided_at: null, dated_on: dated, state: 'final', sent_on: null, sent_how: null, sent_to: null, proof_document_id: null, received_on: null, whose: null })

const THEMES = [theme('t1', 'Dishonesty'), theme('t2', 'Refusing instruction')]
const ENTRIES = [entry('e1', 'event', '2026-07-01', 'Said the truck was in the shop; the shop had no record.', { notes: 'Checked with the shop.', document_ids: ['d1'] }), entry('e2', 'plan', '2026-12-01', 'Send the demand.'), entry('e3', 'event', '2026-06-10', 'Told twice to stop; went anyway.')]
const DOCS = [doc('d1', 'Shop ledger', '2026-06-30'), doc('d2', 'Card statement', null)]
const MARKS = [
  mark({ id: 'm1', target_id: 'e1', proves_by: 'firsthand', why: 'the shop said so' }),
  mark({ id: 'm2', target_kind: 'matter_document', target_id: 'd1', proves_by: 'document' }),
  mark({ id: 'm3', theme_id: 't2', target_id: 'e3', proves_by: 'own_words', proposed: true, kept_at: null, kept_by: null }),
]

const acts = { onOpenDocument: vi.fn(), onOpenOnTimeline: vi.fn(), onMarksChanged: vi.fn() }

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('MatterThemesView', () => {
  it('turns the matter’s documents and entries into lines, holds one theme with its counts, and opens an item with its document a press away', () => {
    renderWithProviders(<MatterThemesView matterName="Ridgeway Builders" themes={THEMES} marks={MARKS} entries={ENTRIES} documents={DOCS} canWrite namesById={{ u1: 'Dana O.' }} {...acts} />)
    expect(screen.getByTestId('by-theme-pick-t1').textContent).toBe('Dishonesty · 2')
    expect(screen.getByTestId('by-theme-pick-t2').textContent).toBe('Refusing instruction · 1')
    expect(screen.getByTestId('by-theme-head').textContent).toBe('2 items · first Jun 30, 2026 · last Jul 1, 2026 · 2 with a file')
    const keys = () => Array.from(screen.getByTestId('by-theme-items').querySelectorAll('button[data-testid^="by-theme-item-"]')).map((b) => b.getAttribute('data-testid'))
    expect(keys()).toEqual(['by-theme-item-doc:d1', 'by-theme-item-entry:e1'])
    fireEvent.click(screen.getByTestId('by-theme-item-entry:e1'))
    const win = screen.getByTestId('by-theme-item-window')
    expect(within(win).getByTestId('by-theme-item-kicker').textContent).toBe('Dishonesty · item 2 of 2')
    expect(within(win).getByTestId('by-theme-item-body').textContent).toContain('Said the truck was in the shop')
    expect(within(win).getByTestId('by-theme-item-body').textContent).toContain('Checked with the shop.')
    fireEvent.click(within(win).getByTestId('matter-theme-file-d1'))
    expect(acts.onOpenDocument).toHaveBeenCalledWith('d1')
    fireEvent.click(within(win).getByRole('button', { name: 'Open on the matter ›' }))
    expect(acts.onOpenOnTimeline).toHaveBeenCalledWith(expect.objectContaining({ key: 'entry:e1', ref: { table: 'legal_matter_entries', id: 'e1' } }))
  })

  it('switches theme on a press, and keeps or takes off a mark through the themes io', async () => {
    renderWithProviders(<MatterThemesView matterName="Ridgeway Builders" themes={THEMES} marks={MARKS} entries={ENTRIES} documents={DOCS} canWrite namesById={{ u1: 'Dana O.' }} {...acts} />)
    fireEvent.click(screen.getByTestId('by-theme-pick-t2'))
    expect(screen.getByTestId('by-theme-pick-t2').getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('1 proposed by the agent, not yet kept')).toBeTruthy()
    fireEvent.click(screen.getByTestId('by-theme-item-entry:e3'))
    const win = screen.getByTestId('by-theme-item-window')
    fireEvent.click(within(win).getByRole('button', { name: 'Keep' }))
    await waitFor(() => expect(io.keepMark).toHaveBeenCalledWith('m3', 'u1'))
    expect(acts.onMarksChanged).toHaveBeenCalledTimes(1)
    fireEvent.click(within(win).getByRole('button', { name: 'Take it off…' }))
    fireEvent.change(within(win).getByPlaceholderText('Why is the theme coming off?'), { target: { value: 'Not his words.' } })
    fireEvent.click(within(win).getByRole('button', { name: 'Take it off' }))
    await waitFor(() => expect(io.removeMark).toHaveBeenCalledWith('m3', 'Not his words.', 'u1'))
    expect(acts.onMarksChanged).toHaveBeenCalledTimes(2)
  })

  it('says where the first theme is named when the catalog is empty', () => {
    renderWithProviders(<MatterThemesView matterName="Ridgeway Builders" themes={[]} marks={[]} entries={ENTRIES} documents={DOCS} canWrite namesById={{}} {...acts} />)
    expect(screen.getByText('No theme to read by yet.')).toBeTruthy()
  })
})
