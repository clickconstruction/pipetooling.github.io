import { describe, expect, it } from 'vitest'
import type { ExpectedPayModel, PaySpeedData } from '../jobs/billedExpectedPay'
import type { MemberBid, MemberJob, Members } from './overview'
import {
  MONEY_SORT_COLUMN,
  MONEY_SORT_IS_SETTING,
  MONEY_SORT_LABELS,
  MONEY_SORT_MODES,
  buildSiteMoney,
  moneyLookWords,
  sortMoneyRows,
  type MoneyDates,
  type MoneyRow,
  type SiteMoneyInputs,
} from './siteMoney'

const TODAY = '2026-10-29'

function job(over: Partial<MemberJob> & { id: string }): MemberJob {
  return {
    hcp_number: null, click_number: over.id, job_name: null, job_address: null, customer_id: null, customer_name: null, gc_customer_id: null,
    development_id: 'harlow', bid_id: null, status: null, revenue: null, payments_made: null, last_work_date: null, last_bill_date: null,
    job_plans_link: null, created_at: null, updated_at: null, service_type_id: null, ...over,
  }
}

function bid(over: Partial<MemberBid> & { id: string }): MemberBid {
  return {
    bid_number: over.id, project_name: null, address: null, customer_id: null, estimator_id: null, account_manager_id: null, development_id: 'harlow',
    outcome: null, outcome_at: null, bid_value: null, agreed_value: null, priced_revenue_usd: null, bid_date_sent: null, bid_due_date: null,
    estimated_job_start_date: null, plans_link: null, design_drawing_plan_date: null, gc_contact_name: null, gc_contact_phone: null, gc_contact_email: null,
    created_at: null, updated_at: null, working_board_archived_at: null, service_type_id: null, last_contact: null, ...over,
  }
}

const paySpeed: PaySpeedData = {
  company: null,
  customers: { 'c-ridgeway': { medianDays: 30, samples: 6 } },
  segments: { residential: null, commercial: null },
  customerTypes: {},
  receipts: {},
  quality: null,
}

function inputs(members: Partial<Members>, over: Partial<SiteMoneyInputs> = {}): SiteMoneyInputs {
  return {
    members: { bids: members.bids ?? [], jobs: members.jobs ?? [] },
    invoices: [],
    names: new Map([['u-dana', 'Dana'], ['u-mel', 'Mel'], ['u-luis', 'Luis']]),
    teamMembers: [],
    jobLabel: (j) => j.click_number ?? j.hcp_number ?? j.id,
    paySpeed: null,
    todayYmd: TODAY,
    ...over,
  }
}

const money = (n: number) => `$${n.toLocaleString('en-US')}`

describe('buildSiteMoney — the band', () => {
  it('with no job: zeros, no percent, no sections, and the strip says so', () => {
    const model = buildSiteMoney(inputs({}))
    expect(model.sections).toEqual([])
    expect(model.band).toMatchObject({ pct: null, pctMissing: 0, value: 0, paid: 0, billed: 0, doneNotBilled: 0, left: 0, jobs: 0, pastDue: 0, stages: [], bidUndecidedUsd: 0, bidUndecidedCount: 0 })
    expect(moneyLookWords(model, money)).toEqual({ count: 'no job yet', need: null })
  })

  it('sums the jobs, weights the percent by value, and counts the undecided bids', () => {
    const model = buildSiteMoney(
      inputs({
        jobs: [
          job({ id: 'JP1101', status: 'working', revenue: 10_000, payments_made: 2_000, pct_complete: 50 }),
          job({ id: 'JP1102', status: 'billed', revenue: 8_000, payments_made: 3_000, pct_complete: 100, last_work_date: '2026-08-20' }),
          job({ id: 'JP1103', status: 'paid', revenue: 5_000, payments_made: 5_000 }),
        ],
        bids: [bid({ id: 'BP401', bid_value: 4_000 }), bid({ id: 'BP402', outcome: 'won', agreed_value: 9_000 }), bid({ id: 'BP403', outcome: 'lost', bid_value: 2_000 })],
      }),
    )
    expect(model.band).toMatchObject({ pct: 78, pctMissing: 0, value: 23_000, paid: 10_000, billed: 5_000, doneNotBilled: 3_000, left: 13_000, jobs: 3, pastDue: 0, bidUndecidedUsd: 4_000, bidUndecidedCount: 1 })
    expect(model.band.stages).toEqual([
      { key: 'billed', label: 'Billed', count: 1, color: '#f97316' },
      { key: 'working', label: 'Working', count: 1, color: '#3b82f6' },
      { key: 'paid', label: 'Paid', count: 1, color: '#22c55e' },
    ])
    expect(moneyLookWords(model, money)).toEqual({ count: '$13,000 left', need: null })
  })

  it('the percent is missing while a live job with a value has none; a paid job reads 100 and a job with no value is not missing', () => {
    const missing = buildSiteMoney(inputs({ jobs: [job({ id: 'JP1101', status: 'working', revenue: 6_000 }), job({ id: 'JP1103', status: 'paid', revenue: 5_000, payments_made: 5_000 })] }))
    expect(missing.band.pct).toBeNull()
    expect(missing.band.pctMissing).toBe(1)
    expect(missing.sections.find((s) => s.key === 'paid')?.rows[0]?.pct).toBe(100)
    const noValue = buildSiteMoney(inputs({ jobs: [job({ id: 'JP1104', status: 'working' }), job({ id: 'JP1105', status: 'working', revenue: 2_000, pct_complete: 25 })] }))
    expect(noValue.band).toMatchObject({ pct: 25, pctMissing: 0 })
    expect(buildSiteMoney(inputs({ jobs: [job({ id: 'JP1104', status: 'working' })] })).band).toMatchObject({ pct: null, pctMissing: 0 })
  })

  it('clamps a percent to 0–100 and rounds it', () => {
    const rows = buildSiteMoney(inputs({ jobs: [job({ id: 'JP1101', status: 'working', revenue: 100, pct_complete: 137 }), job({ id: 'JP1102', status: 'working', revenue: 100, pct_complete: -5 }), job({ id: 'JP1103', status: 'working', revenue: 100, pct_complete: 33.4 })] })).sections[0]!.rows
    expect(rows.map((r) => r.pct)).toEqual([100, 0, 33])
  })
})

