// @vitest-environment jsdom
/**
 * Bills sent, By day paid (punch list #422, PR 3): a month of days with what came in on each, a picked day with
 * its total and its payments, a chip that narrows the month to one way, one deposit drawn once, an empty day that
 * offers a press, the next Stripe payout, and a read that fails saying so with Retry. Every name and number is
 * made up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { billsPaidStepLabel, type BillsPaidBill, type BillsPaidPayment } from '../../lib/billing/billsPaidDays'
import type { BillsPaidRead } from '../../lib/billing/billsPaidIo'
import { BillsPaidByDay } from './BillsPaidByDay'
import { todayYmdInAppTz, ymdAddDays } from '../../utils/dateUtils'

const io = vi.hoisted(() => ({ data: null as unknown, asks: [] as Array<{ from: string; to: string }>, payout: null as unknown, fail: null as unknown, phone: false, saved: [] as Array<{ name: string; type: string }> }))
vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => io.phone }))
vi.mock('../../hooks/useAuth', () => {
  const auth = () => ({ role: 'master_technician', user: { id: 'u1' }, profileName: 'Priya' })
  return { useAuth: auth, useOptionalAuth: auth }
})
vi.mock('../../lib/billing/billsPaidIo', () => ({
  readBillsPaid: async (span: { from: string; to: string }) => {
    io.asks.push(span)
    if (io.fail) throw io.fail
    return io.data
  },
  readStripePayout: async () => io.payout,
}))
vi.mock('../../lib/storageSave', () => ({
  saveBlobAs: (blob: Blob, name: string) => void io.saved.push({ name, type: blob.type }),
}))

const today = todayYmdInAppTz()
const month = today.slice(0, 7)
// A month that is never this one, with every day in the past: the tests pick its days by name.
const OLD = '2026-03'
const B = (n: number) => `bbbbbbbb-0000-4000-8000-00000000000${n}`
const J = (n: number) => `aaaaaaaa-0000-4000-8000-00000000000${n}`
const payment = (over: Partial<BillsPaidPayment>): BillsPaidPayment => ({ id: 'p1', billId: B(1), jobId: J(1), amount: 2480, paidOn: `${OLD}-18`, createdAtIso: `${OLD}-18T15:14:00.000Z`, paymentType: null, note: null, referenceNumber: null, bankTransactionId: null, stripeCreditNoteId: null, ...over })
const bill = (n: number, over: Partial<BillsPaidBill> = {}): BillsPaidBill => ({ id: B(n), jobId: J(n), amount: 2480, status: 'paid', billedAtIso: `${OLD}-10T15:00:00.000Z`, ...over })
const read = (payments: BillsPaidPayment[]): BillsPaidRead => ({
  payments,
  bills: new Map([
    [B(1), bill(1)],
    [B(2), bill(2)],
    [B(3), bill(3)],
  ]),
  jobs: new Map([
    [J(1), { id: J(1), hcp_number: '1420', click_number: null, job_name: 'Marlow kitchen rough', customer_name: 'Elena Marlow' }],
    [J(2), { id: J(2), hcp_number: '1412', click_number: null, job_name: 'Sable Ridge Lot 3 finish', customer_name: 'Sable Ridge Builders' }],
    [J(3), { id: J(3), hcp_number: '1409', click_number: null, job_name: 'Sable Ridge Lot 2 finish', customer_name: 'Sable Ridge Builders' }],
  ]),
  numbers: new Map([[B(1), '1420-0001']]),
  firstSent: new Map([[B(1), `${OLD}-16T15:14:00.000Z`]]),
  more: false,
})
// Mar 18: one Stripe payment. Mar 20: one check that paid two bills.
const march = read([
  payment({ id: 's1', note: 'Stripe' }),
  payment({ id: 'c1', billId: B(2), jobId: J(2), amount: 4410, paidOn: `${OLD}-20`, paymentType: 'checkDeposit', referenceNumber: '4417', bankTransactionId: 'dep-f' }),
  payment({ id: 'c2', billId: B(3), jobId: J(3), amount: 2260, paidOn: `${OLD}-20`, paymentType: 'checkDeposit', referenceNumber: '4417', bankTransactionId: 'dep-f' }),
])
const cellOf = (day: string) => screen.getAllByTestId('bills-paid-cell').find((c) => c.getAttribute('data-day') === day)!

beforeEach(() => {
  io.data = read([])
  io.asks = []
  io.payout = null
  io.fail = null
  io.phone = false
  io.saved = []
})
afterEach(() => cleanup())

describe('BillsPaidByDay', () => {
  it('draws a month of days with what came in on each, and the picked day’s total and payments', async () => {
    io.data = march
    renderWithProviders(<BillsPaidByDay />, { route: `/bills-sent?view=paid&day=${OLD}-20` })
    const day = await screen.findByTestId('bills-paid-day')
    expect(io.asks[0]).toEqual({ from: `${OLD}-01`, to: `${OLD}-31` })
    expect(screen.getByTestId('bills-paid-month').textContent).toBe('March 2026')
    expect(screen.getAllByTestId('bills-paid-cell')).toHaveLength(31)
    // A day money came says its figure and its count. The picked day is pressed. A day with none is bare.
    expect(cellOf(`${OLD}-20`).textContent).toBe('20$6,6702 paid')
    expect(cellOf(`${OLD}-20`).getAttribute('aria-pressed')).toBe('true')
    expect(cellOf(`${OLD}-20`).getAttribute('aria-label')).toBe('Fri, Mar 20, $6,670.00, 2 payments')
    expect(cellOf(`${OLD}-18`).textContent).toBe('18$2,4801 paid')
    expect(cellOf(`${OLD}-19`).textContent).toBe('19')
    // An older month has no today and no week: its own tile alone.
    expect(screen.getByTestId('bills-paid-tile-month').textContent).toBe('March3 payments $9,150.00')
    expect(screen.queryByTestId('bills-paid-tile-today')).toBeNull()
    // The day: its facts one a line, then one deposit drawn once with its two bills under it.
    expect(day.textContent).toContain('Fri, Mar 20')
    expect(day.querySelector('[data-value-lines]')?.textContent).toBe('Came in$6,670.00Payments2')
    expect(within(day).getByTestId('bills-paid-deposit').textContent).toBe('One deposit · Check 4417 · 2 bills$6,670.00')
    expect(within(day).getAllByTestId('bills-paid-line').map((l) => l.textContent)).toEqual([
      'Bill · J1412 · Sable Ridge Lot 3 finish · Sable Ridge Builders$4,410.00Check 4417 · bank depositSent Tue, Mar 1010 days after it went',
      'Bill · J1409 · Sable Ridge Lot 2 finish · Sable Ridge Builders$2,260.00Check 4417 · bank depositSent Tue, Mar 1010 days after it went',
    ])
    // Cents are smaller than the dollars.
    const cents = within(day).getAllByTestId('bills-paid-line')[0]!.querySelector('span[style*="0.7em"]') as HTMLElement
    expect(cents.textContent).toBe('.00')
    expect(screen.getByTestId('bills-paid-foot').textContent).toContain('Stripe’s fee is not taken off.')
  })

  it('narrows the month to Stripe, and a day the chip emptied offers every way', async () => {
    io.data = march
    renderWithProviders(<BillsPaidByDay />, { route: `/bills-sent?view=paid&day=${OLD}-18` })
    await screen.findByTestId('bills-paid-day')
    expect(screen.getAllByRole('button', { pressed: true }).map((b) => b.textContent)).toContain('All')
    fireEvent.click(screen.getByRole('button', { name: 'Stripe' }))
    // The month, its tile and its cells are Stripe's alone.
    expect(screen.getByTestId('bills-paid-tile-month').textContent).toBe('March · Stripe1 payment $2,480.00')
    expect(cellOf(`${OLD}-20`).textContent).toBe('20')
    const day = screen.getByTestId('bills-paid-day')
    expect(within(day).getByTestId('bills-paid-line').textContent).toMatch(/^Bill 1420-0001 · J1420 · Marlow kitchen rough · Elena Marlow\$2,480\.00Card · StripePaid \d{1,2}:\d\d [AP]MSent Mon, Mar 162 days after it went$/)
    // The record's address keeps the day and the chip it was opened from, so the record can lead back to them.
    expect(within(day).getByRole('link', { name: 'Bill 1420-0001' }).getAttribute('href')).toBe(`/bills-sent?bill=${B(1)}&view=paid&day=${OLD}-18&how=stripe`)
    // Pick the day the check came: nothing from Stripe, and the press shows every way.
    fireEvent.click(cellOf(`${OLD}-20`))
    expect(screen.getByTestId('bills-paid-day').textContent).toContain('Nothing came in from Stripe on Fri, Mar 20.')
    fireEvent.click(screen.getByRole('button', { name: 'Show every way that day' }))
    expect(within(screen.getByTestId('bills-paid-day')).getAllByTestId('bills-paid-line')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'All' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('says how a Stripe day differs from every way that day, with a press to see the rest', async () => {
    io.data = read([payment({ id: 's1', note: 'Stripe' }), payment({ id: 'c1', billId: B(2), jobId: J(2), amount: 5100, paymentType: 'Cash' })])
    renderWithProviders(<BillsPaidByDay />, { route: `/bills-sent?view=paid&how=stripe&day=${OLD}-18` })
    const day = await screen.findByTestId('bills-paid-day')
    expect(day.querySelector('[data-value-lines]')?.textContent).toBe('Came in · Stripe$2,480.00Payments1Every way that day$7,580.00 Show')
    fireEvent.click(within(day).getByRole('button', { name: 'Show' }))
    expect(within(screen.getByTestId('bills-paid-day')).getAllByTestId('bills-paid-line')).toHaveLength(2)
  })

  it('opens on this month and today, with today’s and the week’s tiles and the next Stripe payout', async () => {
    io.data = read([payment({ id: 's1', note: 'Stripe', paidOn: today, createdAtIso: `${today}T18:21:00.000Z` })])
    io.payout = { state: 'coming', usd: 2980.37, arrivalYmd: ymdAddDays(today, 2) }
    renderWithProviders(<BillsPaidByDay />, { route: '/bills-sent?view=paid' })
    const day = await screen.findByTestId('bills-paid-day')
    expect(io.asks[0]!.to.slice(0, 7)).toBe(month)
    expect(day.textContent).toContain('Today · ')
    expect(cellOf(today).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByTestId('bills-paid-tile-today').textContent).toBe('Today1 payment $2,480.00')
    expect(screen.getByTestId('bills-paid-tile-week').textContent).toBe('This week1 payment $2,480.00')
    await waitFor(() => expect(screen.getByTestId('bills-paid-tile-payout').textContent).toMatch(/^Next Stripe payout to the bank\$2,980\.37 \w{3}, \w{3} \d{1,2}$/))
    // A day that has not come cannot be pressed, and this month is the last one offered.
    const later = screen.getAllByTestId('bills-paid-cell').filter((c) => (c.getAttribute('data-day') ?? '') > today)
    expect(later.every((c) => (c as HTMLButtonElement).disabled)).toBe(true)
    expect(screen.queryByTestId('bills-paid-step-on')).toBeNull()
    // The step back names the month it opens.
    expect(screen.getByTestId('bills-paid-step-back').textContent).toBe(`‹${billsPaidStepLabel(month, -1)}`)
  })

  it('keeps the payout tile and says so when Stripe has none on its way, or gave no answer', async () => {
    io.payout = { state: 'none' }
    renderWithProviders(<BillsPaidByDay />, { route: '/bills-sent?view=paid' })
    await screen.findByTestId('bills-paid-day')
    await waitFor(() => expect(screen.getByTestId('bills-paid-tile-payout').textContent).toBe('Next Stripe payout to the bankNone on its way'))
    cleanup()
    io.payout = { state: 'unread' }
    renderWithProviders(<BillsPaidByDay />, { route: '/bills-sent?view=paid' })
    await screen.findByTestId('bills-paid-day')
    await waitFor(() => expect(screen.getByTestId('bills-paid-tile-payout').textContent).toBe('Next Stripe payout to the bankStripe did not answer'))
  })

  it('marks a day that holds a credit in kind and no money, and leaves it white', async () => {
    io.data = read([payment({ id: 'k1', paymentType: 'In kind', note: 'Rent credit', amount: 900, paidOn: `${OLD}-10` }), payment({ id: 's1', note: 'Stripe' })])
    renderWithProviders(<BillsPaidByDay />, { route: `/bills-sent?view=paid&month=${OLD}` })
    await screen.findByTestId('bills-paid-day')
    const cell = cellOf(`${OLD}-10`)
    expect(within(cell).getByTestId('bills-paid-cell-credit').textContent).toBe('1 credit')
    expect(cell.getAttribute('aria-label')).toBe('Tue, Mar 10, 1 credit in kind, not added')
    // A day money came says its money, and no credit.
    expect(within(cellOf(`${OLD}-18`)).queryByTestId('bills-paid-cell-credit')).toBeNull()
  })

  it('on a phone, marks a credit’s day with the word alone, which the narrow cell holds whole', async () => {
    io.phone = true
    io.data = read([payment({ id: 'k1', paymentType: 'In kind', note: 'Rent credit', amount: 900, paidOn: `${OLD}-10` }), payment({ id: 's1', note: 'Stripe' })])
    renderWithProviders(<BillsPaidByDay />, { route: `/bills-sent?view=paid&month=${OLD}` })
    await screen.findByTestId('bills-paid-day')
    const cell = cellOf(`${OLD}-10`)
    expect(within(cell).getByTestId('bills-paid-cell-credit').textContent).toBe('credit')
    // The count stays for a screen reader, and under the day once it is pressed.
    expect(cell.getAttribute('aria-label')).toBe('Tue, Mar 10, 1 credit in kind, not added')
  })

  it('steps to the month before and reads it', async () => {
    io.data = march
    renderWithProviders(<BillsPaidByDay />, { route: `/bills-sent?view=paid&month=${OLD}` })
    await screen.findByTestId('bills-paid-day')
    // With no day named, an older month opens on the newest day money came.
    expect(cellOf(`${OLD}-20`).getAttribute('aria-pressed')).toBe('true')
    // Each step says where it goes: the month before on the left, the month after on the right.
    expect(screen.getByTestId('bills-paid-step-back').textContent).toBe('‹Feb')
    expect(screen.getByTestId('bills-paid-step-on').textContent).toBe('Apr›')
    fireEvent.click(screen.getByRole('button', { name: 'February 2026' }))
    await waitFor(() => expect(io.asks[io.asks.length - 1]).toEqual({ from: '2026-02-01', to: '2026-02-28' }))
    await waitFor(() => expect(screen.getByTestId('bills-paid-month').textContent).toBe('February 2026'))
    // The step forward is offered on any month but this one.
    expect(screen.getByRole('button', { name: 'March 2026' })).toBeTruthy()
  })

  it('lists a credit in kind and a part payment in their own words, and adds only money', async () => {
    io.data = {
      ...read([payment({ id: 'k1', paymentType: 'In kind', note: 'Rent credit', amount: 900 }), payment({ id: 'h1', billId: B(2), jobId: J(2), amount: 1500, paymentType: 'Check', referenceNumber: '2291' })]),
      bills: new Map([
        [B(1), bill(1)],
        [B(2), bill(2, { status: 'billed' })],
      ]),
    }
    renderWithProviders(<BillsPaidByDay />, { route: `/bills-sent?view=paid&day=${OLD}-18` })
    const day = await screen.findByTestId('bills-paid-day')
    expect(day.querySelector('[data-value-lines]')?.textContent).toBe('Came in$1,500.00Payments1')
    const texts = within(day)
      .getAllByTestId('bills-paid-line')
      .map((l) => l.textContent)
    expect(texts.some((t) => t?.includes('A credit in kind. Not added to the day.'))).toBe(true)
    expect(texts.some((t) => t?.includes('Check 2291 · typed by hand') && t.includes('Part of the bill. The bill is still open.'))).toBe(true)
  })

  it('saves the month as a spreadsheet named for the month and the chip, and offers neither on an empty month', async () => {
    io.data = march
    const { unmount } = renderWithProviders(<BillsPaidByDay />, { route: `/bills-sent?view=paid&how=stripe&day=${OLD}-18` })
    await screen.findByTestId('bills-paid-day')
    fireEvent.click(within(screen.getByTestId('bills-paid-out')).getByRole('button', { name: 'Download CSV' }))
    expect(io.saved).toEqual([{ name: `bills-paid-${OLD}-stripe.csv`, type: 'text/csv;charset=utf-8' }])
    unmount()
    io.data = read([])
    renderWithProviders(<BillsPaidByDay />, { route: `/bills-sent?view=paid&month=${OLD}` })
    await screen.findByTestId('bills-paid-day')
    expect(screen.queryByTestId('bills-paid-out')).toBeNull()
    expect(screen.getByTestId('bills-paid-day').textContent).toContain('Nothing came in on Tue, Mar 31.')
    expect(screen.getByRole('button', { name: 'Go to today' })).toBeTruthy()
  })

  it('on a phone, writes a day’s amount short and puts the file presses last', async () => {
    io.phone = true
    io.data = march
    renderWithProviders(<BillsPaidByDay />, { route: `/bills-sent?view=paid&day=${OLD}-20` })
    const day = await screen.findByTestId('bills-paid-day')
    expect(cellOf(`${OLD}-20`).textContent).toBe('20$6.7k')
    expect(cellOf(`${OLD}-20`).style.minHeight).toBe('50px')
    const out = screen.getByTestId('bills-paid-out')
    expect(day.compareDocumentPosition(out) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('says why the payments were refused, and draws no month', async () => {
    io.fail = Object.assign(new Error('permission denied for table jobs_ledger_payments'), { code: '42501' })
    renderWithProviders(<BillsPaidByDay />, { route: `/bills-sent?view=paid&month=${OLD}` })
    await waitFor(() => expect(screen.getByText(/permission denied|did not read/i)).toBeTruthy())
    // A refusal draws no month: there is nothing to show, and a blank month would read as no money.
    expect(screen.queryByTestId('bills-paid-day')).toBeNull()
    expect(io.asks).toHaveLength(1)
  })
  it('on a phone, stands the chips and a payment’s bill and job names a fingertip tall', async () => {
    io.phone = true
    io.data = march
    renderWithProviders(<BillsPaidByDay />, { route: `/bills-sent?view=paid&day=${OLD}-18` })
    const day = await screen.findByTestId('bills-paid-day')
    // The chips were 38 px and the two names in the day box 16 px, on the live page at 375 px.
    expect(screen.getByRole('button', { name: 'Stripe' }).style.minHeight).toBe('44px')
    expect(screen.getByRole('button', { name: 'All' }).style.minHeight).toBe('44px')
    const bill = within(day).getByRole('link', { name: 'Bill 1420-0001' })
    const job = within(day).getByRole('link', { name: 'J1420 · Marlow kitchen rough' })
    expect([bill.style.minHeight, bill.style.display, job.style.minHeight, job.style.display]).toEqual(['44px', 'inline-flex', '44px', 'inline-flex'])
  })

  it('at a desk, leaves the chips and the names at the office’s size', async () => {
    io.data = march
    renderWithProviders(<BillsPaidByDay />, { route: `/bills-sent?view=paid&day=${OLD}-18` })
    const day = await screen.findByTestId('bills-paid-day')
    expect(screen.getByRole('button', { name: 'Stripe' }).style.minHeight).toBe('')
    expect(within(day).getByRole('link', { name: 'Bill 1420-0001' }).style.minHeight).toBe('')
  })
})
