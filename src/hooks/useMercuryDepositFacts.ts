import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { MercuryDepositFacts } from '../lib/jobs/billsAndPayments'

type Linked = { mercury_transaction_id: string | null }

/**
 * What the bank synced about the deposits behind a job's bank-linked payments
 * (v2.4288): the posting date (the one-tap check date), the payer the bank
 * named, the deposit kind, and the bank's verdict (a returned check syncs as
 * `failed` with the reason). One read per set of ids; fail-soft when the read
 * is refused — the lines then say "bank deposit" and no payer.
 */
export function useMercuryDepositFacts(payments: ReadonlyArray<Linked>): Record<string, MercuryDepositFacts> {
  const [facts, setFacts] = useState<Record<string, MercuryDepositFacts>>({})
  const idsKey = payments
    .map((r) => r.mercury_transaction_id)
    .filter((id): id is string => Boolean(id))
    .sort()
    .join(',')
  useEffect(() => {
    const ids = idsKey ? idsKey.split(',') : []
    if (ids.length === 0) {
      setFacts({})
      return
    }
    let cancelled = false
    void (async () => {
      const { data } = await supabase
        .from('mercury_transactions')
        .select('id, posted_at, status, kind, counterparty_name, failure_reason:raw->>reasonForFailure')
        .in('id', ids)
      if (cancelled || !data) return
      const next: Record<string, MercuryDepositFacts> = {}
      for (const t of data as unknown as Array<{ id: string; posted_at: string | null; status: string | null; kind: string | null; counterparty_name: string | null; failure_reason: string | null }>) {
        next[t.id] = {
          postedYmd: t.posted_at ? String(t.posted_at).slice(0, 10) : null,
          counterparty: t.counterparty_name ?? null,
          kind: t.kind ?? null,
          status: t.status ?? null,
          failureReason: t.failure_reason ?? null,
        }
      }
      setFacts(next)
    })()
    return () => {
      cancelled = true
    }
  }, [idsKey])
  return facts
}
