import { describe, expect, it } from 'vitest'
import { buildSpendingRollup, cardChargeExclusionsFromRows, spendingWhoForCharge, type SpendingDirectory, type SpendingRow } from './spendingRollup'
import type { CardChargeWindowRow } from '../banking/cardChargesWindow'
import { buildCategoryTagLookups, type CategoryTagMemberRow, type CategoryTagRow } from '../banking/categoryTags'
import { costLineTags } from '../mercuryTagSplit'
import { jobCardChargesCountedFromLines, type JobMercuryAllocLine } from '../../../supabase/functions/_shared/jobMaterialsCostLines'
import { jobCardCostLines } from '../jobs/jobCardCostLines'
import type { CardChargeExclusions } from '../jobs/cardChargeAllocationFilter'

// ── The org: two tags, the fuel family by bank category and by label ────────────────────────────
const FUEL: CategoryTagRow = { id: 'tag-fuel', name: 'Fuel & gas', icon: '⛽', color: 'amber', sort_order: 0, default_key: 'fuel_vehicle', show_as_cost_line: true, hide_from_picker: false }
const RETAIL: CategoryTagRow = { id: 'tag-retail', name: 'Retail & supply', icon: '🛒', color: 'blue', sort_order: 1, default_key: 'retail_supply', show_as_cost_line: false, hide_from_picker: false }
const MEMBERS: CategoryTagMemberRow[] = [
  { tag_id: FUEL.id, bank_category: 'FuelAndGas', label_id: null },
  { tag_id: FUEL.id, bank_category: null, label_id: 'label-fuel' },
  { tag_id: RETAIL.id, bank_category: 'Retail', label_id: null },
  { tag_id: RETAIL.id, bank_category: null, label_id: 'label-supplies' },
]
const LOOKUPS = buildCategoryTagLookups([FUEL, RETAIL], MEMBERS)

const OFFICE = 'job-office'
const FLOOR = '2026-03-31'

const DIRECTORY: SpendingDirectory = {
  userNameById: new Map([
    ['u-malachi', 'Malachi R.'],
    ['u-dana', 'Dana P.'],
    ['u-jorge', 'Jorge L.'],
  ]),
  personById: new Map([
    ['p-dana', { name: 'Dana Parker', accountUserId: 'u-dana' }],
    ['p-pat', { name: 'Pat (no login)', accountUserId: null }],
  ]),
}

function split(jobId: string, amount: number) {
  return { jobId, amount, hcpNumber: jobId.toUpperCase(), clickNumber: null, jobName: `Job ${jobId}`, serviceTypeId: null }
}

let seq = 0
function charge(over: Partial<CardChargeWindowRow> & { amount: number }): CardChargeWindowRow {
  seq += 1
  return {
    id: `tx-${seq}`,
    postedAt: '2026-09-10T15:00:00Z',
    counterpartyName: 'Store',
    kind: 'debitCardTransaction',
    status: 'sent',
    bankCategory: null,
    debitCardId: null,
    cardNickname: null,
    cardRole: null,
    holderUserId: null,
    holderName: null,
    attributedUserId: null,
    attributedPersonId: null,
    labelId: null,
    labelDefaultKey: null,
    payrollMarked: false,
    splits: [],
    invoiceLinks: [],
    sortedAt: null,
    sortedByName: null,
    viewerCanSort: true,
    ...over,
  }
}

const INVOICE = { invoiceId: 'inv-1', invoiceNumber: '4471', supplyHouseName: 'Ferguson', amount: 80 }

