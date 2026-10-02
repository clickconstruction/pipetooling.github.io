import { describe, expect, it } from 'vitest'
import { buildLienSupplierJobs } from '../jobs/lienJobSuppliers'
import { buildHouseAsks, houseAskChanges, houseAskMailto, houseAskMessage, houseAskStartingAnswer, houseAskSubject, pickAskRep, unpaidInvoiceNumbers, type HouseAskContact } from './houseAsk'

// Today is 2026-10-02. Kind '' reads on the commercial clock: July is due Oct 15, August Nov 16, June closed Sep 15.
const TODAY = '2026-10-02'
const HOUSES = [
  { id: 'reece', name: 'Reece' },
  { id: 'winn', name: 'Winn Supply' },
]
const INVOICES = [
  { id: 'a', supply_house_id: 'reece', amount: 5316.26, is_paid: false, invoice_date: '2026-07-12', paidYmd: null, on_job_account: false, invoice_number: 'R-1001' },
  { id: 'b', supply_house_id: 'reece', amount: 900, is_paid: false, invoice_date: '2026-08-03', paidYmd: null, on_job_account: false, invoice_number: 'R-1002' },
  { id: 'c', supply_house_id: 'reece', amount: 200, is_paid: true, invoice_date: '2026-06-03', paidYmd: '2026-07-01', on_job_account: false, invoice_number: 'R-0900' },
  { id: 'd', supply_house_id: 'winn', amount: 513.87, is_paid: false, invoice_date: '2026-06-20', paidYmd: null, on_job_account: false, invoice_number: 'W-77' },
  { id: 'e', supply_house_id: 'reece', amount: 12114.55, is_paid: false, invoice_date: '2026-08-20', paidYmd: null, on_job_account: false, invoice_number: '' },
]
const ALLOCATIONS = [
  { invoice_id: 'a', job_id: 'j363', pct: 100 },
  { invoice_id: 'b', job_id: 'j363', pct: 100 },
  { invoice_id: 'c', job_id: 'j363', pct: 100 },
  { invoice_id: 'd', job_id: 'j363', pct: 100 },
  { invoice_id: 'e', job_id: 'j650', pct: 100 },
]
const JOBS = [
  { jobId: 'j650', jobNumber: '650', jobName: 'ATI Schertz', billed: 33500, paidIn: 17777.51 },
  { jobId: 'j363', jobNumber: '363', jobName: 'Michael Palmer', billed: 31400, paidIn: 31400 },
]
const WORD = { houseId: 'reece', balance: 7393.33, noticeYmd: '2026-10-14', saidBy: 'Dana', note: 'on their list', notedByName: 'Grace', notedYmd: TODAY }
function asks(words?: Parameters<typeof buildLienSupplierJobs>[0]['wordsByJob']) {
  const suppliers = buildLienSupplierJobs({ invoices: INVOICES, allocations: ALLOCATIONS, houses: HOUSES, wordsByJob: words })
  return buildHouseAsks({ jobs: JOBS, suppliers, addressByJob: new Map([['j363', '12 Oak St, San Antonio.']]), invoiceNumbers: unpaidInvoiceNumbers(INVOICES, ALLOCATIONS), todayYmd: TODAY })
}

describe('unpaidInvoiceNumbers', () => {
  it('names the unpaid invoices per job and house, and no paid or unnumbered one', () => {
    const m = unpaidInvoiceNumbers(INVOICES, ALLOCATIONS)
    expect(m.get('j363:reece')).toEqual(['R-1001', 'R-1002'])
    expect(m.get('j363:winn')).toEqual(['W-77'])
    expect(m.has('j650:reece')).toBe(false)
  })
})

describe('buildHouseAsks', () => {
  it('gives each owed house its jobs, the most owed house first', () => {
    const [reece, winn] = asks()
    expect(reece).toMatchObject({ name: 'Reece', owed: 18330.81, firstYmd: '2026-10-15', paidInFullJobs: 1, answered: 0 })
    expect(winn).toMatchObject({ name: 'Winn Supply', owed: 513.87, firstYmd: '', paidInFullJobs: 1 })
  })

  it('puts the soonest date first within a house, and says what the house files the job under', () => {
    const [reece] = asks()
    // 363's July is due Oct 15; 650's August Nov 16.
    expect(reece!.jobs.map((j) => j.number)).toEqual(['363', '650'])
    expect(reece!.jobs[0]).toMatchObject({ owed: 6216.26, unpaidCount: 2, unpaidSince: 'July', invoiceNumbers: ['R-1001', 'R-1002'], customerPaidInFull: true, openToUs: 0, address: '12 Oak St, San Antonio.' })
    expect(reece!.jobs[1]).toMatchObject({ customerPaidInFull: false, openToUs: 15722.49 })
  })

  it('counts what is already on record and sorts by the day the house gave', () => {
    const [reece] = asks(new Map([['j650', [WORD]]]))
    expect(reece!.answered).toBe(1)
    expect(reece!.firstYmd).toBe('2026-10-14')
    expect(reece!.jobs[0]!.number).toBe('650')
  })
})

