// @vitest-environment jsdom
/**
 * The matter's By theme view (v2.6599, punch list #269 T2b's remainder) over made-up documents, events and marks: one
 * theme at a time with the counts, a document and an event as its items, the item window with the paper's chip, and
 * Open on the Timeline landing a paper on Evidence and an event on the Timeline; Keep writes through the themes io.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'

const io = vi.hoisted(() => ({
  keepMark: vi.fn(async () => ({ ok: true as const })),
  removeMark: vi.fn(async () => ({ ok: true as const })),
  openLegalMatterDocument: vi.fn(async () => undefined),
}))
vi.mock('../../../lib/supabase', () => ({ supabase: {} }))
vi.mock('../../../lib/legal/legalThemesIo', () => ({ keepMark: io.keepMark, removeMark: io.removeMark, authUserIdNow: vi.fn(async () => 'u-dev') }))
vi.mock('../../../lib/legal/legalMatterDocumentsIo', () => ({ openLegalMatterDocument: io.openLegalMatterDocument }))

import { MatterThemesView } from './MatterThemesView'
import type { LegalMatterDocumentRow } from '../../../lib/legal/legalMatterDocumentsIo'
import type { LegalTimelineItem } from '../../../lib/legal/legalTimeline'
import type { LegalTheme, LegalThemeMark } from '../../../lib/legal/legalThemes'
import { renderWithProviders } from '../../../test/renderSmokeMocks'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const theme = (id: string, name: string): LegalTheme => ({ id, name, what_counts: `What counts for ${name}.`, counsel_words: '', created_by: null, created_at: '2026-11-05T00:00:00Z', updated_at: '2026-11-05T00:00:00Z', retired_at: null, retired_by: null, proposed_by_agent: false, kept_at: null })
const mark = (over: Partial<LegalThemeMark>): LegalThemeMark => ({ id: 'm', theme_id: 't1', target_kind: 'matter_document', target_id: 'd1', person_id: null, matter_id: 'm-1', why: '', proves_by: null, marked_by: 'u-dev', author_label: null, marked_at: '2026-11-06T12:00:00Z', proposed: false, kept_at: '2026-11-06T12:00:00Z', kept_by: 'u-dev', removed_at: null, removed_by: null, removed_why: '', ...over })
const item = (over: Partial<LegalTimelineItem>): LegalTimelineItem => ({
  key: 'k', lane: 'did', ymd: '2026-10-01', kind: 'event', entryKind: 'event', entryId: null, documentId: null, what: 'x', kindWords: '', notes: '', amount: null,
  byName: 'the office', source: 'office', viaPortal: false, state: 'happened', stateWords: '', plannedYmd: null, doneYmd: null, held: false, heldReason: '', voided: false, voidReason: '',
  isLivePlan: false, documents: [], serves: null, deadlineKey: null, deadlineJobId: null, documentChip: '', ...over,
})
const doc = (id: string, title: string): LegalMatterDocumentRow => ({ id, matter_id: 'm-1', title, shows: `What ${title} shows.`, storage_path: `m-1/${id}.md`, mime: 'text/plain', size_bytes: 10, original_name: `${id}.md`, added_by: null, added_at: '2026-09-08T12:00:00Z', held_reason: '', voided_at: null, dated_on: '2026-09-08', state: 'final', sent_on: null, sent_how: '', sent_to: '', proof_document_id: null, received_on: null, whose: null })

const THEMES = [theme('t1', 'Dishonesty'), theme('t2', 'Interference with the business')]
const DOCS = [doc('d1', 'Mailbox review')]
const TIMELINE = {
  past: [
    item({ key: 'doc:d1', lane: 'paper', ymd: '2026-09-08', kind: 'document', documentId: 'd1', what: 'Mailbox review', notes: 'What the export shows.', documentChip: 'final' }),
    item({ key: 'entry:e1', ymd: '2026-10-05', kind: 'event', entryId: 'e1', what: 'Dana writes to Jordan about the new company.', kindWords: 'event', documents: [{ id: 'd1', title: 'Mailbox review', held: false }] }),
  ],
  today: [],
  upcoming: [],
}
const MARKS = [
  mark({ id: 'm1', target_kind: 'matter_document', target_id: 'd1', proves_by: 'document', why: 'the waivers are in it' }),
  mark({ id: 'm2', target_kind: 'matter_entry', target_id: 'e1', proves_by: 'relayed', proposed: true, kept_at: null, kept_by: null }),
  mark({ id: 'm3', theme_id: 't2', target_kind: 'matter_entry', target_id: 'e1', proves_by: 'document' }),
]

function draw(over: Partial<Parameters<typeof MatterThemesView>[0]> = {}) {
  const onOpen = vi.fn()
  const onChanged = vi.fn(async () => undefined)
  renderWithProviders(<MatterThemesView matterName="The matter on Jordan Vale" themes={THEMES} marks={MARKS} timeline={TIMELINE} documents={DOCS} canWrite onOpenOnTimeline={onOpen} onMarksChanged={onChanged} {...over} />)
  return { onOpen, onChanged }
}

describe('MatterThemesView (v2.6599)', () => {
  it('reads the matter one theme at a time: the document and the event as items, the counts, the proposed one dashed', () => {
    draw()
    expect(screen.getByTestId('by-theme-pick-t1').textContent).toBe('Dishonesty · 2')
    expect(screen.getByTestId('by-theme-pick-t2').textContent).toBe('Interference with the business · 1')
    expect(screen.getByTestId('by-theme-head').textContent).toBe('2 items · first Sep 8, 2026 · last Oct 5, 2026 · 2 with a file')
    expect(screen.getByText('1 proposed by the agent, not yet kept')).toBeTruthy()
    const keys = Array.from(screen.getByTestId('by-theme-items').querySelectorAll('button[data-testid^="by-theme-item-"]')).map((b) => b.getAttribute('data-testid'))
    expect(keys).toEqual(['by-theme-item-document:d1', 'by-theme-item-entry:e1'])
    expect(screen.getByTestId('by-theme-item-document:d1').textContent).toContain('document · final')
  })

  it('opens an item in the window with the paper as a chip, and Open on the Timeline lands a paper on Evidence and an event on the Timeline', async () => {
    const { onOpen } = draw()
    fireEvent.click(screen.getByTestId('by-theme-item-entry:e1'))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByTestId('by-theme-item-kicker').textContent).toBe('Dishonesty · item 2 of 2')
    expect(within(dialog).getByTestId('by-theme-item-body').textContent).toContain('Dana writes to Jordan')
    fireEvent.click(within(dialog).getByTestId('matter-theme-file-d1'))
    await waitFor(() => expect(io.openLegalMatterDocument).toHaveBeenCalledTimes(1))
    fireEvent.click(within(dialog).getByTestId('by-theme-open-timeline'))
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ key: 'entry:e1', entryId: 'e1' }), 'timeline')
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    fireEvent.click(screen.getByTestId('by-theme-item-document:d1'))
    fireEvent.click(within(await screen.findByRole('dialog')).getByTestId('by-theme-open-timeline'))
    expect(onOpen).toHaveBeenLastCalledWith(expect.objectContaining({ key: 'document:d1', documentId: 'd1' }), 'evidence')
  })

  it('Keep on a proposed mark writes through the themes io and asks the surface to read again', async () => {
    const { onChanged } = draw()
    fireEvent.click(screen.getByTestId('by-theme-item-entry:e1'))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Keep' }))
    await waitFor(() => expect(io.keepMark).toHaveBeenCalledWith('m2', 'u-dev'))
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1))
  })
})
