// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { SupplyBankUnclaimed } from './SupplyBankUnclaimed'
import { SupplyPaymentWindow } from './SupplyPaymentWindow'
import { SupplyPaymentsToFinish } from './SupplyPaymentsToFinish'
import { RecordSupplyPaymentModal } from './RecordSupplyPaymentModal'
import type { SupplyBankCandidate, SupplyBankLine, UnclaimedHouseLine } from '../../lib/materials/payments/supplyPaymentBank'
import type { SupplyPayment } from '../../lib/materials/payments/supplyPayment'
import type { PaymentToFinish } from '../../lib/materials/payments/supplyPaymentsFinish'
import type { SupplyFinishIo } from '../../lib/materials/payments/supplyPaymentsFinishIo'
import type { SupplyPaymentsIo } from '../../lib/materials/payments/supplyPaymentsIo'

// Made-up houses, payments and bank lines.
const ach: SupplyBankLine = { id: 't1', amount: 4812.6, ymd: '2026-11-15', payee: 'PECAN SUPPLY ACH', memo: '', method: 'ach' }
const card: SupplyBankLine = { id: 't2', amount: 1527.58, ymd: '2026-11-14', payee: 'CEDAR FORK SUP', memo: '', method: 'card' }
const unclaimed: UnclaimedHouseLine[] = [
  { line: ach, houseId: 'h1', houseName: 'Pecan Supply' },
  { line: card, houseId: 'h2', houseName: 'Cedar Fork Supply' },
]
const payment: SupplyPayment = { id: 'p1', supply_house_id: 'h1', paid_on: '2026-11-15', amount: 4812.6, method: 'ach', method_ref: null, receipt_link: null, source: 'recorded', removed_at: null }
const windowProps = { payment, payments: [payment], lines: [{ id: 'l1', payment_id: 'p1', invoice_id: 'x', amount: 4812.6 }], bills: [{ id: 'x', invoice_number: 'S1', title: '', amount: 4812.6, is_paid: true }], houseName: 'Pecan Supply', todayYmd: '2026-11-16', onClose: () => {}, onRemove: async () => {}, onMove: async () => {}, onUndoMove: async () => {} }

describe('bank lines to a house that no payment claims', () => {
  it('draws nothing at none, and counts them folded with their total', () => {
    const { rerender } = renderWithProviders(<SupplyBankUnclaimed lines={[]} todayYmd="2026-11-16" onSay={() => {}} />)
    expect(screen.queryByTestId('supply-bank-unclaimed')).toBeNull()
    rerender(<SupplyBankUnclaimed lines={unclaimed} todayYmd="2026-11-16" onSay={() => {}} />)
    const head = screen.getByRole('button', { name: /2 bank lines to supply houses have no payment recorded/ })
    expect(head.textContent).toContain('$6,340.18')
    expect(screen.queryByTestId('supply-bank-unclaimed-line')).toBeNull()
  })

  it('lists each with its house, method and day, and hands the line back on Say what it paid', () => {
    const onSay = vi.fn()
    renderWithProviders(<SupplyBankUnclaimed lines={unclaimed} todayYmd="2026-11-16" onSay={onSay} />)
    fireEvent.click(screen.getByRole('button', { name: /2 bank lines/ }))
    expect(screen.getAllByTestId('supply-bank-unclaimed-line').map((r) => r.textContent)).toEqual(['Pecan Supply · ACH · 11/15PECAN SUPPLY ACH$4,812.60Say what it paid', 'Cedar Fork Supply · Card · 11/14CEDAR FORK SUP$1,527.58Say what it paid'])
    fireEvent.click(screen.getByRole('button', { name: 'Say what the $1,527.58 to Cedar Fork Supply paid' }))
    expect(onSay).toHaveBeenCalledWith(unclaimed[1])
  })
})

describe('a payment and its bank line', () => {
  it('offers the line for the same money, and matches on the press', async () => {
    const onMatch = vi.fn(async () => {})
    const candidate: SupplyBankCandidate = { ...ach, days: 0, isHouse: true }
    renderWithProviders(<SupplyPaymentWindow {...windowProps} bank={{ matched: null, hasMatch: false, candidates: [candidate], onMatch, onUnmatch: async () => {} }} />)
    const block = screen.getByTestId('supply-payment-window-bank')
    expect(block.textContent).toContain('The bank has a line for the same money.')
    expect(block.textContent).toContain('11/15 · PECAN SUPPLY ACH · $4,812.60')
    fireEvent.click(within(block).getByRole('button', { name: 'Match to the bank line of 11/15' }))
    expect(onMatch).toHaveBeenCalledWith('t1')
  })

  it('says Bank agrees once matched, with a way off', () => {
    const onUnmatch = vi.fn(async () => {})
    renderWithProviders(<SupplyPaymentWindow {...windowProps} bank={{ matched: ach, hasMatch: true, candidates: [], onMatch: async () => {}, onUnmatch }} />)
    const block = screen.getByTestId('supply-payment-window-bank')
    expect(block.textContent).toContain('Bank agrees ✓ 11/15 · PECAN SUPPLY ACH · $4,812.60')
    fireEvent.click(within(block).getByRole('button', { name: 'Take it off' }))
    expect(onUnmatch).toHaveBeenCalledTimes(1)
  })

  it('draws no bank line when the feed has none for it', () => {
    renderWithProviders(<SupplyPaymentWindow {...windowProps} bank={{ matched: null, hasMatch: false, candidates: [], onMatch: async () => {}, onUnmatch: async () => {} }} />)
    expect(screen.queryByTestId('supply-payment-window-bank')).toBeNull()
  })
})

