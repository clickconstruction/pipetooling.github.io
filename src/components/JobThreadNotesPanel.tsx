import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { getDispatchNoteDisplayMeta, formatDispatchNoteTimeChicago } from '../utils/dispatchNoteDisplay'
import type { UserRole } from '../hooks/useAuth'
import { displayReportTemplateName } from '../lib/reportTemplateDisplayName'
import { type ReportForView } from './ReportViewModal'
import { allReportFieldLinesForThread } from '../lib/reportForViewFromJobLedgerRow'
import type { JobThreadScheduleActivityItem } from '../lib/jobThreadScheduleActivity'
import type { JobThreadClockActivityItem } from '../lib/jobThreadClockActivity'
import { eventRenderMeta, type JobThreadEventActivityItem } from '../lib/jobActivityEvent'
import { ACTIVITY_FILTERS, countActivityByFilter, filterActivity, type ActivityFilter } from '../lib/jobActivityFilter'
import { formatDecimalWorkHoursToHhMm } from '../lib/formatDecimalWorkHoursHhMm'
import {
  scheduleFormatDateLongNoWeekday,
  scheduleFormatWindow,
} from '../lib/jobScheduleChicago'
import { clampCompletenessPct } from '../lib/jobs/jobCompleteness'
import { pctNoteRequired, validatePctCommit } from '../lib/jobs/stagesPctNote'
import { recordedPercentProvenance } from '../lib/jobPercentProvenance'
import { PercentProvenanceChip } from './jobs/PercentProvenanceChip'

export type JobThreadNoteRow = {
  id: string
  body: string
  created_at: string
  author: { name: string | null } | null
}

export type JobThreadActivityItem =
  | { kind: 'note'; note: JobThreadNoteRow }
  | { kind: 'report'; report: ReportForView }
  | JobThreadScheduleActivityItem
  | JobThreadClockActivityItem
  | JobThreadEventActivityItem

export type JobThreadStampActions = {
  onArrived: () => void
  onLeaving: () => void
}

type JobThreadNotesPanelProps = {
  /** Merged notes + job field reports (Job detail modal / Job Mode). When set, `notes` is ignored. */
  activity?: JobThreadActivityItem[]
  /** Note-only (e.g. Job detail modal). Used when `activity` is omitted. */
  notes?: JobThreadNoteRow[]
  loading: boolean
  canPost: boolean
  draft: string
  onDraftChange: (v: string) => void
  onSubmit: () => void
  submitting: boolean
  emptyLabel?: string
  /** Centered heading when `showSectionTitle` is true. */
  sectionTitle?: string
  /** When false, hide the centered section title (e.g. Job detail modal). */
  showSectionTitle?: boolean
  /** When false, no placeholder row when there are no notes yet. */
  showEmptyPlaceholder?: boolean
  /** When false, hide the visible "Add a note" label; textarea keeps placeholder / aria-label. */
  showComposerLabel?: boolean
  /** Quick stamps for job ledger thread notes (typically Job Detail modal via **`jobThreadStampActions`**). */
  jobThreadStampActions?: JobThreadStampActions
  /** Passed to {@link displayReportTemplateName} for report row titles and ReportViewModal. */
  viewerRole?: UserRole | null
  /** Pipeline % complete (jobs_ledger.pct_complete); null when never set. Enables the "Set % complete" control. */
  pctComplete?: number | null
  /** Whether the viewer may edit the percent (dev / master / assistant / primary). */
  canEditPct?: boolean
  /** True while the percent commit is in flight. */
  pctSaving?: boolean
  /**
   * Commit a new percent plus the accompanying note text. The parent posts a
   * thread note ("N% complete — <note>") and writes jobs_ledger.pct_complete.
   * Required when `canEditPct` is set.
   */
  onCommitPct?: (value: number, note: string) => void | Promise<void>
  /** People assigned to the job (jobs_ledger_team_members). Shown top-left. */
  teamMembers?: Array<{ user_id: string; name: string | null }>
}

const ACTIVITY_LIST_MAX_HEIGHT = 'min(280px, 45vh)'

