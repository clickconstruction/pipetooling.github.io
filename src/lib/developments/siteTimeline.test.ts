/**
 * The Money look's Timeline (v2.6493, punch list #257): every job's events built the Job Summary way and
 * tagged with the job, folded per job and source for the tooltip, merged in date order, and the parity
 * that holds it together: the site's end is the sum of the jobs' own ends, and the events built from the
 * cost rows sum to the Costs column's figures. Harlow Ranch's made-up rows; nothing is real.
 */
import { describe, expect, it } from 'vitest'
import type { CardChargeExclusions } from '../../../supabase/functions/_shared/cardChargeAllocationFilter'
import type { CategoryTagRow } from '../banking/categoryTags'
import { buildJobChargesTimelineChartData, type JobChargeEvent, type JobPaymentEvent } from '../jobChargesTimeline'
import { jobCostsFromRows, type SiteCostRows } from './siteCosts'
import type { SiteLabor } from './siteLabor'
import {
  assembleSiteTimelineJobs,
  buildSiteTimeline,
  foldSiteChargeEvents,
  overheadDaysFromLines,
  overheadSinceWords,
  siteChargeEventsFromCostRows,
  siteFuelTxIds,
  siteJobHasDatedEvent,
  sitePaymentEvents,
  siteTeamLaborEvents,
  siteTimelineEndWords,
  siteTimelineLeftOutJobs,
  siteTimelineLeftOutReason,
  siteTimelineLeftOutWords,
  siteTimelinePrintHtml,
  siteTimelineScopeWords,
  siteTimelineStripLines,
  siteTimelineStripSum,
  siteTimelineValueWords,
  siteValueEventsFromRows,
  tagJob,
  thinChargeIcons,
  type SiteTimelineJob,
} from './siteTimeline'

const toYmd = (raw: string | null | undefined) => (raw ? raw.slice(0, 10) : null)
const label = (id: string) => ({ j1: 'JP612', j2: 'JP583', j3: 'JP953' })[id] ?? id

/** Job 1 sits apart on a card: the bank's sign (a purchase negative), a refund, a fuel stop, an internal transfer, one charge also on an invoice. */
const exclusions: CardChargeExclusions = { bucketByTxId: new Map([['tx-transfer', 'internal_transfer']]), invoiceLinkedTxIds: new Set(['tx-linked']) }

const ROWS: SiteCostRows = {
  jobIds: ['j1', 'j2', 'j3'],
  invoiceAmounts: [
    { job_id: 'j1', invoice_amount: 1200 },
    { job_id: 'j2', invoice_amount: 300 },
  ],
  cardAlloc: [
    { job_id: 'j1', id: 'a1', mercury_transaction_id: 'tx-lowes', amount: -412.5, note: null, mercury_transactions: { posted_at: '2026-03-02T15:00:00Z', counterparty_name: 'Lowe’s', amount: -412.5, mercury_category: 'Hardware' } as never },
    { job_id: 'j1', id: 'a2', mercury_transaction_id: 'tx-refund', amount: 40, note: null, mercury_transactions: { posted_at: '2026-03-02T16:00:00Z', counterparty_name: 'Lowe’s', amount: 40 } as never },
    { job_id: 'j1', id: 'a3', mercury_transaction_id: 'tx-shell', amount: -60, note: null, mercury_transactions: { posted_at: '2026-03-02T17:00:00Z', counterparty_name: 'Shell', amount: -60, mercury_category: 'Gas' } as never },
    { job_id: 'j1', id: 'a4', mercury_transaction_id: 'tx-transfer', amount: -500, note: null, mercury_transactions: { posted_at: '2026-03-03T10:00:00Z', counterparty_name: 'Transfer', amount: -500 } as never },
    { job_id: 'j1', id: 'a5', mercury_transaction_id: 'tx-linked', amount: -200, note: null, mercury_transactions: { posted_at: '2026-03-04T10:00:00Z', counterparty_name: 'Ferguson', amount: -200 } as never },
    { job_id: 'j2', id: 'a6', mercury_transaction_id: 'tx-hd', amount: -75, note: null, mercury_transactions: { posted_at: null, counterparty_name: 'Home Depot', amount: -75 } as never },
  ],
  cardExclusions: exclusions,
  tally: [{ id: 't1', job_id: 'j1', quantity: 2, part_id: 'p1', price_at_time: 12.5, fixture_cost: null, fixture_name: 'Elbow', part_name: '3/4 PVC elbow', created_at: '2026-03-05T12:00:00Z', created_by_name: 'Dana' }],
  otherCharges: [
    { job_id: 'j1', amount: 150, created_at: '2026-03-06T12:00:00Z', description: 'Permit' },
    { job_id: 'j2', amount: null, created_at: '2026-03-06T12:00:00Z', description: 'Nothing' },
  ],
  sheets: [
    { id: 's1', job_ledger_id: 'j1', labor_rate: 50, distance_miles: 0, assigned_to_name: 'Reyes Excavating', job_date: '2026-03-07', created_at: '2026-03-01T00:00:00Z' },
    { id: 's2', job_ledger_id: 'j2', labor_rate: 40, distance_miles: 0, assigned_to_name: null, job_date: null, created_at: '2026-03-08T00:00:00Z' },
  ],
  items: [
    { job_id: 's1', count: 2, hrs_per_unit: 3, is_fixed: false, labor_rate: 50, direct_labor_amount: null },
    { job_id: 's2', count: 1, hrs_per_unit: 2, is_fixed: false, labor_rate: 40, direct_labor_amount: null },
  ],
  settings: [],
  supplyAlloc: [
    { job_id: 'j1', pct: 100, supply_house_invoices: { invoice_number: '1001', invoice_date: '2026-03-01', amount: 1200, is_paid: true, on_job_account: false, supply_houses: { name: 'Ferguson' } } },
    { job_id: 'j2', pct: 50, supply_house_invoices: { invoice_number: '1002', invoice_date: '2026-03-09', amount: 600, is_paid: false, on_job_account: false, supply_houses: { name: 'Moore Supply' } } },
  ],
}

