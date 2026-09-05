import { useMemo, useRef, useState, type CSSProperties } from 'react'
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { UserRole } from '../../hooks/useAuth'
import type { JobThreadActivityItem } from '../JobThreadNotesPanel'
import { JobActivityFeed } from './JobActivityFeed'
import { buildJobActivityLines, filterJobActivityLines } from '../../lib/jobs/jobActivityLine'
import { ACTIVITY_FILTERS, countActivityByFilter, type ActivityFilter } from '../../lib/jobActivityFilter'
import { formatStagesCompactWindow, formatStagesNextDateLabel } from '../../lib/stagesUpcomingSchedule'
import type { StagesUpcomingAppointment } from '../../lib/stagesUpcomingSchedule'
import { clampCompletenessPct } from '../../lib/jobs/jobCompleteness'
import { pctNoteRequired, validatePctCommit } from '../../lib/jobs/stagesPctNote'
import { recordedPercentProvenance } from '../../lib/jobPercentProvenance'
import { PercentProvenanceChip } from './PercentProvenanceChip'

/**
 * The unified Job activity body (v2.1673): toolbar, pinned NEXT strip, the
 * shared compact numbered feed, and the composer. Every Pipeline activity
 * surface renders THIS — the floating modal, the expanded row's inline panel
 * and that panel's full-screen mode — so the three no longer disagree about
 * what a job's thread looks like. Only the surrounding shell differs.
 *
 * Toolbar order is deliberate: the crew and the % complete share the top row at
 * every width (owner call — "when it looks like this the 100% should be on the
 * same line as the people"), the filter pills take the row below, and the
 * composer stays a single pill. There are NO Schedule / Week dispatch buttons
 * here (owner call): scheduling lives on its own surfaces, and the pinned Next
 * strip still shows the upcoming block inside the thread.
 */

const ACTION_BTN: CSSProperties = {
  padding: '0.25rem 0.6rem',
  fontSize: '0.7rem',
  fontWeight: 600,
  borderRadius: 999,
  cursor: 'pointer',
  flexShrink: 0,
  whiteSpace: 'nowrap',
}

export type JobActivityViewProps = {
  job: JobWithDetails
  /** Raw thread activity (all kinds); null while the lazy load is in flight. */
  activity: JobThreadActivityItem[] | null
  upcoming: StagesUpcomingAppointment | null
  viewerRole?: UserRole | null
  /** Narrow shells stack each line's body under its meta. */
  narrow?: boolean
  /**
   * The thread-note pipeline (optimistic + realtime). Resolves false when the
   * post failed, and the typed text is put back. Absent → read-only, no composer.
   */
  submitNoteWithBody?: (jobId: string, body: string, source: 'draft' | 'stamp') => Promise<boolean>
  /** Pipeline % complete (jobs_ledger.pct_complete); null when never set. */
  pctComplete?: number | null
  canEditPct?: boolean
  pctSaving?: boolean
  onCommitPct?: (value: number, note: string) => void | Promise<void>
  /** People assigned to the job (jobs_ledger_team_members). */
  teamMembers?: Array<{ user_id: string; name: string | null }>
  /** Opens the add/remove-people modal (editors only). */
  peopleAction?: { onClick: () => void; disabled?: boolean }
  /** Full-screen shells: report answers show open by default (v2.1685). */
  reportsOpenByDefault?: boolean
}

