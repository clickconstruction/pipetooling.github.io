/**
 * Moneyfill "weekly close" substrate (v2.1444 — WEEKLY_MONEY_PLAN.md Phase 3a).
 *
 * ONE implementation of the close-week queue counts, shared by two surfaces:
 * the Moneyfill page header (progress + jump chips) and the Weekly Money
 * Movement report's confidence footer — so the checklist and the report can
 * never disagree (plan invariant #5). Each queue PR registers its fetcher
 * here; surfaces render whatever the registry returns.
 *
 * Week = Mon–Sun Central, matching the report. The close week DEFAULTS to the
 * previous complete week (the week you close Monday morning).
 *
 * ONE exception (journey-map Tier-1 #15, J7-2): the people-hours queue
 * ("Sessions pending approval") is a payroll lens, so it re-anchors onto the
 * Sun–Sat PAY week that ends inside the close week (`payWeekForCloseWeek`) —
 * the same week Draft Payroll opens to. Bank-money queues stay Mon–Sun.
 */
import { supabase } from './supabase'
import { chicagoYmdOf } from './gcStatementStandingCopies'
import { mondayOfWeekYmd } from './jobs/stagesWeeklyMovement'
import { addDaysYmd } from './emailSchedule/emailScheduleWeek'
import { parseNoncardAttributionQueueRows, type NoncardAttributionQueueRow } from './banking/noncardAttributionQueue'
import { mercuryDebitCardIdFromRaw } from './mercuryRawDebitCard'
import { salaryZonedWallClockToUtcMs } from './salaryZonedWallClock'
import { APP_CALENDAR_TZ } from '../utils/dateUtils'
import type { Json } from '../types/database'
import {
  computeUnallocatedFieldRows,
  type PeopleHoursUnallocatedCrewInput,
  type PeopleHoursUnallocatedPayConfigInput,
  type PeopleHoursUnallocatedRow,
} from './peopleHoursUnallocatedRows'
import type { OverheadClockSessionRow } from './overheadDailyLabor'
import { fetchOverheadOfficeJobLedgerIdFromAppSettings } from './overheadOfficeJobSettings'
import { resolveBankPaymentsSortingConfigForAr, type BankingSortingConfigV1 } from './bankingSortingConfig'
import { fetchAllRows } from './supabasePaging'
import { fetchJobAllocationsByMercuryTxIds } from './fetchMercuryRelationsByTxIds'
import { buildWeeklyMoneyRow, type WeeklyMoneyPayload, type WeeklyMoneyJobRow } from './jobs/weeklyMoneyMovement'
import { payWeekForCloseWeek, type PayWeek } from './payWeekAnchor'

export type MoneyfillQueueKey =
  | 'bank-transfers'
  | 'card-charges'
  | 'deposits-unapplied'
  | 'time-no-job'
  | 'pending-approval'
  | 'supply-invoices'
  | 'no-pct-report'
  | 'no-job-total'
  | 'sub-sheets'

export type MoneyfillQueueCount = {
  key: MoneyfillQueueKey
  /** Short chip label ("Bank transfers"). */
  label: string
  /** Row/item count for the close week; null = fetch failed or not eligible. */
  count: number | null
  /** Unattributed dollars for the week when the queue is dollar-shaped. */
  dollars: number | null
}

/** Queues that exist so far — grows one entry per queue PR (E–I). */
export const MONEYFILL_QUEUE_LABELS: Record<MoneyfillQueueKey, string> = {
  'bank-transfers': 'Bank transfers',
  'card-charges': 'Card charges',
  'deposits-unapplied': 'Deposits',
  'time-no-job': 'Time w/o job',
  'pending-approval': 'Pending approval',
  'supply-invoices': 'Supply invoices',
  'no-pct-report': 'No % report',
  'no-job-total': 'No job total',
  'sub-sheets': 'Sub sheets',
}