function JobThreadStampButtons({
  actions,
  submitting,
}: {
  actions: JobThreadStampActions
  submitting: boolean
}) {
  const base = {
    padding: '0.35rem 0.65rem',
    fontSize: '0.8125rem',
    fontWeight: 600,
    borderRadius: 4,
    flexShrink: 0,
    cursor: submitting ? ('not-allowed' as const) : ('pointer' as const),
  }
  const arrivedStyle = submitting
    ? { ...base, border: '1px solid var(--border)', background: 'var(--bg-muted)', color: 'var(--text-faint)' }
    : { ...base, border: '1px solid #166534', background: '#15803d', color: '#ffffff' }
  const leavingStyle = submitting
    ? { ...base, border: '1px solid var(--border)', background: 'var(--bg-muted)', color: 'var(--text-faint)' }
    : { ...base, border: '1px solid #f59e0b', background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)' }
  return (
    <>
      <button
        type="button"
        disabled={submitting}
        style={arrivedStyle}
        onClick={actions.onArrived}
        aria-label="Post arrived at job note"
      >
        Arrived
      </button>
      <button
        type="button"
        disabled={submitting}
        style={leavingStyle}
        onClick={actions.onLeaving}
        aria-label="Post leaving job note"
      >
        Leaving
      </button>
    </>
  )
}