describe('houseAskMessage', () => {
  it('asks the two things, numbered by letter, with what our books show', () => {
    const [reece] = asks()
    expect(houseAskSubject(reece!, 'Click Plumbing')).toBe('Click Plumbing: balances and notice dates on 2 jobs')
    expect(houseAskMessage(reece!, { repName: 'Dana Ortiz', senderName: 'Grace', company: 'Click Plumbing' })).toBe(
      [
        'Hi Dana,',
        '',
        'Can you tell us what you show on these jobs? For each one we need two things.',
        '1. What you show as still owed.',
        '2. The day your lien notice goes out, if one is set.',
        '',
        // The address's own full stop is not doubled.
        'A. 363 Michael Palmer, 12 Oak St, San Antonio. Our books show $6,216.26 unpaid since July. Invoices R-1001, R-1002.',
        'B. 650 ATI Schertz. Our books show $12,114.55 unpaid since August.',
        '',
        'Thank you,',
        'Grace',
        'Click Plumbing',
      ].join('\n'),
    )
  })

  it('speaks of one job as one, and folds a long invoice list', () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ id: `m${i}`, supply_house_id: 'reece', amount: 10, is_paid: false, invoice_date: '2026-07-01', paidYmd: null, on_job_account: false, invoice_number: `N${i}` }))
    const alloc = many.map((m) => ({ invoice_id: m.id, job_id: 'j1', pct: 100 }))
    const [a] = buildHouseAsks({ jobs: [{ jobId: 'j1', jobNumber: '1', jobName: 'One', billed: 0, paidIn: 0 }], suppliers: buildLienSupplierJobs({ invoices: many, allocations: alloc, houses: HOUSES }), invoiceNumbers: unpaidInvoiceNumbers(many, alloc), todayYmd: TODAY })
    const text = houseAskMessage(a!, { senderName: '', company: 'Click Plumbing' })
    expect(text).toContain('Hi,')
    expect(text).toContain('what you show on this job?')
    expect(text).toContain('Invoices N0, N1, N2, N3, N4, N5 and 3 more.')
    expect(text.endsWith('Thank you,\nClick Plumbing')).toBe(true)
  })
})

describe('houseAskChanges', () => {
  const who = { saidBy: ' Dana ', notedByName: 'Grace' }

  it('saves the rows that were typed, and leaves blank rows alone', () => {
    const [reece] = asks()
    const r = houseAskChanges(reece!, { j363: { balance: '$5,000.00', noticeYmd: '2026-10-14' }, j650: { balance: '', noticeYmd: '' } }, who)
    expect(r.badJobIds).toEqual([])
    expect(r.saves).toEqual([{ jobId: 'j363', houseId: 'reece', balance: 5000, noticeYmd: '2026-10-14', saidBy: 'Dana', note: '', notedByName: 'Grace' }])
  })

  it('does not save again what is already on record, keeps a note, and takes a change', () => {
    const [reece] = asks(new Map([['j650', [WORD]]]))
    const j650 = reece!.jobs.find((j) => j.jobId === 'j650')!
    expect(houseAskStartingAnswer(j650)).toEqual({ balance: '7,393.33', noticeYmd: '2026-10-14' })
    expect(houseAskChanges(reece!, { j650: houseAskStartingAnswer(j650) }, who).saves).toEqual([])
    const changed = houseAskChanges(reece!, { j650: { balance: '0', noticeYmd: '2026-10-14' } }, who).saves
    expect(changed).toEqual([{ jobId: 'j650', houseId: 'reece', balance: 0, noticeYmd: '2026-10-14', saidBy: 'Dana', note: 'on their list', notedByName: 'Grace' }])
  })

  it('names a balance that is not a number and saves nothing for it', () => {
    const [reece] = asks()
    const r = houseAskChanges(reece!, { j363: { balance: 'about 5k', noticeYmd: '2026-10-14' } }, who)
    expect(r.badJobIds).toEqual(['j363'])
    expect(r.saves).toEqual([])
  })
})

describe('pickAskRep', () => {
  const c = (over: Partial<HouseAskContact>): HouseAskContact => ({ id: 'x', supply_house_id: 'reece', name: 'Someone', label: '', email: 'x@reece.test', phone: null, role: 'price_requests', is_default: false, ...over })
  it('takes billing, then the job-accounts rep, then the default, and never an archived or unreachable one', () => {
    expect(pickAskRep([c({ name: 'Quote Desk', is_default: true }), c({ name: 'Dana Ortiz', role: 'job_accounts', phone: '5125550142' }), c({ name: 'Pat Bill', role: 'billing' })], 'reece')?.name).toBe('Pat Bill')
    expect(pickAskRep([c({ name: 'Quote Desk', is_default: true }), c({ name: 'Dana Ortiz', role: 'job_accounts' })], 'reece')?.name).toBe('Dana Ortiz')
    expect(pickAskRep([c({ name: 'Pat Bill', role: 'billing' })], 'reece')).toMatchObject({ billing: true, roleWords: 'billing' })
    expect(pickAskRep([c({ name: 'Quote Desk', is_default: true })], 'reece')).toMatchObject({ billing: false, roleWords: 'price requests' })
    expect(pickAskRep([c({ name: 'Gone', role: 'billing', archived_at: '2026-01-01' }), c({ name: null, label: 'Counter', email: '', phone: '' })], 'reece')).toBeNull()
    expect(pickAskRep([c({})], 'winn')).toBeNull()
  })
})

describe('houseAskMailto', () => {
  it('carries the whole message when it fits, and the subject alone when it would be cut', () => {
    expect(houseAskMailto('d@reece.test', 'A & B', 'Hi,\nTwo lines')).toEqual({ href: 'mailto:d@reece.test?subject=A%20%26%20B&body=Hi%2C%0ATwo%20lines', whole: true })
    const long = houseAskMailto('d@reece.test', 'S', 'x'.repeat(3000))
    expect(long).toEqual({ href: 'mailto:d@reece.test?subject=S', whole: false })
  })
})
