import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { PayConfigRow as PayConfigRowFull } from '../../types/peoplePayConfig'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useRealtimeChannel } from '../../hooks/useRealtimeChannel'
import { useReportQuickfillSectionMetric } from '../../contexts/QuickfillSectionMetricsContext'
import { fetchOverheadOfficeJobLedgerIdFromAppSettings } from '../../lib/overheadOfficeJobSettings'
import {
  type OverheadClockSessionRow,
} from '../../lib/overheadDailyLabor'
import {
  buildWorkDateListInclusive,
  computeUnallocatedFieldRows,
  summarizeUnallocatedFieldRows,
  type PeopleHoursUnallocatedCrewInput,
  type PeopleHoursUnallocatedPayConfigInput,
  type PeopleHoursUnallocatedRow,
} from '../../lib/peopleHoursUnallocatedRows'
import { Link } from 'react-router-dom'
import { MatchClockSessionsInline } from '../people/MatchClockSessionsModal'
import { teamBoardHref, unassignedWeekCards } from '../../lib/unassignedFieldTimeCard'
import { isAssistantLike } from '../../lib/subcontractorLikeRole'

/** Narrow view of the canonical pay-config row (single source of truth for field types). */
type PayConfigRow = Pick<PayConfigRowFull, 'person_name' | 'person_id' | 'is_salary' | 'record_hours_but_salary'>

type CrewJobsRow = {
  work_date: string
  person_name: string
  person_id: string | null
  job_assignments: Array<{ job_id: string; pct: number }>
}

type CrewBidsRow = {
  work_date: string
  person_name: string
  person_id: string | null
  bid_assignments: Array<{ bid_id: string; pct: number }>
}

const WINDOW_OPTIONS: ReadonlyArray<{ value: number; label: string }> = [
  { value: 3, label: 'Last 3 days' },
  { value: 7, label: 'Last 7 days' },
  { value: 14, label: 'Last 14 days' },
  { value: 30, label: 'Last 30 days' },
]

const THRESHOLD_OPTIONS: ReadonlyArray<{ value: number; label: string }> = [
  { value: 0.25, label: '≥ 0.25 h' },
  { value: 0.5, label: '≥ 0.5 h' },
  { value: 1, label: '≥ 1 h' },
  { value: 2, label: '≥ 2 h' },
  { value: 4, label: '≥ 4 h' },
]

const STORAGE_WINDOW_KEY = 'quickfill_unassigned_field_window_days'
const STORAGE_THRESHOLD_KEY = 'quickfill_unassigned_field_threshold'

function readStoredNumber(key: string, fallback: number, allowed: ReadonlyArray<number>): number {
  try {
    if (typeof localStorage === 'undefined') return fallback
    const raw = localStorage.getItem(key)
    if (raw == null) return fallback
    const n = Number.parseFloat(raw)
    if (!Number.isFinite(n)) return fallback
    return allowed.includes(n) ? n : fallback
  } catch {
    return fallback
  }
}

function writeStoredNumber(key: string, value: number): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(key, String(value))
  } catch {
    /* ignore */
  }
}

function todayLocalYmd(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function ymdMinusDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatShortDay(ymd: string): string {
  try {
    return new Date(ymd + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch {
    return ymd
  }
}

function formatWeekRange(startYmd: string, endYmd: string): string {
  return `${formatShortDay(startYmd)} – ${formatShortDay(endYmd)}`
}

function fmtH(n: number): string {
  if (!Number.isFinite(n) || Math.abs(n) < 0.005) return '0'
  return n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 })
}

const sectionWrapStyle: CSSProperties = { marginBottom: '2rem' }
const controlsRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: '0.75rem 1.25rem',
  marginBottom: '0.75rem',
}
const labeledControlStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.4rem',
  fontSize: '0.875rem',
  color: 'var(--text-slate-600)',
}
const selectStyle: CSSProperties = {
  padding: '0.3rem 0.4rem',
  border: '1px solid var(--border-strong)',
  borderRadius: 4,
  fontSize: '0.875rem',
  background: 'var(--surface)',
}
const summaryStyle: CSSProperties = {
  fontSize: '0.875rem',
  color: 'var(--text-slate-600)',
}
const cardStyle: CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 8,
  background: 'var(--surface)',
  padding: '0.85rem 1rem',
  marginBottom: '1rem',
  display: 'grid',
  gap: '0.6rem',
}
const cardHeadStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: '0.6rem 1rem',
  flexWrap: 'wrap',
}
const bigCountStyle: CSSProperties = {
  fontSize: '1.5rem',
  fontWeight: 700,
  color: 'var(--text-amber-700)',
  fontVariantNumeric: 'tabular-nums',
  lineHeight: 1.1,
}
const bigCountClearStyle: CSSProperties = { ...bigCountStyle, color: 'var(--text-green-700)' }
const weekRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem 1rem',
  flexWrap: 'wrap',
  padding: '0.45rem 0',
  borderTop: '1px solid var(--border)',
  fontSize: '0.875rem',
}
const weekLabelStyle: CSSProperties = { fontWeight: 600, color: 'var(--text-slate-900)', minWidth: '9.5rem' }
const weekMetaStyle: CSSProperties = { color: 'var(--text-slate-600)', fontVariantNumeric: 'tabular-nums' }
const boardLinkStyle: CSSProperties = {
  marginLeft: 'auto',
  padding: '0.3rem 0.6rem',
  border: '1px solid #2563eb',
  borderRadius: 4,
  background: 'var(--bg-blue-tint)',
  color: 'var(--text-blue-700)',
  textDecoration: 'none',
  fontSize: '0.8125rem',
  fontWeight: 500,
  whiteSpace: 'nowrap',
}

