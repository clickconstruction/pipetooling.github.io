import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/format'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { APP_CALENDAR_TZ, calendarYmdInAppTzFromIso, referenceDateForWorkDateYmd, ymdAddDays } from '../../utils/dateUtils'
import { useToastContext } from '../../contexts/ToastContext'
import { useMercuryLedgerNicknames } from '../../hooks/useMercuryLedgerNicknames'
import { formatMercuryDebitCardIdCompact } from '../../lib/mercuryRawDebitCard'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import type { PayConfigRow } from '../../types/peoplePayConfig'
import {
  bucketOverheadPartsLinesByAccountingLabel,
  overheadPartsAccountingBucketFromDefaultKey,
  sumMaterialsTotalUsdExcludingInternalTransfer,
  type OverheadPartsAccountingBucketKey,
} from '../../lib/overheadPartsAccountingBuckets'
import {
  aggregateOtherJobsLaborByPerson,
  aggregateOverheadDetailByPerson,
  aggregateOverheadDetailByPersonTotalScope,
  buildOtherJobsLaborByDay,
  buildOverheadDailyLabor,
  buildOverheadWageLookup,
  filterOverheadDetailLines,
  mergeOverheadDayTableRows,
  overheadFactorTotalOverOtherJobs,
  type OverheadClockSessionRow,
  type OverheadDetailScope,
} from '../../lib/overheadDailyLabor'
import {
  fetchOtherJobsPartsByDay,
  fetchOverheadOfficePartsByDay,
  type OverheadPartsDetailLine,
} from '../../lib/fetchOverheadOfficePartsByDay'
import {
  deleteOverheadOfficeJobLedgerIdSetting,
  fetchOverheadOfficeJobLedgerIdFromAppSettings,
  upsertOverheadOfficeJobLedgerId,
} from '../../lib/overheadOfficeJobSettings'
import {
  readOverheadTableSimpleViewFromStorage,
  writeOverheadTableSimpleViewToStorage,
} from '../../lib/overheadTableViewStorage'

function formatOverheadTabWorkDateLabel(workDateYmd: string): string {
  const d = referenceDateForWorkDateYmd(workDateYmd)
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: APP_CALENDAR_TZ,
  }).format(d)
}

export type PeopleOverheadTabProps = {
  payConfig: Record<string, PayConfigRow>
  authUser: User | null
  setError: (msg: string) => void
  canAccessOverheadTab: boolean
  isDev: boolean
  loadPayConfig: () => Promise<void>
}

