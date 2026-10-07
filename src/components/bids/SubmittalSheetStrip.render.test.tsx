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
  supply_house_id: null, source_quote_line_id: null, source_count_row_id: null, status: 'alternate', reason_kind: null, reason_note: null, lead_time_days: null, sheet_file: null, sheet_pages: [], sheet_source: null, carried_from_item_id: null, decision_source: 'room', decision_entered_by: null, decision_entered_by_name: null, order_only: false,
  review_decision: null, review_note: null, reviewed_by_name: null, reviewed_by_person_id: null, reviewed_by_email: null, reviewed_at: null, created_at: '', updated_at: '', ...o,
})
const items = [
  item({ id: 'it-wc', tag: 'WC-1', sheet_file: 0, sheet_pages: [1, 2], status: 'as_specified' }),
  item({ id: 'it-dwh', tag: 'DWH-1', status: 'alternate' }),
  item({ id: 'it-prv', tag: 'PRV-1', status: 'missing' }),
  item({ id: 'it-acc', tag: '', submitted_label: 'JOSAM 12704 CARRIER', status: 'accessory', sheet_file: 0, sheet_pages: [2] }),
]
const files: SourceFile[] = [{ path: 'b/r/0.pdf', houseId: null, houseName: 'NWS', name: 'NWS.pdf', pages: 4, trimmedAt: null, droppedPages: null, namesRows: null, sectioned: null }]
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
    expect(screen.getByTestId('strip-footer').textContent).toBe('2 of 4 pages on rows · 2 not used · tap a page, then the row it belongs to')
    expect(screen.getByTestId('file-standing').textContent).toBe('2 of 4 on rows · 2 not used · 1 page on two rows')
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

  it('one line per file: the standing beside the name, Remove quiet and last, Done only with something on rows; a trimmed file reads what was kept', () => {
    const h = mount({ items: items.map((i) => ({ ...i, sheet_file: null, sheet_pages: [] })) })
    expect(screen.getByTestId('file-standing').textContent).toBe('none on rows yet')
    expect(screen.getByTestId('strip-footer').textContent).toBe('4 pages · none on rows yet · tap a page, then the row it belongs to')
    expect(screen.queryByRole('button', { name: 'Done with this file' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    expect(h.onRemove).toHaveBeenCalledWith(0)
    render(<SubmittalSheetStrip files={[{ ...files[0]!, path: 'b/r/1.pdf', pages: 2, trimmedAt: '2026-09-15T20:00:00Z', droppedPages: 24 }]} items={[item({ id: 'k', tag: 'K-1', sheet_file: 0, sheet_pages: [1, 2] })]} thumbnails={{}} busy={false} onNeedThumbnails={h.onNeedThumbnails} onAssign={h.onAssign} onUnassign={h.onUnassign} onDone={h.onDone} onRemove={h.onRemove} />)
    expect(screen.getAllByTestId('file-standing')[1]!.textContent).toBe('trimmed · 2 pages kept · Sep 15')
    // a trimmed file has neither Done nor Remove
    expect(screen.getAllByRole('button', { name: 'Remove' })).toHaveLength(1)
  })

  it('v2.4579 · Save PDF saves the whole file: drawn only with a handler, named for the file, still there once trimmed', () => {
    mount()
    expect(screen.queryByTestId('save-file')).toBeNull()
    const onSaveFile = vi.fn()
    const h = mount({ onSaveFile })
    const save = screen.getByRole('button', { name: 'Save NWS.pdf as a PDF' })
    expect(save.textContent).toBe('Save PDF')
    expect(save.getAttribute('title')).toBe('Save the whole file as one PDF, all 4 pages as it was dropped')
    fireEvent.click(save)
    expect(onSaveFile).toHaveBeenCalledWith(0)
    render(<SubmittalSheetStrip files={[{ ...files[0]!, name: 'KEPT.pdf', path: 'b/r/1.pdf', pages: 2, trimmedAt: '2026-09-15T20:00:00Z', droppedPages: 24 }]} items={[item({ id: 'k', tag: 'K-1', sheet_file: 0, sheet_pages: [1, 2] })]} thumbnails={{}} busy={false} onNeedThumbnails={h.onNeedThumbnails} onAssign={h.onAssign} onUnassign={h.onUnassign} onDone={h.onDone} onRemove={h.onRemove} onSaveFile={onSaveFile} />)
    expect(screen.getByRole('button', { name: 'Save KEPT.pdf as a PDF' }).getAttribute('title')).toBe('Save the 2 pages kept from this file as one PDF')
  })

  it('the arrow folds the pages out and asks for thumbnails it does not have; a file the reader could not place says so', () => {
    const h = mount({ thumbnails: {}, files: [{ ...files[0]!, namesRows: 0 }], items: items.map((i) => ({ ...i, sheet_file: null, sheet_pages: [] })) })
    expect(screen.queryByTestId('file-fold')).toBeNull()
    expect(screen.getByTestId('file-hint').textContent).toBe('· no page names a row · not a vendor submittal?')
    fireEvent.click(screen.getByRole('button', { name: 'Show the pages' }))
    expect(h.onNeedThumbnails).toHaveBeenCalledWith(0)
    expect(screen.getByTestId('file-fold')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Hide the pages' }))
    expect(screen.queryByTestId('file-fold')).toBeNull()
  })

  it("6b · the robot's guesses draw as dashed chips (unsure marked ?), a tap on one assigns the page, Confirm and Ask sit on the file", () => {
    const onAssign = vi.fn()
    const onConfirm = vi.fn()
    const guesses = { 0: new Map([[1, { tag: 'WC-1', sure: true }], [2, { tag: 'DWH-1', sure: false }], [3, { tag: 'ZZ-9', sure: true }]]) }
    render(<SubmittalSheetStrip files={files} items={[item({ id: 'i-wc', tag: 'WC-1' }), item({ id: 'i-dwh', tag: 'DWH-1' })]} thumbnails={thumbs} busy={false} onNeedThumbnails={() => {}} onAssign={onAssign} onUnassign={() => {}} onDone={() => {}} onRemove={() => {}} guesses={guesses} robotLines={{ 0: 'robot · split the file by tag · ready · 2 pages matched to tags · 1 unsure' }} confirmLabels={{ 0: 'Confirm 2 · pick 1' }} onAskRobot={() => {}} onConfirmGuesses={onConfirm} />)
    const chips = screen.getAllByTestId('guess-chip')
    expect(chips.map((c) => c.textContent)).toEqual(['WC-1', 'DWH-1?', 'ZZ-9'])
    expect((chips[2] as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(chips[0]!)
    expect(onAssign).toHaveBeenCalledWith(0, 1, 'i-wc')
    expect(screen.getByTestId('robot-line').textContent).toContain('2 pages matched to tags')
    fireEvent.click(screen.getByTestId('confirm-guesses'))
    expect(onConfirm).toHaveBeenCalledWith(0)
    expect(screen.queryByRole('button', { name: 'Ask the robot to split this file' })).toBeNull()
  })

  it('2026-10-01 · Read its parts… leads on a house file with section stamps, sits beside Assign pages on an unread one, and is gone on a file that has none', () => {
    const onReadParts = vi.fn()
    const { unmount } = render(<SubmittalSheetStrip files={[{ ...files[0]!, sectioned: true }]} items={[]} thumbnails={{}} busy={false} onNeedThumbnails={() => {}} onAssign={() => {}} onUnassign={() => {}} onDone={() => {}} onRemove={() => {}} onAssignPages={() => {}} onReadParts={onReadParts} />)
    fireEvent.click(screen.getByTestId('read-parts-open'))
    expect(onReadParts).toHaveBeenCalledWith(0)
    expect((screen.getByTestId('read-parts-open') as HTMLElement).style.background).toBe('rgb(37, 99, 235)')
    unmount()
    const second = render(<SubmittalSheetStrip files={files} items={[]} thumbnails={{}} busy={false} onNeedThumbnails={() => {}} onAssign={() => {}} onUnassign={() => {}} onDone={() => {}} onRemove={() => {}} onAssignPages={() => {}} onReadParts={onReadParts} />)
    expect(screen.getByTestId('read-parts-open')).toBeTruthy()
    second.unmount()
    render(<SubmittalSheetStrip files={[{ ...files[0]!, sectioned: false }]} items={[]} thumbnails={{}} busy={false} onNeedThumbnails={() => {}} onAssign={() => {}} onUnassign={() => {}} onDone={() => {}} onRemove={() => {}} onAssignPages={() => {}} onReadParts={onReadParts} />)
    expect(screen.queryByTestId('read-parts-open')).toBeNull()
  })
})
