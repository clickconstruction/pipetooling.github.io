import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatErrorMessage } from '../utils/errorHandling'
import { draftPayrollPeriodIsValid, fetchPendingApprovalCount } from '../lib/pay/draftPayrollPendingApprovals'

export type DraftPayrollPendingApprovals = {
  draftPayrollPendingApprovalCount: number | null
  draftPayrollPendingApprovalLoading: boolean
  draftPayrollPendingApprovalError: string | null
  /** Re-count for a period — the day editor's save and the clock-session realtime feed call it. */
  loadDraftPayrollPendingApprovals: (periodStart: string, periodEnd: string) => Promise<void>
}

/**
 * How many clock sessions in the pay period still wait for approval, for Draft Payroll's
 * header. Counts 80 ms after the window opens or the period moves; clears when it closes.
 * The newest request wins — a slower, older count never lands on top of it.
 */
export function useDraftPayrollPendingApprovals({
  draftOpen,
  canAccessPay,
  periodStart,
  periodEnd,
}: {
  draftOpen: boolean
  canAccessPay: boolean
  periodStart: string
  periodEnd: string
}): DraftPayrollPendingApprovals {
  const [draftPayrollPendingApprovalCount, setDraftPayrollPendingApprovalCount] = useState<number | null>(null)
  const [draftPayrollPendingApprovalLoading, setDraftPayrollPendingApprovalLoading] = useState(false)
  const [draftPayrollPendingApprovalError, setDraftPayrollPendingApprovalError] = useState<string | null>(null)
  const draftPayrollPendingFetchIdRef = useRef(0)

  const loadDraftPayrollPendingApprovals = useCallback(async (start: string, end: string) => {
    if (!canAccessPay || !draftPayrollPeriodIsValid(start, end)) return
    const fetchId = ++draftPayrollPendingFetchIdRef.current
    setDraftPayrollPendingApprovalLoading(true)
    setDraftPayrollPendingApprovalError(null)
    try {
      const count = await fetchPendingApprovalCount(supabase, start, end)
      if (fetchId !== draftPayrollPendingFetchIdRef.current) return
      setDraftPayrollPendingApprovalCount(count)
    } catch (e) {
      if (fetchId !== draftPayrollPendingFetchIdRef.current) return
      setDraftPayrollPendingApprovalError(formatErrorMessage(e, 'Could not load pending approvals'))
      setDraftPayrollPendingApprovalCount(null)
    } finally {
      if (fetchId === draftPayrollPendingFetchIdRef.current) {
        setDraftPayrollPendingApprovalLoading(false)
      }
    }
  }, [canAccessPay])

  useEffect(() => {
    if (!draftOpen || !canAccessPay) {
      if (!draftOpen) {
        setDraftPayrollPendingApprovalCount(null)
        setDraftPayrollPendingApprovalLoading(false)
        setDraftPayrollPendingApprovalError(null)
      }
      return
    }
    if (!draftPayrollPeriodIsValid(periodStart, periodEnd)) {
      setDraftPayrollPendingApprovalCount(null)
      setDraftPayrollPendingApprovalLoading(false)
      return
    }
    const t = setTimeout(() => {
      void loadDraftPayrollPendingApprovals(periodStart, periodEnd)
    }, 80)
    return () => clearTimeout(t)
  }, [draftOpen, canAccessPay, periodStart, periodEnd, loadDraftPayrollPendingApprovals])

  return { draftPayrollPendingApprovalCount, draftPayrollPendingApprovalLoading, draftPayrollPendingApprovalError, loadDraftPayrollPendingApprovals }
}
