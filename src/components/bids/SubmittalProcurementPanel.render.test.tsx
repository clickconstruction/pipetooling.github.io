// @vitest-environment jsdom
/**
 * Render smoke for the procurement log panel (v2.4083): the rows built from the
 * submittal items + the stored records + the job's stage windows, the derived
 * released / expected / required / float, an order date landing as an insert,
 * and Send update recording a snapshot with the changes.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
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

/** The calendar's date input beside a date box (the box itself is a text box that takes "9/23"). */
const pickOf = (label: string) => screen.getByLabelText(label).parentElement!.querySelector('[data-testid="procurement-date-pick"]') as HTMLInputElement

describe('SubmittalProcurementPanel', () => {
  // These read the log in tag order; the To order lens (2026-10-01) has its own case below.
  beforeEach(() => localStorage.setItem('submittals_procure_lens', 'by_tag'))
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
    // Each date box reads a month and a day (a year only when it has to be said); under it, how far it is from today; the house's date says so first.
    const boxes = [...rows[0]!.querySelectorAll<HTMLInputElement>('input.procurement-date')]
    expect(boxes.map((b) => b.type)).toEqual(['text', 'text', 'text'])
    expect(boxes.map((b) => b.value.slice(0, 5))).toEqual(['09/25', '10/20', ''])
    expect(boxes[2]!.placeholder).toBe('mm/dd')
    const under = [...rows[0]!.querySelectorAll('[data-testid="procurement-date-under"]')].map((n) => n.textContent ?? '')
    expect(under).toHaveLength(3)
    expect(under[0]).toMatch(/^(today|\d+ days? ago|in \d+ days?)$/)
    expect(under[1]).toBe('house said')
    expect(under[2]).toMatch(/^(today|\d+ days? ago|in \d+ days?)$/)
    // The calendar's own date input lies beside each box, holding the whole date.
    expect(pickOf('BFP-1 ordered on').value).toBe('2026-09-25')
    expect(rows[0]!.querySelector('[data-testid="procurement-float"]')!.textContent).toBe('−14 d')
    // WH-1: released, unordered, trim set 11/17, 6 wk → order by 10/06.
    expect(rows[1]!.querySelector('[data-testid="procurement-float"]')!.textContent).toBe('order by 10/06')
    expect(screen.getByText(/Required dates from the job/)).toBeTruthy()

    // An order date on WH-1 (picked from the calendar) inserts its record (no row yet) and the float follows.
    fireEvent.change(pickOf('WH-1 ordered on'), { target: { value: '2026-09-24' } })
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

  it('a date box takes a typed month and day and saves when it is left; a pick from the calendar saves at once; what does not read as a date is never written', async () => {
    renderWithProviders(<SubmittalProcurementPanel bidId="b1" bidLabel="B482 Shipley" companyName="Click" items={items} reviewerNames={['Dana W.']} currentUser={{ id: 'u', name: 'Wendi' }} />)
    await waitFor(() => expect(screen.getAllByTestId('procurement-row')).toHaveLength(2))
    writes.length = 0
    const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 0)) })
    const floatOf = (i: number) => screen.getAllByTestId('procurement-float')[i]!.textContent
    const itemWrites = () => writes.filter((w) => w.table === 'bid_procurement_items')

    // Typed: nothing is written while the date is being typed — not at "9/1", not at the whole date — then once when the box is left.
    const ordered = screen.getByLabelText('BFP-1 ordered on') as HTMLInputElement
    fireEvent.change(ordered, { target: { value: '9/1' } })
    fireEvent.change(ordered, { target: { value: '9/15/26' } })
    await settle()
    expect(itemWrites()).toHaveLength(0)
    expect(ordered.value).toBe('9/15/26')
    fireEvent.blur(ordered)
    await waitFor(() => expect(itemWrites()).toHaveLength(1))
    expect(itemWrites()[0]).toMatchObject({ op: 'update', payload: { ordered_on: '2026-09-15' } })
    await settle()

    // What does not read as a date is dropped: nothing is written, the box goes back to the saved date, and a line says why.
    writes.length = 0
    for (const typed of ['13/45', '9/', '9/2/202']) {
      fireEvent.change(ordered, { target: { value: typed } })
      fireEvent.blur(ordered)
      await settle()
      expect(itemWrites()).toHaveLength(0)
      expect(ordered.value.slice(0, 5)).toBe('09/25')
    }
    expect(screen.getAllByText(/does not read as a date, so it was not saved/).length).toBeGreaterThan(0)
    // A box left as it was, or typed back to what it showed, writes nothing; Escape drops what was typed.
    fireEvent.blur(ordered)
    fireEvent.change(ordered, { target: { value: ordered.value } })
    fireEvent.blur(ordered)
    fireEvent.change(ordered, { target: { value: '9/3' } })
    fireEvent.keyDown(ordered, { key: 'Escape' })
    fireEvent.blur(ordered)
    await settle()
    expect(itemWrites()).toHaveLength(0)

    // Enter saves a typed date without leaving the box; a month and a day alone take the nearest year; an emptied box saves null.
    fireEvent.change(ordered, { target: { value: '9/26/2026' } })
    fireEvent.keyDown(ordered, { key: 'Enter' })
    await waitFor(() => expect(itemWrites()).toHaveLength(1))
    expect(itemWrites()[0]).toMatchObject({ payload: { ordered_on: '2026-09-26' } })
    await settle()
    writes.length = 0
    fireEvent.change(ordered, { target: { value: '0924' } })
    fireEvent.blur(ordered)
    await waitFor(() => expect(itemWrites()).toHaveLength(1))
    expect((itemWrites()[0]!.payload as { ordered_on: string }).ordered_on).toMatch(/^20\d\d-09-24$/)
    await settle()
    writes.length = 0
    fireEvent.change(ordered, { target: { value: '' } })
    fireEvent.blur(ordered)
    await waitFor(() => expect(itemWrites()).toHaveLength(1))
    expect(itemWrites()[0]).toMatchObject({ op: 'update', payload: { ordered_on: null } })
    await settle()

    // A pick from the calendar is a whole date: it writes at once, and the float turns to "on site" only then.
    writes.length = 0
    expect(floatOf(0)).toBe('−14 d')
    fireEvent.change(pickOf('BFP-1 delivered on'), { target: { value: '2026-09-30' } })
    await waitFor(() => expect(itemWrites()).toHaveLength(1))
    expect(itemWrites()).toEqual([{ table: 'bid_procurement_items', op: 'update', payload: { delivered_on: '2026-09-30' } }])
    await settle()
  })

  it('a click into a date box opens the calendar; a click in a box already in use only places the caret', async () => {
    renderWithProviders(<SubmittalProcurementPanel bidId="b1" bidLabel="B482 Shipley" companyName="Click" items={items} reviewerNames={['Dana W.']} currentUser={{ id: 'u', name: 'Wendi' }} />)
    await waitFor(() => expect(screen.getAllByTestId('procurement-row')).toHaveLength(2))
    const ordered = screen.getByLabelText('WH-1 ordered on') as HTMLInputElement
    const showPicker = vi.fn()
    pickOf('WH-1 ordered on').showPicker = showPicker
    fireEvent.pointerDown(ordered)
    ordered.focus()
    fireEvent.click(ordered)
    expect(showPicker).toHaveBeenCalledTimes(1)
    // Already in the box (typing, or the calendar just closed): the next click does not bring the calendar back.
    fireEvent.pointerDown(ordered)
    fireEvent.click(ordered)
    expect(showPicker).toHaveBeenCalledTimes(1)
    // A browser with no calendar to show still takes the typed date.
    ordered.blur()
    pickOf('WH-1 ordered on').showPicker = () => { throw new Error('NotSupportedError') }
    fireEvent.pointerDown(ordered)
    expect(() => fireEvent.click(ordered)).not.toThrow()
  })

  it('v2.4239 · two boxes filled on a new row before the first save lands make one record: the second write updates it', async () => {
    const before = state.records
    state.records = before.filter((r) => r.tag !== 'WH-1')
    try {
      renderWithProviders(<SubmittalProcurementPanel bidId="b1" bidLabel="B482 Shipley" companyName="Click" items={items} reviewerNames={['Dana W.']} currentUser={{ id: 'u', name: 'Wendi' }} />)
      await waitFor(() => expect(screen.getAllByTestId('procurement-row')).toHaveLength(2))
      writes.length = 0
      // Both changes land in one tick, against the same row with no record yet.
      fireEvent.change(pickOf('WH-1 ordered on'), { target: { value: '2026-09-24' } })
      fireEvent.change(pickOf('WH-1 delivered on'), { target: { value: '2026-10-01' } })
      await waitFor(() => expect(writes).toHaveLength(2))
      expect(writes.map((w) => w.op)).toEqual(['insert', 'update'])
      expect(writes[1]!.payload).toEqual({ delivered_on: '2026-10-01' })
    } finally {
      state.records = before
    }
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
      expect(lines[0]).toBe('Tag\tProduct\tQty\tSupply house\tStage\tSubmittal\tReleased\tOrdered\tPO\tLead time\tExpected\tExpected from\tRequired\tFloat\tDelivered\tNote\tGC sees')
      expect(lines[1]).toContain('BFP-1\tWatts 909 RPZ 2"\t\t\tRough-in\tApproved 09/22\t2026-09-22\t')
      expect(opened).toEqual(['https://sheets.new'])
      await waitFor(() => expect(screen.getByText(/Log copied — a new Google Sheet is opening/)).toBeTruthy())
    } finally {
      URL.createObjectURL = realCreate
      URL.revokeObjectURL = realRevoke
      HTMLAnchorElement.prototype.click = realClick
    }
  })

  it('2026-10-01 · a line per part: To order puts what to buy now first by house, the waiting and the order-only lines apart; By house groups; ticked lines take one date and one PO', async () => {
    localStorage.setItem('submittals_procure_lens', 'to_order')
    state.records = []
    writes.length = 0
    const partItems: ProcurementItemSource[] = [
      { tag: 'WC-1', product: 'TOTO CT728CUVG#01', supplyHouse: 'National Wholesale', leadTimeDays: 21, decision: { kind: 'approved', at: '2026-09-22T15:00:00Z' }, shared: true, partKey: 'k-bowl', partOrder: 1, quantity: 10 },
      { tag: 'WC-1', product: 'TOTO TET2LBI31#SS', supplyHouse: 'National Wholesale', leadTimeDays: 14, decision: { kind: 'revise', at: '2026-09-22T15:00:00Z' }, shared: true, partKey: 'k-valve', partOrder: 2, quantity: 10 },
      { tag: 'WC-1', product: 'BRASSCRA PLB113XP ANG', supplyHouse: null, leadTimeDays: 7, decision: { kind: 'approved', at: '2026-09-22T15:00:00Z' }, shared: true, partKey: 'k-stop', partOrder: 3, orderOnly: true, quantity: 10 },
    ]
    renderWithProviders(<SubmittalProcurementPanel bidId="b1" bidLabel="B375" companyName="Click" items={partItems} reviewerNames={[]} currentUser={{ id: 'u', name: 'Wendi' }} />)
    await waitFor(() => expect(screen.getAllByTestId('procurement-section').map((r) => r.textContent)).toEqual(['Order now · National Wholesale1 line', 'Order now · no house yet1 line · set a house to order', 'Waiting on the GC1 line · not ordered until they approve it']))
    expect(screen.getByTestId('procurement-next').textContent).toBe('2 lines are approved and not ordered.')
    expect(screen.getAllByTestId('procurement-qty').map((c) => c.textContent)).toEqual(['10', '10', '10'])
    expect(screen.getByTestId('procurement-order-only').textContent).toContain('order only')
    fireEvent.click(screen.getByRole('button', { name: 'By house' }))
    expect(screen.getAllByTestId('procurement-section').map((r) => r.textContent)).toEqual(['National Wholesale2 lines', 'No house yet1 line'])
    // One order to the house: tick its group, one date, one PO.
    fireEvent.click(screen.getByLabelText('Pick every line under National Wholesale'))
    fireEvent.change(screen.getByLabelText('Ordered on, for every ticked line'), { target: { value: '10/2' } })
    fireEvent.change(screen.getByLabelText('PO, for every ticked line'), { target: { value: 'SPACEX TRIM 1' } })
    fireEvent.click(screen.getByTestId('procurement-bulk-ordered'))
    await waitFor(() => expect(writes.filter((w) => w.table === 'bid_procurement_items' && w.op === 'insert')).toHaveLength(2))
    expect(writes.filter((w) => w.op === 'insert').map((w) => w.payload)).toEqual([
      expect.objectContaining({ tag: 'WC-1', part_key: 'k-bowl', ordered_on: expect.stringMatching(/-10-02$/), po_ref: 'SPACEX TRIM 1' }),
      expect.objectContaining({ tag: 'WC-1', part_key: 'k-valve', ordered_on: expect.stringMatching(/-10-02$/), po_ref: 'SPACEX TRIM 1' }),
    ])
    localStorage.removeItem('submittals_procure_lens')
  })
})