/** Monday (YYYY-MM-DD, Central calendar) of the previous complete week. */
export function previousCompleteWeekMonday(now: Date = new Date()): string {
  return addDaysYmd(mondayOfWeekYmd(chicagoYmdOf(now)), -7)
}

/** "Aug 3 – 9" style label reused from the sibling reports would need the
 * weekLabel import at call sites; the close header uses it directly. */

export type WeekCloseSummary = {
  totalQueues: number
  queuesAtZero: number
  /** Sum of known unattributed dollars (absolute). */
  unattributedDollars: number
  /** True when any queue failed to load (summary is a floor, not a total). */
  partial: boolean
}

export function summarizeWeekClose(counts: MoneyfillQueueCount[]): WeekCloseSummary {
  let zero = 0
  let dollars = 0
  let partial = false
  for (const c of counts) {
    if (c.count == null) {
      partial = true
      continue
    }
    if (c.count === 0) zero += 1
    if (c.dollars != null) dollars += Math.abs(c.dollars)
  }
  return { totalQueues: counts.length, queuesAtZero: zero, unattributedDollars: dollars, partial }
}

/** One-line confidence copy for the report footer; null when nothing to say. */
export function buildWeekCloseConfidenceLine(counts: MoneyfillQueueCount[]): string | null {
  const parts: string[] = []
  for (const c of counts) {
    if (c.count == null || c.count === 0) continue
    if (c.dollars != null && c.dollars !== 0) {
      parts.push(
        `$${Math.abs(c.dollars).toLocaleString('en-US', { maximumFractionDigits: 0 })} in ${c.label.toLowerCase()} unattributed`,
      )
    } else {
      parts.push(`${c.count} ${c.label.toLowerCase()} open`)
    }
  }
  if (parts.length === 0) return null
  return parts.join(' · ')
}

/** Pure week filter for noncard bank-transfer rows (posted Central date in week). */
export function filterNoncardRowsToWeek(
  rows: NoncardAttributionQueueRow[],
  weekMondayYmd: string,
): NoncardAttributionQueueRow[] {
  const endYmd = addDaysYmd(weekMondayYmd, 7)
  return rows.filter((r) => {
    if (!r.posted_at) return false
    const ymd = chicagoYmdOf(new Date(r.posted_at))
    return ymd >= weekMondayYmd && ymd < endYmd
  })
}

export function noncardWeekQueueCount(
  rows: NoncardAttributionQueueRow[] | null,
  weekMondayYmd: string,
  eligible: boolean,
): MoneyfillQueueCount {
  if (!eligible || rows == null) {
    return { key: 'bank-transfers', label: MONEYFILL_QUEUE_LABELS['bank-transfers'], count: null, dollars: null }
  }
  const week = filterNoncardRowsToWeek(rows, weekMondayYmd)
  const dollars = week.reduce((s, r) => s + Math.abs(r.amount), 0)
  return { key: 'bank-transfers', label: MONEYFILL_QUEUE_LABELS['bank-transfers'], count: week.length, dollars }
}

export type UnsplitCardChargeRow = {
  txId: string
  postedAt: string | null
  counterparty: string | null
  /** Signed Mercury amount — negative = purchase. */
  amount: number
  debitCardId: string
}

/** Pure: keep card purchases (debit-card raw + negative amount) with no job allocations. */
export function unsplitCardChargesFromTxs(
  txs: Array<{ id: string; posted_at: string | null; counterparty_name: string | null; amount: number; raw: Json | null }>,
  allocatedTxIds: ReadonlySet<string>,
): UnsplitCardChargeRow[] {
  const out: UnsplitCardChargeRow[] = []
  for (const t of txs) {
    if (allocatedTxIds.has(t.id)) continue
    if (!(Number(t.amount) < 0)) continue
    const cardId = mercuryDebitCardIdFromRaw(t.raw)
    if (!cardId) continue
    out.push({ txId: t.id, postedAt: t.posted_at, counterparty: t.counterparty_name, amount: Number(t.amount), debitCardId: cardId })
  }
  return out
}

