// @vitest-environment jsdom
/**
 * Render smoke for the procurement log panel (v2.4083): the rows built from the
 * submittal items + the stored records + the job's stage windows, the derived
 * released / expected / required / float, an order date landing as an insert,
 * and Send update recording a snapshot with the changes.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { SubmittalProcurementPanel } from './SubmittalProcurementPanel'
import type { ProcurementItemSource } from '../../lib/submittals/procurementLog'

const writes: Array<{ table: string; op: string; payload: unknown }> = []
const WINDOWS = [{ fixture_id: 'f1', window_start: '2026-10-06' }, { fixture_id: 'f3', window_start: '2026-11-17' }]
const state: { records: Array<Record<string, unknown>>; updates: Array<Record<string, unknown>>; windows: Array<Record<string, unknown>> } = {
  windows: WINDOWS,
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
    if (table === 'job_stage_windows') return state.windows
    if (table === 'supply_houses') return []
    return []
  }
  const builder = (table: string, op: string, payload?: unknown) => {
    const b: Record<string, unknown> = {}
    const chain = () => b
    for (const m of ['eq', 'in', 'order', 'limit', 'select', 'range', 'is']) b[m] = chain
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

/** v2.4581 · each step as label, count and note, without the chevron drawn between them. */
const stepWords = () => screen.getAllByTestId(/^procurement-step-/).map((b) => (b.textContent ?? '').replace('›', ''))

/** 2026-10-02 · a line's dates open under it from its status. */
const openDates = (name: string) => fireEvent.click(screen.getByRole('button', { name: `${name} dates` }))

/** The calendar's date input beside a date box (the box itself is a text box that takes "9/23"). */
const pickOf = (label: string) => screen.getByLabelText(label).parentElement!.querySelector('[data-testid="procurement-date-pick"]') as HTMLInputElement