export default function PeopleOverheadTab({
  payConfig,
  authUser,
  canAccessOverheadTab,
  isDev,
  loadPayConfig,
}: PeopleOverheadTabProps) {
  const { showToast } = useToastContext()

  /**
   * Mercury debit-card nicknames used by the Overhead tab's Materials
   * drilldowns to display which card a Mercury allocation was purchased
   * on (e.g. "Mercury · Lowes — Robert's card · $123.45"). Gated on the
   * tab being active so we don't fetch nickname maps for users sitting
   * on other tabs. The hook itself is also role-gated internally and
   * returns empty maps for roles outside dev/master/assistant.
   */
  const { nicknameByDebitCard: overheadMercuryNicknameByDebitCard } = useMercuryLedgerNicknames({
    enabled: true,
  })

  const [overheadDateStart, setOverheadDateStart] = useState(() => {
    const d = new Date()
    const day = d.getDay()
    const start = new Date(d)
    start.setDate(d.getDate() - day)
    return start.toLocaleDateString('en-CA')
  })
  const [overheadDateEnd, setOverheadDateEnd] = useState(() => {
    const d = new Date()
    const day = d.getDay()
    const start = new Date(d)
    start.setDate(d.getDate() - day + 6)
    return start.toLocaleDateString('en-CA')
  })
  const [overheadOfficeJobLedgerId, setOverheadOfficeJobLedgerId] = useState<string | null>(null)
  const [overheadOfficeJobLabel, setOverheadOfficeJobLabel] = useState<{
    hcp_number: string | null
    job_name: string | null
  } | null>(null)
  const [overheadSettingsLoading, setOverheadSettingsLoading] = useState(false)
  const [overheadSessions, setOverheadSessions] = useState<OverheadClockSessionRow[]>([])
  const [overheadSessionsLoading, setOverheadSessionsLoading] = useState(false)
  const [overheadTableSimpleView, setOverheadTableSimpleView] = useState(() =>
    readOverheadTableSimpleViewFromStorage(),
  )
  const [overheadJobPickerOpen, setOverheadJobPickerOpen] = useState(false)
  const [overheadOfficeJobModalOpen, setOverheadOfficeJobModalOpen] = useState(false)
  const [overheadJobSearch, setOverheadJobSearch] = useState('')
  const [overheadJobResults, setOverheadJobResults] = useState<
    Array<{ id: string; hcp_number: string; click_number?: string; job_name: string; job_address: string }>
  >([])
  const [overheadJobSaving, setOverheadJobSaving] = useState(false)
  const [overheadOfficePartsUsdByDay, setOverheadOfficePartsUsdByDay] = useState<Map<string, number>>(() => new Map())
  const [overheadOfficePartsDetailByDay, setOverheadOfficePartsDetailByDay] = useState<
    Map<string, OverheadPartsDetailLine[]>
  >(() => new Map())
  const [overheadOfficePartsLoading, setOverheadOfficePartsLoading] = useState(false)
  const [overheadAvgDailyCost, setOverheadAvgDailyCost] = useState<{
    avg7: number | null
    avg30: number | null
    avg90: number | null
    per100_7: number | null
    per100_30: number | null
    per100_90: number | null
    loading: boolean
  }>({
    avg7: null,
    avg30: null,
    avg90: null,
    per100_7: null,
    per100_30: null,
    per100_90: null,
    loading: false,
  })
  const [overheadOtherJobsSessions, setOverheadOtherJobsSessions] = useState<OverheadClockSessionRow[]>([])
  const [overheadOtherJobsSessionsLoading, setOverheadOtherJobsSessionsLoading] = useState(false)
  const [overheadOtherJobsPartsUsdByDay, setOverheadOtherJobsPartsUsdByDay] = useState<Map<string, number>>(
    () => new Map(),
  )
  const [overheadOtherJobsPartsDetailByDay, setOverheadOtherJobsPartsDetailByDay] = useState<
    Map<string, OverheadPartsDetailLine[]>
  >(() => new Map())
  const [overheadOtherJobsPartsLoading, setOverheadOtherJobsPartsLoading] = useState(false)
  /**
   * Banking → Accounting drag-sort label bucket for each Mercury transaction
   * referenced by `overheadOtherJobsPartsDetailByDay` (i.e. every Mercury
   * line that surfaces in the Field Total ($) / Hours modal's Materials
   * (field / non-office jobs) dropdown for any day in the active window).
   *
   * Computed once per change to the per-day detail map, not per-modal-open,
   * so flipping between days inside the modal is instant. Tx ids that have
   * no assignment row are absent from the map; the renderer defaults those
   * to the `'other'` bucket via `bucketForOverheadPartsLine`.
   */
  const [overheadOtherJobsAccountingBucketByTxId, setOverheadOtherJobsAccountingBucketByTxId] = useState<
    Map<string, OverheadPartsAccountingBucketKey>
  >(() => new Map())
  const [overheadBreakdownModal, setOverheadBreakdownModal] = useState<null | { workDate: string; scope: OverheadDetailScope }>(
    null,
  )

  useEffect(() => {
    if (!canAccessOverheadTab) return
    let cancelled = false
    setOverheadSettingsLoading(true)
    void (async () => {
      try {
        const id = await fetchOverheadOfficeJobLedgerIdFromAppSettings()
        if (cancelled) return
        setOverheadOfficeJobLedgerId(id)
        if (id) {
          const jobRow = (await withSupabaseRetry(
            async () =>
              supabase.from('jobs_ledger').select('hcp_number, job_name').eq('id', id).maybeSingle(),
            'fetch overhead office job label',
          )) as { hcp_number: string | null; job_name: string | null } | null
          if (cancelled) return
          if (jobRow) {
            setOverheadOfficeJobLabel({
              hcp_number: jobRow.hcp_number ?? null,
              job_name: jobRow.job_name ?? null,
            })
          } else {
            setOverheadOfficeJobLabel(null)
          }
        } else {
          setOverheadOfficeJobLabel(null)
        }
      } catch {
        if (!cancelled) {
          setOverheadOfficeJobLedgerId(null)
          setOverheadOfficeJobLabel(null)
        }
      } finally {
        if (!cancelled) setOverheadSettingsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [canAccessOverheadTab, authUser?.id])

  useEffect(() => {
    if (!canAccessOverheadTab) return
    void loadPayConfig()
  }, [canAccessOverheadTab])

  useEffect(() => {
    if (!canAccessOverheadTab || !authUser?.id) return
    let cancelled = false
    setOverheadSessionsLoading(true)
    void (async () => {
      try {
        let q = supabase
          .from('clock_sessions')
          .select(
            'id, user_id, work_date, clocked_in_at, clocked_out_at, job_ledger_id, bid_id, approved_at, rejected_at, revoked_at, notes, users!clock_sessions_user_id_fkey(name)',
          )
          .gte('work_date', overheadDateStart)
          .lte('work_date', overheadDateEnd)
        if (overheadOfficeJobLedgerId) {
          q = q.or(`job_ledger_id.eq.${overheadOfficeJobLedgerId},bid_id.not.is.null`)
        } else {
          q = q.not('bid_id', 'is', null)
        }
        const data = await withSupabaseRetry(async () => q, 'load overhead clock sessions')
        if (cancelled) return
        setOverheadSessions((data ?? []) as OverheadClockSessionRow[])
      } catch {
        if (!cancelled) setOverheadSessions([])
      } finally {
        if (!cancelled) setOverheadSessionsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [
    canAccessOverheadTab,
    authUser?.id,
    overheadDateStart,
    overheadDateEnd,
    overheadOfficeJobLedgerId,
  ])

  useEffect(() => {
    if (!canAccessOverheadTab || !authUser?.id) return
    let cancelled = false
    setOverheadOtherJobsSessionsLoading(true)
    void (async () => {
      try {
        let q = supabase
          .from('clock_sessions')
          .select(
            'id, user_id, work_date, clocked_in_at, clocked_out_at, job_ledger_id, bid_id, approved_at, rejected_at, revoked_at, notes, users!clock_sessions_user_id_fkey(name)',
          )
          .gte('work_date', overheadDateStart)
          .lte('work_date', overheadDateEnd)
          .not('job_ledger_id', 'is', null)
        if (overheadOfficeJobLedgerId) {
          q = q.neq('job_ledger_id', overheadOfficeJobLedgerId)
        }
        const data = await withSupabaseRetry(async () => q, 'load overhead other jobs clock sessions')
        if (cancelled) return
        setOverheadOtherJobsSessions((data ?? []) as OverheadClockSessionRow[])
      } catch {
        if (!cancelled) setOverheadOtherJobsSessions([])
      } finally {
        if (!cancelled) setOverheadOtherJobsSessionsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [
    canAccessOverheadTab,
    authUser?.id,
    overheadDateStart,
    overheadDateEnd,
    overheadOfficeJobLedgerId,
  ])

  useEffect(() => {
    if (!canAccessOverheadTab || !authUser?.id) return
    if (!overheadOfficeJobLedgerId) {
      setOverheadOfficePartsUsdByDay(new Map())
      setOverheadOfficePartsDetailByDay(new Map())
      setOverheadOfficePartsLoading(false)
      return
    }
    let cancelled = false
    setOverheadOfficePartsLoading(true)
    void (async () => {
      try {
        const r = await fetchOverheadOfficePartsByDay({
          officeJobLedgerId: overheadOfficeJobLedgerId,
          startYmd: overheadDateStart,
          endYmd: overheadDateEnd,
        })
        if (cancelled) return
        setOverheadOfficePartsUsdByDay(r.partsUsdByDay)
        setOverheadOfficePartsDetailByDay(r.partsDetailByDay)
      } catch {
        if (!cancelled) {
          setOverheadOfficePartsUsdByDay(new Map())
          setOverheadOfficePartsDetailByDay(new Map())
        }
      } finally {
        if (!cancelled) setOverheadOfficePartsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [
    canAccessOverheadTab,
    authUser?.id,
    overheadOfficeJobLedgerId,
    overheadDateStart,
    overheadDateEnd,
  ])

  useEffect(() => {
    if (!canAccessOverheadTab || !authUser?.id) return
    let cancelled = false
    setOverheadOtherJobsPartsLoading(true)
    void (async () => {
      try {
        const r = await fetchOtherJobsPartsByDay({
          officeJobLedgerId: overheadOfficeJobLedgerId,
          startYmd: overheadDateStart,
          endYmd: overheadDateEnd,
        })
        if (cancelled) return
        setOverheadOtherJobsPartsUsdByDay(r.partsUsdByDay)
        setOverheadOtherJobsPartsDetailByDay(r.partsDetailByDay)
      } catch {
        if (!cancelled) {
          setOverheadOtherJobsPartsUsdByDay(new Map())
          setOverheadOtherJobsPartsDetailByDay(new Map())
        }
      } finally {
        if (!cancelled) setOverheadOtherJobsPartsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [
    canAccessOverheadTab,
    authUser?.id,
    overheadOfficeJobLedgerId,
    overheadDateStart,
    overheadDateEnd,
  ])

  /**
   * Resolve Banking → Accounting drag-sort label buckets for every
   * Mercury transaction that surfaces as a field/non-office-job Materials
   * line in the active overhead window. Runs whenever the per-day detail
   * map is rebuilt (date range change, office job change, parts refresh).
   *
   * Two-step query: first read the assignment rows for the visible tx ids,
   * then bulk-resolve label `default_key` for the assigned label ids. We
   * skip the second fetch when there are no assignments (no in-clause on
   * an empty array, no wasted RPC).
   */
  useEffect(() => {
    if (!canAccessOverheadTab || !authUser?.id) return
    const txIds: string[] = []
    for (const lines of overheadOtherJobsPartsDetailByDay.values()) {
      for (const ln of lines) {
        if (ln.source === 'mercury' && ln.mercuryTransactionId) {
          txIds.push(ln.mercuryTransactionId)
        }
      }
    }
    if (txIds.length === 0) {
      setOverheadOtherJobsAccountingBucketByTxId(new Map())
      return
    }
    const uniqueTxIds = Array.from(new Set(txIds))
    let cancelled = false
    void (async () => {
      try {
        const assignmentsRaw = await withSupabaseRetry(
          async () =>
            supabase
              .from('mercury_transaction_drag_sort_assignments')
              .select('mercury_transaction_id, label_id')
              .in('mercury_transaction_id', uniqueTxIds),
          'load overhead other jobs accounting assignments',
        )
        if (cancelled) return
        const assignments = (assignmentsRaw ?? []) as Array<{
          mercury_transaction_id: string
          label_id: string
        }>
        if (assignments.length === 0) {
          setOverheadOtherJobsAccountingBucketByTxId(new Map())
          return
        }
        const labelIds = Array.from(new Set(assignments.map((a) => a.label_id)))
        const labelsRaw = await withSupabaseRetry(
          async () =>
            supabase
              .from('mercury_drag_sort_labels')
              .select('id, default_key')
              .in('id', labelIds),
          'load overhead other jobs accounting labels',
        )
        if (cancelled) return
        const labels = (labelsRaw ?? []) as Array<{ id: string; default_key: string | null }>
        const defaultKeyByLabelId = new Map<string, string | null>()
        for (const l of labels) defaultKeyByLabelId.set(l.id, l.default_key ?? null)
        const next = new Map<string, OverheadPartsAccountingBucketKey>()
        for (const a of assignments) {
          const defaultKey = defaultKeyByLabelId.get(a.label_id) ?? null
          next.set(a.mercury_transaction_id, overheadPartsAccountingBucketFromDefaultKey(defaultKey))
        }
        setOverheadOtherJobsAccountingBucketByTxId(next)
      } catch {
        if (!cancelled) setOverheadOtherJobsAccountingBucketByTxId(new Map())
      }
    })()
    return () => {
      cancelled = true
    }
  }, [canAccessOverheadTab, authUser?.id, overheadOtherJobsPartsDetailByDay])

  useEffect(() => {
    if (!canAccessOverheadTab || !authUser?.id) return
    let cancelled = false
    setOverheadAvgDailyCost((prev) => ({ ...prev, loading: true }))
    void (async () => {
      try {
        const today = new Date().toLocaleDateString('en-CA')
        const start = ymdAddDays(today, -89)
        let q = supabase
          .from('clock_sessions')
          .select(
            'id, user_id, work_date, clocked_in_at, clocked_out_at, job_ledger_id, bid_id, approved_at, rejected_at, revoked_at, users!clock_sessions_user_id_fkey(name)',
          )
          .gte('work_date', start)
          .lte('work_date', today)
        if (overheadOfficeJobLedgerId) {
          q = q.or(`job_ledger_id.eq.${overheadOfficeJobLedgerId},bid_id.not.is.null`)
        } else {
          q = q.not('bid_id', 'is', null)
        }
        const sessionsRes = (await withSupabaseRetry(async () => q, 'load overhead 90d sessions')) as
          | OverheadClockSessionRow[]
          | null
        const sessions = (sessionsRes ?? []) as OverheadClockSessionRow[]
        let partsByDay: Map<string, number> = new Map()
        if (overheadOfficeJobLedgerId) {
          const r = await fetchOverheadOfficePartsByDay({
            officeJobLedgerId: overheadOfficeJobLedgerId,
            startYmd: start,
            endYmd: today,
          })
          partsByDay = r.partsUsdByDay
        }
        if (cancelled) return
        const wageMap = buildOverheadWageLookup(
          Object.values(payConfig).map((r) => ({
            person_name: r.person_name,
            hourly_wage: r.hourly_wage ?? null,
          })),
        )
        const labor = buildOverheadDailyLabor({
          sessions,
          officeJobLedgerId: overheadOfficeJobLedgerId,
          wageByNormalizedName: wageMap,
        })
        const merged = mergeOverheadDayTableRows(labor.byDay, partsByDay, new Map(), new Map(), new Map())
        const totalsByDay = new Map<string, number>()
        for (const row of merged) totalsByDay.set(row.work_date, row.totalUsd)
        const startIsoLow = `${start}T00:00:00-00:00`
        const endIsoHigh = `${ymdAddDays(today, 1)}T00:00:00-00:00`
        const invoiceRowsRes = await withSupabaseRetry(
          async () =>
            supabase
              .from('jobs_ledger_invoices')
              .select('amount, sent_to_customer_at')
              .gte('sent_to_customer_at', startIsoLow)
              .lt('sent_to_customer_at', endIsoHigh),
          'load overhead 90d revenue invoices',
        )
        const invoiceRows = (invoiceRowsRes ?? []) as Array<{
          amount: number | null
          sent_to_customer_at: string | null
        }>
        if (cancelled) return
        const revenueByDay = new Map<string, number>()
        for (const r of invoiceRows) {
          if (!r.sent_to_customer_at) continue
          const ymd = calendarYmdInAppTzFromIso(r.sent_to_customer_at)
          revenueByDay.set(ymd, (revenueByDay.get(ymd) ?? 0) + Number(r.amount ?? 0))
        }
        const sumWindow = (n: number) => {
          let cost = 0
          let revenue = 0
          for (let i = 0; i < n; i++) {
            const ymd = ymdAddDays(today, -i)
            cost += totalsByDay.get(ymd) ?? 0
            revenue += revenueByDay.get(ymd) ?? 0
          }
          return { avg: cost / n, per100: revenue > 0 ? (cost / revenue) * 100 : null }
        }
        const w7 = sumWindow(7)
        const w30 = sumWindow(30)
        const w90 = sumWindow(90)
        setOverheadAvgDailyCost({
          avg7: w7.avg,
          avg30: w30.avg,
          avg90: w90.avg,
          per100_7: w7.per100,
          per100_30: w30.per100,
          per100_90: w90.per100,
          loading: false,
        })
      } catch {
        if (!cancelled) {
          setOverheadAvgDailyCost({
            avg7: null,
            avg30: null,
            avg90: null,
            per100_7: null,
            per100_30: null,
            per100_90: null,
            loading: false,
          })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [canAccessOverheadTab, authUser?.id, overheadOfficeJobLedgerId, payConfig])

  useEffect(() => {
    if (!overheadJobPickerOpen) {
      setOverheadJobSearch('')
      setOverheadJobResults([])
      return
    }
    const t = setTimeout(() => {
      const q = overheadJobSearch.trim()
      if (!q) {
        setOverheadJobResults([])
        return
      }
      void supabase.rpc('search_jobs_ledger', { search_text: q }).then(({ data }) => {
        setOverheadJobResults(
          (data ?? []) as Array<{ id: string; hcp_number: string; click_number?: string; job_name: string; job_address: string }>,
        )
      })
    }, 300)
    return () => clearTimeout(t)
  }, [overheadJobSearch, overheadJobPickerOpen])

  const overheadLabor = useMemo(() => {
    const wageMap = buildOverheadWageLookup(
      Object.values(payConfig).map((r) => ({ person_name: r.person_name, hourly_wage: r.hourly_wage ?? null })),
    )
    return buildOverheadDailyLabor({
      sessions: overheadSessions,
      officeJobLedgerId: overheadOfficeJobLedgerId,
      wageByNormalizedName: wageMap,
    })
  }, [payConfig, overheadSessions, overheadOfficeJobLedgerId])

  const overheadOtherJobsLabor = useMemo(() => {
    const wageMap = buildOverheadWageLookup(
      Object.values(payConfig).map((r) => ({ person_name: r.person_name, hourly_wage: r.hourly_wage ?? null })),
    )
    return buildOtherJobsLaborByDay({
      sessions: overheadOtherJobsSessions,
      officeJobLedgerId: overheadOfficeJobLedgerId,
      wageByNormalizedName: wageMap,
    })
  }, [payConfig, overheadOtherJobsSessions, overheadOfficeJobLedgerId])

  const overheadMergedByDay = useMemo(
    () =>
      mergeOverheadDayTableRows(
        overheadLabor.byDay,
        overheadOfficePartsUsdByDay,
        overheadOtherJobsLabor.laborUsdByDay,
        overheadOtherJobsLabor.laborHoursByDay,
        overheadOtherJobsPartsUsdByDay,
      ),
    [
      overheadLabor.byDay,
      overheadOfficePartsUsdByDay,
      overheadOtherJobsLabor.laborUsdByDay,
      overheadOtherJobsLabor.laborHoursByDay,
      overheadOtherJobsPartsUsdByDay,
    ],
  )

  /**
   * Period totals across every visible row of the Overhead tab table.
   * Renders as a single bold `<tfoot>` row so the user can see the
   * range-wide sums without exporting / eyeballing daily columns. The
   * footer Overhead % is a period-aggregated ratio (sum office total
   * $ ÷ sum field total $) — not an average of daily percentages —
   * which is the weighted-correct way to express "what share of field
   * revenue went to overhead across the whole window."
   */
  const overheadTableTotals = useMemo(() => {
    let bidLaborUsd = 0
    let officeLaborUsd = 0
    let officePartsUsd = 0
    let totalUsd = 0
    let totalLaborHours = 0
    let otherJobsUsd = 0
    let otherJobsLaborHours = 0
    for (const row of overheadMergedByDay) {
      bidLaborUsd += row.bidLaborUsd
      officeLaborUsd += row.officeLaborUsd
      officePartsUsd += row.officePartsUsd
      totalUsd += row.totalUsd
      totalLaborHours += row.totalLaborHours
      otherJobsUsd += row.otherJobsUsd
      otherJobsLaborHours += row.otherJobsLaborHours
    }
    return {
      bidLaborUsd,
      officeLaborUsd,
      officePartsUsd,
      totalUsd,
      totalLaborHours,
      otherJobsUsd,
      otherJobsLaborHours,
    }
  }, [overheadMergedByDay])

  const overheadTableColCount = overheadTableSimpleView ? 4 : 7

  const overheadBreakdownModalModel = useMemo(() => {
    if (!overheadBreakdownModal) return null
    const { workDate, scope } = overheadBreakdownModal
    const dayLines = overheadLabor.detailByDay.get(workDate) ?? []
    const totalPartsUsd = overheadOfficePartsUsdByDay.get(workDate) ?? 0
    const sortedPartLines = [...(overheadOfficePartsDetailByDay.get(workDate) ?? [])].sort((a, b) =>
      `${a.source} ${a.sortKey}`.localeCompare(`${b.source} ${b.sortKey}`),
    )

    if (scope === 'officeParts') {
      return {
        workDate,
        scope,
        title: 'Office parts ($)',
        totalPartsUsd,
        sortedPartLines,
      } as const
    }

    if (scope === 'otherJobs') {
      const laborLines = overheadOtherJobsLabor.detailByDay.get(workDate) ?? []
      const totalLaborUsdOj = laborLines.reduce((s, l) => s + l.laborUsd, 0)
      const totalHoursOj = laborLines.reduce((s, l) => s + l.hours, 0)
      const sortedSessionsOj = [...laborLines].sort((a, b) =>
        `${a.userName} ${a.sessionId}`.localeCompare(`${b.userName} ${b.sessionId}`),
      )
      const sortedPartLinesOj = [...(overheadOtherJobsPartsDetailByDay.get(workDate) ?? [])].sort((a, b) =>
        `${a.source} ${a.sortKey}`.localeCompare(`${b.source} ${b.sortKey}`),
      )
      // Internal Transfers are not an expense. Recompute the Materials total
      // from bucketed sections so the modal header (and Combined) match the
      // breakdown shown below — even if legacy data has Internal-Transfer-
      // labeled splits feeding the upstream RPC total.
      const partsSectionsOj = bucketOverheadPartsLinesByAccountingLabel(
        sortedPartLinesOj,
        overheadOtherJobsAccountingBucketByTxId,
      )
      const totalPartsUsdOj = sumMaterialsTotalUsdExcludingInternalTransfer(partsSectionsOj)
      const internalTransferUsdOj =
        partsSectionsOj.find((s) => s.key === 'internal_transfer')?.totalUsd ?? 0
      const grandTotalUsdOj = totalLaborUsdOj + totalPartsUsdOj
      return {
        workDate,
        scope,
        title: 'Field Total ($) / Hours',
        totalHours: totalHoursOj,
        totalLaborUsd: totalLaborUsdOj,
        totalPartsUsd: totalPartsUsdOj,
        internalTransferUsd: internalTransferUsdOj,
        grandTotalUsd: grandTotalUsdOj,
        personRows: aggregateOtherJobsLaborByPerson(laborLines),
        sortedSessions: sortedSessionsOj,
        sortedPartLines: sortedPartLinesOj,
        partsSections: partsSectionsOj,
      } as const
    }

    const filtered = filterOverheadDetailLines(dayLines, scope)
    const totalHours = filtered.reduce((s, l) => s + l.hours, 0)
    const totalLaborUsd = filtered.reduce((s, l) => s + l.laborUsd, 0)
    const sortedSessions = [...filtered].sort((a, b) =>
      `${a.userName} ${a.sessionId}`.localeCompare(`${b.userName} ${b.sessionId}`),
    )

    if (scope === 'total') {
      const grandTotalUsd = totalLaborUsd + totalPartsUsd
      return {
        workDate,
        scope,
        title: 'Office total ($) / Hours',
        totalHours,
        totalLaborUsd,
        totalPartsUsd,
        grandTotalUsd,
        personTotal: aggregateOverheadDetailByPersonTotalScope(dayLines),
        sortedSessions,
        sortedPartLines,
      } as const
    }
    return {
      workDate,
      scope,
      title: scope === 'office' ? 'Office labor ($)' : 'Bid labor ($)',
      totalHours,
      totalLaborUsd,
      personRows: aggregateOverheadDetailByPerson(filtered),
      sortedSessions,
    } as const
  }, [
    overheadBreakdownModal,
    overheadLabor,
    overheadOfficePartsUsdByDay,
    overheadOfficePartsDetailByDay,
    overheadOtherJobsLabor,
    overheadOtherJobsPartsUsdByDay,
    overheadOtherJobsPartsDetailByDay,
    overheadOtherJobsAccountingBucketByTxId,
  ])

  const overheadValueCellButtonStyle: CSSProperties = {
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    color: 'var(--text-link)',
    textDecoration: 'underline',
    padding: 0,
    font: 'inherit',
    textAlign: 'center',
  }

  function shiftOverheadWeek(deltaWeeks: number) {
    const s = new Date(overheadDateStart + 'T12:00:00')
    const e = new Date(overheadDateEnd + 'T12:00:00')
    s.setDate(s.getDate() + deltaWeeks * 7)
    e.setDate(e.getDate() + deltaWeeks * 7)
    setOverheadDateStart(s.toLocaleDateString('en-CA'))
    setOverheadDateEnd(e.toLocaleDateString('en-CA'))
  }

  return (
    <div style={{ marginBottom: '2rem' }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem',
          marginBottom: '1rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'baseline',
            gap: '0.75rem 1.25rem',
            padding: '0.5rem 0.75rem',
            border: '1px solid var(--border)',
            borderRadius: 6,
            background: 'var(--bg-page)',
            fontSize: '0.875rem',
            flex: '1 1 auto',
          }}
          title="Trailing-window average overhead cost per calendar day. Recent days (last few) may underreport because clock sessions need approval before they count."
          aria-label="Average daily cost of overhead"
        >
          <strong style={{ color: 'var(--text-strong)' }}>Average daily cost of overhead</strong>
          {(() => {
            const fmt = (v: number | null) => {
              if (overheadAvgDailyCost.loading) return '…'
              if (v == null) return '—'
              return `$${Math.round(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
            }
            return (
              <>
                <span><span style={{ color: 'var(--text-muted)' }}>7-day:</span> {fmt(overheadAvgDailyCost.avg7)}</span>
                <span><span style={{ color: 'var(--text-muted)' }}>30-day:</span> {fmt(overheadAvgDailyCost.avg30)}</span>
                <span><span style={{ color: 'var(--text-muted)' }}>90-day:</span> {fmt(overheadAvgDailyCost.avg90)}</span>
              </>
            )
          })()}
        </div>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'baseline',
            gap: '0.75rem 1.25rem',
            padding: '0.5rem 0.75rem',
            border: '1px solid var(--border)',
            borderRadius: 6,
            background: 'var(--bg-page)',
            fontSize: '0.875rem',
            flex: '1 1 auto',
          }}
          title="For each window: total Office Total ($) divided by total revenue billed (jobs_ledger_invoices.amount with sent_to_customer_at in window), expressed as dollars of overhead per $100 of revenue. Returns — when revenue is $0 in the window."
          aria-label="Average overhead per $100 in revenue"
        >
          <strong style={{ color: 'var(--text-strong)' }}>Average overhead per $100 in revenue</strong>
          {(() => {
            const fmt = (v: number | null) => {
              if (overheadAvgDailyCost.loading) return '…'
              if (v == null) return '—'
              return `$${v.toFixed(2)}`
            }
            return (
              <>
                <span><span style={{ color: 'var(--text-muted)' }}>7-day:</span> {fmt(overheadAvgDailyCost.per100_7)}</span>
                <span><span style={{ color: 'var(--text-muted)' }}>30-day:</span> {fmt(overheadAvgDailyCost.per100_30)}</span>
                <span><span style={{ color: 'var(--text-muted)' }}>90-day:</span> {fmt(overheadAvgDailyCost.per100_90)}</span>
              </>
            )
          })()}
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '0.75rem',
          marginBottom: '1rem',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem', flex: '1 1 auto' }}>
        <button
          type="button"
          onClick={() => shiftOverheadWeek(-1)}
          style={{ padding: '0.35rem 0.65rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: 'pointer' }}
        >
          Previous week
        </button>
        <button
          type="button"
          onClick={() => shiftOverheadWeek(1)}
          style={{ padding: '0.35rem 0.65rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: 'pointer' }}
        >
          Next week
        </button>
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', alignSelf: 'center' }}>View:</span>
        <div style={{ display: 'inline-flex', alignItems: 'stretch' }}>
          <button
            type="button"
            aria-pressed={!overheadTableSimpleView}
            aria-label="Advanced table view: show Bid, Office labor, and Office parts columns"
            onClick={() => {
              setOverheadTableSimpleView(false)
              writeOverheadTableSimpleViewToStorage(false)
            }}
            style={{
              padding: '0.35rem 0.65rem',
              fontSize: '0.8125rem',
              border: '1px solid var(--border-strong)',
              borderRadius: '4px 0 0 4px',
              borderRight: 'none',
              background: !overheadTableSimpleView ? '#2563eb' : 'var(--surface)',
              color: !overheadTableSimpleView ? 'white' : 'var(--text-strong)',
              cursor: 'pointer',
              fontWeight: !overheadTableSimpleView ? 600 : 400,
            }}
          >
            Advanced
          </button>
          <button
            type="button"
            aria-pressed={overheadTableSimpleView}
            aria-label="Simple table view: hide labor and parts detail columns; totals unchanged"
            onClick={() => {
              setOverheadTableSimpleView(true)
              writeOverheadTableSimpleViewToStorage(true)
            }}
            style={{
              padding: '0.35rem 0.65rem',
              fontSize: '0.8125rem',
              border: '1px solid var(--border-strong)',
              borderRadius: '0 4px 4px 0',
              background: overheadTableSimpleView ? '#2563eb' : 'var(--surface)',
              color: overheadTableSimpleView ? 'white' : 'var(--text-strong)',
              cursor: 'pointer',
              fontWeight: overheadTableSimpleView ? 600 : 400,
            }}
          >
            Simple
          </button>
        </div>
        <label style={{ fontSize: '0.875rem' }}>
          <span style={{ marginRight: '0.35rem' }}>Start</span>
          <input
            type="date"
            value={overheadDateStart}
            onChange={(e) => setOverheadDateStart(e.target.value)}
            style={{ padding: '0.25rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
          />
        </label>
        <label style={{ fontSize: '0.875rem' }}>
          <span style={{ marginRight: '0.35rem' }}>End</span>
          <input
            type="date"
            value={overheadDateEnd}
            onChange={(e) => setOverheadDateEnd(e.target.value)}
            style={{ padding: '0.25rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
          />
        </label>
        </div>
        <button
          type="button"
          onClick={() => setOverheadOfficeJobModalOpen(true)}
          style={{
            marginLeft: 'auto',
            padding: '0.45rem 0.75rem',
            fontSize: '0.8125rem',
            fontWeight: 600,
            border: '1px solid var(--border-strong)',
            borderRadius: 6,
            background: 'var(--bg-page)',
            cursor: 'pointer',
            textAlign: 'left',
            maxWidth: 'min(100%, 280px)',
          }}
        >
          <span style={{ display: 'block' }}>Overhead office job</span>
          {overheadSettingsLoading ? (
            <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-muted)', marginTop: '0.15rem' }}>
              Loading…
            </span>
          ) : overheadOfficeJobLedgerId && overheadOfficeJobLabel ? (
            <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-600)', marginTop: '0.15rem' }}>
              {String(overheadOfficeJobLabel.hcp_number ?? '—')} — {overheadOfficeJobLabel.job_name ?? 'Job'}
            </span>
          ) : overheadOfficeJobLedgerId ? (
            <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-red-700)', marginTop: '0.15rem' }}>
              Saved job not found
            </span>
          ) : (
            <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-muted)', marginTop: '0.15rem' }}>
              Not configured
            </span>
          )}
        </button>
      </div>

      {overheadSessionsLoading ||
      overheadOfficePartsLoading ||
      overheadOtherJobsSessionsLoading ||
      overheadOtherJobsPartsLoading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading overhead (sessions, office materials, field totals)…</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', textAlign: 'center' }}>
            <thead>
              <tr style={{ background: 'var(--bg-muted)' }}>
                <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>Date</th>
                {!overheadTableSimpleView ? (
                  <>
                    <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>Bid labor ($)</th>
                    <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>Office labor ($)</th>
                    <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>Office parts ($)</th>
                  </>
                ) : null}
                {overheadTableSimpleView ? (
                  <>
                    <th
                      style={{
                        padding: '0.5rem',
                        borderBottom: '1px solid var(--border)',
                        borderLeft: '1px solid var(--border-strong)',
                      }}
                      title="Office Total ($) as a percentage of Field Total ($); — when field total is $0"
                    >
                      Overhead %
                    </th>
                    <th
                      style={{
                        padding: '0.5rem',
                        borderBottom: '1px solid var(--border)',
                        borderLeft: '1px solid var(--border-strong)',
                      }}
                    >
                      Office Total ($) / Hours
                    </th>
                    <th
                      style={{
                        padding: '0.5rem',
                        borderBottom: '1px solid var(--border)',
                        borderLeft: '1px solid var(--border-strong)',
                      }}
                    >
                      Field Total ($) / Hours
                    </th>
                  </>
                ) : (
                  <>
                    <th
                      style={{
                        padding: '0.5rem',
                        borderBottom: '1px solid var(--border)',
                      }}
                    >
                      Office Total ($) / Hours
                    </th>
                    <th
                      style={{
                        padding: '0.5rem',
                        borderBottom: '1px solid var(--border)',
                        borderLeft: '1px solid var(--border-strong)',
                      }}
                      title="Office Total ($) as a percentage of Field Total ($); — when field total is $0"
                    >
                      Overhead %
                    </th>
                    <th
                      style={{
                        padding: '0.5rem',
                        borderBottom: '1px solid var(--border)',
                        borderLeft: '1px solid var(--border-strong)',
                      }}
                    >
                      Field Total ($) / Hours
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {overheadMergedByDay.length === 0 ? (
                <tr>
                  <td colSpan={overheadTableColCount} style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>
                    No rows in this range (no qualifying overhead or field-total activity for these dates).
                  </td>
                </tr>
              ) : (
                overheadMergedByDay.map((row) => {
                  const overheadFactor = overheadFactorTotalOverOtherJobs(row.totalUsd, row.otherJobsUsd)
                  return (
                    <tr key={row.work_date}>
                        <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                          {formatOverheadTabWorkDateLabel(row.work_date)}
                        </td>
                        {!overheadTableSimpleView ? (
                          <>
                            <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                              <button
                                type="button"
                                aria-label={`Bid labor breakdown for ${row.work_date}`}
                                onClick={() => setOverheadBreakdownModal({ workDate: row.work_date, scope: 'bid' })}
                                style={overheadValueCellButtonStyle}
                              >
                                {formatCurrency(row.bidLaborUsd)}
                              </button>
                            </td>
                            <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                              <button
                                type="button"
                                aria-label={`Office labor breakdown for ${row.work_date}`}
                                onClick={() => setOverheadBreakdownModal({ workDate: row.work_date, scope: 'office' })}
                                style={overheadValueCellButtonStyle}
                              >
                                {formatCurrency(row.officeLaborUsd)}
                              </button>
                            </td>
                            <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                              <button
                                type="button"
                                aria-label={`Office parts breakdown for ${row.work_date}`}
                                onClick={() => setOverheadBreakdownModal({ workDate: row.work_date, scope: 'officeParts' })}
                                style={overheadValueCellButtonStyle}
                              >
                                {formatCurrency(row.officePartsUsd)}
                              </button>
                            </td>
                          </>
                        ) : null}
                        {overheadTableSimpleView ? (
                          <>
                            <td
                              style={{
                                padding: '0.5rem',
                                borderBottom: '1px solid var(--border)',
                                borderLeft: '1px solid var(--border-strong)',
                              }}
                              aria-label={
                                overheadFactor == null
                                  ? `Overhead % for ${row.work_date}: not available (field total dollars is zero)`
                                  : `Overhead % for ${row.work_date}: ${Math.round(overheadFactor * 100)} percent, office total divided by field total dollars`
                              }
                            >
                              {overheadFactor == null ? '—' : `${Math.round(overheadFactor * 100)}%`}
                            </td>
                            <td
                              style={{
                                padding: '0.5rem',
                                borderBottom: '1px solid var(--border)',
                                borderLeft: '1px solid var(--border-strong)',
                              }}
                            >
                              <button
                                type="button"
                                aria-label={`Office total for ${row.work_date}: ${formatCurrency(row.totalUsd)}, ${row.totalLaborHours.toFixed(2)} hours office and bid labor`}
                                onClick={() => setOverheadBreakdownModal({ workDate: row.work_date, scope: 'total' })}
                                style={{ ...overheadValueCellButtonStyle, fontWeight: 600 }}
                              >
                                {formatCurrency(row.totalUsd)}
                                <span style={{ fontWeight: 400 }}> · {row.totalLaborHours.toFixed(2)}h</span>
                              </button>
                            </td>
                            <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)', borderLeft: '1px solid var(--border-strong)' }}>
                              <button
                                type="button"
                                aria-label={`Field total for ${row.work_date}: ${formatCurrency(row.otherJobsUsd)}, ${row.otherJobsLaborHours.toFixed(2)} hours jobs-ledger labor`}
                                onClick={() => setOverheadBreakdownModal({ workDate: row.work_date, scope: 'otherJobs' })}
                                style={{ ...overheadValueCellButtonStyle, fontWeight: 600 }}
                              >
                                {formatCurrency(row.otherJobsUsd)}
                                <span style={{ fontWeight: 400 }}> · {row.otherJobsLaborHours.toFixed(2)}h</span>
                              </button>
                            </td>
                          </>
                        ) : (
                          <>
                            <td
                              style={{
                                padding: '0.5rem',
                                borderBottom: '1px solid var(--border)',
                              }}
                            >
                              <button
                                type="button"
                                aria-label={`Office total for ${row.work_date}: ${formatCurrency(row.totalUsd)}, ${row.totalLaborHours.toFixed(2)} hours office and bid labor`}
                                onClick={() => setOverheadBreakdownModal({ workDate: row.work_date, scope: 'total' })}
                                style={{ ...overheadValueCellButtonStyle, fontWeight: 600 }}
                              >
                                {formatCurrency(row.totalUsd)}
                                <span style={{ fontWeight: 400 }}> · {row.totalLaborHours.toFixed(2)}h</span>
                              </button>
                            </td>
                            <td
                              style={{
                                padding: '0.5rem',
                                borderBottom: '1px solid var(--border)',
                                borderLeft: '1px solid var(--border-strong)',
                              }}
                              aria-label={
                                overheadFactor == null
                                  ? `Overhead % for ${row.work_date}: not available (field total dollars is zero)`
                                  : `Overhead % for ${row.work_date}: ${Math.round(overheadFactor * 100)} percent, office total divided by field total dollars`
                              }
                            >
                              {overheadFactor == null ? '—' : `${Math.round(overheadFactor * 100)}%`}
                            </td>
                            <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)', borderLeft: '1px solid var(--border-strong)' }}>
                              <button
                                type="button"
                                aria-label={`Field total for ${row.work_date}: ${formatCurrency(row.otherJobsUsd)}, ${row.otherJobsLaborHours.toFixed(2)} hours jobs-ledger labor`}
                                onClick={() => setOverheadBreakdownModal({ workDate: row.work_date, scope: 'otherJobs' })}
                                style={{ ...overheadValueCellButtonStyle, fontWeight: 600 }}
                              >
                                {formatCurrency(row.otherJobsUsd)}
                                <span style={{ fontWeight: 400 }}> · {row.otherJobsLaborHours.toFixed(2)}h</span>
                              </button>
                            </td>
                          </>
                        )}
                      </tr>
                  )
                })
              )}
            </tbody>
            {overheadMergedByDay.length > 0 ? (
              (() => {
                // Period-aggregated Overhead % — sum of office totals
                // divided by sum of field totals across the visible
                // range. Re-uses the same helper that powers the per-
                // day cell so null-handling (field total = $0) stays
                // identical at the footer.
                const totalOverheadFactor = overheadFactorTotalOverOtherJobs(
                  overheadTableTotals.totalUsd,
                  overheadTableTotals.otherJobsUsd,
                )
                const footerCellBase = {
                  padding: '0.5rem',
                  borderTop: '2px solid var(--border-strong)',
                  background: 'var(--bg-subtle)',
                  fontWeight: 600,
                } as const
                return (
                  <tfoot>
                    <tr>
                      <td style={footerCellBase}>Total</td>
                      {!overheadTableSimpleView ? (
                        <>
                          <td style={footerCellBase}>
                            {formatCurrency(overheadTableTotals.bidLaborUsd)}
                          </td>
                          <td style={footerCellBase}>
                            {formatCurrency(overheadTableTotals.officeLaborUsd)}
                          </td>
                          <td style={footerCellBase}>
                            {formatCurrency(overheadTableTotals.officePartsUsd)}
                          </td>
                        </>
                      ) : null}
                      {overheadTableSimpleView ? (
                        <>
                          <td
                            style={{ ...footerCellBase, borderLeft: '1px solid var(--border-strong)' }}
                            aria-label={
                              totalOverheadFactor == null
                                ? 'Period total Overhead %: not available (field total dollars is zero)'
                                : `Period total Overhead %: ${Math.round(
                                    totalOverheadFactor * 100,
                                  )} percent, total office total divided by total field total dollars`
                            }
                          >
                            {totalOverheadFactor == null
                              ? '—'
                              : `${Math.round(totalOverheadFactor * 100)}%`}
                          </td>
                          <td style={{ ...footerCellBase, borderLeft: '1px solid var(--border-strong)' }}>
                            {formatCurrency(overheadTableTotals.totalUsd)}
                            <span style={{ fontWeight: 400 }}>
                              {' '}
                              · {overheadTableTotals.totalLaborHours.toFixed(2)}h
                            </span>
                          </td>
                          <td style={{ ...footerCellBase, borderLeft: '1px solid var(--border-strong)' }}>
                            {formatCurrency(overheadTableTotals.otherJobsUsd)}
                            <span style={{ fontWeight: 400 }}>
                              {' '}
                              · {overheadTableTotals.otherJobsLaborHours.toFixed(2)}h
                            </span>
                          </td>
                        </>
                      ) : (
                        <>
                          <td style={footerCellBase}>
                            {formatCurrency(overheadTableTotals.totalUsd)}
                            <span style={{ fontWeight: 400 }}>
                              {' '}
                              · {overheadTableTotals.totalLaborHours.toFixed(2)}h
                            </span>
                          </td>
                          <td
                            style={{ ...footerCellBase, borderLeft: '1px solid var(--border-strong)' }}
                            aria-label={
                              totalOverheadFactor == null
                                ? 'Period total Overhead %: not available (field total dollars is zero)'
                                : `Period total Overhead %: ${Math.round(
                                    totalOverheadFactor * 100,
                                  )} percent, total office total divided by total field total dollars`
                            }
                          >
                            {totalOverheadFactor == null
                              ? '—'
                              : `${Math.round(totalOverheadFactor * 100)}%`}
                          </td>
                          <td style={{ ...footerCellBase, borderLeft: '1px solid var(--border-strong)' }}>
                            {formatCurrency(overheadTableTotals.otherJobsUsd)}
                            <span style={{ fontWeight: 400 }}>
                              {' '}
                              · {overheadTableTotals.otherJobsLaborHours.toFixed(2)}h
                            </span>
                          </td>
                        </>
                      )}
                    </tr>
                  </tfoot>
                )
              })()
            ) : null}
          </table>
        </div>
      )}

      {overheadBreakdownModalModel ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="overhead-breakdown-title"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.35)',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOverheadBreakdownModal(null)
          }}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 8,
              maxWidth: 560,
              width: '100%',
              maxHeight: '85vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)' }}>
              <h2 id="overhead-breakdown-title" style={{ margin: 0, fontSize: '1.125rem' }}>
                {overheadBreakdownModalModel.title} — {overheadBreakdownModalModel.workDate}
              </h2>
              {overheadBreakdownModalModel.scope === 'officeParts' ? (
                <>
                  <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.875rem', color: 'var(--text-600)' }}>
                    Mercury allocations by <strong>posted date</strong> (company time zone), supply invoice shares by{' '}
                    <strong>invoice date</strong>, tally parts by <strong>entry date</strong>. Separate from labor; no dedupe across
                    sources.
                  </p>
                  <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.875rem', fontWeight: 600 }}>
                    Total: {formatCurrency(overheadBreakdownModalModel.totalPartsUsd)}
                  </p>
                </>
              ) : overheadBreakdownModalModel.scope === 'total' ? (
                <>
                  <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.875rem' }}>
                    Labor: {overheadBreakdownModalModel.totalHours.toFixed(2)}h —{' '}
                    {formatCurrency(overheadBreakdownModalModel.totalLaborUsd)}
                  </p>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem' }}>
                    Office materials: {formatCurrency(overheadBreakdownModalModel.totalPartsUsd)}
                  </p>
                  <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.875rem', fontWeight: 600 }}>
                    Total: {formatCurrency(overheadBreakdownModalModel.grandTotalUsd)}
                  </p>
                </>
              ) : overheadBreakdownModalModel.scope === 'otherJobs' ? (
                <>
                  <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.875rem' }}>
                    Labor: {overheadBreakdownModalModel.totalHours.toFixed(2)}h —{' '}
                    {formatCurrency(overheadBreakdownModalModel.totalLaborUsd)}
                  </p>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem' }}>
                    Materials: {formatCurrency(overheadBreakdownModalModel.totalPartsUsd)}
                  </p>
                  {overheadBreakdownModalModel.internalTransferUsd > 0 ? (
                    <p
                      style={{
                        margin: '0.15rem 0 0 0',
                        fontSize: '0.75rem',
                        color: 'var(--text-muted)',
                        fontStyle: 'italic',
                      }}
                      title="Movement between your own accounts; excluded from Materials."
                    >
                      Internal Transfers (excluded):{' '}
                      {formatCurrency(overheadBreakdownModalModel.internalTransferUsd)}
                    </p>
                  ) : null}
                  <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.875rem', fontWeight: 600 }}>
                    Combined: {formatCurrency(overheadBreakdownModalModel.grandTotalUsd)}
                  </p>
                </>
              ) : (
                <>
                  <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.875rem', color: 'var(--text-600)' }}>
                    Approved, closed sessions in this category. Labor $ = hours × hourly wage from pay config.
                  </p>
                  <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.875rem', fontWeight: 600 }}>
                    Totals: {overheadBreakdownModalModel.totalHours.toFixed(2)}h —{' '}
                    {formatCurrency(overheadBreakdownModalModel.totalLaborUsd)}
                  </p>
                </>
              )}
            </div>
            <div style={{ padding: '0.75rem 1rem', overflowY: 'auto', flex: 1 }}>
              {overheadBreakdownModalModel.scope === 'officeParts' ? (
                overheadBreakdownModalModel.sortedPartLines.length === 0 ? (
                  <p style={{ margin: 0, color: 'var(--text-muted)' }}>No materials lines for this date.</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-muted)' }}>
                        <th style={{ textAlign: 'left', padding: '0.45rem' }}>Source</th>
                        <th style={{ textAlign: 'left', padding: '0.45rem' }}>Description</th>
                        <th style={{ textAlign: 'right', padding: '0.45rem' }}>Amount ($)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overheadBreakdownModalModel.sortedPartLines.map((ln) => (
                        <tr key={ln.sortKey} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '0.45rem' }}>
                            {ln.source === 'mercury' ? 'Mercury' : ln.source === 'supply' ? 'Supply' : 'Tally'}
                          </td>
                          <td style={{ padding: '0.45rem' }}>{ln.label}</td>
                          <td style={{ padding: '0.45rem', textAlign: 'right' }}>{formatCurrency(ln.amountUsd)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              ) : overheadBreakdownModalModel.scope === 'total' ? (
                <>
                  {overheadBreakdownModalModel.personTotal.length === 0 ? (
                    <p style={{ margin: '0 0 0.75rem 0', color: 'var(--text-muted)' }}>No labor sessions for this date.</p>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                      <thead>
                        <tr style={{ background: 'var(--bg-muted)' }}>
                          <th style={{ textAlign: 'left', padding: '0.45rem' }}>Person</th>
                          <th style={{ textAlign: 'right', padding: '0.45rem' }}>Hours</th>
                          <th style={{ textAlign: 'right', padding: '0.45rem' }}>Office ($)</th>
                          <th style={{ textAlign: 'right', padding: '0.45rem' }}>Bid ($)</th>
                          <th style={{ textAlign: 'right', padding: '0.45rem' }}>Labor total ($)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {overheadBreakdownModalModel.personTotal.map((r) => (
                          <tr key={r.userName} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '0.45rem' }}>
                              {r.userName}
                              {r.missingWage ? (
                                <span style={{ color: 'var(--text-amber-700)', fontSize: '0.75rem' }}>
                                  {' '}
                                  (no hourly wage for some sessions)
                                </span>
                              ) : null}
                            </td>
                            <td style={{ padding: '0.45rem', textAlign: 'right' }}>{r.hours.toFixed(2)}</td>
                            <td style={{ padding: '0.45rem', textAlign: 'right' }}>{formatCurrency(r.officeLaborUsd)}</td>
                            <td style={{ padding: '0.45rem', textAlign: 'right' }}>{formatCurrency(r.bidLaborUsd)}</td>
                            <td style={{ padding: '0.45rem', textAlign: 'right', fontWeight: 600 }}>
                              {formatCurrency(r.totalLaborUsd)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  <details open style={{ marginTop: '1rem', fontSize: '0.8125rem', color: 'var(--text-600)' }}>
                    <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Session detail (labor)</summary>
                    {overheadBreakdownModalModel.sortedSessions.length === 0 ? (
                      <p style={{ margin: '0.5rem 0 0 0' }}>No sessions.</p>
                    ) : (
                      <ul style={{ margin: '0.5rem 0 0 0', paddingLeft: '1.1rem' }}>
                        {overheadBreakdownModalModel.sortedSessions.map((ln) => (
                          <li key={ln.sessionId} style={{ marginBottom: '0.25rem' }}>
                            {ln.userName} — {ln.bucket === 'office' ? 'Office' : 'Bid'} — {ln.hours.toFixed(2)}h —{' '}
                            ${formatCurrency(ln.laborUsd)}
                            {ln.missingWage ? <span style={{ color: 'var(--text-amber-700)' }}> (no hourly wage)</span> : null}
                            {ln.notes ? (
                              <span style={{ color: 'var(--text-muted)' }}> | {ln.notes}</span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </details>

                  <details open style={{ marginTop: '1rem', fontSize: '0.8125rem', color: 'var(--text-600)' }}>
                    <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Materials (office job)</summary>
                    {overheadBreakdownModalModel.sortedPartLines.length === 0 ? (
                      <p style={{ margin: '0.5rem 0 0 0' }}>No materials lines for this date.</p>
                    ) : (
                      <ul style={{ margin: '0.5rem 0 0 0', paddingLeft: '1.1rem' }}>
                        {overheadBreakdownModalModel.sortedPartLines.map((ln) => {
                          // Mercury lines carry an optional debit-card UUID from the
                          // transaction's raw JSON. Resolve via nickname map; fall back
                          // to a compact hex preview ("abc...xyz") so the user can still
                          // tell *which* card was used even when no nickname is saved.
                          // Non-Mercury (supply / tally) lines and Mercury lines with no
                          // card (ACH / wire / check) render exactly as before.
                          const cardLabel =
                            ln.source === 'mercury' && ln.mercuryDebitCardId
                              ? overheadMercuryNicknameByDebitCard[
                                  ln.mercuryDebitCardId.toLowerCase()
                                ]?.trim() ||
                                `card ${formatMercuryDebitCardIdCompact(ln.mercuryDebitCardId)}`
                              : ''
                          return (
                            <li key={ln.sortKey} style={{ marginBottom: '0.25rem' }}>
                              {ln.source === 'mercury' ? 'Mercury' : ln.source === 'supply' ? 'Supply' : 'Tally'} — {ln.label}
                              {cardLabel ? (
                                <span style={{ color: 'var(--text-muted)' }}> · on {cardLabel}</span>
                              ) : null}
                              {' — '}
                              ${formatCurrency(ln.amountUsd)}
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </details>

                  <div
                    style={{
                      marginTop: '1.25rem',
                      paddingTop: '0.75rem',
                      borderTop: '1px solid var(--border)',
                      fontSize: '0.8125rem',
                      color: 'var(--text-muted)',
                    }}
                  >
                    <p style={{ margin: 0 }}>
                      <strong>Labor:</strong> approved, closed sessions — hours × pay config wage.
                    </p>
                    <p style={{ margin: '0.25rem 0 0 0' }}>
                      <strong>Materials:</strong> office job parts (same rules as <strong>Office parts ($)</strong> column).
                    </p>
                  </div>
                </>
              ) : overheadBreakdownModalModel.scope === 'otherJobs' ? (
                <>
                  {overheadBreakdownModalModel.personRows.length === 0 ? (
                    <p style={{ margin: '0 0 0.75rem 0', color: 'var(--text-muted)' }}>No labor sessions for this date.</p>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                      <thead>
                        <tr style={{ background: 'var(--bg-muted)' }}>
                          <th style={{ textAlign: 'left', padding: '0.45rem' }}>Person</th>
                          <th style={{ textAlign: 'right', padding: '0.45rem' }}>Hours</th>
                          <th style={{ textAlign: 'right', padding: '0.45rem' }}>Labor ($)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {overheadBreakdownModalModel.personRows.map((r) => (
                          <tr key={r.userName} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '0.45rem' }}>
                              {r.userName}
                              {r.missingWage ? (
                                <span style={{ color: 'var(--text-amber-700)', fontSize: '0.75rem' }}>
                                  {' '}
                                  (no hourly wage for some sessions)
                                </span>
                              ) : null}
                            </td>
                            <td style={{ padding: '0.45rem', textAlign: 'right' }}>{r.hours.toFixed(2)}</td>
                            <td style={{ padding: '0.45rem', textAlign: 'right', fontWeight: 600 }}>
                              {formatCurrency(r.laborUsd)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  <details open style={{ marginTop: '1rem', fontSize: '0.8125rem', color: 'var(--text-600)' }}>
                    <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Session detail (labor)</summary>
                    {overheadBreakdownModalModel.sortedSessions.length === 0 ? (
                      <p style={{ margin: '0.5rem 0 0 0' }}>No sessions.</p>
                    ) : (
                      <ul style={{ margin: '0.5rem 0 0 0', paddingLeft: '1.1rem' }}>
                        {overheadBreakdownModalModel.sortedSessions.map((ln) => (
                          <li key={ln.sessionId} style={{ marginBottom: '0.25rem' }}>
                            {ln.userName} — {ln.hours.toFixed(2)}h — ${formatCurrency(ln.laborUsd)}
                            {ln.missingWage ? <span style={{ color: 'var(--text-amber-700)' }}> (no hourly wage)</span> : null}
                            {ln.notes ? (
                              <span style={{ color: 'var(--text-muted)' }}> | {ln.notes}</span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </details>

                  <details open style={{ marginTop: '1rem', fontSize: '0.8125rem', color: 'var(--text-600)' }}>
                    <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
                      {overheadOfficeJobLedgerId ? 'Materials (field / non-office jobs)' : 'Materials (all jobs)'}
                    </summary>
                    {overheadBreakdownModalModel.sortedPartLines.length === 0 ? (
                      <p style={{ margin: '0.5rem 0 0 0' }}>No materials lines for this date.</p>
                    ) : (
                      <>
                        {overheadBreakdownModalModel.partsSections.map((section) => {
                          const isInternalTransfer = section.key === 'internal_transfer'
                          if (isInternalTransfer && section.lines.length === 0) return null
                          return (
                            <div
                              key={section.key}
                              style={{
                                marginTop: '0.5rem',
                                ...(isInternalTransfer
                                  ? {
                                      paddingLeft: '0.5rem',
                                      borderLeft: '3px solid #94a3b8',
                                      background: 'var(--bg-slate-tint)',
                                    }
                                  : null),
                              }}
                            >
                              <div
                                style={{
                                  fontWeight: 600,
                                  color: 'var(--text-700)',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'baseline',
                                  gap: '0.5rem',
                                }}
                              >
                                <span>
                                  {section.label} ({section.lines.length})
                                  {isInternalTransfer ? (
                                    <span
                                      style={{
                                        marginLeft: '0.4rem',
                                        fontWeight: 500,
                                        color: 'var(--text-slate-500)',
                                        fontStyle: 'italic',
                                        fontSize: '0.7rem',
                                      }}
                                    >
                                      (not counted in Materials)
                                    </span>
                                  ) : null}
                                </span>
                                <span style={{ fontWeight: 500, color: 'var(--text-muted)' }}>
                                  ${formatCurrency(section.totalUsd)}
                                </span>
                              </div>
                              {section.lines.length === 0 ? (
                                <p style={{ margin: '0.15rem 0 0 1.1rem', color: 'var(--text-faint)' }}>None</p>
                              ) : (
                                <ul style={{ margin: '0.15rem 0 0 0', paddingLeft: '1.1rem' }}>
                                  {section.lines.map((ln) => (
                                    <li key={ln.sortKey} style={{ marginBottom: '0.25rem' }}>
                                      {ln.source === 'mercury' ? 'Mercury' : ln.source === 'supply' ? 'Supply' : 'Tally'} — {ln.label} —{' '}
                                      ${formatCurrency(ln.amountUsd)}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          )
                        })}
                      </>
                    )}
                  </details>

                  <div
                    style={{
                      marginTop: '1.25rem',
                      paddingTop: '0.75rem',
                      borderTop: '1px solid var(--border)',
                      fontSize: '0.8125rem',
                      color: 'var(--text-muted)',
                    }}
                  >
                    <p style={{ margin: 0 }}>
                      Not included in overhead <strong>Office Total ($)</strong>.
                    </p>
                    <p style={{ margin: '0.25rem 0 0 0' }}>
                      <strong>Labor:</strong> approved, closed clock time on{' '}
                      <strong>jobs ledger</strong> work other than the office overhead job when one is configured (bid-only
                      time remains in <strong>Bid labor ($)</strong> only).
                    </p>
                    <p style={{ margin: '0.25rem 0 0 0' }}>
                      <strong>Materials:</strong> Mercury, supply, and tally on those jobs — same dating rules as the office parts
                      column.
                    </p>
                  </div>
                </>
              ) : overheadBreakdownModalModel.personRows.length === 0 ? (
                <p style={{ margin: 0, color: 'var(--text-muted)' }}>No sessions in this category for this date.</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-muted)' }}>
                      <th style={{ textAlign: 'left', padding: '0.45rem' }}>Person</th>
                      <th style={{ textAlign: 'right', padding: '0.45rem' }}>Hours</th>
                      <th style={{ textAlign: 'right', padding: '0.45rem' }}>Labor ($)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overheadBreakdownModalModel.personRows.map((r) => (
                      <tr key={r.userName} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '0.45rem' }}>
                          {r.userName}
                          {r.missingWage ? (
                            <span style={{ color: 'var(--text-amber-700)', fontSize: '0.75rem' }}> (no hourly wage)</span>
                          ) : null}
                        </td>
                        <td style={{ padding: '0.45rem', textAlign: 'right' }}>{r.hours.toFixed(2)}</td>
                        <td style={{ padding: '0.45rem', textAlign: 'right' }}>{formatCurrency(r.laborUsd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {overheadBreakdownModalModel.scope !== 'officeParts' &&
              overheadBreakdownModalModel.scope !== 'total' &&
              overheadBreakdownModalModel.scope !== 'otherJobs' ? (
                <details open style={{ marginTop: '1rem', fontSize: '0.8125rem', color: 'var(--text-600)' }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Session detail</summary>
                  {overheadBreakdownModalModel.sortedSessions.length === 0 ? (
                    <p style={{ margin: '0.5rem 0 0 0' }}>No sessions.</p>
                  ) : (
                    <ul style={{ margin: '0.5rem 0 0 0', paddingLeft: '1.1rem' }}>
                      {overheadBreakdownModalModel.sortedSessions.map((ln) => (
                        <li key={ln.sessionId} style={{ marginBottom: '0.25rem' }}>
                          {ln.userName} — {ln.bucket === 'office' ? 'Office' : 'Bid'} — {ln.hours.toFixed(2)}h —{' '}
                          ${formatCurrency(ln.laborUsd)}
                          {ln.missingWage ? <span style={{ color: 'var(--text-amber-700)' }}> (no hourly wage)</span> : null}
                          {ln.notes ? (
                            <span style={{ color: 'var(--text-muted)' }}> | {ln.notes}</span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </details>
              ) : null}
            </div>
            <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setOverheadBreakdownModal(null)}
                style={{
                  padding: '0.4rem 0.9rem',
                  borderRadius: 6,
                  border: '1px solid var(--border-strong)',
                  background: 'var(--surface)',
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {overheadOfficeJobModalOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="overhead-office-job-modal-title"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.35)',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOverheadOfficeJobModalOpen(false)
          }}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 8,
              maxWidth: 560,
              width: '100%',
              maxHeight: '85vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)' }}>
              <h2 id="overhead-office-job-modal-title" style={{ margin: 0, fontSize: '1.125rem' }}>
                Overhead office job
              </h2>
              <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                Which job counts as office overhead for clock time and materials in this table.
              </p>
            </div>
            <div style={{ padding: '1rem', overflowY: 'auto', flex: 1 }}>
              <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.875rem', color: 'var(--text-600)', lineHeight: 1.45 }}>
                Daily labor overhead from <strong>approved, closed</strong> clock sessions: time on the office job below,
                and time on <strong>bids</strong>. If both job and bid are set on a session, the <strong>office job</strong>{' '}
                wins. Amounts use session hours × <strong>hourly wage</strong> from People pay config (same name as clock
                user). <strong>Office parts ($)</strong> sums materials on the office job (Mercury allocations by posted
                date, supply invoice shares by invoice date, tally parts by entry date); these are separate from labor—no
                automatic dedupe across sources.                     <strong>Office Total ($) / Hours</strong> shows overhead <strong>dollars</strong>{' '}
                (labor plus office parts) and <strong>office + bid labor hours</strong> that day (materials add no hours).{' '}
                <strong>Field Total ($) / Hours</strong> is separate: same column shows <strong>dollars</strong>{' '}
                (jobs-ledger labor plus materials on those jobs) and <strong>jobs-ledger labor hours</strong> only (not
                bid-only time; materials add no hours). Rules: Mercury / supply / tally as above. It is{' '}
                <strong>not</strong> included in overhead <strong>Total ($)</strong>. <strong>Overhead %</strong> is{' '}
                <strong>Office Total ($) ÷ Field Total ($) × 100</strong> that day (office total as a percent of field-total
                dollars)—not margin; <strong>—</strong> when field total is $0.
              </p>
              {overheadSettingsLoading ? (
                <p style={{ margin: 0, color: 'var(--text-muted)' }}>Loading setting…</p>
              ) : overheadOfficeJobLedgerId ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
                  {overheadOfficeJobLabel ? (
                    <Link
                      to={`/jobs?edit=${encodeURIComponent(overheadOfficeJobLedgerId)}`}
                      style={{ fontWeight: 600, color: 'var(--text-link)' }}
                    >
                      {String(overheadOfficeJobLabel.hcp_number ?? '—')} — {overheadOfficeJobLabel.job_name ?? 'Job'}
                    </Link>
                  ) : (
                    <span style={{ color: 'var(--text-red-700)' }}>Saved job id not found — pick another.</span>
                  )}
                  {isDev ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setOverheadJobPickerOpen(true)}
                        style={{
                          padding: '0.25rem 0.6rem',
                          fontSize: '0.8125rem',
                          borderRadius: 4,
                          border: '1px solid var(--border-strong)',
                          background: 'var(--surface)',
                          cursor: 'pointer',
                        }}
                      >
                        Change
                      </button>
                      <button
                        type="button"
                        disabled={overheadJobSaving}
                        onClick={() => {
                          void (async () => {
                            setOverheadJobSaving(true)
                            try {
                              await deleteOverheadOfficeJobLedgerIdSetting()
                              setOverheadOfficeJobLedgerId(null)
                              setOverheadOfficeJobLabel(null)
                              showToast('Office job cleared', 'success')
                            } catch (e) {
                              showToast(formatErrorMessage(e, 'Could not clear'), 'error')
                            } finally {
                              setOverheadJobSaving(false)
                            }
                          })()
                        }}
                        style={{
                          padding: '0.25rem 0.6rem',
                          fontSize: '0.8125rem',
                          borderRadius: 4,
                          border: '1px solid #fecaca',
                          background: 'var(--bg-red-tint)',
                          cursor: 'pointer',
                          color: 'var(--text-red-700)',
                        }}
                      >
                        Clear
                      </button>
                    </>
                  ) : null}
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: '0.875rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>No office job configured — bid overhead still shows.</span>{' '}
                  {isDev ? (
                    <button
                      type="button"
                      onClick={() => setOverheadJobPickerOpen(true)}
                      style={{
                        padding: '0.25rem 0.6rem',
                        fontSize: '0.8125rem',
                        borderRadius: 4,
                        border: '1px solid var(--border-strong)',
                        background: 'var(--surface)',
                        cursor: 'pointer',
                      }}
                    >
                      Choose office job
                    </button>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}> Ask a dev to configure the office job.</span>
                  )}
                </p>
              )}
            </div>
            <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setOverheadOfficeJobModalOpen(false)}
                style={{
                  padding: '0.4rem 0.9rem',
                  borderRadius: 6,
                  border: '1px solid var(--border-strong)',
                  background: 'var(--surface)',
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {overheadJobPickerOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="overhead-job-picker-title"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.35)',
            zIndex: 2010,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOverheadJobPickerOpen(false)
          }}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 8,
              maxWidth: 480,
              width: '100%',
              maxHeight: '85vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)' }}>
              <h2 id="overhead-job-picker-title" style={{ margin: 0, fontSize: '1.125rem' }}>
                Choose office job
              </h2>
              <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                Search and select one job to attribute office overhead clock time.
              </p>
            </div>
            <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)' }}>
              <input
                type="search"
                value={overheadJobSearch}
                onChange={(e) => setOverheadJobSearch(e.target.value)}
                placeholder="Search jobs…"
                aria-label="Search jobs"
                autoFocus
                style={{ width: '100%', padding: '0.45rem 0.6rem', borderRadius: 6, border: '1px solid var(--border-strong)', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ overflowY: 'auto', flex: 1, padding: '0.5rem 0' }}>
              {overheadJobResults.length === 0 ? (
                <p style={{ margin: '0 1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  {overheadJobSearch.trim() ? 'No matches.' : 'Type to search.'}
                </p>
              ) : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {overheadJobResults.map((j) => (
                    <li key={j.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <button
                        type="button"
                        disabled={overheadJobSaving}
                        onClick={() => {
                          void (async () => {
                            setOverheadJobSaving(true)
                            try {
                              await upsertOverheadOfficeJobLedgerId(j.id)
                              setOverheadOfficeJobLedgerId(j.id)
                              setOverheadOfficeJobLabel({
                                hcp_number: j.hcp_number ?? null,
                                job_name: j.job_name ?? null,
                              })
                              setOverheadJobPickerOpen(false)
                              showToast('Office job saved', 'success')
                            } catch (e) {
                              showToast(formatErrorMessage(e, 'Could not save'), 'error')
                            } finally {
                              setOverheadJobSaving(false)
                            }
                          })()
                        }}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '0.65rem 1rem',
                          border: 'none',
                          background: 'none',
                          cursor: overheadJobSaving ? 'wait' : 'pointer',
                          fontSize: '0.875rem',
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>{effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—'}</span>
                        <span style={{ color: 'var(--text-muted)' }}> — {j.job_name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setOverheadJobPickerOpen(false)}
                style={{ padding: '0.4rem 0.85rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