// ── The fixture: every rule the job screens apply, plus who each charge belongs to ──────────────
const C = {
  supplies: charge({ amount: -100, attributedUserId: 'u-malachi', bankCategory: 'Retail', splits: [split('j1', -100)] }),
  fuelByCategory: charge({ amount: -40, attributedUserId: 'u-malachi', bankCategory: 'FuelAndGas', splits: [split('j1', -40)] }),
  refund: charge({ amount: 25, attributedUserId: 'u-malachi', bankCategory: 'Retail', splits: [split('j1', 25)] }),
  // A fuel bank category with a supplies label: the label (a person's decision) wins, so not fuel.
  labelBeatsCategory: charge({ amount: -60, attributedUserId: 'u-dana', bankCategory: 'FuelAndGas', labelId: 'label-supplies', labelDefaultKey: 'supplies', splits: [split('j1', -30), split('j2', -30)] }),
  fuelByLabel: charge({ amount: -18, attributedUserId: 'u-dana', bankCategory: 'Retail', labelId: 'label-fuel', labelDefaultKey: 'fuel_gas', splits: [split('j2', -18)] }),
  // Split onto J2 and also on a supply-house invoice: the job counts it under the invoice.
  invoiceLinked: charge({ amount: -80, attributedUserId: 'u-dana', bankCategory: 'Retail', invoiceLinks: [INVOICE], splits: [split('j2', -80)] }),
  internalTransfer: charge({ amount: -500, attributedUserId: 'u-malachi', labelId: 'label-transfer', labelDefaultKey: 'internal_transfers', splits: [split('j2', -500)] }),
  // Jorge's card, nobody attributed it: his by the card.
  byCard: charge({ amount: -35, holderUserId: 'u-jorge', holderName: 'Jorge L.', debitCardId: 'card-j', bankCategory: 'FuelAndGas' }),
  byCardOutsideCircle: charge({ amount: -12, holderUserId: 'u-jorge', holderName: 'Jorge L.', debitCardId: 'card-j', bankCategory: 'Retail', viewerCanSort: false }),
  companyCard: charge({ amount: -200, cardRole: 'company', debitCardId: 'card-co', cardNickname: 'Office Amex', bankCategory: 'Software' }),
  untied: charge({ amount: -15, bankCategory: 'FuelAndGas' }),
  // Dana's person record has a login: her charge is Dana's.
  personWithLogin: charge({ amount: -22, attributedPersonId: 'p-dana', bankCategory: 'Retail', splits: [split(OFFICE, -22)] }),
  personNoLogin: charge({ amount: -50, attributedPersonId: 'p-pat', bankCategory: 'Retail', payrollMarked: true }),
  beforeFloor: charge({ amount: -70, attributedUserId: 'u-malachi', bankCategory: 'Retail', postedAt: '2026-03-15T15:00:00Z' }),
  // An old split that does not add up to the charge (the writes refuse one today).
  oldShortSplit: charge({ amount: -10, attributedUserId: 'u-malachi', bankCategory: 'Retail', splits: [split('j1', -6)] }),
}
const CHARGES = Object.values(C)

const rollup = buildSpendingRollup({ charges: CHARGES, lookups: LOOKUPS, fuelTagId: FUEL.id, officeJobId: OFFICE, sortingFloorYmd: FLOOR, directory: DIRECTORY })
const rowOf = (key: string): SpendingRow => {
  const r = rollup.rows.find((x) => x.who.key === key)
  if (!r) throw new Error(`no row ${key}`)
  return r
}

// The Job window's own inputs for one job, built from the same charges the way its snapshot
// loads them: one card line per split, and the rule's two lookups read independently.
const JOB_WINDOW_EXCLUSIONS: CardChargeExclusions = {
  bucketByTxId: new Map([
    [C.labelBeatsCategory.id, 'other'],
    [C.fuelByLabel.id, 'fuel_gas'],
    [C.internalTransfer.id, 'internal_transfer'],
  ]),
  invoiceLinkedTxIds: new Set([C.invoiceLinked.id]),
}
function jobWindowLines(jobId: string): JobMercuryAllocLine[] {
  return CHARGES.flatMap((c) =>
    c.splits
      .filter((s) => s.jobId === jobId)
      .map((s, i) => ({ id: `${c.id}:${i}`, mercuryTransactionId: c.id, allocationAmount: s.amount, note: null, postedAt: c.postedAt, counterpartyName: c.counterpartyName, debitCardId: c.debitCardId })),
  )
}
function jobWindowFuel(jobId: string): number {
  const lines = jobWindowLines(jobId)
  const counted = jobCardChargesCountedFromLines(lines, JOB_WINDOW_EXCLUSIONS)
  const { costLines } = jobCardCostLines({
    lines,
    exclusions: JOB_WINDOW_EXCLUSIONS,
    labelIdByTxId: new Map(CHARGES.filter((c) => c.labelId).map((c) => [c.id, c.labelId as string])),
    categoryByTxId: new Map(CHARGES.map((c) => [c.id, c.bankCategory])),
    lookups: LOOKUPS,
    tags: costLineTags(LOOKUPS),
    countedCardUsd: counted,
  })
  return costLines.find((l) => l.tagId === FUEL.id)?.usd ?? 0
}