describe('the finish-later list and the bank', () => {
  const waiting: PaymentToFinish = { id: 'a', supply_house_id: 'h1', paid_on: '2026-11-14', amount: 412.8, method: null, method_ref: null, receipt_link: null, source: 'mark_paid', removed_at: null, houseName: 'Pecan Supply', billNumbers: ['S4388310'] }
  const io: SupplyFinishIo = { loadToFinish: vi.fn(async () => [waiting]), countToFinish: vi.fn(async () => 1), saveHowSent: vi.fn(async () => {}) }

  it('offers Use this line when the bank holds the same money to that house', async () => {
    const onUseLine = vi.fn(async () => {})
    renderWithProviders(<SupplyPaymentsToFinish io={io} todayYmd="2026-11-16" openAtStart bankFor={() => ({ id: 't9', words: '11/13 · PECAN SUPPLY ACH · $412.80' })} onUseLine={onUseLine} />)
    const offer = await screen.findByTestId('supply-payment-to-finish-bank')
    expect(offer.textContent).toContain('The bank has it: 11/13 · PECAN SUPPLY ACH · $412.80')
    fireEvent.click(within(offer).getByRole('button', { name: 'Use this line' }))
    expect(onUseLine).toHaveBeenCalledWith('a', 't9')
  })

  it('offers nothing when the bank has no line for it', async () => {
    renderWithProviders(<SupplyPaymentsToFinish io={io} todayYmd="2026-11-16" openAtStart bankFor={() => null} onUseLine={async () => {}} />)
    await screen.findByTestId('supply-payment-to-finish')
    expect(screen.queryByTestId('supply-payment-to-finish-bank')).toBeNull()
  })
})

describe('Record a payment, opened from a bank line', () => {
  it('fills the amount, the day and the method, and ticks the oldest bills it covers', async () => {
    const payIo: SupplyPaymentsIo = { loadHouse: vi.fn(async () => ({ payments: [], lines: [] })), record: vi.fn(), remove: vi.fn(), restore: vi.fn(), move: vi.fn(), undoMove: vi.fn() }
    const bills = [
      { id: 'b1', invoice_number: '77120', due_date: '2026-10-15', amount: 1000, is_paid: false, title: 'Job A' },
      { id: 'b2', invoice_number: '77264', due_date: '2026-10-31', amount: 527.58, is_paid: false, title: 'Job B' },
      { id: 'b3', invoice_number: '77502', due_date: '2026-11-30', amount: 300, is_paid: false, title: 'Job C' },
    ]
    renderWithProviders(<RecordSupplyPaymentModal house={{ id: 'h2', name: 'Cedar Fork Supply', monthlyPaymentDay: null }} bills={bills} io={payIo} todayYmd="2026-11-16" parts start={{ amount: 1527.58, paidOn: '2026-11-14', chip: 'card', words: '11/14 · CEDAR FORK SUP · $1,527.58' }} onClose={() => {}} onRecorded={() => {}} />)
    await screen.findAllByTestId('record-supply-payment-bill')
    expect(screen.getByTestId('record-supply-payment-from-bank').textContent).toBe('From the bank: 11/14 · CEDAR FORK SUP · $1,527.58. Tick the bills it paid.')
    // The amount is typed in once what is open has been read.
    await waitFor(() => expect((screen.getByLabelText('Amount sent') as HTMLInputElement).value).toBe('1527.58'))
    expect((screen.getByLabelText('Date sent') as HTMLInputElement).value).toBe('2026-11-14')
    expect(screen.getByRole('button', { name: 'Card' }).getAttribute('aria-pressed')).toBe('true')
    expect((screen.getByLabelText('Pay 77120') as HTMLInputElement).checked).toBe(true)
    expect((screen.getByLabelText('Pay 77264') as HTMLInputElement).checked).toBe(true)
    expect((screen.getByLabelText('Pay 77502') as HTMLInputElement).checked).toBe(false)
    expect(screen.getByRole('button', { name: 'Record $1,527.58 on 2 bills' })).toBeTruthy()
  })
})
