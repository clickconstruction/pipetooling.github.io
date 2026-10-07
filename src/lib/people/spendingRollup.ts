// People → Spending (punch list #52, PR 4b): who is spending what on the company's cards, for any
// period — one row per person, plus Company cards and Not tied to anyone. Pure.
//
// The job screens' rules are called, not restated, so the numbers cannot drift from them:
// - A charge's cost is `cardChargeCostUsd`: a purchase adds, a refund comes off.
// - An Internal Transfer is not spend: the label's bucket through `cardChargeAllocationCounts`.
// - Fuel is the Job window's classifier: the accounting label's tag, else the bank category's
//   (`categoryTagForCharge`), against the fuel family's tag (`pickFuelTag`, passed in by id).
// - On a job is the job splits. A charge that is also on a supply-house invoice is on its jobs
//   through the invoice: it counts On jobs and is listed On supply invoices, never under a job —
//   the Job window counts it under the invoice, so every job cell here is the job's card line there.
// - The Office job is sorted but overhead: its own bucket, never job cost.
// - A payroll mark settles a charge with no job (Tally): its own bucket, not work to do. The read
//   returns such a charge only to callers with payroll access, so the bucket is theirs alone.
// - A charge before Tally's sorting floor that is on no job: its own bucket, not work to do.
// So for every row: card spend = on jobs + office + payroll + not on a job + before sorting began.
//
// Who a charge belongs to: its attribution (a person record with a login is that login); else,
// on a company card, Company cards; else the card's holder (counted as "by card"); else Not tied
// to anyone.

import {
  cardChargeAllocationCounts,
  cardChargeAllocationIsInvoiceLinked,
  cardChargeCostUsd,
  type CardChargeExclusions,
} from '../jobs/cardChargeAllocationFilter'
import { overheadPartsAccountingBucketFromDefaultKey } from '../overheadPartsAccountingBuckets'
import { categoryTagForCharge, type CategoryTagLookups } from '../banking/categoryTags'
import { mercuryRowPassesSortingStartDate } from '../bankingSortingConfig'
import type { CardChargeWindowRow } from '../banking/cardChargesWindow'
import type { SortedJobSplit } from '../teamPurchasesSorted'

export type SpendingWhoKind = 'person' | 'company' | 'untied'

export type SpendingWho = {
  kind: SpendingWhoKind
  /** `u:<users.id>` / `p:<people.id>` (the Person Desk's keys), `company`, `untied`. */
  key: string
  name: string
  userId: string | null
  personId: string | null
}

export type SpendingDirectory = {
  /** users.id → name. */
  userNameById: ReadonlyMap<string, string>
  /** people.id → name and the login it is linked to, if any. */
  personById: ReadonlyMap<string, { name: string; accountUserId: string | null }>
}

/** A slice of card spend: its dollars, its charges, and the fuel among them. */
export type SpendingBucket = { usd: number; charges: number; fuel: number }

export type SpendingJobCell = {
  jobId: string
  /** The job's number and name as the split carries them, for its label. */
  job: Pick<SortedJobSplit, 'hcpNumber' | 'clickNumber' | 'jobName' | 'serviceTypeId'>
  spend: number
  fuel: number
  charges: number
}

/** A charge with money on no job — the list a person opens, each with *Put on a job*. */
export type SpendingLooseCharge = {
  id: string
  postedAt: string
  counterpartyName: string | null
  cardNickname: string | null
  debitCardId: string | null
  holderUserId: string | null
  holderName: string | null
  /** The whole charge's cost. */
  costUsd: number
  /** What of it is on no job (the whole charge unless an old split left a remainder). */
  notOnJobUsd: number
  fuel: boolean
  /** Posted before Tally's sorting floor: not work to do, so no *Put on a job*. */
  beforeSortingBegan: boolean
  /** `holder`: the linked-card staff write, acting for the holder (Team purchases). `banking`: the Banking write. */
  sortMode: 'holder' | 'banking'
  /** The write admits this viewer and the charge is after the floor. */
  canSort: boolean
}