const LABOR: SiteLabor = {
  byJobId: new Map([
    [
      'j1',
      {
        jobId: 'j1',
        hours: 16,
        costUsd: 480,
        days: 2,
        people: [
          { personName: 'Luis', personId: 'p1', userId: null, hours: 8, costUsd: 240, days: 1, leadDays: 1, byWorkDate: [{ ymd: '2026-03-02', hours: 8, costUsd: 240 }] },
          { personName: 'Mateo', personId: 'p2', userId: null, hours: 8, costUsd: 240, days: 2, leadDays: 0, byWorkDate: [{ ymd: '2026-03-02', hours: 4, costUsd: 120 }, { ymd: '2026-03-03', hours: 4, costUsd: 120 }] },
        ],
      },
    ],
    ['j3', { jobId: 'j3', hours: 3, costUsd: 0, days: 0, people: [{ personName: 'Tom', personId: null, userId: null, hours: 3, costUsd: 0, days: 0, leadDays: 0 }] }],
  ]),
  siteDays: 2,
  people: 3,
  daysKnown: true,
}

const PAYMENTS = [
  { job_id: 'j1', amount: 5000, paid_on: '2026-03-10', created_at: '2026-03-11T00:00:00Z', payment_type: 'check', note: null },
  { job_id: 'j1', amount: 0, paid_on: '2026-03-12', created_at: null },
  { job_id: 'j2', amount: '250', paid_on: null, created_at: '2026-03-12T09:00:00Z', note: 'ACH' },
]

const sum = (events: readonly { amount: number }[]) => Math.round(events.reduce((s, e) => s + e.amount, 0) * 100) / 100

describe('siteChargeEventsFromCostRows', () => {
  const byJob = siteChargeEventsFromCostRows(ROWS, { fuelTxIds: new Set(['tx-shell']), toYmd })

  it('builds each job’s five streams the Job Summary way and tags them with the job', () => {
    const j1 = byJob.get('j1')!
    expect(j1.every((e) => e.jobId === 'j1')).toBe(true)
    expect(j1.map((e) => e.source).sort()).toEqual(['billed_material', 'fuel', 'mercury_card', 'mercury_card', 'sub_labor', 'supply_house', 'tally_part'])
    // The one card rule: the transfer is out, the invoice-linked charge is out, the refund nets.
    expect(j1.find((e) => e.label.startsWith('Transfer'))).toBeUndefined()
    expect(j1.find((e) => e.label.startsWith('Ferguson') && e.source === 'mercury_card')).toBeUndefined()
    expect(j1.filter((e) => e.source === 'mercury_card').map((e) => e.amount)).toEqual([412.5, -40])
    expect(j1.find((e) => e.source === 'fuel')).toMatchObject({ amount: 60, dateKey: '2026-03-02' })
    expect(j1.find((e) => e.source === 'supply_house')).toMatchObject({ amount: 1200, dateKey: '2026-03-01' })
    expect(j1.find((e) => e.source === 'tally_part')).toMatchObject({ amount: 25, dateKey: '2026-03-05' })
    expect(j1.find((e) => e.source === 'billed_material')).toMatchObject({ amount: 150, label: 'Permit', dateKey: '2026-03-06' })
    expect(j1.find((e) => e.source === 'sub_labor')).toMatchObject({ amount: 300, dateKey: '2026-03-07', who: 'Reyes Excavating' })
  })

  it('a sheet with no job date takes the day it was made; a card line with no posted day has no date', () => {
    const j2 = byJob.get('j2')!
    expect(j2.find((e) => e.source === 'sub_labor')).toMatchObject({ amount: 80, dateKey: '2026-03-08', who: 'Sub' })
    expect(j2.find((e) => e.source === 'mercury_card')).toMatchObject({ amount: 75, dateKey: null })
    expect(j2.find((e) => e.source === 'supply_house')).toMatchObject({ amount: 300 })
  })

  it('parity with the Costs column: each job’s events sum to jobCostsFromRows’ total (team labor apart)', () => {
    const costs = jobCostsFromRows(ROWS)
    for (const jobId of ROWS.jobIds) expect(sum(byJob.get(jobId)!)).toBe(Math.round(costs.get(jobId)!.total * 100) / 100)
    expect(byJob.get('j3')).toEqual([])
  })
})

