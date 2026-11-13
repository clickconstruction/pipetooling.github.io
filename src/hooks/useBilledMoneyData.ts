import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { APP_CALENDAR_TZ } from '../utils/dateUtils'
import {
  parsePaySpeedsRpc,
  parsePromisedPayDatesRpc,
  type PaySpeedData,
  type PromisedPayDate,
} from '../lib/jobs/billedExpectedPay'
import { parseChaseTouchesRpc, type ChaseTouch } from '../lib/jobs/paymentChase'
import { openClaimByJob, type PaidClaim } from '../lib/jobs/paidClaims'
import { loadPaidClaims } from '../lib/jobs/paidClaimsIo'
import type { PaceFacts } from '../lib/jobs/payPace'
import { loadPaceFacts } from '../lib/jobs/payPaceIo'
import { indexPayCalendars, type PayCalendarIndex } from '../lib/jobs/payCalendar'
import { loadInvoiceAcceptances, loadPayCalendars } from '../lib/jobs/payCalendarIo'
import {
  buildCustomerPromiseRecords,
  classifyPromises,
  parsePromiseRecordsRpc,
  type CustomerPromiseRecord,
  promiseSlipByCustomer as promiseSlipByCustomerOf,
} from '../lib/jobs/paymentPromises'

export type BilledMoneyDataGates = {
  /** Pay speeds + promised dates (the expected-pay chip's inputs). */
  canSeeBilledExpectedPay: boolean
  /** Promise records + chase touches (the office's follow-up loop). */
  canMarkPromisedPay: boolean
}

export type BilledMoneyData = {
  billedPaySpeeds: PaySpeedData | null
  refreshBilledPaySpeeds: () => Promise<void>
  promisedPayDates: Record<string, PromisedPayDate> | null
  loadPromisedPayDates: () => Promise<void>
  /** The job's open paid claim (v2.6695, `list_paid_claims` → `openClaimByJob`): the Billed row's They say paid; null until read. Reloads with the promised dates. */
  paidClaimsByJob: Map<string, PaidClaim> | null
  promiseRecordsByCustomer: Map<string, CustomerPromiseRecord> | null
  loadPromiseRecords: () => Promise<void>
  promiseSlipByCustomer: Record<string, number> | null
  chaseTouches: ChaseTouch[] | null
  loadChaseTouches: () => Promise<void>
  /** Decision 1's facts (v2.6034): the customers that are GCs by record and the jobs with a live pay application; null until read. */
  paceFacts: PaceFacts | null
  /** The stored Pay calendars (punch list #323), keyed for `calendarFor`; null until read. A payer on one reads Due on its billed rows. */
  payCalendars: PayCalendarIndex | null
  loadPayCalendars: () => Promise<void>
  /** The day a payer accepted each bill that has one (PR 4), by the bill's id; null until read. A calendar counts its cutoff from it. */
  acceptedByInvoice: ReadonlyMap<string, string> | null
}

/**
 * The billed-money reads behind Stages' Billed Awaiting Payment money
 * (moved out of JobsStagesTab, punch list #46 row 2): customer pay speeds,
 * promised pay dates (and, since v2.6695, the open paid claims beside them),
 * the per-customer promise record, the chase call log
 * and, since v2.6034, the GC facts the pace rule reads (`loadPaceFacts`),
 * and the stored Pay calendars (`loadPayCalendars`, punch list #323).
 * Each loads at mount when its gate allows and exposes its reloader for the
 * windows that change it. All fail-soft — a glanceable extra never blocks
 * the page: an RPC error (including a not-yet-deployed function) leaves the
 * value where it was (null until a load succeeds).
 */