export type SpendingRow = {
  who: SpendingWho
  cardSpend: number
  fuel: number
  /** Card spend less fuel. */
  other: number
  /** Job splits off the Office job, plus charges on supply-house invoices. */
  onJobs: number
  office: SpendingBucket
  payroll: SpendingBucket
  /** On no job, posted on or after the sorting floor. */
  notOnJob: number
  beforeSorting: SpendingBucket
  onSupplyInvoices: SpendingBucket
  charges: number
  /** Charges counted here only because the card is theirs (no attribution). */
  byCardCharges: number
  /** Biggest first; never the Office job. */
  jobs: SpendingJobCell[]
  /** Newest first. */
  looseCharges: SpendingLooseCharge[]
}

export type SpendingTotals = {
  cardSpend: number
  fuel: number
  other: number
  onJobs: number
  office: number
  payroll: number
  notOnJob: number
  beforeSorting: number
  charges: number
  /** Charges with money on no job, after the floor — the work. */
  notOnJobCharges: number
  notOnJobFuel: number
  untied: SpendingBucket
  /** Distinct jobs with card spend (not the Office job). */
  jobs: number
  /** Left out, as every job screen leaves them out. */
  internalTransfers: SpendingBucket
}

export type SpendingRollup = {
  rows: SpendingRow[]
  totals: SpendingTotals
  /** job id → the job's card spend and fuel across everyone in the period (the Job window's card line). */
  byJob: Map<string, { spend: number; fuel: number }>
}

export type SpendingInput = {
  charges: readonly CardChargeWindowRow[]
  lookups: CategoryTagLookups
  /** The fuel family's tag (`pickFuelTag`); null when the org has none. */
  fuelTagId: string | null
  /** The Office job (`fetchOverheadOfficeJobLedgerIdFromAppSettings`); null when unset. */
  officeJobId: string | null
  /** Tally's `job_tally_min_posted_ymd`; null when unset. */
  sortingFloorYmd: string | null
  directory: SpendingDirectory
}

/** The one card rule's lookups, built from the window's own rows (the label's bucket, the invoice links). */
export function cardChargeExclusionsFromRows(charges: readonly CardChargeWindowRow[]): CardChargeExclusions {
  const bucketByTxId = new Map<string, string>()
  const invoiceLinkedTxIds = new Set<string>()
  for (const c of charges) {
    if (c.labelId) bucketByTxId.set(c.id, overheadPartsAccountingBucketFromDefaultKey(c.labelDefaultKey))
    if (c.invoiceLinks.length > 0) invoiceLinkedTxIds.add(c.id)
  }
  return { bucketByTxId, invoiceLinkedTxIds }
}

const NOT_ON_ROSTER = 'Someone not on the roster'
const COMPANY: SpendingWho = { kind: 'company', key: 'company', name: 'Company cards', userId: null, personId: null }
const UNTIED: SpendingWho = { kind: 'untied', key: 'untied', name: 'Not tied to anyone', userId: null, personId: null }

function personByUser(userId: string, dir: SpendingDirectory, fallbackName: string | null): SpendingWho {
  return { kind: 'person', key: `u:${userId}`, name: dir.userNameById.get(userId) ?? fallbackName ?? NOT_ON_ROSTER, userId, personId: null }
}

/** Who a charge belongs to, and whether only the card says so. */
export function spendingWhoForCharge(c: CardChargeWindowRow, dir: SpendingDirectory): { who: SpendingWho; byCard: boolean } {
  if (c.attributedUserId) {
    return { who: personByUser(c.attributedUserId, dir, c.attributedUserId === c.holderUserId ? c.holderName : null), byCard: false }
  }
  if (c.attributedPersonId) {
    const p = dir.personById.get(c.attributedPersonId)
    if (p?.accountUserId) return { who: personByUser(p.accountUserId, dir, p.name), byCard: false }
    return {
      who: { kind: 'person', key: `p:${c.attributedPersonId}`, name: p?.name ?? NOT_ON_ROSTER, userId: null, personId: c.attributedPersonId },
      byCard: false,
    }
  }
  if (c.cardRole === 'company') return { who: COMPANY, byCard: false }
  if (c.holderUserId) return { who: personByUser(c.holderUserId, dir, c.holderName), byCard: true }
  return { who: UNTIED, byCard: false }
}