export function JobThreadNotesPanel({
  activity: activityProp,
  notes,
  loading,
  canPost,
  draft,
  onDraftChange,
  onSubmit,
  submitting,
  emptyLabel = 'No activity yet.',
  sectionTitle = 'Job activity / notes',
  showSectionTitle = true,
  showEmptyPlaceholder = true,
  showComposerLabel = true,
  jobThreadStampActions,
  viewerRole,
  pctComplete,
  canEditPct = false,
  pctSaving = false,
  onCommitPct,
  teamMembers,
}: JobThreadNotesPanelProps) {
  const [pctEditorOpen, setPctEditorOpen] = useState(false)
  const [pctDraft, setPctDraft] = useState(pctComplete ?? 0)
  // Who set the recorded % (v2.2852): the crew, when the newest report with a % says the same number; else the office.
  const pctProvenance = useMemo(
    () =>
      recordedPercentProvenance(
        pctComplete,
        (activityProp ?? []).flatMap((i) => (i.kind === 'report' ? [{ created_at: i.report.created_at, field_values: i.report.field_values ?? null }] : [])),
      ),
    [pctComplete, activityProp],
  )
  const [pctNoteError, setPctNoteError] = useState<string | null>(null)
  const openPctEditor = useCallback(() => {
    setPctDraft(pctComplete ?? 0)
    setPctNoteError(null)
    setPctEditorOpen(true)
  }, [pctComplete])
  const cancelPctEditor = useCallback(() => {
    setPctEditorOpen(false)
    setPctNoteError(null)
  }, [])
  // Close once a commit finishes (pctSaving true → false).
  const wasPctSaving = useRef(pctSaving)
  useEffect(() => {
    if (wasPctSaving.current && !pctSaving) {
      setPctEditorOpen(false)
      setPctNoteError(null)
    }
    wasPctSaving.current = pctSaving
  }, [pctSaving])
  const commitPctEditor = useCallback(() => {
    const check = validatePctCommit(pctDraft, draft)
    if (!check.ok) {
      setPctNoteError(check.error)
      return
    }
    setPctNoteError(null)
    void onCommitPct?.(pctDraft, draft)
  }, [pctDraft, draft, onCommitPct])
  const noteBodyRef = useRef<HTMLTextAreaElement>(null)
  const activityScrollRef = useRef<HTMLDivElement>(null)

  const syncNoteTextareaHeight = useCallback(() => {
    const el = noteBodyRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [])

  useEffect(() => {
    if (!canPost) return
    syncNoteTextareaHeight()
  }, [canPost, draft, submitting, syncNoteTextareaHeight])

  const activity: JobThreadActivityItem[] = useMemo(
    () =>
      activityProp ??
      (notes ?? []).map((n) => ({
        kind: 'note' as const,
        note: n,
      })),
    [activityProp, notes],
  )

  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all')
  const filterEnabled = activityProp != null
  const visibleActivity = useMemo(
    () => (filterEnabled ? filterActivity(activity, activityFilter) : activity),
    [filterEnabled, activity, activityFilter],
  )
  // Per-bucket counts for the filter pills — same array the filter reads, so a
  // pill's number always matches what clicking it shows.
  const activityCounts = useMemo(
    () => (filterEnabled ? countActivityByFilter(activity) : null),
    [filterEnabled, activity],
  )
  // If the selected bucket empties out (items reloaded, note deleted), fall
  // back to All rather than stranding the user on a blank feed behind a pill
  // that is now demoted to non-clickable.
  useEffect(() => {
    if (activityFilter === 'all') return
    if (activityCounts && activityCounts[activityFilter] === 0) setActivityFilter('all')
  }, [activityCounts, activityFilter])

  const activityTailKey = useMemo(() => {
    const last = visibleActivity[visibleActivity.length - 1]
    if (!last) return ''
    if (last.kind === 'note') return `n:${last.note.id}`
    if (last.kind === 'report') return `r:${last.report.id}`
    if (last.kind === 'clock_session') return `c:${last.clock.dedupeKey}`
    if (last.kind === 'event') return `e:${last.event.dedupeKey}`
    return `s:${last.schedule.dedupeKey}`
  }, [visibleActivity])

  // Re-pin the list to newest whenever the tail changes.
  useLayoutEffect(() => {
    if (loading) return
    const el = activityScrollRef.current
    if (!el) return
    requestAnimationFrame(() => {
      const box = activityScrollRef.current
      if (!box) return
      box.scrollTop = box.scrollHeight
    })
  }, [loading, visibleActivity.length, activityTailKey])

  return (
    <div
      style={{
        padding: '0.75rem',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 6,
      }}
    >
      {(teamMembers && teamMembers.length > 0) || showSectionTitle ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
          {teamMembers && teamMembers.length > 0 ? (
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-700)' }}>
              {teamMembers.map((m) => (m.name?.trim() ? m.name.trim() : 'Unknown')).join(', ')}
            </span>
          ) : null}
          {showSectionTitle ? (
            <span style={{ marginLeft: 'auto', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-700)' }}>
              {sectionTitle}
            </span>
          ) : null}
        </div>
      ) : null}
      {filterEnabled ? (
        <div
          role="tablist"
          aria-label="Filter activity"
          style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.25rem', marginBottom: '0.5rem' }}
        >
          {ACTIVITY_FILTERS.map((f) => {
            const active = activityFilter === f.value
            const count = f.value === 'all' ? null : (activityCounts?.[f.value] ?? 0)
            // Empty buckets demote to quiet non-clickable text (the v2.1475
            // Reports-pill pattern): present so the vocabulary stays fixed,
            // silent so rows with real activity pop. All is always clickable.
            const empty = f.value !== 'all' && count === 0
            if (empty) {
              return (
                <button
                  key={f.value}
                  type="button"
                  role="tab"
                  aria-selected={false}
                  aria-disabled
                  title={`No ${f.label.toLowerCase()} yet`}
                  style={{
                    padding: '0.15rem 0.5rem',
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    borderRadius: 999,
                    cursor: 'default',
                    border: '1px solid transparent',
                    background: 'transparent',
                    color: 'var(--text-faint)',
                  }}
                >
                  {f.label}
                </button>
              )
            }
            return (
              <button
                key={f.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActivityFilter(f.value)}
                style={{
                  padding: '0.15rem 0.5rem',
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  borderRadius: 999,
                  cursor: 'pointer',
                  border: `1px solid ${active ? '#2563eb' : '#d1d5db'}`,
                  background: active ? '#2563eb' : 'var(--surface)',
                  color: active ? '#fff' : 'var(--text-muted)',
                }}
              >
                {f.label}
                {count != null ? (
                  <span
                    style={{
                      marginLeft: '0.3rem',
                      fontWeight: 700,
                      color: active ? '#fff' : 'var(--text-link)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {count}
                  </span>
                ) : null}
              </button>
            )
          })}
          {pctComplete != null ? (
            <span
              title="Pipeline % complete for this job"
              style={{ marginLeft: 'auto', fontSize: '0.8125rem', color: 'var(--text-700)', whiteSpace: 'nowrap' }}
            >
              {pctComplete}% complete
              {activityProp ? <PercentProvenanceChip source={pctProvenance.source} reportedOn={pctProvenance.reportedOn} /> : null}
            </span>
          ) : null}
        </div>
      ) : null}
      {loading ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '0 0 0.75rem 0' }}>Loading…</p>
      ) : (
        <div
          ref={activityScrollRef}
          style={{
            maxHeight: ACTIVITY_LIST_MAX_HEIGHT,
            overflowY: 'auto',
            // A crisp edge under the list (v2.1768): without it a half-scrolled
            // entry visually merged into the composer right below.
            borderBottom: '1px solid var(--border)',
            paddingBottom: '0.35rem',
            marginBottom: '0.25rem',
            minHeight: 0,
          }}
        >
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {visibleActivity.length === 0 ? (
              showEmptyPlaceholder ? (
                <li style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{emptyLabel}</li>
              ) : null
            ) : (
              visibleActivity.map((item) => {
                if (item.kind === 'schedule_block') {
                  const s = item.schedule
                  const { weekdayTimeChicago, daysAgoLabel } = getDispatchNoteDisplayMeta(s.sortAt)
                  const dateLine = scheduleFormatDateLongNoWeekday(s.work_date)
                  const windowLine = scheduleFormatWindow(s.time_start, s.time_end)
                  return (
                    <li
                      key={s.dedupeKey}
                      style={{
                        padding: '0.5rem 0',
                        borderBottom: '1px solid var(--border)',
                        fontSize: '0.8125rem',
                        borderLeft: '3px solid var(--border-green)',
                        paddingLeft: '0.5rem',
                        marginLeft: 0,
                      }}
                    >
                      <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>
                        <span
                          style={{
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            color: '#15803d',
                            marginRight: '0.35rem',
                            verticalAlign: 'middle',
                          }}
                        >
                          Schedule
                        </span>
                        <span style={{ marginLeft: '0.35rem' }}>
                          {weekdayTimeChicago} · {daysAgoLabel}
                        </span>
                      </div>
                      <div style={{ color: 'var(--text-600)', marginBottom: 4, fontSize: '0.8125rem' }}>
                        {dateLine} · {windowLine}
                        {s.assigneeLabels ? (
                          <span style={{ color: 'var(--text-muted)' }}>{` · ${s.assigneeLabels}`}</span>
                        ) : null}
                      </div>
                      <div style={{ color: 'var(--text-gray-800)', whiteSpace: 'pre-wrap' }}>{s.note}</div>
                    </li>
                  )
                }
                if (item.kind === 'clock_session') {
                  const c = item.clock
                  const { weekdayTimeChicago, daysAgoLabel } = getDispatchNoteDisplayMeta(c.sortAt)
                  const inLabel = c.clockedInAt ? formatDispatchNoteTimeChicago(c.clockedInAt) : '—'
                  const outLabel = c.clockedOutAt ? formatDispatchNoteTimeChicago(c.clockedOutAt) : null
                  const durLabel = c.durationHours != null ? formatDecimalWorkHoursToHhMm(c.durationHours) : null
                  return (
                    <li
                      key={c.dedupeKey}
                      style={{
                        padding: '0.5rem 0',
                        borderBottom: '1px solid var(--border)',
                        fontSize: '0.8125rem',
                        borderLeft: '3px solid var(--border-indigo)',
                        paddingLeft: '0.5rem',
                        marginLeft: 0,
                      }}
                    >
                      <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>
                        <span
                          style={{
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            color: '#4f46e5',
                            marginRight: '0.35rem',
                            verticalAlign: 'middle',
                          }}
                        >
                          Clock
                        </span>
                        <strong style={{ color: 'var(--text-strong)' }}>{c.personName}</strong>
                        <span style={{ marginLeft: '0.5rem' }}>
                          {weekdayTimeChicago} · {daysAgoLabel}
                        </span>
                      </div>
                      <div style={{ color: 'var(--text-600)', fontSize: '0.8125rem' }}>
                        {outLabel
                          ? `${inLabel} → ${outLabel}${durLabel ? ` · ${durLabel}` : ''}`
                          : `${inLabel} → still on the clock`}
                        {c.status === 'pending' ? (
                          <span
                            style={{
                              marginLeft: '0.4rem',
                              fontSize: '0.65rem',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              color: 'var(--text-amber-800)',
                              background: 'var(--bg-amber-100)',
                              border: '1px solid var(--border-amber-soft)',
                              borderRadius: 4,
                              padding: '0 0.3rem',
                              verticalAlign: 'middle',
                            }}
                          >
                            Pending approval
                          </span>
                        ) : null}
                      </div>
                      {c.note ? (
                        <div style={{ color: 'var(--text-gray-800)', whiteSpace: 'pre-wrap', marginTop: 4 }}>{c.note}</div>
                      ) : null}
                    </li>
                  )
                }
                if (item.kind === 'event') {
                  const ev = item.event
                  const meta = eventRenderMeta(ev.type)
                  const { weekdayTimeChicago, daysAgoLabel } = getDispatchNoteDisplayMeta(ev.occurredAt)
                  return (
                    <li
                      key={ev.dedupeKey}
                      style={{
                        padding: '0.5rem 0',
                        borderBottom: '1px solid var(--border)',
                        fontSize: '0.8125rem',
                        borderLeft: `3px solid ${meta.borderColor}`,
                        paddingLeft: '0.5rem',
                        marginLeft: 0,
                      }}
                    >
                      <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>
                        <span
                          style={{
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            color: meta.tagColor,
                            marginRight: '0.35rem',
                            verticalAlign: 'middle',
                          }}
                        >
                          {meta.tag}
                        </span>
                        <strong style={{ color: 'var(--text-strong)' }}>{ev.actorName?.trim() || 'System'}</strong>
                        <span style={{ marginLeft: '0.5rem' }}>
                          {weekdayTimeChicago} · {daysAgoLabel}
                        </span>
                      </div>
                      <div style={{ color: 'var(--text-gray-800)', whiteSpace: 'pre-wrap' }}>{ev.summary}</div>
                    </li>
                  )
                }
                if (item.kind === 'note') {
                  const n = item.note
                  const authorName = n.author?.name?.trim() || 'Unknown'
                  const { weekdayTimeChicago, daysAgoLabel } = getDispatchNoteDisplayMeta(n.created_at)
                  return (
                    <li
                      key={`n-${n.id}`}
                      style={{
                        padding: '0.5rem 0',
                        borderBottom: '1px solid var(--border)',
                        fontSize: '0.8125rem',
                      }}
                    >
                      <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>
                        <strong style={{ color: 'var(--text-strong)' }}>{authorName}</strong>
                        <span style={{ marginLeft: '0.5rem' }}>
                          {weekdayTimeChicago} · {daysAgoLabel}
                        </span>
                      </div>
                      <div style={{ color: 'var(--text-gray-800)', whiteSpace: 'pre-wrap' }}>{n.body}</div>
                    </li>
                  )
                }
                const r = item.report
                const { weekdayTimeChicago, daysAgoLabel } = getDispatchNoteDisplayMeta(r.created_at)
                const fieldLines = allReportFieldLinesForThread(r)
                return (
                  <li
                    key={`r-${r.id}`}
                    style={{
                      padding: '0.5rem 0',
                      borderBottom: '1px solid var(--border)',
                      fontSize: '0.8125rem',
                      borderLeft: '3px solid #93c5fd',
                      paddingLeft: '0.5rem',
                      marginLeft: 0,
                    }}
                  >
                    <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>
                      <span
                        style={{
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          color: 'var(--text-link)',
                          marginRight: '0.35rem',
                          verticalAlign: 'middle',
                        }}
                      >
                        Report
                      </span>
                      <strong style={{ color: 'var(--text-strong)' }}>{r.created_by_name?.trim() || 'Unknown'}</strong>
                      <span style={{ marginLeft: '0.5rem' }}>
                        {weekdayTimeChicago} · {daysAgoLabel}
                      </span>
                    </div>
                    <div style={{ color: 'var(--text-gray-800)' }}>
                      <span style={{ fontWeight: 600 }}>{displayReportTemplateName(r.template_name, viewerRole)}</span>
                      {fieldLines.length > 0 ? (
                        <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {fieldLines.map((l, i) => (
                            <div key={`${l.label}-${i}`} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                              {l.label ? (
                                <>
                                  <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{l.label}</span>
                                  {' — '}
                                </>
                              ) : null}
                              <span>{l.value}</span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </li>
                )
              })
            )}
          </ul>
        </div>
      )}
      {canPost && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            marginTop: '0.5rem',
            // The composer is its own quiet card (v2.1768) so it never reads
            // as part of the feed's last entry.
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: '0.6rem',
          }}
        >
          {pctEditorOpen && canEditPct ? (
            /* % complete editor takes over the composer area: slider on top, then
               [note field | Cancel | Set to N%]. A note is required below 100%. */
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                // The wrapper card (v2.1768) already borders and pads the area.
                padding: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-700)' }}>Set % complete</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={pctDraft}
                    disabled={pctSaving}
                    onChange={(e) => setPctDraft(clampCompletenessPct(e.target.value) ?? 0)}
                    aria-label="Percent complete"
                    style={{ width: 56, padding: '0.2rem 0.35rem', fontSize: '0.8125rem', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-strong)', textAlign: 'right' }}
                  />
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>%</span>
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                list="job-thread-pct-ticks"
                value={pctDraft}
                disabled={pctSaving}
                onChange={(e) => setPctDraft(Number(e.target.value))}
                aria-label="Percent complete slider"
                style={{ width: '100%', accentColor: '#3b82f6', cursor: pctSaving ? 'not-allowed' : 'pointer' }}
              />
              <datalist id="job-thread-pct-ticks">
                {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                {[0, 25, 50, 75, 100].map((m) => (
                  <span key={m}>{m}%</span>
                ))}
              </div>
              {pctNoteError ? (
                <p style={{ color: 'var(--text-red-700)', fontSize: '0.75rem', margin: 0 }}>{pctNoteError}</p>
              ) : null}
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  value={draft}
                  disabled={pctSaving}
                  onChange={(e) => onDraftChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      commitPctEditor()
                    }
                  }}
                  maxLength={2000}
                  placeholder={pctNoteRequired(pctDraft) ? 'Add a note (required)…' : 'Add a note (optional)…'}
                  aria-label="Note for percent change"
                  style={{ flex: '1 1 8rem', minWidth: 0, padding: '0.4rem 0.5rem', fontSize: '0.875rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-strong)', boxSizing: 'border-box' }}
                />
                <button
                  type="button"
                  onClick={cancelPctEditor}
                  disabled={pctSaving}
                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.8125rem', background: 'var(--surface)', color: 'var(--text-700)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: pctSaving ? 'not-allowed' : 'pointer', flexShrink: 0 }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={commitPctEditor}
                  disabled={pctSaving}
                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.8125rem', fontWeight: 600, background: pctSaving ? 'var(--bg-200)' : '#3b82f6', color: pctSaving ? 'var(--text-muted)' : 'white', border: 'none', borderRadius: 4, cursor: pctSaving ? 'not-allowed' : 'pointer', flexShrink: 0 }}
                >
                  {pctSaving ? 'Setting…' : `Set to ${pctDraft}%`}
                </button>
              </div>
            </div>
          ) : (
            <>
              {showComposerLabel ? (
                <label htmlFor="job-thread-note-body" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>
                  Add a note
                </label>
              ) : null}
              <textarea
                ref={noteBodyRef}
                id="job-thread-note-body"
                aria-label={showComposerLabel ? undefined : 'Add a note'}
                value={draft}
                onChange={(e) => onDraftChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter' || e.shiftKey) return
                  e.preventDefault()
                  if (submitting || draft.trim().length === 0) return
                  onSubmit()
                }}
                disabled={submitting}
                maxLength={2000}
                rows={1}
                placeholder="Type a note… (Enter to post, Shift+Enter for new line)"
                style={{
                  width: '100%',
                  padding: '0.5rem 0.6rem',
                  // Room for descenders (v2.1768) — at rows=1 the placeholder's
                  // g/p glyphs clipped against the border.
                  minHeight: '2.4rem',
                  fontSize: '0.875rem',
                  lineHeight: 1.4,
                  border: '1px solid var(--border-strong)',
                  borderRadius: 8,
                  background: 'var(--surface)',
                  color: 'var(--text-strong)',
                  boxSizing: 'border-box',
                  resize: 'none',
                  maxHeight: '10rem',
                  overflowY: 'auto',
                }}
              />
              {/* Flat, wrapping action row: stamps / % complete on the left,
                  Post note pushed right. "Set % complete" opens the editor above (replacing this composer). */}
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: '0.5rem',
                  width: '100%',
                }}
              >
                {jobThreadStampActions ? (
                  <JobThreadStampButtons actions={jobThreadStampActions} submitting={submitting} />
                ) : null}
                {canEditPct ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                    {/* Percent readout lives at the top right of the filter row; keep it here only when that row is hidden. */}
                    {pctComplete != null && !filterEnabled ? (
                      <span style={{ fontSize: '0.8125rem', color: 'var(--text-700)' }}>{pctComplete}% complete</span>
                    ) : null}
                    <button
                      type="button"
                      onClick={openPctEditor}
                      style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', fontWeight: 600, background: 'none', color: 'var(--text-link)', border: '1px solid #2563eb', borderRadius: 4, cursor: 'pointer' }}
                    >
                      Set % complete
                    </button>
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={onSubmit}
                  disabled={submitting || draft.trim().length === 0}
                  style={{
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.8125rem',
                    background: submitting || draft.trim().length === 0 ? 'var(--bg-200)' : '#3b82f6',
                    color: submitting || draft.trim().length === 0 ? 'var(--text-muted)' : 'white',
                    border: 'none',
                    borderRadius: 4,
                    cursor: submitting || draft.trim().length === 0 ? 'not-allowed' : 'pointer',
                    flexShrink: 0,
                    marginLeft: 'auto',
                  }}
                >
                  {submitting ? 'Posting…' : 'Post note'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