export function cardChargesQueueCount(rows: UnsplitCardChargeRow[] | null): MoneyfillQueueCount {
  if (rows == null) {
    return { key: 'card-charges', label: MONEYFILL_QUEUE_LABELS['card-charges'], count: null, dollars: null }
  }
  return {
    key: 'card-charges',
    label: MONEYFILL_QUEUE_LABELS['card-charges'],
    count: rows.length,
    dollars: rows.reduce((s, r) => s + Math.abs(r.amount), 0),
  }
}

/** Week UTC bounds for a Central Mon–Sun week (start inclusive, end exclusive). */
export function weekUtcBounds(weekMondayYmd: string): { startIso: string; endIso: string } | null {
  const start = salaryZonedWallClockToUtcMs(weekMondayYmd, 0, 0, 0, APP_CALENDAR_TZ)
  const end = salaryZonedWallClockToUtcMs(addDaysYmd(weekMondayYmd, 7), 0, 0, 0, APP_CALENDAR_TZ)
  if (start == null || end == null) return null
  return { startIso: new Date(start).toISOString(), endIso: new Date(end).toISOString() }
}

/**
 * Where a card charge gets split to jobs: Banking → User Sort (`/banking?tab=sorting`),
 * the tab's Link… sheet. `q` pre-fills the tab's search with the counterparty so the
 * charge is on screen when the page opens (Banking reads `?q=` once, on mount).
 * v2.2849: the button used to `navigate('/quickfill')`, where the Banking-sorting
 * section is org-hidden — a dead end inside the weekly close (journey map Tier-1 #13).
 */
export const MONEYFILL_CARD_CHARGES_SORT_PATH = '/banking?tab=sorting'

export function cardChargeSortHref(counterparty: string | null | undefined): string {
  const q = (counterparty ?? '').trim()
  return q === '' ? MONEYFILL_CARD_CHARGES_SORT_PATH : `${MONEYFILL_CARD_CHARGES_SORT_PATH}&q=${encodeURIComponent(q)}`
}

type UnsplitCardChargeTxLite = { id: string; posted_at: string | null; counterparty_name: string | null; amount: number; raw: Json | null }

/**
 * Card purchases posted in the close week with no job allocations. Null on
 * error / ineligibility (mercury RLS is staff-scoped) — callers report partial.
 * Both reads are paged: the transactions via `fetchAllRows`, the allocations via
 * the same chunked `fetchJobAllocationsByMercuryTxIds` Banking's User Sort uses
 * (v2.2841) — so this queue and the tab's "Not split to jobs" count can never
 * disagree because one of them hit PostgREST's silent 1000-row cap.
 */
export async function fetchUnsplitCardChargesForWeek(weekMondayYmd: string): Promise<UnsplitCardChargeRow[] | null> {
  const bounds = weekUtcBounds(weekMondayYmd)
  if (!bounds) return null
  try {
    const txs = await fetchAllRows<UnsplitCardChargeTxLite>(
      (from, to) =>
        supabase
          .from('mercury_transactions')
          .select('id, posted_at, counterparty_name, amount, raw')
          .gte('posted_at', bounds.startIso)
          .lt('posted_at', bounds.endIso)
          .order('posted_at', { ascending: true })
          .order('id')
          .range(from, to),
      'moneyfill card charges mercury_transactions',
    )
    if (txs.length === 0) return []
    const allocRows = await fetchJobAllocationsByMercuryTxIds(
      txs.map((t) => t.id),
      'moneyfill card charges',
    )
    const allocated = new Set(allocRows.map((r) => String(r.mercury_transaction_id)))
    return unsplitCardChargesFromTxs(txs, allocated)
  } catch {
    return null
  }
}

export type UnassignedTimeWeekData = {
  rows: PeopleHoursUnallocatedRow[]
  totalUnallocatedHours: number
  /** Σ unallocated hours × wage where a wage is known. */
  totalAtWage: number
  /** Wage lookup used for the at-wage column (person_name → $/h). */
  wageByPersonName: Record<string, number>
}