export function useBilledMoneyData({ canSeeBilledExpectedPay, canMarkPromisedPay }: BilledMoneyDataGates): BilledMoneyData {
  const [billedPaySpeeds, setBilledPaySpeeds] = useState<PaySpeedData | null>(null)
  // Extracted so the Data health drill-down can refresh medians right after
  // an exclusion toggles (v2.2290) — same fail-soft posture as the mount load.
  const refreshBilledPaySpeeds = useCallback(async () => {
    if (!canSeeBilledExpectedPay) return
    try {
      const { data } = await supabase.rpc('get_billed_customer_pay_speeds' as never)
      setBilledPaySpeeds(parsePaySpeedsRpc(data as unknown))
    } catch {
      // glanceable extra — never block the tab
    }
  }, [canSeeBilledExpectedPay])
  useEffect(() => {
    void refreshBilledPaySpeeds()
  }, [refreshBilledPaySpeeds])
  // Promised pay dates: real dates a customer named, marked by the office —
  // they override the statistical estimate (chip turns green, forecast
  // buckets by the promise). Same fail-soft posture as the pay-speed fetch.
  const [promisedPayDates, setPromisedPayDates] = useState<Record<string, PromisedPayDate> | null>(null)
  // The customer's word that they paid (v2.6695) rides the same reload: the Write down their word sheet
  // writes either kind and asks for the promised dates again when it closes.
  const [paidClaimsByJob, setPaidClaimsByJob] = useState<Map<string, PaidClaim> | null>(null)
  const loadPromisedPayDates = useCallback(async () => {
    if (!canSeeBilledExpectedPay) return
    try {
      const { data } = await supabase.rpc('list_job_promised_pay_dates' as never)
      setPromisedPayDates(parsePromisedPayDatesRpc(data as unknown))
    } catch {
      // glanceable extra — never block the tab
    }
    // Fail-soft on its own: a read that fails gives none, and the board keeps the rows it has.
    setPaidClaimsByJob(openClaimByJob(await loadPaidClaims(supabase)))
  }, [canSeeBilledExpectedPay])
  useEffect(() => {
    void loadPromisedPayDates()
  }, [loadPromisedPayDates])
  // Their Word PR 3: the per-customer promise record (keeps N of M · usual
  // slip) behind the reliability line and the forecast's slip adjustment.
  // Office roles only — primary sees the pay-speed spread, not the record.
  // Fail-soft like the rest: a not-yet-pushed RPC just leaves it off.
  const [promiseRecordsByCustomer, setPromiseRecordsByCustomer] = useState<Map<string, CustomerPromiseRecord> | null>(null)
  const loadPromiseRecords = useCallback(async () => {
    if (!canMarkPromisedPay) return
    try {
      const { data } = await supabase.rpc('list_payment_promise_records' as never)
      const records = parsePromiseRecordsRpc(data as unknown)
      if (!records) return
      const today = new Date().toLocaleDateString('en-CA', { timeZone: APP_CALENDAR_TZ })
      setPromiseRecordsByCustomer(buildCustomerPromiseRecords(classifyPromises(records, today)))
    } catch {
      // glanceable extra — never block the tab
    }
  }, [canMarkPromisedPay])
  useEffect(() => {
    void loadPromiseRecords()
  }, [loadPromiseRecords])
  const promiseSlipByCustomer = useMemo(() => promiseSlipByCustomerOf(promiseRecordsByCustomer), [promiseRecordsByCustomer])
  // Payment chase loop (v2.2025): the call log behind the follow-up queue.
  // Office-only (the marking roles); fail-soft like promises/pay-speeds — a
  // not-yet-deployed RPC just leaves the chase card hidden.
  const [chaseTouches, setChaseTouches] = useState<ChaseTouch[] | null>(null)
  const loadChaseTouches = useCallback(async () => {
    if (!canMarkPromisedPay) return
    try {
      const { data } = await supabase.rpc('list_payment_chase_touches' as never)
      setChaseTouches(parseChaseTouchesRpc(data as unknown))
    } catch {
      // glanceable extra — never block the tab
    }
  }, [canMarkPromisedPay])
  useEffect(() => {
    void loadChaseTouches()
  }, [loadChaseTouches])
  // The GC facts (v2.6034): which customers some job names as its GC and which
  // jobs carry a live pay application, so a first-job GC's chip reads the GC
  // pace here, not the company's. Fail-soft: without them every payer reads
  // as one that is not a GC.
  const [paceFacts, setPaceFacts] = useState<PaceFacts | null>(null)
  useEffect(() => {
    if (!canSeeBilledExpectedPay) return
    let cancelled = false
    void (async () => {
      try {
        const facts = await loadPaceFacts(supabase)
        if (!cancelled) setPaceFacts(facts)
      } catch {
        // glanceable extra — never block the tab
      }
    })()
    return () => {
      cancelled = true
    }
  }, [canSeeBilledExpectedPay])

  // The Pay calendars (punch list #323): a payer who pays on a set day of the month reads Due on its rows. Fail-soft:
  // a read that fails, or a table not pushed yet, leaves every row on the pace guess.
  const [payCalendars, setPayCalendars] = useState<PayCalendarIndex | null>(null)
  const [acceptedByInvoice, setAcceptedByInvoice] = useState<ReadonlyMap<string, string> | null>(null)
  const reloadPayCalendars = useCallback(async () => {
    if (!canSeeBilledExpectedPay) return
    try {
      setPayCalendars(indexPayCalendars(await loadPayCalendars(supabase)))
    } catch {
      // glanceable extra — never block the tab
    }
    // The accepted days ride the same reload: the window that sets one asks for the calendars again when it closes.
    try {
      setAcceptedByInvoice(await loadInvoiceAcceptances(supabase))
    } catch {
      // glanceable extra — every bill then counts from the day it went in
    }
  }, [canSeeBilledExpectedPay])
  useEffect(() => {
    void reloadPayCalendars()
  }, [reloadPayCalendars])

  return {
    billedPaySpeeds,
    refreshBilledPaySpeeds,
    promisedPayDates,
    loadPromisedPayDates,
    paidClaimsByJob,
    promiseRecordsByCustomer,
    loadPromiseRecords,
    promiseSlipByCustomer,
    chaseTouches,
    loadChaseTouches,
    paceFacts,
    payCalendars,
    loadPayCalendars: reloadPayCalendars,
    acceptedByInvoice,
  }
}
