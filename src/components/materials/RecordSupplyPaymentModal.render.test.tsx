// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { RecordSupplyPaymentModal, type RecordSupplyPaymentBill } from './RecordSupplyPaymentModal'
import type { HousePayments, RecordSupplyPaymentInput, SupplyPaymentsIo } from '../../lib/materials/payments/supplyPaymentsIo'

// Made-up bills at a made-up house.
const today = '2026-11-16'
const house = { id: 'h1', name: 'Cedar Fork Supply', monthlyPaymentDay: 20 }
const bills: RecordSupplyPaymentBill[] = [
  { id: 'b2', invoice_number: '77264', due_date: '2026-10-31', amount: 812.4, is_paid: false, title: '201 · Maple Lofts' },
  { id: 'b1', invoice_number: '77120', due_date: '2026-10-15', amount: 1240, is_paid: false, title: '188 · Juniper Ridge Bldg C' },
  { id: 'b5', invoice_number: '77502', due_date: '2026-11-30', amount: 389.15, is_paid: false, title: 'No job yet' },
  { id: 'old', invoice_number: '70001', due_date: '2026-09-01', amount: 99, is_paid: true, title: 'Paid long ago' },
  { id: 'c1', invoice_number: 'CM-2291', due_date: null, amount: -212.4, is_paid: false, title: 'A return' },
]

function fakeIo(loaded: HousePayments = { payments: [], lines: [] }) {
  const recorded: RecordSupplyPaymentInput[] = []
  const io: SupplyPaymentsIo = {
    loadHouse: vi.fn(async () => loaded),
    record: vi.fn(async (input) => {
      recorded.push(input)
      return { payment_id: 'p-new', lines: input.lines.length, placed: input.amount, on_account: 0, placed_from_account: 0 }
    }),
    remove: vi.fn(async () => {}),
    restore: vi.fn(async () => {}),
    move: vi.fn(async () => {}),
    undoMove: vi.fn(async () => {}),
  }
  return { io, recorded }
}

const open = async (io: SupplyPaymentsIo, over: Partial<Parameters<typeof RecordSupplyPaymentModal>[0]> = {}) => {
  const onRecorded = vi.fn()
  const onClose = vi.fn()
  renderWithProviders(<RecordSupplyPaymentModal house={house} bills={bills} io={io} todayYmd={today} onClose={onClose} onRecorded={onRecorded} {...over} />)
  await screen.findAllByTestId('record-supply-payment-bill')
  return { onRecorded, onClose }
}
const press = () => screen.getByRole('button', { name: /^(Record|Settle)/ })

