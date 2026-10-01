import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { arReturnsByPayer, type ArReturnedCheckPayerRow, type PayerReturns } from '../lib/jobs/arReturnedCheckPayers'

/**
 * The payer remembers a check that came back (v2.4328, punch list #76 PR 4): payer customer
 * id → how many of their checks the bank sent back in the last year, for the Billed row's
 * pay history. One read of `list_ar_returned_check_payers`, office roles only. Fail-soft:
 * before the migration is pushed (or on a refused read) it is null and the line says nothing.
 */
export function useArReturnedCheckPayers(enabled: boolean): Map<string, PayerReturns> | null {
  const [returnsByPayer, setReturnsByPayer] = useState<Map<string, PayerReturns> | null>(null)
  useEffect(() => {
    if (!enabled) {
      setReturnsByPayer(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const { data, error } = await supabase.rpc('list_ar_returned_check_payers' as never, { p_since_days: 365 } as never)
        if (!cancelled) setReturnsByPayer(error ? null : arReturnsByPayer((data ?? []) as unknown as ArReturnedCheckPayerRow[]))
      } catch {
        if (!cancelled) setReturnsByPayer(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled])
  return returnsByPayer
}
