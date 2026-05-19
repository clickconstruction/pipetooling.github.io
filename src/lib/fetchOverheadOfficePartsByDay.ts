import { supabase } from './supabase'
import type { Database, Json } from '../types/database'
import { calendarYmdInAppTzFromIso } from '../utils/dateUtils'
import { withSupabaseRetry } from '../utils/errorHandling'
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
    const raw = await withSupabaseRetry(
      async () =>
        supabase
          .from('mercury_transaction_job_allocations')
          .select('id, amount, note, mercury_transaction_id, mercury_transactions(posted_at, counterparty_name, raw)')
          .eq('job_id', officeJobLedgerId)
          .order('created_at', { ascending: true }),
      'overhead office parts mercury',
    )
    for (const row of raw ?? []) {
      const txNested = row.mercury_transactions as
        | { posted_at: string | null; counterparty_name: string | null; raw: Json | null }
        | { posted_at: string | null; counterparty_name: string | null; raw: Json | null }[]
        | null
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
    const raw = await withSupabaseRetry(
      async () =>
        supabase
          .from('supply_house_invoice_job_allocations')
          .select('invoice_id, job_id, pct, supply_house_invoices(invoice_number, invoice_date, amount, supply_houses(name))')
          .eq('job_id', officeJobLedgerId),
      'overhead office parts supply',
    )
    for (const row of raw ?? []) {
      const invNested = row.supply_house_invoices as
        | {
            invoice_number: string
            invoice_date: string
            amount: string | number
            supply_houses?: { name: string } | { name: string }[] | null
          }
        | {
            invoice_number: string
            invoice_date: string
            amount: string | number
            supply_houses?: { name: string } | { name: string }[] | null
          }[]
        | null
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
    const raw = await withSupabaseRetry(
      () => supabase.rpc('list_tally_parts_with_po'),
      'overhead office parts tally',
    )
    type TallyPoRow = Database['public']['Functions']['list_tally_parts_with_po']['Returns'][number]
    const rows = ((raw ?? []) as TallyPoRow[]).filter((r) => r.job_id === officeJobLedgerId)
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
    const raw = await withSupabaseRetry(
      async () => {
        let q = supabase
          .from('mercury_transaction_job_allocations')
          .select('id, amount, note, mercury_transaction_id, mercury_transactions(posted_at, counterparty_name, raw)')
          .order('created_at', { ascending: true })
        if (officeJobLedgerId) q = q.neq('job_id', officeJobLedgerId)
        return q
      },
      'overhead other jobs parts mercury',
    )
    for (const row of raw ?? []) {
      const txNested = row.mercury_transactions as
        | { posted_at: string | null; counterparty_name: string | null; raw: Json | null }
        | { posted_at: string | null; counterparty_name: string | null; raw: Json | null }[]
        | null
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
    const raw = await withSupabaseRetry(
      async () => {
        let q = supabase
          .from('supply_house_invoice_job_allocations')
          .select('invoice_id, job_id, pct, supply_house_invoices(invoice_number, invoice_date, amount, supply_houses(name))')
        if (officeJobLedgerId) q = q.neq('job_id', officeJobLedgerId)
        return q
      },
      'overhead other jobs parts supply',
    )
    for (const row of raw ?? []) {
      const invNested = row.supply_house_invoices as
        | {
            invoice_number: string
            invoice_date: string
            amount: string | number
            supply_houses?: { name: string } | { name: string }[] | null
          }
        | {
            invoice_number: string
            invoice_date: string
            amount: string | number
            supply_houses?: { name: string } | { name: string }[] | null
          }[]
        | null
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
    const raw = await withSupabaseRetry(
      () => supabase.rpc('list_tally_parts_with_po'),
      'overhead other jobs parts tally',
    )
    type TallyPoRow = Database['public']['Functions']['list_tally_parts_with_po']['Returns'][number]
    const rows = ((raw ?? []) as TallyPoRow[]).filter((r) => !jobExcludedFromTally(r.job_id))
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