describe('buildSpendingRollup — the same numbers as the Job window', () => {
  it.each(['j1', 'j2'])('job %s: the card spend summed over every row is the Job window card total', (jobId) => {
    const overRows = rollup.rows.reduce((s, r) => s + (r.jobs.find((j) => j.jobId === jobId)?.spend ?? 0), 0)
    const jobWindow = jobCardChargesCountedFromLines(jobWindowLines(jobId), JOB_WINDOW_EXCLUSIONS)
    expect(overRows).toBeCloseTo(jobWindow, 2)
    expect(rollup.byJob.get(jobId)?.spend).toBeCloseTo(jobWindow, 2)
  })

  it.each(['j1', 'j2'])('job %s: the fuel summed over every row is the Job window ⛽ line', (jobId) => {
    const overRows = rollup.rows.reduce((s, r) => s + (r.jobs.find((j) => j.jobId === jobId)?.fuel ?? 0), 0)
    expect(overRows).toBeCloseTo(jobWindowFuel(jobId), 2)
    expect(rollup.byJob.get(jobId)?.fuel).toBeCloseTo(jobWindowFuel(jobId), 2)
  })

  it('the figures behind those totals: refunds net, Internal Transfers out, the invoice-linked charge under the invoice', () => {
    // J1: 100 + 40 − 25 refund + 30 (half of Dana's) + 6 (the old short split) = 151, fuel 40.
    expect(rollup.byJob.get('j1')).toEqual({ spend: 151, fuel: 40 })
    // J2: 30 (Dana's other half) + 18 fuel by label; the invoice-linked $80 and the $500 transfer are not job card charges.
    expect(rollup.byJob.get('j2')).toEqual({ spend: 48, fuel: 18 })
  })

  it('the one known edge: when a job’s refunds outweigh its other card charges, the job screens floor the card line at $0 and Spending keeps the net', () => {
    const onInvoice = charge({ amount: -100, attributedUserId: 'u-dana', invoiceLinks: [INVOICE], splits: [split('j3', -100)] })
    const refund = charge({ amount: 150, attributedUserId: 'u-dana', splits: [split('j3', 150)] })
    const r = buildSpendingRollup({ charges: [onInvoice, refund], lookups: LOOKUPS, fuelTagId: FUEL.id, officeJobId: OFFICE, sortingFloorYmd: FLOOR, directory: DIRECTORY })
    const lines: JobMercuryAllocLine[] = [onInvoice, refund].map((c) => ({
      id: c.id,
      mercuryTransactionId: c.id,
      allocationAmount: c.splits[0]!.amount,
      note: null,
      postedAt: c.postedAt,
      counterpartyName: null,
      debitCardId: null,
    }))
    expect(jobCardChargesCountedFromLines(lines, cardChargeExclusionsFromRows([onInvoice, refund]))).toBe(0)
    expect(r.byJob.get('j3')?.spend).toBe(-150)
  })

  it('builds the rule’s lookups from the window rows the way the Job window loads them', () => {
    const ex = cardChargeExclusionsFromRows(CHARGES)
    expect(ex.bucketByTxId.get(C.internalTransfer.id)).toBe('internal_transfer')
    expect(ex.bucketByTxId.get(C.fuelByLabel.id)).toBe(JOB_WINDOW_EXCLUSIONS.bucketByTxId.get(C.fuelByLabel.id))
    expect(ex.bucketByTxId.has(C.supplies.id)).toBe(false)
    expect([...ex.invoiceLinkedTxIds]).toEqual([...JOB_WINDOW_EXCLUSIONS.invoiceLinkedTxIds])
  })
})

