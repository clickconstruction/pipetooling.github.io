// @vitest-environment jsdom
/**
 * Bid history under the cells (punch list #73, PR 3): off, nothing is read and no cell grows; the
 * door's Past values switch turns every cell under the bid's provider on, and they read once; a
 * cell with no past stays empty; "+N more" opens the bid's History window searched on the row. The
 * reads are stand-ins; made-up people and bids.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import type { BidCellHistoryRpcRow } from '../../lib/bids/bidCellHistory'
import type { BidHistoryRow } from '../../lib/bids/bidHistory'

const historyRow: BidHistoryRow = {
  source: 'ledger', id: 1, archiveId: null, bidId: 'bid-1', bidNumber: 'B494', table: 'bid_count_row_custom_prices', recordId: 'p-1',
  countRowId: 'c1', op: 'update', changed: ['unit_price'], oldValues: { unit_price: 9800 }, newValues: { unit_price: 10300 },
  label: 'Lav-1', changedBy: 'u-ann', changedByName: 'Ann', changedAt: '2026-10-08T15:00:00.000Z', action: null, byApp: null,
}
const loadHistory = vi.fn(async (_bidId: string) => [historyRow])
vi.mock('../../lib/bids/loadBidHistory', () => ({ loadBidHistory: (id: string) => loadHistory(id), putBackBidChange: vi.fn(), loadBidRemovedRows: async () => [], restoreBidRemovedRow: vi.fn(), loadCanEditBid: async () => false, removeBidAddedRows: vi.fn(), loadBidUndoUnseen: async () => new Map() }))

import { BidCellPast } from './BidCellPast'
import { BidHistoryDoor } from './BidHistoryDoor'
import { BidCellHistoryProvider } from '../../hooks/useBidHistoryCells'
import { countCellKeys, priceCellKeys } from '../../lib/bids/bidCellHistory'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'

const cellRow = (over: Partial<BidCellHistoryRpcRow>): BidCellHistoryRpcRow => ({
  cell_key: 'price:c1:pb1', name_key: 'price:pb1:lav-1', kind: 'changed', column_name: 'unit_price', label: 'Lav-1', value: 9800,
  changed_by_name: 'Ann', changed_at: new Date().toISOString(), rank: 1, total: 3, ...over,
})

afterEach(() => {
  cleanup()
  loadHistory.mockClear()
  localStorage.clear()
})

function sheet(load: (bidId: string) => Promise<BidCellHistoryRpcRow[]>) {
  renderWithProviders(
    <BidCellHistoryProvider bidId="bid-1" load={load}>
      <h2>Elm St <BidHistoryDoor bid={{ id: 'bid-1', label: 'Elm St · B494', bidNumber: 'B494' }} /></h2>
      <table><tbody><tr>
        <td>$10,300<BidCellPast keys={priceCellKeys('c1', 'pb1', 'Lav-1')} label="Lav-1" /></td>
        <td>4<BidCellPast keys={countCellKeys('c1', 'v1', 'Lav-1')} label="Lav-1" /></td>
      </tr></tbody></table>
    </BidCellHistoryProvider>,
  )
}

describe('BidCellPast', () => {
  it('reads nothing and draws nothing while Past values is off', async () => {
    const load = vi.fn(async () => [cellRow({})])
    sheet(load)
    await settle()
    expect(load).not.toHaveBeenCalled()
    expect(screen.queryByTestId('bid-cell-past')).toBeNull()
    expect(screen.getByRole('button', { name: 'Past values off' }).getAttribute('aria-pressed')).toBe('false')
  })

  it('the switch turns the cells on, read once; a cell with no past stays empty', async () => {
    const load = vi.fn(async () => [cellRow({ value: 10500 }), cellRow({ value: 9800, rank: 2, changed_by_name: 'Ben' })])
    sheet(load)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Past values off' }))
    await settle()
    expect(load).toHaveBeenCalledTimes(1)
    expect(load).toHaveBeenCalledWith('bid-1')
    const past = screen.getAllByTestId('bid-cell-past')
    expect(past).toHaveLength(1)
    expect(past[0]!.textContent).toBe('$10,500 · Ann · today$9,800 · Ben · today+1 more')
    expect(screen.getByRole('button', { name: 'Past values on' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('a read that fails shows no past', async () => {
    localStorage.setItem('bid_history_cells_v1', 'on')
    sheet(async () => { throw new Error('no such function') })
    await settle()
    expect(screen.queryByTestId('bid-cell-past')).toBeNull()
  })

  it('“+N more” opens the History window searched on the row', async () => {
    localStorage.setItem('bid_history_cells_v1', 'on')
    sheet(async () => [cellRow({})])
    await settle()
    fireEvent.click(screen.getByRole('button', { name: '+2 more' }))
    await settle()
    expect(loadHistory).toHaveBeenCalledWith('bid-1')
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect((screen.getByRole('searchbox', { name: 'Find a fixture or a value' }) as HTMLInputElement).value).toBe('Lav-1')
  })
})
