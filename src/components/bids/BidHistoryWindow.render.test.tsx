// @vitest-environment jsdom
/**
 * Bid history, the window (punch list #73, PR 2): actions not rows, newest first under their day;
 * an action opens to its rows; filters by tab and person; the search; an adopted bid's actions
 * carry its number; a removed row from the archive says so; a failed read says so. The read is a
 * stand-in; made-up people and bids.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { BidHistoryWindow } from './BidHistoryWindow'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import type { BidHistoryRow } from '../../lib/bids/bidHistory'
import { BID_HISTORY_PUT_BACK_EVENT, type BidPutBackResult, type BidRemovedRow, type BidRestoreResult } from '../../lib/bids/bidHistoryPutBack'

afterEach(cleanup)

let n = 0
function row(over: Partial<BidHistoryRow>): BidHistoryRow {
  n += 1
  return {
    source: 'ledger', id: n, archiveId: null, bidId: 'bid-1', bidNumber: 'B494', table: 'bids_count_rows', recordId: `r-${n}`,
    countRowId: null, op: 'insert', changed: ['fixture', 'count'], oldValues: null, newValues: { fixture: 'Lav-1', count: 4 },
    label: 'Lav-1', changedBy: 'u-ann', changedByName: 'Ann', changedAt: '2026-10-08T15:00:00.000Z', action: 'counts-import', byApp: false,
    ...over,
  }
}
const at = (s: number) => new Date(Date.parse('2026-10-08T15:00:00.000Z') + s * 1000).toISOString()
const NOW = () => new Date('2026-10-08T20:00:00Z')

const rows: BidHistoryRow[] = [
  ...Array.from({ length: 3 }, (_, i) => row({ changedAt: at(i), label: `Fixture ${i + 1}`, newValues: { fixture: `Fixture ${i + 1}`, count: i + 1 } })),
  row({ changedAt: at(120), table: 'bid_count_row_custom_prices', op: 'update', changed: ['unit_price'], oldValues: { unit_price: 9800 }, newValues: { unit_price: 10300 }, action: null, byApp: null, changedBy: 'u-ben', changedByName: 'Ben' }),
  row({ changedAt: '2026-10-07T15:00:00.000Z', bidId: 'bid-0', bidNumber: 'B377', action: null, byApp: null, label: 'WC-1', newValues: { fixture: 'WC-1', count: 40 } }),
  row({ changedAt: '2026-10-06T15:00:00.000Z', source: 'archive', id: null, archiveId: 'a1', op: 'delete', action: null, byApp: null, label: 'SUMP', oldValues: { fixture: 'SUMP', count: 2 }, newValues: null }),
]

async function open(
  load: (id: string, from: number) => Promise<BidHistoryRow[]> = async () => rows,
  putBack?: (changeId: number, column: string) => Promise<BidPutBackResult>,
  loadRemoved: (bidId: string) => Promise<BidRemovedRow[]> = async () => [],
  restoreRemoved?: (archiveId: string) => Promise<BidRestoreResult>,
) {
  renderWithProviders(<BidHistoryWindow bid={{ id: 'bid-1', label: 'Elm St · B494', bidNumber: 'B494' }} onClose={vi.fn()} load={load} putBack={putBack} loadRemoved={loadRemoved} restoreRemoved={restoreRemoved} now={NOW} />)
  await settle()
  return screen.getByRole('dialog')
}

describe('BidHistoryWindow', () => {
  it('one line per action, newest first, under its day', async () => {
    const d = await open()
    expect(within(d).getByText('Changed Lav-1 price')).toBeTruthy()
    expect(within(d).getByText('Imported 3 rows from CountTooling')).toBeTruthy()
    const days = within(d).getAllByRole('heading', { level: 4 }).map((h) => h.textContent)
    expect(days).toEqual(['Today', 'Yesterday', 'Tuesday'])
    const today = within(d).getByRole('region', { name: 'Today' })
    expect(within(today).getAllByRole('listitem').filter((li) => li.querySelector('strong')).map((li) => li.querySelector('strong')!.textContent)).toEqual(['Changed Lav-1 price', 'Imported 3 rows from CountTooling'])
  })

  it('a single-row action shows its line; a burst opens to its rows', async () => {
    const d = await open()
    expect(within(d).getByText(/price · \$9,800 → \$10,300/)).toBeTruthy()
    expect(within(d).queryByText(/Fixture 2/)).toBeNull()
    fireEvent.click(within(d).getByRole('button', { name: 'Show the 3 rows' }))
    expect(within(d).getByText('Fixture 2')).toBeTruthy()
  })

  it('an adopted bid’s actions carry its number, and the window says it is included', async () => {
    const d = await open()
    expect(within(d).getByText(/Includes B377, adopted into this bid/)).toBeTruthy()
    expect(within(d).getByText(/Ann · Counts · B377/)).toBeTruthy()
  })

  it('a row from the archive says where it comes from', async () => {
    const d = await open()
    expect(within(d).getByText(/Counts · B494 · from the delete archive/)).toBeTruthy()
    expect(within(d).getByText(/Rows marked from the delete archive were removed before that/)).toBeTruthy()
    expect(within(d).getByText(/removed · kept 90 days · count 2/)).toBeTruthy()
  })

  it('filters by tab and by person, and searches values', async () => {
    const d = await open()
    fireEvent.click(within(within(d).getByRole('group', { name: 'Show changes on' })).getByRole('button', { name: 'Pricing' }))
    expect(within(d).queryByText('Imported 3 rows from CountTooling')).toBeNull()
    fireEvent.click(within(within(d).getByRole('group', { name: 'Show changes on' })).getByRole('button', { name: 'All' }))
    fireEvent.click(within(within(d).getByRole('group', { name: 'Show changes by' })).getByRole('button', { name: 'Ben' }))
    expect(within(d).getByText('Changed Lav-1 price')).toBeTruthy()
    expect(within(d).queryByText('Removed SUMP')).toBeNull()
    fireEvent.click(within(within(d).getByRole('group', { name: 'Show changes by' })).getByRole('button', { name: 'Everyone' }))
    fireEvent.change(within(d).getByRole('searchbox', { name: 'Find a fixture or a value' }), { target: { value: 'sump' } })
    expect(within(d).getByText('Removed SUMP')).toBeTruthy()
    expect(within(d).queryByText('Changed Lav-1 price')).toBeNull()
  })

  it('a failed read says so', async () => {
    const d = await open(async () => { throw new Error('function list_bid_history does not exist') })
    expect(within(d).getByRole('alert').textContent).toMatch(/could not be read: function list_bid_history does not exist/)
  })

  it('a changed value and a removed row of this bid offer Put back; an addition and an adopted bid’s row do not', async () => {
    const d = await open()
    // The removed SUMP is a dev's archive line here; PR 5 lets it come back.
    expect(within(d).getAllByRole('button', { name: /^Put back/ }).map((b) => b.getAttribute('aria-label'))).toEqual(['Put back Lav-1 price to $9,800', 'Put back SUMP'])
  })

  it('Put back writes the old value, reads the history again, and tells the open bid’s tabs', async () => {
    const priceChange = rows.find((r) => r.table === 'bid_count_row_custom_prices')!
    const load = vi.fn(async () => rows)
    const putBack = vi.fn(async (): Promise<BidPutBackResult> => ({
      table: 'bid_count_row_custom_prices', record_id: priceChange.recordId, label: 'Lav-1', columns: ['unit_price'], before: { unit_price: 10300 }, after: { unit_price: 9800 },
    }))
    const heard = vi.fn()
    const hear = (e: Event) => heard((e as CustomEvent).detail)
    window.addEventListener(BID_HISTORY_PUT_BACK_EVENT, hear)
    try {
      const d = await open(load, putBack)
      fireEvent.click(within(d).getByRole('button', { name: 'Put back Lav-1 price to $9,800' }))
      await settle()
      expect(putBack).toHaveBeenCalledWith(priceChange.id, 'unit_price')
      expect(within(d).getByRole('status').textContent).toBe('Lav-1 price is $9,800 again.')
      expect(load).toHaveBeenCalledTimes(2)
      expect(heard).toHaveBeenCalledWith({ bidId: 'bid-1', table: 'bid_count_row_custom_prices' })
    } finally {
      window.removeEventListener(BID_HISTORY_PUT_BACK_EVENT, hear)
    }
  })

  it('a refused put back says why under its line, and changes nothing', async () => {
    const load = vi.fn(async () => rows)
    const heard = vi.fn()
    window.addEventListener(BID_HISTORY_PUT_BACK_EVENT, heard)
    try {
      const d = await open(load, async () => { throw new Error('That row was removed since. Put the row back first.') })
      fireEvent.click(within(d).getByRole('button', { name: 'Put back Lav-1 price to $9,800' }))
      await settle()
      expect(within(d).getByRole('alert').textContent).toBe('That row was removed since. Put the row back first.')
      expect(load).toHaveBeenCalledTimes(1)
      expect(heard).not.toHaveBeenCalled()
    } finally {
      window.removeEventListener(BID_HISTORY_PUT_BACK_EVENT, heard)
    }
  })

  it('a bid past one page (1,001 changes) shows the first page but its oldest action, then the rest on Show older changes', async () => {
    // One change a minute, so each is its own action; newest first, as the read returns them.
    const many = Array.from({ length: 1001 }, (_, i) => row({ changedAt: at(-60 * i), action: null, byApp: null, label: `Fixture ${i + 1}`, newValues: { fixture: `Fixture ${i + 1}`, count: 1 } }))
    const load = vi.fn(async (_id: string, from: number) => many.slice(from, from + 1000))
    const d = await open(load)
    // The page's oldest action may go on past its edge, so it waits for the older page.
    expect(within(d).getByText(/^999 changes so far by 1 author\./)).toBeTruthy()
    expect(within(d).getByText(/Older changes are not shown yet/)).toBeTruthy()
    expect(within(d).queryByText('Added Fixture 1000')).toBeNull()
    expect(within(d).queryByText('Added Fixture 1001')).toBeNull()
    fireEvent.click(within(d).getByRole('button', { name: 'Show older changes' }))
    await settle()
    expect(load).toHaveBeenLastCalledWith('bid-1', 1000)
    expect(within(d).getByText(/^1,001 changes by 1 author\./)).toBeTruthy()
    expect(within(d).getByText('Added Fixture 1000')).toBeTruthy()
    expect(within(d).getByText('Added Fixture 1001')).toBeTruthy()
    expect(within(d).queryByRole('button', { name: 'Show older changes' })).toBeNull()
  })

  it('a full page that is one action is drawn, marked as going on in older changes', async () => {
    const one = Array.from({ length: 1000 }, (_, i) => row({ changedAt: at(-i * 0.001), label: `Fixture ${i + 1}` }))
    const d = await open(async () => one)
    expect(within(d).getByText(/^1 change so far by 1 author\./)).toBeTruthy()
    expect(within(d).getByText(/continues in older changes/)).toBeTruthy()
  })

  it('a bid with nothing yet says so', async () => {
    const d = await open(async () => [])
    expect(within(d).getByText('Nothing has changed on this bid since its history began.')).toBeTruthy()
  })
})

describe('BidHistoryWindow · a removed row put back (punch list #73 PR 5)', () => {
  // A delete of SUMP with its price, one action, in the ledger; and a labor row removed before the ledger.
  const T = '2026-10-08T17:00:00.000Z'
  const sumpRemoved = row({ changedAt: T, op: 'delete', recordId: 'c-sump', countRowId: 'c-sump', label: 'SUMP', oldValues: { fixture: 'SUMP', count: 2 }, newValues: null, action: null, byApp: null })
  const priceRemoved = row({ changedAt: T, table: 'bid_count_row_custom_prices', op: 'delete', recordId: 'p-sump', countRowId: 'c-sump', label: 'SUMP', changed: ['unit_price'], oldValues: { unit_price: 3700 }, newValues: null, action: null, byApp: null })
  const history = [sumpRemoved, priceRemoved]
  const removedList: BidRemovedRow[] = [
    { archiveId: 'ar-sump', table: 'bids_count_rows', recordId: 'c-sump', countRowId: 'c-sump', label: 'SUMP', oldValues: { fixture: 'SUMP', count: 2 }, changed: ['count', 'fixture'], changedBy: 'u-ann', changedByName: 'Ann', changedAt: '2026-10-08T17:00:00+00:00', inLedger: true },
    { archiveId: 'ar-price', table: 'bid_count_row_custom_prices', recordId: 'p-sump', countRowId: 'c-sump', label: 'SUMP', oldValues: { unit_price: 3700 }, changed: ['unit_price'], changedBy: 'u-ann', changedByName: 'Ann', changedAt: '2026-10-08T17:00:00+00:00', inLedger: true },
    { archiveId: 'ar-old', table: 'cost_estimate_labor_rows', recordId: 'l-old', countRowId: null, label: 'WC-2', oldValues: { fixture: 'WC-2', rough_in_hrs_per_unit: 1 }, changed: ['fixture'], changedBy: null, changedByName: null, changedAt: '2026-10-01T15:00:00.000Z', inLedger: false },
  ]

  it('someone who can edit the bid sees its removals from before the ledger, and Put back where it can bring the row back', async () => {
    const d = await open(async () => history, undefined, async () => removedList)
    // The removal of SUMP and its price is one action; its rows open to their Put back, as a changed value's do.
    fireEvent.click(within(d).getByRole('button', { name: 'Show the 2 rows' }))
    expect(within(d).getAllByRole('button', { name: /^Put back/ }).map((b) => b.getAttribute('aria-label'))).toEqual(['Put back SUMP', 'Put back WC-2'])
    // The labor row from before the ledger joins the list, marked as the archive's, and the foot says why.
    expect(within(d).getByText(/· from the delete archive/)).toBeTruthy()
    expect(within(d).getByText(/Rows marked from the delete archive were removed before that/)).toBeTruthy()
  })

  it('someone who cannot edit the bid reads the removal with no Put back', async () => {
    const d = await open(async () => history, undefined, async () => [])
    fireEvent.click(within(d).getByRole('button', { name: 'Show the 2 rows' }))
    expect(within(d).queryAllByRole('button', { name: /^Put back/ })).toEqual([])
  })

  it('Put back brings the row back with what hung on it, reads the history again, and tells the open bid’s tabs', async () => {
    const load = vi.fn(async () => history)
    const loadRemoved = vi.fn(async () => removedList)
    const restoreRemoved = vi.fn(async (): Promise<BidRestoreResult> => ({ ok: true, bid_id: 'bid-1', restored: 3, tables: { bids_count_rows: 1, bid_count_row_custom_prices: 1, bid_submittal_takeoff_choices: 1 }, warnings: [] }))
    const heard = vi.fn()
    const hear = (e: Event) => heard((e as CustomEvent).detail)
    window.addEventListener(BID_HISTORY_PUT_BACK_EVENT, hear)
    try {
      const d = await open(load, undefined, loadRemoved, restoreRemoved)
      fireEvent.click(within(d).getByRole('button', { name: 'Show the 2 rows' }))
      fireEvent.click(within(d).getByRole('button', { name: 'Put back SUMP' }))
      await settle()
      expect(restoreRemoved).toHaveBeenCalledWith('ar-sump')
      expect(within(d).getByRole('status').textContent).toBe('SUMP is back, with 2 rows that hung on it.')
      expect(load).toHaveBeenCalledTimes(2)
      expect(loadRemoved).toHaveBeenCalledTimes(2)
      expect(heard).toHaveBeenCalledWith({ bidId: 'bid-1', table: 'bids_count_rows' })
    } finally {
      window.removeEventListener(BID_HISTORY_PUT_BACK_EVENT, hear)
    }
  })

  it('a refused put back says why, in the function’s words, and reads nothing again', async () => {
    const load = vi.fn(async () => history)
    const restoreRemoved = vi.fn(async (): Promise<BidRestoreResult> => {
      throw new Error('That row, or one like it, is already on the bid, so it cannot come back.')
    })
    const d = await open(load, undefined, async () => removedList, restoreRemoved)
    fireEvent.click(within(d).getByRole('button', { name: 'Put back WC-2' }))
    await settle()
    expect(restoreRemoved).toHaveBeenCalledWith('ar-old')
    expect(within(d).getByRole('alert').textContent).toBe('That row, or one like it, is already on the bid, so it cannot come back.')
    expect(load).toHaveBeenCalledTimes(1)
  })
})
