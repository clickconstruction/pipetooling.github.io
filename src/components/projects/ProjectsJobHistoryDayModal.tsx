/**
 * Projects → Job History "day cell" detail modal.
 *
 * Opens when the user clicks a highlighted (numbered) day inside a job bar. Shows
 *   1. Two top-of-modal action buttons: "Open Edit Job" and "Open Job Detail" for the job
 *   2. People & clock sessions for that (job, Chicago work_date) — grouped by user, with
 *      clock-in/out times and any per-session notes
 *   3. Reports filed for that job whose `created_at` falls on the same Chicago calendar day
 *
 * Pure read-only view: no mutation, just queries. Closes on Escape, backdrop click, or the
 * Close button. Action buttons call the supplied `onOpenEditJob` / `onOpenJobDetail`
 * callbacks (the host wires those to `useJobFormModal` / `useJobDetailModal` so the parent
 * modals stack on top with their own z-index).
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { supabase } from '../../lib/supabase'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import {
  APP_CALENDAR_TZ,
  calendarYmdInAppTzFromIso,
  referenceDateForWorkDateYmd,
  ymdAddDays,
} from '../../utils/dateUtils'
import { fetchUserNamesForIds } from '../../lib/scheduleDispatchHub'
import { displayReportTemplateName } from '../../lib/reportTemplateDisplayName'
import {
  peopleCountColor,
  type ProjectsJobHistoryBar,
} from '../../lib/projectsJobHistoryData'
import { ReportDetailBody, type ReportForView } from '../ReportViewModal'
import type { UserRole } from '../../hooks/useAuth'
import { useNarrowViewport640 } from '../../hooks/useNarrowViewport640'
import { buildHourlyWageLookupByNormalizedName } from '../../lib/bidBoardWeeklyEstimatorLaborCost'
import {
  buildDayCostBreakdown,
  formatUsd,
  type DayCostMercuryAllocationInput,
  type DayCostSupplyAllocationInput,
  type DayLaborLine,
  type DayMercuryLine,
  type DaySupplyLine,
} from '../../lib/projectsJobHistoryDayCosts'

const Z_INDEX = 1040

type ClockSessionRow = {
  id: string
  user_id: string
  clocked_in_at: string
  clocked_out_at: string | null
  notes: string | null
}

type ReportRow = ReportForView & {
  job_ledger_id: string | null
  created_by_user_id?: string | null
}

type Props = {
  open: boolean
  onClose: () => void
  jobId: string
  /** Display only: e.g. "HCP123 · Acme HVAC" — passed in pre-formatted with any trade prefix. */
  jobTitle: string
  workDateYmd: string
  /**
   * The Gantt bar the user clicked from. Used to render a small mockup at the top of the modal
   * (5 days before + selected + 5 days after) so the user can orient themselves and confirm
   * they picked the right day.
   */
  bar: ProjectsJobHistoryBar
  /** Today in Chicago tz, YYYY-MM-DD. Drives the today accent in the mini Gantt. */
  todayYmd: string
  authUserId: string | null
  userRole: UserRole | null
  onOpenEditJob: () => void
  onOpenJobDetail: () => void
  /**
   * Click a different day in the mini-Gantt → swap the modal to that day. Optional; when
   * omitted the strip is read-only (defensive — the host parent always wires this today).
   */
  onSelectWorkDate?: (ymd: string) => void
}

type SessionsByUser = {
  userId: string
  userName: string
  sessions: ClockSessionRow[]
}

/** The three expandable rows under "Costs on this day". */
type CostRowKey = 'labor' | 'mercury' | 'supply'

