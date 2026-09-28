import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { supabase } from '../lib/supabase'
import { todayYmdInAppTz } from '../utils/dateUtils'
import type { PayConfigRow } from '../types/peoplePayConfig'
import { fetchSalariedPayrollWindows, type SalariedPayrollWindow } from '../lib/salariedPayrollDays'
import { scanWeeksBefore, unreportedPayrollWeeks, type UnreportedWeekRow } from '../lib/unreportedPayrollWeeks'
import { scanWeeksRange, unreportedRowsStillMissing, type PayReportPeriodStub } from '../lib/pay/missingPayReports'

type HoursRow = { person_name: string; work_date: string; hours: number }

export type UsePayrollCatchUpInput = {
  /** Draft Payroll is open and the viewer has pay access — the scan runs only then. */
  enabled: boolean
  canAccessPay: boolean
  /** The pay period's first day; the scan covers the weeks before the one it falls in. */
  periodStart: string
  payConfig: Record<string, PayConfigRow>
  /** The pay roster, in display order. */
  peopleNames: string[]
  payStubs: PayReportPeriodStub[]
  /** Makes one person's report for a week without opening its preview. */
  generateReport: (personName: string, weekStart: string, weekEnd: string) => Promise<unknown>
  setError: (value: string | null) => void
}

export type PayrollCatchUpApi = {
  catchUpModalOpen: boolean
  setCatchUpModalOpen: Dispatch<SetStateAction<boolean>>
  catchUpRows: UnreportedWeekRow[] | null
  catchUpLoading: boolean
  catchUpScanFrom: string | null
  catchUpGeneratingKey: string | null
  /** Rows still lacking a report right now — the entry button's count; `null` until a scan has run. */
  catchUpUnreportedCount: number | null
  /** Looks eight more weeks back. */
  extendCatchUpScan: () => void
  loadUnreportedWeeksForPerson: (personName: string) => Promise<UnreportedWeekRow[]>
  generateCatchUpReport: (row: UnreportedWeekRow) => Promise<void>
}

/**
 * Payroll catch-up (v2.2034): earlier weeks with hours but no report. The Earlier-weeks window
 * scans every person over the weeks before the pay period; Balances asks for one person over
 * the last 13 completed weeks. Both use the `unreportedPayrollWeeks` kernel.
 */
export function usePayrollCatchUp({ enabled, canAccessPay, periodStart, payConfig, peopleNames, payStubs, generateReport, setError }: UsePayrollCatchUpInput): PayrollCatchUpApi {
  const [catchUpModalOpen, setCatchUpModalOpen] = useState(false)
  const [catchUpWeeksBack, setCatchUpWeeksBack] = useState(8)
  const [catchUpRows, setCatchUpRows] = useState<UnreportedWeekRow[] | null>(null)
  const [catchUpLoading, setCatchUpLoading] = useState(false)
  const [catchUpScanFrom, setCatchUpScanFrom] = useState<string | null>(null)
  const [catchUpGeneratingKey, setCatchUpGeneratingKey] = useState<string | null>(null)
  // Stubs via a ref so generating a report doesn't re-run the scan (a fresh
  // row flips to View/Record payment instead of vanishing mid-session).
  const catchUpStubsRef = useRef(payStubs)
  catchUpStubsRef.current = payStubs
  // The scan reads the roster and the pay config of the render it starts in, and does not
  // re-run when they change — only when the window, the period or the look-back does.
  const payConfigRef = useRef(payConfig)
  payConfigRef.current = payConfig
  const peopleNamesRef = useRef(peopleNames)
  peopleNamesRef.current = peopleNames

  useEffect(() => {
    if (!enabled) {
      setCatchUpModalOpen(false)
      setCatchUpRows(null)
      setCatchUpWeeksBack(8)
      return
    }
    const weeks = scanWeeksBefore(periodStart, catchUpWeeksBack)
    const range = scanWeeksRange(weeks)
    if (!range) {
      setCatchUpRows([])
      setCatchUpScanFrom(null)
      return
    }
    const { scanStart, scanEnd } = range
    const scanPayConfig = payConfigRef.current
    const scanPeople = peopleNamesRef.current
    let cancelled = false
    setCatchUpLoading(true)
    void (async () => {
      try {
        const salariedNames = Object.keys(scanPayConfig).filter((n) => scanPayConfig[n]?.is_salary)
        const [{ data: hoursData }, windows] = await Promise.all([
          supabase
            .from('people_hours')
            .select('person_name, work_date, hours')
            .gte('work_date', scanStart)
            .lte('work_date', scanEnd),
          salariedNames.length > 0
            ? fetchSalariedPayrollWindows(supabase, salariedNames, scanStart, scanEnd)
            : Promise.resolve({} as Record<string, SalariedPayrollWindow>),
        ])
        if (cancelled) return
        setCatchUpRows(
          unreportedPayrollWeeks({
            weeks,
            peopleNames: scanPeople,
            hoursRows: (hoursData ?? []) as HoursRow[],
            payConfig: scanPayConfig,
            salaryWindows: windows,
            stubs: catchUpStubsRef.current,
          }),
        )
        setCatchUpScanFrom(scanStart)
      } finally {
        if (!cancelled) setCatchUpLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled, periodStart, catchUpWeeksBack])

  const catchUpUnreportedCount = catchUpRows == null ? null : unreportedRowsStillMissing(catchUpRows, payStubs).length

  /**
   * Balances → "Hours with no report yet" (v2.3689): the catch-up scan for one
   * person over the 13 completed weeks before this one (the week in progress is
   * left out — a salaried credit for days not yet worked is not owed). Same
   * kernel and the same stub-overlap rule as the Earlier-weeks modal.
   */
  const loadUnreportedWeeksForPerson = useCallback(
    async (personName: string): Promise<UnreportedWeekRow[]> => {
      if (!canAccessPay) return []
      const weeks = scanWeeksBefore(todayYmdInAppTz(), 13)
      const range = scanWeeksRange(weeks)
      if (!range) return []
      const { scanStart, scanEnd } = range
      const cfg = payConfig[personName]
      const [{ data: hoursData, error }, windows] = await Promise.all([
        supabase.from('people_hours').select('person_name, work_date, hours').eq('person_name', personName).gte('work_date', scanStart).lte('work_date', scanEnd),
        cfg?.is_salary ? fetchSalariedPayrollWindows(supabase, [personName], scanStart, scanEnd) : Promise.resolve({} as Record<string, SalariedPayrollWindow>),
      ])
      if (error) throw new Error(error.message)
      return unreportedPayrollWeeks({
        weeks,
        peopleNames: [personName],
        hoursRows: (hoursData ?? []) as HoursRow[],
        payConfig,
        salaryWindows: windows,
        stubs: catchUpStubsRef.current,
      })
    },
    [canAccessPay, payConfig],
  )

  async function generateCatchUpReport(row: UnreportedWeekRow) {
    setCatchUpGeneratingKey(`${row.personName}:${row.weekStart}`)
    setError(null)
    try {
      await generateReport(row.personName, row.weekStart, row.weekEnd)
    } finally {
      setCatchUpGeneratingKey(null)
    }
  }

  return {
    catchUpModalOpen,
    setCatchUpModalOpen,
    catchUpRows,
    catchUpLoading,
    catchUpScanFrom,
    catchUpGeneratingKey,
    catchUpUnreportedCount,
    extendCatchUpScan: () => setCatchUpWeeksBack((n) => n + 8),
    loadUnreportedWeeksForPerson,
    generateCatchUpReport,
  }
}
