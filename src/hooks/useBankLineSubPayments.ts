/**
 * The Banking side of the sub payment match (punch list #347): what each bank line on screen says about subs.
 *
 * It reads the sub payments that moved money, the sheets they sit on and who each sheet pays, then hands the rows
 * on screen to the pure kernel (`bankLineSubPayments`). The matches and both presses are the Subs Ledger's own
 * hook (`useSubPaymentBank`), so the two sides write through one door: `match_sub_payment` and
 * `unmatch_sub_payment`, which tick and untick with the match.
 *
 * Sub payments are a few hundred rows, so they are read once when the table opens. Every read leans on the
 * caller's own access and fails soft: a login that cannot read the payments sees the bank as it always was.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchAllRows, SUPABASE_IN_CHUNK_SIZE } from '../lib/supabasePaging'
import { bankSideRead, bankSideSheets, type BankSideLine, type BankSideRead } from '../lib/subWorkOrders/bankLineSubPayments'
import type { BankRow } from '../lib/subWorkOrders/subPaymentBankMatch'
import { buildLedgerLines } from '../lib/subWorkOrders/subPaymentsLedger'
import type { LaborJobPayment, SubSendingResult } from '../types/laborJob'
import { useRosterSubKinds } from './useRosterSubKinds'
import { useSubPaymentBank } from './useSubPaymentBank'

type PaymentRow = LaborJobPayment & { job_id: string }

const chunks = <T,>(list: readonly T[]): T[][] => {
  const out: T[][] = []
  for (let i = 0; i < list.length; i += SUPABASE_IN_CHUNK_SIZE) out.push(list.slice(i, i + SUPABASE_IN_CHUNK_SIZE))
  return out
}

/** Every sub payment that moved money, with its sheet, its sending's number and the credit kept with it. */
async function readSubPayments(): Promise<BankSideRead> {
  const rows = await fetchAllRows<Omit<PaymentRow, 'sending_no' | 'credit_kept'>>(
    (from, to) =>
      supabase
        .from('people_labor_job_payments')
        .select('id, job_id, amount, memo, created_at, payment_date, method, method_ref, sending_id, checked_at, checked_by_name')
        .gt('amount', 0)
        .order('id')
        .range(from, to) as never,
    'read sub payments for the bank',
  )
  const sheetIds = [...new Set(rows.map((p) => p.job_id))]
  const sendingIds = [...new Set(rows.map((p) => p.sending_id ?? '').filter(Boolean))]
  const sheets: BankSideRead['sheets'][number][] = []
  const assigneesBySheetId = new Map<string, Array<{ personId: string; personName: string | null }>>()
  for (const ids of chunks(sheetIds)) {
    const [sheetRes, assigneeRes] = await Promise.all([
      supabase.from('people_labor_jobs').select('id, assigned_to_name, address, job_number, job_ledger_id').in('id', ids),
      supabase.from('people_labor_job_assignees').select('labor_job_id, person_id, people(name)').in('labor_job_id', ids),
    ])
    if (sheetRes.error) throw sheetRes.error
    sheets.push(...(sheetRes.data ?? []))
    // Fail soft, as the Pay view does: with no junction rows a sheet is named by what was typed on it.
    for (const a of (assigneeRes.data ?? []) as unknown as Array<{ labor_job_id: string; person_id: string; people: { name: string | null } | null }>) {
      const list = assigneesBySheetId.get(a.labor_job_id)
      const one = { personId: a.person_id, personName: a.people?.name ?? null }
      if (list) list.push(one)
      else assigneesBySheetId.set(a.labor_job_id, [one])
    }
  }
  const jobNamesById: Record<string, string> = {}
  for (const ids of chunks([...new Set(sheets.map((s) => s.job_ledger_id ?? '').filter(Boolean))])) {
    const { data } = await supabase.from('jobs_ledger').select('id, job_name').in('id', ids)
    for (const j of data ?? []) jobNamesById[j.id] = j.job_name ?? ''
  }
  const sendingNoById = new Map<string, number>()
  for (const ids of chunks(sendingIds)) {
    const { data } = await supabase.from('sub_payment_sendings').select('id, number').in('id', ids)
    for (const s of data ?? []) sendingNoById.set(s.id, Number(s.number))
  }
  // What a sending carried past what the sheets needed: it left the bank with the payment it is kept on.
  const creditKeptByPayment = new Map<string, number>()
  const credits = await supabase.from('sub_credit_entries').select('amount, payment_id').gt('amount', 0).not('payment_id', 'is', null)
  for (const c of credits.data ?? []) if (c.payment_id) creditKeptByPayment.set(c.payment_id, Number(c.amount) || 0)
  return {
    payments: rows.map((p) => ({ ...p, amount: Number(p.amount), sending_no: p.sending_id ? (sendingNoById.get(p.sending_id) ?? null) : null, credit_kept: creditKeptByPayment.get(p.id) ?? null })),
    sheets,
    jobNamesById,
    assigneesBySheetId,
  }
}

export type BankLineSubPayments = {
  /** What each bank row on screen says about subs. A row with nothing to say is not in the map. */
  byTx: ReadonlyMap<string, BankSideLine>
  /** Match a bank line to one payment. Every line of the payment's sending goes with it, and they are ticked. */
  match: (transactionId: string, paymentId: string) => Promise<SubSendingResult>
  /** Take a bank line back from the payments on it. Their ticks are cleared with the match. */
  undo: (paymentIds: readonly string[]) => Promise<SubSendingResult>
}

const NOTHING: ReadonlyMap<string, BankSideLine> = new Map()

export function useBankLineSubPayments(enabled: boolean, rows: readonly BankRow[]): BankLineSubPayments {
  const bank = useSubPaymentBank(enabled)
  const { roster } = useRosterSubKinds(enabled)
  const [read, setRead] = useState<BankSideRead | null>(null)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    readSubPayments().then(
      (next) => {
        if (!cancelled) setRead(next)
      },
      () => {
        // A refused read draws nothing: the bank stays as it was for a login that cannot see sub payments.
      },
    )
    return () => {
      cancelled = true
    }
  }, [enabled])

  const lines = useMemo(() => (read ? buildLedgerLines(bankSideSheets(read, roster)) : []), [read, roster])
  const byTx = useMemo(() => (enabled && (lines.length > 0 || bank.matchedByPayment.size > 0) ? bankSideRead(rows, lines, bank.matchedByPayment) : NOTHING), [enabled, rows, lines, bank.matchedByPayment])

  const { match: matchPayment, unmatch } = bank
  const match = useCallback((transactionId: string, paymentId: string) => matchPayment(paymentId, transactionId), [matchPayment])
  const undo = useCallback(
    async (paymentIds: readonly string[]): Promise<SubSendingResult> => {
      let last: SubSendingResult = { ok: true }
      for (const id of paymentIds) {
        last = await unmatch(id)
        if (!last.ok) return last
      }
      return last
    },
    [unmatch],
  )

  return { byTx, match, undo }
}
