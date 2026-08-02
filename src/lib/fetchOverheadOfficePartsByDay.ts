import { supabase } from './supabase'
import type { Database, Json } from '../types/database'
import { calendarYmdInAppTzFromIso, ymdAddDays } from '../utils/dateUtils'
import { withSupabaseRetry, type SupabaseClientResult } from '../utils/errorHandling'
import { fetchAllRows } from './supabasePaging'
import { mercuryDebitCardIdFromRaw } from './mercuryRawDebitCard'

export type OverheadPartsSource = 'mercury' | 'supply' | 'tally'

export type OverheadPartsDetailLine = {
  source: OverheadPartsSource
  amountUsd: number
  label: string
  sortKey: string
  /**
   * Mercury debit card UUID (lowercase, hyphenated) when this line came
   * from a Mercury allocation whose transaction `raw` JSON exposed a
   * debit-card-info object. `null` for non-Mercury lines or when no
   * debit card was used (e.g. ACH/wire/check). UI layers can resolve it
   * to a nickname via `useMercuryLedgerNicknames().nicknameByDebitCard`.
   */
  mercuryDebitCardId?: string | null
  /**
   * Underlying `mercury_transactions.id` for Mercury allocation lines.
   * `null` for supply / tally lines. UI layers use this to look up the
   * transaction's Banking → Accounting drag-sort label assignment and
   * bucket the line accordingly.
   */
  mercuryTransactionId?: string | null
}

export type OverheadOfficePartsByDayResult = {
  partsUsdByDay: Map<string, number>
  partsDetailByDay: Map<string, OverheadPartsDetailLine[]>
}

function ymdInRangeInclusive(ymd: string, startYmd: string, endYmd: string): boolean {
  return ymd >= startYmd && ymd <= endYmd
}

type MercuryTxEmbed = { posted_at: string | null; counterparty_name: string | null; raw: Json | null }
type MercuryAllocationJoinRow = {
  id: string
  amount: number | string
  note: string | null
  mercury_transaction_id: string | null
  mercury_transactions: MercuryTxEmbed | MercuryTxEmbed[] | null
}
type SupplyInvoiceEmbed = {
  invoice_number: string
  invoice_date: string
  amount: string | number
  supply_houses?: { name: string } | { name: string }[] | null
}
type SupplyAllocationJoinRow = {
  invoice_id: string
  job_id: string
  pct: number | string | null
  supply_house_invoices: SupplyInvoiceEmbed | SupplyInvoiceEmbed[] | null
}
type TallyPoRow = Database['public']['Functions']['list_tally_parts_with_po']['Returns'][number]

/**
 * Pages a fresh-builder-per-call query with {@link fetchAllRows}, retrying
 * each page. These are company-lifetime tables: un-ranged, PostgREST silently
 * caps them at `max_rows` (1000) and — ordered `created_at` asc — returns the
 * 1,000 OLDEST rows, so the current window's materials vanish first.
 */
function pagedRetry<T>(
  makePage: (from: number, to: number) => PromiseLike<SupabaseClientResult<T[]>>,
  label: string,
): Promise<T[]> {
  return fetchAllRows<T>(
    async (from, to) => ({
      data: (await withSupabaseRetry(async () => makePage(from, to), label)) ?? [],
      error: null,
    }),
    label,
  )
}

/**
 * Mercury `posted_at` fetch bounds: one day wide on BOTH sides of the ymd
 * window because `addLine` re-buckets each timestamp into its Chicago
 * calendar day (a UTC-bounded window would drop evening rows on the edges).
 */
function mercuryPostedAtBounds(startYmd: string, endYmd: string): { lowIso: string; highIso: string } {
  return {
    lowIso: `${ymdAddDays(startYmd, -1)}T00:00:00-00:00`,
    highIso: `${ymdAddDays(endYmd, 2)}T00:00:00-00:00`,
  }
}

const MERCURY_ALLOC_SELECT =
  'id, amount, note, mercury_transaction_id, mercury_transactions!inner(posted_at, counterparty_name, raw)'
