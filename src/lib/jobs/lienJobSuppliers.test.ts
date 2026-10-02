import { describe, expect, it } from 'vitest'
import { buildJobAccountsView } from '../materials/jobAccountsFlow'
import {
  buildLienSupplierCard,
  buildLienSupplierJobs,
  lienSupplierEmailText,
  lienSupplierMark,
  lienSupplierNotice,
  type LienSupplierAccountInput,
  type LienSupplierInvoiceInput,
} from './lienJobSuppliers'

// Today is 2026-10-02 throughout. A commercial month's notice is due by the 15th of the third month after it.
const TODAY = '2026-10-02'

function inv(over: Partial<LienSupplierInvoiceInput> & { id: string }): LienSupplierInvoiceInput {
  return { supply_house_id: 'reece', amount: 100, is_paid: false, invoice_date: '2026-07-10', paidYmd: null, on_job_account: false, ...over }
}

const HOUSES = [
  { id: 'reece', name: 'Reece' },
  { id: 'ferg', name: 'Ferguson' },
  { id: 'moore', name: 'Moore Supply' },
]

const INVOICES: LienSupplierInvoiceInput[] = [
  inv({ id: 'r1', amount: 1480, is_paid: true, paidYmd: '2026-07-09', invoice_date: '2026-06-20' }),
  inv({ id: 'r2', amount: 9000, invoice_date: '2026-07-18' }),
  inv({ id: 'r3', amount: 612.4, invoice_date: '2026-08-03' }),
  inv({ id: 'f1', supply_house_id: 'ferg', amount: 2340.15, invoice_date: '2026-08-21', on_job_account: true }),
  inv({ id: 'm1', supply_house_id: 'moore', amount: 310, is_paid: true, paidYmd: '2026-08-01', invoice_date: '2026-06-02' }),
  inv({ id: 'm2', supply_house_id: 'moore', amount: 1105.75, invoice_date: '2026-06-11' }),
  // An open credit memo: money the house owes us. It never joins an owed figure.
  inv({ id: 'm3', supply_house_id: 'moore', amount: -50, invoice_date: '2026-06-12' }),
  // Split across two jobs: half lands on the other job.
  inv({ id: 'x1', amount: 400, invoice_date: '2026-09-01' }),
]

const ALLOCATIONS = [
  ...['r1', 'r2', 'r3', 'f1', 'm1', 'm2', 'm3'].map((id) => ({ invoice_id: id, job_id: 'job', pct: 100 })),
  { invoice_id: 'x1', job_id: 'other', pct: 50 },
  { invoice_id: 'gone', job_id: 'job', pct: 100 },
]

const ACCOUNTS = new Map<string, LienSupplierAccountInput[]>([
  [
    'job',
    [
      { houseId: 'ferg', state: 'open', accountRef: 'F-20417', rep: null },
      { houseId: 'reece', state: 'none', accountRef: '', rep: { name: 'Dana Ortiz', phone: '(512) 555-0142' } },
    ],
  ],
])

function jobs() {
  return buildLienSupplierJobs({
    invoices: INVOICES,
    allocations: ALLOCATIONS,
    houses: HOUSES,
    accountsByJob: ACCOUNTS,
    firstCustomerPaidByJob: new Map([['job', '2026-09-02']]),
  })
}