/**
 * Queue 3c: approved field time the week's crew rows can't allocate to any
 * job, priced at wage. Same kernel + sourcing as Quickfill's Unassigned field
 * time (approved-closed clock only, threshold 0 here). Null on error.
 */
export async function fetchUnassignedTimeForWeek(weekMondayYmd: string): Promise<UnassignedTimeWeekData | null> {
  try {
    const workDates = Array.from({ length: 7 }, (_, i) => addDaysYmd(weekMondayYmd, i))
    const bounds = weekUtcBounds(weekMondayYmd)
    if (!bounds) return null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rpc = (supabase as any).rpc.bind(supabase)
    const [flagsRes, wagesRes, crewJobsRes, crewBidsRes, sessionsRes, officeJobId] = await Promise.all([
      rpc('list_people_pay_flags'),
      supabase.from('people_pay_config').select('person_name, person_id, hourly_wage'),
      supabase.from('people_crew_jobs').select('work_date, person_name, person_id, job_assignments').gte('work_date', weekMondayYmd).lt('work_date', addDaysYmd(weekMondayYmd, 7)),
      supabase.from('people_crew_bids').select('work_date, person_name, person_id, bid_assignments').gte('work_date', weekMondayYmd).lt('work_date', addDaysYmd(weekMondayYmd, 7)),
      supabase
        .from('clock_sessions')
        .select('id, user_id, work_date, clocked_in_at, clocked_out_at, job_ledger_id, bid_id, approved_at, rejected_at, revoked_at, users!clock_sessions_user_id_fkey(name)')
        .gte('work_date', weekMondayYmd)
        .lt('work_date', addDaysYmd(weekMondayYmd, 7))
        .not('clocked_out_at', 'is', null)
        .not('approved_at', 'is', null)
        .is('rejected_at', null)
        .is('revoked_at', null),
      fetchOverheadOfficeJobLedgerIdFromAppSettings(),
    ])
    if (flagsRes.error || wagesRes.error || crewJobsRes.error || crewBidsRes.error || sessionsRes.error) return null

    const payConfig: PeopleHoursUnallocatedPayConfigInput[] = (
      (flagsRes.data ?? []) as Array<{ person_name: string; person_id: string | null; is_salary: boolean | null; record_hours_but_salary?: boolean | null }>
    ).map((f) => ({
      person_name: f.person_name,
      person_id: f.person_id ?? null,
      is_salary: f.is_salary ?? false,
      record_hours_but_salary: f.record_hours_but_salary ?? false,
    }))

    const wageByPersonName: Record<string, number> = {}
    for (const w of (wagesRes.data ?? []) as Array<{ person_name: string; hourly_wage: number | null }>) {
      if (w.hourly_wage != null && Number.isFinite(Number(w.hourly_wage))) wageByPersonName[w.person_name] = Number(w.hourly_wage)
    }

    const crewByKey = new Map<string, PeopleHoursUnallocatedCrewInput>()
    const crewKey = (n: string, d: string) => `${n}|${d}`
    for (const r of (crewJobsRes.data ?? []) as Array<{ work_date: string; person_name: string; person_id: string | null; job_assignments: Array<{ job_id: string; pct: number }> }>) {
      crewByKey.set(crewKey(r.person_name, r.work_date), {
        work_date: r.work_date,
        person_name: r.person_name,
        person_id: r.person_id ?? null,
        job_assignments: Array.isArray(r.job_assignments) ? r.job_assignments : [],
        bid_assignments: [],
      })
    }
    for (const r of (crewBidsRes.data ?? []) as Array<{ work_date: string; person_name: string; person_id: string | null; bid_assignments: Array<{ bid_id: string; pct: number }> }>) {
      const k = crewKey(r.person_name, r.work_date)
      const existing = crewByKey.get(k)
      if (existing) existing.bid_assignments = Array.isArray(r.bid_assignments) ? r.bid_assignments : []
      else
        crewByKey.set(k, {
          work_date: r.work_date,
          person_name: r.person_name,
          person_id: r.person_id ?? null,
          job_assignments: [],
          bid_assignments: Array.isArray(r.bid_assignments) ? r.bid_assignments : [],
        })
    }

    const sessions = ((sessionsRes.data ?? []) as unknown[]).map((raw) => {
      const s = raw as Record<string, unknown>
      const usersRaw = s.users
      const usersValue = Array.isArray(usersRaw) ? ((usersRaw[0] ?? null) as { name: string | null } | null) : ((usersRaw ?? null) as { name: string | null } | null)
      return { ...(s as object), users: usersValue } as OverheadClockSessionRow
    })

    const rows = computeUnallocatedFieldRows({
      payConfig,
      crewRows: [...crewByKey.values()],
      overheadSessions: sessions,
      officeJobLedgerId: officeJobId,
      workDates,
      thresholdHours: 0.01,
    })
    let totalHours = 0
    let totalAtWage = 0
    for (const r of rows) {
      totalHours += r.unallocatedHrs
      const wage = wageByPersonName[r.personName]
      if (wage != null) totalAtWage += r.unallocatedHrs * wage
    }
    return { rows, totalUnallocatedHours: totalHours, totalAtWage, wageByPersonName }
  } catch {
    return null
  }
}

