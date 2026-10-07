// @vitest-environment jsdom
/**
 * Assign pages (v2.4143) render smoke: the walk opens on page 1 with the row the page
 * names lit, Space confirms and moves on, X skips a page, the last page ends the walk
 * and Done hands the host the rows' writes. pdf.js is mocked: three pages of text. The
 * host re-rendering with fresh callbacks and rows opens the file no second time (v2.4192).
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

import { renderWithProviders } from '../../test/renderSmokeMocks'
import { SubmittalAssignPagesModal } from './SubmittalAssignPagesModal'
import type { SourceFile, SubmittalItemRow } from '../../lib/submittals/submittalRevision'

const { openPdfMock, destroyMock } = vi.hoisted(() => {
  const TEXTS = [
    'ZURN Z1700-500-OV WATER HAMMER ARRESTOR PDI size C sizing table and dimensions of the unit',
    'Terms and conditions of sale. Warranty. Freight. Returns are not accepted without authorization.',
    'TOTO CT708UVG elongated flushometer bowl, ADA height, submittal data sheet with rough-in',
  ]
  const destroyMock = vi.fn()
  const openPdfMock = vi.fn(async (_bytes: ArrayBuffer) => ({ numPages: 3, renderPage: async () => 'data:image/jpeg;base64,AAAA', pageText: async (p: number) => TEXTS[p - 1] ?? '', destroy: destroyMock }))
  return { openPdfMock, destroyMock }
})

vi.mock('../../lib/submittals/pdfThumbnails', () => ({
  openPdf: (bytes: ArrayBuffer) => openPdfMock(bytes),
}))

const item = (o: Partial<SubmittalItemRow>): SubmittalItemRow => ({
  id: 'x', submittal_id: 'rev-1', tag: 'X-1', sequence_order: 1, specified_manufacturer: null, specified_model: null, specified_description: null, submitted_manufacturer: null, submitted_model: null, submitted_label: null,
  supply_house_id: null, source_quote_line_id: null, source_count_row_id: null, status: 'alternate', reason_kind: null, reason_note: null, lead_time_days: null, sheet_file: null, sheet_pages: [], sheet_source: null, carried_from_item_id: null, decision_source: 'room', decision_entered_by: null, decision_entered_by_name: null, order_only: false,
  review_decision: null, review_note: null, reviewed_by_name: null, reviewed_by_person_id: null, reviewed_by_email: null, reviewed_at: null, created_at: '', updated_at: '', ...o,
})
const items = [
  item({ id: 'wha500', tag: 'WHA-500', submitted_model: 'Z1700-500-OV', submitted_label: 'Zurn Z1700-500-OV', status: 'as_specified' }),
  item({ id: 'wc1', tag: 'WC-1', submitted_model: 'CT708', submitted_label: 'TOTO CT708 bowl', status: 'as_specified' }),
]
const file: SourceFile = { path: 'b/r/0.pdf', houseId: null, houseName: 'NWS', name: 'NWS.pdf', pages: 3, trimmedAt: null, droppedPages: null, namesRows: null, sectioned: null }

describe('SubmittalAssignPagesModal', () => {
  it('walks the file: the read answer lit, Space and X decide, Done writes once every page is seen', async () => {
    const onDone = vi.fn()
    renderWithProviders(<SubmittalAssignPagesModal file={file} fileIndex={0} items={items} loadBytes={async () => new ArrayBuffer(8)} busy={false} onDone={onDone} onClose={() => undefined} />)
    // Page 1 names WHA-500 once the reader has the text.
    await waitFor(() => expect(screen.getByTestId('assign-banner').textContent).toContain('Looks like WHA-500'))
    expect(screen.getByTestId('assign-progress').textContent).toBe('1 of 3 seen · 0 on rows · 2 rows with nothing')
    expect(screen.getByTestId('assign-done').textContent).toBe('Done — 1 of 3 seen')
    expect((screen.getByTestId('assign-done') as HTMLButtonElement).disabled).toBe(true)
    const root = screen.getByTestId('assign-pages').firstElementChild as HTMLElement
    // Space: page 1 → WHA-500, on to page 2, which reads nothing and continues the run.
    fireEvent.keyDown(root, { key: ' ' })
    await waitFor(() => expect(screen.getByTestId('assign-banner').textContent).toContain('WHA-500 continues'))
    // X: page 2 is the terms page, not a cut sheet; page 3 names WC-1.
    fireEvent.keyDown(root, { key: 'x' })
    await waitFor(() => expect(screen.getByTestId('assign-banner').textContent).toContain('Looks like WC-1'))
    fireEvent.keyDown(root, { key: ' ' })
    await waitFor(() => expect(screen.getByTestId('assign-done').textContent).toBe('Done — put 2 pages on rows'))
    expect(screen.getByTestId('assign-progress').textContent).toBe('3 of 3 seen · 2 on rows · 1 not cut sheet')
    fireEvent.click(screen.getByTestId('assign-done'))
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1))
    expect(onDone.mock.calls[0]![0]).toEqual([
      { itemId: 'wha500', fileIndex: 0, pages: [1] },
      { itemId: 'wc1', fileIndex: 0, pages: [3] },
    ])
  })

  it('opens the file once: the host re-rendering with new callbacks and rows neither re-opens it nor reports the read again', async () => {
    openPdfMock.mockClear()
    destroyMock.mockClear()
    const onReads = vi.fn()
    const loadBytes = vi.fn(async () => new ArrayBuffer(8))
    const view = renderWithProviders(<SubmittalAssignPagesModal file={file} fileIndex={0} items={items} loadBytes={loadBytes} busy={false} onDone={() => undefined} onReads={onReads} onClose={() => undefined} />)
    await waitFor(() => expect(onReads).toHaveBeenCalledTimes(1))
    expect(onReads).toHaveBeenCalledWith({ namesRows: 2, sectioned: false })
    expect(screen.getByTestId('assign-banner').textContent).toContain('Looks like WHA-500')
    // The tab reloads after the read lands: new callback identities, a new rows array, the same file.
    view.rerender(<SubmittalAssignPagesModal file={{ ...file, namesRows: 2, sectioned: false }} fileIndex={0} items={items.map((i) => ({ ...i }))} loadBytes={async () => new ArrayBuffer(8)} busy={false} onDone={() => undefined} onReads={(r) => onReads(r)} onClose={() => undefined} />)
    view.rerender(<SubmittalAssignPagesModal file={{ ...file, namesRows: 2, sectioned: false }} fileIndex={0} items={items.map((i) => ({ ...i }))} loadBytes={async () => new ArrayBuffer(8)} busy={false} onDone={() => undefined} onReads={(r) => onReads(r)} onClose={() => undefined} />)
    await waitFor(() => expect(screen.getByTestId('assign-progress').textContent).toContain('1 of 3 seen'))
    expect(loadBytes).toHaveBeenCalledTimes(1)
    expect(openPdfMock).toHaveBeenCalledTimes(1)
    expect(destroyMock).not.toHaveBeenCalled()
    expect(onReads).toHaveBeenCalledTimes(1)
    // Unmounting closes the document exactly once.
    view.unmount()
    expect(destroyMock).toHaveBeenCalledTimes(1)
  })

  it('Backspace undoes the last pick and steps back; typing finds a row and Enter picks it', async () => {
    renderWithProviders(<SubmittalAssignPagesModal file={file} fileIndex={0} items={items} loadBytes={async () => new ArrayBuffer(8)} busy={false} onDone={() => undefined} onClose={() => undefined} />)
    await waitFor(() => expect(screen.getByTestId('assign-banner').textContent).toContain('Looks like WHA-500'))
    const root = screen.getByTestId('assign-pages').firstElementChild as HTMLElement
    fireEvent.keyDown(root, { key: ' ' })
    await waitFor(() => expect(screen.getByTestId('assign-progress').textContent).toContain('1 on rows'))
    fireEvent.keyDown(root, { key: 'Backspace' })
    await waitFor(() => expect(screen.getByTestId('assign-progress').textContent).toContain('0 on rows'))
    expect(screen.getByTestId('assign-banner').textContent).toContain('Looks like WHA-500')
    // Type "wc" → the list narrows to WC-1; Enter puts page 1 on it.
    fireEvent.keyDown(root, { key: 'w' })
    fireEvent.keyDown(root, { key: 'c' })
    await waitFor(() => expect(screen.getAllByTestId('assign-row')).toHaveLength(1))
    expect(screen.getByTestId('assign-filter').textContent).toBe('wc')
    fireEvent.keyDown(root, { key: 'Enter' })
    await waitFor(() => expect(screen.getAllByTestId('assign-row')).toHaveLength(2))
    expect(screen.getAllByTestId('assign-row')[1]!.textContent).toContain('p. 1')
  })
})
