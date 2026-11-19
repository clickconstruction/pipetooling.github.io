import { describe, expect, it } from 'vitest'
import {
  DRAW_BILL_NONE_LABEL,
  drawBillLabel,
  drawBillOptions,
  drawBillState,
  drawBillWindowLead,
  drawTieOnArrival,
  drawTieRowWords,
  openDrawBills,
  orderedDrawBills,
  type DrawBill,
} from './drawTie'

// Made-up bills on a made-up job. Noon UTC keeps the billed day the same in the app's zone.
const bill = (id: string, seq: number, status: string, amount = 1000, billedAt: string | null = null): DrawBill => ({ id, status, sequence_order: seq, amount, billed_at: billedAt, created_at: `2026-10-0${seq + 1}T12:00:00Z` })

const paid1 = bill('b1', 0, 'paid', 1800)
const billed2 = bill('b2', 1, 'billed', 3000, '2026-10-21T17:00:00Z')
const draft3 = bill('b3', 2, 'ready_to_bill', 1200)

describe('a bill is open until it is paid', () => {
  it('reads the three states', () => {
    expect(drawBillState('paid')).toBe('paid')
    expect(drawBillState('billed')).toBe('billed')
    expect(drawBillState('ready_to_bill')).toBe('draft')
    expect(drawBillState(null)).toBe('draft')
  })

  it('keeps the drafts and the sent bills, in the job’s own order', () => {
    expect(openDrawBills([draft3, paid1, billed2]).map((b) => b.id)).toEqual(['b2', 'b3'])
  })

  it('orders by sequence, then by the day made, then by id', () => {
    const a = { ...bill('z', 0, 'billed'), created_at: '2026-10-02T12:00:00Z' }
    const b = { ...bill('a', 0, 'billed'), created_at: '2026-10-02T12:00:00Z' }
    const c = { ...bill('m', 0, 'billed'), created_at: '2026-10-01T12:00:00Z' }
    expect(orderedDrawBills([a, b, c]).map((x) => x.id)).toEqual(['m', 'a', 'z'])
  })
})

describe('the tie when a sheet arrives at Waiting on customer', () => {
  it('ties nothing and asks nothing on a job with no bill', () => {
    expect(drawTieOnArrival([])).toEqual({ kind: 'none' })
  })

  it('ties nothing when every bill is paid', () => {
    expect(drawTieOnArrival([paid1])).toEqual({ kind: 'none' })
  })

  it('ties the one open bill by itself, sent or not', () => {
    expect(drawTieOnArrival([paid1, billed2])).toEqual({ kind: 'auto', billId: 'b2' })
    expect(drawTieOnArrival([draft3])).toEqual({ kind: 'auto', billId: 'b3' })
  })

  it('asks with several open, and leans to the one sent bill', () => {
    expect(drawTieOnArrival([paid1, billed2, draft3])).toEqual({ kind: 'pick', preselect: 'b2' })
  })

  it('asks with no lean when two are sent, or none is', () => {
    expect(drawTieOnArrival([billed2, bill('b4', 3, 'billed')])).toEqual({ kind: 'pick', preselect: null })
    expect(drawTieOnArrival([draft3, bill('b5', 4, 'ready_to_bill')])).toEqual({ kind: 'pick', preselect: null })
  })
})

describe('the window’s rows', () => {
  it('names each bill by its place among all the job’s bills', () => {
    const all = [paid1, billed2, draft3]
    expect(drawBillLabel(all, 'b2')).toBe('Bill 2 of 3')
    expect(drawBillLabel([billed2], 'b2')).toBe('The only bill')
    expect(drawBillLabel(all, 'nope')).toBeNull()
  })

  it('lists open bills first, then the paid ones, with what each is', () => {
    expect(drawBillOptions([paid1, billed2, draft3])).toEqual([
      { id: 'b2', label: 'Bill 2 of 3', detail: '$3,000 · billed Oct 21 · open', state: 'billed' },
      { id: 'b3', label: 'Bill 3 of 3', detail: '$1,200 · not billed yet', state: 'draft' },
      { id: 'b1', label: 'Bill 1 of 3', detail: '$1,800 · paid', state: 'paid' },
    ])
  })

  it('says billed with no day when the bill carries none', () => {
    expect(drawBillOptions([bill('b9', 0, 'billed', 500)])[0]!.detail).toBe('$500 · billed · open')
  })

  it('leads with the sub’s name, or without one', () => {
    expect(drawBillWindowLead('Harlan Pruitt')).toBe('Harlan Pruitt’s sheet waits on this bill’s payment.')
    expect(drawBillWindowLead('  ')).toBe('This sheet waits on this bill’s payment.')
    expect(DRAW_BILL_NONE_LABEL).toBe('No bill')
  })
})

describe('the line on the office’s row', () => {
  const all = [paid1, billed2, draft3]

  it('is silent off Waiting on customer', () => {
    expect(drawTieRowWords({ stage: 'working', drawInvoiceId: 'b2', bills: all })).toBeNull()
    expect(drawTieRowWords({ stage: 'walkthrough', drawInvoiceId: null, bills: all })).toBeNull()
    expect(drawTieRowWords({ stage: null, drawInvoiceId: null, bills: null })).toBeNull()
  })

  it('names the bill the sheet rides on', () => {
    expect(drawTieRowWords({ stage: 'customer_pay', drawInvoiceId: 'b2', bills: all })).toEqual({ text: 'Rides on bill 2 of 3', tied: true, press: 'Change the bill this sheet rides on' })
    expect(drawTieRowWords({ stage: 'customer_pay', drawInvoiceId: 'b2', bills: [billed2] })?.text).toBe('Rides on the only bill')
  })

  it('still says tied when the screen does not hold the job’s bills', () => {
    expect(drawTieRowWords({ stage: 'customer_pay', drawInvoiceId: 'b2', bills: null })?.text).toBe('Rides on a bill')
    expect(drawTieRowWords({ stage: 'customer_pay', drawInvoiceId: 'gone', bills: all })?.text).toBe('Rides on a bill')
  })

  it('offers the pick on a sheet with no tie', () => {
    expect(drawTieRowWords({ stage: 'customer_pay', drawInvoiceId: null, bills: all })).toEqual({ text: 'No bill tied', tied: false, press: 'Pick the bill this sheet rides on' })
    expect(drawTieRowWords({ stage: 'customer_pay', drawInvoiceId: '  ', bills: all })?.tied).toBe(false)
  })
})
