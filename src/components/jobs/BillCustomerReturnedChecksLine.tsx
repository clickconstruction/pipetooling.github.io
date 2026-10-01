import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { arReturnsByPayer, payerReturnsWords, type ArReturnedCheckPayerRow, type PayerReturns } from '../../lib/jobs/arReturnedCheckPayers'
import { todayYmdInAppTz } from '../../utils/dateUtils'

/**
 * Bill Customer's line for a payer whose checks came back (v2.4333, punch list #76): the
 * same count the Billed row's pay history shows (`list_ar_returned_check_payers`, the one
 * who-pays rule), said where the next bill goes out — *2 checks came back · Apr. A card or a
 * bank transfer clears faster.* Never a gate on sending. Fail-soft: no line on a refused read.
 */
export function BillCustomerReturnedChecksLine({ payerCustomerId }: { payerCustomerId: string | null }) {
  const [returns, setReturns] = useState<PayerReturns | null>(null)
  useEffect(() => {
    setReturns(null)
    if (!payerCustomerId) return
    let cancelled = false
    void (async () => {
      try {
        const { data, error } = await supabase.rpc('list_ar_returned_check_payers' as never, { p_since_days: 365 } as never)
        if (cancelled || error) return
        setReturns(arReturnsByPayer((data ?? []) as unknown as ArReturnedCheckPayerRow[]).get(payerCustomerId) ?? null)
      } catch {
        // an extra — the bill goes out without it
      }
    })()
    return () => {
      cancelled = true
    }
  }, [payerCustomerId])
  const words = payerReturnsWords(returns, todayYmdInAppTz())
  if (!words) return null
  return (
    <div
      data-testid="bill-customer-returned-checks"
      style={{ marginTop: '0.6rem', padding: '0.5rem 0.7rem', border: '1px solid var(--border-amber)', background: 'var(--bg-amber-tint)', borderRadius: 8, fontSize: '0.8125rem', color: 'var(--text-amber-900)' }}
    >
      <strong>{words}.</strong> A card or a bank transfer clears faster.
    </div>
  )
}
