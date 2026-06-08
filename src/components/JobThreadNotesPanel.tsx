import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { getDispatchNoteDisplayMeta, formatDispatchNoteTimeChicago } from '../utils/dispatchNoteDisplay'
import type { UserRole } from '../hooks/useAuth'
import { displayReportTemplateName } from '../lib/reportTemplateDisplayName'
import ReportViewModal, { type ReportForView } from './ReportViewModal'
import { firstNonEmptyFieldValueSummary } from '../lib/reportForViewFromJobLedgerRow'
import type { JobThreadScheduleActivityItem } from '../lib/jobThreadScheduleActivity'
import type { JobThreadClockActivityItem } from '../lib/jobThreadClockActivity'
import { eventRenderMeta, type JobThreadEventActivityItem } from '../lib/jobActivityEvent'
import { ACTIVITY_FILTERS, filterActivity, type ActivityFilter } from '../lib/jobActivityFilter'
import { formatDecimalWorkHoursToHhMm } from '../lib/formatDecimalWorkHoursHhMm'
import {
  scheduleFormatDateLongNoWeekday,
  scheduleFormatWindow,
} from '../lib/jobScheduleChicago'

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
  /** Merged notes + job field reports (Jobs Stages / Workflow). When set, `notes` is ignored. */
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
  /** Jobs Stages: open Schedule modal (planner roles only). */
  scheduleAction?: { onClick: () => void; disabled?: boolean }
  /** Week grid: navigate to Schedule dispatch (same roles + superintendent when job has team). */
  scheduleDispatchAction?: { onClick: () => void; disabled?: boolean }
  /** Quick stamps for job ledger thread notes (typically Job Detail modal via **`jobThreadStampActions`**). */
  jobThreadStampActions?: JobThreadStampActions
  /** Max height for the scrollable activity list (newest items at bottom). */
  activityListMaxHeight?: string
  /** Passed to {@link displayReportTemplateName} for report row titles and ReportViewModal. */
  viewerRole?: UserRole | null
  /** Show the All/Notes/Status/Billing/Crew segmented filter. Defaults on when `activity` is provided. */
  showFilter?: boolean
}

const DEFAULT_ACTIVITY_LIST_MAX_HEIGHT = 'min(280px, 45vh)'

function JobThreadScheduleButton({
  action,
}: {
  action: NonNullable<JobThreadNotesPanelProps['scheduleAction']>
}) {
  return (
    <button
      type="button"
      onClick={action.onClick}
      disabled={action.disabled}
      style={{
        padding: '0.3rem 0.65rem',
        fontSize: '0.75rem',
        fontWeight: 600,
        background: action.disabled ? '#e5e7eb' : '#15803d',
        color: action.disabled ? '#6b7280' : '#ffffff',
        border: `1px solid ${action.disabled ? '#d1d5db' : '#166534'}`,
        borderRadius: 4,
        cursor: action.disabled ? 'not-allowed' : 'pointer',
        flexShrink: 0,
      }}
    >
      Schedule
    </button>
  )
}