describe('buildSiteMoney — the sections and rows', () => {
  it('orders the stages, labels them, reads an unknown status as Other, and folds only Paid', () => {
    const model = buildSiteMoney(
      inputs({ jobs: [job({ id: 'JP1', status: 'Paid ' }), job({ id: 'JP2', status: 'waiting' }), job({ id: 'JP3', status: 'ready_to_bill' }), job({ id: 'JP4', status: 'working' }), job({ id: 'JP5', status: 'billed' }), job({ id: 'JP6', status: 'bogus' })] }),
    )
    expect(model.sections.map((s) => [s.key, s.label, s.defaultFolded])).toEqual([
      ['billed', 'Billed', false], ['ready_to_bill', 'Ready to bill', false], ['working', 'Working', false], ['waiting', 'Waiting', false], ['other', 'Other', false], ['paid', 'Paid', true],
    ])
    expect(model.sections.find((s) => s.key === 'other')).toMatchObject({ color: '#9ca3af', rows: [{ number: 'JP6', stageWord: 'Other' }] })
  })

  it('caps paid at the value on a live job, reads a paid job as fully paid, and bills only the billed stage', () => {
    const model = buildSiteMoney(
      inputs({
        jobs: [
          job({ id: 'JP1101', status: 'working', revenue: 4_000, payments_made: 5_000, pct_complete: 50 }),
          job({ id: 'JP1102', status: 'paid', revenue: 4_000, payments_made: 3_000 }),
          job({ id: 'JP1103', status: 'billed', revenue: 9_000, payments_made: 2_500, pct_complete: 80 }),
          job({ id: 'JP1104', status: 'waiting', revenue: -50 }),
        ],
      }),
    )
    const by = Object.fromEntries(model.sections.flatMap((s) => s.rows).map((r) => [r.number, r]))
    expect(by.JP1101).toMatchObject({ paid: 4_000, billed: 0, doneNotBilled: 0, left: 0 })
    expect(by.JP1102).toMatchObject({ paid: 4_000, billed: 0, doneNotBilled: 0, left: 0, pct: 100 })
    expect(by.JP1103).toMatchObject({ paid: 2_500, billed: 6_500, doneNotBilled: 0, left: 6_500 })
    expect(by.JP1104).toMatchObject({ value: 0, paid: 0, left: 0 })
    expect(model.sections.find((s) => s.key === 'billed')?.sums).toEqual({ count: 1, left: 6_500, pastDue: 0, doneNotBilled: 0, paid: 2_500 })
  })

  it('names the crew by first name plus the count, and a waiting job with no crew is not scheduled', () => {
    const teamMembers = [
      { job_id: 'JP1', user_id: 'u-dana' }, { job_id: 'JP1', user_id: 'u-mel' }, { job_id: 'JP1', user_id: 'u-mel' }, { job_id: 'JP1', user_id: 'u-nobody' },
      { job_id: 'JP2', user_id: 'u-luis' },
    ]
    const model = buildSiteMoney(inputs({ jobs: [job({ id: 'JP1', status: 'waiting' }), job({ id: 'JP2', status: 'waiting' }), job({ id: 'JP3', status: 'waiting' }), job({ id: 'JP4', status: 'working' })] }, { teamMembers }))
    const rows = model.sections.flatMap((s) => s.rows)
    expect(rows.map((r) => [r.number, r.crew, r.next.words])).toEqual([
      ['JP4', null, null],
      ['JP1', 'Dana, +1', null],
      ['JP2', 'Luis', null],
      ['JP3', null, 'not scheduled'],
    ])
  })

  it('a billed row carries its dates: the newest live bill, the lien day from the last work, and the expected pay from the payer pace', () => {
    const invoices = [
      { id: 'i1', job_id: 'JP1105', amount: 12_000, status: 'void', billed_at: '2026-10-25T15:00:00Z', sent_to_customer_at: null },
      { id: 'i2', job_id: 'JP1105', amount: 12_000, status: 'sent', billed_at: '2026-09-02T02:00:00Z', sent_to_customer_at: null },
      { id: 'i3', job_id: 'JP1105', amount: 12_000, status: 'sent', billed_at: '2026-07-10T15:00:00Z', sent_to_customer_at: null },
      { id: 'i4', job_id: 'JP1106', amount: 3_000, status: 'sent', billed_at: '2026-10-20T15:00:00Z', sent_to_customer_at: null },
    ]
    const ridgeway = { customer_id: 'c-ridgeway', customer_name: 'Ridgeway Builders', status: 'billed', revenue: 12_000, payments_made: 0 }
    const model = buildSiteMoney(
      inputs({
        jobs: [
          job({ id: 'JP1105', ...ridgeway, last_work_date: '2026-08-20' }),
          job({ id: 'JP1106', ...ridgeway, last_work_date: '2026-09-05' }),
          job({ id: 'JP1107', ...ridgeway, last_bill_date: '2026-10-01T00:00:00' }),
          job({ id: 'JP1108', ...ridgeway }),
          job({ id: 'JP1109', ...ridgeway, status: 'working', last_work_date: '2026-08-20' }),
        ],
      }, { invoices, paySpeed }),
    )
    const by = Object.fromEntries(model.sections.flatMap((s) => s.rows).map((r) => [r.number, r]))
    expect(by.JP1105!.dates).toMatchObject({ billedYmd: '2026-09-01', billedAgoDays: 58, lien: { ymd: '2026-11-16', daysLeft: 18, kindAssumed: true }, expected: { state: 'late', daysLate: 28, source: 'customer' } })
    expect(by.JP1105!.next).toEqual({ askForDate: true, notice: true, words: null })
    expect(by.JP1106!.dates).toMatchObject({ billedYmd: '2026-10-20', billedAgoDays: 9, lien: { daysLeft: 47 }, expected: { state: 'upcoming', daysLate: 0 } })
    expect(by.JP1106!.next.askForDate).toBe(false)
    expect(by.JP1107!.dates).toMatchObject({ billedYmd: '2026-10-01', billedAgoDays: 28, lien: null, expected: { expectedYmd: '2026-10-31', state: 'upcoming' } })
    expect(by.JP1108!.dates).toEqual({ billedYmd: null, billedAgoDays: null, expected: null, lien: null })
    expect(by.JP1108!.next).toEqual({ askForDate: false, notice: false, words: null })
    expect(by.JP1109!.dates).toBeNull()
    expect(model.band.pastDue).toBe(1)
    expect(model.sections.find((s) => s.key === 'billed')?.sums.pastDue).toBe(1)
    expect(moneyLookWords(model, money)).toEqual({ count: '$60,000 left', need: '1 bill past due' })
  })

  it('without a pay pace a bill is never past due; two late bills read as bills', () => {
    const late = (id: string) => ({ id: `i-${id}`, job_id: id, amount: 1_000, status: 'sent', billed_at: '2026-06-01T15:00:00Z', sent_to_customer_at: null })
    const jobs = [job({ id: 'JP1', status: 'billed', revenue: 1_000, customer_id: 'c-ridgeway' }), job({ id: 'JP2', status: 'billed', revenue: 1_000, customer_id: 'c-ridgeway' })]
    expect(moneyLookWords(buildSiteMoney(inputs({ jobs }, { invoices: [late('JP1'), late('JP2')] })), money)).toEqual({ count: '$2,000 left', need: null })
    expect(moneyLookWords(buildSiteMoney(inputs({ jobs }, { invoices: [late('JP1'), late('JP2')], paySpeed })), money).need).toBe('2 bills past due')
  })
})