export function JobActivityView({
  job,
  activity,
  upcoming,
  viewerRole,
  narrow = false,
  submitNoteWithBody,
  pctComplete,
  canEditPct = false,
  pctSaving = false,
  onCommitPct,
  teamMembers,
  peopleAction,
  reportsOpenByDefault = false,
}: JobActivityViewProps) {
  const [draft, setDraft] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all')
  const [pctEditorOpen, setPctEditorOpen] = useState(false)
  const [pctDraft, setPctDraft] = useState(pctComplete ?? 0)
  const [pctNoteError, setPctNoteError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const allLines = useMemo(
    () => (activity ? buildJobActivityLines(activity, { viewerRole }) : null),
    [activity, viewerRole],
  )
  const lines = useMemo(
    () => (allLines ? filterJobActivityLines(allLines, activityFilter) : null),
    [allLines, activityFilter],
  )
  const filterCounts = useMemo(() => (activity ? countActivityByFilter(activity) : null), [activity])
  // Who set the recorded % (v2.2852): the crew, when the newest report with a % says the same number; else the office.
  const pctProvenance = useMemo(
    () =>
      recordedPercentProvenance(
        pctComplete,
        (activity ?? []).flatMap((i) => (i.kind === 'report' ? [{ created_at: i.report.created_at, field_values: i.report.field_values ?? null }] : [])),
      ),
    [pctComplete, activity],
  )

  const jobName = (job.job_name ?? '').trim() || 'this job'

  const post = async () => {
    const body = draft.trim()
    if (!body || !submitNoteWithBody || submitting) return
    setSubmitting(true)
    setDraft('')
    try {
      const ok = await submitNoteWithBody(job.id, body, 'draft')
      // A failed post used to eat the note; put it back so it can be retried.
      if (!ok) setDraft(body)
    } finally {
      setSubmitting(false)
    }
  }

  const openPctEditor = () => {
    setPctDraft(pctComplete ?? 0)
    setPctNoteError(null)
    setPctEditorOpen(true)
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

  return (
    <>
      {/* Row 1 — who's on it, and how far along it is. These two stay together
          at every width; the pills are what drops to a row of their own. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.9rem 0' }}>
        {peopleAction ? (
          <button
            type="button"
            onClick={peopleAction.onClick}
            disabled={peopleAction.disabled}
            title="Add or remove people on this job"
            aria-label="Manage people on this job"
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, flexShrink: 0, padding: 0, border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-link)', cursor: peopleAction.disabled ? 'not-allowed' : 'pointer' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true">
              <path d="M144 192C144 156.7 172.7 128 208 128C243.3 128 272 156.7 272 192C272 227.3 243.3 256 208 256C172.7 256 144 227.3 144 192zM32 448C32 386.6 81.6 337 143 337L177 337C238.4 337 288 386.6 288 448C288 465.7 273.7 480 256 480L64 480C46.3 480 32 465.7 32 448zM368 192C368 156.7 396.7 128 432 128C467.3 128 496 156.7 496 192C496 227.3 467.3 256 432 256C396.7 256 368 227.3 368 192zM352 448C352 386.6 401.6 337 463 337L497 337C558.4 337 608 386.6 608 448C608 465.7 593.7 480 576 480L384 480C366.3 480 352 465.7 352 448z" />
            </svg>
          </button>
        ) : null}
        <span
          style={{
            minWidth: 0,
            fontSize: '0.8125rem',
            color: teamMembers && teamMembers.length > 0 ? 'var(--text-700)' : 'var(--text-muted)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {teamMembers && teamMembers.length > 0
            ? teamMembers.map((m) => (m.name?.trim() ? m.name.trim() : 'Unknown')).join(', ')
            : peopleAction
              ? 'No one assigned'
              : ''}
        </span>
        {pctComplete != null ? (
          <span
            title="Pipeline % complete for this job"
            style={{ marginLeft: 'auto', fontSize: '0.8125rem', color: 'var(--text-700)', whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            {pctComplete}% complete
            {activity ? <PercentProvenanceChip source={pctProvenance.source} reportedOn={pctProvenance.reportedOn} /> : null}
          </span>
        ) : null}
      </div>

      {/* Row 2 — the filter buckets. */}
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.35rem', padding: '0.4rem 0.9rem 0' }}>
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
      </div>

      {upcoming ? (
        <div
          style={{
            margin: '0.55rem 0.9rem 0',
            padding: '0.3rem 0.6rem',
            borderLeft: '3px solid var(--border-green)',
            background: 'var(--bg-subtle)',
            borderRadius: '0 8px 8px 0',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
          }}
        >
          <span style={{ fontWeight: 700, fontSize: '0.65rem', textTransform: 'uppercase', color: '#15803d' }}>Next</span>
          <span style={{ margin: '0 0.35rem' }}>·</span>
          {formatStagesNextDateLabel(upcoming.ymd)} {formatStagesCompactWindow(upcoming.timeStart, upcoming.timeEnd)}
          {upcoming.assigneeNames.length > 0 ? ` · ${upcoming.assigneeNames.join(', ')}` : ''}
        </div>
      ) : null}

      <JobActivityFeed lines={lines} filtered={activityFilter !== 'all'} narrow={narrow} reportsOpenByDefault={reportsOpenByDefault} />

      {submitNoteWithBody ? (
        pctEditorOpen && canEditPct ? (
          /* % complete editor takes over the composer area: slider on top,
             then [note field | Cancel | Set to N%]. Note required below 100%. */
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              margin: '0 0.9rem 0.9rem',
              padding: '0.6rem',
              border: '1px solid var(--border)',
              borderRadius: 10,
              background: 'var(--surface)',
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
                    setPctEditorOpen(false)
                    setPctNoteError(null)
                  }
                }}
                maxLength={2000}
                placeholder={pctNoteRequired(pctDraft) ? 'Add a note (required)…' : 'Add a note (optional)…'}
                aria-label="Note for percent change"
                style={{ flex: '1 1 8rem', minWidth: 0, padding: '0.4rem 0.5rem', fontSize: '0.875rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-strong)', boxSizing: 'border-box' }}
              />
              <button
                type="button"
                onClick={() => {
                  setPctEditorOpen(false)
                  setPctNoteError(null)
                }}
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
              margin: '0 0.9rem 0.9rem',
              padding: '5px 7px 5px 14px',
              border: '1px solid #3b82f6',
              borderRadius: 999,
              background: 'var(--surface)',
            }}
          >
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void post()
                if (e.key === 'Escape') {
                  // First Escape leaves the composer (draft kept); the next one
                  // reaches the shell's listener and closes it.
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
                fontSize: '0.8125rem',
                textOverflow: 'ellipsis',
              }}
            />
            {canEditPct && onCommitPct ? (
              <button
                type="button"
                onClick={openPctEditor}
                style={{ ...ACTION_BTN, background: 'none', color: 'var(--text-link)', border: '1px solid #2563eb' }}
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
                flexShrink: 0,
              }}
            >
              {submitting ? '…' : 'Post'}
            </button>
          </div>
        )
      ) : null}
    </>
  )
}
