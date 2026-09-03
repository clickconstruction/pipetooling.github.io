import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/format'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { APP_CALENDAR_TZ, denverCalendarDayKey, referenceDateForWorkDateYmd, ymdAddDays } from '../../utils/dateUtils'
import { useToastContext } from '../../contexts/ToastContext'
import { useMercuryLedgerNicknames } from '../../hooks/useMercuryLedgerNicknames'
import { formatMercuryDebitCardIdCompact } from '../../lib/mercuryRawDebitCard'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import { useLedgerPrefixMap } from '../../contexts/LedgerDisplayPrefixContext'
import { UnifiedSearchResultRow } from '../search/UnifiedSearchResultRow'
import { useJobBidSearchEvidence } from '../../hooks/useJobBidSearchEvidence'
import type { PayConfigRow } from '../../types/peoplePayConfig'
import {
  bucketOverheadPartsLinesByAccountingLabel,
  sumMaterialsTotalUsdExcludingInternalTransfer,
  sumPartsUsdByDayExcludingInternalTransfer,
  type OverheadPartsAccountingBucketKey,
  type OverheadPartsAccountingSection,
} from '../../lib/overheadPartsAccountingBuckets'
import {
  collectMercuryTxIds,
  fetchAccountingBucketByTxId,
  loadOfficePartsUsdByDayExcludingInternalTransfer,
} from '../../lib/overheadPartsBucketLoader'
import { fetchAllRows } from '../../lib/supabasePaging'
import {
  aggregateOtherJobsLaborByPerson,
  aggregateOverheadDetailByPerson,
  aggregateOverheadDetailByPersonTotalScope,
  buildOtherJobsLaborByDay,
  buildOverheadDailyLabor,
  buildOverheadWageLookup,
  buildOverheadWageLookupByPersonId,
  filterOverheadDetailLines,
  mergeOverheadDayTableRows,
  overheadFactorTotalOverOtherJobs,
  type OverheadClockSessionRow,
  type OverheadDetailScope,
  type OverheadPayConfigInput,
} from '../../lib/overheadDailyLabor'
import {
  buildOverheadHygieneSummary,
  formatOverheadHygienePersonNames,
  type OverheadHygieneSummary,
} from '../../lib/overheadHygiene'
import {
  bucketInvoiceRevenueByAppTzDay,
  computeOverheadTrailingAverages,
} from '../../lib/overheadAvgDailyCost'
import { computeOverheadRateMethods } from '../../lib/overheadRateMethods'
import { buildOverheadPoolTrend, type OverheadPoolTrend } from '../../lib/overheadPoolTrend'
import { OverheadPoolTrendCard } from './OverheadPoolTrendCard'
import { buildOverheadLensSeries, type OverheadLensKey } from '../../lib/overheadLensSeries'
import { OverheadLensModal, type OverheadLensDetail } from './OverheadLensModal'
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

/**
 * Accounting-bucket sections list shared by the officeParts / total /
 * otherJobs breakdown modal branches — one renderer so the Internal
 * Transfers slate-accent "(not counted in Materials)" treatment stays
 * identical across all three. `cardLabelForLine` (office branches only)
 * appends the "· on <card>" suffix for Mercury debit-card lines.
 */