describe('siteTeamLaborEvents', () => {
  it('one event per person per day, tagged with the job; a person with no days gives none', () => {
    const byJob = siteTeamLaborEvents(LABOR)
    const j1 = byJob.get('j1')!
    expect(j1).toHaveLength(3)
    expect(j1.every((e) => e.source === 'team_labor' && e.jobId === 'j1')).toBe(true)
    expect(j1.find((e) => e.who === 'Luis')).toMatchObject({ dateKey: '2026-03-02', amount: 240, hours: 8 })
    expect(sum(j1)).toBe(480)
    expect(byJob.has('j3')).toBe(false)
  })
})

describe('sitePaymentEvents', () => {
  it('dates a payment by the day paid, else the day booked; drops a zero; tags the job', () => {
    const byJob = sitePaymentEvents(PAYMENTS, toYmd)
    expect(byJob.get('j1')).toEqual([{ dateKey: '2026-03-10', amount: 5000, label: 'Payment — check', jobId: 'j1' }])
    expect(byJob.get('j2')).toEqual([{ dateKey: '2026-03-12', amount: 250, label: 'Payment — ACH', jobId: 'j2' }])
  })
})

describe('siteFuelTxIds', () => {
  const tags: CategoryTagRow[] = [
    { id: 'tag-fuel', name: 'Fuel & gas', icon: '⛽', color: 'amber', sort_order: 1, default_key: 'fuel_vehicle', show_as_cost_line: true, hide_from_picker: false },
    { id: 'tag-parts', name: 'Parts', icon: '🧱', color: 'gray', sort_order: 2, default_key: null, show_as_cost_line: false, hide_from_picker: false },
  ]
  const members = [
    { tag_id: 'tag-fuel', bank_category: 'Gas', label_id: null },
    { tag_id: 'tag-fuel', bank_category: null, label_id: 'label-fuel' },
    { tag_id: 'tag-parts', bank_category: 'Hardware', label_id: null },
  ]
  it('a charge is fuel by its accounting label first, else by the bank’s category', () => {
    const ids = siteFuelTxIds({ cardAlloc: ROWS.cardAlloc, tags, members, labelIdByTxId: new Map([['tx-lowes', 'label-fuel']]) })
    expect([...ids].sort()).toEqual(['tx-lowes', 'tx-shell'])
  })
  it('no fuel tag means no fuel stream', () => {
    expect(siteFuelTxIds({ cardAlloc: ROWS.cardAlloc, tags: [tags[1]!], members, labelIdByTxId: new Map() }).size).toBe(0)
  })
})

describe('foldSiteChargeEvents', () => {
  const day = (over: Partial<JobChargeEvent>): JobChargeEvent => ({ source: 'mercury_card', dateKey: '2026-03-02', amount: 10, label: 'Lowe’s', jobId: 'j1', ...over })

  it('one line per job and source on a day, the amounts summed, the job named, the day’s lines biggest first', () => {
    const folded = foldSiteChargeEvents(
      [day({ amount: 100 }), day({ amount: 50, label: 'Home Depot' }), day({ amount: 25, label: 'Ace' }), day({ source: 'tally_part', amount: 400, label: 'Elbow' }), day({ jobId: 'j2', amount: 5, label: 'Shell' })],
      label,
    )
    expect(folded.map((e) => [e.label, e.amount])).toEqual([
      ['JP612 · Elbow', 400],
      ['JP612 · 3 card charges', 175],
      ['JP583 · Shell', 5],
    ])
    expect(folded[1]).toMatchObject({ source: 'mercury_card', dateKey: '2026-03-02', jobId: 'j1' })
  })

  it('team labor names the people and sums the hours; three or more are counted', () => {
    const labor = (who: string, hours: number) => day({ source: 'team_labor', amount: hours * 30, label: `${who} — team labor (${hours}h)`, who, hours })
    const two = foldSiteChargeEvents([labor('Luis', 8), labor('Mateo', 8)], label)
    expect(two).toEqual([{ source: 'team_labor', dateKey: '2026-03-02', amount: 480, label: 'JP612 · team labor, Luis and Mateo, 16h', jobId: 'j1', hours: 16 }])
    const three = foldSiteChargeEvents([labor('Luis', 8), labor('Mateo', 8), labor('Tom', 4)], label)
    expect(three[0]!.label).toBe('JP612 · team labor, 3 people, 20h')
    expect(foldSiteChargeEvents([labor('Luis', 8)], label)[0]!.label).toBe('JP612 · Luis — team labor (8h)')
  })

  it('the chip’s cost and the chart’s end for one job agree to the cent: the fold keeps the exact sum and the kernel rounds once (v2.6718)', () => {
    // Two half-cent charges: rounded one by one they lose a cent (1.00 + 1.00); summed and rounded once they keep it (2.01).
    const jobs: SiteTimelineJob[] = [{ jobId: 'j1', label: 'JP612', charges: [day({ amount: 1.005 }), day({ amount: 1.005 })], payments: [], values: [], revenue: null, fallbackPercent: null, overheadDays: [] }]
    const model = buildSiteTimeline({ jobs, selected: new Set() })
    expect(model.chips[0]!.endExpense).toBe(2.01)
    expect(model.data.endExpense).toBe(2.01)
    expect(model.data.endExpense).toBe(buildJobChargesTimelineChartData(jobs[0]!.charges, [], null).endExpense)
    const folded = foldSiteChargeEvents(jobs[0]!.charges, label)
    expect(folded[0]!.amount).toBeCloseTo(2.01, 10)
  })

  it('keeps the undated bucket apart and in front', () => {
    const folded = foldSiteChargeEvents([day({ amount: 1 }), day({ dateKey: null, amount: 2 })], label)
    expect(folded.map((e) => e.dateKey)).toEqual([null, '2026-03-02'])
  })
})

