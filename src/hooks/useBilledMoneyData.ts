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
  promiseRecordsByCustomer: Map<string, CustomerPromiseRecord> | null
  loadPromiseRecords: () => Promise<void>
  promiseSlipByCustomer: Record<string, number> | null
  chaseTouches: ChaseTouch[] | null
  loadChaseTouches: () => Promise<void>
}

/**
 * The four billed-money reads behind Stages' Billed Awaiting Payment money
 * (moved out of JobsStagesTab, punch list #46 row 2): customer pay speeds,
 * promised pay dates, the per-customer promise record and the chase call log.
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
  const loadPromisedPayDates = useCallback(async () => {
    if (!canSeeBilledExpectedPay) return
    try {
      const { data } = await supabase.rpc('list_job_promised_pay_dates' as never)
      setPromisedPayDates(parsePromisedPayDatesRpc(data as unknown))
    } catch {
      // glanceable extra — never block the tab
    }
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

  return {
    billedPaySpeeds,
    refreshBilledPaySpeeds,
    promisedPayDates,
    loadPromisedPayDates,
    promiseRecordsByCustomer,
    loadPromiseRecords,
    promiseSlipByCustomer,
    chaseTouches,
    loadChaseTouches,
  }
}
