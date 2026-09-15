import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { isAssistantLike } from '../lib/subcontractorLikeRole'
import { calendarYmdInAppTzFromIso } from '../utils/dateUtils'
import {
  billedExpectedPayModel,
  parsePaySpeedsRpc,
  parsePromisedPayDatesRpc,
  type ExpectedPayModel,
  type PaySpeedData,
  type PromisedPayDate,
} from '../lib/jobs/billedExpectedPay'
import { effectiveInvoiceEstBillDate } from '../lib/jobs/invoiceBilling'
import type { JobsLedgerInvoiceRow } from '../lib/jobs/jobFormTypes'

/** Who may see the expected-pay math — the same gate as the Stages card chip. */
export function canSeeBilledExpectedPay(role: string | null | undefined): boolean {
  return role === 'dev' || role === 'master_technician' || isAssistantLike(role) || role === 'primary'
}

/**
 * The Stages card's expected-pay model, for one job's bills inside the Job
 * window (v2.3478). Loads the company pay speeds and the promised dates once
 * per mount, fail-soft (a glanceable extra — never blocks the tab), and
 * returns a resolver the Invoices list calls per open bill.
 */
export function useJobBilledExpectedPay(job: { id: string; customer_id: string | null }): (inv: JobsLedgerInvoiceRow) => ExpectedPayModel | null {
  const { role } = useAuth()
  const allowed = canSeeBilledExpectedPay(role)
  const [paySpeeds, setPaySpeeds] = useState<PaySpeedData | null>(null)
  const [promises, setPromises] = useState<Record<string, PromisedPayDate> | null>(null)

  useEffect(() => {
    if (!allowed) return
    let cancelled = false
    void (async () => {
      try {
        const [speeds, promised] = await Promise.all([
          supabase.rpc('get_billed_customer_pay_speeds' as never),
          supabase.rpc('list_job_promised_pay_dates' as never),
        ])
        if (cancelled) return
        setPaySpeeds(parsePaySpeedsRpc(speeds.data as unknown))
        setPromises(parsePromisedPayDatesRpc(promised.data as unknown))
      } catch {
        // glanceable extra — the row still reads without it
      }
    })()
    return () => {
      cancelled = true
    }
  }, [allowed])

  return useCallback(
    (inv: JobsLedgerInvoiceRow) => {
      if (!allowed) return null
      return billedExpectedPayModel(
        { billedAtIso: inv.billed_at, estBillYmd: effectiveInvoiceEstBillDate(inv), customerId: job.customer_id },
        paySpeeds,
        calendarYmdInAppTzFromIso(new Date().toISOString()),
        promises?.[job.id] ?? null,
      )
    },
    [allowed, job.id, job.customer_id, paySpeeds, promises],
  )
}