function formatChicagoTime(iso: string | null): string {
  if (!iso) return '— still clocked in'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('en-US', {
    timeZone: APP_CALENDAR_TZ,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d)
}

function formatSessionDuration(s: { clocked_in_at: string; clocked_out_at: string | null }): string {
  if (!s.clocked_out_at) return ''
  const inMs = new Date(s.clocked_in_at).getTime()
  const outMs = new Date(s.clocked_out_at).getTime()
  if (Number.isNaN(inMs) || Number.isNaN(outMs) || outMs <= inMs) return ''
  const totalMinutes = Math.round((outMs - inMs) / 60_000)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

/** Sum of closed-session minutes (open sessions contribute 0). */
function sumSessionMinutes(rows: readonly { clocked_in_at: string; clocked_out_at: string | null }[]): number {
  let total = 0
  for (const r of rows) {
    if (!r.clocked_out_at) continue
    const inMs = new Date(r.clocked_in_at).getTime()
    const outMs = new Date(r.clocked_out_at).getTime()
    if (Number.isNaN(inMs) || Number.isNaN(outMs) || outMs <= inMs) continue
    total += Math.round((outMs - inMs) / 60_000)
  }
  return total
}

/** "6h 45m" / "45m" / "—" — used for the People & sessions summary line. */
function formatHoursMinutes(totalMinutes: number): string {
  if (totalMinutes <= 0) return '—'
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

function formatHeadingDate(workDateYmd: string): string {
  const d = referenceDateForWorkDateYmd(workDateYmd)
  return new Intl.DateTimeFormat('en-US', {
    timeZone: APP_CALENDAR_TZ,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d)
}

/** Short "April 8" format for inline section headings — no year, no weekday. */
function formatMonthDay(workDateYmd: string): string {
  const d = referenceDateForWorkDateYmd(workDateYmd)
  return new Intl.DateTimeFormat('en-US', {
    timeZone: APP_CALENDAR_TZ,
    month: 'long',
    day: 'numeric',
  }).format(d)
}

export function ProjectsJobHistoryDayModal({
  open,
  onClose,
  jobId,
  jobTitle,
  workDateYmd,
  bar,
  todayYmd,
  authUserId,
  userRole,
  onOpenEditJob,
  onOpenJobDetail,
  onSelectWorkDate,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessions, setSessions] = useState<ClockSessionRow[]>([])
  const [userNames, setUserNames] = useState<Map<string, string>>(() => new Map())
  const [reports, setReports] = useState<ReportRow[]>([])
  const [expandedReportIds, setExpandedReportIds] = useState<Set<string>>(() => new Set())
  // Raw allocation rows for the job — pure aggregation happens in `buildDayCostBreakdown`
  // against the modal's `workDateYmd`, so a single fetch survives any later date-range tweaks.
  const [mercuryAllocs, setMercuryAllocs] = useState<DayCostMercuryAllocationInput[]>([])
  const [supplyAllocs, setSupplyAllocs] = useState<DayCostSupplyAllocationInput[]>([])
  const [wageByName, setWageByName] = useState<Map<string, number | null>>(() => new Map())
  // True iff any of the cost sub-queries (Mercury, supply, pay config) errored. We show a
  // small `Costs may be incomplete` footnote instead of throwing because the rest of the
  // modal is still useful with partial data.
  const [costsFetchFailed, setCostsFetchFailed] = useState(false)
  // Which Costs-on-this-day rows are showing their detail panel. Independent per category.
  // Cleared on `workDateYmd` change so the next day opens collapsed.
  const [expandedCostRows, setExpandedCostRows] = useState<Set<CostRowKey>>(() => new Set())

  const loadGenRef = useRef(0)

  useEffect(() => {
    if (!open || !jobId || !workDateYmd) return
    const gen = ++loadGenRef.current
    setLoading(true)
    setError(null)
    setSessions([])
    setReports([])
    setUserNames(new Map())
    setExpandedReportIds(new Set())
    setMercuryAllocs([])
    setSupplyAllocs([])
    setWageByName(new Map())
    setCostsFetchFailed(false)
    setExpandedCostRows(new Set())

    void (async () => {
      try {
        // Approved, closed sessions for this job on this Chicago work_date.
        const sessRows = (await withSupabaseRetry(
          async () =>
            supabase
              .from('clock_sessions')
              .select('id, user_id, clocked_in_at, clocked_out_at, notes')
              .eq('job_ledger_id', jobId)
              .eq('work_date', workDateYmd)
              .not('approved_at', 'is', null)
              .is('rejected_at', null)
              .is('revoked_at', null)
              .order('clocked_in_at', { ascending: true }),
          'fetch clock sessions for projects job schedule day modal',
        )) as unknown as ClockSessionRow[] | null
        if (gen !== loadGenRef.current) return
        const fetched: ClockSessionRow[] = (sessRows ?? []).map((r) => ({
          id: r.id,
          user_id: r.user_id,
          clocked_in_at: r.clocked_in_at,
          clocked_out_at: r.clocked_out_at,
          notes: typeof r.notes === 'string' ? r.notes : '',
        }))
        setSessions(fetched)

        const userIds = Array.from(new Set(fetched.map((s) => s.user_id))).filter(Boolean)
        if (userIds.length > 0) {
          const { data: nameMap, error: nameErr } = await fetchUserNamesForIds(userIds)
          if (gen !== loadGenRef.current) return
          if (nameErr) {
            // Soft-fail on name lookup — sessions still render with raw user_id labels.
            setUserNames(new Map())
          } else {
            setUserNames(nameMap)
          }
        }

        // Reports — filter the global RPC by job + same Chicago calendar day as `workDateYmd`.
        const { data: reportData, error: reportErr } = await supabase.rpc('list_reports_with_job_info')
        if (gen !== loadGenRef.current) return
        if (reportErr) {
          setError(formatErrorMessage(reportErr, 'Failed to load reports'))
        } else {
          const all = (reportData as ReportRow[]) ?? []
          const filtered = all.filter(
            (r) =>
              r.job_ledger_id === jobId &&
              calendarYmdInAppTzFromIso(r.created_at) === workDateYmd,
          )
          setReports(filtered)
          setExpandedReportIds(new Set(filtered.map((r) => r.id)))
        }

        // Costs — parallelize Mercury allocations, supply allocations, and pay config so
        // none of them block the others. Each individual failure marks `costsFetchFailed`
        // so the UI can flag partial totals without aborting the entire modal.
        const [mercuryRes, supplyRes, payRes] = await Promise.allSettled([
          withSupabaseRetry(
            async () =>
              supabase
                .from('mercury_transaction_job_allocations')
                .select('amount, note, mercury_transactions(posted_at, counterparty_name)')
                .eq('job_id', jobId),
            'projects day modal mercury allocations',
          ),
          withSupabaseRetry(
            async () =>
              supabase
                .from('supply_house_invoice_job_allocations')
                .select(
                  'pct, supply_house_invoices(invoice_date, amount, invoice_number, supply_houses(name))',
                )
                .eq('job_id', jobId),
            'projects day modal supply allocations',
          ),
          withSupabaseRetry(
            async () =>
              supabase
                .from('people_pay_config')
                .select('person_name, hourly_wage'),
            'projects day modal people_pay_config',
          ),
        ])
        if (gen !== loadGenRef.current) return

        if (mercuryRes.status === 'fulfilled') {
          const rows = (mercuryRes.value ?? []) as Array<{
            amount: number | string | null
            note: string | null
            mercury_transactions:
              | { posted_at: string | null; counterparty_name: string | null }
              | { posted_at: string | null; counterparty_name: string | null }[]
              | null
          }>
          const flat: DayCostMercuryAllocationInput[] = rows.map((row) => {
            const txNested = row.mercury_transactions
            const tx = Array.isArray(txNested) ? txNested[0] : txNested
            return {
              amount: row.amount,
              posted_at: tx?.posted_at ?? null,
              counterparty_name: tx?.counterparty_name ?? null,
              note: row.note ?? null,
            }
          })
          setMercuryAllocs(flat)
        } else {
          setCostsFetchFailed(true)
        }

        if (supplyRes.status === 'fulfilled') {
          const rows = (supplyRes.value ?? []) as Array<{
            pct: number | string | null
            supply_house_invoices:
              | {
                  invoice_date: string | null
                  amount: number | string | null
                  invoice_number: string | null
                  supply_houses:
                    | { name: string | null }
                    | { name: string | null }[]
                    | null
                }
              | {
                  invoice_date: string | null
                  amount: number | string | null
                  invoice_number: string | null
                  supply_houses:
                    | { name: string | null }
                    | { name: string | null }[]
                    | null
                }[]
              | null
          }>
          const flat: DayCostSupplyAllocationInput[] = rows.map((row) => {
            const invNested = row.supply_house_invoices
            const inv = Array.isArray(invNested) ? invNested[0] : invNested
            const shNested = inv?.supply_houses
            const sh = Array.isArray(shNested) ? shNested[0] : shNested
            return {
              pct: row.pct,
              invoice_amount: inv?.amount ?? null,
              invoice_date: inv?.invoice_date ?? null,
              invoice_number: inv?.invoice_number ?? null,
              supply_house_name: sh?.name ?? null,
            }
          })
          setSupplyAllocs(flat)
        } else {
          setCostsFetchFailed(true)
        }

        if (payRes.status === 'fulfilled') {
          const rows = (payRes.value ?? []) as Array<{
            person_name: string
            hourly_wage: number | null
          }>
          setWageByName(buildHourlyWageLookupByNormalizedName(rows))
        } else {
          setCostsFetchFailed(true)
        }
      } catch (e) {
        if (gen !== loadGenRef.current) return
        setError(formatErrorMessage(e, 'Failed to load day details'))
      } finally {
        if (gen === loadGenRef.current) setLoading(false)
      }
    })()
  }, [open, jobId, workDateYmd])

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  const grouped: SessionsByUser[] = useMemo(() => {
    const byUser = new Map<string, ClockSessionRow[]>()
    for (const s of sessions) {
      const arr = byUser.get(s.user_id) ?? []
      arr.push(s)
      byUser.set(s.user_id, arr)
    }
    const out: SessionsByUser[] = []
    for (const [userId, list] of byUser) {
      out.push({
        userId,
        userName: (userNames.get(userId) ?? '').trim() || 'Unknown user',
        sessions: list,
      })
    }
    out.sort((a, b) => a.userName.localeCompare(b.userName))
    return out
  }, [sessions, userNames])

  // Header summary for "People & sessions": man-hours (sum of closed session durations),
  // distinct people, and total session count. Open sessions contribute 0 to man-hours but
  // still count as a session and a person.
  const peopleAndSessionsSummary = useMemo(() => {
    const totalMinutes = sumSessionMinutes(sessions)
    const personCount = new Set(sessions.map((s) => s.user_id)).size
    const sessionCount = sessions.length
    return {
      manHoursLabel: formatHoursMinutes(totalMinutes),
      personCount,
      sessionCount,
    }
  }, [sessions])

  // Costs panel below People & sessions: pure aggregation against the raw rows fetched above.
  // Re-runs whenever sessions / names / wage map / Mercury / supply data changes.
  const dayCosts = useMemo(
    () =>
      buildDayCostBreakdown({
        sessions,
        userNamesById: userNames,
        wageByNormalizedName: wageByName,
        mercuryAllocations: mercuryAllocs,
        supplyAllocations: supplyAllocs,
        workDateYmd,
      }),
    [sessions, userNames, wageByName, mercuryAllocs, supplyAllocs, workDateYmd],
  )

  const toggleCostRow = useCallback((key: CostRowKey) => {
    setExpandedCostRows((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  function toggleReportExpanded(id: string) {
    setExpandedReportIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (!open) return null

  const headingDate = formatHeadingDate(workDateYmd)

  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: Z_INDEX,
        padding: '1rem',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="projects-job-history-day-modal-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          width: '100%',
          maxWidth: 720,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
        }}
      >
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            padding: '1rem 1.25rem 0.75rem',
            gap: '0.75rem',
            flexShrink: 0,
            borderBottom: '1px solid var(--border)',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ minWidth: 0, flex: '1 1 220px' }}>
            <h2
              id="projects-job-history-day-modal-title"
              style={{
                margin: 0,
                fontSize: '1.0625rem',
                fontWeight: 600,
                color: 'var(--text-slate-900)',
                wordBreak: 'break-word',
              }}
            >
              {jobTitle}
            </h2>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-slate-600)', marginTop: 2 }}>{headingDate}</div>
          </div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.5rem',
              alignItems: 'center',
              flexShrink: 0,
            }}
          >
            <button
              type="button"
              onClick={onOpenEditJob}
              style={{
                padding: '0.45rem 0.85rem',
                fontSize: '0.875rem',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              Open Edit Job
            </button>
            <button
              type="button"
              onClick={onOpenJobDetail}
              style={{
                padding: '0.45rem 0.85rem',
                fontSize: '0.875rem',
                background: 'var(--surface)',
                color: 'var(--text-sky-700)',
                border: '1px solid #2563eb',
                borderRadius: 6,
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              Open Job Detail
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{
                padding: '0.4rem 0.75rem',
                fontSize: '0.875rem',
                background: 'var(--surface)',
                border: '1px solid var(--border-strong)',
                borderRadius: 6,
                cursor: 'pointer',
                color: 'var(--text-700)',
              }}
            >
              Close
            </button>
          </div>
        </header>

        <div style={{ flex: 1, overflow: 'auto', padding: '1rem 1.25rem 1.25rem' }}>
          {error && (
            <p role="alert" style={{ color: 'var(--text-red-700)', margin: '0 0 0.75rem' }}>
              {error}
            </p>
          )}

          <section style={{ marginBottom: '1.25rem' }}>
            <DayContextMiniGantt
              bar={bar}
              selectedYmd={workDateYmd}
              todayYmd={todayYmd}
              onSelectDay={onSelectWorkDate}
            />
          </section>

          <section style={{ marginBottom: '1.25rem' }}>
            <h3 style={{ ...sectionHeadingStyle, textAlign: 'center' }}>
              {formatMonthDay(workDateYmd)} People &amp; sessions
            </h3>
            {loading ? (
              <p style={mutedStyle}>Loading…</p>
            ) : grouped.length === 0 ? (
              <p style={mutedStyle}>No approved clock sessions for this job on this day.</p>
            ) : (
              <>
                <div
                  aria-label="Summary for this job on this day"
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.5rem 1rem',
                    justifyContent: 'center',
                    textAlign: 'center',
                    padding: '0.5rem 0.75rem',
                    marginBottom: '0.6rem',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    background: 'var(--bg-slate-tint)',
                    fontSize: '0.875rem',
                    color: 'var(--text-slate-900)',
                  }}
                >
                  <span>
                    <span style={{ color: 'var(--text-slate-600)', marginRight: 4 }}>Man hours:</span>
                    <strong>{peopleAndSessionsSummary.manHoursLabel}</strong>
                  </span>
                  <span>
                    <span style={{ color: 'var(--text-slate-600)', marginRight: 4 }}>People:</span>
                    <strong>{peopleAndSessionsSummary.personCount}</strong>
                  </span>
                  <span>
                    <span style={{ color: 'var(--text-slate-600)', marginRight: 4 }}>Sessions:</span>
                    <strong>{peopleAndSessionsSummary.sessionCount}</strong>
                  </span>
                </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {grouped.map((g) => (
                  <li
                    key={g.userId}
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      padding: '0.75rem 0.85rem',
                      marginBottom: '0.5rem',
                      background: 'var(--surface)',
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 600,
                        color: 'var(--text-slate-900)',
                        fontSize: '0.9375rem',
                        marginBottom: '0.35rem',
                      }}
                    >
                      {g.userName}
                    </div>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {g.sessions.map((s, sessionIdx) => {
                        const span = `${formatChicagoTime(s.clocked_in_at)} → ${formatChicagoTime(s.clocked_out_at)}`
                        const dur = formatSessionDuration(s)
                        const note = (s.notes ?? '').trim()
                        return (
                          <li
                            key={s.id}
                            style={{
                              padding: '0.3rem 0',
                              borderTop: sessionIdx === 0 ? undefined : '1px dashed #f1f5f9',
                              fontSize: '0.875rem',
                              color: 'var(--text-slate-900)',
                              display: 'flex',
                              flexWrap: 'wrap',
                              alignItems: 'baseline',
                              gap: '0 0.4rem',
                            }}
                          >
                            {dur && (
                              <span style={{ color: 'var(--text-slate-600)' }}>[{dur}]</span>
                            )}
                            <span>{span}</span>
                            {note && (
                              <>
                                <span aria-hidden style={{ color: '#cbd5e1' }}>|</span>
                                <span
                                  style={{
                                    color: 'var(--text-slate-600)',
                                    whiteSpace: 'pre-wrap',
                                    fontSize: '0.8125rem',
                                  }}
                                >
                                  {note}
                                </span>
                              </>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  </li>
                ))}
              </ul>
              </>
            )}
          </section>

          <section style={{ marginBottom: '1.25rem' }}>
            <h3 style={{ ...sectionHeadingStyle, textAlign: 'center' }}>Costs on this day</h3>
            {loading ? (
              <p style={mutedStyle}>Loading…</p>
            ) : (
              <div
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  background: 'var(--surface)',
                  overflow: 'hidden',
                }}
              >
                {/* Team labor $ derives from wages — masters/devs only (pay lockdown v2.660). */}
                {userRole === 'dev' || userRole === 'master_technician' ? (
                  <DayCostRow
                    rowKey="labor"
                    label="Team labor"
                    value={formatUsd(dayCosts.laborUsd)}
                    note={
                      dayCosts.laborMissingWageNames.length > 0
                        ? `No hourly wage configured for ${dayCosts.laborMissingWageNames.join(', ')}`
                        : null
                    }
                    approximate={dayCosts.laborIncomplete}
                    expanded={expandedCostRows.has('labor')}
                    onToggle={toggleCostRow}
                    detailCount={dayCosts.laborLines.length}
                    emptyMessage="No clock sessions for this day."
                    detail={<DayLaborDetail lines={dayCosts.laborLines} />}
                  />
                ) : null}
                <DayCostRow
                  rowKey="mercury"
                  label="Card charges"
                  value={formatUsd(dayCosts.mercuryUsd)}
                  expanded={expandedCostRows.has('mercury')}
                  onToggle={toggleCostRow}
                  detailCount={dayCosts.mercuryLines.length}
                  emptyMessage="No Mercury card charges posted on this day."
                  detail={<DayMercuryDetail lines={dayCosts.mercuryLines} />}
                />
                <DayCostRow
                  rowKey="supply"
                  label="Supply invoices"
                  value={formatUsd(dayCosts.supplyUsd)}
                  expanded={expandedCostRows.has('supply')}
                  onToggle={toggleCostRow}
                  detailCount={dayCosts.supplyLines.length}
                  emptyMessage="No supply-house invoices dated this day."
                  detail={<DaySupplyDetail lines={dayCosts.supplyLines} />}
                />
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                    padding: '0.6rem 0.85rem',
                    borderTop: '1px solid var(--border)',
                    background: 'var(--bg-slate-tint)',
                  }}
                >
                  <span style={{ fontWeight: 600, color: 'var(--text-slate-900)' }}>
                    {userRole === 'dev' || userRole === 'master_technician' ? 'Total' : 'Total (excl. team labor)'}
                  </span>
                  <strong style={{ fontVariantNumeric: 'tabular-nums', fontSize: '1rem' }}>
                    {dayCosts.laborIncomplete ? '≥ ' : ''}
                    {formatUsd(
                      userRole === 'dev' || userRole === 'master_technician'
                        ? dayCosts.totalUsd
                        : dayCosts.totalUsd - dayCosts.laborUsd,
                    )}
                  </strong>
                </div>
              </div>
            )}
            {costsFetchFailed && (
              <p style={{ ...mutedStyle, marginTop: '0.4rem', fontSize: '0.75rem' }}>
                Some cost categories failed to load — totals shown may be incomplete.
              </p>
            )}
          </section>

          <section>
            <h3 style={sectionHeadingStyle}>Reports filed on this day</h3>
            {loading ? (
              <p style={mutedStyle}>Loading…</p>
            ) : reports.length === 0 ? (
              <p style={mutedStyle}>No reports filed for this job on this day.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {reports.map((r) => {
                  const isExpanded = expandedReportIds.has(r.id)
                  return (
                    <li
                      key={r.id}
                      style={{
                        marginBottom: '0.5rem',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        background: 'var(--surface)',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '0.5rem',
                          padding: '0.75rem',
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => toggleReportExpanded(r.id)}
                          aria-expanded={isExpanded}
                          aria-label={isExpanded ? 'Collapse report' : 'Expand report'}
                          style={reportToggleStyle}
                        >
                          {isExpanded ? '▾' : '▸'}
                        </button>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600 }}>
                            {displayReportTemplateName(r.template_name, userRole)}
                          </div>
                          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                            {r.created_by_name} ·{' '}
                            {new Date(r.created_at).toLocaleString(undefined, {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </div>
                        </div>
                      </div>
                      {isExpanded && (
                        <div
                          style={{
                            padding: '0 0.75rem 0.75rem',
                            paddingLeft: 'calc(0.75rem + 28px + 0.5rem)',
                            borderTop: '1px solid #f3f4f6',
                            paddingTop: '0.6rem',
                          }}
                        >
                          <ReportDetailBody report={r} fieldLayout="inline" />
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          {/* authUserId is reserved for future "add report on this day" affordances; reference it
              here so the prop doesn't read as dead while remaining a no-op for now. */}
          {authUserId == null && reports.length === 0 && !loading ? null : null}
        </div>
      </div>
    </div>
  )
}

const sectionHeadingStyle: CSSProperties = {
  fontSize: '0.9375rem',
  fontWeight: 600,
  color: 'var(--text-slate-900)',
  margin: '0 0 0.5rem',
}

const mutedStyle: CSSProperties = {
  color: 'var(--text-muted)',
  fontSize: '0.875rem',
  margin: 0,
}

const reportToggleStyle: CSSProperties = {
  flexShrink: 0,
  width: 28,
  height: 28,
  padding: 0,
  border: '1px solid var(--border)',
  borderRadius: 4,
  background: 'var(--bg-subtle)',
  cursor: 'pointer',
  fontSize: '0.75rem',
  lineHeight: 1,
  color: 'var(--text-700)',
}

/* ------------------------------------------------------------------------------------------------
 *  Mini Gantt orientation strip (selected day at center, click-to-extend in each direction)
 * ------------------------------------------------------------------------------------------------
 *  Mirrors the main `ProjectsJobHistoryTimeline` visual idiom:
 *   - 2-tier header (weekday + day digit, with month abbrev on the 1st)
 *   - bar drawn as a CSS-grid child with `grid-column: start / end + 1`
 *   - per-day highlight cells overlay the bar via `position: absolute`
 *   - selected day forces an orange fill so the user can confirm they clicked the right cell
 *   - today (when in window) gets the same `inset 0 0 0 1px #fb923c` outline used in the main view
 *
 *  Initial state shows only the selected day. Two adjacent expand-buttons (`← Earlier 30 days`
 *  and `Later 30 days →`) extend the visible window by 30 days in each direction per click;
 *  clicks accumulate, and after each click we snap the scroll position to the side just added so
 *  the user immediately sees the new range.
 */

const MINI_COL_W = 40
const MINI_ROW_H = 36
const MINI_BAR_H = 24
const MINI_EXTEND_STEP = 30
/** Default visible padding around the selected day on a desktop / tablet modal. */
const MINI_INITIAL_PADDING_WIDE = 5
/** Default visible padding on a narrow phone (≤ 640 px) — keeps the strip from forcing a scroll. */
const MINI_INITIAL_PADDING_NARROW = 2

function DayCostRow({
  rowKey,
  label,
  value,
  note,
  approximate,
  expanded,
  onToggle,
  detailCount,
  emptyMessage,
  detail,
}: {
  rowKey: CostRowKey
  label: string
  value: string
  note?: string | null
  approximate?: boolean
  expanded: boolean
  onToggle: (key: CostRowKey) => void
  /** Number of detail rows the panel would render. `0` → expanding shows an "empty" message. */
  detailCount: number
  emptyMessage: string
  /** Element rendered inside the detail panel when `detailCount > 0`. */
  detail: ReactNode
}) {
  const headerAriaLabel = `${label} — ${expanded ? 'collapse' : 'expand'} details`
  return (
    <div>
      <button
        type="button"
        onClick={() => onToggle(rowKey)}
        aria-expanded={expanded}
        aria-label={headerAriaLabel}
        title={headerAriaLabel}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: '0.75rem',
          padding: '0.55rem 0.85rem',
          borderTop: '1px solid #f1f5f9',
          background: 'transparent',
          border: 'none',
          borderTopColor: '#f1f5f9',
          borderTopStyle: 'solid',
          borderTopWidth: 1,
          cursor: 'pointer',
          textAlign: 'left',
          font: 'inherit',
          color: 'inherit',
        }}
      >
        <div style={{ minWidth: 0, flex: '1 1 auto', display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span
            aria-hidden
            style={{
              display: 'inline-block',
              width: 10,
              color: 'var(--text-slate-500)',
              fontSize: '0.75rem',
              transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 100ms ease-out',
              lineHeight: 1,
            }}
          >
            ▶
          </span>
          <span style={{ color: 'var(--text-slate-900)', fontSize: '0.875rem' }}>
            {label}
            {detailCount > 0 && (
              <span style={{ color: 'var(--text-slate-500)', fontWeight: 400, marginLeft: 6 }}>
                ({detailCount})
              </span>
            )}
          </span>
        </div>
        {note && (
          <div style={{ color: 'var(--text-amber-700)', fontSize: '0.75rem', flex: '0 1 auto', textAlign: 'right' }}>
            {note}
          </div>
        )}
        <span
          style={{
            fontVariantNumeric: 'tabular-nums',
            fontSize: '0.9375rem',
            color: 'var(--text-slate-900)',
            fontWeight: 500,
            whiteSpace: 'nowrap',
          }}
          title={approximate ? 'Some sessions are missing a configured wage; total is at least this.' : undefined}
        >
          {approximate ? '≥ ' : ''}
          {value}
        </span>
      </button>
      {expanded && (
        <div
          style={{
            padding: '0.4rem 0.85rem 0.7rem 1.4rem',
            background: 'var(--bg-slate-tint)',
            borderTop: '1px dashed var(--border)',
          }}
        >
          {detailCount === 0 ? (
            <p style={{ ...mutedStyle, margin: 0, fontSize: '0.8125rem' }}>{emptyMessage}</p>
          ) : (
            detail
          )}
        </div>
      )}
    </div>
  )
}

const detailTableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '0.8125rem',
  color: 'var(--text-slate-900)',
}
const detailTdStyle: CSSProperties = {
  padding: '0.25rem 0.4rem 0.25rem 0',
  verticalAlign: 'top',
}
const detailTdRightStyle: CSSProperties = {
  ...detailTdStyle,
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
  paddingRight: 0,
}

function formatHoursDecimal(hours: number): string {
  // Round to 2 decimal places and trim a trailing `.00` or single trailing zero so the table
  // shows "4.5 h" instead of "4.50 h" but still differentiates "4.25 h" from "4.2 h".
  const rounded = Math.round(hours * 100) / 100
  const fixed = rounded.toFixed(2)
  const trimmed = fixed.replace(/\.?0+$/, '')
  return `${trimmed} h`
}

function DayLaborDetail({ lines }: { lines: readonly DayLaborLine[] }) {
  return (
    <table style={detailTableStyle}>
      <tbody>
        {lines.map((l) => (
          <tr key={l.userId}>
            <td style={detailTdStyle}>
              {l.userName}
              {l.hasOpenSession && (
                <span style={{ color: 'var(--text-amber-700)', fontSize: '0.75rem', marginLeft: 6 }}>
                  (open session)
                </span>
              )}
            </td>
            <td style={detailTdStyle}>
              <span style={{ color: 'var(--text-slate-600)' }}>
                {formatHoursDecimal(l.hours)}
                {l.hourlyWage != null ? ` × ${formatUsd(l.hourlyWage)}/h` : ''}
              </span>
            </td>
            <td style={detailTdRightStyle}>
              {l.hourlyWage == null ? (
                <span style={{ color: 'var(--text-amber-700)' }}>No wage configured</span>
              ) : (
                formatUsd(l.usd)
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function DayMercuryDetail({ lines }: { lines: readonly DayMercuryLine[] }) {
  return (
    <table style={detailTableStyle}>
      <tbody>
        {lines.map((l, i) => (
          <tr key={`${l.postedAt ?? ''}-${i}`}>
            <td style={detailTdStyle}>
              {(l.counterpartyName ?? '').trim() || (
                <span style={{ color: 'var(--text-slate-400)' }}>(no counterparty)</span>
              )}
              {l.note && (
                <div style={{ color: 'var(--text-slate-600)', fontSize: '0.75rem', marginTop: 2 }}>{l.note}</div>
              )}
            </td>
            <td style={detailTdStyle}>
              <span style={{ color: 'var(--text-slate-600)' }}>
                {l.postedAt ? formatChicagoTime(l.postedAt) : ''}
              </span>
            </td>
            <td style={detailTdRightStyle}>{formatUsd(l.amountUsd)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function DaySupplyDetail({ lines }: { lines: readonly DaySupplyLine[] }) {
  return (
    <table style={detailTableStyle}>
      <tbody>
        {lines.map((l, i) => {
          const supply = (l.supplyHouseName ?? '').trim() || '—'
          const invLabel = l.invoiceNumber.trim()
          return (
            <tr key={`${l.invoiceNumber}-${i}`}>
              <td style={detailTdStyle}>
                {supply}
                {invLabel && (
                  <span style={{ color: 'var(--text-slate-600)', marginLeft: 6 }}>· #{invLabel}</span>
                )}
              </td>
              <td style={detailTdStyle}>
                <span style={{ color: 'var(--text-slate-600)' }}>
                  {l.pct}% of {formatUsd(l.invoiceTotalUsd)}
                </span>
              </td>
              <td style={detailTdRightStyle}>{formatUsd(l.allocatedUsd)}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function DayContextMiniGantt({
  bar,
  selectedYmd,
  todayYmd,
  onSelectDay,
}: {
  bar: ProjectsJobHistoryBar
  selectedYmd: string
  todayYmd: string
  /** Click a day cell → switch the modal to that day. Same-day clicks are ignored. */
  onSelectDay?: (ymd: string) => void
}) {
  const isNarrow = useNarrowViewport640()
  const initialPadding = isNarrow ? MINI_INITIAL_PADDING_NARROW : MINI_INITIAL_PADDING_WIDE
  // Kept in a ref so a mid-extension viewport flip doesn't clobber the user's manual expansion;
  // we only re-read it on a `selectedYmd` change (i.e. the modal opens for a different day).
  const initialPaddingRef = useRef(initialPadding)
  initialPaddingRef.current = initialPadding

  const [daysBefore, setDaysBefore] = useState(initialPadding)
  const [daysAfter, setDaysAfter] = useState(initialPadding)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const pendingScrollSideRef = useRef<'left' | 'right' | null>(null)

  // Reset the extension state when the modal is reused for a different day so the new modal
  // doesn't inherit a previous user's expansion. Honors the current viewport's default padding.
  useEffect(() => {
    setDaysBefore(initialPaddingRef.current)
    setDaysAfter(initialPaddingRef.current)
    pendingScrollSideRef.current = null
  }, [selectedYmd])

  // After an extend click, keep the user's current view stable instead of snapping to the new
  // cells — they can scroll there when they're ready.
  //
  // For `right` extension nothing needs to happen: the new days are appended after the existing
  // content and don't shift anything that's already visible.
  //
  // For `left` extension we must compensate: prepending 30 cells of width `MINI_COL_W` to the
  // start of the strip would otherwise visually shove all the existing content to the right by
  // `30 * MINI_COL_W` pixels. We add the same amount to `scrollLeft` so the visible window stays
  // pinned to the same dates the user was looking at. `useLayoutEffect` runs synchronously after
  // the DOM mutation but before paint, so there's no flash of the unadjusted (shifted) frame.
  //
  // Skipped on initial mount and on `selectedYmd` resets (no pending side queued).
  useLayoutEffect(() => {
    const side = pendingScrollSideRef.current
    if (!side) return
    const el = scrollRef.current
    if (!el) {
      pendingScrollSideRef.current = null
      return
    }
    if (side === 'left') {
      el.scrollLeft = el.scrollLeft + MINI_EXTEND_STEP * MINI_COL_W
    }
    // `right` → no scroll change; user can scroll right when ready.
    pendingScrollSideRef.current = null
  }, [daysBefore, daysAfter])

  const onClickExtendLeft = () => {
    pendingScrollSideRef.current = 'left'
    setDaysBefore((d) => d + MINI_EXTEND_STEP)
  }
  const onClickExtendRight = () => {
    pendingScrollSideRef.current = 'right'
    setDaysAfter((d) => d + MINI_EXTEND_STEP)
  }

  const dayKeys = useMemo(() => {
    const out: string[] = []
    for (let i = -daysBefore; i <= daysAfter; i++) {
      out.push(ymdAddDays(selectedYmd, i))
    }
    return out
  }, [selectedYmd, daysBefore, daysAfter])

  const weekdayFmt = useMemo(
    () => new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, weekday: 'short' }),
    [],
  )
  const dayDigitFmt = useMemo(
    () => new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, day: 'numeric' }),
    [],
  )
  const monthFmt = useMemo(
    () => new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, month: 'short' }),
    [],
  )

  const dayKeyIndex = useMemo(() => {
    const m = new Map<string, number>()
    dayKeys.forEach((k, i) => m.set(k, i))
    return m
  }, [dayKeys])

  const totalWidth = dayKeys.length * MINI_COL_W
  const gridTemplateColumns = `repeat(${dayKeys.length}, ${MINI_COL_W}px)`

  const rangeStart = dayKeys[0]!
  const rangeEnd = dayKeys[dayKeys.length - 1]!
  const barOutsideWindow = bar.lastWorkDateYmd < rangeStart || bar.firstWorkDateYmd > rangeEnd

  const clipLeft = bar.firstWorkDateYmd < rangeStart
  const clipRight = bar.lastWorkDateYmd > rangeEnd
  const visualStart = clipLeft ? rangeStart : bar.firstWorkDateYmd
  const visualEnd = clipRight ? rangeEnd : bar.lastWorkDateYmd
  const barStartIdx = dayKeyIndex.get(visualStart)
  const barEndIdx = dayKeyIndex.get(visualEnd)
  const barInWindow = !barOutsideWindow && barStartIdx != null && barEndIdx != null && barStartIdx <= barEndIdx

  const dashedRight = bar.openEnded || clipRight

  const windowDescription =
    daysBefore === 0 && daysAfter === 0
      ? `Selected day ${selectedYmd}. Click Earlier or Later to extend the visible range.`
      : `Selected day ${selectedYmd} with ${daysBefore} day(s) before and ${daysAfter} day(s) after, from ${rangeStart} to ${rangeEnd}.`

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'stretch',
        gap: 8,
        justifyContent: 'center',
      }}
    >
      <button
        type="button"
        onClick={onClickExtendLeft}
        title="Show 30 earlier days"
        aria-label={`Show 30 days earlier than ${rangeStart}`}
        style={miniExtendButtonStyle}
      >
        <span aria-hidden style={{ fontSize: '0.9rem', lineHeight: 1 }}>
          ←
        </span>
        <span style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>+30 days</span>
      </button>
      <div
        ref={scrollRef}
        role="img"
        aria-label={windowDescription}
        style={{
          overflowX: 'auto',
          paddingBottom: 4,
          flex: '1 1 auto',
          minWidth: 0,
        }}
      >
        <div
          style={{
            width: totalWidth,
            minWidth: totalWidth,
            margin: '0 auto',
            position: 'relative',
          }}
        >
        {/* Top label band: weekday + day digit (with month abbrev on the 1st) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns,
            marginBottom: 4,
            fontSize: '0.6875rem',
            color: 'var(--text-slate-600)',
          }}
        >
          {dayKeys.map((ymd) => {
            const refDate = referenceDateForWorkDateYmd(ymd)
            const wd = weekdayFmt.format(refDate)
            const dayDigit = dayDigitFmt.format(refDate)
            const monthLabel = dayDigit === '1' ? monthFmt.format(refDate) : null
            const isSelected = ymd === selectedYmd
            const isToday = ymd === todayYmd
            const isWeekend = wd === 'Sat' || wd === 'Sun'
            const digitColor = isSelected
              ? '#9a3412'
              : isToday
                ? '#b45309'
                : isWeekend
                  ? '#94a3b8'
                  : '#0f172a'
            return (
              <div
                key={ymd}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  lineHeight: 1.1,
                  fontWeight: isSelected ? 700 : 500,
                  color: isSelected ? '#9a3412' : isWeekend ? 'var(--text-slate-400)' : 'var(--text-slate-600)',
                }}
              >
                <span style={{ fontSize: '0.625rem' }}>{wd}</span>
                <span
                  style={{
                    fontSize: '0.8125rem',
                    fontWeight: isSelected ? 700 : 600,
                    color: digitColor,
                  }}
                >
                  {dayDigit}
                </span>
                {monthLabel && (
                  <span style={{ fontSize: '0.625rem', color: 'var(--text-slate-400)' }}>{monthLabel}</span>
                )}
              </div>
            )
          })}
        </div>

        {/* Bar row */}
        <div
          style={{
            position: 'relative',
            height: MINI_ROW_H,
            display: 'grid',
            gridTemplateColumns,
          }}
        >
          {/* Weekend tint backdrop */}
          {dayKeys.map((ymd, i) => {
            const wd = weekdayFmt.format(referenceDateForWorkDateYmd(ymd))
            const isWeekend = wd === 'Sat' || wd === 'Sun'
            return isWeekend ? (
              <div
                key={`wk-${ymd}`}
                aria-hidden
                style={{
                  gridColumn: `${i + 1} / ${i + 2}`,
                  gridRow: 1,
                  background: 'var(--bg-slate-tint)',
                }}
              />
            ) : null
          })}

          {/* The bar itself (when it overlaps the window) */}
          {barInWindow && barStartIdx != null && barEndIdx != null && (
            <div
              style={{
                gridColumn: `${barStartIdx + 1} / ${barEndIdx + 2}`,
                gridRow: 1,
                alignSelf: 'center',
                position: 'relative',
                height: MINI_BAR_H,
                background: 'var(--bg-slate-100)',
                borderTop: '1px solid #cbd5e1',
                borderBottom: '1px solid #cbd5e1',
                borderLeft: clipLeft ? '2px dashed #94a3b8' : '2px solid #94a3b8',
                borderRight: dashedRight ? '2px dashed #94a3b8' : '2px solid #94a3b8',
                borderRadius: 4,
              }}
            >
              {dayKeys.map((ymd, i) => {
                if (i < barStartIdx || i > barEndIdx) return null
                const count = bar.perDayCounts.get(ymd) ?? 0
                const isSelected = ymd === selectedYmd
                const isToday = ymd === todayYmd
                if (!isSelected && count === 0) return null
                const localX = (i - barStartIdx) * MINI_COL_W
                let background: string
                let color: string
                if (isSelected) {
                  background = '#fb923c'
                  color = '#ffffff'
                } else {
                  const palette = peopleCountColor(count)
                  background = palette.background
                  color = palette.foreground
                }
                return (
                  <div
                    key={ymd}
                    aria-label={
                      isSelected
                        ? `Selected day ${ymd}${count > 0 ? `, ${count} ${count === 1 ? 'person' : 'people'}` : ''}`
                        : `${count} ${count === 1 ? 'person' : 'people'} on ${ymd}`
                    }
                    style={{
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      left: localX,
                      width: MINI_COL_W,
                      background,
                      color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      boxShadow: isSelected
                        ? 'inset 0 0 0 2px #c2410c'
                        : isToday
                          ? 'inset 0 0 0 1px #fb923c'
                          : undefined,
                    }}
                  >
                    {count > 0 ? count : ''}
                  </div>
                )
              })}
            </div>
          )}

          {/* Selected-day highlight when it falls OUTSIDE the bar (defensive — the click handler
              only fires on numbered cells today, but keep the orange visible anyway). */}
          {!barInWindow && (
            <div
              style={{
                gridColumn: `${(dayKeyIndex.get(selectedYmd) ?? daysBefore) + 1} / span 1`,
                gridRow: 1,
                alignSelf: 'center',
                height: MINI_BAR_H,
                background: '#fb923c',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem',
                fontWeight: 700,
                borderRadius: 4,
                boxShadow: 'inset 0 0 0 2px #c2410c',
              }}
            >
              {bar.perDayCounts.get(selectedYmd) ?? ''}
            </div>
          )}

          {/* Today vertical accent line — only when today is inside the window. */}
          {(() => {
            const todayIdx = dayKeyIndex.get(todayYmd)
            if (todayIdx == null) return null
            return (
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: todayIdx * MINI_COL_W,
                  width: 2,
                  background: '#fb923c',
                  opacity: 0.55,
                  pointerEvents: 'none',
                }}
              />
            )
          })()}
        </div>

        {/* Clickable overlay — one transparent button per day, spanning both the label band and
            the bar row. Sits ABOVE the visual layers via z-index, so clicks always land here.
            The visual content (numbered bar cells, weekend tints, today line) all set
            `pointer-events: none` implicitly because they're rendered earlier in the stack.
            Clicks on the currently-selected day are no-ops (`disabled`). */}
        {onSelectDay && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'grid',
              gridTemplateColumns,
              pointerEvents: 'none',
              zIndex: 1,
            }}
          >
            {dayKeys.map((ymd) => {
              const isSelected = ymd === selectedYmd
              return (
                <button
                  key={`click-${ymd}`}
                  type="button"
                  onClick={() => {
                    if (!isSelected) onSelectDay(ymd)
                  }}
                  disabled={isSelected}
                  title={isSelected ? undefined : `Jump to ${formatMonthDay(ymd)}`}
                  aria-label={isSelected ? `Selected ${ymd}` : `Jump to ${ymd}`}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    padding: 0,
                    margin: 0,
                    pointerEvents: 'auto',
                    cursor: isSelected ? 'default' : 'pointer',
                    color: 'transparent',
                    appearance: 'none',
                  }}
                />
              )
            })}
          </div>
        )}
      </div>
      </div>
      <button
        type="button"
        onClick={onClickExtendRight}
        title="Show 30 later days"
        aria-label={`Show 30 days later than ${rangeEnd}`}
        style={miniExtendButtonStyle}
      >
        <span aria-hidden style={{ fontSize: '0.9rem', lineHeight: 1 }}>
          →
        </span>
        <span style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>+30 days</span>
      </button>
    </div>
  )
}

const miniExtendButtonStyle: CSSProperties = {
  flexShrink: 0,
  display: 'inline-flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 2,
  padding: '0.4rem 0.6rem',
  background: 'var(--surface)',
  border: '1px solid #cbd5e1',
  borderRadius: 6,
  cursor: 'pointer',
  color: 'var(--text-slate-900)',
  fontWeight: 600,
  alignSelf: 'center',
  height: 56,
}