describe('buildLienSupplierJobs', () => {
  it('adds up each house: paid, owed, the job-account slice, the unpaid months', () => {
    const job = jobs().get('job')!
    expect(job.houses.map((h) => h.name)).toEqual(['Reece', 'Ferguson', 'Moore Supply'])
    const [reece, ferg, moore] = job.houses
    expect(reece).toMatchObject({ paid: 1480, invoiceCount: 3, unpaidCount: 2, unpaidMonths: ['2026-07', '2026-08'], firstPaidYmd: '2026-07-09', account: 'none' })
    expect(reece!.owed).toBeCloseTo(9612.4)
    expect(reece!.rep?.name).toBe('Dana Ortiz')
    expect(ferg).toMatchObject({ paid: 0, owed: 2340.15, owedOnJobAccount: 2340.15, account: 'open', accountRef: 'F-20417' })
    // The credit memo counts as an invoice on the job, and stays out of owed.
    expect(moore).toMatchObject({ paid: 310, owed: 1105.75, invoiceCount: 3, unpaidCount: 1, unpaidMonths: ['2026-06'] })
    expect(job.paid).toBeCloseTo(1790)
    expect(job.owed).toBeCloseTo(13058.3)
    expect(job.housesOwed).toBe(3)
    expect(job.firstHousePaidYmd).toBe('2026-07-09')
    expect(job.firstCustomerPaidYmd).toBe('2026-09-02')
  })

  it('splits an invoice by its percent and skips an allocation with no invoice', () => {
    const other = jobs().get('other')!
    expect(other.owed).toBe(200)
    expect(other.houses).toHaveLength(1)
  })

  it('agrees with Held for suppliers on every house', () => {
    const view = buildJobAccountsView(
      [{ id: 'job', hcp_number: '712', click_number: null, job_name: 'Dental', revenue: 36000, payments_made: 17600 }],
      INVOICES.map((i) => ({ id: i.id, supply_house_id: i.supply_house_id, amount: i.amount, is_paid: i.is_paid, due_date: null, on_job_account: i.on_job_account })),
      ALLOCATIONS,
      HOUSES,
      [],
      TODAY,
    )
    const row = view.rows.find((r) => r.jobId === 'job')!
    const job = jobs().get('job')!
    expect(job.paid).toBeCloseTo(row.suppliersPaid)
    expect(job.owed).toBeCloseTo(row.suppliersOwed)
    expect(job.owedOnJobAccount).toBeCloseTo(row.owedOnJobAccount)
    for (const g of row.houses) {
      const h = job.houses.find((x) => x.houseId === g.supplyHouseId)!
      expect(h.paid).toBeCloseTo(g.paid)
      expect(h.owed).toBeCloseTo(g.owed)
      expect(h.unpaidCount).toBe(g.unpaidCount)
      expect(h.invoiceCount).toBe(g.invoiceCount)
    }
  })
})

describe('lienSupplierMark', () => {
  it('marks a job only while a house is owed', () => {
    expect(lienSupplierMark(undefined)).toBeNull()
    const paidUp = buildLienSupplierJobs({ invoices: [inv({ id: 'p', is_paid: true, paidYmd: '2026-08-01' })], allocations: [{ invoice_id: 'p', job_id: 'j', pct: 100 }], houses: HOUSES })
    expect(lienSupplierMark(paidUp.get('j'))).toBeNull()
  })

  it('says how many houses and how much, and turns teal on a job account', () => {
    const mark = lienSupplierMark(jobs().get('job'))!
    expect(mark.words).toBe('3 houses owed $13,058 · job account')
    expect(mark.short).toBe('$13,058')
    expect(mark.jobAccount).toBe(true)
    expect(mark.title).toContain('Reece $9,612')
    const plain = lienSupplierMark(jobs().get('other'))!
    expect(plain.words).toBe('1 house owed $200')
    expect(plain.jobAccount).toBe(false)
  })
})

describe('lienSupplierNotice', () => {
  it('names the next open window by the desk’s rule', () => {
    // July on a commercial property: the 15th of October.
    expect(lienSupplierNotice(['2026-07', '2026-08'], 'non_residential', TODAY)).toEqual({ kind: 'open', ymd: '2026-10-15', daysLeft: 13, soon: true })
    // Residential is a month earlier: July closed Sep 15, August is due Oct 15.
    expect(lienSupplierNotice(['2026-07', '2026-08'], 'residential', TODAY)).toMatchObject({ kind: 'open', ymd: '2026-10-15' })
    // August on a commercial property: Nov 15 is a Sunday, so the 16th. Not soon.
    expect(lienSupplierNotice(['2026-08'], 'non_residential', TODAY)).toEqual({ kind: 'open', ymd: '2026-11-16', daysLeft: 45, soon: false })
  })

  it('says closed when every unpaid month’s window has passed, and none with nothing to count from', () => {
    expect(lienSupplierNotice(['2026-06'], 'non_residential', TODAY)).toEqual({ kind: 'closed', ymd: '2026-09-15' })
    expect(lienSupplierNotice([], 'non_residential', TODAY)).toEqual({ kind: 'none' })
  })
})