export function unassignedTimeQueueCount(data: UnassignedTimeWeekData | null): MoneyfillQueueCount {
  if (data == null) return { key: 'time-no-job', label: MONEYFILL_QUEUE_LABELS['time-no-job'], count: null, dollars: null }
  return {
    key: 'time-no-job',
    label: MONEYFILL_QUEUE_LABELS['time-no-job'],
    count: data.rows.length,
    dollars: data.totalAtWage,
  }
}

export type PendingApprovalSessionRow = {
  id: string
  personName: string
  workDate: string
  clockedInAt: string
  clockedOutAt: string
  hours: number
  atWage: number | null
  jobOrBid: 'job' | 'bid' | null
}

/** The Sun–Sat pay week the people-hours queue reviews for a Mon–Sun close week (header count + section agree by construction). */
export function pendingApprovalPayWeek(weekMondayYmd: string): PayWeek {
  return payWeekForCloseWeek(weekMondayYmd)
}

/**
 * Queue 3d: closed clock sessions nobody has approved — labor cost not yet
 * booked anywhere (crew rows only sync on approval). Null on error.
 *
 * Window = the Sun–Sat pay week ending inside the close week (v2 re-anchor,
 * Tier-1 #15): the Mon–Sun window straddled two pay weeks, so this queue could
 * read "all clear" while Draft Payroll still listed pending sessions.
 */
export async function fetchPendingApprovalForWeek(weekMondayYmd: string): Promise<PendingApprovalSessionRow[] | null> {
  try {
    const payWeek = pendingApprovalPayWeek(weekMondayYmd)
    const [sessRes, wagesRes] = await Promise.all([
      supabase
        .from('clock_sessions')
        .select('id, work_date, clocked_in_at, clocked_out_at, job_ledger_id, bid_id, users!clock_sessions_user_id_fkey(name)')
        .gte('work_date', payWeek.start)
        .lte('work_date', payWeek.end)
        .not('clocked_out_at', 'is', null)
        .is('approved_at', null)
        .is('rejected_at', null)
        .is('revoked_at', null)
        .order('work_date', { ascending: true }),
      supabase.from('people_pay_config').select('person_name, hourly_wage'),
    ])
    if (sessRes.error || wagesRes.error) return null
    const wageByName: Record<string, number> = {}
    for (const w of (wagesRes.data ?? []) as Array<{ person_name: string; hourly_wage: number | null }>) {
      if (w.hourly_wage != null) wageByName[w.person_name] = Number(w.hourly_wage)
    }
    return ((sessRes.data ?? []) as unknown[]).map((raw) => {
      const s = raw as Record<string, unknown>
      const usersRaw = s.users
      const u = Array.isArray(usersRaw) ? ((usersRaw[0] ?? null) as { name: string | null } | null) : ((usersRaw ?? null) as { name: string | null } | null)
      const personName = (u?.name ?? '').trim()
      const inAt = String(s.clocked_in_at)
      const outAt = String(s.clocked_out_at)
      const hours = Math.max(0, (Date.parse(outAt) - Date.parse(inAt)) / 3_600_000)
      const wage = wageByName[personName]
      return {
        id: String(s.id),
        personName: personName || '(unknown)',
        workDate: String(s.work_date),
        clockedInAt: inAt,
        clockedOutAt: outAt,
        hours,
        atWage: wage != null ? hours * wage : null,
        jobOrBid: s.job_ledger_id ? 'job' : s.bid_id ? 'bid' : null,
      } satisfies PendingApprovalSessionRow
    })
  } catch {
    return null
  }
}