describe('SubmittalProcurementPanel', () => {
  // These read the log in tag order; the To order lens (2026-10-01) has its own case below.
  beforeEach(() => localStorage.setItem('submittals_procure_lens', 'by_tag'))
  it('builds the log from the rows, the records and the job, derives the float, and records an update with its changes', async () => {
    renderWithProviders(<SubmittalProcurementPanel bidId="b1" bidLabel="B482 Shipley" companyName="Click" items={items} reviewerNames={['Dana W.']} currentUser={{ id: 'u', name: 'Wendi' }} />)
    // v2.4581 · four steps, every line counted once: WH-1 is approved and not ordered, BFP-1 is on order and late.
    await waitFor(() => expect(stepWords()).toEqual(['Waiting on the GC0', 'To order1first by 10/06', 'On order11 late', 'On site0']))
    expect(screen.getByTestId('procurement-next').textContent).toMatch(/^Next: Order 1 part by 10\/06.*\. 1 part on order arrives late\.$/)
    expect(screen.getByTestId('procurement-last-update').textContent).toBe('No update sent yet. The first one sends every row.')
    expect(screen.getByTestId('procurement-send').textContent).toBe('Send update…')
    // Before the first update no row is painted as changed.
    expect(screen.getAllByTestId('procurement-row').every((r) => !(r as HTMLElement).style.background)).toBe(true)
    const rows = screen.getAllByTestId('procurement-row')
    expect(rows).toHaveLength(2)
    // BFP-1: released 09/22 from the approval, the house's 10/20 against Rough In 10/06 → 14 days behind.
    // 2026-10-02 · the maker and model first, the stage in its own column, one status where seven date columns were.
    expect(rows[0]!.querySelector('[data-testid="procurement-item"]')!.textContent).toBe('BFP-1Watts 909RPZ 2"')
    expect(rows[0]!.querySelector('[data-testid="procurement-stage"]')!.textContent).toBe('Rough In')
    expect(screen.getAllByTestId('procurement-status').map((b) => b.textContent)).toEqual(['Arrives 10/20, 14 d lateordered 09/25 · needed 10/06 · PO 119 · note: Ferguson: 10/20 earliest', 'Order by 10/06released 09/22 · needed 11/17'])
    expect(screen.queryByTestId('procurement-draft')).toBeNull()
    // The dates open under the line.
    expect(screen.queryAllByTestId('procurement-editor')).toHaveLength(0)
    openDates('BFP-1')
    openDates('WH-1')
    const editors = screen.getAllByTestId('procurement-editor')
    expect(editors[0]!.textContent).toContain('Approved 09/22')
    expect(editors[0]!.textContent).toContain('house said')
    // Each date box reads a month and a day (a year only when it has to be said); under it, how far it is from today; the house's date says so first.
    const boxes = [...editors[0]!.querySelectorAll<HTMLInputElement>('input.procurement-date')]
    expect(boxes.map((b) => b.type)).toEqual(['text', 'text', 'text'])
    expect(boxes.map((b) => b.value.slice(0, 5))).toEqual(['09/25', '10/20', ''])
    expect(boxes[2]!.placeholder).toBe('mm/dd')
    const under = [...editors[0]!.querySelectorAll('[data-testid="procurement-date-under"]')].map((n) => n.textContent ?? '')
    expect(under).toHaveLength(3)
    expect(under[0]).toMatch(/^(today|\d+ days? ago|in \d+ days?)$/)
    expect(under[1]).toBe('house said')
    expect(under[2]).toMatch(/^(today|\d+ days? ago|in \d+ days?)$/)
    // The calendar's own date input lies beside each box, holding the whole date.
    expect(pickOf('BFP-1 ordered on').value).toBe('2026-09-25')
    expect(editors[0]!.querySelector('[data-testid="procurement-float"]')!.textContent).toBe('−14 d')
    // WH-1: released, unordered, trim set 11/17, 6 wk → order by 10/06.
    expect(editors[1]!.querySelector('[data-testid="procurement-float"]')!.textContent).toBe('order by 10/06')
    // The job has stage windows, so the missing facts do not name them; WH-1 still has no house.
    expect(screen.queryByTestId('procurement-blocker-dates')).toBeNull()
    expect(screen.getByTestId('procurement-blocker-house').textContent).toBe('1 part has no houseSet…')

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
    await waitFor(() => expect(screen.getByTestId('procurement-last-update').textContent).toBe('Last update 09/28 to Dana W.'))
    // Nothing has changed since that update, so the button carries no count.
    expect(screen.getByTestId('procurement-send').textContent).toBe('Send update…')
    // The list of updates sent opens from the ⋯ menu, under the top row.
    fireEvent.click(screen.getByTestId('procurement-more'))
    expect(within(screen.getByTestId('procurement-menu')).getAllByRole('menuitem').map((b) => b.textContent)).toEqual(['Print the log', 'Download CSV', 'Open in Google Sheets', 'Updates sent (1)'])
    fireEvent.click(screen.getByTestId('procurement-updates-open'))
    expect(screen.queryByTestId('procurement-menu')).toBeNull()
    expect(screen.getByTestId('procurement-updates').textContent).toContain('Update 1')
  })

  it('a date box takes a typed month and day and saves when it is left; a pick from the calendar saves at once; what does not read as a date is never written', async () => {
    renderWithProviders(<SubmittalProcurementPanel bidId="b1" bidLabel="B482 Shipley" companyName="Click" items={items} reviewerNames={['Dana W.']} currentUser={{ id: 'u', name: 'Wendi' }} />)
    await waitFor(() => expect(screen.getAllByTestId('procurement-row')).toHaveLength(2))
    writes.length = 0
    const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 0)) })
    const floatOf = (i: number) => screen.getAllByTestId('procurement-float')[i]!.textContent
    const itemWrites = () => writes.filter((w) => w.table === 'bid_procurement_items')

    // Typed: nothing is written while the date is being typed — not at "9/1", not at the whole date — then once when the box is left.
    openDates('BFP-1')
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
    openDates('WH-1')
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
      openDates('WH-1')
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
      fireEvent.click(screen.getByTestId('procurement-more'))
      fireEvent.click(screen.getByTestId('procurement-csv'))
      expect(urls).toEqual([expect.stringMatching(/^blob:text\/csv;charset=utf-8:\d+$/)])
      expect(clicks).toEqual([expect.stringMatching(/^procurement-log_B482-Shipley_\d{4}-\d{2}-\d{2}\.csv$/)])
      fireEvent.click(screen.getByTestId('procurement-more'))
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
    // No update has gone, so no order is marked new.
    state.updates = []
    writes.length = 0
    const partItems: ProcurementItemSource[] = [
      { tag: 'WC-1', product: 'TOTO CT728CUVG#01', supplyHouse: 'National Wholesale', leadTimeDays: 21, decision: { kind: 'approved', at: '2026-09-22T15:00:00Z' }, shared: true, partKey: 'k-bowl', partOrder: 1, quantity: 10 },
      { tag: 'WC-1', product: 'TOTO TET2LBI31#SS', supplyHouse: 'National Wholesale', leadTimeDays: 14, decision: { kind: 'revise', at: '2026-09-22T15:00:00Z' }, shared: true, partKey: 'k-valve', partOrder: 2, quantity: 10 },
      { tag: 'WC-1', product: 'BRASSCRA PLB113XP ANG', supplyHouse: null, leadTimeDays: 7, decision: { kind: 'approved', at: '2026-09-22T15:00:00Z' }, shared: true, partKey: 'k-stop', partOrder: 3, orderOnly: true, quantity: 10 },
    ]
    renderWithProviders(<SubmittalProcurementPanel bidId="b1" bidLabel="B375" companyName="Click" items={partItems} reviewerNames={[]} currentUser={{ id: 'u', name: 'Wendi' }} />)
    // v2.4587 · To order as orders: a section a house, the part sent back on its own with what they wrote.
    await waitFor(() => expect(screen.getAllByTestId('procurement-section').map((r) => r.textContent)).toEqual(['Order now · National Wholesale11 order to place, by date', 'Order now · no house yet11 order to place, by date · set a house to order', 'Sent back by the GC1pick another product, then resubmit on step 7']))
    // Neither approved part has a needed date (WC-1 has no stage), so the Next line gives no day.
    expect(screen.getByTestId('procurement-next').textContent).toBe('Next: 2 parts are approved and not ordered. The GC sent 1 part back.')
    expect(stepWords()).toEqual(['Waiting on the GC11 sent back', 'To order2', 'On order0', 'On site0'])
    // Two houses on the lines: the lens row does not name one. Nothing has a date to place, so no calendar is drawn.
    expect(screen.getByTestId('procurement-shared').textContent).toBe('No dates to draw yet.')
    expect(screen.queryByTestId('procurement-cal-head')).toBeNull()
    expect(screen.getByTestId('procurement-key').textContent).toBe('Each order gets a place on a calendar once its parts have a lead time and the job has stage dates.')
    // An order is one line: its name, its count, what its parts share, and Mark ordered… at the right. The first of a section is open.
    const groups = screen.getAllByTestId('procurement-group')
    expect(groups.map((g) => g.textContent)).toEqual(['No order-by date yet1WC-1 · 3 wk leadMark ordered…', 'No order-by date yet1WC-1 · order only · 1 wk leadMark ordered…'])
    expect(screen.getAllByTestId('procurement-group-fold').map((b) => b.getAttribute('aria-expanded'))).toEqual(['true', 'true'])
    // A part inside an order: the product and the quantity, with Dates… at the right; the part sent back says what they wrote.
    expect(screen.getAllByTestId('procurement-qty').map((c) => c.textContent)).toEqual(['10', '10', '10'])
    expect(screen.getAllByTestId('procurement-status').map((b) => b.textContent)).toEqual(['Dates…', 'Dates…'])
    expect(screen.getByTestId('procurement-they-wrote').textContent).toBe('No note from them')
    expect(screen.getByTestId('procurement-order-only').textContent).toContain('order only')
    // Folding the section hides its orders.
    fireEvent.click(screen.getAllByTestId('procurement-section-fold')[0]!)
    expect(screen.getAllByTestId('procurement-group')).toHaveLength(1)
    fireEvent.click(screen.getAllByTestId('procurement-section-fold')[0]!)
    // Mark ordered… opens a form under the order: today, a PO, and the whole order when nothing is ticked.
    fireEvent.click(screen.getAllByTestId('procurement-mark-open')[0]!)
    const form = screen.getByTestId('procurement-mark-form')
    expect(form.textContent).toContain('Mark 1 part ordered')
    expect((within(form).getByLabelText('Ordered on') as HTMLInputElement).value).toMatch(/^\d\d\/\d\d$/)
    fireEvent.change(within(form).getByLabelText('Ordered on'), { target: { value: '10/2' } })
    fireEvent.change(within(form).getByLabelText('PO'), { target: { value: 'SPACEX CHINA' } })
    fireEvent.click(within(form).getByTestId('procurement-mark-save'))
    await waitFor(() => expect(writes.filter((w) => w.table === 'bid_procurement_items' && w.op === 'insert')).toHaveLength(1))
    expect(writes.find((w) => w.op === 'insert')!.payload).toMatchObject({ tag: 'WC-1', part_key: 'k-bowl', ordered_on: expect.stringMatching(/-10-02$/), po_ref: 'SPACEX CHINA' })
    await waitFor(() => expect(screen.queryByTestId('procurement-mark-form')).toBeNull())
    writes.length = 0
    state.records = []
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

  it('2026-10-02 · a line with a row behind it opens that row: the tap hands back the row and the part; a hand line and a panel with no door stay text', async () => {
    state.records = []
    const onOpenItem = vi.fn<(line: { itemId: string; partKey: string | null; house?: boolean }) => void>()
    const rowItems: ProcurementItemSource[] = [
      { tag: 'DWH-1', product: 'WATTS LFN36M1 0556031 VACUUM RELIEF VALVE', supplyHouse: 'Moore Supply', leadTimeDays: 14, decision: null, shared: false, partKey: 'k-watts', partOrder: 2, itemId: 'row-dwh', stage: 'trim_set' },
      { tag: 'HB-3', product: 'WOODFORD B74C', supplyHouse: 'Moore Supply', leadTimeDays: null, decision: null, shared: false, itemId: 'row-hb' },
    ]
    const { unmount } = renderWithProviders(<SubmittalProcurementPanel bidId="b1" bidLabel="B375" companyName="Click" items={rowItems} reviewerNames={[]} currentUser={{ id: 'u', name: 'Wendi' }} onOpenItem={onOpenItem} />)
    const doors = await screen.findAllByTestId('procurement-open-row')
    expect(doors.map((d) => d.textContent)).toEqual(['DWH-1WATTS LFN36M10556031 VACUUM RELIEF VALVE', 'HB-3WOODFORD B74C'])
    // The house opens the same window: the house is what is usually changed (2026-10-02).
    expect(screen.getAllByTestId('procurement-house-open').map((d) => d.textContent)).toEqual(['Moore Supply', 'Moore Supply'])
    fireEvent.click(screen.getByRole('button', { name: 'Change the house for DWH-1 WATTS LFN36M1' }))
    // The house cell says so, and the window puts the house box under the cursor.
    expect(onOpenItem).toHaveBeenLastCalledWith({ itemId: 'row-dwh', partKey: 'k-watts', house: true })
    expect(doors[0]!.getAttribute('title')).toBe('Open DWH-1 to change this part’s house, lead time or stage')
    fireEvent.click(doors[0]!)
    expect(onOpenItem).toHaveBeenLastCalledWith({ itemId: 'row-dwh', partKey: 'k-watts' })
    // A row typed as one product opens on the row itself.
    fireEvent.click(doors[1]!)
    expect(onOpenItem).toHaveBeenLastCalledWith({ itemId: 'row-hb', partKey: null })
    unmount()
    // No door given (the GC's copies, older callers): the item is plain text.
    renderWithProviders(<SubmittalProcurementPanel bidId="b1" bidLabel="B375" companyName="Click" items={rowItems} reviewerNames={[]} currentUser={{ id: 'u', name: 'Wendi' }} />)
    await screen.findAllByTestId('procurement-item')
    expect(screen.queryByTestId('procurement-open-row')).toBeNull()
  })

  it('2026-10-02 · a line the GC still holds offers Their answer under its status: Enter on a line nobody answered, Change on one sent back, none on a released, ordered or order-only line', async () => {
    localStorage.setItem('submittals_procure_lens', 'by_tag')
    state.records = [{ id: 'p-hb', bid_id: 'b1', tag: 'HB-3', part_key: null, label: '', lead_time_days: null, stage: null, ordered_on: '2026-10-01', po_ref: '', expected_on: null, delivered_on: null, note: '', sort_order: 0, created_at: '', updated_at: '' }]
    const onAnswerItem = vi.fn<(line: { itemId: string; partKey: string | null }) => void>()
    const shared: ProcurementItemSource[] = [
      { tag: 'WC-1, WC-2', product: 'TOTO CT728CUVG#01 TORNADO FLUSH TOILET', supplyHouse: 'Moore Supply', leadTimeDays: null, decision: null, shared: true, partKey: 'k-bowl', partOrder: 1, itemId: 'row-wc' },
      { tag: 'WC-1, WC-2', product: 'TOTO TET2UB31#SS FLUSH VALVE', supplyHouse: 'Moore Supply', leadTimeDays: null, decision: { kind: 'rejected', at: '2026-10-02T15:00:00Z' }, shared: true, partKey: 'k-valve', partOrder: 2, itemId: 'row-wc' },
      { tag: 'WC-1, WC-2', product: 'MAINLINE ML1055SSC000 SEAT', supplyHouse: 'Moore Supply', leadTimeDays: null, decision: { kind: 'approved', at: '2026-10-02T15:00:00Z' }, shared: true, partKey: 'k-seat', partOrder: 3, itemId: 'row-wc' },
      { tag: 'WC-1, WC-2', product: 'BRASSCRA PLB113XP ANGLE STOP', supplyHouse: null, leadTimeDays: null, decision: null, shared: true, partKey: 'k-stop', partOrder: 4, orderOnly: true, itemId: 'row-wc' },
      { tag: 'HB-3', product: 'WOODFORD B74C', supplyHouse: 'Moore Supply', leadTimeDays: null, decision: null, shared: true, itemId: 'row-hb' },
    ]
    try {
      const { unmount } = renderWithProviders(<SubmittalProcurementPanel bidId="b1" bidLabel="B375" companyName="Click" items={shared} reviewerNames={[]} currentUser={{ id: 'u', name: 'Wendi' }} onOpenItem={() => {}} onAnswerItem={onAnswerItem} />)
      await screen.findAllByTestId('procurement-row')
      await waitFor(() => expect(screen.getAllByTestId('procurement-answer-door')).toHaveLength(2))
      const doors = screen.getAllByTestId('procurement-answer-door')
      expect(doors.map((d) => [d.textContent, d.getAttribute('data-door')])).toEqual([
        ['Enter their answer…', 'enter'],
        ['Change their answer…', 'change'],
      ])
      // Each door sits in its own line's status cell, under the status.
      const lineOf = (d: HTMLElement) => d.closest('[data-testid="procurement-row"]')!
      expect(lineOf(doors[0]!).querySelector('[data-testid="procurement-status"]')!.textContent).toBe('Waiting on the GC')
      expect(lineOf(doors[1]!).querySelector('[data-testid="procurement-status"]')!.textContent).toBe('Rejected by the GC')
      fireEvent.click(screen.getByRole('button', { name: 'Enter their answer on WC-1, WC-2 TOTO CT728CUVG#01' }))
      expect(onAnswerItem).toHaveBeenLastCalledWith({ itemId: 'row-wc', partKey: 'k-bowl' })
      fireEvent.click(screen.getByRole('button', { name: 'Change their answer on WC-1, WC-2 TOTO TET2UB31#SS' }))
      expect(onAnswerItem).toHaveBeenLastCalledWith({ itemId: 'row-wc', partKey: 'k-valve' })
      // The status still opens the line's dates: the door is a button of its own beside it.
      openDates('WC-1, WC-2 TOTO CT728CUVG#01')
      expect(screen.getByTestId('procurement-editor')).toBeTruthy()
      expect(onAnswerItem).toHaveBeenCalledTimes(2)
      unmount()
      // No door given (the GC's copies, older callers): no link on any line.
      renderWithProviders(<SubmittalProcurementPanel bidId="b1" bidLabel="B375" companyName="Click" items={shared} reviewerNames={[]} currentUser={{ id: 'u', name: 'Wendi' }} onOpenItem={() => {}} />)
      await screen.findAllByTestId('procurement-row')
      expect(screen.queryByTestId('procurement-answer-door')).toBeNull()
    } finally {
      localStorage.removeItem('submittals_procure_lens')
    }
  })

  it('2026-10-02 · By tag on a draft: said once that nothing is released; the GC’s parts, then a divider and the order-only ones in grey; two carriers flagged', async () => {
    localStorage.setItem('submittals_procure_lens', 'by_tag')
    state.records = []
    const draft: ProcurementItemSource[] = [
      { tag: 'WC-1, WC-2', product: 'TOTO CT728CUVG#01 TORNADO FLUSH TOILET', supplyHouse: 'Moore Supply', leadTimeDays: null, decision: null, shared: false, partKey: 'k-bowl', partOrder: 1, quantity: 10, fixture: 'WC 1&2', fixtureCount: 10, itemId: 'row-wc' },
      { tag: 'WC-1, WC-2', product: 'BRASSCRA PLB113XP ANGLE STOP', supplyHouse: null, leadTimeDays: null, decision: null, shared: false, partKey: 'k-stop', partOrder: 2, quantity: 10, orderOnly: true, fixture: 'WC 1&2', fixtureCount: 10, itemId: 'row-wc' },
      { tag: 'WC-1, WC-2', product: 'ZURN Z1201 EZCARRY', supplyHouse: null, leadTimeDays: null, decision: null, shared: false, partKey: 'k-zurn', partOrder: 3, quantity: 10, fixture: 'WC 1&2', fixtureCount: 10, itemId: 'row-wc' },
      { tag: 'WC-1, WC-2', product: 'JOSAM 12694 closet carrier', supplyHouse: 'National Wholesale', leadTimeDays: null, decision: null, shared: false, partKey: 'k-josam', partOrder: 4, quantity: 10, fixture: 'WC 1&2', fixtureCount: 10, itemId: 'row-wc', stage: 'rough_in', pricedLabel: 'ZURN Z1201-NR4 EZCARRY' },
    ]
    renderWithProviders(<SubmittalProcurementPanel bidId="b1" bidLabel="B375" companyName="Click" items={draft} reviewerNames={[]} currentUser={{ id: 'u', name: 'Wendi' }} onOpenItem={() => {}} />)
    await waitFor(() => expect(screen.getByTestId('procurement-draft').textContent).toBe('This version is a draft, so nothing is released yet. The GC releases each part when they approve it.'))
    const section = screen.getByTestId('procurement-section')
    expect(section.textContent).toBe('WC-1, WC-2WC 1&2 × 10 · 4 partsTwo carriers')
    const lines = screen.getAllByTestId('procurement-row')
    // The maker and model first, the catalog words after; the GC's parts, then the order-only one.
    expect(lines.map((l) => [l.querySelector('[data-testid="procurement-item"]')!.textContent, l.getAttribute('data-order-only')])).toEqual([
      ['TOTO CT728CUVG#01TORNADO FLUSH TOILET', null],
      ['ZURN Z1201EZCARRY', null],
      ['JOSAM 12694closet carrierin place of the priced ZURN Z1201-NR4', null],
      ['BRASSCRA PLB113XPANGLE STOP', 'true'],
    ])
    expect(lines[3]!.style.opacity).toBe('0.72')
    expect(screen.getByTestId('procurement-order-only-divider').textContent).toBe('Ordered, not on the GC’s copy · 1 part')
    expect(screen.getByTestId('procurement-priced').textContent).toBe('in place of the priced ZURN Z1201-NR4')
    // A missing house is said where it is missing; nothing on a draft line says "Not shared".
    expect(screen.getAllByTestId('procurement-house').map((c) => c.textContent)).toEqual(['Moore Supply', 'no house', 'National Wholesale', 'no house'])
    expect(screen.getAllByTestId('procurement-status').map((b) => b.getAttribute('data-tone'))).toEqual(['none', 'none', 'none', 'none'])
    expect(screen.queryByText('Not shared')).toBeNull()
    localStorage.removeItem('submittals_procure_lens')
  })

  it('2026-10-02 · By tag reads as a tree: parts one step in under their fixture; an assembly gets its own step only when the fixture mixes it with other parts; a one-part fixture is one line', async () => {
    localStorage.setItem('submittals_procure_lens', 'by_tag')
    state.records = []
    const base = { leadTimeDays: null, decision: null, shared: false }
    const lines: ProcurementItemSource[] = [
      // EWC-1: the EWC1 assembly and Wendi's carrier added by hand.
      { ...base, tag: 'EWC-1', product: 'ELKAY LZSTL8WSLK WATER COOLER', supplyHouse: null, partKey: 'k-elkay', partOrder: 1, quantity: 2, fixture: 'EWC1', fixtureCount: 2, itemId: 'row-ewc', assembly: 'EWC1 assembly' },
      { ...base, tag: 'EWC-1', product: 'ELKAY APRON', supplyHouse: null, partKey: 'k-apron', partOrder: 2, quantity: 2, fixture: 'EWC1', fixtureCount: 2, itemId: 'row-ewc', assembly: 'EWC1 assembly' },
      { ...base, tag: 'EWC-1', product: 'MAINLINE MLZ8700 P-TRAP', supplyHouse: null, partKey: 'k-trap', partOrder: 3, quantity: 2, orderOnly: true, fixture: 'EWC1', fixtureCount: 2, itemId: 'row-ewc', assembly: 'EWC1 assembly' },
      { ...base, tag: 'EWC-1', product: 'JOSAM 17560-WCBL carrier', supplyHouse: 'National Wholesale', partKey: 'k-josam', partOrder: 7, quantity: 2, fixture: 'EWC1', fixtureCount: 2, itemId: 'row-ewc', stage: 'rough_in', addedByHand: true },
      // FCO: one part.
      { ...base, tag: 'FCO', product: 'ZURN ZN1400-2NL FLOOR CLEAN OUT', supplyHouse: 'Moore Supply', partKey: 'k-fco', partOrder: 1, quantity: 2, fixture: 'FCO', fixtureCount: 2, itemId: 'row-fco' },
      // LAV-1: one assembly and nothing else.
      { ...base, tag: 'LAV-1', product: 'TSL.MON.B.38.2.PS1.BK MONOLITH B SERIES', supplyHouse: null, partKey: 'k-tsl', partOrder: 1, quantity: 2, fixture: 'LAV 1', fixtureCount: 2, itemId: 'row-lav', assembly: 'LAV 1 assembly SPACEX' },
      { ...base, tag: 'LAV-1', product: 'TOTO T25S51E#CP', supplyHouse: null, partKey: 'k-toto', partOrder: 2, quantity: 2, fixture: 'LAV 1', fixtureCount: 2, itemId: 'row-lav', assembly: 'LAV 1 assembly SPACEX' },
      { ...base, tag: 'LAV-1', product: 'HYDRAPRO H20008 GRID DRAIN', supplyHouse: null, partKey: 'k-drain', partOrder: 3, quantity: 2, orderOnly: true, fixture: 'LAV 1', fixtureCount: 2, itemId: 'row-lav', assembly: 'LAV 1 assembly SPACEX' },
    ]
    renderWithProviders(<SubmittalProcurementPanel bidId="b1" bidLabel="B375" companyName="Click" items={lines} reviewerNames={[]} currentUser={{ id: 'u', name: 'Wendi' }} onOpenItem={() => {}} />)
    await waitFor(() => expect(screen.getAllByTestId('procurement-section')).toHaveLength(2))
    // EWC-1 mixes: no "from" on its heading, its assembly a row of its own; LAV-1 is one assembly: named on its heading.
    expect(screen.getAllByTestId('procurement-section-from').map((f) => f.textContent)).toEqual(['from LAV 1 assembly SPACEX'])
    expect(screen.getAllByTestId('procurement-assembly').map((a) => a.textContent)).toEqual(['EWC1 assembly · 3 parts'])
    const level = (product: string) => screen.getAllByTestId('procurement-row').find((r) => r.textContent!.includes(product))!.querySelector('[data-testid="procurement-item"]')!.getAttribute('data-level')
    expect(level('ELKAY APRON')).toBe('2')
    expect(level('MAINLINE MLZ8700')).toBe('2')
    expect(level('JOSAM 17560-WCBL')).toBe('1')
    expect(level('TOTO T25S51E#CP')).toBe('1')
    // FCO is a fixture with one part: one line at the edge, no heading, no connector.
    expect(level('ZURN ZN1400-2NL')).toBeNull()
    // The connectors: inside EWC1 assembly the outer column carries on down to the carrier, which closes it.
    const rails = (product: string) => [...screen.getAllByTestId('procurement-row').find((r) => r.textContent!.includes(product))!.querySelectorAll('[data-testid="procurement-rail"]')].map((x) => x.getAttribute('data-rail'))
    expect(rails('ELKAY APRON')).toEqual(['pass', 'tee'])
    expect(rails('JOSAM 17560-WCBL')).toEqual(['end'])
    expect(rails('HYDRAPRO H20008')).toEqual(['end'])
    expect(screen.getByTestId('procurement-added-by-hand').textContent).toBe('added by hand')
    // Each block says where its own order-only parts start.
    expect(screen.getAllByTestId('procurement-order-only-divider').map((d) => d.textContent)).toEqual(['Ordered, not on the GC’s copy · 1 part', 'Ordered, not on the GC’s copy · 1 part'])
    // Ticking the assembly ticks its parts.
    fireEvent.click(screen.getByLabelText('Pick every part of EWC1 assembly'))
    expect(screen.getByTestId('procurement-bulk').textContent).toContain('3 lines ticked')
    // Away from its fixture, a part names its assembly.
    fireEvent.click(screen.getByRole('button', { name: 'By house' }))
    expect(screen.getAllByTestId('procurement-in-assembly').map((x) => x.textContent)).toContain('in EWC1 assembly')
    localStorage.removeItem('submittals_procure_lens')
  })

  it('2026-10-02 · Before you can order counts what is missing on one line; v2.4581 · Set… puts one lead time on every part it names; the tick bar still sets a few at a time', async () => {
    localStorage.setItem('submittals_procure_lens', 'by_tag')
    state.records = []
    writes.length = 0
    const onLinesChanged = vi.fn()
    // The job has no stage windows yet.
    state.windows = []
    const lines: ProcurementItemSource[] = [
      { tag: 'LAV-1', product: 'TOTO T25S51E#CP', supplyHouse: null, leadTimeDays: null, decision: null, shared: false, partKey: 'k-faucet', partOrder: 1, itemId: 'row-lav', stage: 'trim_set' },
      { tag: 'LAV-1', product: 'BOBRICK B-8236', supplyHouse: null, leadTimeDays: null, decision: null, shared: false, partKey: 'k-soap', partOrder: 2, itemId: 'row-lav', stage: 'trim_set' },
      { tag: 'HB-3', product: 'WOODFORD B74C', supplyHouse: 'Moore Supply', leadTimeDays: 14, decision: null, shared: false, itemId: 'row-hb' },
      { tag: 'UTILITY SINK', product: '(no product)', supplyHouse: null, leadTimeDays: null, decision: null, shared: false, itemId: 'row-us' },
    ]
    renderWithProviders(<SubmittalProcurementPanel bidId="b1" bidLabel="B375" companyName="Click" items={lines} reviewerNames={[]} currentUser={{ id: 'u', name: 'Wendi' }} houses={[{ id: 'h-moore', name: 'Moore Supply' }, { id: 'h-nws', name: 'National Wholesale' }]} onLinesChanged={onLinesChanged} onOpenItem={() => {}} />)
    const box = await screen.findByTestId('procurement-blockers')
    // Nothing can be ordered yet, so the line stays grey.
    expect(box.getAttribute('data-press')).toBeNull()
    expect(screen.getByTestId('procurement-blocker-dates').textContent).toBe('The job has no stage datesOpen the job')
    expect(within(box).getByRole('link', { name: 'Open the job' }).getAttribute('href')).toBe('/jobs?jobDetail=j1')
    expect(screen.getByTestId('procurement-blocker-lead').textContent).toBe('2 parts have no lead timeSet…')
    expect(screen.getByTestId('procurement-blocker-house').textContent).toBe('2 parts have no houseSet…')
    // HB-3 has no takeoff stage: one line.
    expect(screen.getByTestId('procurement-blocker-stage').textContent).toBe('1 part has no stageSet…')
    expect(screen.getByTestId('procurement-blocker-product').textContent).toBe('UTILITY SINK has no productOpen it')
    expect(box.textContent).toContain('Without a lead time and a stage, the log cannot say when to order a part or when the GC must answer.')
    // Set… opens a small form in place; a lead time that does not read is not written.
    fireEvent.click(screen.getByTestId('procurement-blocker-set-lead'))
    const form = screen.getByTestId('procurement-setter')
    expect(form.textContent).toContain('Lead time for 2 parts')
    const setOn = screen.getByTestId('procurement-setter-set') as HTMLButtonElement
    expect(setOn.textContent).toBe('Set on 2')
    expect(setOn.disabled).toBe(true)
    fireEvent.change(within(form).getByLabelText('Lead time'), { target: { value: 'soon' } })
    fireEvent.click(setOn)
    expect(writes.filter((w) => w.table === 'bid_submittal_item_parts')).toHaveLength(0)
    fireEvent.change(within(form).getByLabelText('Lead time'), { target: { value: '5 wk' } })
    fireEvent.click(setOn)
    await waitFor(() => expect(onLinesChanged).toHaveBeenCalledTimes(1))
    expect(writes.filter((w) => w.table === 'bid_submittal_item_parts' && w.op === 'update').map((w) => w.payload)).toEqual([expect.objectContaining({ lead_time_days: 35 }), expect.objectContaining({ lead_time_days: 35 })])
    await waitFor(() => expect(screen.queryByTestId('procurement-setter')).toBeNull())
    // Stage opens with the three stages to pick from.
    fireEvent.click(screen.getByTestId('procurement-blocker-set-stage'))
    expect(within(screen.getByTestId('procurement-setter')).getAllByRole('button', { pressed: false }).map((x) => x.textContent)).toEqual(['Rough In', 'Top Out', 'Trim Set'])
    fireEvent.click(within(screen.getByTestId('procurement-setter')).getByRole('button', { name: 'Cancel' }))
    writes.length = 0
    onLinesChanged.mockClear()
    // A few at a time: tick the fixture's lines, and the bar sets them.
    fireEvent.click(screen.getByLabelText('Pick every line under LAV-1'))
    expect(screen.getByTestId('procurement-bulk').textContent).toContain('2 lines ticked')
    const set = screen.getByTestId('procurement-bulk-set') as HTMLButtonElement
    expect(set.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('House, for every ticked line'), { target: { value: 'h-nws' } })
    fireEvent.change(screen.getByLabelText('Lead time, for every ticked line'), { target: { value: '3 wk' } })
    fireEvent.click(set)
    await waitFor(() => expect(onLinesChanged).toHaveBeenCalledTimes(1))
    const partWrites = writes.filter((w) => w.table === 'bid_submittal_item_parts' && w.op === 'update')
    expect(partWrites).toHaveLength(2)
    expect(partWrites[0]!.payload).toMatchObject({ supply_house_id: 'h-nws', lead_time_days: 21 })
    // The row reads its parts again.
    expect(writes.some((w) => w.table === 'bid_submittal_items' && w.op === 'update')).toBe(true)
    expect(screen.queryByTestId('procurement-bulk')).toBeNull()
    await waitFor(() => expect(screen.getByText('National Wholesale, 3 wk set on 2 lines.')).toBeTruthy())
    state.windows = WINDOWS
    localStorage.removeItem('submittals_procure_lens')
  })

  it('2026-10-02 · a blocker’s count is a link: it shows only those parts, out of their folds, until Show every line', async () => {
    localStorage.removeItem('submittals_procure_lens')
    state.records = []
    const lines: ProcurementItemSource[] = [
      { tag: 'LAV-1', product: 'TOTO T25S51E#CP', supplyHouse: 'Moore Supply', leadTimeDays: 14, decision: null, shared: true, partKey: 'k-faucet', partOrder: 1, itemId: 'row-lav', stage: 'trim_set' },
      { tag: 'LAV-1', product: 'BOBRICK B-8236', supplyHouse: 'Moore Supply', leadTimeDays: 14, decision: null, shared: true, partKey: 'k-soap', partOrder: 2, itemId: 'row-lav' },
      { tag: 'WHA-200', product: 'ZURN Z1700-200-OV', supplyHouse: 'National Wholesale', leadTimeDays: 7, decision: null, shared: true, partKey: 'k-wha', partOrder: 1, itemId: 'row-wha' },
      { tag: 'HB-3', product: 'WOODFORD B74C', supplyHouse: 'Moore Supply', leadTimeDays: 14, decision: { kind: 'approved', at: '2026-09-22T15:00:00Z' }, shared: true, itemId: 'row-hb', stage: 'rough_in' },
    ]
    renderWithProviders(<SubmittalProcurementPanel bidId="b1" bidLabel="B375" companyName="Click" items={lines} reviewerNames={[]} currentUser={{ id: 'u', name: 'Wendi' }} houses={[{ id: 'h-moore', name: 'Moore Supply' }]} onOpenItem={() => {}} />)
    const stage = await screen.findByTestId('procurement-blocker-stage')
    expect(stage.textContent).toBe('2 parts have no stageSet…')
    // HB-3 is approved with everything it needs; what is missing is on parts still waiting, so the line is grey.
    expect(screen.getByTestId('procurement-blockers').getAttribute('data-press')).toBeNull()
    // To order: the lines waiting on the GC are folded one per fixture, so the two parts are out of sight.
    const folded = () => screen.getAllByTestId('procurement-group').filter((g) => g.getAttribute('data-kind') === 'fixture').map((g) => [g.textContent, within(g).getByTestId('procurement-group-fold').getAttribute('aria-expanded')])
    expect(folded()).toEqual([['LAV-122 partsanswer by 11/03', 'false'], ['WHA-2001ZURN Z1700-200-OV', 'false']])
    expect(screen.queryByText('BOBRICK B-8236')).toBeNull()
    const link = within(stage).getByRole('button', { name: 'Show the 2 parts with no stage' })
    fireEvent.click(link)
    // Only the two parts, by name, with no fold to open; the line above still says what is ready to buy.
    expect(screen.getByTestId('procurement-only').textContent).toBe('2 parts with no stage. The other lines are hidden.Show every line')
    // Under its fixture a part does not say the tag again.
    expect(screen.getAllByTestId('procurement-open-row').map((d) => d.textContent)).toEqual(['BOBRICK B-8236', 'ZURN Z1700-200-OV'])
    expect(folded().map(([, open]) => open)).toEqual(['true', 'true'])
    expect(screen.queryByText('WOODFORD B74C')).toBeNull()
    expect(link.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByTestId('procurement-next').textContent).toMatch(/^Next: Order 1 part by 09\/22/)
    // v2.4581 · a step does the same for its lines, and takes the blocker's place.
    fireEvent.click(screen.getByTestId('procurement-step-gc'))
    expect(screen.getByTestId('procurement-step-gc').getAttribute('aria-pressed')).toBe('true')
    expect(link.getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByTestId('procurement-only').textContent).toBe('Waiting on the GC: 3 parts. The other lines are hidden.Show every line')
    expect(screen.getAllByTestId('procurement-row')).toHaveLength(3)
    expect(folded().map(([, open]) => open)).toEqual(['true', 'true'])
    expect(screen.queryByText('WOODFORD B74C')).toBeNull()
    // Pressed again, every line is back.
    fireEvent.click(screen.getByTestId('procurement-step-gc'))
    expect(screen.queryByTestId('procurement-only')).toBeNull()
    fireEvent.click(screen.getByTestId('procurement-step-to_order'))
    expect(screen.getByTestId('procurement-only').textContent).toBe('To order: 1 part. The other lines are hidden.Show every line')
    expect(screen.getByText('WOODFORD B74C')).toBeTruthy()
    // The link again, or Show every line, brings the log back.
    fireEvent.click(within(screen.getByTestId('procurement-only')).getByRole('button', { name: 'Show every line' }))
    expect(screen.queryByTestId('procurement-only')).toBeNull()
    expect(folded().map(([, open]) => open)).toEqual(['false', 'false'])
    expect(screen.getByText('WOODFORD B74C')).toBeTruthy()
    expect(stage.textContent).toBe('2 parts have no stageSet…')
  })

  it('v2.4581 · the Next line carries the approval door when the tab hands one; one house is said once on the lens row', async () => {
    localStorage.removeItem('submittals_procure_lens')
    state.records = []
    const onEnterApproval = vi.fn()
    const lines: ProcurementItemSource[] = [
      { tag: 'LAV-1', product: 'TOTO T25S51E#CP', supplyHouse: 'National Wholesale', leadTimeDays: null, decision: null, shared: true, itemId: 'row-lav' },
      { tag: 'WC-1', product: 'TOTO TET2UB31#SS', supplyHouse: 'National Wholesale', leadTimeDays: null, decision: { kind: 'rejected', at: '2026-10-02T15:00:00Z' }, shared: true, itemId: 'row-wc' },
    ]
    const { unmount } = renderWithProviders(<SubmittalProcurementPanel bidId="b1" bidLabel="B375" companyName="Click" items={lines} reviewerNames={[]} currentUser={{ id: 'u', name: 'Wendi' }} onEnterApproval={onEnterApproval} />)
    await waitFor(() => expect(screen.getByTestId('procurement-next').textContent).toBe('Next: Nothing can be ordered until the GC answers. They sent 1 part back. 1 more waits on their answer. Approved outside the app? Enter their approval…'))
    fireEvent.click(screen.getByTestId('procurement-enter-approval'))
    expect(onEnterApproval).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('procurement-shared').textContent).toBe('Every part comes from National Wholesale. No dates to draw yet.')
    // The share bar has one piece: everything waits on the GC.
    expect(screen.getByTestId('procurement-share').children).toHaveLength(1)
    unmount()
    // No door handed: the line ends with its sentences.
    renderWithProviders(<SubmittalProcurementPanel bidId="b1" bidLabel="B375" companyName="Click" items={lines} reviewerNames={[]} currentUser={{ id: 'u', name: 'Wendi' }} />)
    await waitFor(() => expect(screen.getByTestId('procurement-next').textContent).toBe('Next: Nothing can be ordered until the GC answers. They sent 1 part back. 1 more waits on their answer.'))
  })

  it('v2.4587 · orders by PO, on site by PO, a part sent back with what they wrote and its two doors, a waiting fixture with Their answer…', async () => {
    localStorage.removeItem('submittals_procure_lens')
    state.updates = []
    state.records = [
      { id: 'p1', bid_id: 'b1', tag: 'WHA-200', part_key: null, label: '', lead_time_days: null, stage: null, ordered_on: '2026-10-20', po_ref: '4502', expected_on: '2026-11-03', delivered_on: null, note: '', sort_order: 0, created_at: '', updated_at: '' },
      { id: 'p2', bid_id: 'b1', tag: 'WHA-300', part_key: null, label: '', lead_time_days: null, stage: null, ordered_on: '2026-10-20', po_ref: '4502', expected_on: '2026-11-03', delivered_on: null, note: '', sort_order: 1, created_at: '', updated_at: '' },
      { id: 'p3', bid_id: 'b1', tag: 'FCO', part_key: null, label: '', lead_time_days: null, stage: null, ordered_on: '2026-10-06', po_ref: '4471', expected_on: null, delivered_on: '2026-10-15', note: '', sort_order: 2, created_at: '', updated_at: '' },
    ]
    const approved = { kind: 'approved' as const, at: '2026-10-16T15:00:00Z' }
    const lines: ProcurementItemSource[] = [
      { tag: 'FCO', product: 'ZURN ZN1400-2NL', supplyHouse: 'National Wholesale', leadTimeDays: 7, decision: approved, shared: true, itemId: 'row-fco' },
      { tag: 'LAV-2', product: 'KOHLER 2215-0 LADENA WHITE', supplyHouse: 'National Wholesale', leadTimeDays: null, decision: { kind: 'rejected', at: '2026-10-02T15:00:00Z' }, shared: true, partKey: 'k-lav', partOrder: 1, itemId: 'row-lav2', reviewNote: 'KOHLER 2215-0' },
      { tag: 'LAV-2', product: 'BOBRICK B-8236', supplyHouse: 'National Wholesale', leadTimeDays: null, decision: null, shared: true, partKey: 'k-soap', partOrder: 2, itemId: 'row-lav2', fixture: 'LAV2', fixtureCount: 6 },
      { tag: 'LAV-2', product: 'MAINLINE MLZ8700 P-TRAP', supplyHouse: 'National Wholesale', leadTimeDays: null, decision: null, shared: true, partKey: 'k-trap', partOrder: 3, itemId: 'row-lav2', orderOnly: true, fixture: 'LAV2', fixtureCount: 6 },
      { tag: 'WHA-200', product: 'ZURN Z1700-200-OV', supplyHouse: 'National Wholesale', leadTimeDays: 14, decision: approved, shared: true, itemId: 'row-w2' },
      { tag: 'WHA-300', product: 'ZURN Z1700-300-OV', supplyHouse: 'National Wholesale', leadTimeDays: 14, decision: approved, shared: true, itemId: 'row-w3' },
    ]
    const onOpenItem = vi.fn()
    const onAnswerItem = vi.fn()
    renderWithProviders(<SubmittalProcurementPanel bidId="b1" bidLabel="B375" companyName="Click" items={lines} reviewerNames={[]} currentUser={{ id: 'u', name: 'Wendi' }} onOpenItem={onOpenItem} onAnswerItem={onAnswerItem} />)
    await waitFor(() => expect(screen.getAllByTestId('procurement-section').map((r) => r.textContent)).toEqual(['On order2', 'Sent back by the GC1pick another product, then resubmit on step 7', 'Waiting on their answer21 fixture · not ordered until they approve', 'On site1']))
    // An order placed and an order on site are one line each, folded: the PO, what its parts share, and when it lands.
    const groups = () => screen.getAllByTestId('procurement-group')
    expect(groups().map((g) => [g.getAttribute('data-kind'), g.textContent, within(g).getByTestId('procurement-group-fold').getAttribute('aria-expanded')])).toEqual([
      ['placed', 'PO 45022WHA-200, WHA-300 · 2 wk lead · ordered 10/20Arrives 11/03', 'false'],
      ['fixture', 'LAV-22LAV2 × 6 · 1 part · 1 order onlyTheir answer…', 'false'],
      ['on_site', 'PO 44711FCO · ordered 10/06✓ On site 10/15', 'false'],
    ])
    // Opened, a part is one line with Dates… at the right; the dates editor opens under it as before.
    fireEvent.click(within(groups()[0]!).getByTestId('procurement-group-fold'))
    expect(screen.getAllByTestId('procurement-open-row').map((b) => b.textContent)).toContain('WHA-200ZURN Z1700-200-OV')
    openDates('WHA-200')
    expect(screen.getByTestId('procurement-editor').textContent).toContain('Ordered')
    expect((screen.getByLabelText('WHA-200 PO') as HTMLInputElement).value).toBe('4502')
    // The part sent back says what they wrote, and has both doors.
    expect(screen.getByTestId('procurement-they-wrote').textContent).toBe('They wrote “KOHLER 2215-0”')
    fireEvent.click(screen.getByTestId('procurement-pick-another'))
    expect(onOpenItem).toHaveBeenLastCalledWith({ itemId: 'row-lav2', partKey: 'k-lav' })
    fireEvent.click(screen.getByRole('button', { name: 'Change their answer on LAV-2 KOHLER 2215-0' }))
    expect(onAnswerItem).toHaveBeenLastCalledWith({ itemId: 'row-lav2', partKey: 'k-lav' })
    // The waiting fixture opens the row's Their answer window; inside, the order-only part sits under its heading.
    fireEvent.click(screen.getByTestId('procurement-fixture-answer'))
    expect(onAnswerItem).toHaveBeenLastCalledWith({ itemId: 'row-lav2', partKey: null })
    fireEvent.click(within(groups()[1]!).getByTestId('procurement-group-fold'))
    expect(screen.getByTestId('procurement-order-only-divider').textContent).toBe('Ordered, not on the GC’s copy · 1 part')
    expect(screen.getByRole('button', { name: 'Enter their answer on LAV-2 BOBRICK B-8236' })).toBeTruthy()
    state.records = []
  })

  it('v2.4592 · the calendar beside the orders: a diamond at the order-by date, a bar for what is on order with its late part in red, the stages and today in the head, the key under the table', async () => {
    localStorage.removeItem('submittals_procure_lens')
    // A fixed today: the marks stand where the dates put them.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-01T18:00:00Z'))
    state.updates = []
    state.records = [{ id: 'p1', bid_id: 'b1', tag: 'BFP-1', label: '', lead_time_days: null, stage: null, ordered_on: '2026-09-25', po_ref: '119', expected_on: '2026-10-20', delivered_on: null, note: '', sort_order: 0, created_at: '', updated_at: '' }]
    try {
      renderWithProviders(<SubmittalProcurementPanel bidId="b1" bidLabel="B482 Shipley" companyName="Click" items={[...items, { tag: 'S-3', product: 'Elkay sink', supplyHouse: null, leadTimeDays: 7, decision: null, shared: true }]} reviewerNames={[]} currentUser={{ id: 'u', name: 'Wendi' }} />)
      const head = await screen.findByTestId('procurement-cal-head')
      // The job needs Rough In 10/06 and Trim Set 11/17; the Mondays are named, with today in place of the one beside it.
      expect(within(head).getAllByTestId('procurement-cal-stage').map((x) => x.textContent)).toEqual(['Rough In', 'Trim Set'])
      expect(within(head).getAllByTestId('procurement-cal-week').map((x) => x.textContent)).toEqual(['10/5', '10/12', '10/19', '10/26', '11/2', '11/9', '11/16'])
      expect(within(head).getByTestId('procurement-cal-today').textContent).toBe('today')
      // There are dates to draw, and the lines have no one house to name: the lens row says nothing.
      expect(screen.queryByTestId('procurement-shared')).toBeNull()
      const groups = screen.getAllByTestId('procurement-group')
      expect(groups.map((g) => g.getAttribute('data-kind'))).toEqual(['to_place', 'placed', 'fixture'])
      const cal = (g: HTMLElement) => within(g).getByTestId('procurement-cal')
      // WH-1 is approved: order by 10/06 for Trim Set 11/17. A diamond, a dotted run, a tick.
      expect(cal(groups[0]!).getAttribute('aria-label')).toBe('order by 10/06, needed 11/17')
      expect(within(cal(groups[0]!)).getByTestId('procurement-cal-diamond').getAttribute('data-tone')).toBe('go')
      expect(within(cal(groups[0]!)).getByTestId('procurement-cal-dotted')).toBeTruthy()
      expect(within(cal(groups[0]!)).getByTestId('procurement-cal-tick').getAttribute('title')).toBe('needed on the job 11/17')
      // BFP-1 is on order and lands 14 days past Rough In: blue up to the tick, red past it.
      expect(cal(groups[1]!).getAttribute('aria-label')).toBe('ordered 09/25, arrives 10/20, needed 10/06, 14 days late')
      expect(within(cal(groups[1]!)).getByTestId('procurement-cal-bar').getAttribute('data-clipped')).toBeNull()
      expect(within(cal(groups[1]!)).getByTestId('procurement-cal-late')).toBeTruthy()
      expect(within(cal(groups[1]!)).queryByTestId('procurement-cal-diamond')).toBeNull()
      // S-3 waits on the GC and has no stage: no needed date, so no mark, but its cell still carries today's line.
      expect(cal(groups[2]!).getAttribute('aria-label')).toBeNull()
      expect(within(cal(groups[2]!)).queryByTestId('procurement-cal-diamond')).toBeNull()
      // A part inside an order has a calendar cell with no mark of its own.
      const partCells = screen.getAllByTestId('procurement-row').map((r) => within(r).queryByTestId('procurement-cal'))
      expect(partCells.every((c) => c != null && c.querySelector('[data-testid="procurement-cal-diamond"]') == null)).toBe(true)
      expect(screen.getByTestId('procurement-key').textContent).toBe('order bythe GC must answer byon orderpast the needed dateneeded on the jobtoday')
      // By tag keeps its own rows and its paragraph: no calendar.
      fireEvent.click(screen.getByRole('button', { name: 'By tag' }))
      expect(screen.queryByTestId('procurement-cal-head')).toBeNull()
      expect(screen.queryByTestId('procurement-key')).toBeNull()
      expect(screen.getByText(/Tap a status to type its dates/)).toBeTruthy()
    } finally {
      vi.useRealTimers()
      state.records = []
    }
  })

  it('2026-10-02 · on a phone each part is a short card: no table, the qty, house and stage on one line, its dates open under it', async () => {
    localStorage.setItem('submittals_procure_lens', 'by_tag')
    state.records = []
    const real = window.matchMedia
    window.matchMedia = ((q: string) => ({ matches: q.includes('640'), media: q, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia
    try {
      const lines: ProcurementItemSource[] = [
        { tag: 'WC-1, WC-2', product: 'TOTO CT728CUVG#01 TORNADO FLUSH TOILET', supplyHouse: 'Moore Supply', leadTimeDays: 14, decision: null, shared: false, partKey: 'k-bowl', partOrder: 1, quantity: 10, stage: 'trim_set', itemId: 'row-wc', fixture: 'WC 1&2', fixtureCount: 10 },
        { tag: 'WC-1, WC-2', product: 'JOSAM 12694 closet carrier', supplyHouse: null, leadTimeDays: null, decision: null, shared: false, partKey: 'k-josam', partOrder: 2, quantity: 10, stage: 'rough_in', itemId: 'row-wc', fixture: 'WC 1&2', fixtureCount: 10 },
      ]
      const onAnswerItem = vi.fn<(line: { itemId: string; partKey: string | null }) => void>()
      renderWithProviders(<SubmittalProcurementPanel bidId="b1" bidLabel="B375" companyName="Click" items={lines} reviewerNames={[]} currentUser={{ id: 'u', name: 'Wendi' }} onOpenItem={() => {}} onAnswerItem={onAnswerItem} />)
      const cards = await screen.findAllByTestId('procurement-row')
      expect(cards.map((c) => c.tagName)).toEqual(['DIV', 'DIV'])
      expect(document.querySelector('table')).toBeNull()
      expect(cards[0]!.textContent).toContain('10·Moore Supply·Trim Set·2 wk')
      expect(cards[1]!.textContent).toContain('10·no house·Rough In·no lead time')
      expect(screen.getByTestId('procurement-section').textContent).toBe('WC-1, WC-2WC 1&2 × 10 · 2 parts')
      openDates('WC-1, WC-2 JOSAM 12694')
      expect(screen.getByTestId('procurement-editor').tagName).toBe('DIV')
      expect(screen.getByLabelText('WC-1, WC-2 ordered on')).toBeTruthy()
      // A draft card still offers the door, under its status: the answer may have come by email.
      const door = within(cards[1]!).getByTestId('procurement-answer-door')
      expect(door.textContent).toBe('Enter their answer…')
      expect(door.previousElementSibling!.getAttribute('data-testid')).toBe('procurement-status')
      fireEvent.click(door)
      expect(onAnswerItem).toHaveBeenLastCalledWith({ itemId: 'row-wc', partKey: 'k-josam' })
    } finally {
      window.matchMedia = real
      localStorage.removeItem('submittals_procure_lens')
    }
  })

  it('v2.4600 · on a phone To order is cards: an order with its name, count and note, its date in words under them, no table and no calendar; a part is a short card under its order', async () => {
    localStorage.setItem('submittals_procure_lens', 'to_order')
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-01T18:00:00Z'))
    state.updates = []
    state.records = [{ id: 'p1', bid_id: 'b1', tag: 'BFP-1', label: '', lead_time_days: null, stage: null, ordered_on: '2026-09-25', po_ref: '119', expected_on: '2026-10-20', delivered_on: null, note: '', sort_order: 0, created_at: '', updated_at: '' }]
    const real = window.matchMedia
    window.matchMedia = ((q: string) => ({ matches: q.includes('640'), media: q, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia
    try {
      const onAnswerItem = vi.fn()
      renderWithProviders(<SubmittalProcurementPanel bidId="b1" bidLabel="B482 Shipley" companyName="Click" items={[...items, { tag: 'S-3', product: 'Elkay sink', supplyHouse: null, leadTimeDays: 7, decision: null, shared: true, itemId: 'row-s3' }]} reviewerNames={[]} currentUser={{ id: 'u', name: 'Wendi' }} onAnswerItem={onAnswerItem} />)
      // The job's stage dates land a moment after the rows: wait for the order's date before reading the cards.
      await screen.findByText(/Order by 10\/06/)
      const groups = screen.getAllByTestId('procurement-group')
      expect(document.querySelector('table')).toBeNull()
      expect(screen.queryByTestId('procurement-cal')).toBeNull()
      // The calendar's words stay with the calendar: a phone is told neither that there are no dates nor what the marks mean.
      expect(screen.queryByTestId('procurement-key')).toBeNull()
      expect(screen.queryByTestId('procurement-shared')).toBeNull()
      expect(screen.getAllByTestId('procurement-section').map((x) => [x.tagName, x.textContent])).toEqual([['DIV', 'Order now · no house yet11 order to place, by date · set a house to order'], ['DIV', 'On order11 late'], ['DIV', 'Waiting on their answer11 fixture · not ordered until they approve']])
      // An order to place: how far off its date is rides in its name; Mark ordered… sits under the note.
      expect(within(groups[0]!).getByTestId('procurement-group-fold').textContent).toBe('Order by 10/06 · in 5 days1')
      expect(within(groups[0]!).getByTestId('procurement-group-note').textContent).toBe('WH-1 · Trim Set, needed 11/17 · 6 wk lead')
      expect(within(groups[0]!).getByTestId('procurement-group-right').textContent).toBe('Mark ordered…')
      // An order placed: the day it lands, in words, in place of its bar.
      expect(within(groups[1]!).getByTestId('procurement-group-fold').textContent).toBe('PO 1191')
      expect(within(groups[1]!).getByTestId('procurement-group-date').textContent).toBe('arrives 10/20, 14 days late')
      // A fixture that waits: its one door.
      expect(within(groups[2]!).getByTestId('procurement-group-right').textContent).toBe('Their answer…')
      fireEvent.click(within(groups[2]!).getByTestId('procurement-fixture-answer'))
      expect(onAnswerItem).toHaveBeenLastCalledWith({ itemId: 'row-s3', partKey: null })
      // The first order is open: its part is a short card, with the quantity when there is one and Dates… to open the editor.
      const cards = screen.getAllByTestId('procurement-row')
      expect(cards.map((c) => c.tagName)).toEqual(['DIV'])
      expect(cards[0]!.textContent).toBe('A.O. Smith BTH-199Dates…')
      openDates('WH-1')
      expect(screen.getByTestId('procurement-editor').tagName).toBe('DIV')
      // Mark ordered… opens its form under the card.
      fireEvent.click(within(groups[0]!).getByTestId('procurement-mark-open'))
      expect(screen.getByTestId('procurement-mark-form').tagName).toBe('DIV')
      expect(screen.getByTestId('procurement-mark-form').textContent).toContain('Mark 1 part ordered')
    } finally {
      window.matchMedia = real
      vi.useRealTimers()
      state.records = []
      localStorage.removeItem('submittals_procure_lens')
    }
  })
})