export function QuickfillUnassignedFieldTimeSection() {
  const { user: authUser } = useAuth()

  const [canAccess, setCanAccess] = useState(false)
  const [accessChecked, setAccessChecked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [windowDays, setWindowDays] = useState<number>(() =>
    readStoredNumber(
      STORAGE_WINDOW_KEY,
      14,
      WINDOW_OPTIONS.map((o) => o.value),
    ),
  )
  const [thresholdHours, setThresholdHours] = useState<number>(() =>
    readStoredNumber(
      STORAGE_THRESHOLD_KEY,
      1,
      THRESHOLD_OPTIONS.map((o) => o.value),
    ),
  )

  const [payConfig, setPayConfig] = useState<PayConfigRow[]>([])
  const [crewRows, setCrewRows] = useState<PeopleHoursUnallocatedCrewInput[]>([])
  const [overheadSessions, setOverheadSessions] = useState<OverheadClockSessionRow[]>([])
  const [officeJobLedgerId, setOfficeJobLedgerId] = useState<string | null>(null)

  const windowEndYmd = useMemo(() => todayLocalYmd(), [])
  const windowStartYmd = useMemo(() => ymdMinusDays(windowDays - 1), [windowDays])
  const workDates = useMemo(
    () => buildWorkDateListInclusive(windowStartYmd, windowEndYmd),
    [windowStartYmd, windowEndYmd],
  )

  useEffect(() => {
    writeStoredNumber(STORAGE_WINDOW_KEY, windowDays)
  }, [windowDays])
  useEffect(() => {
    writeStoredNumber(STORAGE_THRESHOLD_KEY, thresholdHours)
  }, [thresholdHours])

  const loadAccess = useCallback(async () => {
    if (!authUser?.id) {
      setCanAccess(false)
      setAccessChecked(true)
      return
    }
    try {
      const [meRes, approvedRes] = await Promise.all([
        supabase.from('users').select('role').eq('id', authUser.id).single(),
        supabase.from('pay_approved_masters').select('master_id'),
      ])
      const role = (meRes.data as { role?: string } | null)?.role ?? null
      const approvedIds = new Set(
        (approvedRes.data ?? []).map((r: { master_id: string }) => r.master_id),
      )
      const allowed =
        role === 'dev' ||
        isAssistantLike(role) ||
        (role === 'master_technician' && approvedIds.has(authUser.id))
      setCanAccess(allowed)
    } catch (e) {
      setCanAccess(false)
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setAccessChecked(true)
    }
  }, [authUser?.id])

  useEffect(() => {
    void loadAccess()
  }, [loadAccess])

  const loadAll = useCallback(async () => {
    if (!canAccess) return
    setLoading(true)
    setError(null)
    try {
      // v2.546: drop people_hours from the load — Unassigned field time now
      // computes dayHoursRaw straight from approved clock sessions, so manual
      // grid overrides and pending sessions can't influence what surfaces.
      const [payRes, crewJobsRes, crewBidsRes, sessionsRes, officeId] = await Promise.all([
        // RPC (non-wage flags only): assistants can't SELECT people_pay_config since the pay lockdown (v2.660).
        supabase.rpc('list_people_pay_flags'),
        supabase
          .from('people_crew_jobs')
          .select('work_date, person_name, person_id, job_assignments')
          .gte('work_date', windowStartYmd)
          .lte('work_date', windowEndYmd),
        supabase
          .from('people_crew_bids')
          .select('work_date, person_name, person_id, bid_assignments')
          .gte('work_date', windowStartYmd)
          .lte('work_date', windowEndYmd),
        supabase
          .from('clock_sessions')
          .select(
            'id, user_id, work_date, clocked_in_at, clocked_out_at, job_ledger_id, bid_id, approved_at, rejected_at, revoked_at, users!clock_sessions_user_id_fkey(name)',
          )
          .gte('work_date', windowStartYmd)
          .lte('work_date', windowEndYmd)
          .not('approved_at', 'is', null)
          .is('rejected_at', null)
          .is('revoked_at', null)
          .not('clocked_out_at', 'is', null),
        fetchOverheadOfficeJobLedgerIdFromAppSettings(),
      ])

      if (payRes.error) throw payRes.error
      if (crewJobsRes.error) throw crewJobsRes.error
      if (crewBidsRes.error) throw crewBidsRes.error
      if (sessionsRes.error) throw sessionsRes.error

      setPayConfig((payRes.data ?? []) as PayConfigRow[])
      setOfficeJobLedgerId(officeId)

      const jobsRows = (crewJobsRes.data ?? []) as CrewJobsRow[]
      const bidsRows = (crewBidsRes.data ?? []) as CrewBidsRow[]

      const jobsByKey = new Map<string, CrewJobsRow>()
      for (const r of jobsRows) jobsByKey.set(`${r.work_date}|${r.person_name}`, r)
      const bidsByKey = new Map<string, CrewBidsRow>()
      for (const r of bidsRows) bidsByKey.set(`${r.work_date}|${r.person_name}`, r)
      const allKeys = new Set<string>([...jobsByKey.keys(), ...bidsByKey.keys()])

      const merged: PeopleHoursUnallocatedCrewInput[] = []
      for (const k of allKeys) {
        const sep = k.indexOf('|')
        const workDate = k.slice(0, sep)
        const personName = k.slice(sep + 1)
        const j = jobsByKey.get(k)
        const b = bidsByKey.get(k)
        const jobAssignments = Array.isArray(j?.job_assignments) ? j!.job_assignments : []
        const bidAssignments = Array.isArray(b?.bid_assignments) ? b!.bid_assignments : []
        merged.push({
          work_date: workDate,
          person_name: personName,
          // C1-3d (identity): crew-row person_id for id-first flag resolution.
          person_id: j?.person_id ?? b?.person_id ?? null,
          job_assignments: jobAssignments,
          bid_assignments: bidAssignments,
        })
      }
      setCrewRows(merged)

      type RawSession = {
        id: string
        user_id: string
        work_date: string
        clocked_in_at: string
        clocked_out_at: string | null
        job_ledger_id: string | null
        bid_id: string | null
        approved_at: string | null
        rejected_at: string | null
        revoked_at: string | null
        users: { name: string | null } | { name: string | null }[] | null
      }
      const rawSessions = (sessionsRes.data ?? []) as RawSession[]
      const normalized: OverheadClockSessionRow[] = rawSessions.map((s) => {
        const usersRaw = s.users
        const usersValue: { name: string | null } | null = Array.isArray(usersRaw)
          ? (usersRaw[0] ?? null)
          : (usersRaw ?? null)
        return {
          id: s.id,
          user_id: s.user_id,
          work_date: s.work_date,
          clocked_in_at: s.clocked_in_at,
          clocked_out_at: s.clocked_out_at,
          job_ledger_id: s.job_ledger_id,
          bid_id: s.bid_id,
          approved_at: s.approved_at,
          rejected_at: s.rejected_at,
          revoked_at: s.revoked_at,
          users: usersValue,
        }
      })
      setOverheadSessions(normalized)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [canAccess, windowStartYmd, windowEndYmd])

  const loadAllRef = useRef(loadAll)
  loadAllRef.current = loadAll
  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const unassignedFieldTimeFilters = useMemo(
    () => [
      { event: '*' as const, schema: 'public', table: 'people_crew_jobs' },
      { event: '*' as const, schema: 'public', table: 'people_crew_bids' },
      { event: '*' as const, schema: 'public', table: 'clock_sessions' },
    ],
    [],
  )
  useRealtimeChannel(
    canAccess,
    'quickfill-unassigned-field-time',
    unassignedFieldTimeFilters,
    () => {
      void loadAllRef.current()
    },
    { debounceMs: 500 },
  )

  const payConfigForHelper: PeopleHoursUnallocatedPayConfigInput[] = useMemo(
    () =>
      payConfig.map((c) => ({
        person_name: c.person_name,
        // C1-3d (identity): the flags RPC returns person_id — pass it through
        // so the kernel resolves flags id-first with name fallback.
        person_id: c.person_id ?? null,
        is_salary: !!c.is_salary,
        record_hours_but_salary: !!c.record_hours_but_salary,
      })),
    [payConfig],
  )

  const rows = useMemo<PeopleHoursUnallocatedRow[]>(() => {
    if (!canAccess) return []
    return computeUnallocatedFieldRows({
      payConfig: payConfigForHelper,
      crewRows,
      overheadSessions,
      officeJobLedgerId,
      workDates,
      thresholdHours,
    })
  }, [
    canAccess,
    payConfigForHelper,
    crewRows,
    overheadSessions,
    officeJobLedgerId,
    workDates,
    thresholdHours,
  ])

  const summary = useMemo(() => summarizeUnallocatedFieldRows(rows), [rows])
  const weekCards = useMemo(() => unassignedWeekCards(rows), [rows])

  useReportQuickfillSectionMetric(
    'unassigned-field-time',
    !accessChecked || !canAccess ? null : loading ? null : summary.rowCount,
    !!(canAccess && loading),
  )

  if (accessChecked && !canAccess) {
    return (
      <section style={sectionWrapStyle}>
        <p style={{ color: 'var(--text-muted)' }}>
          You do not have access to view unassigned field time (requires dev, assistant, or master technician with pay-approved access).
        </p>
      </section>
    )
  }

  return (
    <section style={sectionWrapStyle}>
      <p style={{ color: 'var(--text-slate-600)', fontSize: '0.875rem', margin: '0 0 0.75rem' }}>
        Days where a person was paid (salary or hourly) for field-type time that is not on a job.
        The fix lives on the Team board: each person-day is a chip in its <strong>No job on the session</strong> row,
        with the dispatch block beside it and a one-tap link.
      </p>

      <div style={controlsRowStyle}>
        <label style={labeledControlStyle}>
          <span>Window</span>
          <select
            value={windowDays}
            onChange={(e) => setWindowDays(Number.parseInt(e.target.value, 10))}
            style={selectStyle}
            aria-label="Window of days to scan"
          >
            {WINDOW_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label style={labeledControlStyle}>
          <span>Threshold</span>
          <select
            value={thresholdHours}
            onChange={(e) => setThresholdHours(Number.parseFloat(e.target.value))}
            style={selectStyle}
            aria-label="Minimum unassigned hours per day"
          >
            {THRESHOLD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <p style={{ color: 'var(--text-red-700)', marginBottom: '0.75rem', fontSize: '0.875rem' }}>
          {error}
        </p>
      )}

      <div style={cardStyle} aria-label="Unassigned field time summary">
        <div style={cardHeadStyle}>
          {loading ? (
            <span style={summaryStyle}>Loading…</span>
          ) : summary.rowCount === 0 ? (
            <>
              <span style={bigCountClearStyle}>All on a job</span>
              <span style={summaryStyle}>
                {`Every paid field hour in the last ${windowDays} days is on a job (≥ ${thresholdHours} h per day).`}
              </span>
              <Link to={teamBoardHref()} style={boardLinkStyle}>
                Open Team board →
              </Link>
            </>
          ) : (
            <>
              <span style={bigCountStyle}>
                {summary.rowCount} {summary.rowCount === 1 ? 'person-day' : 'person-days'}
              </span>
              <span style={summaryStyle}>
                {`${fmtH(summary.totalUnallocatedHrs)} h not on a job across ${summary.peopleCount} ${
                  summary.peopleCount === 1 ? 'person' : 'people'
                } · last ${windowDays} days`}
              </span>
            </>
          )}
        </div>
        {!loading &&
          weekCards.map((w) => (
            <div key={w.weekStart} style={weekRowStyle}>
              <span style={weekLabelStyle}>{formatWeekRange(w.weekStart, w.weekEnd)}</span>
              <span style={weekMetaStyle}>
                {`${w.rowCount} ${w.rowCount === 1 ? 'person-day' : 'person-days'} · ${fmtH(w.totalUnallocatedHrs)} h · ${
                  w.peopleCount
                } ${w.peopleCount === 1 ? 'person' : 'people'}`}
              </span>
              <Link
                to={teamBoardHref({ week: w.latestWorkDate, onlyExceptions: true })}
                style={boardLinkStyle}
                aria-label={`Open the Team board for the week of ${formatShortDay(w.weekStart)}`}
              >
                Open on Team board →
              </Link>
            </div>
          ))}
      </div>

      {/* v2.1656 added the People → Hours "Match sessions" flow here behind a
          button; now its contents render spread out on the page (owner
          request), hidden entirely when the 7-day window is clear. */}
      <MatchClockSessionsInline />
    </section>
  )
}