export function pendingApprovalQueueCount(rows: PendingApprovalSessionRow[] | null): MoneyfillQueueCount {
  if (rows == null)
    return { key: 'pending-approval', label: MONEYFILL_QUEUE_LABELS['pending-approval'], count: null, dollars: null }
  return {
    key: 'pending-approval',
    label: MONEYFILL_QUEUE_LABELS['pending-approval'],
    count: rows.length,
    dollars: rows.reduce((s, r) => s + (r.atWage ?? 0), 0),
  }
}

export type SupplyInvoiceCoverageRow = {
  invoiceId: string
  supplyHouseName: string
  invoiceNumber: string
  invoiceDate: string
  amount: number
  /** Σ allocation pct (0–100+). */
  allocatedPct: number
  /** amount × (100 − allocatedPct)/100, floored at 0. */
  gapDollars: number
}

/**
 * Queue 3e: supply invoices dated in the close week whose job allocations
 * don't cover the invoice amount. Null on error.
 */
export async function fetchSupplyInvoiceCoverageForWeek(weekMondayYmd: string): Promise<SupplyInvoiceCoverageRow[] | null> {
  try {
    const endYmd = addDaysYmd(weekMondayYmd, 7)
    const invRes = await supabase
      .from('supply_house_invoices')
      .select('id, invoice_number, invoice_date, amount, supply_houses(name)')
      .gte('invoice_date', weekMondayYmd)
      .lt('invoice_date', endYmd)
      .order('invoice_date', { ascending: true })
    if (invRes.error) throw invRes.error
    const invoices = (invRes.data ?? []) as Array<{
      id: string
      invoice_number: string
      invoice_date: string
      amount: number
      supply_houses: { name: string } | { name: string }[] | null
    }>
    if (invoices.length === 0) return []
    const allocRes = await supabase
      .from('supply_house_invoice_job_allocations')
      .select('invoice_id, pct')
      .in('invoice_id', invoices.map((i) => i.id))
    if (allocRes.error) throw allocRes.error
    const pctByInvoice = new Map<string, number>()
    for (const a of (allocRes.data ?? []) as Array<{ invoice_id: string; pct: number }>) {
      pctByInvoice.set(a.invoice_id, (pctByInvoice.get(a.invoice_id) ?? 0) + Number(a.pct || 0))
    }
    const out: SupplyInvoiceCoverageRow[] = []
    for (const inv of invoices) {
      const allocatedPct = pctByInvoice.get(inv.id) ?? 0
      // 99.5%+ counts as covered (rounding on thirds-style splits).
      if (allocatedPct >= 99.5) continue
      const amount = Number(inv.amount || 0)
      const shRaw = inv.supply_houses
      const shName = (Array.isArray(shRaw) ? shRaw[0]?.name : shRaw?.name) ?? 'Unknown supply house'
      out.push({
        invoiceId: inv.id,
        supplyHouseName: shName,
        invoiceNumber: inv.invoice_number,
        invoiceDate: inv.invoice_date,
        amount,
        allocatedPct,
        gapDollars: Math.max(0, (amount * (100 - Math.min(allocatedPct, 100))) / 100),
      })
    }
    return out
  } catch {
    return null
  }
}