describe('buildSpendingRollup — who a charge belongs to', () => {
  it('the attribution first; a person record with a login is that login', () => {
    expect(spendingWhoForCharge(C.supplies, DIRECTORY).who.key).toBe('u:u-malachi')
    expect(spendingWhoForCharge(C.personWithLogin, DIRECTORY).who).toMatchObject({ key: 'u:u-dana', name: 'Dana P.' })
    expect(spendingWhoForCharge(C.personNoLogin, DIRECTORY).who).toMatchObject({ key: 'p:p-pat', name: 'Pat (no login)', personId: 'p-pat' })
  })

  it('no attribution: a company card goes to Company cards, else the holder by card, else Not tied to anyone', () => {
    expect(spendingWhoForCharge(C.companyCard, DIRECTORY)).toEqual({ who: expect.objectContaining({ kind: 'company', name: 'Company cards' }), byCard: false })
    expect(spendingWhoForCharge(C.byCard, DIRECTORY)).toEqual({ who: expect.objectContaining({ key: 'u:u-jorge', name: 'Jorge L.' }), byCard: true })
    expect(spendingWhoForCharge(C.untied, DIRECTORY).who.kind).toBe('untied')
  })

  it('a company card charge attributed to someone is theirs', () => {
    const c = charge({ amount: -9, cardRole: 'company', attributedUserId: 'u-dana' })
    expect(spendingWhoForCharge(c, DIRECTORY).who.key).toBe('u:u-dana')
  })

  it('a name the roster does not have falls back to the holder name, then a plain phrase', () => {
    const gone = charge({ amount: -5, attributedUserId: 'u-gone', holderUserId: 'u-gone', holderName: 'Old Hand' })
    expect(spendingWhoForCharge(gone, DIRECTORY).who.name).toBe('Old Hand')
    const unknown = charge({ amount: -5, attributedUserId: 'u-gone' })
    expect(spendingWhoForCharge(unknown, DIRECTORY).who.name).toBe('Someone not on the roster')
  })

  it('people first by card spend, then Company cards, then Not tied to anyone', () => {
    expect(rollup.rows.map((r) => r.who.key)).toEqual(['u:u-malachi', 'u:u-dana', 'p:p-pat', 'u:u-jorge', 'company', 'untied'])
  })
})

describe('buildSpendingRollup — the columns', () => {
  it('every row: card spend = on jobs + office + payroll + not on a job + before sorting began; other = card spend − fuel', () => {
    for (const r of rollup.rows) {
      expect(r.onJobs + r.office.usd + r.payroll.usd + r.notOnJob + r.beforeSorting.usd).toBeCloseTo(r.cardSpend, 2)
      expect(r.other).toBeCloseTo(r.cardSpend - r.fuel, 2)
    }
  })

  it('Malachi: refund nets, the transfer is not spend, the old short split leaves $4 not on a job, the March charge is before sorting', () => {
    const m = rowOf('u:u-malachi')
    expect(m.cardSpend).toBe(195) // 100 + 40 − 25 + 70 + 10
    expect(m.fuel).toBe(40)
    expect(m.onJobs).toBe(121) // 100 + 40 − 25 + 6
    expect(m.notOnJob).toBe(4)
    expect(m.beforeSorting).toEqual({ usd: 70, charges: 1 })
    expect(m.charges).toBe(5)
    expect(m.jobs.map((j) => [j.jobId, j.spend, j.fuel, j.charges])).toEqual([['j1', 121, 40, 4]])
  })

  it('Dana: a split charge counts on both jobs, the invoice-linked one is On supply invoices, the Office split is Office', () => {
    const d = rowOf('u:u-dana')
    expect(d.cardSpend).toBe(180) // 60 + 18 + 80 + 22
    expect(d.fuel).toBe(18) // the label made it fuel; the other charge's fuel category lost to its label
    expect(d.onJobs).toBe(158) // 30 + 30 + 18 + 80
    expect(d.onSupplyInvoices).toEqual({ usd: 80, charges: 1 })
    expect(d.office).toEqual({ usd: 22, charges: 1 })
    expect(d.notOnJob).toBe(0)
    expect(d.jobs.map((j) => [j.jobId, j.spend])).toEqual([['j2', 48], ['j1', 30]])
    expect(d.jobs.some((j) => j.jobId === OFFICE)).toBe(false)
  })

  it('a payroll mark is its own bucket, not work to do', () => {
    const p = rowOf('p:p-pat')
    expect(p.payroll).toEqual({ usd: 50, charges: 1 })
    expect(p.notOnJob).toBe(0)
    expect(p.looseCharges).toEqual([])
  })

  it('Company cards and Not tied to anyone carry their charges, the untied one is fuel', () => {
    expect(rowOf('company')).toMatchObject({ cardSpend: 200, fuel: 0, notOnJob: 200 })
    expect(rowOf('untied')).toMatchObject({ cardSpend: 15, fuel: 15, notOnJob: 15 })
  })

  it('totals: the strip above the table', () => {
    expect(rollup.totals).toEqual({
      cardSpend: 687, // Malachi 195 + Dana 180 + Pat 50 + Jorge 47 + Company 200 + untied 15
      fuel: 108, // 40 + 18 + 35 + 15
      other: 579,
      onJobs: 279, // 121 + 158
      office: 22,
      payroll: 50,
      notOnJob: 266, // Malachi's $4 remainder + Jorge 47 + Company 200 + untied 15
      beforeSorting: 70,
      charges: 14,
      notOnJobCharges: 5,
      notOnJobFuel: 50, // Jorge's 35 + the untied 15
      untied: { usd: 15, charges: 1 },
      jobs: 2,
      internalTransfers: { usd: 500, charges: 1 },
    })
  })
})