function jobsOf(): SiteTimelineJob[] {
  return assembleSiteTimelineJobs({ jobIds: ['j1', 'j2', 'j3', 'j4'], order: ['j2', 'j1'], jobLabel: label, costs: ROWS, labor: LABOR, payments: PAYMENTS, fuelTxIds: new Set(['tx-shell']), toYmd })
}

describe('assembleSiteTimelineJobs', () => {
  it('the Money look’s order first, the rest after, each job with the clock’s events before the cost rows’', () => {
    const jobs = jobsOf()
    expect(jobs.map((j) => j.jobId)).toEqual(['j2', 'j1', 'j3', 'j4'])
    const j1 = jobs[1]!
    expect(j1.label).toBe('JP612')
    expect(j1.charges.filter((e) => e.source === 'team_labor')).toHaveLength(3)
    // The cost rows: 1,200 supply, 372.50 on the card after the refund, 60 fuel, 25 tally, 150 other, 300 sub labor; the clock adds 480.
    expect(sum(j1.charges)).toBe(2107.5 + 480)
    expect(j1.payments).toHaveLength(1)
    expect(j1.values).toEqual([])
    expect(j1.overheadDays).toEqual([])
  })
  it('with no clock, the jobs carry the cost rows alone', () => {
    const jobs = assembleSiteTimelineJobs({ jobIds: ['j1'], order: [], jobLabel: label, costs: ROWS, labor: null, payments: [], fuelTxIds: new Set(), toYmd })
    expect(jobs[0]!.charges.some((e) => e.source === 'team_labor')).toBe(false)
    expect(jobs[0]!.charges.some((e) => e.source === 'fuel')).toBe(false)
  })
})

describe('buildSiteTimeline', () => {
  it('parity: the site’s end expense and end payments are the sum of the jobs’ own ends', () => {
    const jobs = jobsOf()
    const model = buildSiteTimeline({ jobs, selected: new Set() })
    const own = jobs.filter(siteJobHasDatedEvent).map((j) => buildJobChargesTimelineChartData(j.charges, [], null, j.payments))
    expect(model.data.endExpense).toBe(Math.round(own.reduce((s, d) => s + d.endExpense, 0) * 100) / 100)
    expect(model.data.endPayments).toBe(Math.round(own.reduce((s, d) => s + d.endPayments, 0) * 100) / 100)
    expect(model.data.endProfit).toBe(Math.round((model.data.endPayments - model.data.endExpense) * 100) / 100)
    // And the Costs column's figures plus the clock: the red line ends on them.
    const costs = jobCostsFromRows(ROWS)
    const column = ['j1', 'j2'].reduce((s, id) => s + costs.get(id)!.total, 0) + LABOR.byJobId.get('j1')!.costUsd
    expect(model.data.endExpense).toBe(Math.round(column * 100) / 100)
  })

  it('the buckets run in date order with the undated one first, and every event line names its job', () => {
    const model = buildSiteTimeline({ jobs: jobsOf(), selected: new Set() })
    const keys = model.data.chartRows.map((r) => r.dateKey)
    expect(keys[0]).toBe('unknown')
    expect([...keys.slice(1)].sort()).toEqual(keys.slice(1))
    for (const row of model.data.chartRows) for (const e of row.chargeEvents) expect(e.label.startsWith('JP')).toBe(true)
    const march2 = model.data.chartRows.find((r) => r.dateKey === '2026-03-02')!
    // Biggest first on the day: the card's 372.50, the clock's 360, the fuel's 60.
    expect(march2.chargeEvents.map((e) => e.label)).toEqual(['JP612 · 2 card charges', 'JP612 · team labor, Luis and Mateo, 12h', 'JP612 · Shell'])
    expect(march2.chargeSources).toEqual(['mercury_card', 'team_labor', 'fuel'])
  })

  it('the chips are the jobs with a dated event in the order given; the rest are counted and left out', () => {
    const model = buildSiteTimeline({ jobs: jobsOf(), selected: new Set() })
    expect(model.chips.map((c) => c.jobId)).toEqual(['j2', 'j1'])
    expect(model.chips[1]).toEqual({ jobId: 'j1', label: 'JP612', endExpense: 2587.5 })
    expect(model.leftOut).toBe(2)
    expect([...model.drawn].sort()).toEqual(['j1', 'j2'])
    expect(model.iconsThinned).toBe(false)
  })

  it('a selection narrows the chart to those jobs, and their chart is each job’s own; a selection of nothing dated draws every job', () => {
    const jobs = jobsOf()
    const one = buildSiteTimeline({ jobs, selected: new Set(['j1']) })
    expect([...one.drawn]).toEqual(['j1'])
    expect(one.data.endExpense).toBe(2587.5)
    expect(one.data.endPayments).toBe(5000)
    expect(one.chips).toHaveLength(2)
    const none = buildSiteTimeline({ jobs, selected: new Set(['j4']) })
    expect([...none.drawn].sort()).toEqual(['j1', 'j2'])
  })

  it('payments carry the job’s label', () => {
    const model = buildSiteTimeline({ jobs: jobsOf(), selected: new Set() })
    const paid = model.data.chartRows.find((r) => r.dateKey === '2026-03-10')!
    expect(paid.paymentEvents[0]!.label).toBe('JP612 · Payment — check')
    expect(paid.hasPaymentMarker).toBe(true)
  })
})