export function supplyInvoicesQueueCount(rows: SupplyInvoiceCoverageRow[] | null): MoneyfillQueueCount {
  if (rows == null)
    return { key: 'supply-invoices', label: MONEYFILL_QUEUE_LABELS['supply-invoices'], count: null, dollars: null }
  return {
    key: 'supply-invoices',
    label: MONEYFILL_QUEUE_LABELS['supply-invoices'],
    count: rows.length,
    dollars: rows.reduce((s, r) => s + r.gapDollars, 0),
  }
}

export type UnappliedDepositRow = {
  txId: string
  postedAt: string | null
  counterparty: string | null
  amount: number
}

/** Case-insensitive substring exclusion, mirroring the AR sorting filter semantics. */
export function depositPassesArExclusions(
  row: { counterparty: string | null; note: string | null },
  cfg: Pick<BankingSortingConfigV1, 'excludeCounterpartyContains' | 'excludeNoteContains'>,
): boolean {
  const cp = (row.counterparty ?? '').toLowerCase()
  for (const pat of cfg.excludeCounterpartyContains) {
    const p = pat.trim().toLowerCase()
    if (p && cp.includes(p)) return false
  }
  const note = (row.note ?? '').toLowerCase()
  for (const pat of cfg.excludeNoteContains) {
    const p = pat.trim().toLowerCase()
    if (p && note.includes(p)) return false
  }
  return true
}

/**
 * Queue 3f: money IN this week not yet applied to billed jobs — positive
 * Mercury transactions with no jobs_ledger_payments referencing them, after
 * the org's Accounts Receivable sorting exclusions. Null on error.
 */
export async function fetchUnappliedDepositsForWeek(
  weekMondayYmd: string,
  authUserId?: string,
): Promise<UnappliedDepositRow[] | null> {
  const bounds = weekUtcBounds(weekMondayYmd)
  if (!bounds) return null
  try {
    const [txRes, cfg] = await Promise.all([
      supabase
        .from('mercury_transactions')
        .select('id, posted_at, counterparty_name, amount, note')
        .gt('amount', 0)
        .gte('posted_at', bounds.startIso)
        .lt('posted_at', bounds.endIso)
        .order('posted_at', { ascending: true }),
      resolveBankPaymentsSortingConfigForAr(authUserId),
    ])
    if (txRes.error) throw txRes.error
    const txs = (txRes.data ?? []) as Array<{ id: string; posted_at: string | null; counterparty_name: string | null; amount: number; note: string | null }>
    const candidates = txs.filter((t) =>
      depositPassesArExclusions({ counterparty: t.counterparty_name, note: t.note }, cfg),
    )
    if (candidates.length === 0) return []
    const payRes = await supabase
      .from('jobs_ledger_payments')
      .select('mercury_transaction_id')
      .in('mercury_transaction_id', candidates.map((t) => t.id))
    if (payRes.error) throw payRes.error
    const applied = new Set(
      ((payRes.data ?? []) as Array<{ mercury_transaction_id: string | null }>)
        .map((r) => r.mercury_transaction_id)
        .filter((x): x is string => x != null),
    )
    return candidates
      .filter((t) => !applied.has(t.id))
      .map((t) => ({ txId: t.id, postedAt: t.posted_at, counterparty: t.counterparty_name, amount: Number(t.amount) }))
  } catch {
    return null
  }
}

export function depositsQueueCount(rows: UnappliedDepositRow[] | null): MoneyfillQueueCount {
  if (rows == null)
    return { key: 'deposits-unapplied', label: MONEYFILL_QUEUE_LABELS['deposits-unapplied'], count: null, dollars: null }
  return {
    key: 'deposits-unapplied',
    label: MONEYFILL_QUEUE_LABELS['deposits-unapplied'],
    count: rows.length,
    dollars: rows.reduce((s, r) => s + r.amount, 0),
  }
}

