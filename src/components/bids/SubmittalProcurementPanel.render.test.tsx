// @vitest-environment jsdom
/**
 * Render smoke for the procurement log panel (v2.4083): the rows built from the
 * submittal items + the stored records + the job's stage windows, the derived
 * released / expected / required / float, an order date landing as an insert,
 * and Send update recording a snapshot with the changes.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { SubmittalProcurementPanel } from './SubmittalProcurementPanel'
import type { ProcurementItemSource } from '../../lib/submittals/procurementLog'

const writes: Array<{ table: string; op: string; payload: unknown }> = []
const state: { records: Array<Record<string, unknown>>; updates: Array<Record<string, unknown>> } = {
  records: [{ id: 'p1', bid_id: 'b1', tag: 'BFP-1', label: '', lead_time_days: null, stage: null, ordered_on: '2026-09-25', po_ref: '119', expected_on: '2026-10-20', delivered_on: null, note: 'Ferguson: 10/20 earliest', sort_order: 0, created_at: '', updated_at: '' }],
  updates: [],
}
vi.mock('../../lib/bidDocuments/htmlDoc', async (orig) => ({ ...(await orig<typeof import('../../lib/bidDocuments/htmlDoc')>()), printHtmlInNewWindow: vi.fn() }))
const opened: string[] = []
vi.mock('../../lib/openInExternalBrowser', () => ({ openInExternalBrowser: (url: string) => { opened.push(url) } }))
vi.mock('../../lib/supabase', () => {
  const answer = (table: string) => {
    if (table === 'bid_procurement_items') return state.records
    if (table === 'bid_procurement_updates') return state.updates
    if (table === 'bids_count_rows') return [{ id: 'c1', fixture: 'WH-1 - WATER HEATER' }, { id: 'c2', fixture: 'BFP - BACKFLOW PREVENTER' }]
    if (table === 'bid_takeoff_stage_splits') return [{ id: 's1', bid_id: 'b1', count_row_id: 'c1', line_id: null, part_id: null, rough_in: 0, top_out: 0, trim_set: 1, source: 'hand' }, { id: 's2', bid_id: 'b1', count_row_id: 'c2', line_id: null, part_id: null, rough_in: 1, top_out: 0, trim_set: 0, source: 'rule' }]
    if (table === 'jobs_ledger') return { id: 'j1' }
    if (table === 'jobs_ledger_fixtures') return [{ id: 'f1', name: 'Rough-in', stage_kind: 'order' }, { id: 'f3', name: 'Trim', stage_kind: 'order' }]
    if (table === 'job_stage_windows') return [{ fixture_id: 'f1', window_start: '2026-10-06' }, { fixture_id: 'f3', window_start: '2026-11-17' }]
    if (table === 'supply_houses') return []
    return []
  }
  const builder = (table: string, op: string, payload?: unknown) => {
    const b: Record<string, unknown> = {}
    const chain = () => b
    for (const m of ['eq', 'in', 'order', 'limit', 'select']) b[m] = chain
    b.maybeSingle = () => ({ then: (res: (v: unknown) => void) => res({ data: answer(table), error: null }) })
    b.then = (res: (v: unknown) => void) => {
      if (op !== 'select') {
        writes.push({ table, op, payload })
        if (op === 'insert' && table === 'bid_procurement_items') state.records = [...state.records, { id: 'p2', bid_id: 'b1', tag: 'WH-1', label: '', lead_time_days: null, stage: null, ordered_on: '2026-09-24', po_ref: '', expected_on: null, delivered_on: null, note: '', sort_order: 1, created_at: '', updated_at: '' }]
        if (op === 'insert' && table === 'bid_procurement_updates') state.updates = [{ id: 'u1', sent_at: '2026-09-28T18:00:00Z', sent_by_name: 'Wendi', sent_to: 'Dana W.', line: 'hello', rows: (payload as { rows: unknown }).rows, changes: (payload as { changes: unknown }).changes }]
        res({ data: null, error: null })
        return
      }
      res({ data: answer(table), error: null })
    }
    return b
  }
  return {
    supabase: {
      from: (table: string) => ({
        select: () => builder(table, 'select'),
        insert: (payload: unknown) => builder(table, 'insert', payload),
        update: (payload: unknown) => builder(table, 'update', payload),
        delete: () => builder(table, 'delete'),
      }),
    },
  }
})

const items: ProcurementItemSource[] = [
  { tag: 'WH-1', product: 'A.O. Smith BTH-199', supplyHouse: null, leadTimeDays: 42, decision: { kind: 'approved', at: '2026-09-22T15:00:00Z' }, shared: true },
  { tag: 'BFP-1', product: 'Watts 909 RPZ 2"', supplyHouse: null, leadTimeDays: 28, decision: { kind: 'approved', at: '2026-09-22T15:00:00Z' }, shared: true },
]

describe('SubmittalProcurementPanel', () => {
  it('builds the log from the rows, the records and the job, derives the float, and records an update with its changes', async () => {
    renderWithProviders(<SubmittalProcurementPanel bidId="b1" bidLabel="B482 Shipley" companyName="Click" items={items} reviewerNames={['Dana W.']} currentUser={{ id: 'u', name: 'Wendi' }} />)
    await waitFor(() => expect(screen.getByTestId('procurement-headline').textContent).toBe('2 released · 1 ordered · 0 delivered · 1 behind schedule'))
    const rows = screen.getAllByTestId('procurement-row')
    expect(rows).toHaveLength(2)
    // BFP-1: released 09/22 from the approval, the house's 10/20 against Rough In 10/06 → 14 days behind.
    // v2.4238 · the tag and the product are one Item cell, with the stage on the line under them.
    expect(rows[0]!.querySelector('[data-testid="procurement-item"]')!.textContent).toBe('BFP-1Watts 909 RPZ 2"Rough In')
    expect(rows[0]!.textContent).toContain('Approved 09/22')
    expect(rows[0]!.textContent).toContain('house said')
    expect(rows[0]!.querySelector('[data-testid="procurement-float"]')!.textContent).toBe('−14 d')
    // WH-1: released, unordered, trim set 11/17, 6 wk → order by 10/06.
    expect(rows[1]!.querySelector('[data-testid="procurement-float"]')!.textContent).toBe('order by 10/06')
    expect(screen.getByText(/Required dates from the job/)).toBeTruthy()

    // An order date on WH-1 inserts its record (no row yet) and the float follows.
    fireEvent.change(screen.getByLabelText('WH-1 ordered on'), { target: { value: '2026-09-24' } })
    await waitFor(() => expect(writes.some((w) => w.table === 'bid_procurement_items' && w.op === 'insert')).toBe(true))
    expect(writes.find((w) => w.op === 'insert')!.payload).toMatchObject({ bid_id: 'b1', tag: 'WH-1', ordered_on: '2026-09-24' })
    await waitFor(() => expect(screen.getAllByTestId('procurement-float')[1]!.textContent).toBe('12 d'))

    // Send update: the changes list names both rows (first update), To is prefilled with the reviewer, the record carries the snapshot.
    fireEvent.click(screen.getByTestId('procurement-send'))
    expect(screen.getByTestId('procurement-changes').textContent).toContain('BFP-1')
    expect((screen.getByPlaceholderText('who gets it (for the record)') as HTMLInputElement).value).toBe('Dana W.')
    fireEvent.change(screen.getByLabelText('A line for the GC'), { target: { value: 'hello' } })
    fireEvent.click(screen.getByTestId('procurement-record'))
    await waitFor(() => expect(writes.some((w) => w.table === 'bid_procurement_updates')).toBe(true))
    const upd = writes.find((w) => w.table === 'bid_procurement_updates')!.payload as { rows: Array<{ tag: string }>; changes: unknown[]; line: string; sent_to: string }
    expect(upd.rows.map((r) => r.tag)).toEqual(['BFP-1', 'WH-1'])
    expect(upd.changes).toHaveLength(2)
    expect(upd.line).toBe('hello')
    await waitFor(() => expect(screen.getByText(/last update 09\/28 to Dana W\./)).toBeTruthy())
  })

  it('v2.4113 · Download CSV saves the log as a file and Open in Google Sheets copies tab-separated rows then opens a new sheet', async () => {
    const written: string[] = []
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: (t: string) => { written.push(t); return Promise.resolve() } }, configurable: true })
    const urls: string[] = []
    const realCreate = URL.createObjectURL
    const realRevoke = URL.revokeObjectURL
    URL.createObjectURL = (b: Blob) => { urls.push(`blob:${b.type}:${b.size}`); return 'blob:x' }
    URL.revokeObjectURL = () => {}
    const clicks: string[] = []
    const realClick = HTMLAnchorElement.prototype.click
    HTMLAnchorElement.prototype.click = function () { clicks.push(this.download) }
    try {
      renderWithProviders(<SubmittalProcurementPanel bidId="b1" bidLabel="B482 Shipley" companyName="Click" items={items} reviewerNames={['Dana W.']} currentUser={{ id: 'u', name: 'Wendi' }} />)
      await waitFor(() => expect(screen.getAllByTestId('procurement-row')).toHaveLength(2))
      fireEvent.click(screen.getByTestId('procurement-csv'))
      expect(urls).toEqual([expect.stringMatching(/^blob:text\/csv;charset=utf-8:\d+$/)])
      expect(clicks).toEqual([expect.stringMatching(/^procurement-log_B482-Shipley_\d{4}-\d{2}-\d{2}\.csv$/)])
      fireEvent.click(screen.getByTestId('procurement-sheets'))
      await waitFor(() => expect(written).toHaveLength(1))
      const lines = written[0]!.split('\n')
      expect(lines[0]).toBe('Tag\tProduct\tSupply house\tStage\tSubmittal\tReleased\tOrdered\tPO\tLead time\tExpected\tExpected from\tRequired\tFloat\tDelivered\tNote')
      expect(lines[1]).toContain('BFP-1\tWatts 909 RPZ 2"\t\tRough-in\tApproved 09/22\t2026-09-22\t')
      expect(opened).toEqual(['https://sheets.new'])
      await waitFor(() => expect(screen.getByText(/Log copied — a new Google Sheet is opening/)).toBeTruthy())
    } finally {
      URL.createObjectURL = realCreate
      URL.revokeObjectURL = realRevoke
      HTMLAnchorElement.prototype.click = realClick
    }
  })
})