type RowAcc = SpendingRow & { jobById: Map<string, SpendingJobCell> }

function newRow(who: SpendingWho): RowAcc {
  return {
    who,
    cardSpend: 0,
    fuel: 0,
    other: 0,
    onJobs: 0,
    office: { usd: 0, charges: 0, fuel: 0 },
    payroll: { usd: 0, charges: 0, fuel: 0 },
    notOnJob: 0,
    beforeSorting: { usd: 0, charges: 0, fuel: 0 },
    onSupplyInvoices: { usd: 0, charges: 0, fuel: 0 },
    charges: 0,
    byCardCharges: 0,
    jobs: [],
    looseCharges: [],
    jobById: new Map(),
  }
}

const round2 = (n: number): number => Math.round(n * 100) / 100
const PENNY = 0.005
const roundBucket = (b: SpendingBucket): SpendingBucket => ({ usd: round2(b.usd), charges: b.charges, fuel: round2(b.fuel) })

function finishRow(acc: RowAcc): SpendingRow {
  const { jobById, ...row } = acc
  return {
    ...row,
    cardSpend: round2(row.cardSpend),
    fuel: round2(row.fuel),
    other: round2(row.cardSpend - row.fuel),
    onJobs: round2(row.onJobs),
    office: roundBucket(row.office),
    payroll: roundBucket(row.payroll),
    notOnJob: round2(row.notOnJob),
    beforeSorting: roundBucket(row.beforeSorting),
    onSupplyInvoices: roundBucket(row.onSupplyInvoices),
    jobs: [...jobById.values()]
      .map((j) => ({ ...j, spend: round2(j.spend), fuel: round2(j.fuel) }))
      .sort((a, b) => b.spend - a.spend || a.jobId.localeCompare(b.jobId)),
    looseCharges: [...row.looseCharges].sort((a, b) => b.postedAt.localeCompare(a.postedAt) || a.id.localeCompare(b.id)),
  }
}

const ROW_KIND_ORDER: Record<SpendingWhoKind, number> = { person: 0, company: 1, untied: 2 }

