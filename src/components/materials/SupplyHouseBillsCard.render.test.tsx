// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { SupplyHouseBillsCard, type SupplyBillCardRow } from './SupplyHouseBillsCard'

// Made-up bills at a made-up house.
const today = '2026-03-10'
const bill = (id: string, more: Partial<SupplyBillCardRow>): SupplyBillCardRow => ({
  id,
  invoice_number: `S-${id}`,
  purchase_order_number: null,
  invoice_date: '2026-02-20',
  due_date: '2026-03-15',
  amount: 100,
  is_paid: false,
  paidYmd: null,
  link: null,
  payment_link: null,
  on_job_account: true,
  jobs: [{ label: '201 · Maple Lofts', pct: 100 }],
  poMismatch: false,
  pairLine: null,
  lines: { words: 'No lines yet', tone: 'none', look: false },
  ...more,
})
const bills: SupplyBillCardRow[] = [
  bill('1', { amount: 100 }),
  bill('2', { amount: 250.6, on_job_account: false, purchase_order_number: 'Oak Ct', link: 'https://example.com/bill.pdf', lines: { words: '4 lines · adds up', tone: 'ok', look: true } }),
  bill('3', { amount: 40, due_date: '2026-03-01', jobs: [], purchase_order_number: 'Serv Chrg', on_job_account: null }),
  bill('4', { amount: -50, jobs: [], on_job_account: null, pairLine: 'Credits S-1' }),
]
const noop = () => {}
const card = (over: Partial<Parameters<typeof SupplyHouseBillsCard>[0]> = {}) => (
  <SupplyHouseBillsCard bills={bills} todayYmd={today} jobAccountsInUse paidThisVisit={new Set()} payingId={null} empty={<p>Nothing here.</p>} onTogglePaid={noop} onEdit={noop} onLook={noop} {...over} />
)

