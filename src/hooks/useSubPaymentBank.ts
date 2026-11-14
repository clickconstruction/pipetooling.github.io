/**
 * The bank side of the Subs Ledger (punch list #347, PR 5): which payments are matched to a Mercury line, the
 * outgoing bank lines read on demand, and the two presses that match and unmatch.
 *
 * Matches are read when the ledger opens: they are few, and a matched payment says so at a glance. The bank lines
 * themselves are read only when a person asks (*Find bank lines*), from just before the earliest payment shown,
 * since a year of the bank is thousands of rows. Both reads lean on the caller's own access: a login that cannot
 * read the bank gets no lines and is told so. The table and both functions come from migration 20261114040000,
 * and a refused read before it is pushed means nothing is matched yet.
 */
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchAllRows } from '../lib/supabasePaging'
import { bankLinesFromRows, type BankLine, type BankRow } from '../lib/subWorkOrders/subPaymentBankMatch'
import type { SubSendingResult } from '../types/laborJob'
import { formatErrorMessage } from '../utils/errorHandling'

const BANK_COLUMNS = 'id, amount, posted_at, created_at, counterparty_name, note, external_memo, status, duplicate_of_transaction_id'
/** A transaction is made a little before it posts: read this many days further back than the day asked for. */
const CREATED_BEFORE_POSTED_DAYS = 7
const BANK_READ_MAX_ROWS = 15000

const refusal = (err: { code?: string; message?: string }): SubSendingResult => ({ ok: false, missing: err.code === 'PGRST202', message: formatErrorMessage(err, 'That could not be saved.') })

export type SubPaymentBank = {
  /** Payment row → the bank line it is matched to. */
  matchedByPayment: ReadonlyMap<string, string>
  /** Every bank line this hook knows by id: the matched ones, and the ones read on demand. */
  bankById: ReadonlyMap<string, BankLine>
  /** The outgoing lines read on demand. Null until a person asks. */
  bank: readonly BankLine[] | null
  reading: boolean
  readBank: (fromYmd: string) => Promise<{ ok: true; count: number } | { ok: false; message: string }>
  match: (paymentId: string, transactionId: string) => Promise<SubSendingResult>
  unmatch: (paymentId: string) => Promise<SubSendingResult>
  reloadMatches: () => Promise<void>
}

export function useSubPaymentBank(enabled: boolean): SubPaymentBank {
  const [matchedByPayment, setMatchedByPayment] = useState<Map<string, string>>(new Map())
  const [bankById, setBankById] = useState<Map<string, BankLine>>(new Map())
  const [bank, setBank] = useState<BankLine[] | null>(null)
  const [reading, setReading] = useState(false)

  const reloadMatches = useCallback(async () => {
    const res = await supabase.from('sub_payment_bank_matches' as never).select('payment_id, mercury_transaction_id')
    const rows = ((res as { data: unknown[] | null }).data ?? []) as Array<{ payment_id: string; mercury_transaction_id: string }>
    setMatchedByPayment(new Map(rows.map((r) => [r.payment_id, r.mercury_transaction_id])))
    const ids = [...new Set(rows.map((r) => r.mercury_transaction_id))]
    if (ids.length === 0) return
    // The matched lines themselves, so a payment can say the day and the payee it left to. Fail soft: a login
    // that cannot read the bank still sees that the payment is matched.
    const found: BankRow[] = []
    for (let i = 0; i < ids.length; i += 200) {
      const page = await supabase.from('mercury_transactions').select(BANK_COLUMNS).in('id', ids.slice(i, i + 200))
      if (page.error) return
      found.push(...((page.data ?? []) as unknown as BankRow[]))
    }
    // A matched line is shown whatever its state has become since: read it without the outgoing filter's drops.
    setBankById((prev) => {
      const next = new Map(prev)
      for (const r of found) {
        const line = bankLinesFromRows([{ ...r, status: null, duplicate_of_transaction_id: null }])[0]
        if (line) next.set(line.id, line)
      }
      return next
    })
  }, [])

  useEffect(() => {
    if (enabled) void reloadMatches()
  }, [enabled, reloadMatches])

  const readBank = useCallback(async (fromYmd: string): Promise<{ ok: true; count: number } | { ok: false; message: string }> => {
    if (!fromYmd) return { ok: false, message: 'No payment in this period has a day to hold a bank line against.' }
    setReading(true)
    try {
      const low = new Date(Date.parse(`${fromYmd}T00:00:00Z`) - CREATED_BEFORE_POSTED_DAYS * 86_400_000).toISOString()
      const rows = await fetchAllRows<BankRow>(
        (from, to) => supabase.from('mercury_transactions').select(BANK_COLUMNS).lt('amount', 0).gte('created_at', low).order('id').range(from, to) as never,
        'read outgoing bank lines',
        undefined,
        { maxRows: BANK_READ_MAX_ROWS },
      )
      const lines = bankLinesFromRows(rows).filter((b) => !b.ymd || b.ymd >= fromYmd)
      setBank(lines)
      setBankById((prev) => {
        const next = new Map(prev)
        for (const b of lines) next.set(b.id, b)
        return next
      })
      return { ok: true, count: lines.length }
    } catch (e) {
      return { ok: false, message: formatErrorMessage(e, 'The bank lines could not be read.') }
    } finally {
      setReading(false)
    }
  }, [])

  const match = useCallback(
    async (paymentId: string, transactionId: string): Promise<SubSendingResult> => {
      const { error } = await supabase.rpc('match_sub_payment' as never, { p_payment_id: paymentId, p_transaction_id: transactionId } as never)
      if (error) return refusal(error)
      await reloadMatches()
      return { ok: true }
    },
    [reloadMatches],
  )

  const unmatch = useCallback(
    async (paymentId: string): Promise<SubSendingResult> => {
      const { error } = await supabase.rpc('unmatch_sub_payment' as never, { p_payment_id: paymentId } as never)
      if (error) return refusal(error)
      await reloadMatches()
      return { ok: true }
    },
    [reloadMatches],
  )

  return { matchedByPayment, bankById, bank, reading, readBank, match, unmatch, reloadMatches }
}
