import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { BANKING_SORTING_CONFIG_VERSION, resolveBankPaymentsSortingConfigForAr } from '../lib/bankingSortingConfig'
import { withSupabaseRetry } from '../utils/errorHandling'

export function canRoleUseArBankCount(role: string | null): boolean {
  return (
    role === 'dev' || role === 'master_technician' || role === 'assistant' || role === 'primary'
  )
}

/** Dashboard / Quickfill unallocated-deposits banner, `/accounts-receivable` — staff only; `primary` uses Jobs Stages modal + count via {@link canRoleUseArBankCount}. */
export function canRoleSeeArBankUnallocatedOrgNudge(role: string | null): boolean {
  return role === 'dev' || role === 'master_technician' || role === 'assistant'
}

/**
 * Count of Mercury transactions with allocatable AR balance (same filter as Jobs Accounts Receivable modal).
 * Pass `bankPaymentsModalOpen` only from Jobs so count refetches when the modal closes.
 */
export function useArBankUnallocatedCount(options: {
  enabled: boolean
  authUserId: string | undefined
  authRole: string | null
  /** When set, refetches when transitioning from open to closed (Jobs AR modal). */
  bankPaymentsModalOpen?: boolean
}): { count: number | null; refetch: () => Promise<void> } {
  const { enabled, authUserId, authRole, bankPaymentsModalOpen } = options
  const [count, setCount] = useState<number | null>(null)
  const prevModalOpen = useRef(false)

  const refetch = useCallback(async () => {
    if (!enabled || !authUserId || !canRoleUseArBankCount(authRole)) {
      setCount(null)
      return
    }
    try {
      const cfg = await resolveBankPaymentsSortingConfigForAr(authUserId)
      const p_filter = {
        v: BANKING_SORTING_CONFIG_VERSION,
        kinds: cfg.kinds,
        accountIds: cfg.accountIds,
        debitCardIds: cfg.debitCardIds,
        startDateYmd: cfg.startDateYmd,
        excludeCounterpartyContains: cfg.excludeCounterpartyContains,
        excludeNoteContains: cfg.excludeNoteContains,
      }
      const n = await withSupabaseRetry(
        async () =>
          supabase.rpc('count_mercury_transactions_for_bank_payments', {
            p_filter,
          }),
        'count_mercury_transactions_for_bank_payments',
      )
      setCount(typeof n === 'number' && Number.isFinite(n) ? n : 0)
    } catch {
      setCount(null)
    }
  }, [enabled, authUserId, authRole])

  useEffect(() => {
    if (!enabled) {
      setCount(null)
      return
    }
    void refetch()
  }, [enabled, authUserId, authRole, refetch])

  useEffect(() => {
    if (!enabled) return
    const onFocus = () => void refetch()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [enabled, refetch])

  useEffect(() => {
    if (bankPaymentsModalOpen === undefined) return
    if (!enabled) {
      prevModalOpen.current = bankPaymentsModalOpen
      return
    }
    if (prevModalOpen.current && !bankPaymentsModalOpen) {
      void refetch()
    }
    prevModalOpen.current = bankPaymentsModalOpen
  }, [bankPaymentsModalOpen, enabled, refetch])

  return { count, refetch }
}