function row(over: Partial<MoneyRow> & { number: string }): MoneyRow {
  return {
    key: `job:${over.number}`, jobId: over.number, name: '', stageKey: 'working', stageWord: 'Working', stageColor: '', crew: null, lastWorkYmd: null,
    pct: null, value: 0, paid: 0, billed: 0, doneNotBilled: 0, left: 0, dates: null, next: { askForDate: false, notice: false, words: null }, ...over,
  }
}

function expected(daysLate: number): ExpectedPayModel {
  return { expectedYmd: '2026-10-01', state: daysLate > 0 ? 'late' : 'upcoming', source: 'customer', medianDays: 30, samples: 6, payers: 0, daysLate, paceWords: 'pays in ~30d', label: '', title: '' }
}

function dates(over: Partial<MoneyDates>): MoneyDates {
  return { billedYmd: null, billedAgoDays: null, expected: null, lien: null, ...over }
}

const lien = (daysLeft: number) => ({ ymd: '2026-11-16', daysLeft, kindAssumed: true })
const numbers = (rows: MoneyRow[]) => rows.map((r) => r.number)

describe('sortMoneyRows', () => {
  it('job number: highest first, a label with no number last', () => {
    expect(numbers(sortMoneyRows([row({ number: 'JP1099' }), row({ number: 'JP1102' }), row({ number: 'draft' }), row({ number: 'JP1101' })], 'number', 'working'))).toEqual(['JP1102', 'JP1101', 'JP1099', 'draft'])
  })

  it('% complete: least done first, no percent last, ties by number', () => {
    const rows = [row({ number: 'JP1101', pct: 80 }), row({ number: 'JP1102', pct: null }), row({ number: 'JP1103', pct: 20 }), row({ number: 'JP1104', pct: 20 })]
    expect(numbers(sortMoneyRows(rows, 'progress', 'billed'))).toEqual(['JP1104', 'JP1103', 'JP1101', 'JP1102'])
  })

  it('most left: the biggest remainder first, ties by number', () => {
    const rows = [row({ number: 'JP1101', left: 5_000 }), row({ number: 'JP1102', left: 9_000 }), row({ number: 'JP1103', left: 5_000 })]
    expect(numbers(sortMoneyRows(rows, 'left', 'paid'))).toEqual(['JP1102', 'JP1103', 'JP1101'])
  })

  it('tightest in Billed: the shortest lien runway, then the longest past the expected day, then the number', () => {
    const rows = [
      row({ number: 'JP1101', dates: dates({ lien: lien(47) }) }),
      row({ number: 'JP1102', dates: dates({ lien: null, expected: expected(40) }) }),
      row({ number: 'JP1103', dates: dates({ lien: lien(18), expected: expected(3) }) }),
      row({ number: 'JP1104', dates: dates({ lien: lien(18), expected: expected(28) }) }),
      row({ number: 'JP1105', dates: dates({ lien: lien(18), expected: expected(3) }) }),
    ]
    expect(numbers(sortMoneyRows(rows, 'tightest', 'billed'))).toEqual(['JP1104', 'JP1105', 'JP1103', 'JP1101', 'JP1102'])
  })

  it('tightest elsewhere: the last work newest first, none last, ties by number; in Paid the number', () => {
    const rows = [row({ number: 'JP1101', lastWorkYmd: '2026-10-20' }), row({ number: 'JP1102', lastWorkYmd: '2026-10-27' }), row({ number: 'JP1103' }), row({ number: 'JP1104', lastWorkYmd: '2026-10-27' })]
    expect(numbers(sortMoneyRows(rows, 'tightest', 'working'))).toEqual(['JP1104', 'JP1102', 'JP1101', 'JP1103'])
    expect(numbers(sortMoneyRows(rows, 'tightest', 'waiting'))).toEqual(['JP1104', 'JP1102', 'JP1101', 'JP1103'])
    expect(numbers(sortMoneyRows(rows, 'tightest', 'paid'))).toEqual(['JP1104', 'JP1103', 'JP1102', 'JP1101'])
  })

  it('leaves the rows it was handed in their order', () => {
    const rows = [row({ number: 'JP1101' }), row({ number: 'JP1102' })]
    sortMoneyRows(rows, 'number', 'working')
    expect(numbers(rows)).toEqual(['JP1101', 'JP1102'])
  })
})

describe('the sort tables', () => {
  it('four modes, each with a chip label and a column head; only tightest and number are settings', () => {
    expect(MONEY_SORT_MODES).toEqual(['tightest', 'progress', 'left', 'number'])
    expect(MONEY_SORT_LABELS).toEqual({ tightest: 'tightest first', progress: '% complete', left: 'most left', number: 'job number' })
    expect(MONEY_SORT_COLUMN).toEqual({ tightest: 'dates', progress: 'progress', left: 'money', number: 'job' })
    expect(MONEY_SORT_MODES.filter((m) => MONEY_SORT_IS_SETTING.has(m))).toEqual(['tightest', 'number'])
  })
})