function JobThreadWeekDispatchButton({
  action,
}: {
  action: NonNullable<JobThreadNotesPanelProps['scheduleDispatchAction']>
}) {
  return (
    <button
      type="button"
      onClick={action.onClick}
      disabled={action.disabled}
      style={{
        padding: '0.3rem 0.65rem',
        fontSize: '0.75rem',
        fontWeight: 600,
        background: action.disabled ? '#e5e7eb' : '#ffffff',
        color: action.disabled ? '#6b7280' : '#1d4ed8',
        border: `1px solid ${action.disabled ? '#d1d5db' : '#2563eb'}`,
        borderRadius: 4,
        cursor: action.disabled ? 'not-allowed' : 'pointer',
        flexShrink: 0,
      }}
    >
      Week dispatch
    </button>
  )
}

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
    ? { ...base, border: '1px solid #e5e7eb', background: '#f3f4f6', color: '#9ca3af' }
    : { ...base, border: '1px solid #166534', background: '#15803d', color: '#ffffff' }
  const leavingStyle = submitting
    ? { ...base, border: '1px solid #e5e7eb', background: '#f3f4f6', color: '#9ca3af' }
    : { ...base, border: '1px solid #f59e0b', background: '#fef3c7', color: '#92400e' }
  return (
    <>
      <button
        type="button"
        disabled={submitting}
        style={arrivedStyle}
        onClick={actions.onArrived}
        aria-label="Post arrived at job note"
      >
        Arrived at job
      </button>
      <button
        type="button"
        disabled={submitting}
        style={leavingStyle}
        onClick={actions.onLeaving}
        aria-label="Post leaving job note"
      >
        Leaving job
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
  scheduleAction,
  scheduleDispatchAction,
  jobThreadStampActions,
  activityListMaxHeight = DEFAULT_ACTIVITY_LIST_MAX_HEIGHT,
  viewerRole,
  showFilter,
}: JobThreadNotesPanelProps) {
  const [viewingReport, setViewingReport] = useState<ReportForView | null>(null)
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
  const filterEnabled = showFilter ?? activityProp != null
  const visibleActivity = useMemo(
    () => (filterEnabled ? filterActivity(activity, activityFilter) : activity),
    [filterEnabled, activity, activityFilter],
  )

  const activityTailKey = useMemo(() => {
    const last = visibleActivity[visibleActivity.length - 1]
    if (!last) return ''
    if (last.kind === 'note') return `n:${last.note.id}`
    if (last.kind === 'report') return `r:${last.report.id}`
    if (last.kind === 'clock_session') return `c:${last.clock.dedupeKey}`
    if (last.kind === 'event') return `e:${last.event.dedupeKey}`
    return `s:${last.schedule.dedupeKey}`
  }, [visibleActivity])

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
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 6,
      }}
    >
      {showSectionTitle ? (
        <div style={{ marginBottom: '0.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151' }}>
            {sectionTitle}
          </div>
        </div>
      ) : null}
      {filterEnabled ? (
        <div
          role="tablist"
          aria-label="Filter activity"
          style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginBottom: '0.5rem' }}
        >
          {ACTIVITY_FILTERS.map((f) => {
            const active = activityFilter === f.value
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
                  background: active ? '#2563eb' : '#fff',
                  color: active ? '#fff' : '#6b7280',
                }}
              >
                {f.label}
              </button>
            )
          })}
        </div>
      ) : null}
      {loading ? (
        <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0 0 0.75rem 0' }}>Loading…</p>
      ) : (
        <div
          ref={activityScrollRef}
          style={{
            maxHeight: activityListMaxHeight,
            overflowY: 'auto',
            marginBottom: '0.75rem',
            minHeight: 0,
          }}
        >
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {visibleActivity.length === 0 ? (
              showEmptyPlaceholder ? (
                <li style={{ color: '#6b7280', fontSize: '0.875rem' }}>{emptyLabel}</li>
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
                        borderBottom: '1px solid #f3f4f6',
                        fontSize: '0.8125rem',
                        borderLeft: '3px solid #86efac',
                        paddingLeft: '0.5rem',
                        marginLeft: 0,
                      }}
                    >
                      <div style={{ color: '#6b7280', marginBottom: 2 }}>
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
                      <div style={{ color: '#4b5563', marginBottom: 4, fontSize: '0.8125rem' }}>
                        {dateLine} · {windowLine}
                        {s.assigneeLabels ? (
                          <span style={{ color: '#6b7280' }}>{` · ${s.assigneeLabels}`}</span>
                        ) : null}
                      </div>
                      <div style={{ color: '#1f2937', whiteSpace: 'pre-wrap' }}>{s.note}</div>
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
                        borderBottom: '1px solid #f3f4f6',
                        fontSize: '0.8125rem',
                        borderLeft: '3px solid #a5b4fc',
                        paddingLeft: '0.5rem',
                        marginLeft: 0,
                      }}
                    >
                      <div style={{ color: '#6b7280', marginBottom: 2 }}>
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
                        <strong style={{ color: '#111827' }}>{c.personName}</strong>
                        <span style={{ marginLeft: '0.5rem' }}>
                          {weekdayTimeChicago} · {daysAgoLabel}
                        </span>
                      </div>
                      <div style={{ color: '#4b5563', fontSize: '0.8125rem' }}>
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
                              color: '#92400e',
                              background: '#fef3c7',
                              border: '1px solid #fde68a',
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
                        <div style={{ color: '#1f2937', whiteSpace: 'pre-wrap', marginTop: 4 }}>{c.note}</div>
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
                        borderBottom: '1px solid #f3f4f6',
                        fontSize: '0.8125rem',
                        borderLeft: `3px solid ${meta.borderColor}`,
                        paddingLeft: '0.5rem',
                        marginLeft: 0,
                      }}
                    >
                      <div style={{ color: '#6b7280', marginBottom: 2 }}>
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
                        <strong style={{ color: '#111827' }}>{ev.actorName?.trim() || 'System'}</strong>
                        <span style={{ marginLeft: '0.5rem' }}>
                          {weekdayTimeChicago} · {daysAgoLabel}
                        </span>
                      </div>
                      <div style={{ color: '#1f2937', whiteSpace: 'pre-wrap' }}>{ev.summary}</div>
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
                        borderBottom: '1px solid #f3f4f6',
                        fontSize: '0.8125rem',
                      }}
                    >
                      <div style={{ color: '#6b7280', marginBottom: 2 }}>
                        <strong style={{ color: '#111827' }}>{authorName}</strong>
                        <span style={{ marginLeft: '0.5rem' }}>
                          {weekdayTimeChicago} · {daysAgoLabel}
                        </span>
                      </div>
                      <div style={{ color: '#1f2937', whiteSpace: 'pre-wrap' }}>{n.body}</div>
                    </li>
                  )
                }
                const r = item.report
                const { weekdayTimeChicago, daysAgoLabel } = getDispatchNoteDisplayMeta(r.created_at)
                const summary = firstNonEmptyFieldValueSummary(r)
                return (
                  <li
                    key={`r-${r.id}`}
                    style={{
                      padding: '0.5rem 0',
                      borderBottom: '1px solid #f3f4f6',
                      fontSize: '0.8125rem',
                      borderLeft: '3px solid #93c5fd',
                      paddingLeft: '0.5rem',
                      marginLeft: 0,
                    }}
                  >
                    <div style={{ color: '#6b7280', marginBottom: 2 }}>
                      <span
                        style={{
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          color: '#2563eb',
                          marginRight: '0.35rem',
                          verticalAlign: 'middle',
                        }}
                      >
                        Report
                      </span>
                      <strong style={{ color: '#111827' }}>{r.created_by_name?.trim() || 'Unknown'}</strong>
                      <span style={{ marginLeft: '0.5rem' }}>
                        {weekdayTimeChicago} · {daysAgoLabel}
                      </span>
                    </div>
                    <div style={{ color: '#1f2937' }}>
                      <span style={{ fontWeight: 600 }}>{displayReportTemplateName(r.template_name, viewerRole)}</span>
                      {summary ? (
                        <div style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{summary}</div>
                      ) : null}
                      <div style={{ marginTop: 6 }}>
                        <button
                          type="button"
                          onClick={() => setViewingReport(r)}
                          style={{
                            padding: '0.2rem 0.5rem',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            background: '#eff6ff',
                            color: '#1d4ed8',
                            border: '1px solid #93c5fd',
                            borderRadius: 4,
                            cursor: 'pointer',
                          }}
                        >
                          View full report
                        </button>
                      </div>
                    </div>
                  </li>
                )
              })
            )}
          </ul>
        </div>
      )}
      <ReportViewModal open={viewingReport != null} report={viewingReport} onClose={() => setViewingReport(null)} viewerRole={viewerRole} />
      {!canPost && (scheduleAction || scheduleDispatchAction) ? (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            flexWrap: 'wrap',
            gap: '0.35rem',
            marginTop: '0.5rem',
          }}
        >
          {scheduleAction ? <JobThreadScheduleButton action={scheduleAction} /> : null}
          {scheduleDispatchAction ? <JobThreadWeekDispatchButton action={scheduleDispatchAction} /> : null}
        </div>
      ) : null}
      {canPost && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
          {showComposerLabel ? (
            <label htmlFor="job-thread-note-body" style={{ fontSize: '0.75rem', color: '#6b7280', display: 'block' }}>
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
              padding: '0.5rem',
              fontSize: '0.875rem',
              border: '1px solid #d1d5db',
              borderRadius: 4,
              boxSizing: 'border-box',
              resize: 'none',
              maxHeight: '10rem',
              overflowY: 'auto',
              lineHeight: 1.35,
            }}
          />
          {scheduleAction || scheduleDispatchAction ? (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '0.5rem',
                width: '100%',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginRight: 'auto',
                }}
              >
                {scheduleAction ? <JobThreadScheduleButton action={scheduleAction} /> : null}
                {scheduleDispatchAction ? <JobThreadWeekDispatchButton action={scheduleDispatchAction} /> : null}
                {jobThreadStampActions ? (
                  <JobThreadStampButtons actions={jobThreadStampActions} submitting={submitting} />
                ) : null}
              </div>
              <button
                type="button"
                onClick={onSubmit}
                disabled={submitting || draft.trim().length === 0}
                style={{
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.8125rem',
                  background: submitting || draft.trim().length === 0 ? '#e5e7eb' : '#3b82f6',
                  color: submitting || draft.trim().length === 0 ? '#6b7280' : 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: submitting || draft.trim().length === 0 ? 'not-allowed' : 'pointer',
                  flexShrink: 0,
                }}
              >
                {submitting ? 'Posting…' : 'Post note'}
              </button>
            </div>
          ) : (
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
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: '0.5rem',
                    marginRight: 'auto',
                  }}
                >
                  <JobThreadStampButtons actions={jobThreadStampActions} submitting={submitting} />
                </div>
              ) : null}
              <button
                type="button"
                onClick={onSubmit}
                disabled={submitting || draft.trim().length === 0}
                style={{
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.8125rem',
                  background: submitting || draft.trim().length === 0 ? '#e5e7eb' : '#3b82f6',
                  color: submitting || draft.trim().length === 0 ? '#6b7280' : 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: submitting || draft.trim().length === 0 ? 'not-allowed' : 'pointer',
                  flexShrink: 0,
                  marginLeft: jobThreadStampActions ? undefined : 'auto',
                }}
              >
                {submitting ? 'Posting…' : 'Post note'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