describe('the overhead band (v2.6498)', () => {
  const lines = (ymds: Array<[string, number]>) => ymds.map(([ymd, shareUsd]) => ({ ymd, jobHours: 8, fieldHours: 16, poolUsd: shareUsd * 2, shareUsd, activityUsd: shareUsd, carryUsd: 0 }))

  it('overheadDaysFromLines keeps the day, the share and its split; the since words name the day the pool began', () => {
    expect(overheadDaysFromLines(lines([['2026-03-02', 120.5]]))).toEqual([{ dateKey: '2026-03-02', amount: 120.5, activityUsd: 120.5, carryUsd: 0 }])
    expect(overheadDaysFromLines(undefined)).toEqual([])
    expect(overheadSinceWords('2026-02-19')).toBe('Feb 19, 2026')
    expect(overheadSinceWords('whenever')).toBe('whenever')
  })

  it('each job carries its own lines, and the site’s band is the sum of the jobs’ days, two jobs on one day summed', () => {
    const overhead = new Map([
      ['j1', { lines: lines([['2026-03-02', 100], ['2026-03-09', 50]]) }],
      ['j2', { lines: lines([['2026-03-09', 25]]) }],
    ])
    const jobs = assembleSiteTimelineJobs({ jobIds: ['j1', 'j2', 'j3', 'j4'], order: ['j2', 'j1'], jobLabel: label, costs: ROWS, labor: LABOR, payments: PAYMENTS, fuelTxIds: new Set(), toYmd, overhead })
    expect(jobs.find((j) => j.jobId === 'j1')!.overheadDays).toHaveLength(2)
    expect(jobs.find((j) => j.jobId === 'j3')!.overheadDays).toEqual([])
    const model = buildSiteTimeline({ jobs, selected: new Set() })
    expect(model.data.overheadSeriesAvailable).toBe(true)
    expect(model.data.endOverhead).toBe(175)
    expect(model.data.endTrueCost).toBe(Math.round((model.data.endExpense + 175) * 100) / 100)
    const march9 = model.data.chartRows.find((r) => r.dateKey === '2026-03-09')!
    expect(march9.overheadToDate).toBe(175)
    expect(march9.overheadBand).toEqual([march9.expense, march9.trueCost])
    // The parity holds with the band: the site's overhead is the sum of the jobs' own.
    const own = jobs.filter(siteJobHasDatedEvent).map((j) => buildJobChargesTimelineChartData(j.charges, [], null, j.payments, null, j.overheadDays).endOverhead)
    expect(model.data.endOverhead).toBe(own.reduce((s, n) => s + n, 0))
    // A selection narrows the band to the job's own days.
    expect(buildSiteTimeline({ jobs, selected: new Set(['j2']) }).data.endOverhead).toBe(25)
    // Without the ledger, no band.
    const without = assembleSiteTimelineJobs({ jobIds: ['j1'], order: [], jobLabel: label, costs: ROWS, labor: LABOR, payments: [], fuelTxIds: new Set(), toYmd, overhead: null })
    expect(buildSiteTimeline({ jobs: without, selected: new Set() }).data.overheadSeriesAvailable).toBe(false)
  })
})