describe('RecordSupplyPaymentModal', () => {
  it('lists the open bills oldest due first, with the press dead and its reason', async () => {
    const { io } = fakeIo()
    await open(io)
    expect(screen.getByRole('dialog', { name: 'Record a payment to Cedar Fork Supply' })).toBeTruthy()
    expect(screen.getByTestId('record-supply-payment-summary').textContent).toBe('3 open bills · $2,441.55 · pays on the 20th')
    const rows = screen.getAllByTestId('record-supply-payment-bill')
    expect(rows.map((r) => within(r).getByRole('checkbox').getAttribute('aria-label'))).toEqual(['Pay 77120', 'Pay 77264', 'Pay 77502'])
    expect(rows[0]?.textContent).toContain('32d past due')
    expect(rows[0]?.textContent).toContain('77120 · due 10/15 · $1,240.00 open')
    expect(press().hasAttribute('disabled')).toBe(true)
    expect(screen.getByTestId('record-supply-payment-why').textContent).toBe('Tick a bill, or type the amount sent.')
    // Whole bills only here: no credit memo and no box to lower.
    expect(screen.queryByTestId('record-supply-payment-credit')).toBeNull()
    expect(screen.queryByLabelText('Amount on 77120')).toBeNull()
  })

  it('adds the ticked bills into the amount and records them as one payment', async () => {
    const { io, recorded } = fakeIo()
    const { onRecorded } = await open(io)
    fireEvent.click(screen.getByLabelText('Pay 77120'))
    fireEvent.click(screen.getByLabelText('Pay 77264'))
    expect((screen.getByLabelText('Amount sent') as HTMLInputElement).value).toBe('2052.40')
    expect(screen.getByTestId('record-supply-payment-placed').textContent).toBe('$2,052.40 placed of $2,052.40 sent')
    fireEvent.click(screen.getByRole('button', { name: 'ACH' }))
    fireEvent.change(screen.getByLabelText('Confirmation number (optional)'), { target: { value: ' 88213 ' } })
    fireEvent.change(screen.getByLabelText('Date sent'), { target: { value: '2026-11-12' } })
    expect(press().textContent).toBe('Record $2,052.40 on 2 bills')
    fireEvent.click(press())
    await waitFor(() => expect(onRecorded).toHaveBeenCalledTimes(1))
    expect(recorded[0]).toEqual({
      supplyHouseId: 'h1',
      paidOn: '2026-11-12',
      amount: 2052.4,
      lines: [{ invoice_id: 'b1', amount: 1240 }, { invoice_id: 'b2', amount: 812.4 }],
      fromAccount: [],
      keepOnAccount: false,
      method: 'ach',
      methodRef: '88213',
      receiptLink: null,
      memo: null,
    })
    expect(onRecorded.mock.calls[0]?.[1]).toBe('$2,052.40 to Cedar Fork Supply is recorded.')
  })

  it('opens the chips on how the house was paid last, and says details later when nobody says', async () => {
    const { io } = fakeIo({ payments: [{ id: 'p1', supply_house_id: 'h1', paid_on: '2026-10-20', amount: 99, method: 'card', method_ref: '4410', receipt_link: null, source: 'recorded', removed_at: null }], lines: [{ id: 'l1', payment_id: 'p1', invoice_id: 'old', amount: 99 }] })
    await open(io)
    expect(screen.getByRole('button', { name: 'Card' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByTestId('record-supply-payment-method-hint').textContent).toBe('Card is how the last payment to this house went.')
    fireEvent.click(screen.getByLabelText('Pay 77502'))
    fireEvent.click(screen.getByRole('button', { name: 'Say later' }))
    expect(press().textContent).toBe('Record $389.15 on 1 bill, details later')
  })

  it('ticks everything due by the pay day, and fills a typed amount oldest first', async () => {
    const { io } = fakeIo()
    await open(io)
    fireEvent.click(screen.getByTestId('record-supply-payment-due-by'))
    expect(screen.getByTestId('record-supply-payment-due-by').textContent).toBe('Tick everything due by Nov 20')
    expect((screen.getByLabelText('Amount sent') as HTMLInputElement).value).toBe('2052.40')
    fireEvent.change(screen.getByLabelText('Amount sent'), { target: { value: '1300' } })
    expect((screen.getByLabelText('Pay 77120') as HTMLInputElement).checked).toBe(true)
    expect((screen.getByLabelText('Pay 77264') as HTMLInputElement).checked).toBe(false)
    expect(screen.getByTestId('record-supply-payment-why').textContent).toBe('$60.00 is not on a bill. Tick the bills this paid, so the amounts match.')
    expect(press().hasAttribute('disabled')).toBe(true)
  })

  it('with part payments on: a lowered box, a credit memo and money on account', async () => {
    const { io, recorded } = fakeIo({
      payments: [{ id: 'p-old', supply_house_id: 'h1', paid_on: '2026-10-20', amount: 199, method: 'ach', method_ref: null, receipt_link: null, source: 'recorded', removed_at: null }],
      lines: [{ id: 'l1', payment_id: 'p-old', invoice_id: 'old', amount: 99 }, { id: 'l2', payment_id: 'p-old', invoice_id: 'b5', amount: 89.15 }],
    })
    const { onRecorded } = await open(io, { parts: true })
    expect(screen.getByTestId('record-supply-payment-summary').textContent).toBe('3 open bills · $2,352.40 · 1 open credit · pays on the 20th')
    // 199 sent, 188.15 on bills: 10.85 waits on account. The part-paid bill reads what is left on it.
    expect(screen.getByTestId('record-supply-payment-account').textContent).toContain('Use $10.85 on account first')
    expect(screen.getAllByTestId('record-supply-payment-bill')[2]?.textContent).toContain('$300.00 open')
    fireEvent.click(screen.getByLabelText('Pay 77264'))
    fireEvent.change(screen.getByLabelText('Amount on 77264'), { target: { value: '500' } })
    expect(screen.getAllByTestId('record-supply-payment-bill')[1]?.textContent).toContain('A part payment. $312.40 stays open on the bill.')
    fireEvent.click(screen.getByLabelText('Use credit memo CM-2291'))
    fireEvent.click(within(screen.getByTestId('record-supply-payment-account')).getByRole('checkbox'))
    expect(press().textContent).toBe('Record $276.75 on 1 bill, with a $212.40 credit')
    fireEvent.click(press())
    await waitFor(() => expect(onRecorded).toHaveBeenCalledTimes(1))
    expect(recorded[0]?.amount).toBe(276.75)
    expect(recorded[0]?.fromAccount).toEqual([{ payment_id: 'p-old', invoice_id: 'b2', amount: 10.85 }])
    expect(recorded[0]?.lines).toEqual([{ invoice_id: 'b2', amount: 489.15 }, { invoice_id: 'c1', amount: -212.4 }])
  })

  it('says why when the payment is refused, and stays open', async () => {
    const { io } = fakeIo()
    io.record = vi.fn(async () => {
      throw { message: 'bill 77120 is for 1240.00 and its payments would come to 2480.00' }
    })
    const { onRecorded } = await open(io)
    fireEvent.click(screen.getByLabelText('Pay 77120'))
    fireEvent.click(press())
    expect((await screen.findByRole('alert')).textContent).toContain('bill 77120 is for 1240.00')
    expect(onRecorded).not.toHaveBeenCalled()
  })

  it('says so when nothing is open, and when the payments cannot be read', async () => {
    const { io } = fakeIo()
    renderWithProviders(<RecordSupplyPaymentModal house={house} bills={bills.filter((b) => b.is_paid)} io={io} todayYmd={today} onClose={() => {}} onRecorded={() => {}} />)
    expect(await screen.findByText('Nothing waiting on a payment at Cedar Fork Supply.')).toBeTruthy()
    const failing: SupplyPaymentsIo = { loadHouse: vi.fn(async () => Promise.reject({ message: 'permission denied for table supply_house_payments' })), record: vi.fn(), remove: vi.fn(), restore: vi.fn(), move: vi.fn(), undoMove: vi.fn() }
    renderWithProviders(<RecordSupplyPaymentModal house={{ ...house, name: 'Pecan Supply' }} bills={bills} io={failing} todayYmd={today} onClose={() => {}} onRecorded={() => {}} />)
    expect((await screen.findByRole('alert')).textContent).toContain('permission denied')
  })
})
