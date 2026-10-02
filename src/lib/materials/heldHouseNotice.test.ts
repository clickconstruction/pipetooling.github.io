import { describe, expect, it } from 'vitest'
import { buildLienSupplierJobs } from '../jobs/lienJobSuppliers'
import { customerPaidInFull, heldNoticeRisk } from './heldHouseNotice'

// Today is 2026-10-02. On a residential property a month's notice is due by the 15th of the second month after it.
const TODAY = '2026-10-02'
const HOUSES = [
  { id: 'reece', name: 'Reece' },
  { id: 'winn', name: 'Winn Supply' },
]
function job(invoices: Array<{ id: string; house: string; amount: number; date: string }>, words?: Parameters<typeof buildLienSupplierJobs>[0]['wordsByJob']) {
  return buildLienSupplierJobs({
    invoices: invoices.map((i) => ({ id: i.id, supply_house_id: i.house, amount: i.amount, is_paid: false, invoice_date: i.date, paidYmd: null, on_job_account: false })),
    allocations: invoices.map((i) => ({ invoice_id: i.id, job_id: 'j', pct: 100 })),
    houses: HOUSES,
    wordsByJob: words,
  }).get('j')!
}
const PAID = { billed: 31400, paidIn: 31400 }

describe('customerPaidInFull', () => {
  it('needs something billed and all of it in', () => {
    expect(customerPaidInFull(PAID)).toBe(true)
    expect(customerPaidInFull({ billed: 31400, paidIn: 31399 })).toBe(false)
    expect(customerPaidInFull({ billed: 0, paidIn: 0 })).toBe(false)
  })
})

describe('heldNoticeRisk', () => {
  it('names the soonest house that can still act on a paid-in-full job', () => {
    // Reece: August on a home, due Oct 15. Winn: September, due Nov 16.
    const j = job([
      { id: 'a', house: 'reece', amount: 5316, date: '2026-08-12' },
      { id: 'b', house: 'winn', amount: 514, date: '2026-09-03' },
    ])
    expect(heldNoticeRisk(PAID, j, 'residential', TODAY)).toEqual({ ymd: '2026-10-15', house: 'Reece', said: false, owed: 5316, words: 'Paid in full · Reece can send its own notice by Oct 15' })
  })

  it('says nothing while the customer still owes us: the Lien desk has that job', () => {
    const j = job([{ id: 'a', house: 'reece', amount: 5316, date: '2026-08-12' }])
    expect(heldNoticeRisk({ billed: 31400, paidIn: 20000 }, j, 'residential', TODAY)).toBeNull()
  })

  it('says nothing when every window has closed, or nothing is owed', () => {
    const closed = job([{ id: 'a', house: 'reece', amount: 900, date: '2026-05-12' }])
    expect(heldNoticeRisk(PAID, closed, 'residential', TODAY)).toBeNull()
    expect(heldNoticeRisk(PAID, undefined, 'residential', TODAY)).toBeNull()
  })

  it('takes the day the house gave over the estimate, and drops a day already past', () => {
    const word = (ymd: string) => new Map([['j', [{ houseId: 'reece', balance: null, noticeYmd: ymd, saidBy: 'Dana', note: '', notedByName: 'Grace', notedYmd: TODAY }]]])
    const inv = [{ id: 'a', house: 'reece', amount: 5316, date: '2026-08-12' }]
    expect(heldNoticeRisk(PAID, job(inv, word('2026-10-09')), 'residential', TODAY)).toMatchObject({ ymd: '2026-10-09', said: true, words: 'Paid in full · Reece says its notice goes out Oct 9' })
    expect(heldNoticeRisk(PAID, job(inv, word('2026-09-20')), 'residential', TODAY)).toBeNull()
  })
})