describe('SupplyHouseBillsCard', () => {
  it('opens on the summary, then the bills in groups by due day, largest first', () => {
    renderWithProviders(card())
    expect(screen.getByTestId('supply-bills-stat-open').textContent).toBe('Open$3414 bills')
    expect(screen.getByTestId('supply-bills-stat-past').textContent).toBe('Past due$401 bill')
    expect(screen.getByTestId('supply-bills-stat-next').textContent).toBe('Due Mar 15$3013 bills')
    expect(screen.getByTestId('supply-bills-stat-bare').textContent).toBe('Not on a job account$2511 bill, ours to carry')
    expect(screen.getAllByTestId('supply-bill-group').map((g) => g.textContent)).toEqual(['Past due1 bill · $40.00 left', 'Due Mar 153 bills · $300.60 left'])
    expect(screen.getAllByTestId('supply-bill-amount').map((a) => a.textContent)).toEqual(['$40.00', '$250.60', '$100.00', '− $50.00credit'])
  })

  it('with a viewer to open, See the bill is a press that hands over the bill and the card’s order, beside a share press', () => {
    const seen: [string, readonly string[]][] = []
    const shared: string[] = []
    renderWithProviders(card({ onSeeBill: (id, listed) => seen.push([id, listed]), onShareBill: (id) => shared.push(id) }))
    const second = screen.getAllByTestId('supply-bill-row')[1] as HTMLElement
    const press = within(second).getByRole('button', { name: 'See the bill ›' })
    // A press, and no longer a link that leaves the page.
    expect(press.getAttribute('href')).toBeNull()
    fireEvent.click(press)
    // The bills in the order the card drew them: past due first, then the due day's, largest first.
    expect(seen).toEqual([['2', ['3', '2', '1', '4']]])
    fireEvent.click(within(second).getByRole('button', { name: /^Copy a link to invoice / }))
    expect(shared).toEqual(['2'])
    // A bill with no paper at all offers neither.
    const first = screen.getAllByTestId('supply-bill-row')[0] as HTMLElement
    expect(within(first).queryByRole('button', { name: 'See the bill ›' })).toBeNull()
    expect(within(first).queryByRole('button', { name: /^Copy a link/ })).toBeNull()
  })

  it('leads a row with what the bill is for, and flags a job’s charge that is not on a job account', () => {
    renderWithProviders(card())
    const titles = screen.getAllByTestId('supply-bill-title').map((t) => t.textContent?.replace(/\s+/g, ' ').trim())
    // No job on the bill: the PO's words lead, and the days past due ride beside them.
    expect(titles[0]).toBe('Serv Chrg 9d past due')
    expect(titles[1]).toBe('201 · Maple Lofts no job account')
    expect(titles[2]).toBe('201 · Maple Lofts Job acct')
    expect(titles[3]).toBe('No job on this bill')
    const second = screen.getAllByTestId('supply-bill-row')[1] as HTMLElement
    expect(within(second).getByText('See the bill ›').getAttribute('href')).toBe('https://example.com/bill.pdf')
    expect(within(second).getByText('PO Oak Ct')).toBeTruthy()
    expect(screen.getByTestId('supply-credit-pair').textContent).toBe('Credits S-1')
  })

  it('marks one bill at a time, and hands back its Edit and its Look', () => {
    const onTogglePaid = vi.fn()
    const onEdit = vi.fn()
    const onLook = vi.fn()
    renderWithProviders(card({ onTogglePaid, onEdit, onLook }))
    fireEvent.click(screen.getByRole('button', { name: 'Mark paid: S-2' }))
    expect(onTogglePaid).toHaveBeenCalledWith('2')
    fireEvent.click(screen.getByRole('button', { name: 'Edit S-2' }))
    expect(onEdit).toHaveBeenCalledWith('2')
    fireEvent.click(screen.getByRole('button', { name: 'Look ›' }))
    expect(onLook).toHaveBeenCalledWith('2')
  })

  it('keeps a bill paid on this visit where it was, out of its group’s count, with Mark unpaid', () => {
    const paid = bills.map((b) => (b.id === '2' ? { ...b, is_paid: true, paidYmd: today } : b))
    renderWithProviders(card({ bills: paid, paidThisVisit: new Set(['2']) }))
    expect(screen.getAllByTestId('supply-bill-group').map((g) => g.textContent)).toEqual(['Past due1 bill · $40.00 left', 'Due Mar 152 bills · $50.00 left'])
    const row = screen.getAllByTestId('supply-bill-row')[1] as HTMLElement
    expect(within(row).getByText('Paid today')).toBeTruthy()
    expect(within(row).getByRole('button', { name: 'Mark unpaid: S-2' })).toBeTruthy()
    expect(screen.getByTestId('supply-bills-stat-open').textContent).toBe('Open$903 bills')
  })

  it('holds every press while one bill saves, and says so on that bill', () => {
    renderWithProviders(card({ payingId: '1' }))
    expect(screen.getByRole('button', { name: 'Mark paid: S-1' }).textContent).toBe('Saving…')
    expect(screen.getAllByTestId('supply-bill-mark-paid').every((b) => (b as HTMLButtonElement).disabled)).toBe(true)
  })

  it('says nothing of job accounts at a house that does not use them, and hands the empty words through', () => {
    renderWithProviders(card({ jobAccountsInUse: false }))
    expect(screen.queryByTestId('supply-bills-stat-bare')).toBeNull()
    expect(screen.queryByText('no job account')).toBeNull()
    renderWithProviders(card({ bills: [] }))
    expect(screen.getByText('Nothing here.')).toBeTruthy()
  })

  it('a bill paid in part lists for what is left on it, and money on account has its own number', () => {
    renderWithProviders(
      card({
        bills: [bill('9', { amount: 512.4, partPaid: '$300.00 paid · $512.40 left of $812.40' }), bill('10', { amount: 100 })],
        onAccount: 187.4,
      }),
    )
    const rows = screen.getAllByTestId('supply-bill-row')
    expect(within(rows[0] as HTMLElement).getByTestId('supply-bill-part-paid').textContent).toBe('$300.00 paid · $512.40 left of $812.40')
    expect(within(rows[0] as HTMLElement).getByTestId('supply-bill-amount').textContent).toBe('$512.40')
    expect(within(rows[1] as HTMLElement).queryByTestId('supply-bill-part-paid')).toBeNull()
    // The summary and the group count what is left, not what was billed.
    expect(screen.getByTestId('supply-bills-stat-open').textContent).toContain('$612')
    expect(screen.getByTestId('supply-bills-stat-account').textContent).toBe('On account$187.40sent past the bills, offered on the next payment')
  })

  it('a bill says where a payment’s money moved, and a removed payment is one press to put back', () => {
    const onPutBack = vi.fn()
    renderWithProviders(
      card({
        bills: [bill('11', { trace: ['$1,000.00 moved to S4398120 · Dana · the house applied it differently'] }), bill('12', {})],
        removedPayments: [{ id: 'p9', words: '$5,000.00 ACH 88213 payment of 11/12 · removed 11/16 · Dana · typed twice' }],
        onPutBack,
      }),
    )
    const rows = screen.getAllByTestId('supply-bill-row')
    expect(within(rows[0] as HTMLElement).getByTestId('supply-bill-trace').textContent).toBe('$1,000.00 moved to S4398120 · Dana · the house applied it differently')
    expect(within(rows[1] as HTMLElement).queryByTestId('supply-bill-trace')).toBeNull()
    const removed = screen.getByTestId('supply-bills-removed')
    expect(removed.textContent).toContain('$5,000.00 ACH 88213 payment of 11/12 · removed 11/16 · Dana · typed twice')
    fireEvent.click(within(removed).getByRole('button', { name: 'Put it back' }))
    expect(onPutBack).toHaveBeenCalledWith('p9')
  })

  it('an interest bill leads with what it is, wears its chip, and says it is not a job cost', () => {
    renderWithProviders(card({ bills: [bill('13', { amount: 18.6, jobs: [], on_job_account: null, interest: 'Interest on S4398120' }), bill('14', {})] }))
    const rows = screen.getAllByTestId('supply-bill-row')
    const interestRow = rows.find((r) => r.textContent?.includes('Interest on S4398120')) as HTMLElement
    expect(within(interestRow).getByTestId('supply-bill-title').textContent).toContain('Interest on S4398120')
    expect(within(interestRow).getByTestId('supply-bill-interest').textContent).toBe('Interest')
    expect(interestRow.textContent).toContain('not a job cost')
    expect(interestRow.textContent).not.toContain('No job on this bill')
    expect(screen.getAllByTestId('supply-bill-interest')).toHaveLength(1)
  })

  it('shows no On account number when nothing waits there', () => {
    renderWithProviders(card())
    expect(screen.queryByTestId('supply-bills-stat-account')).toBeNull()
  })

  it('a paid row names its payment, and opens it when a typed payment stands behind it', () => {
    const onTogglePaid = vi.fn()
    renderWithProviders(
      card({
        bills: [
          bill('7', { is_paid: true, paidYmd: '2026-03-02', paidBy: 'ACH 88213 · one of 4 bills on $5,000.00', seePayment: true }),
          bill('8', { is_paid: true, paidYmd: '2026-03-03' }),
        ],
        onTogglePaid,
      }),
    )
    const rows = screen.getAllByTestId('supply-bill-row')
    expect(within(rows[0] as HTMLElement).getByTestId('supply-bill-paid-by').textContent).toBe('ACH 88213 · one of 4 bills on $5,000.00')
    expect(rows[0]?.textContent).toContain('paid 3/2')
    fireEvent.click(within(rows[0] as HTMLElement).getByRole('button', { name: 'See the payment: S-7' }))
    expect(onTogglePaid).toHaveBeenCalledWith('7')
    // A bill paid before payments were rows reads as it always did, with Mark unpaid.
    expect(within(rows[1] as HTMLElement).queryByTestId('supply-bill-paid-by')).toBeNull()
    expect(within(rows[1] as HTMLElement).getByRole('button', { name: 'Mark unpaid: S-8' })).toBeTruthy()
  })
})
