// @vitest-environment jsdom
/**
 * Render smokes for SubmittalSheetStrip (Submittals stage 3a): the page
 * thumbnails with their row chips, tap a page → the row chooser (rows owing
 * a sheet first) → onAssign, a chip's × → onUnassign, a page on two rows
 * reads red with a keep-it-for door, the footer counts, Done / Remove.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'

import { SubmittalSheetStrip } from './SubmittalSheetStrip'
import type { SourceFile, SubmittalItemRow } from '../../lib/submittals/submittalRevision'

const item = (o: Partial<SubmittalItemRow>): SubmittalItemRow => ({
  id: 'x', submittal_id: 'rev-1', tag: 'X-1', sequence_order: 1, specified_manufacturer: null, specified_model: null, specified_description: null, submitted_manufacturer: null, submitted_model: null, submitted_label: null,
  supply_house_id: null, source_quote_line_id: null, status: 'alternate', reason_kind: null, reason_note: null, lead_time_days: null, sheet_file: null, sheet_pages: [], sheet_source: null, carried_from_item_id: null,
  review_decision: null, review_note: null, reviewed_by_name: null, reviewed_by_person_id: null, reviewed_by_email: null, reviewed_at: null, created_at: '', updated_at: '', ...o,
})
const items = [
  item({ id: 'it-wc', tag: 'WC-1', sheet_file: 0, sheet_pages: [1, 2], status: 'as_specified' }),
  item({ id: 'it-dwh', tag: 'DWH-1', status: 'alternate' }),
  item({ id: 'it-prv', tag: 'PRV-1', status: 'missing' }),
  item({ id: 'it-acc', tag: '', submitted_label: 'JOSAM 12704 CARRIER', status: 'accessory', sheet_file: 0, sheet_pages: [2] }),
]
const files: SourceFile[] = [{ path: 'b/r/0.pdf', houseId: null, houseName: 'NWS', name: 'NWS.pdf', pages: 4, trimmedAt: null, droppedPages: null }]
const thumbs = { 'b/r/0.pdf': ['data:1', 'data:2', 'data:3', 'data:4'] }

function mount(over: Partial<Parameters<typeof SubmittalSheetStrip>[0]> = {}) {
  const handlers = { onNeedThumbnails: vi.fn(), onAssign: vi.fn(), onUnassign: vi.fn(), onDone: vi.fn(), onRemove: vi.fn() }
  render(<SubmittalSheetStrip files={files} items={items} thumbnails={thumbs} busy={false} {...handlers} {...over} />)
  return handlers
}

describe('SubmittalSheetStrip', () => {
  it('draws the pages with their chips, flags the page on two rows, and counts the footer', () => {
    mount()
    expect(screen.getAllByRole('button', { name: /^Page \d$/ })).toHaveLength(4)
    expect(screen.getByText('2 rows')).toBeTruthy()
    expect(screen.getByTestId('conflicts').textContent).toMatch(/Page 2 is on 2 rows/)
    expect(screen.getByTestId('strip-footer').textContent).toBe('2 of 4 pages on rows · 2 not used')
    // Done is held while a page sits on two rows.
    expect((screen.getByRole('button', { name: 'Done with this file' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('tap a page, then a row — rows owing a sheet come first — and the page joins that row', () => {
    const h = mount()
    fireEvent.click(screen.getByRole('button', { name: 'Page 3' }))
    const chooser = screen.getByTestId('row-chooser')
    const names = within(chooser).getAllByRole('button').map((b) => b.textContent)
    expect(names[0]).toBe('DWH-1 · sheet needed')
    expect(names).not.toContain('PRV-1')
    fireEvent.click(within(chooser).getByRole('button', { name: 'DWH-1 · sheet needed' }))
    expect(h.onAssign).toHaveBeenCalledWith(0, 3, 'it-dwh')
    expect(screen.queryByTestId('row-chooser')).toBeNull()
  })

  it('a chip\'s × takes the page off; the conflict door keeps it for one row', () => {
    const h = mount()
    fireEvent.click(screen.getByRole('button', { name: 'WC-1 ×' }))
    expect(h.onUnassign).toHaveBeenCalledWith(0, 1, 'it-wc')
    fireEvent.click(within(screen.getByTestId('conflicts')).getByRole('button', { name: 'WC-1' }))
    expect(h.onUnassign).toHaveBeenCalledWith(0, 2, 'it-acc')
  })

  it('a file with nothing on rows offers Remove; a trimmed file reads what was let go; missing thumbnails ask', () => {
    const h = mount({ items: items.map((i) => ({ ...i, sheet_file: null, sheet_pages: [] })) })
    expect(screen.getByTestId('strip-footer').textContent).toBe('4 pages · none on rows yet')
    fireEvent.click(screen.getByRole('button', { name: 'Remove this file' }))
    expect(h.onRemove).toHaveBeenCalledWith(0)
    render(<SubmittalSheetStrip files={[{ ...files[0]!, path: 'b/r/1.pdf', pages: 2, trimmedAt: '2026-09-15T20:00:00Z', droppedPages: 24 }]} items={[]} thumbnails={{}} busy={false} onNeedThumbnails={h.onNeedThumbnails} onAssign={h.onAssign} onUnassign={h.onUnassign} onDone={h.onDone} onRemove={h.onRemove} />)
    expect(screen.getAllByTestId('strip-footer')[1]!.textContent).toMatch(/24 pages let go · Sep 15 · drop the file again if you need one/)
    fireEvent.click(screen.getByRole('button', { name: 'Show the pages' }))
    expect(h.onNeedThumbnails).toHaveBeenCalledWith(0)
    expect(screen.queryByRole('button', { name: 'Done with this file' })).toBeNull()
  })
})
