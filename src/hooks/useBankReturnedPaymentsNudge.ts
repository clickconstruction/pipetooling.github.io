import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  summarizeBankReturnedPayments,
  type BankReturnedJobRow,
  type BankReturnedPaymentRow,
  type BankReturnedPayments,
  type BankReturnedTxRow,
} from '../lib/jobs/bankReturnedDeposits'

/**
 * The Dashboard's "N deposits the bank returned are still counted as paid"
 * (v2.3795): recorded payments whose Mercury deposit posted and then went
 * `failed` (a bounced check). Two small reads — the handful of failed
 * money-in deposits with a posting date, then the ledger payments linked to
 * them — joined by the kernel. Nothing is written: Edit Job's Unlink and
 * remove (v2.3784) is the button, and it marks the deposit returned itself.
 * RLS scopes `mercury_transactions` to dev / master / assistant-like; a
 * role that cannot read it gets no card.
 */
export function useBankReturnedPaymentsNudge(enabled: boolean): { returned: BankReturnedPayments | null; reload: () => void } {
  const [returned, setReturned] = useState<BankReturnedPayments | null>(null)
  const [nonce, setNonce] = useState(0)

  const load = useCallback(async () => {
    if (!enabled) {
      setReturned(null)
      return
    }
    try {
      const { data: txRows, error: txError } = await supabase
        .from('mercury_transactions')
        .select('id, status, posted_at, amount, failure_reason:raw->>reasonForFailure')
        .eq('status', 'failed')
        .gt('amount', 0)
        .not('posted_at', 'is', null)
        .limit(200)
      if (txError) throw txError
      const txById = new Map<string, BankReturnedTxRow>()
      for (const t of (txRows ?? []) as unknown as BankReturnedTxRow[]) txById.set(t.id, t)
      if (txById.size === 0) {
        setReturned(summarizeBankReturnedPayments([], txById, new Map()))
        return
      }
      const { data: payRows, error: payError } = await supabase
        .from('jobs_ledger_payments')
        .select('id, job_id, amount, mercury_transaction_id')
        .in('mercury_transaction_id', [...txById.keys()])
      if (payError) throw payError
      const payments = (payRows ?? []) as BankReturnedPaymentRow[]
      const jobsById = new Map<string, BankReturnedJobRow>()
      const jobIds = [...new Set(payments.map((p) => p.job_id))]
      if (jobIds.length > 0) {
        const { data: jobRows, error: jobError } = await supabase
          .from('jobs_ledger')
          .select('id, hcp_number, job_name, customer_name')
          .in('id', jobIds)
        if (jobError) throw jobError
        for (const j of (jobRows ?? []) as BankReturnedJobRow[]) jobsById.set(j.id, j)
      }
      setReturned(summarizeBankReturnedPayments(payments, txById, jobsById))
    } catch {
      setReturned(null)
    }
  }, [enabled])

  useEffect(() => {
    void load()
  }, [load, nonce])

  return { returned, reload: () => setNonce((n) => n + 1) }
}