describe('the value line (v2.6499)', () => {
  const reports = [
    { id: 'r1', job_ledger_id: 'j1', created_at: '2026-03-03T12:00:00Z', field_values: { 'How complete is the job?': '40' }, users: { name: 'Dana' } },
    { id: 'r2', job_ledger_id: 'j1', created_at: '2026-03-20T12:00:00Z', field_values: { 'How complete is the job?': '80' }, users: [{ name: 'Luis' }] },
    { id: 'r3', job_ledger_id: 'j2', created_at: '2026-03-10T12:00:00Z', field_values: {}, users: null },
    { id: 'r4', job_ledger_id: null, created_at: '2026-03-10T12:00:00Z', field_values: { 'How complete is the job?': '10' }, users: null },
  ]
  const pctEvents = [{ id: 'e1', job_id: 'j1', pct: 50, changed_at: '2026-03-20T15:00:00Z', users: { name: 'Robert' } }]

  it('siteValueEventsFromRows builds each job’s reports and hand-set percents, tagged with the job', () => {
    const byJob = siteValueEventsFromRows(reports, pctEvents, toYmd)
    expect(byJob.get('j1')).toEqual([
      { dateKey: '2026-03-03', percent: 40, label: 'Report by Dana', jobId: 'j1' },
      { dateKey: '2026-03-20', percent: 80, label: 'Report by Luis', jobId: 'j1' },
      { dateKey: '2026-03-20', percent: 50, label: 'Set on the job by Robert', kind: 'manual', jobId: 'j1' },
    ])
    expect(byJob.get('j2')).toEqual([{ dateKey: '2026-03-10', percent: null, label: 'Report by someone', jobId: 'j2' }])
    expect(byJob.size).toBe(2)
  })

  it('the site’s value is every job’s newest percent times its price, summed; a hand-set beats a report on its day; a job with no dated percent adds its current one at the end', () => {
    // A later report with no percent on j2 makes the last bucket, so the hand-set day and the fallback day are two days.
    const values = siteValueEventsFromRows([...reports, { id: 'r5', job_ledger_id: 'j2', created_at: '2026-03-28T12:00:00Z', field_values: {}, users: null }], pctEvents, toYmd)
    // The end-point fallback is the Scoreboard's percent: j4 is paid, so 100 whatever its bills say; j2 carries its own 25.
    const jobRows = [
      { id: 'j1', status: 'working', revenue: 10000, pct_complete: null },
      { id: 'j2', status: 'working', revenue: 4000, pct_complete: 25 },
      { id: 'j3', status: 'working', revenue: null, pct_complete: 50 },
      { id: 'j4', status: 'paid', revenue: 2000, pct_complete: null },
    ]
    const invoices: Array<{ job_id: string; status: string; amount: number }> = []
    const jobs = assembleSiteTimelineJobs({ jobIds: ['j1', 'j2', 'j3', 'j4'], order: [], jobLabel: label, costs: ROWS, labor: LABOR, payments: PAYMENTS, fuelTxIds: new Set(), toYmd, values, jobRows, invoices })
    expect(jobs.find((j) => j.jobId === 'j1')).toMatchObject({ revenue: 10000, fallbackPercent: null })
    expect(jobs.find((j) => j.jobId === 'j2')).toMatchObject({ revenue: 4000, fallbackPercent: 25 })
    expect(jobs.find((j) => j.jobId === 'j4')).toMatchObject({ revenue: 2000, fallbackPercent: 100 })
    const model = buildSiteTimeline({ jobs, selected: new Set() })
    expect(model.data.valueSeriesAvailable).toBe(true)
    expect(model.data.valueFromFallbackPercent).toBe(false)
    const at = (k: string) => model.data.chartRows.find((r) => r.dateKey === k)!
    expect(at('2026-03-02').value).toBeNull()
    expect(at('2026-03-03').value).toBe(4000)
    expect(at('2026-03-03').hasReportMarker).toBe(true)
    expect(at('2026-03-03').valueEvents[0]!.label).toBe('JP612 · Report by Dana')
    expect(at('2026-03-10').value).toBe(4000)
    // On 03-20 the hand-set 50% beats the report's 80%.
    expect(at('2026-03-20').value).toBe(5000)
    // The last bucket adds the jobs on the chart with no dated percent: j2 at its 25% of 4,000; j3 has no price, and j4, with no dated event at all, is not on the chart.
    const last = model.data.chartRows[model.data.chartRows.length - 1]!
    expect(last.dateKey).toBe('2026-03-28')
    expect(last.value).toBe(5000 + 1000)
    expect(model.valueFallbackJobs).toBe(1)
    // j3 (no price, no event) and j4 (no dated event) are left out.
    expect(model.leftOut).toBe(2)
    expect(siteTimelineValueWords(model.valueFallbackJobs)).toBe('1 job with no dated percent adds its current percent at the end of the value line.')
    expect(siteTimelineValueWords(2)).toBe('2 jobs with no dated percent add their current percent at the end of the value line.')
    expect(siteTimelineValueWords(0)).toBeNull()
    // Narrowed to a job with no percent and no price: no value line.
    const none = buildSiteTimeline({ jobs: jobs.filter((j) => j.jobId === 'j2').map((j) => ({ ...j, revenue: null })), selected: new Set() })
    expect(none.data.valueSeriesAvailable).toBe(false)
  })

  it('the ends in words and the print page', () => {
    const jobs = jobsOf()
    const model = buildSiteTimeline({ jobs, selected: new Set() })
    const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    expect(siteTimelineEndWords(model.data, money)).toEqual(['Cost to date $3,042.50', 'Cash position +$2,207.50'])
    const html = siteTimelinePrintHtml({ siteName: 'Harlow <Ranch>', customerName: 'Ridgeway Builders', scopeLine: 'All 2 jobs on one chart.', endWords: ['Cost to date $3,067.50'], keyLines: ['Red = cost to date'], svg: '<svg viewBox="0 0 10 10"><text stroke="var(--surface)" fill="var(--text-700)">x</text></svg>', printedAt: 'Nov 4, 2026, 10:00 AM', printedBy: 'Dana' })
    expect(html.startsWith('<!doctype html>')).toBe(true)
    expect(html).toContain('<h1>Harlow &lt;Ranch&gt; · cost timeline</h1>')
    expect(html).toContain('Ridgeway Builders · All 2 jobs on one chart.')
    expect(html).toContain('stroke="#ffffff" fill="#374151"')
    expect(html).not.toContain('var(--')
    expect(html).toContain('Printed Nov 4, 2026, 10:00 AM by Dana')
    expect(html).toContain('size: landscape')
  })
})