describe('buildLienSupplierCard', () => {
  const ctx = { propertyKind: 'non_residential', todayYmd: TODAY, openBalance: 18400, payerName: 'Alder' }

  it('draws a row per house with its account, its months and its own notice', () => {
    const card = buildLienSupplierCard(jobs().get('job')!, ctx)
    expect(card.housesWord).toBe('3 houses')
    expect(card.rows[0]).toMatchObject({ name: 'Reece', accountWords: 'no job account', repWords: 'rep Dana Ortiz', unpaidSince: 'July materials', invoiceWords: '2 unpaid of 3 invoices', notice: { kind: 'open', ymd: '2026-10-15' } })
    expect(card.rows[1]).toMatchObject({ name: 'Ferguson', accountWords: 'job account open · F-20417', accountOpen: true, notice: { kind: 'open', ymd: '2026-11-16' } })
    expect(card.rows[2]).toMatchObject({ name: 'Moore Supply', unpaidSince: 'June materials', notice: { kind: 'closed', ymd: '2026-09-15' } })
  })

  it('joins the two debts in one line, either way', () => {
    expect(buildLienSupplierCard(jobs().get('job')!, ctx).verdict).toBe('The $18,400.00 Alder owes us covers what the houses are owed.')
    expect(buildLienSupplierCard(jobs().get('job')!, { ...ctx, openBalance: 10000 }).verdict).toBe('The houses are owed $3,058.30 more than Alder owes us.')
    expect(buildLienSupplierCard(jobs().get('job')!, { ...ctx, openBalance: 0 }).verdict).toBeNull()
  })

  it('says we paid first only when we did', () => {
    expect(buildLienSupplierCard(jobs().get('job')!, ctx).paidFirst).toBe('We paid a house first on Jul 9. Alder’s first payment to us came on Sep 2.')
    const late = buildLienSupplierJobs({ invoices: INVOICES, allocations: ALLOCATIONS, houses: HOUSES, firstCustomerPaidByJob: new Map([['job', '2026-06-01']]) })
    expect(buildLienSupplierCard(late.get('job')!, ctx).paidFirst).toBeNull()
    const never = buildLienSupplierJobs({ invoices: INVOICES, allocations: ALLOCATIONS, houses: HOUSES })
    expect(buildLienSupplierCard(never.get('job')!, { ...ctx, payerName: '' }).paidFirst).toBe('We paid a house first on Jul 9. No payment has come in on this job yet.')
  })

  it('folds to one line when every house is paid', () => {
    const paidUp = buildLienSupplierJobs({ invoices: [inv({ id: 'p', amount: 4210, is_paid: true, paidYmd: '2026-08-01' })], allocations: [{ invoice_id: 'p', job_id: 'j', pct: 100 }], houses: HOUSES })
    const card = buildLienSupplierCard(paidUp.get('j')!, ctx)
    expect(card.owed).toBe(0)
    expect(card.verdict).toBeNull()
    expect(card.paidLine).toBe('1 house, all paid · $4,210.00')
    expect(card.rows[0]).toMatchObject({ invoiceWords: '1 invoice, all paid', notice: { kind: 'none' } })
  })
})

describe('lienSupplierEmailText', () => {
  it('writes short sentences, one fact each', () => {
    const job = jobs().get('job')!
    const card = buildLienSupplierCard(job, { propertyKind: 'non_residential', todayYmd: TODAY, openBalance: 18400, payerName: 'Alder' })
    const text = lienSupplierEmailText(card, { jobLabel: '712 · Cedar Park Dental', todayYmd: TODAY, openBalance: 18400, firstHousePaidYmd: job.firstHousePaidYmd, firstCustomerPaidYmd: job.firstCustomerPaidYmd })
    expect(text).toBe(
      [
        'Supply houses on 712 · Cedar Park Dental',
        'From our books on October 2, 2026.',
        '',
        'Three supply houses sold materials for this job. We have paid them $1,790.00. They are still owed $13,058.30.',
        '',
        'Reece is owed $9,612.40. Its oldest unpaid materials are from July. We expect its own notice by October 15.',
        'Ferguson is owed $2,340.15 on a job account. Its oldest unpaid materials are from August. We expect its own notice by November 16.',
        // A closed window is ours to know: the house is named with its money only.
        'Moore Supply is owed $1,105.75.',
        '',
        'A supply house’s notice is its own claim for materials. It is not part of the $18,400.00 owed to us. Our release does not cover it. Paying us the $18,400.00 is what lets us pay them.',
        '',
        'We paid a supply house on this job on July 9. Your first payment to us came on September 2.',
      ].join('\n'),
    )
  })

  it('speaks of one house as one, and leaves out what is not so', () => {
    const one = buildLienSupplierJobs({ invoices: [inv({ id: 'a', amount: 500 })], allocations: [{ invoice_id: 'a', job_id: 'j', pct: 100 }], houses: HOUSES })
    const card = buildLienSupplierCard(one.get('j')!, { propertyKind: '', todayYmd: TODAY, openBalance: 300, payerName: 'Alder' })
    const text = lienSupplierEmailText(card, { jobLabel: '9 · Small', todayYmd: TODAY, openBalance: 300, firstHousePaidYmd: null, firstCustomerPaidYmd: null })
    expect(text).toContain('One supply house sold materials for this job. It is still owed $500.00.')
    expect(text).not.toContain('We have paid')
    expect(text).not.toContain('is what lets us pay')
    expect(text).not.toContain('We paid a supply house')
  })
})