export function buildSpendingRollup(input: SpendingInput): SpendingRollup {
  const exclusions = cardChargeExclusionsFromRows(input.charges)
  const rows = new Map<string, RowAcc>()
  const byJob = new Map<string, { spend: number; fuel: number }>()
  const internalTransfers: SpendingBucket = { usd: 0, charges: 0, fuel: 0 }

  for (const c of input.charges) {
    const rule = { mercury_transaction_id: c.id, amount: c.amount }
    const cost = cardChargeCostUsd(c.amount)
    if (!cardChargeAllocationCounts(rule, exclusions)) {
      internalTransfers.usd += cost
      internalTransfers.charges += 1
      continue
    }
    const tag = categoryTagForCharge(input.lookups, c.labelId, c.bankCategory)
    const isFuel = input.fuelTagId != null && tag?.id === input.fuelTagId

    const { who, byCard } = spendingWhoForCharge(c, input.directory)
    let row = rows.get(who.key)
    if (!row) {
      row = newRow(who)
      rows.set(who.key, row)
    }
    row.cardSpend += cost
    row.charges += 1
    if (byCard) row.byCardCharges += 1
    if (isFuel) row.fuel += cost

    let notOnJobUsd = 0
    if (cardChargeAllocationIsInvoiceLinked(rule, exclusions)) {
      row.onJobs += cost
      row.onSupplyInvoices.usd += cost
      row.onSupplyInvoices.charges += 1
      if (isFuel) row.onSupplyInvoices.fuel += cost
    } else if (c.splits.length > 0) {
      let onSplits = 0
      let onOffice = 0
      for (const s of c.splits) {
        const sc = cardChargeCostUsd(s.amount)
        onSplits += sc
        if (input.officeJobId != null && s.jobId === input.officeJobId) {
          onOffice += sc
          continue
        }
        row.onJobs += sc
        let cell = row.jobById.get(s.jobId)
        if (!cell) {
          cell = {
            jobId: s.jobId,
            job: { hcpNumber: s.hcpNumber, clickNumber: s.clickNumber, jobName: s.jobName, serviceTypeId: s.serviceTypeId },
            spend: 0,
            fuel: 0,
            charges: 0,
          }
          row.jobById.set(s.jobId, cell)
        }
        cell.spend += sc
        cell.charges += 1
        const job = byJob.get(s.jobId) ?? { spend: 0, fuel: 0 }
        job.spend += sc
        if (isFuel) {
          cell.fuel += sc
          job.fuel += sc
        }
        byJob.set(s.jobId, job)
      }
      if (onOffice !== 0) {
        row.office.usd += onOffice
        row.office.charges += 1
        if (isFuel) row.office.fuel += onOffice
      }
      // The writes refuse splits that do not add up to the charge; an old row can still leave a remainder.
      const rest = cost - onSplits
      if (Math.abs(rest) >= PENNY) notOnJobUsd = rest
    } else if (c.payrollMarked) {
      row.payroll.usd += cost
      row.payroll.charges += 1
      if (isFuel) row.payroll.fuel += cost
    } else {
      notOnJobUsd = cost
    }

    if (notOnJobUsd !== 0) {
      const beforeSortingBegan = input.sortingFloorYmd != null && !mercuryRowPassesSortingStartDate(c.postedAt, input.sortingFloorYmd)
      if (beforeSortingBegan) {
        row.beforeSorting.usd += notOnJobUsd
        row.beforeSorting.charges += 1
        if (isFuel) row.beforeSorting.fuel += notOnJobUsd
      } else {
        row.notOnJob += notOnJobUsd
      }
      row.looseCharges.push({
        id: c.id,
        postedAt: c.postedAt,
        counterpartyName: c.counterpartyName,
        cardNickname: c.cardNickname,
        debitCardId: c.debitCardId,
        holderUserId: c.holderUserId,
        holderName: c.holderName,
        costUsd: round2(cost),
        notOnJobUsd: round2(notOnJobUsd),
        fuel: isFuel,
        beforeSortingBegan,
        sortMode: c.holderUserId ? 'holder' : 'banking',
        canSort: c.viewerCanSort && !beforeSortingBegan,
      })
    }
  }

  const finished = [...rows.values()]
    .map(finishRow)
    .sort(
      (a, b) =>
        ROW_KIND_ORDER[a.who.kind] - ROW_KIND_ORDER[b.who.kind] ||
        b.cardSpend - a.cardSpend ||
        a.who.name.localeCompare(b.who.name),
    )

  const sum = (pick: (r: SpendingRow) => number) => round2(finished.reduce((s, r) => s + pick(r), 0))
  const work = finished.flatMap((r) => r.looseCharges.filter((l) => !l.beforeSortingBegan))
  const untiedRow = finished.find((r) => r.who.kind === 'untied')
  const totals: SpendingTotals = {
    cardSpend: sum((r) => r.cardSpend),
    fuel: sum((r) => r.fuel),
    other: sum((r) => r.other),
    onJobs: sum((r) => r.onJobs),
    office: sum((r) => r.office.usd),
    payroll: sum((r) => r.payroll.usd),
    notOnJob: sum((r) => r.notOnJob),
    beforeSorting: sum((r) => r.beforeSorting.usd),
    charges: finished.reduce((s, r) => s + r.charges, 0),
    notOnJobCharges: work.length,
    notOnJobFuel: round2(work.filter((l) => l.fuel).reduce((s, l) => s + l.notOnJobUsd, 0)),
    untied: { usd: untiedRow?.cardSpend ?? 0, charges: untiedRow?.charges ?? 0, fuel: untiedRow?.fuel ?? 0 },
    jobs: byJob.size,
    internalTransfers: roundBucket(internalTransfers),
  }

  for (const [jobId, j] of byJob) byJob.set(jobId, { spend: round2(j.spend), fuel: round2(j.fuel) })
  return { rows: finished, totals, byJob }
}
