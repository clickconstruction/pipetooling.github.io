import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { isAssistantLike } from '../lib/subcontractorLikeRole'
import { calendarYmdInAppTzFromIso } from '../utils/dateUtils'
import { parsePaySpeedsRpc, parsePromisedPayDatesRpc, type PaySpeedData, type PromisedPayDate } from '../lib/jobs/billedExpectedPay'
import { billedPayModel, type BilledPayModel } from '../lib/jobs/billedDuePay'
import { calendarFor, indexPayCalendars, type PayCalendarIndex } from '../lib/jobs/payCalendar'
import { loadInvoiceAcceptances, loadPayCalendars } from '../lib/jobs/payCalendarIo'
import { effectiveInvoiceEstBillDate } from '../lib/jobs/invoiceBilling'
import type { JobsLedgerInvoiceRow } from '../lib/jobs/jobFormTypes'
import { paySpeedPayer, type PayerNamedJob } from '../lib/jobs/billToParty'

/** Who may see the expected-pay math — the same gate as the Stages card chip. */
export function canSeeBilledExpectedPay(role: string | null | undefined): boolean {
  return role === 'dev' || role === 'master_technician' || isAssistantLike(role) || role === 'primary'
}

/**
 * The Stages card's expected-pay model, for one job's bills inside the Job
 * window (v2.3478). Loads the company pay speeds and the promised dates once
 * per mount, fail-soft (a glanceable extra — never blocks the tab), and
 * returns a resolver the Invoices list calls per open bill. It reads no GC
 * facts (v2.6034): a payer with no history reads its segment's pace here,
 * the GC pace only on the Stages board and the Bridge, whose loaders have
 * the facts. A payer on a Pay calendar reads its due day here as on the
 * board (punch list #323): the calendars and the accepted days load beside
 * the pay speeds, fail-soft.
 */
export function useJobBilledExpectedPay(job: { id: string } & PayerNamedJob): (inv: JobsLedgerInvoiceRow) => BilledPayModel | null {
  const { role } = useAuth()
  const allowed = canSeeBilledExpectedPay(role)
  const [paySpeeds, setPaySpeeds] = useState<PaySpeedData | null>(null)
  const [promises, setPromises] = useState<Record<string, PromisedPayDate> | null>(null)
  const [calendars, setCalendars] = useState<PayCalendarIndex | null>(null)
  const [accepted, setAccepted] = useState<ReadonlyMap<string, string> | null>(null)

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
      // The Pay calendars and the accepted days, each on its own: a read that fails leaves the bill on the pace guess.
      try {
        const rows = await loadPayCalendars(supabase)
        if (!cancelled) setCalendars(indexPayCalendars(rows))
      } catch {
        // glanceable extra
      }
      try {
        const days = await loadInvoiceAcceptances(supabase)
        if (!cancelled) setAccepted(days)
      } catch {
        // glanceable extra
      }
    })()
    return () => {
      cancelled = true
    }
  }, [allowed])

  // The payer fields, not the job object: the Invoices list passes a fresh literal each render.
  const { customer_id, gc_customer_id, bill_to_party, customer_name } = job
  const gcName = job.gcCustomer?.name ?? null
  const payerJob = useMemo<PayerNamedJob>(
    () => ({ customer_id, gc_customer_id, bill_to_party, customer_name, gcCustomer: { name: gcName } }),
    [customer_id, gc_customer_id, bill_to_party, customer_name, gcName],
  )

  return useCallback(
    (inv: JobsLedgerInvoiceRow) => {
      if (!allowed) return null
      // v2.4365: the bill's payer's pace (the GC on a GC-billed bill), as on the Pipeline row.
      const payer = paySpeedPayer(payerJob, inv)
      return billedPayModel(
        { billedAtIso: inv.billed_at, estBillYmd: effectiveInvoiceEstBillDate(inv), customerId: payer.id, payerName: payer.name, acceptedYmd: accepted?.get(inv.id) ?? null },
        paySpeeds,
        calendarYmdInAppTzFromIso(new Date().toISOString()),
        promises?.[job.id] ?? null,
        null,
        calendarFor(calendars, { payerId: payer.id, jobId: job.id }),
      )
    },
    [allowed, job.id, payerJob, paySpeeds, promises, calendars, accepted],
  )
}
