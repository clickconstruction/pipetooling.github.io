/**
 * The company's bank transfer details for office surfaces (v2.3308) —
 * loaded on demand (`enabled`), fail-soft: a role the RLS refuses, or an
 * empty table, both read as "nothing to show" with the error kept for the
 * caller that wants to say so.
 */
import { useCallback, useEffect, useState } from 'react'
import { fetchCompanyBankTransferDetails } from '../lib/companyBankTransferDetails'
import { formatErrorMessage } from '../utils/errorHandling'
import type { BankTransferDetails } from '../lib/bankTransferDetails'

export type CompanyBankTransferDetailsState = {
  details: BankTransferDetails | null
  loading: boolean
  error: string | null
  reload: () => void
}

export function useCompanyBankTransferDetails(enabled: boolean): CompanyBankTransferDetailsState {
  const [details, setDetails] = useState<BankTransferDetails | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [gen, setGen] = useState(0)
  const reload = useCallback(() => setGen((g) => g + 1), [])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    setLoading(true)
    setError(null)
    void fetchCompanyBankTransferDetails()
      .then((d) => {
        if (!cancelled) setDetails(d)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(formatErrorMessage(e, 'Could not load the bank transfer details'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [enabled, gen])

  return { details, loading, error, reload }
}
