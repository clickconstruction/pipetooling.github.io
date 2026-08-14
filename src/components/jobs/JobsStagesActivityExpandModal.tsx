import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { UserRole } from '../../hooks/useAuth'
import type { JobThreadActivityItem } from '../JobThreadNotesPanel'
import {
  buildJobActivityModalItems,
  filterJobActivityModalItems,
  groupJobActivityModalItemsByDay,
  type JobActivityBoxEntry,
} from '../../lib/jobs/jobActivityBoxFeed'
import { ACTIVITY_FILTERS, countActivityByFilter, type ActivityFilter } from '../../lib/jobActivityFilter'
import { eventRenderMeta } from '../../lib/jobActivityEvent'
import { renderStagesThreadFullscreenJobHeader } from './jobsStagesRowShared'
import { formatStagesCompactWindow, formatStagesNextDateLabel } from '../../lib/stagesUpcomingSchedule'
import type { StagesUpcomingAppointment } from '../../lib/stagesUpcomingSchedule'
import { displayReportTemplateName } from '../../lib/reportTemplateDisplayName'
import { allReportFieldLinesForThread } from '../../lib/reportForViewFromJobLedgerRow'
import { formatDecimalWorkHoursToHhMm } from '../../lib/formatDecimalWorkHoursHhMm'
import { scheduleFormatDateLongNoWeekday, scheduleFormatWindow } from '../../lib/jobScheduleChicago'
import { clampCompletenessPct } from '../../lib/jobs/jobCompleteness'
import { pctNoteRequired, validatePctCommit } from '../../lib/jobs/stagesPctNote'
import {
  formatDispatchNoteDaysAgoShort,
  formatDispatchNoteTimeChicago,
  formatDispatchNoteWeekdayShortTimeChicago,
} from '../../utils/dispatchNoteDisplay'

/**
 * Full-page Job activity view (owner-approved mockup, then "fold all of the
 * dropdown's pieces in"): the ENTIRE timeline — numbered notes/reports plus
 * schedule/clock/status/billing/crew items — day-grouped oldest → newest,
 * with the thread panel's All/Notes/Reports/Status/Billing/Crew filter, the
 * % complete editor, and the team-members / manage-people header. Opened by
 * the activity box's corner expand button and the row's "N Reports" chip.
 * Closed by ✕, Escape, or the backdrop; Escape while typing first blurs the
 * composer (draft kept) so a stray key never eats an unfinished note.
 */

const numStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 22,
  height: 22,
  borderRadius: '50%',
  flexShrink: 0,
  border: '1px solid var(--border-strong)',
  color: 'var(--text-muted)',
  fontSize: '0.72rem',
  fontWeight: 700,
  lineHeight: 1,
  marginRight: 12,
  marginTop: 1,
}

/** Entry meta, e.g. "Thu 3:45 PM (1d)" / "Fri 11:53 AM (today)". */
function metaLabel(atIso: string): string {
  return `${formatDispatchNoteWeekdayShortTimeChicago(atIso)} (${formatDispatchNoteDaysAgoShort(atIso)})`
}

const timelineTagStyle = (color: string): CSSProperties => ({
  fontSize: '0.65rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  color,
  marginRight: '0.4rem',
  verticalAlign: 'middle',
})

type Props = {
  job: JobWithDetails
  /** Raw thread activity (all kinds); null while the lazy load is in flight. */
  activity: JobThreadActivityItem[] | null
  upcoming: StagesUpcomingAppointment | null
  onClose: () => void
  /** Same thread-note pipeline as the box; absent → read-only (no composer). */
  submitNoteWithBody?: (jobId: string, body: string, source: 'draft' | 'stamp') => Promise<void>
  /** Passed to {@link displayReportTemplateName} for report row titles. */
  viewerRole?: UserRole | null
  /** Pipeline % complete (jobs_ledger.pct_complete); null when never set. */
  pctComplete?: number | null
  canEditPct?: boolean
  pctSaving?: boolean
  /** Commits a new percent + note (the tab's commitStagesPctWithNote). */
  onCommitPct?: (value: number, note: string) => void | Promise<void>
  /** People assigned to the job (jobs_ledger_team_members). */
  teamMembers?: Array<{ user_id: string; name: string | null }>
  /** Opens the add/remove-people modal (editors only; it stacks above at z 1002). */
  peopleAction?: { onClick: () => void }
}

