// @vitest-environment jsdom
/**
 * The Banking side of the sub payment match (punch list #347): on Banking's ledger a bank line a sub payment took
 * says who it paid with a way back, a line that fits a payment offers it, and a press matches. The hook that
 * reads the payments is stood in for, so each test sets what the bank lines say. Made-up names.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import type { BankSideLine } from '../../lib/subWorkOrders/bankLineSubPayments'
import type { SubSendingResult } from '../../types/laborJob'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../lib/tickets/receiptStateIo', () => ({ loadReceiptStateFacts: async () => new Map() }))

const state = {
  byTx: new Map<string, BankSideLine>(),
  match: vi.fn(async (_tx: string, _payment: string): Promise<SubSendingResult> => ({ ok: true })),
  undo: vi.fn(async (_ids: readonly string[]): Promise<SubSendingResult> => ({ ok: true })),
}
const enabledWith: boolean[] = []
vi.mock('../../hooks/useBankLineSubPayments', () => ({
  useBankLineSubPayments: (enabled: boolean) => {
    enabledWith.push(enabled)
    return state
  },
}))

import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { BankingMercuryTable } from './BankingMercuryTable'

afterEach(() => {
  cleanup()
  state.byTx = new Map()
  vi.clearAllMocks()
  enabledWith.length = 0
})

type LedgerRow = Parameters<typeof BankingMercuryTable>[0]['displayRows'][number]
const tx = (id: string, payee: string, amount: number): LedgerRow =>
  ({
    id,
    mercury_id: `m-${id}`,
    mercury_account_id: 'acct',
    amount,
    currency: 'USD',
    created_at: '2026-11-12T15:00:00.000Z',
    posted_at: '2026-11-12T18:00:00.000Z',
    status: 'sent',
    kind: 'outgoingPayment',
    counterparty_id: null,
    counterparty_name: payee,
    note: null,
    external_memo: null,
    dashboard_link: null,
    mercury_category: null,
    raw: null,
    synced_at: '2026-11-12T19:00:00.000Z',
    source: 'mercury',
    manual_upload_id: null,
    created_by: null,
    duplicate_of_transaction_id: null,
  }) as LedgerRow

const rows = [tx('t-paid', 'CALLOWAY TILE LLC', -1500), tx('t-open', 'HARLOW DRYWALL', -400), tx('t-plain', 'Corner Fuel', -62.18)]
const setExpandedRowId = vi.fn()

const draw = (over: { subPaymentMatch?: boolean; combined?: boolean } = {}) =>
  renderWithProviders(
    <BankingMercuryTable
      displayRows={rows}
      sort={{ key: 'posted_at', dir: 'desc' }}
      onSortColumn={() => {}}
      expandedRowId={null}
      setExpandedRowId={setExpandedRowId}
      nicknameByAccount={{}}
      nicknameByDebitCard={{}}
      empty={{ main: 'No rows yet.' }}
      showAllocations={false}
      allocationsByTxId={new Map()}
      personIdByTxId={new Map()}
      userIdByTxId={new Map()}
      personNameById={{}}
      userNameById={{}}
      onEditAllocations={() => {}}
      counterpartyNoteCombined={over.combined ?? false}
      orgNotesByTxId={new Map()}
      onOrgNoteUpdated={() => {}}
      subPaymentMatch={over.subPaymentMatch}
    />,
  )

const unit = (paymentId: string, paidTo: string, amount: number, ymd: string, over: Record<string, unknown> = {}) => ({ paymentId, lineIds: [paymentId], amount, ymd, paidTo, sendingNo: null, jobs: ['2104 Larkspur'], days: 0, namesAgree: false, ...over })
const SAID = (): Map<string, BankSideLine> =>
  new Map<string, BankSideLine>([
    ['t-paid', { paid: { paymentIds: ['s1'], paidTo: ['Calloway Tile'], sendingNos: [12], lineCount: 2, amount: 1500 }, offers: [] }],
    ['t-open', { paid: null, offers: [unit('h1', 'Harlow Drywall', 400, '2026-11-12', { namesAgree: true }), unit('p1', 'Calloway Tile', 400, '2026-11-11', { days: 1 })] }],
  ])

const paidNote = (id: string) => document.querySelector(`[data-bank-sub-paid="${id}"]`) as HTMLElement | null
const picker = (id: string) => document.querySelector(`[data-bank-sub-match="${id}"]`) as HTMLSelectElement | null

describe('a bank line on Banking and the sub payments', () => {
  it('reads no sub payments, and draws nothing, on a table that does not ask for the match', async () => {
    state.byTx = SAID()
    draw()
    await settle()
    expect(enabledWith.every((on) => on === false)).toBe(true)
  })

  it('says who a matched line paid, offers the payments an open line could be, and leaves the rest alone', async () => {
    state.byTx = SAID()
    draw({ subPaymentMatch: true })
    await settle()
    expect(enabledWith.every((on) => on === true)).toBe(true)
    expect(paidNote('t-paid')!.textContent).toBe('paid Calloway Tile · sending 12 · 2 sheetsundo')
    expect(picker('t-paid')).toBeNull()
    expect([...picker('t-open')!.options].map((o) => o.textContent)).toEqual(['Match to a sub payment…', 'Nov 12 · Harlow Drywall · 2104 Larkspur · $400.00', 'Nov 11 · Calloway Tile · 2104 Larkspur · $400.00'])
    expect(paidNote('t-open')).toBeNull()
    expect(paidNote('t-plain')).toBeNull()
    expect(picker('t-plain')).toBeNull()
  })

  it('draws the same under the payee where the note shares its column', async () => {
    state.byTx = SAID()
    draw({ subPaymentMatch: true, combined: true })
    await settle()
    expect(paidNote('t-paid')!.textContent).toContain('paid Calloway Tile')
    expect(picker('t-open')).not.toBeNull()
  })

  it('a press matches the line to the payment chosen, and does not open the row', async () => {
    state.byTx = SAID()
    draw({ subPaymentMatch: true })
    await settle()
    fireEvent.click(picker('t-open')!)
    fireEvent.change(picker('t-open')!, { target: { value: 'h1' } })
    await waitFor(() => expect(state.match).toHaveBeenCalledWith('t-open', 'h1'))
    expect(setExpandedRowId).not.toHaveBeenCalled()
  })

  it('undo takes the line back from every payment on it', async () => {
    state.byTx = SAID()
    draw({ subPaymentMatch: true })
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Take this bank line off its sub payment' }))
    await waitFor(() => expect(state.undo).toHaveBeenCalledWith(['s1']))
    expect(setExpandedRowId).not.toHaveBeenCalled()
  })

  it('a refusal shows its reason', async () => {
    state.byTx = SAID()
    state.match.mockResolvedValueOnce({ ok: false, missing: false, message: 'that bank line is 400.00 and the payments on it would come to 800.00' })
    draw({ subPaymentMatch: true })
    await settle()
    fireEvent.change(picker('t-open')!, { target: { value: 'p1' } })
    await waitFor(() => expect(screen.getByText('that bank line is 400.00 and the payments on it would come to 800.00')).toBeTruthy())
  })

  it('a matched line whose payment this login cannot read still says a sub was paid, with no undo', async () => {
    state.byTx = new Map<string, BankSideLine>([['t-paid', { paid: { paymentIds: [], paidTo: [], sendingNos: [], lineCount: 0, amount: 0 }, offers: [] }]])
    draw({ subPaymentMatch: true })
    await settle()
    expect(paidNote('t-paid')!.textContent).toBe('paid a sub')
    expect(screen.queryByRole('button', { name: 'Take this bank line off its sub payment' })).toBeNull()
  })
})