describe('buildSpendingRollup — the payroll mark by role', () => {
  // What the read returns to a caller without payroll access: no charge settled by a payroll
  // mark alone (the function's WHERE), the rest as is.
  const withoutPayrollAccess = CHARGES.filter((c) => !(c.payrollMarked && c.splits.length === 0 && c.invoiceLinks.length === 0))
  const narrow = buildSpendingRollup({ charges: withoutPayrollAccess, lookups: LOOKUPS, fuelTagId: FUEL.id, officeJobId: OFFICE, sortingFloorYmd: FLOOR, directory: DIRECTORY })

  it('totals differ by exactly the charges settled by a payroll mark alone; every job reads the same', () => {
    expect(rollup.totals.payroll).toBe(50)
    expect(narrow.totals.payroll).toBe(0)
    expect(rollup.totals.cardSpend - narrow.totals.cardSpend).toBeCloseTo(rollup.totals.payroll, 2)
    expect([...narrow.byJob]).toEqual([...rollup.byJob])
    expect(narrow.totals.notOnJob).toBe(rollup.totals.notOnJob)
    expect(narrow.rows.some((r) => r.who.key === 'p:p-pat')).toBe(false)
  })

  it('a marked charge that is also on a job counts on the job, for every role', () => {
    const markedOnJob = charge({ amount: -33, attributedUserId: 'u-dana', payrollMarked: true, splits: [split('j1', -33)] })
    const r = buildSpendingRollup({ charges: [markedOnJob], lookups: LOOKUPS, fuelTagId: FUEL.id, officeJobId: OFFICE, sortingFloorYmd: FLOOR, directory: DIRECTORY })
    expect(r.rows[0]).toMatchObject({ onJobs: 33, payroll: { usd: 0, charges: 0 }, notOnJob: 0 })
    expect(r.byJob.get('j1')).toEqual({ spend: 33, fuel: 0 })
  })
})

describe('buildSpendingRollup — the charges not on a job yet', () => {
  it('a held card puts on a job through the holder (Team purchases’ write), another card through Banking’s', () => {
    const jorge = rowOf('u:u-jorge').looseCharges
    expect(jorge.map((l) => [l.id, l.sortMode, l.canSort, l.fuel])).toEqual([
      [C.byCard.id, 'holder', true, true],
      [C.byCardOutsideCircle.id, 'holder', false, false],
    ])
    expect(rowOf('company').looseCharges[0]).toMatchObject({ sortMode: 'banking', canSort: true, cardNickname: 'Office Amex' })
  })

  it('a charge before the sorting floor is labelled and has no button', () => {
    const before = rowOf('u:u-malachi').looseCharges.find((l) => l.id === C.beforeFloor.id)
    expect(before).toMatchObject({ beforeSortingBegan: true, canSort: false, notOnJobUsd: 70 })
  })

  it('an old split that leaves a remainder lists only the remainder', () => {
    const short = rowOf('u:u-malachi').looseCharges.find((l) => l.id === C.oldShortSplit.id)
    expect(short).toMatchObject({ costUsd: 10, notOnJobUsd: 4, beforeSortingBegan: false })
  })

  it('no floor set: nothing is before sorting began', () => {
    const r = buildSpendingRollup({ charges: [C.beforeFloor], lookups: LOOKUPS, fuelTagId: FUEL.id, officeJobId: OFFICE, sortingFloorYmd: null, directory: DIRECTORY })
    expect(r.rows[0]).toMatchObject({ notOnJob: 70, beforeSorting: { usd: 0, charges: 0 } })
  })

  it('no fuel tag in the org: nothing is fuel', () => {
    const r = buildSpendingRollup({ charges: CHARGES, lookups: LOOKUPS, fuelTagId: null, officeJobId: OFFICE, sortingFloorYmd: FLOOR, directory: DIRECTORY })
    expect(r.totals.fuel).toBe(0)
    expect(r.totals.cardSpend).toBe(rollup.totals.cardSpend)
  })

  it('an empty window is all zeros and no rows', () => {
    const r = buildSpendingRollup({ charges: [], lookups: LOOKUPS, fuelTagId: FUEL.id, officeJobId: OFFICE, sortingFloorYmd: FLOOR, directory: DIRECTORY })
    expect(r.rows).toEqual([])
    expect(r.totals.cardSpend).toBe(0)
    expect(r.byJob.size).toBe(0)
  })
})