export function JobsStagesActivityExpandModal({
  job,
  activity,
  upcoming,
  onClose,
  submitNoteWithBody,
  viewerRole,
  pctComplete,
  canEditPct,
  pctSaving,
  onCommitPct,
  teamMembers,
  peopleAction,
}: Props) {
  const [draft, setDraft] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all')
  const [pctEditorOpen, setPctEditorOpen] = useState(false)
  const [pctDraft, setPctDraft] = useState(pctComplete ?? 0)
  const [pctNoteError, setPctNoteError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const feedRef = useRef<HTMLDivElement | null>(null)

  const loaded = activity != null
  const allItems = useMemo(() => buildJobActivityModalItems(activity ?? []), [activity])
  const visibleItems = useMemo(() => filterJobActivityModalItems(allItems, activityFilter), [allItems, activityFilter])
  const groups = useMemo(() => groupJobActivityModalItemsByDay(visibleItems), [visibleItems])
  const filterCounts = useMemo(() => (activity ? countActivityByFilter(activity) : null), [activity])

  // Escape anywhere in the modal closes it; the composer's own Escape handler
  // stops propagation before this listener sees it (blur-first behavior).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  // Newest entries sit at the bottom (transcript order) — start there.
  useEffect(() => {
    const el = feedRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [loaded, visibleItems.length])

  const post = async () => {
    const body = draft.trim()
    if (!body || !submitNoteWithBody || submitting) return
    setSubmitting(true)
    try {
      await submitNoteWithBody(job.id, body, 'draft')
      setDraft('')
    } finally {
      setSubmitting(false)
    }
  }

  const openPctEditor = () => {
    setPctDraft(pctComplete ?? 0)
    setPctNoteError(null)
    setPctEditorOpen(true)
  }
  const cancelPctEditor = () => {
    setPctEditorOpen(false)
    setPctNoteError(null)
  }
  const commitPctEditor = async () => {
    if (!onCommitPct || pctSaving) return
    const check = validatePctCommit(pctDraft, draft)
    if (!check.ok) {
      setPctNoteError(check.error)
      return
    }
    setPctNoteError(null)
    await onCommitPct(pctDraft, draft.trim())
    setDraft('')
    setPctEditorOpen(false)
  }

  const jobName = (job.job_name ?? '').trim() || 'this job'

  const renderEntry = (entry: JobActivityBoxEntry, item: JobThreadActivityItem) => {
    const isReport = item.kind === 'report'
    const reportLines = isReport ? allReportFieldLinesForThread(item.report) : []
    return (
      <div
        key={`e-${entry.number}-${entry.atIso}`}
        style={{ display: 'flex', alignItems: 'flex-start', padding: '0.55rem 2px', borderBottom: '1px dashed var(--border)' }}
      >
        <span style={numStyle} aria-label={`Entry ${entry.number}`}>
          {entry.number}
        </span>
        <span style={{ minWidth: 0, fontSize: '0.85rem', lineHeight: 1.55, color: 'var(--text-700)' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{metaLabel(entry.atIso)}</span>{' '}
          <strong style={{ color: 'var(--text-strong)' }}>{entry.authorName ?? '—'}</strong>
          <span style={{ color: 'var(--text-faint)', margin: '0 5px' }}>|</span>
          {isReport ? (
            <>
              <span style={{ fontWeight: 600 }}>
                Report: {displayReportTemplateName(item.report.template_name, viewerRole)}
              </span>
              {reportLines.length > 0 ? (
                <span style={{ display: 'block', marginTop: 4 }}>
                  {reportLines.map((l, i) => (
                    <span key={`${l.label}-${i}`} style={{ display: 'block', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {l.label ? <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{l.label} — </span> : null}
                      {l.value}
                    </span>
                  ))}
                </span>
              ) : null}
            </>
          ) : (
            entry.body
          )}
        </span>
      </div>
    )
  }

  const renderTimelineItem = (item: JobThreadActivityItem, atIso: string) => {
    if (item.kind === 'schedule_block') {
      const s = item.schedule
      return (
        <div
          key={s.dedupeKey}
          style={{ padding: '0.5rem 2px 0.5rem 0.6rem', borderBottom: '1px dashed var(--border)', borderLeft: '3px solid var(--border-green)', fontSize: '0.8rem' }}
        >
          <span style={timelineTagStyle('#15803d')}>Schedule</span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{metaLabel(atIso)}</span>
          <div style={{ color: 'var(--text-600)', marginTop: 2 }}>
            {scheduleFormatDateLongNoWeekday(s.work_date)} · {scheduleFormatWindow(s.time_start, s.time_end)}
            {s.assigneeLabels ? <span style={{ color: 'var(--text-muted)' }}>{` · ${s.assigneeLabels}`}</span> : null}
          </div>
          {s.note ? <div style={{ color: 'var(--text-gray-800)', whiteSpace: 'pre-wrap', marginTop: 2 }}>{s.note}</div> : null}
        </div>
      )
    }
    if (item.kind === 'clock_session') {
      const c = item.clock
      const inLabel = c.clockedInAt ? formatDispatchNoteTimeChicago(c.clockedInAt) : '—'
      const outLabel = c.clockedOutAt ? formatDispatchNoteTimeChicago(c.clockedOutAt) : null
      const durLabel = c.durationHours != null ? formatDecimalWorkHoursToHhMm(c.durationHours) : null
      return (
        <div
          key={c.dedupeKey}
          style={{ padding: '0.5rem 2px 0.5rem 0.6rem', borderBottom: '1px dashed var(--border)', borderLeft: '3px solid var(--border-indigo)', fontSize: '0.8rem' }}
        >
          <span style={timelineTagStyle('#4f46e5')}>Clock</span>
          <strong style={{ color: 'var(--text-strong)' }}>{c.personName}</strong>{' '}
          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{metaLabel(atIso)}</span>
          <div style={{ color: 'var(--text-600)', marginTop: 2 }}>
            {outLabel ? `${inLabel} → ${outLabel}${durLabel ? ` · ${durLabel}` : ''}` : `${inLabel} → still on the clock`}
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
          {c.note ? <div style={{ color: 'var(--text-gray-800)', whiteSpace: 'pre-wrap', marginTop: 2 }}>{c.note}</div> : null}
        </div>
      )
    }
    if (item.kind === 'event') {
      const ev = item.event
      const meta = eventRenderMeta(ev.type)
      return (
        <div
          key={ev.dedupeKey}
          style={{ padding: '0.5rem 2px 0.5rem 0.6rem', borderBottom: '1px dashed var(--border)', borderLeft: `3px solid ${meta.borderColor}`, fontSize: '0.8rem' }}
        >
          <span style={timelineTagStyle(meta.tagColor)}>{meta.tag}</span>
          <strong style={{ color: 'var(--text-strong)' }}>{ev.actorName?.trim() || 'System'}</strong>{' '}
          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{metaLabel(atIso)}</span>
          <div style={{ color: 'var(--text-gray-800)', whiteSpace: 'pre-wrap', marginTop: 2 }}>{ev.summary}</div>
        </div>
      )
    }
    return null
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Expanded job activity for ${jobName}`}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1001,
        background: 'rgba(15, 23, 42, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          borderRadius: 14,
          width: '100%',
          height: '100%',
          maxWidth: 980,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 70px rgba(0,0,0,0.45)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '0.8rem 1.1rem',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>{renderStagesThreadFullscreenJobHeader(job)}</div>
          <span style={{ color: 'var(--text-faint)', fontSize: '0.68rem', whiteSpace: 'nowrap' }}>esc to close</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close job activity"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '1.05rem',
              cursor: 'pointer',
              lineHeight: 1,
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>

        {/* Toolbar: people/team on the left, filter pills, % readout right. */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.5rem',
            padding: '0.55rem 1.1rem 0',
          }}
        >
          {peopleAction ? (
            <button
              type="button"
              onClick={peopleAction.onClick}
              title="Add or remove people on this job"
              aria-label="Manage people on this job"
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, flexShrink: 0, padding: 0, border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-link)', cursor: 'pointer' }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true">
                <path d="M144 192C144 156.7 172.7 128 208 128C243.3 128 272 156.7 272 192C272 227.3 243.3 256 208 256C172.7 256 144 227.3 144 192zM32 448C32 386.6 81.6 337 143 337L177 337C238.4 337 288 386.6 288 448C288 465.7 273.7 480 256 480L64 480C46.3 480 32 465.7 32 448zM368 192C368 156.7 396.7 128 432 128C467.3 128 496 156.7 496 192C496 227.3 467.3 256 432 256C396.7 256 368 227.3 368 192zM352 448C352 386.6 401.6 337 463 337L497 337C558.4 337 608 386.6 608 448C608 465.7 593.7 480 576 480L384 480C366.3 480 352 465.7 352 448z" />
              </svg>
            </button>
          ) : null}
          {teamMembers && teamMembers.length > 0 ? (
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-700)' }}>
              {teamMembers.map((m) => (m.name?.trim() ? m.name.trim() : 'Unknown')).join(', ')}
            </span>
          ) : peopleAction ? (
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>No one assigned</span>
          ) : null}
          <div role="tablist" aria-label="Filter activity" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.25rem' }}>
            {ACTIVITY_FILTERS.map((f) => {
              const active = activityFilter === f.value
              const count = f.value === 'all' ? null : (filterCounts?.[f.value] ?? 0)
              // Empty buckets demote to quiet non-clickable text (the v2.1475
              // pattern) — vocabulary stays fixed, real activity pops.
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
                    style={{ padding: '0.15rem 0.5rem', fontSize: '0.6875rem', fontWeight: 600, borderRadius: 999, cursor: 'default', border: '1px solid transparent', background: 'transparent', color: 'var(--text-faint)' }}
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
                    <span style={{ marginLeft: '0.3rem', fontWeight: 700, color: active ? '#fff' : 'var(--text-link)', fontVariantNumeric: 'tabular-nums' }}>
                      {count}
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>
          {pctComplete != null ? (
            <span title="Pipeline % complete for this job" style={{ marginLeft: 'auto', fontSize: '0.8125rem', color: 'var(--text-700)', whiteSpace: 'nowrap' }}>
              {pctComplete}% complete
            </span>
          ) : null}
        </div>

        {upcoming ? (
          <div
            style={{
              margin: '0.6rem 1.1rem 0',
              padding: '0.35rem 0.65rem',
              borderLeft: '3px solid var(--border-green)',
              background: 'var(--bg-subtle)',
              borderRadius: '0 8px 8px 0',
              fontSize: '0.78rem',
              color: 'var(--text-muted)',
            }}
          >
            <span style={{ fontWeight: 700, fontSize: '0.68rem', textTransform: 'uppercase', color: '#15803d' }}>Next</span>
            <span style={{ margin: '0 0.4rem' }}>·</span>
            {formatStagesNextDateLabel(upcoming.ymd)} {formatStagesCompactWindow(upcoming.timeStart, upcoming.timeEnd)} ·{' '}
            {upcoming.assigneeNames.join(', ')}
          </div>
        ) : null}

        <div ref={feedRef} style={{ flex: 1, overflowY: 'auto', padding: '0.4rem 1.1rem 1rem', scrollbarWidth: 'thin' }}>
          {!loaded ? (
            <div style={{ color: 'var(--text-faint)', padding: '1.5rem 0', textAlign: 'center' }}>Loading activity…</div>
          ) : groups.length === 0 ? (
            <div style={{ color: 'var(--text-faint)', padding: '1.5rem 0', textAlign: 'center' }}>
              {activityFilter === 'all' ? 'No activity yet — post the first note' : 'Nothing here for this filter'}
            </div>
          ) : (
            groups.map((g) => (
              <div key={g.dayKey || 'unknown-day'}>
                <div
                  style={{
                    textAlign: 'center',
                    color: 'var(--text-faint)',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    margin: '0.9rem 0 0.25rem',
                  }}
                >
                  {g.label}
                  {g.isToday ? ' · Today' : ''}
                </div>
                {g.items.map((mi) => (mi.kind === 'entry' ? renderEntry(mi.entry, mi.item) : renderTimelineItem(mi.item, mi.atIso)))}
              </div>
            ))
          )}
        </div>

        {submitNoteWithBody ? (
          pctEditorOpen && canEditPct ? (
            /* % complete editor takes over the composer area: slider on top,
               then [note field | Cancel | Set to N%]. Note required below 100%. */
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                margin: '0 1.1rem 1rem',
                padding: '0.6rem',
                border: '1px solid var(--border)',
                borderRadius: 10,
                background: 'var(--surface)',
                boxShadow: '0 6px 18px rgba(0,0,0,0.12)',
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
                value={pctDraft}
                disabled={pctSaving}
                onChange={(e) => setPctDraft(Number(e.target.value))}
                aria-label="Percent complete slider"
                style={{ width: '100%', accentColor: '#3b82f6', cursor: pctSaving ? 'not-allowed' : 'pointer' }}
              />
              {pctNoteError ? <p style={{ color: 'var(--text-red-700)', fontSize: '0.75rem', margin: 0 }}>{pctNoteError}</p> : null}
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  value={draft}
                  disabled={pctSaving}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void commitPctEditor()
                    if (e.key === 'Escape') {
                      e.stopPropagation()
                      cancelPctEditor()
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
                  onClick={() => void commitPctEditor()}
                  disabled={pctSaving}
                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.8125rem', fontWeight: 600, background: pctSaving ? 'var(--bg-200)' : '#3b82f6', color: pctSaving ? 'var(--text-muted)' : '#fff', border: 'none', borderRadius: 4, cursor: pctSaving ? 'not-allowed' : 'pointer', flexShrink: 0 }}
                >
                  {pctSaving ? 'Setting…' : `Set to ${pctDraft}%`}
                </button>
              </div>
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                margin: '0 1.1rem 1rem',
                padding: '5px 7px 5px 14px',
                border: '1px solid #3b82f6',
                borderRadius: 999,
                background: 'var(--surface)',
                boxShadow: '0 6px 18px rgba(0,0,0,0.12)',
              }}
            >
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void post()
                  if (e.key === 'Escape') {
                    // First Escape leaves the composer (draft kept); the next
                    // one reaches the document listener and closes the modal.
                    e.stopPropagation()
                    inputRef.current?.blur()
                  }
                }}
                placeholder={`Add a note to ${jobName}…`}
                aria-label="Note text"
                disabled={submitting}
                style={{
                  flex: 1,
                  minWidth: 0,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--text-strong)',
                  fontSize: '0.85rem',
                }}
              />
              {canEditPct && onCommitPct ? (
                <button
                  type="button"
                  onClick={openPctEditor}
                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.72rem', fontWeight: 600, background: 'none', color: 'var(--text-link)', border: '1px solid #2563eb', borderRadius: 999, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
                >
                  Set % complete
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void post()}
                disabled={submitting}
                style={{
                  background: '#3b82f6',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 999,
                  padding: '5px 16px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                }}
              >
                {submitting ? '…' : 'Post'}
              </button>
            </div>
          )
        ) : null}
      </div>
    </div>
  )
}