function OverheadPartsSectionsList({
  sections,
  cardLabelForLine,
}: {
  sections: readonly OverheadPartsAccountingSection[]
  cardLabelForLine?: (line: OverheadPartsDetailLine) => string
}) {
  return (
    <>
      {sections.map((section) => {
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
                {section.lines.map((ln) => {
                  const cardLabel = cardLabelForLine?.(ln) ?? ''
                  return (
                    <li key={ln.sortKey} style={{ marginBottom: '0.25rem' }}>
                      {ln.source === 'mercury' ? 'Mercury' : ln.source === 'supply' ? 'Supply' : 'Tally'} — {ln.label}
                      {cardLabel ? (
                        <span style={{ color: 'var(--text-muted)' }}> · on {cardLabel}</span>
                      ) : null}
                      {' — '}${formatCurrency(ln.amountUsd)}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )
      })}
    </>
  )
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
  setError,
  canAccessOverheadTab,
  isDev,
  loadPayConfig,
}: PeopleOverheadTabProps) {
  const { showToast } = useToastContext()

  /**
   * Mercury debit-card nicknames used by the Overhead tab's Materials
   * drilldowns to display which card a Mercury allocation was purchased
   * on (e.g. "Mercury · Lowes — Robert's card · $123.45"). `enabled: true`
   * does not gate anything by itself — the fetch is effectively gated by
   * conditional MOUNTING: People.tsx only renders this component while the
   * Overhead tab is active. The hook is also role-gated internally and
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
    Array<{ id: string; hcp_number: string; click_number?: string; job_name: string; job_address: string; service_type_id?: string | null; service_type_name?: string | null }>
  >([])
  const overheadPrefixMap = useLedgerPrefixMap()
  const overheadJobResultsUnified = useMemo(
    () => overheadJobResults.map((j) => ({ source: 'job' as const, ...j })),
    [overheadJobResults],
  )
  const { jobEvidence: overheadJobEvidence, evidenceMode: overheadEvidenceMode } =
    useJobBidSearchEvidence(overheadJobResultsUnified)
  const [overheadJobSaving, setOverheadJobSaving] = useState(false)
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
  const [overheadOtherJobsPartsDetailByDay, setOverheadOtherJobsPartsDetailByDay] = useState<
    Map<string, OverheadPartsDetailLine[]>
  >(() => new Map())
  const [overheadOtherJobsPartsLoading, setOverheadOtherJobsPartsLoading] = useState(false)
  /**
   * Banking → Accounting drag-sort label bucket for each Mercury transaction
   * referenced by `overheadOfficePartsDetailByDay` OR
   * `overheadOtherJobsPartsDetailByDay` (i.e. every Mercury line that can
   * surface in a Materials drilldown or feed a Materials $ column for any
   * day in the active window). One symmetric map so the Internal-Transfer
   * exclusion applies identically to office and field materials.
   *
   * Computed once per change to the per-day detail maps, not per-modal-open,
   * so flipping between days inside the modal is instant. Tx ids that have
   * no assignment row are absent from the map; the renderer defaults those
   * to the `'other'` bucket via `bucketForOverheadPartsLine`.
   */
  const [overheadPartsAccountingBucketByTxId, setOverheadPartsAccountingBucketByTxId] = useState<
    Map<string, OverheadPartsAccountingBucketKey>
  >(() => new Map())
  const [overheadBreakdownModal, setOverheadBreakdownModal] = useState<null | { workDate: string; scope: OverheadDetailScope }>(
    null,
  )
  /**
   * "Three lenses" strip state — Methods A/B/C over the SAME 90-day pool the
   * KPI cards use (shared kernel `overheadRateMethods`, also consumed by the
   * Review tab). Computed inside the 90-day KPI effect below, not a second
   * fetch pass.
   */
  const [overheadRateLenses, setOverheadRateLenses] = useState<{
    methodA: number | null
    methodB: number | null
    methodC: number | null
    windowStart: string | null
    windowEnd: string | null
    loading: boolean
  }>({ methodA: null, methodB: null, methodC: null, windowStart: null, windowEnd: null, loading: false })
  /**
   * Pool trend + composition card (v2.2673): built from the SAME per-day
   * labor/parts maps the KPI/lenses effect assembles (kernel `overheadPoolTrend`).
   */
  const [overheadPoolTrend, setOverheadPoolTrend] = useState<{ trend: OverheadPoolTrend | null; loading: boolean }>({
    trend: null,
    loading: false,
  })
  /** Lens modals (v2.2674): which lens is open + the per-lens history/denominators the same effect computes. */
  const [overheadLensModal, setOverheadLensModal] = useState<OverheadLensKey | null>(null)
  const [overheadLensDetail, setOverheadLensDetail] = useState<OverheadLensDetail | null>(null)
  /**
   * Maintenance-hygiene indicators (pending approvals / unpriced hours /
   * unassigned salary time) over the SAME 90-day window as the KPI/lenses —
   * computed inside that effect from the same session arrays plus one extra
   * unassigned-salary fetch (kernel: `overheadHygiene`). `summary: null`
   * until loaded or after a whole-effect failure; the strip hides when
   * clean (`anyAttention` false).
   */
  const [overheadHygiene, setOverheadHygiene] = useState<{
    summary: OverheadHygieneSummary | null
    loading: boolean
  }>({ summary: null, loading: false })
  /**
   * `users.id` → `people.id` (via `people.account_user_id`) for the
   * person-id-first wage join (C1). `null` until loaded so the 90-day scan
   * can wait for it instead of running twice.
   */
  const [overheadPersonIdByUserId, setOverheadPersonIdByUserId] = useState<ReadonlyMap<string, string> | null>(null)
  /** True once the mount `loadPayConfig()` settles — gates the 90-day scan (single run). */
  const [overheadPayConfigLoaded, setOverheadPayConfigLoaded] = useState(false)
  /**
   * Per-source fetch failures (item: the tab used to swallow every error
   * into empty maps, rendering "No rows in this range" for an RLS/network
   * failure). Keyed by source so one source's recovery doesn't clear
   * another's banner. Also forwarded to the page-level `setError` prop.
   */
  const [overheadLoadErrorBySource, setOverheadLoadErrorBySource] = useState<Record<string, string>>({})

  const reportOverheadLoadError = useCallback(
    (source: string, e: unknown) => {
      const msg = `Failed to load ${source} — ${formatErrorMessage(e)}`
      setOverheadLoadErrorBySource((prev) => ({ ...prev, [source]: msg }))
      setError(msg)
    },
    [setError],
  )
  const clearOverheadLoadError = useCallback((source: string) => {
    setOverheadLoadErrorBySource((prev) => {
      if (!(source in prev)) return prev
      const next = { ...prev }
      delete next[source]
      return next
    })
  }, [])

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
              supabase.from('jobs_ledger').select('hcp_number, click_number, job_name').eq('id', id).maybeSingle(),
            'fetch overhead office job label',
          )) as { hcp_number: string | null; click_number: string | null; job_name: string | null } | null
          if (cancelled) return
          if (jobRow) {
            setOverheadOfficeJobLabel({
              hcp_number: effectiveJobLedgerNumber(jobRow.hcp_number, jobRow.click_number) || null,
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
    // Flag when the load settles (success OR failure) so the 90-day scan can
    // wait for real pay-config content instead of running once against the
    // initial `{}` and again after the reload swaps the object identity.
    void loadPayConfig().finally(() => setOverheadPayConfigLoaded(true))
  }, [canAccessOverheadTab])

  useEffect(() => {
    if (!canAccessOverheadTab || !authUser?.id) return
    let cancelled = false
    void (async () => {
      try {
        // users.id → people.id link rows (C1 person-id-first wage join; the
        // salaryPayConfigGate pattern). Paged for safety, tiny in practice.
        const rows = await fetchAllRows(
          async (from, to) => ({
            data: (await withSupabaseRetry(
              async () =>
                supabase
                  .from('people')
                  .select('id, account_user_id')
                  .not('account_user_id', 'is', null)
                  .is('archived_at', null)
                  .order('id')
                  .range(from, to),
              'load overhead person links',
            )) as Array<{ id: string; account_user_id: string | null }> | null,
            error: null,
          }),
          'load overhead person links',
        )
        if (cancelled) return
        const m = new Map<string, string>()
        for (const r of rows) {
          if (r.account_user_id) m.set(r.account_user_id, r.id)
        }
        setOverheadPersonIdByUserId(m)
      } catch {
        // Degrade to the name-fallback join (empty map) — not banner-worthy.
        if (!cancelled) setOverheadPersonIdByUserId(new Map())
      }
    })()
    return () => {
      cancelled = true
    }
  }, [canAccessOverheadTab, authUser?.id])

  useEffect(() => {
    if (!canAccessOverheadTab || !authUser?.id) return
    let cancelled = false
    setOverheadSessionsLoading(true)
    void (async () => {
      try {
        // Paged (fetchAllRows): the date range is user-settable and unbounded,
        // so a wide window crosses PostgREST max_rows (1000) and silently
        // truncates. Fresh builder per page; `.order('id')` keeps pages stable.
        const makeQ = () => {
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
          return q.order('id')
        }
        const data = await fetchAllRows(
          async (from, to) => ({
            data: (await withSupabaseRetry(
              async () => makeQ().range(from, to),
              'load overhead clock sessions',
            )) as unknown as OverheadClockSessionRow[] | null,
            error: null,
          }),
          'load overhead clock sessions',
        )
        if (cancelled) return
        setOverheadSessions(data)
        clearOverheadLoadError('overhead clock sessions')
      } catch (e) {
        if (!cancelled) {
          setOverheadSessions([])
          reportOverheadLoadError('overhead clock sessions', e)
        }
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
    reportOverheadLoadError,
    clearOverheadLoadError,
  ])

  useEffect(() => {
    if (!canAccessOverheadTab || !authUser?.id) return
    let cancelled = false
    setOverheadOtherJobsSessionsLoading(true)
    void (async () => {
      try {
        // Paged (fetchAllRows): company-wide field sessions blow past 1000
        // rows even in a normal week — see the office-scope effect above.
        const makeQ = () => {
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
          return q.order('id')
        }
        const data = await fetchAllRows(
          async (from, to) => ({
            data: (await withSupabaseRetry(
              async () => makeQ().range(from, to),
              'load overhead other jobs clock sessions',
            )) as unknown as OverheadClockSessionRow[] | null,
            error: null,
          }),
          'load overhead other jobs clock sessions',
        )
        if (cancelled) return
        setOverheadOtherJobsSessions(data)
        clearOverheadLoadError('field clock sessions')
      } catch (e) {
        if (!cancelled) {
          setOverheadOtherJobsSessions([])
          reportOverheadLoadError('field clock sessions', e)
        }
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
    reportOverheadLoadError,
    clearOverheadLoadError,
  ])

  useEffect(() => {
    if (!canAccessOverheadTab || !authUser?.id) return
    if (!overheadOfficeJobLedgerId) {
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
        setOverheadOfficePartsDetailByDay(r.partsDetailByDay)
        clearOverheadLoadError('office materials')
      } catch (e) {
        if (!cancelled) {
          setOverheadOfficePartsDetailByDay(new Map())
          reportOverheadLoadError('office materials', e)
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
    reportOverheadLoadError,
    clearOverheadLoadError,
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
        setOverheadOtherJobsPartsDetailByDay(r.partsDetailByDay)
        clearOverheadLoadError('field materials')
      } catch (e) {
        if (!cancelled) {
          setOverheadOtherJobsPartsDetailByDay(new Map())
          reportOverheadLoadError('field materials', e)
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
    reportOverheadLoadError,
    clearOverheadLoadError,
  ])

  /**
   * Resolve Banking → Accounting drag-sort label buckets for every Mercury
   * transaction that surfaces as an office-job OR field/non-office-job
   * Materials line in the active overhead window (one symmetric map — the
   * Internal-Transfer exclusion applies to both sides). Runs whenever the
   * per-day detail maps are rebuilt (date range change, office job change,
   * parts refresh).
   */
  useEffect(() => {
    if (!canAccessOverheadTab || !authUser?.id) return
    const txIds = collectMercuryTxIds([overheadOfficePartsDetailByDay, overheadOtherJobsPartsDetailByDay])
    if (txIds.length === 0) {
      setOverheadPartsAccountingBucketByTxId(new Map())
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const next = await fetchAccountingBucketByTxId(txIds)
        if (cancelled) return
        setOverheadPartsAccountingBucketByTxId(next)
      } catch {
        if (!cancelled) setOverheadPartsAccountingBucketByTxId(new Map())
      }
    })()
    return () => {
      cancelled = true
    }
  }, [canAccessOverheadTab, authUser?.id, overheadOfficePartsDetailByDay, overheadOtherJobsPartsDetailByDay])

  // Dual-rate people (office_hourly_wage set, hourly) price office/bid time
  // at the office rate — matching payroll (officeJobRateSplit). ONE shared
  // lookup (name-keyed + person-id-keyed, C1) feeds the weekly table memos
  // AND the 90-day KPI/lenses effect. The JSON key keeps identity stable
  // across pay-config refetches with identical content, so the 90-day scan
  // no longer re-runs on a mere object-identity change.
  const overheadWageInputsKey = useMemo(
    () =>
      JSON.stringify(
        Object.values(payConfig).map((r) => ({
          person_name: r.person_name,
          person_id: r.person_id ?? null,
          hourly_wage: r.hourly_wage ?? null,
          office_hourly_wage: r.office_hourly_wage ?? null,
          is_salary: r.is_salary,
        })),
      ),
    [payConfig],
  )
  const overheadWageLookup = useMemo(() => {
    const inputs = JSON.parse(overheadWageInputsKey) as OverheadPayConfigInput[]
    return {
      byName: buildOverheadWageLookup(inputs),
      byPersonId: buildOverheadWageLookupByPersonId(inputs),
    }
  }, [overheadWageInputsKey])

  useEffect(() => {
    if (!canAccessOverheadTab || !authUser?.id) return
    // Single-run gate: wait for pay config AND the person-id link map before
    // the first 90-day scan — running early would burn a full company-wide
    // scan on empty wage inputs and immediately re-run when they arrive.
    if (!overheadPayConfigLoaded || overheadPersonIdByUserId == null) return
    let cancelled = false
    setOverheadAvgDailyCost((prev) => ({ ...prev, loading: true }))
    setOverheadRateLenses((prev) => ({ ...prev, loading: true }))
    setOverheadPoolTrend((prev) => ({ ...prev, loading: true }))
    setOverheadHygiene((prev) => ({ ...prev, loading: true }))
    void (async () => {
      try {
        // Anchor the whole 90-day window on the COMPANY calendar day
        // (America/Chicago), not the viewer's browser-local date — a viewer
        // in another timezone near midnight used to see the entire
        // session/parts/revenue window shifted by a day.
        const today = denverCalendarDayKey(Date.now())
        const start = ymdAddDays(today, -89)
        // Paged (fetchAllRows): a company-wide 90-day scan silently truncates
        // at PostgREST max_rows (1000) if un-ranged — a truncated day total
        // deflates every trailing average. Fresh builder per page;
        // `.order('id')` keeps pages stable.
        const sessionSelect =
          'id, user_id, work_date, clocked_in_at, clocked_out_at, job_ledger_id, bid_id, approved_at, rejected_at, revoked_at, users!clock_sessions_user_id_fkey(name)'
        const makeQ = () => {
          let q = supabase
            .from('clock_sessions')
            .select(sessionSelect)
            .gte('work_date', start)
            .lte('work_date', today)
          if (overheadOfficeJobLedgerId) {
            q = q.or(`job_ledger_id.eq.${overheadOfficeJobLedgerId},bid_id.not.is.null`)
          } else {
            q = q.not('bid_id', 'is', null)
          }
          return q.order('id')
        }
        // Field (non-office jobs-ledger) sessions for the three-lenses
        // denominators — Method A needs field hours, Method C field labor $.
        // Same paged pattern, same 90-day window, same fetch pass.
        const makeFieldQ = () => {
          let q = supabase
            .from('clock_sessions')
            .select(sessionSelect)
            .gte('work_date', start)
            .lte('work_date', today)
            .not('job_ledger_id', 'is', null)
          if (overheadOfficeJobLedgerId) q = q.neq('job_ledger_id', overheadOfficeJobLedgerId)
          return q.order('id')
        }
        // Unassigned salary-schedule time for the hygiene strip's third
        // indicator: synthetic sessions (docs/SALARY_CLOCK_SESSIONS.md) with
        // no job AND no bid are invisible to the overhead pool entirely.
        // Same paged pattern, same window; failure degrades to `null` (the
        // indicator hides) via the per-source error pattern instead of
        // nulling the KPIs/lenses with it.
        const makeSalaryQ = () =>
          supabase
            .from('clock_sessions')
            .select(sessionSelect)
            .gte('work_date', start)
            .lte('work_date', today)
            .eq('origin', 'salary_schedule')
            .is('job_ledger_id', null)
            .is('bid_id', null)
            .order('id')
        const [sessions, fieldSessions, salarySessions] = await Promise.all([
          fetchAllRows(
            async (from, to) => ({
              data: (await withSupabaseRetry(
                async () => makeQ().range(from, to),
                'load overhead 90d sessions',
              )) as unknown as OverheadClockSessionRow[] | null,
              error: null,
            }),
            'load overhead 90d sessions',
          ),
          fetchAllRows(
            async (from, to) => ({
              data: (await withSupabaseRetry(
                async () => makeFieldQ().range(from, to),
                'load overhead 90d field sessions',
              )) as unknown as OverheadClockSessionRow[] | null,
              error: null,
            }),
            'load overhead 90d field sessions',
          ),
          fetchAllRows(
            async (from, to) => ({
              data: (await withSupabaseRetry(
                async () => makeSalaryQ().range(from, to),
                'load overhead 90d unassigned salary sessions',
              )) as unknown as OverheadClockSessionRow[] | null,
              error: null,
            }),
            'load overhead 90d unassigned salary sessions',
          ).then(
            (rows) => {
              if (!cancelled) clearOverheadLoadError('unassigned salary time')
              return rows
            },
            (e: unknown) => {
              if (!cancelled) reportOverheadLoadError('unassigned salary time', e)
              return null
            },
          ),
        ])
        let partsByDay: Map<string, number> = new Map()
        if (overheadOfficeJobLedgerId) {
          // Same symmetric rule as the table: Internal Transfers are not an
          // expense and stay out of the KPI numerator's office parts $. A
          // bucket-fetch failure degrades to "everything counted" (empty map
          // buckets to 'other') instead of nulling the KPIs. Shared loader —
          // the Review tab builds its pool through the same function.
          const r = await loadOfficePartsUsdByDayExcludingInternalTransfer({
            officeJobLedgerId: overheadOfficeJobLedgerId,
            startYmd: start,
            endYmd: today,
          })
          partsByDay = r.partsUsdByDay
        }
        if (cancelled) return
        const labor = buildOverheadDailyLabor({
          sessions,
          officeJobLedgerId: overheadOfficeJobLedgerId,
          wageByNormalizedName: overheadWageLookup.byName,
          wageByPersonId: overheadWageLookup.byPersonId,
          personIdByUserId: overheadPersonIdByUserId,
        })
        // Field denominators via the same kernel the weekly table uses (field
        // wage, id-first join): hours always count; missing wage prices $0.
        const fieldLabor = buildOtherJobsLaborByDay({
          sessions: fieldSessions,
          officeJobLedgerId: overheadOfficeJobLedgerId,
          wageByNormalizedName: overheadWageLookup.byName,
          wageByPersonId: overheadWageLookup.byPersonId,
          personIdByUserId: overheadPersonIdByUserId,
        })
        let fieldHours90 = 0
        for (const v of fieldLabor.laborHoursByDay.values()) fieldHours90 += v
        let fieldLaborUsd90 = 0
        for (const v of fieldLabor.laborUsdByDay.values()) fieldLaborUsd90 += v
        // Hygiene strip: pending approvals from the SAME two session arrays
        // (zero extra fetches); unpriced hours from the builders' missingWage
        // detail lines; unassigned salary from the third fetch above.
        setOverheadHygiene({
          summary: buildOverheadHygieneSummary({
            officeAndBidSessions: sessions,
            fieldSessions,
            unassignedSalarySessions: salarySessions,
            overheadDetailLines: [...labor.detailByDay.values()].flat(),
            otherJobsDetailLines: [...fieldLabor.detailByDay.values()].flat(),
          }),
          loading: false,
        })
        const merged = mergeOverheadDayTableRows(labor.byDay, partsByDay, new Map(), new Map(), new Map())
        setOverheadPoolTrend({
          trend: buildOverheadPoolTrend({ laborDays: labor.byDay, partsUsdByDay: partsByDay, startYmd: start, endYmd: today }),
          loading: false,
        })
        const totalsByDay = new Map<string, number>()
        for (const row of merged) totalsByDay.set(row.work_date, row.totalUsd)
        // Fetch a day wide on both sides, then re-bucket each invoice into
        // its Chicago calendar day (bucketInvoiceRevenueByAppTzDay) — the old
        // UTC-bounded window pulled in the previous evening's invoices and
        // dropped everything sent after ~6pm on the last day (v2.1249 fix,
        // same as the Review tab).
        const startIsoLow = `${ymdAddDays(start, -1)}T00:00:00-00:00`
        const endIsoHigh = `${ymdAddDays(today, 2)}T00:00:00-00:00`
        const invoiceRows = await fetchAllRows(
          async (from, to) => ({
            data: (await withSupabaseRetry(
              async () =>
                supabase
                  .from('jobs_ledger_invoices')
                  .select('amount, sent_to_customer_at')
                  .gte('sent_to_customer_at', startIsoLow)
                  .lt('sent_to_customer_at', endIsoHigh)
                  // Stripe TEST-mode invoices are not revenue — keep them out
                  // of the Method B denominator. NULL stripe_mode = non-Stripe
                  // (HCP/physical) or pre-v2.1114 legacy rows, both real
                  // revenue, so a bare .neq() would wrongly drop them under
                  // SQL <> NULL semantics.
                  .or('stripe_mode.is.null,stripe_mode.neq.test')
                  .order('id')
                  .range(from, to),
              'load overhead 90d revenue invoices',
            )) as Array<{ amount: number | null; sent_to_customer_at: string | null }> | null,
            error: null,
          }),
          'load overhead 90d revenue invoices',
        )
        if (cancelled) return
        const revenueByDay = bucketInvoiceRevenueByAppTzDay(invoiceRows, start, today)
        const { w7, w30, w90 } = computeOverheadTrailingAverages({
          totalsByDay,
          revenueByDay,
          todayYmd: today,
        })
        // Three lenses: the w90 cost sum IS the 90-day pool (office labor +
        // bid labor + office parts) — one pool, three denominators.
        const rates = computeOverheadRateMethods({
          overheadPoolUsd: w90.costUsd,
          fieldHours: fieldHours90,
          invoicedRevenueUsd: w90.revenueUsd,
          fieldLaborUsd: fieldLaborUsd90,
        })
        setOverheadAvgDailyCost({
          avg7: w7.avgDailyCostUsd,
          avg30: w30.avgDailyCostUsd,
          avg90: w90.avgDailyCostUsd,
          per100_7: w7.per100RevenueUsd,
          per100_30: w30.per100RevenueUsd,
          per100_90: w90.per100RevenueUsd,
          loading: false,
        })
        setOverheadRateLenses({
          methodA: rates.methodA,
          methodB: rates.methodB,
          methodC: rates.methodC,
          windowStart: start,
          windowEnd: today,
          loading: false,
        })
        // Lens modals (v2.2674): week-by-week + rolling history per lens from
        // the maps above, plus the two audit facts the modal states outright —
        // pending field hours (A/C's missing denominator) and sessions that
        // sit on BOTH sides (non-office job + bid link).
        const pendingFieldHours = fieldSessions.reduce((acc, sess) => {
          if (sess.approved_at || sess.rejected_at || sess.revoked_at || !sess.clocked_out_at) return acc
          const h = (Date.parse(sess.clocked_out_at) - Date.parse(sess.clocked_in_at)) / 3_600_000
          return Number.isFinite(h) && h > 0 ? acc + h : acc
        }, 0)
        const overlapSessions = sessions.filter(
          (sess) =>
            sess.approved_at &&
            !sess.rejected_at &&
            !sess.revoked_at &&
            sess.bid_id &&
            sess.job_ledger_id &&
            sess.job_ledger_id !== overheadOfficeJobLedgerId,
        ).length
        const lensSeries = (denominatorByDay: ReadonlyMap<string, number>) =>
          buildOverheadLensSeries({ poolUsdByDay: totalsByDay, denominatorByDay, startYmd: start, endYmd: today })
        setOverheadLensDetail({
          series: {
            A: lensSeries(fieldLabor.laborHoursByDay),
            B: lensSeries(revenueByDay),
            C: lensSeries(fieldLabor.laborUsdByDay),
          },
          denominators: { fieldHours: fieldHours90, invoicedRevenueUsd: w90.revenueUsd, fieldLaborUsd: fieldLaborUsd90 },
          pendingFieldHours,
          overlapSessions,
        })
        clearOverheadLoadError('90-day averages')
      } catch (e) {
        if (!cancelled) {
          reportOverheadLoadError('90-day averages', e)
          setOverheadAvgDailyCost({
            avg7: null,
            avg30: null,
            avg90: null,
            per100_7: null,
            per100_30: null,
            per100_90: null,
            loading: false,
          })
          setOverheadRateLenses({
            methodA: null,
            methodB: null,
            methodC: null,
            windowStart: null,
            windowEnd: null,
            loading: false,
          })
          setOverheadHygiene({ summary: null, loading: false })
          setOverheadPoolTrend({ trend: null, loading: false })
          setOverheadLensDetail(null)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [
    canAccessOverheadTab,
    authUser?.id,
    overheadOfficeJobLedgerId,
    overheadPayConfigLoaded,
    overheadPersonIdByUserId,
    overheadWageLookup,
    reportOverheadLoadError,
    clearOverheadLoadError,
  ])

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
          (data ?? []) as Array<{
            id: string
            hcp_number: string
            click_number?: string
            job_name: string
            job_address: string
            service_type_id?: string | null
            service_type_name?: string | null
          }>,
        )
      })
    }, 300)
    return () => clearTimeout(t)
  }, [overheadJobSearch, overheadJobPickerOpen])

  const overheadLabor = useMemo(
    () =>
      buildOverheadDailyLabor({
        sessions: overheadSessions,
        officeJobLedgerId: overheadOfficeJobLedgerId,
        wageByNormalizedName: overheadWageLookup.byName,
        wageByPersonId: overheadWageLookup.byPersonId,
        personIdByUserId: overheadPersonIdByUserId ?? undefined,
      }),
    [overheadWageLookup, overheadSessions, overheadOfficeJobLedgerId, overheadPersonIdByUserId],
  )

  const overheadOtherJobsLabor = useMemo(
    () =>
      buildOtherJobsLaborByDay({
        sessions: overheadOtherJobsSessions,
        officeJobLedgerId: overheadOfficeJobLedgerId,
        wageByNormalizedName: overheadWageLookup.byName,
        wageByPersonId: overheadWageLookup.byPersonId,
        personIdByUserId: overheadPersonIdByUserId ?? undefined,
      }),
    [overheadWageLookup, overheadOtherJobsSessions, overheadOfficeJobLedgerId, overheadPersonIdByUserId],
  )

  // Per-day Materials $ with Internal Transfers excluded on BOTH sides
  // (office parts and field materials) — the same rule the breakdown modals
  // apply, so table columns and modals always agree.
  const overheadOfficePartsUsdByDay = useMemo(
    () =>
      sumPartsUsdByDayExcludingInternalTransfer(
        overheadOfficePartsDetailByDay,
        overheadPartsAccountingBucketByTxId,
      ),
    [overheadOfficePartsDetailByDay, overheadPartsAccountingBucketByTxId],
  )

  const overheadOtherJobsPartsUsdByDay = useMemo(
    () =>
      sumPartsUsdByDayExcludingInternalTransfer(
        overheadOtherJobsPartsDetailByDay,
        overheadPartsAccountingBucketByTxId,
      ),
    [overheadOtherJobsPartsDetailByDay, overheadPartsAccountingBucketByTxId],
  )

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
    const sortedPartLines = [...(overheadOfficePartsDetailByDay.get(workDate) ?? [])].sort((a, b) =>
      `${a.source} ${a.sortKey}`.localeCompare(`${b.source} ${b.sortKey}`),
    )
    // Office-parts accounting sections, bucketed once for the officeParts and
    // total scopes. Internal Transfers are not an expense: the Materials total
    // excludes them (same symmetric rule as the table columns and the
    // otherJobs branch below) and they render in a marked excluded section.
    const officePartsSections = bucketOverheadPartsLinesByAccountingLabel(
      sortedPartLines,
      overheadPartsAccountingBucketByTxId,
    )
    const totalPartsUsd = sumMaterialsTotalUsdExcludingInternalTransfer(officePartsSections)
    const internalTransferUsd =
      officePartsSections.find((s) => s.key === 'internal_transfer')?.totalUsd ?? 0

    if (scope === 'officeParts') {
      return {
        workDate,
        scope,
        title: 'Office parts ($)',
        totalPartsUsd,
        internalTransferUsd,
        partsSections: officePartsSections,
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
        overheadPartsAccountingBucketByTxId,
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
        internalTransferUsd,
        grandTotalUsd,
        personTotal: aggregateOverheadDetailByPersonTotalScope(dayLines),
        sortedSessions,
        sortedPartLines,
        partsSections: officePartsSections,
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
    overheadOfficePartsDetailByDay,
    overheadOtherJobsLabor,
    overheadOtherJobsPartsDetailByDay,
    overheadPartsAccountingBucketByTxId,
  ])

  // Mercury lines carry an optional debit-card UUID from the transaction's
  // raw JSON. Resolve via nickname map; fall back to a compact hex preview
  // ("abc...xyz") so the user can still tell *which* card was used even when
  // no nickname is saved. Non-Mercury (supply / tally) lines and Mercury
  // lines with no card (ACH / wire / check) get no suffix.
  const overheadCardLabelForLine = (ln: OverheadPartsDetailLine): string =>
    ln.source === 'mercury' && ln.mercuryDebitCardId
      ? overheadMercuryNicknameByDebitCard[ln.mercuryDebitCardId.toLowerCase()]?.trim() ||
        `card ${formatMercuryDebitCardIdCompact(ln.mercuryDebitCardId)}`
      : ''

  // Close (reset) the day-breakdown modal whenever the visible range moves —
  // Previous/Next week or a manual Start/End edit. Left open, it would keep
  // showing an out-of-range empty state for a day no longer in the table.
  useEffect(() => {
    setOverheadBreakdownModal(null)
  }, [overheadDateStart, overheadDateEnd])

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

  // ——— "Three lenses" strip view model (Methods A/B/C, shared kernel) ———
  const lensLoading = overheadRateLenses.loading
  const lensWindowLabel =
    overheadRateLenses.windowStart && overheadRateLenses.windowEnd
      ? `${overheadRateLenses.windowStart} → ${overheadRateLenses.windowEnd}`
      : 'trailing 90 days'
  const lensPoolLabel = `the 90-day overhead pool (office labor + bid labor + office parts, ${lensWindowLabel})`
  const lensInclusionRule = 'Sessions counted: approved, not revoked, not rejected, clocked out.'
  const fmtLens = (v: number | null, render: (n: number) => string) =>
    lensLoading ? '…' : v == null ? '—' : render(v)
  // Live cents interpolation for the Method C blurb ("…"/"—" fallbacks).
  const lensCentsC = lensLoading
    ? '…'
    : overheadRateLenses.methodC == null
      ? '—'
      : String(Math.round(overheadRateLenses.methodC * 100))
  const overheadLensCards = [
    {
      key: 'A',
      color: 'var(--text-blue-500)',
      label: 'A · per field hour',
      value: fmtLens(overheadRateLenses.methodA, (n) => `$${n.toFixed(2)}/hr`),
      formula: 'pool ÷ billable field hours',
      blurb:
        'Best for pricing labor. Every field hour must carry this much overhead — steady even when billing is lumpy, and it maps directly onto your hourly rates.',
      title: `Method A = ${lensPoolLabel} ÷ billable field hours: approved clock hours on non-office jobs-ledger work in the same 90-day window. ${lensInclusionRule}`,
    },
    {
      key: 'B',
      color: '#22c55e',
      label: 'B · per revenue $',
      value: fmtLens(overheadRateLenses.methodB, (n) => `${(n * 100).toFixed(1)}% of revenue`),
      formula: 'pool ÷ invoices sent',
      blurb:
        'Best for bidding. Add this percentage to any quote regardless of labor mix — it ties overhead to money actually invoiced, but swings when invoicing is uneven.',
      title: `Method B = ${lensPoolLabel} ÷ invoices sent: jobs_ledger_invoices.amount sent to customers in the same 90-day window (Chicago calendar days). ${lensInclusionRule}`,
    },
    {
      key: 'C',
      color: '#f59e0b',
      label: 'C · per labor $',
      value: fmtLens(overheadRateLenses.methodC, (n) => `$${n.toFixed(2)} / $1 labor`),
      formula: 'pool ÷ direct field labor $',
      blurb: `Best as a labor burden. Every wage dollar carries ${lensCentsC}¢ of overhead — the classic construction multiplier, and it scales with crew cost, so expensive crews carry more.`,
      title: `Method C = ${lensPoolLabel} ÷ direct field labor $: the same field sessions × each person's hourly wage from pay config. ${lensInclusionRule}`,
    },
  ]

  // ——— Maintenance-hygiene strip view model (kernel: overheadHygiene) ———
  // One card per dirty indicator; the whole strip hides when all three are
  // clean (or while the 90-day scan is loading / failed).
  const fmtHygieneHours = (h: number) => `${(Math.round(h * 10) / 10).toLocaleString('en-US')}h`
  const overheadHygieneCards: Array<{ key: string; label: string; value: string; hint: string; title: string }> = []
  if (overheadHygiene.summary && !overheadHygiene.loading) {
    const { pending, unpriced, unassignedSalary } = overheadHygiene.summary
    if (pending.closedCount + pending.openCount > 0) {
      const parts: string[] = []
      if (pending.closedCount > 0) {
        parts.push(
          `${pending.closedCount} closed session${pending.closedCount === 1 ? '' : 's'} · ${fmtHygieneHours(pending.closedHours)}`,
        )
      }
      if (pending.openCount > 0) parts.push(`${pending.openCount} still open`)
      overheadHygieneCards.push({
        key: 'pending',
        label: 'Pending approvals (90d)',
        value: parts.join(' + '),
        hint: 'Approve in People → Hours.',
        title: `Sessions in the 90-day window (${lensWindowLabel}) with no approval, rejection, or revocation — covers office/bid sessions and field sessions assigned to a job (unassigned salary time is its own indicator). Unapproved sessions are excluded from the overhead pool and the Method A/C denominators until approved; still-open sessions have no hours yet.`,
      })
    }
    if (unpriced.sessionCount > 0) {
      overheadHygieneCards.push({
        key: 'unpriced',
        label: 'Unpriced hours (90d)',
        value: `${formatOverheadHygienePersonNames(unpriced.personNames)} · ${fmtHygieneHours(unpriced.hours)} at $0`,
        hint: 'Set wages in People → Pay config.',
        title: `Approved, closed sessions in the 90-day window (${lensWindowLabel}) whose person has no wage match in pay config — the hours still count (Method A's denominator stays full) but the dollars price at $0, deflating the overhead pool and Method C.`,
      })
    }
    if (unassignedSalary && unassignedSalary.sessionCount > 0) {
      overheadHygieneCards.push({
        key: 'unassigned-salary',
        label: 'Unassigned salary time (90d)',
        value: `${unassignedSalary.sessionCount} session${unassignedSalary.sessionCount === 1 ? '' : 's'} · ${fmtHygieneHours(unassignedSalary.hours)} · ${formatOverheadHygienePersonNames(unassignedSalary.personNames)}`,
        hint: 'Assign sessions to the office job or a bid (My Time / session assign).',
        title: `Salary-schedule sessions in the 90-day window (${lensWindowLabel}) with no job and no bid assigned — this time is invisible to the overhead pool entirely until assigned, regardless of approval status.`,
      })
    }
  }

  return (
    <div style={{ marginBottom: '2rem' }}>
      {Object.keys(overheadLoadErrorBySource).length > 0 ? (
        <div
          role="alert"
          style={{
            marginBottom: '1rem',
            padding: '0.5rem 0.75rem',
            border: '1px solid #fecaca',
            borderRadius: 6,
            background: 'var(--bg-red-tint)',
            color: 'var(--text-red-700)',
            fontSize: '0.875rem',
          }}
        >
          {Object.values(overheadLoadErrorBySource).map((msg) => (
            <p key={msg} style={{ margin: 0 }}>
              {msg}
            </p>
          ))}
        </div>
      ) : null}
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
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ marginBottom: '0.5rem' }}>
          <strong style={{ color: 'var(--text-strong)', fontSize: '0.9375rem' }}>
            Overhead rate — three lenses
          </strong>
          <span style={{ marginLeft: '0.5rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            same 90-day pool (office labor + bid labor + office parts), three denominators
          </span>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
            gap: '0.5rem',
          }}
        >
          {overheadLensCards.map((card) => (
            <button
              type="button"
              key={card.key}
              title={card.title}
              onClick={() => setOverheadLensModal(card.key as OverheadLensKey)}
              style={{
                border: '1px solid var(--border)',
                borderRadius: 6,
                background: 'var(--bg-page)',
                padding: '0.6rem 0.75rem',
                textAlign: 'left',
                font: 'inherit',
                color: 'inherit',
                cursor: 'pointer',
              }}
            >
              <div
                style={{
                  color: card.color,
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  letterSpacing: '0.02em',
                }}
              >
                {card.label}
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-strong)', margin: '0.15rem 0' }}>
                {card.value}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{card.formula}</div>
              <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.75rem', color: 'var(--text-faint)', lineHeight: 1.4 }}>
                {card.blurb}
              </p>
              <div style={{ marginTop: '0.4rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-blue-500)' }}>
                See the math ›
              </div>
            </button>
          ))}
        </div>
        <p style={{ margin: '0.4rem 0 0 0', fontSize: '0.75rem', color: 'var(--text-faint)' }}>
          These are reference rates — Team Summary&rsquo;s &ldquo;Profit (after overhead)&rdquo; uses the split model,
          not these.
        </p>
      </div>
      <OverheadPoolTrendCard trend={overheadPoolTrend.trend} loading={overheadPoolTrend.loading} windowLabel={lensWindowLabel} />
      {overheadLensModal ? (
        <OverheadLensModal
          lens={overheadLensModal}
          windowLabel={lensWindowLabel}
          pool={overheadPoolTrend.trend?.totals ?? null}
          rates={{ A: overheadRateLenses.methodA, B: overheadRateLenses.methodB, C: overheadRateLenses.methodC }}
          detail={overheadLensDetail}
          onClose={() => setOverheadLensModal(null)}
        />
      ) : null}
      {overheadHygieneCards.length > 0 ? (
        <div
          role="note"
          aria-label="Overhead maintenance indicators"
          style={{
            marginBottom: '1rem',
            border: '1px solid var(--border-amber)',
            background: 'var(--bg-amber-tint)',
            borderRadius: 8,
            padding: '0.6rem 0.75rem',
          }}
        >
          <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-amber-900)' }}>
            ⚠ Maintenance — these are skewing the 90-day numbers above
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
              gap: '0.5rem 1rem',
              marginTop: '0.4rem',
            }}
          >
            {overheadHygieneCards.map((card) => (
              <div key={card.key} title={card.title} style={{ fontSize: '0.8125rem' }}>
                <div style={{ fontWeight: 650, color: 'var(--text-amber-900)' }}>{card.label}</div>
                <div style={{ color: 'var(--text-strong)', margin: '0.1rem 0' }}>{card.value}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-amber-800)' }}>{card.hint}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
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
                                aria-label={`Office total for ${row.work_date}: $${formatCurrency(row.totalUsd)}, ${row.totalLaborHours.toFixed(2)} hours office and bid labor`}
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
                                aria-label={`Field total for ${row.work_date}: $${formatCurrency(row.otherJobsUsd)}, ${row.otherJobsLaborHours.toFixed(2)} hours jobs-ledger labor`}
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
                                aria-label={`Office total for ${row.work_date}: $${formatCurrency(row.totalUsd)}, ${row.totalLaborHours.toFixed(2)} hours office and bid labor`}
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
                                aria-label={`Field total for ${row.work_date}: $${formatCurrency(row.otherJobsUsd)}, ${row.otherJobsLaborHours.toFixed(2)} hours jobs-ledger labor`}
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
                    Total: ${formatCurrency(overheadBreakdownModalModel.totalPartsUsd)}
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
                      Internal Transfers (excluded): $
                      {formatCurrency(overheadBreakdownModalModel.internalTransferUsd)}
                    </p>
                  ) : null}
                </>
              ) : overheadBreakdownModalModel.scope === 'total' ? (
                <>
                  <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.875rem' }}>
                    Labor: {overheadBreakdownModalModel.totalHours.toFixed(2)}h — $
                    {formatCurrency(overheadBreakdownModalModel.totalLaborUsd)}
                  </p>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem' }}>
                    Office materials: ${formatCurrency(overheadBreakdownModalModel.totalPartsUsd)}
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
                      Internal Transfers (excluded): $
                      {formatCurrency(overheadBreakdownModalModel.internalTransferUsd)}
                    </p>
                  ) : null}
                  <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.875rem', fontWeight: 600 }}>
                    Total: ${formatCurrency(overheadBreakdownModalModel.grandTotalUsd)}
                  </p>
                </>
              ) : overheadBreakdownModalModel.scope === 'otherJobs' ? (
                <>
                  <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.875rem' }}>
                    Labor: {overheadBreakdownModalModel.totalHours.toFixed(2)}h — $
                    {formatCurrency(overheadBreakdownModalModel.totalLaborUsd)}
                  </p>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem' }}>
                    Materials: ${formatCurrency(overheadBreakdownModalModel.totalPartsUsd)}
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
                      Internal Transfers (excluded): $
                      {formatCurrency(overheadBreakdownModalModel.internalTransferUsd)}
                    </p>
                  ) : null}
                  <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.875rem', fontWeight: 600 }}>
                    Combined: ${formatCurrency(overheadBreakdownModalModel.grandTotalUsd)}
                  </p>
                </>
              ) : (
                <>
                  <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.875rem', color: 'var(--text-600)' }}>
                    Approved, closed sessions in this category. Labor $ = hours × hourly wage from pay config.
                  </p>
                  <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.875rem', fontWeight: 600 }}>
                    Totals: {overheadBreakdownModalModel.totalHours.toFixed(2)}h — $
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
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-600)' }}>
                    <OverheadPartsSectionsList
                      sections={overheadBreakdownModalModel.partsSections}
                      cardLabelForLine={overheadCardLabelForLine}
                    />
                  </div>
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
                      <OverheadPartsSectionsList
                        sections={overheadBreakdownModalModel.partsSections}
                        cardLabelForLine={overheadCardLabelForLine}
                      />
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
                      <OverheadPartsSectionsList sections={overheadBreakdownModalModel.partsSections} />
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
                user); for dual-rate people (an <strong>office hourly wage</strong> set in pay config), office and bid
                labor is valued at the <strong>office rate</strong> — matching what payroll pays for that time.{' '}
                <strong>Office parts ($)</strong> sums materials on the office job (Mercury allocations by posted
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
                                hcp_number: effectiveJobLedgerNumber(j.hcp_number, j.click_number) || null,
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
                        <UnifiedSearchResultRow
                          result={{ source: 'job', ...j }}
                          prefixMap={overheadPrefixMap}
                          jobEvidence={overheadJobEvidence.get(j.id)}
                          evidenceMode={overheadEvidenceMode}
                        />
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