describe('thinChargeIcons', () => {
  const rowsOf = (steps: number[]) => {
    const events = steps.map((amount, i) => ({ source: 'mercury_card' as const, dateKey: `2026-01-${String(i + 1).padStart(2, '0')}`, amount, label: 'x' }))
    return buildJobChargesTimelineChartData(events, [], null).chartRows
  }
  it('keeps the icons on the biggest days and takes them off the rest; fewer days than the cap keep all', () => {
    const rows = rowsOf([5, 100, 1, 50, 2])
    expect(thinChargeIcons(rows, 2)).toBe(true)
    expect(rows.map((r) => r.chargeSources.length)).toEqual([0, 1, 0, 1, 0])
    expect(rows.every((r) => r.chargeEvents.length === 1)).toBe(true)
    const few = rowsOf([5, 100])
    expect(thinChargeIcons(few, 2)).toBe(false)
    expect(few.every((r) => r.chargeSources.length === 1)).toBe(true)
  })
})

describe('the words', () => {
  it('tagJob, the left-out line and the scope', () => {
    const untagged: JobPaymentEvent[] = [{ dateKey: null, amount: 1, label: 'x' }]
    expect(tagJob('j9', untagged)).toEqual([{ dateKey: null, amount: 1, label: 'x', jobId: 'j9' }])
    expect(siteTimelineLeftOutWords(0)).toBeNull()
    expect(siteTimelineLeftOutWords(1)).toBe('1 job has no dated charge or payment. It is listed under the chart.')
    expect(siteTimelineLeftOutWords(3)).toBe('3 jobs have no dated charge or payment. They are listed under the chart.')
    const chips = [{ jobId: 'a', label: 'A', endExpense: 0 }, { jobId: 'b', label: 'B', endExpense: 0 }]
    expect(siteTimelineScopeWords({ chips, drawn: new Set(['a', 'b']) })).toBe('all 2 jobs')
    expect(siteTimelineScopeWords({ chips, drawn: new Set(['a']) })).toBe('1 of 2 jobs')
  })
})