const SUPPLY_ALLOC_SELECT =
  'invoice_id, job_id, pct, supply_house_invoices!inner(invoice_number, invoice_date, amount, supply_houses(name))'

/**
 * Office job materials by calendar day (Chicago wall date for Mercury/Tally timestamps),
 * same sources as job materials snapshot: Mercury allocations, supply invoice allocations, tally parts.
 */
export async function fetchOverheadOfficePartsByDay(args: {
  officeJobLedgerId: string
  startYmd: string
  endYmd: string
}): Promise<OverheadOfficePartsByDayResult> {
  const { officeJobLedgerId, startYmd, endYmd } = args
  const partsUsdByDay = new Map<string, number>()
  const partsDetailByDay = new Map<string, OverheadPartsDetailLine[]>()

  const addLine = (ymd: string, line: OverheadPartsDetailLine) => {
    if (!ymdInRangeInclusive(ymd, startYmd, endYmd)) return
    partsUsdByDay.set(ymd, (partsUsdByDay.get(ymd) ?? 0) + line.amountUsd)
    const list = partsDetailByDay.get(ymd) ?? []
    list.push(line)
    partsDetailByDay.set(ymd, list)
  }

  try {
    const { lowIso, highIso } = mercuryPostedAtBounds(startYmd, endYmd)
    // `!inner` makes the nested posted_at range drop parent rows server-side
    // (a plain embed filter only nulls the embed and keeps the row).
    const raw = await pagedRetry<MercuryAllocationJoinRow>(
      (from, to) =>
        supabase
          .from('mercury_transaction_job_allocations')
          .select(MERCURY_ALLOC_SELECT)
          .eq('job_id', officeJobLedgerId)
          .gte('mercury_transactions.posted_at', lowIso)
          .lt('mercury_transactions.posted_at', highIso)
          .order('created_at', { ascending: true })
          .order('id')
          .range(from, to) as unknown as PromiseLike<SupabaseClientResult<MercuryAllocationJoinRow[]>>,
      'overhead office parts mercury',
    )
    for (const row of raw) {
      const txNested = row.mercury_transactions
      const tx = Array.isArray(txNested) ? txNested[0] : txNested
      const posted = tx?.posted_at
      if (!posted) continue
      const ymd = calendarYmdInAppTzFromIso(posted)
      if (!ymd) continue
      const amt = Math.abs(Number(row.amount))
      if (!Number.isFinite(amt) || amt <= 0) continue
      const cp = tx?.counterparty_name?.trim() || row.note?.trim() || 'Mercury'
      const debitCardId = mercuryDebitCardIdFromRaw(tx?.raw ?? null)
      addLine(ymd, {
        source: 'mercury',
        amountUsd: amt,
        label: cp,
        sortKey: `mercury:${row.id}`,
        mercuryDebitCardId: debitCardId,
        mercuryTransactionId: row.mercury_transaction_id ?? null,
      })
    }
  } catch {
    /* RLS or network */
  }

  try {
    const raw = await pagedRetry<SupplyAllocationJoinRow>(
      (from, to) =>
        supabase
          .from('supply_house_invoice_job_allocations')
          .select(SUPPLY_ALLOC_SELECT)
          .eq('job_id', officeJobLedgerId)
          .gte('supply_house_invoices.invoice_date', startYmd)
          .lte('supply_house_invoices.invoice_date', endYmd)
          .order('invoice_id')
          .order('job_id')
          .range(from, to) as unknown as PromiseLike<SupabaseClientResult<SupplyAllocationJoinRow[]>>,
      'overhead office parts supply',
    )
    for (const row of raw) {
      const invNested = row.supply_house_invoices
      const inv = Array.isArray(invNested) ? invNested[0] : invNested
      if (!inv) continue
      const ymd = inv.invoice_date ? String(inv.invoice_date).slice(0, 10) : ''
      if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) continue
      const pct = Number(row.pct ?? 0)
      const invAmt = Number(inv.amount ?? 0)
      const allocated = (invAmt * pct) / 100
      if (!Number.isFinite(allocated) || allocated <= 0) continue
      const shNested = inv.supply_houses
      const sh = Array.isArray(shNested) ? shNested[0] : shNested
      const invNum = inv.invoice_number?.trim() ?? ''
      const label = [sh?.name?.trim(), invNum ? `#${invNum}` : null].filter(Boolean).join(' · ') || 'Supply invoice'
      addLine(ymd, { source: 'supply', amountUsd: allocated, label, sortKey: `supply:${row.invoice_id}:${row.job_id}` })
    }
  } catch {
    /* empty */
  }

  try {
    // The RPC takes no filter args — page it (deterministic created_at ORDER
    // BY, the v2.1246 Review-tab pattern) and keep filtering client-side.
    const raw = await pagedRetry<TallyPoRow>(
      (from, to) => supabase.rpc('list_tally_parts_with_po').range(from, to),
      'overhead office parts tally',
    )
    const rows = raw.filter((r) => r.job_id === officeJobLedgerId)
    for (const row of rows) {
      const created = row.created_at
      if (!created) continue
      const ymd = calendarYmdInAppTzFromIso(created)
      if (!ymd) continue
      const qty = Number(row.quantity)
      const hasPart = row.part_id != null && String(row.part_id).length > 0
      const lineTotal = !hasPart
        ? Number(row.fixture_cost ?? 0) * qty
        : Number(row.price_at_time ?? 0) * qty
      if (!Number.isFinite(lineTotal) || lineTotal <= 0) continue
      const fixture = row.fixture_name?.trim() ?? 'Fixture'
      const partName = row.part_name?.trim()
      const label = partName ? `${fixture} — ${partName}` : fixture
      addLine(ymd, { source: 'tally', amountUsd: lineTotal, label, sortKey: `tally:${row.id}` })
    }
  } catch {
    /* empty */
  }

  for (const [k, list] of partsDetailByDay) {
    list.sort((a, b) => {
      const sd = a.source.localeCompare(b.source)
      if (sd !== 0) return sd
      return a.sortKey.localeCompare(b.sortKey)
    })
    partsDetailByDay.set(k, list)
  }

  return { partsUsdByDay, partsDetailByDay }
}

