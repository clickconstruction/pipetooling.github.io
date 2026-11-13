// @vitest-environment jsdom
/**
 * The receipt's state where the money is read (punch list #299, PR 3): the Banking ledger's charge row and Job
 * Summary's cost drill-down each draw a chip beside a card charge with its paper, one the app texted about, and one it
 * could not text, and draw nothing for a charge with nothing to say. The read is stood in for. Made-up rows.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import type { ReceiptStateFacts } from '../../lib/tickets/receiptState'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

const loadReceiptStateFacts = vi.fn(async (_ids: readonly string[]) => new Map<string, ReceiptStateFacts>())
vi.mock('../../lib/tickets/receiptStateIo', () => ({ loadReceiptStateFacts: (ids: readonly string[]) => loadReceiptStateFacts(ids) }))

import { BankingMercuryTable } from '../banking/BankingMercuryTable'
import { JobSummaryDrilldownMercuryTable } from '../jobs/JobSummaryCostCellDrilldownModal'

const hoursAgo = (h: number) => new Date(Date.now() - h * 60 * 60 * 1000).toISOString()
const request = (more: Record<string, unknown> = {}) => ({ holder_name: 'Jordan Vance', no_text_why: null, texted_at: null, reminded_at: null, answered_at: null, closed_at: null, text_tries: 0, ...more })

const FACTS = () =>
  new Map<string, ReceiptStateFacts>([
    ['t-paper', { ticket: { source: 'link' }, request: null }],
    ['t-texted', { ticket: null, request: request({ texted_at: hoursAgo(1) }) }],
    ['t-held', { ticket: null, request: request({ no_text_why: 'no_cell' }) }],
  ])

beforeEach(() => {
  loadReceiptStateFacts.mockReset()
  loadReceiptStateFacts.mockImplementation(async () => FACTS())
})
afterEach(cleanup)

const chipIn = (row: HTMLElement) => within(row).queryByTestId('receipt-state-chip')

describe('the Banking ledger', () => {
  type LedgerRow = Parameters<typeof BankingMercuryTable>[0]['displayRows'][number]
  const tx = (id: string, store: string, over: Partial<LedgerRow> = {}): LedgerRow =>
    ({
      id,
      mercury_id: `m-${id}`,
      mercury_account_id: 'acct',
      amount: -42.5,
      currency: 'USD',
      created_at: hoursAgo(30),
      posted_at: hoursAgo(20),
      status: 'sent',
      kind: 'debitCardTransaction',
      counterparty_id: null,
      counterparty_name: store,
      note: null,
      external_memo: null,
      dashboard_link: null,
      mercury_category: null,
      raw: null,
      synced_at: hoursAgo(1),
      source: 'mercury',
      manual_upload_id: null,
      created_by: null,
      duplicate_of_transaction_id: null,
      ...over,
    }) as LedgerRow

  const rows = [tx('t-paper', 'Ridgeway Supply'), tx('t-texted', 'Corner Fuel'), tx('t-held', 'Cedar Bend Hardware'), tx('t-plain', 'Plain Store'), tx('t-check', 'A Vendor', { kind: 'outgoingPayment' }), tx('t-old', 'Old Store', { posted_at: '2026-01-05T12:00:00.000Z', created_at: '2026-01-04T12:00:00.000Z' })]

  const draw = (combined: boolean) =>
    renderWithProviders(
      <BankingMercuryTable
        displayRows={rows}
        sort={{ key: 'posted_at', dir: 'desc' }}
        onSortColumn={() => {}}
        expandedRowId={null}
        setExpandedRowId={() => {}}
        nicknameByAccount={{}}
        nicknameByDebitCard={{}}
        empty={{ kind: 'nothing-waiting', what: 'the ledger' } as never}
        showAllocations={false}
        allocationsByTxId={new Map()}
        personIdByTxId={new Map()}
        userIdByTxId={new Map()}
        personNameById={{}}
        userNameById={{}}
        onEditAllocations={() => {}}
        counterpartyNoteCombined={combined}
        orgNotesByTxId={new Map()}
        onOrgNoteUpdated={() => {}}
      />,
    )

  const rowOf = (store: string) => screen.getByText(store).closest('tr') as HTMLElement

  it('asks about the recent card charges alone, and draws each one’s state beside its store', async () => {
    draw(false)
    await waitFor(() => expect(loadReceiptStateFacts).toHaveBeenCalledTimes(1))
    // Not the check, and not the charge from January.
    expect([...loadReceiptStateFacts.mock.calls[0]![0]].sort()).toEqual(['t-held', 't-paper', 't-plain', 't-texted'])
    await settle()
    expect(chipIn(rowOf('Ridgeway Supply'))!.textContent).toBe('Receipt from the link')
    expect(chipIn(rowOf('Ridgeway Supply'))!.getAttribute('data-tone')).toBe('has')
    expect(chipIn(rowOf('Corner Fuel'))!.textContent).toMatch(/^Texted \d{1,2}:\d{2} [AP]M$/)
    expect(chipIn(rowOf('Corner Fuel'))!.getAttribute('title')).toBe('No receipt yet.')
    expect(chipIn(rowOf('Cedar Bend Hardware'))!.textContent).toBe('No text')
    expect(chipIn(rowOf('Cedar Bend Hardware'))!.getAttribute('title')).toBe('Jordan has no cell on file. Add the cell on People, and the next charge texts them.')
    expect(chipIn(rowOf('Plain Store'))).toBeNull()
    expect(chipIn(rowOf('A Vendor'))).toBeNull()
    expect(chipIn(rowOf('Old Store'))).toBeNull()
  })

  it('draws the same on the Sorting tab’s combined cell', async () => {
    draw(true)
    await waitFor(() => expect(loadReceiptStateFacts).toHaveBeenCalled())
    await settle()
    expect(chipIn(rowOf('Ridgeway Supply'))!.textContent).toBe('Receipt from the link')
    expect(screen.getAllByTestId('receipt-state-chip')).toHaveLength(3)
  })

  it('a read with nothing to say leaves the ledger as it was', async () => {
    loadReceiptStateFacts.mockImplementation(async () => new Map())
    draw(false)
    await waitFor(() => expect(loadReceiptStateFacts).toHaveBeenCalled())
    await settle()
    expect(screen.queryByTestId('receipt-state-chip')).toBeNull()
    expect(screen.getByText('Ridgeway Supply')).toBeTruthy()
  })
})

describe('Job Summary’s cost drill-down', () => {
  const line = (id: string, chargeId: string, store: string, postedAt: string | null = hoursAgo(20)) => ({
    id,
    mercury_transaction_id: chargeId,
    amount: -42.5,
    note: null,
    attributionDisplayName: 'Jordan Vance',
    mercury_transactions: { posted_at: postedAt, counterparty_name: store, amount: -42.5, note: null, external_memo: null, raw: null },
  })

  const draw = (rows: ReturnType<typeof line>[]) => renderWithProviders(<JobSummaryDrilldownMercuryTable rows={rows} formatPosted={(iso) => iso.slice(0, 10)} formatCurrency={(n) => `$${n}`} nicknameByDebitCard={{}} />)
  const rowOf = (store: string) => screen.getByText(store).closest('tr') as HTMLElement

  it('adds a Receipt column with each charge’s state, a charge split across two lines asked about once', async () => {
    draw([line('l1', 't-paper', 'Ridgeway Supply'), line('l2', 't-held', 'Cedar Bend Hardware'), line('l3', 't-plain', 'Plain Store'), line('l4', 't-plain', 'Plain Store Too')])
    await waitFor(() => expect(loadReceiptStateFacts).toHaveBeenCalledTimes(1))
    expect([...loadReceiptStateFacts.mock.calls[0]![0]].sort()).toEqual(['t-held', 't-paper', 't-plain'])
    expect(await screen.findByRole('columnheader', { name: 'Receipt' })).toBeTruthy()
    expect(chipIn(rowOf('Ridgeway Supply'))!.textContent).toBe('Receipt from the link')
    expect(chipIn(rowOf('Cedar Bend Hardware'))!.textContent).toBe('No text')
    expect(chipIn(rowOf('Plain Store'))).toBeNull()
  })

  it('draws no Receipt column when no charge has anything to say, and asks nothing for old charges', async () => {
    loadReceiptStateFacts.mockImplementation(async () => new Map())
    draw([line('l1', 't-plain', 'Plain Store'), line('l2', 't-old', 'Old Store', '2026-01-05T12:00:00.000Z')])
    await waitFor(() => expect(loadReceiptStateFacts).toHaveBeenCalledWith(['t-plain']))
    await settle()
    expect(screen.queryByRole('columnheader', { name: 'Receipt' })).toBeNull()
    expect(screen.getByRole('columnheader', { name: 'Note' })).toBeTruthy()
  })
})