describe('the ledger strip (v2.6711)', () => {
  /** A job whose only charges carry no date: a sub sheet and two card lines. Its cost is real and nowhere on the chart. */
  const undatedOnly: SiteTimelineJob = {
    jobId: 'j5',
    label: 'JP617',
    charges: [
      { source: 'sub_labor', dateKey: null, amount: 3480, label: 'Reyes Excavating — sub labor', jobId: 'j5', who: 'Reyes Excavating' },
      { source: 'mercury_card', dateKey: null, amount: 100.1, label: 'Lowe’s', jobId: 'j5' },
      { source: 'mercury_card', dateKey: null, amount: 0.2, label: 'Lowe’s', jobId: 'j5' },
    ],
    payments: [],
    values: [],
    revenue: null,
    fallbackPercent: null,
    overheadDays: [],
  }
  const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  it('lists the left-out jobs in the order given with their cost and the undated charges by source; a job with no event is $0', () => {
    const jobs = [...jobsOf(), undatedOnly]
    const left = siteTimelineLeftOutJobs(jobs)
    expect(left.map((j) => j.jobId)).toEqual(['j3', 'j4', 'j5'])
    expect(left[0]).toEqual({ jobId: 'j3', label: 'JP953', endExpense: 0, undated: [] })
    expect(left[2]).toEqual({ jobId: 'j5', label: 'JP617', endExpense: 3580.3, undated: [{ source: 'sub_labor', count: 1 }, { source: 'mercury_card', count: 2 }] })
    expect(buildSiteTimeline({ jobs, selected: new Set() }).leftOutJobs).toEqual(left)
  })

  it('the reason names the undated charges by source, singular and plural, or says nothing was charged', () => {
    expect(siteTimelineLeftOutReason({ undated: [] })).toBe('nothing charged yet')
    expect(siteTimelineLeftOutReason({ undated: [{ source: 'sub_labor', count: 1 }] })).toBe('1 sub labor sheet with no date · date it and the job joins the chart')
    expect(siteTimelineLeftOutReason({ undated: [{ source: 'sub_labor', count: 1 }, { source: 'mercury_card', count: 2 }] })).toBe('1 sub labor sheet and 2 card charges with no date · date them and the job joins the chart')
    expect(siteTimelineLeftOutReason({ undated: [{ source: 'supply_house', count: 2 }, { source: 'tally_part', count: 1 }, { source: 'billed_material', count: 3 }] })).toBe(
      '2 supply house invoices, 1 tally part and 3 other job charges with no date · date them and the job joins the chart',
    )
    expect(siteTimelineLeftOutReason({ undated: [{ source: 'fuel', count: 1 }, { source: 'team_labor', count: 2 }] })).toBe('1 fuel charge and 2 team labor days with no date · date them and the job joins the chart')
  })

  it('the sum: the chart’s end plus the left-out cost is the jobs’ Costs column total plus the clock, the Scoreboard’s cost before overhead', () => {
    const jobs = [...jobsOf(), undatedOnly]
    const model = buildSiteTimeline({ jobs, selected: new Set() })
    const sumLine = siteTimelineStripSum(model)
    expect(sumLine.chartEnd).toBe(model.data.endExpense)
    expect(sumLine.offChart).toBe(3580.3)
    const costs = jobCostsFromRows(ROWS)
    const column = ['j1', 'j2'].reduce((s, id) => s + costs.get(id)!.total, 0) + LABOR.byJobId.get('j1')!.costUsd + sum(undatedOnly.charges)
    expect(sumLine.together).toBe(Math.round(column * 100) / 100)
  })

  it('a chip narrowing the chart leaves the strip on the whole site: the sum still reads the site’s end', () => {
    const jobs = [...jobsOf(), undatedOnly]
    const whole = buildSiteTimeline({ jobs, selected: new Set() })
    const narrowed = buildSiteTimeline({ jobs, selected: new Set(['j2']) })
    expect(narrowed.data.endExpense).toBeLessThan(whole.data.endExpense)
    expect(narrowed.siteEndExpense).toBe(whole.data.endExpense)
    expect(siteTimelineStripSum(narrowed)).toEqual(siteTimelineStripSum(whole))
    expect(narrowed.leftOutJobs).toEqual(whole.leftOutJobs)
  })

  it('the print’s strip lines: the head, a line per job, the sum line; none when every job is dated', () => {
    const jobs = [...jobsOf(), undatedOnly]
    const model = buildSiteTimeline({ jobs, selected: new Set() })
    const lines = siteTimelineStripLines(model, money)
    expect(lines).toHaveLength(5)
    expect(lines[0]).toBe('Not on the chart · 3 jobs with no dated charge or payment')
    expect(lines[1]).toBe('JP953 · nothing charged yet · $0.00')
    expect(lines[3]).toBe('JP617 · 1 sub labor sheet and 2 card charges with no date · date them and the job joins the chart · $3,580.30')
    expect(lines[4]).toBe(`Chart ends at ${money(model.data.endExpense)} · Not on the chart $3,580.30 · Together ${money(model.data.endExpense + 3580.3)}, the Scoreboard’s cost before overhead`)
    expect(siteTimelineStripLines(buildSiteTimeline({ jobs: jobs.filter(siteJobHasDatedEvent), selected: new Set() }), money)).toEqual([])
    const html = siteTimelinePrintHtml({ siteName: 'Harlow Ranch', customerName: null, scopeLine: 'All 2 jobs on one chart.', endWords: [], keyLines: ['Red = cost to date'], svg: '<svg/>', printedAt: 'Nov 8, 2026, 10:00 AM', printedBy: null, stripLines: lines })
    expect(html).toContain('<div class="strip"><p class="head">Not on the chart · 3 jobs with no dated charge or payment</p><p>JP953 · nothing charged yet · $0.00</p>')
    expect(html.indexOf('class="key"')).toBeLessThan(html.indexOf('class="strip"'))
    expect(html.indexOf('class="strip"')).toBeLessThan(html.indexOf('class="stamp"'))
    expect(siteTimelinePrintHtml({ siteName: 'Harlow Ranch', customerName: null, scopeLine: '', endWords: [], keyLines: [], svg: '<svg/>', printedAt: '', printedBy: null })).not.toContain('class="strip"')
  })
})

describe('tagJob keeps the Job Summary chart whole', () => {
  it('an event without a job id draws as before', () => {
    const events: JobChargeEvent[] = [{ source: 'supply_house', dateKey: '2026-03-01', amount: 10, label: 'Ferguson — invoice 1' }]
    const data = buildJobChargesTimelineChartData(events, [], null)
    expect(data.chartRows[0]!.chargeEvents[0]!.jobId).toBeUndefined()
    expect(data.endExpense).toBe(10)
  })
})