/**
 * Materials on all jobs except the overhead office job (or all jobs when `officeJobLedgerId` is null).
 * Same line rules and date keys as `fetchOverheadOfficePartsByDay`.
 */
export async function fetchOtherJobsPartsByDay(args: {
  officeJobLedgerId: string | null
  startYmd: string
  endYmd: string
}): Promise<OverheadOfficePartsByDayResult> {
  const { officeJobLedgerId, startYmd, endYmd } = args
  const partsUsdByDay = new Map<string, number>()
  const partsDetailByDay = new Map<string, OverheadPartsDetailLine[]>()

  const addLine = (ymd: string, line: OverheadPartsDetailLine) => {
    if (!ymdInRangeInclusive(ymd, startYmd, endYmd)) return
    partsUsdByDay.set(ymd, (partsUsdByDay.get(ymd) ?? 0) + line.amountUsd)
    const list = partsDetailByDay.get(ymd) ?? []
    list.push(line)
    partsDetailByDay.set(ymd, list)
  }

  const jobExcludedFromTally = (jobId: string): boolean =>
    officeJobLedgerId != null && officeJobLedgerId !== '' && jobId === officeJobLedgerId

  try {
    const { lowIso, highIso } = mercuryPostedAtBounds(startYmd, endYmd)
    const raw = await pagedRetry<MercuryAllocationJoinRow>(
      (from, to) => {
        let q = supabase
          .from('mercury_transaction_job_allocations')
          .select(MERCURY_ALLOC_SELECT)
          .gte('mercury_transactions.posted_at', lowIso)
          .lt('mercury_transactions.posted_at', highIso)
        if (officeJobLedgerId) q = q.neq('job_id', officeJobLedgerId)
        return q
          .order('created_at', { ascending: true })
          .order('id')
          .range(from, to) as unknown as PromiseLike<SupabaseClientResult<MercuryAllocationJoinRow[]>>
      },
      'overhead other jobs parts mercury',
    )
    for (const row of raw) {
      const txNested = row.mercury_transactions
      const tx = Array.isArray(txNested) ? txNested[0] : txNested
      const posted = tx?.posted_at
      if (!posted) continue
      const ymd = calendarYmdInAppTzFromIso(posted)
      if (!ymd) continue
      const amt = Math.abs(Number(row.amount))
      if (!Number.isFinite(amt) || amt <= 0) continue
      const cp = tx?.counterparty_name?.trim() || row.note?.trim() || 'Mercury'
      const debitCardId = mercuryDebitCardIdFromRaw(tx?.raw ?? null)
      addLine(ymd, {
        source: 'mercury',
        amountUsd: amt,
        label: cp,
        sortKey: `mercury:${row.id}`,
        mercuryDebitCardId: debitCardId,
        mercuryTransactionId: row.mercury_transaction_id ?? null,
      })
    }
  } catch {
    /* RLS or network */
  }

  try {
    const raw = await pagedRetry<SupplyAllocationJoinRow>(
      (from, to) => {
        let q = supabase
          .from('supply_house_invoice_job_allocations')
          .select(SUPPLY_ALLOC_SELECT)
          .gte('supply_house_invoices.invoice_date', startYmd)
          .lte('supply_house_invoices.invoice_date', endYmd)
        if (officeJobLedgerId) q = q.neq('job_id', officeJobLedgerId)
        return q
          .order('invoice_id')
          .order('job_id')
          .range(from, to) as unknown as PromiseLike<SupabaseClientResult<SupplyAllocationJoinRow[]>>
      },
      'overhead other jobs parts supply',
    )
    for (const row of raw) {
      const invNested = row.supply_house_invoices
      const inv = Array.isArray(invNested) ? invNested[0] : invNested
      if (!inv) continue
      const ymd = inv.invoice_date ? String(inv.invoice_date).slice(0, 10) : ''
      if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) continue
      const pct = Number(row.pct ?? 0)
      const invAmt = Number(inv.amount ?? 0)
      const allocated = (invAmt * pct) / 100
      if (!Number.isFinite(allocated) || allocated <= 0) continue
      const shNested = inv.supply_houses
      const sh = Array.isArray(shNested) ? shNested[0] : shNested
      const invNum = inv.invoice_number?.trim() ?? ''
      const label = [sh?.name?.trim(), invNum ? `#${invNum}` : null].filter(Boolean).join(' · ') || 'Supply invoice'
      addLine(ymd, { source: 'supply', amountUsd: allocated, label, sortKey: `supply:${row.invoice_id}:${row.job_id}` })
    }
  } catch {
    /* empty */
  }

  try {
    // The RPC takes no filter args — page it (deterministic created_at ORDER
    // BY, the v2.1246 Review-tab pattern) and keep filtering client-side.
    const raw = await pagedRetry<TallyPoRow>(
      (from, to) => supabase.rpc('list_tally_parts_with_po').range(from, to),
      'overhead other jobs parts tally',
    )
    const rows = raw.filter((r) => !jobExcludedFromTally(r.job_id))
    for (const row of rows) {
      const created = row.created_at
      if (!created) continue
      const ymd = calendarYmdInAppTzFromIso(created)
      if (!ymd) continue
      const qty = Number(row.quantity)
      const hasPart = row.part_id != null && String(row.part_id).length > 0
      const lineTotal = !hasPart
        ? Number(row.fixture_cost ?? 0) * qty
        : Number(row.price_at_time ?? 0) * qty
      if (!Number.isFinite(lineTotal) || lineTotal <= 0) continue
      const fixture = row.fixture_name?.trim() ?? 'Fixture'
      const partName = row.part_name?.trim()
      const label = partName ? `${fixture} — ${partName}` : fixture
      addLine(ymd, { source: 'tally', amountUsd: lineTotal, label, sortKey: `tally:${row.id}` })
    }
  } catch {
    /* empty */
  }

  for (const [k, list] of partsDetailByDay) {
    list.sort((a, b) => {
      const sd = a.source.localeCompare(b.source)
      if (sd !== 0) return sd
      return a.sortKey.localeCompare(b.sortKey)
    })
    partsDetailByDay.set(k, list)
  }

  return { partsUsdByDay, partsDetailByDay }
}
