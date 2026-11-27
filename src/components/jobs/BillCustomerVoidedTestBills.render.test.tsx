// @vitest-environment jsdom
/**
 * The dev's folded line of voided test bills at the foot of Bill Customer (punch list #443, row 7): a developer
 * reads it on a ZZ test job, nobody else does, a job with no record draws nothing, and nothing in it can be pressed
 * but Show and Hide. Made-up names.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { parseVoidedTestBill, type VoidedTestBill } from '../../lib/billing/voidedTestBills'
import { BillCustomerVoidedTestBills } from './BillCustomerVoidedTestBills'

const io = vi.hoisted(() => ({ bills: [] as unknown[], read: [] as string[] }))
vi.mock('../../lib/billing/voidedTestBillsIo', () => ({
  readVoidedTestBills: async (jobId: string) => {
    io.read.push(jobId)
    return io.bills
  },
}))

const ZZ = { job_name: 'ZZ Test walk job', customer_name: 'ZZ Test Customer' }
const REAL = { job_name: 'Larkfield Lot 9', customer_name: 'Larkfield Homes' }

const record = (over: Record<string, unknown> = {}): VoidedTestBill =>
  parseVoidedTestBill({
    id: 'r1',
    invoice_id: 'b1',
    job_id: 'j1',
    bill: { id: 'b1', job_id: 'j1', amount: 1250.4 },
    sends: [
      { source: 'sent_copy', id: 'c1', kind: 'bill', title: 'Invoice #ZZ01-0002 from ZZ Test Plumbing', how: 'email', recipient_name: 'ZZ Test Payer', recipient_emails: ['zz.payer@example.test'], sent_at: '2026-11-24T15:00:00Z' },
      { source: 'stripe_email', id: 'e1', sent_at: '2026-11-24T15:00:05Z', copy_emails: [] },
      { source: 'stripe_email', id: 'e2', sent_at: '2026-11-25T15:00:00Z', copy_emails: [] },
    ],
    stripe_invoice_id: 'in_test_zz1',
    stripe_action: 'void',
    voided_by_name: 'ZZ Test Dev',
    voided_at: '2026-11-25T16:30:00Z',
    ...over,
  }) as VoidedTestBill

const draw = async (role: string, job = ZZ) => {
  renderWithProviders(<BillCustomerVoidedTestBills role={role} jobId="j1" job={job} />)
  await settle()
}
const box = () => screen.queryByTestId('voided-test-bills')
const open = () => fireEvent.click(within(screen.getByTestId('voided-test-bills')).getByRole('button', { name: 'Show' }))

beforeEach(() => {
  io.bills = [record()]
  io.read.length = 0
})
afterEach(cleanup)

describe('who reads it', () => {
  it('draws nothing for an assistant, and asks the database nothing', async () => {
    await draw('assistant')
    expect(box()).toBeNull()
    expect(io.read).toEqual([])
  })
  it('draws nothing for a master, a primary or a helper either', async () => {
    for (const role of ['master_technician', 'primary', 'helpers', 'controller']) {
      await draw(role)
      expect(box()).toBeNull()
      cleanup()
    }
    expect(io.read).toEqual([])
  })
  it('draws nothing for a dev on a real job, and asks nothing', async () => {
    await draw('dev', REAL)
    expect(box()).toBeNull()
    expect(io.read).toEqual([])
  })
  it('draws nothing for a dev on a test job with no record', async () => {
    io.bills = []
    await draw('dev')
    expect(io.read).toEqual(['j1'])
    expect(box()).toBeNull()
  })
})

describe('a dev on a test job with a record', () => {
  it('reads the folded line with its count, closed', async () => {
    io.bills = [record(), record({ id: 'r2', invoice_id: 'b2', sends: [] })]
    await draw('dev')
    expect(io.read).toEqual(['j1'])
    expect(box()?.textContent).toContain('Voided test bills · 2')
    expect(screen.queryAllByTestId('voided-test-bill')).toHaveLength(0)
    expect(within(box()!).getByRole('button', { name: 'Show' }).getAttribute('aria-expanded')).toBe('false')
  })
  it('opens to each record: the number, the amount with small cents, the day, who, the Stripe side', async () => {
    await draw('dev')
    open()
    const bill = screen.getByTestId('voided-test-bill')
    const words = bill.textContent ?? ''
    expect(words).toContain('ZZ01-0002')
    expect(words).toContain('$1,250.40')
    expect(bill.querySelector('[data-cents]')?.textContent).toBe('.40')
    expect(words).toContain('Nov 25, 2026')
    expect(words).toContain('10:30 AM')
    expect(words).toContain('ZZ Test Dev')
    expect(words).toContain('Voided in Stripe')
    expect(words).toContain('in_test_zz1')
    expect(box()?.textContent).toContain('Only a developer sees this list.')
  })
  it('lists its sends one a line: how it went, to whom, when', async () => {
    await draw('dev')
    open()
    const sends = screen.getAllByTestId('voided-test-bill-send')
    // The copy and the Stripe email filed with it are one send. The later Stripe email is its own.
    expect(sends).toHaveLength(2)
    expect(sends[0]?.textContent).toContain('ZZ Test Payer, zz.payer@example.test')
    expect(sends[0]?.textContent).toContain('Nov 24, 2026')
    expect(sends[1]?.textContent).toContain('Address not on record')
    expect(sends[1]?.textContent).toContain('Nov 25, 2026')
    const bill = screen.getByTestId('voided-test-bill').textContent ?? ''
    expect(bill).toContain('Email')
    expect(bill).toContain('Email from Stripe')
  })
  it('says so for a record with no send, and stands in for a missing name and amount', async () => {
    io.bills = [record({ sends: [], voided_by_name: null, bill: {} })]
    await draw('dev')
    open()
    expect(screen.getByTestId('voided-test-bill-no-sends').textContent).toBe('The record holds no send of this bill.')
    const words = screen.getByTestId('voided-test-bill').textContent ?? ''
    expect(words).toContain('Name not on record')
    expect(words).toContain('Not on record')
    expect(screen.queryAllByTestId('voided-test-bill-send')).toHaveLength(0)
  })
  it('every value is worked out: nothing can be pressed but Show and Hide', async () => {
    await draw('dev')
    open()
    const presses = within(box()!).getAllByRole('button')
    expect(presses.map((b) => b.textContent)).toEqual(['Hide'])
    expect(box()?.querySelectorAll('[data-value="changeable"], input, select, textarea, a')).toHaveLength(0)
    expect(box()?.querySelectorAll('[data-value="worked-out"]').length).toBeGreaterThan(4)
    fireEvent.click(presses[0]!)
    expect(screen.queryAllByTestId('voided-test-bill')).toHaveLength(0)
  })
  it('has room on a phone: the line wraps and no part of it holds a fixed width', async () => {
    await draw('dev')
    open()
    const styled = [box()!, ...Array.from(box()!.querySelectorAll<HTMLElement>('[style]'))]
    for (const el of styled) {
      expect(el.style.width).toBe('')
      expect(el.style.minWidth === '' || el.style.minWidth === '0px' || el.style.minWidth === '0').toBe(true)
      expect(el.style.whiteSpace === '' || el.hasAttribute('data-cents') || el.querySelector('[data-cents]') != null).toBe(true)
    }
    expect(screen.getByTestId('voided-test-bill').style.overflowWrap).toBe('anywhere')
  })
})