export type JobFlagQueues = {
  noPctSignal: WeeklyMoneyJobRow[]
  noJobTotal: WeeklyMoneyJobRow[]
}

/**
 * Queues 3g + 3h from the payload RPC itself: jobs with in-week money the
 * report can't score — no % signal, or no job total. Same rows, same flags,
 * as the report (kernel reuse). Null on error (RPC is dev/controller gated).
 */
export async function fetchJobFlagQueuesForWeek(weekMondayYmd: string): Promise<JobFlagQueues | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rpc = (supabase as any).rpc.bind(supabase)
    const res = await rpc('get_weekly_money_movement_payload', { p_week_monday: weekMondayYmd })
    if (res.error) throw res.error
    const payload = res.data as WeeklyMoneyPayload
    const rows = (payload.jobs ?? []).map(buildWeeklyMoneyRow)
    return {
      noPctSignal: rows.filter((r) => r.flagNoPctSignal),
      noJobTotal: rows.filter((r) => r.flagNoJobTotal),
    }
  } catch {
    return null
  }
}

export function noPctQueueCount(q: JobFlagQueues | null): MoneyfillQueueCount {
  if (q == null) return { key: 'no-pct-report', label: MONEYFILL_QUEUE_LABELS['no-pct-report'], count: null, dollars: null }
  return { key: 'no-pct-report', label: MONEYFILL_QUEUE_LABELS['no-pct-report'], count: q.noPctSignal.length, dollars: null }
}

export function noJobTotalQueueCount(q: JobFlagQueues | null): MoneyfillQueueCount {
  if (q == null) return { key: 'no-job-total', label: MONEYFILL_QUEUE_LABELS['no-job-total'], count: null, dollars: null }
  return { key: 'no-job-total', label: MONEYFILL_QUEUE_LABELS['no-job-total'], count: q.noJobTotal.length, dollars: null }
}

/**
 * Fetch every registered queue count for a close week. Queue fetchers are
 * eligibility-probed and NEVER throw — a failed queue reports count null so
 * both surfaces can say "partial". Registry: bank transfers, card charges, deposits, unassigned time, pending approval, supply invoices, no-% jobs, no-total jobs.
 */
export async function fetchWeekCloseCounts(weekMondayYmd: string, authUserId?: string): Promise<MoneyfillQueueCount[]> {
  // All queues fetch in parallel; each is eligibility-probed and never throws.
  const [noncardRows, cardRows, timeData, pendingRows, supplyRows, depositRows, jobFlags] = await Promise.all([
    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rpc = (supabase as any).rpc.bind(supabase)
        const res = await rpc('list_unattributed_noncard_mercury_transactions', { p_limit: 500 })
        if (res.error) throw res.error
        return parseNoncardAttributionQueueRows(res.data)
      } catch {
        return null
      }
    })(),
    fetchUnsplitCardChargesForWeek(weekMondayYmd),
    fetchUnassignedTimeForWeek(weekMondayYmd),
    fetchPendingApprovalForWeek(weekMondayYmd),
    fetchSupplyInvoiceCoverageForWeek(weekMondayYmd),
    fetchUnappliedDepositsForWeek(weekMondayYmd, authUserId),
    fetchJobFlagQueuesForWeek(weekMondayYmd),
  ])
  return [
    noncardWeekQueueCount(noncardRows, weekMondayYmd, noncardRows != null),
    cardChargesQueueCount(cardRows),
    depositsQueueCount(depositRows),
    unassignedTimeQueueCount(timeData),
    pendingApprovalQueueCount(pendingRows),
    supplyInvoicesQueueCount(supplyRows),
    noPctQueueCount(jobFlags),
    noJobTotalQueueCount(jobFlags),
  ]
}

