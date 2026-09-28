import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { PayConfigRow } from '../types/peoplePayConfig'
import { bucketSessionHoursByDay, shouldUseDualRate, type DayBucketHours, type RateSplitSessionRow } from '../lib/officeJobRateSplit'
import { draftPayrollPreviewDayCost } from '../lib/draftPayrollPreviewCost'
import { fetchOverheadOfficeJobLedgerIdFromAppSettings } from '../lib/overheadOfficeJobSettings'
import { fetchSalariedPayrollWindows, type SalariedPayrollWindow } from '../lib/salariedPayrollDays'
import { payrollEffectiveHours, uniqueUserIdByPayName } from '../lib/pay/payrollPreviewPricing'

export type UsePayrollPreviewPricingInput = {
  /** Draft Payroll is open and the viewer has pay access — nothing loads otherwise, and the last values stay. */
  enabled: boolean
  periodStart: string
  periodEnd: string
  payConfig: Record<string, PayConfigRow>
  users: ReadonlyArray<{ id: string; name: string | null }>
  /** The hours recorded for a person's day (the Hours grid's own read). */
  getHoursForPersonDate: (personName: string, workDate: string) => number
}

/**
 * What the Draft Payroll preview pays, priced the way the report's generator does: salaried
 * hours less unpaid time off and the employment window, and office vs. field rates for the
 * dual-rate people with one login user. The cost views and grids keep the flat 8 / 0.
 */
export function usePayrollPreviewPricing({ enabled, periodStart, periodEnd, payConfig, users, getHoursForPersonDate }: UsePayrollPreviewPricingInput): {
  getPayrollEffectiveHours: (personName: string, workDate: string) => number
  getPayrollCostForPersonDate: (personName: string, workDate: string) => number
} {
  // Draft Payroll preview must match generatePayStub: salaried hours are the flat 8/0
  // adjusted for unpaid time off + employment window (cost matrix / grids stay flat 8/0).
  const [draftPayrollSalaryWindows, setDraftPayrollSalaryWindows] = useState<Record<string, SalariedPayrollWindow>>({})

  useEffect(() => {
    if (!enabled) return
    const salariedNames = Object.keys(payConfig).filter((n) => payConfig[n]?.is_salary)
    if (salariedNames.length === 0) {
      setDraftPayrollSalaryWindows({})
      return
    }
    let cancelled = false
    void fetchSalariedPayrollWindows(supabase, salariedNames, periodStart, periodEnd)
      .then((map) => {
        if (!cancelled) setDraftPayrollSalaryWindows(map)
      })
      .catch(() => {
        if (!cancelled) setDraftPayrollSalaryWindows({})
      })
    return () => {
      cancelled = true
    }
  }, [enabled, periodStart, periodEnd, payConfig])

  // Dual-rate preview parity (v2.1794): the Cash Due estimate must price office vs. field
  // hours like generatePayStub does. Session-derived office/job buckets load per period for
  // dual-rate people with a unique login user; everyone else keeps flat wage × hours (the
  // same fallback the generator applies when no unique user matches).
  const [draftPayrollRateBuckets, setDraftPayrollRateBuckets] = useState<Record<string, Map<string, DayBucketHours>>>({})

  useEffect(() => {
    if (!enabled) return
    const dualNames = Object.keys(payConfig).filter((n) => shouldUseDualRate(payConfig[n]))
    if (dualNames.length === 0) {
      setDraftPayrollRateBuckets({})
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const uidByName = uniqueUserIdByPayName(dualNames, users)
        if (uidByName.size === 0) {
          if (!cancelled) setDraftPayrollRateBuckets({})
          return
        }
        const officeJobId = await fetchOverheadOfficeJobLedgerIdFromAppSettings()
        const { data } = await supabase
          .from('clock_sessions')
          .select('user_id, work_date, job_ledger_id, bid_id, clocked_in_at, clocked_out_at, approved_at, rejected_at, revoked_at')
          .in('user_id', Array.from(uidByName.values()))
          .gte('work_date', periodStart)
          .lte('work_date', periodEnd)
          .is('rejected_at', null)
          .is('revoked_at', null)
          .not('approved_at', 'is', null)
        const rows = ((data ?? []) as Array<RateSplitSessionRow & { user_id: string }>)
        const next: Record<string, Map<string, DayBucketHours>> = {}
        for (const [name, uid] of uidByName) {
          next[name] = bucketSessionHoursByDay(
            rows.filter((r) => r.user_id === uid),
            officeJobId,
          )
        }
        if (!cancelled) setDraftPayrollRateBuckets(next)
      } catch {
        if (!cancelled) setDraftPayrollRateBuckets({})
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled, periodStart, periodEnd, payConfig, users])

  function getPayrollEffectiveHours(personName: string, workDate: string): number {
    return payrollEffectiveHours({
      isSalary: payConfig[personName]?.is_salary,
      personName,
      workDate,
      salaryWindows: draftPayrollSalaryWindows,
      recordedHours: () => getHoursForPersonDate(personName, workDate),
    })
  }

  function getPayrollCostForPersonDate(personName: string, workDate: string): number {
    return draftPayrollPreviewDayCost({
      cfg: payConfig[personName],
      hours: getPayrollEffectiveHours(personName, workDate),
      workDate,
      bucketsByDate: draftPayrollRateBuckets[personName],
    })
  }

  return { getPayrollEffectiveHours, getPayrollCostForPersonDate }
}
