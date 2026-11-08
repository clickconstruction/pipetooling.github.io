import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { StagesRowRenderContext } from './jobsStagesRowShared'
import { activityBoxTeaser, buildJobActivityBoxFeed, NOBODY_HAS_ANSWERED, type JobActivityBoxEntry, type JobActivityBoxLine } from '../../lib/jobs/jobActivityBoxFeed'
import { formatStagesCompactWindow, formatStagesNextDateLabel } from '../../lib/stagesUpcomingSchedule'
import { JobsWorkedTodayReportIcon } from '../icons/JobsWorkedTodayReportIcon'
import { seeAllDoorWords } from '../../lib/jobs/stagesRowDoors'
import {
  formatDispatchNoteDaysAgoShort,
  formatDispatchNoteWeekdayShortTimeChicago,
} from '../../utils/dispatchNoteDisplay'

/** Entry meta, e.g. "Thu 3:45 PM (1d)" / "Fri 11:53 AM (today)". */
function entryMetaLabel(atIso: string): string {
  return `${formatDispatchNoteWeekdayShortTimeChicago(atIso)} (${formatDispatchNoteDaysAgoShort(atIso)})`
}

/**
 * The Pipeline row "Job activity" box (viewports ≥1100px): fills the
 * Job cell's dead middle with the job's conversational trail: the notes, the
 * reports, since v2.5633 a bill sent to the customer, unnumbered, and since
 * v2.6689 (punch list #125) the customer's own conversation: the job's newest
 * three calls, texts and emails, unnumbered under an orange tag naming the
 * channel, the customer's in orange and a line from them with the bar and,
 * while nobody has answered it, the dot's words. A press on a line opens the
 * bubble's sheet. Anatomy (owner-
 * approved mockup): pinned NEXT line, a SCROLLING feed of numbered entries
 * in chat order — 1 = oldest at the top, newest at the bottom, the box keeps
 * itself scrolled to the newest (owner request v2.2062; numbers are stable
 * references: "check note 3" never shifts) —
 * a strip UNDER the box (v2.4302: See all · + Add · report pill — nothing
 * sits on the notes any more), and a composer bar that opens in the strip's
 * place. Since v2.4324 See all is the row's one door to the trail (the Job
 * column's Reports pill is gone where the box draws): it carries the report
 * count, and a report's number wears the link blue. The box keeps its height; the strip uses the dead space below. The feed
 * beyond the latest entry lazy-loads on first pointer interaction via the
 * thread expand's existing loader; posting goes through the same thread-note
 * pipeline as the panel composer (optimistic entry, realtime for others).
 */

const columnStyle: CSSProperties = {
  // No max width: the box spans the Job cell's entire middle (v2.1594) —
  // identity keeps its natural width, the box takes every remaining pixel.
  flex: '1 1 260px',
  minWidth: 240,
  marginLeft: 'auto',
  display: 'flex',
  flexDirection: 'column',
}

const boxStyle: CSSProperties = {
  border: '1px solid var(--border-strong)',
  borderRadius: 10,
  background: 'var(--bg-subtle)',
  padding: '0.5rem 0.65rem',
  fontSize: '0.75rem',
  textAlign: 'left',
}

/** The strip and the composer share one height, so opening the composer never moves the row. */
const STRIP_HEIGHT = 22

const numStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 17,
  height: 17,
  borderRadius: '50%',
  flexShrink: 0,
  border: '1px solid var(--border-strong)',
  color: 'var(--text-muted)',
  fontSize: '0.625rem',
  fontWeight: 700,
  lineHeight: 1,
  marginRight: 7,
  marginTop: 1,
}

/** A report's number wears the link blue (v2.4324): the row's Reports pill is gone, so the box says which lines are reports. */
const reportNumStyle: CSSProperties = {
  ...numStyle,
  border: '1px solid var(--text-link)',
  color: 'var(--text-link)',
  background: 'var(--bg-blue-tint)',
}

/** A send to the customer (a bill since v2.5633, the papers that follow it since v2.5636): no number, a small tag in the report's blue, the same height as a number. */
const sentTagStyle: CSSProperties = {
  ...reportNumStyle,
  width: 'auto',
  borderRadius: 999,
  padding: '0 5px',
  fontWeight: 600,
}

/** The customer's line (v2.6689): the orange tag in the number's place names the channel; from them, the deeper fill. */
const lineTagStyle: CSSProperties = {
  ...sentTagStyle,
  border: '1px solid var(--text-orange-700)',
  color: 'var(--text-orange-700)',
  background: 'var(--surface)',
}
const lineTagInStyle: CSSProperties = {
  ...lineTagStyle,
  border: '1px solid var(--text-orange-800)',
  color: 'var(--text-orange-800)',
  background: 'var(--bg-orange-100)',
}
/** A trade's or a supplier's line tied to the job reads plain, as Job activity draws it. */
const lineTagPlainStyle: CSSProperties = { ...sentTagStyle, border: '1px solid var(--border-strong)', color: 'var(--text-muted)', background: 'var(--surface)' }

const lineTagStyleFor = (l: JobActivityBoxLine): CSSProperties => (!l.customer ? lineTagPlainStyle : l.fromThem ? lineTagInStyle : lineTagStyle)

/** A line from the customer sits on the orange tint with the bar, as her lines do in Job activity. */
const lineInRowStyle: CSSProperties = {
  background: 'var(--bg-orange-tint)',
  boxShadow: 'inset 3px 0 0 var(--border-orange)',
  borderRadius: '0 6px 6px 0',
  padding: '1px 4px 1px 6px',
  marginLeft: -6,
}

/** The press that opens the bubble's sheet on a line: a button with no chrome, the line's own look. */
const lineButtonStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  width: '100%',
  marginTop: 5,
  padding: 0,
  border: 'none',
  background: 'transparent',
  font: 'inherit',
  color: 'inherit',
  textAlign: 'left',
  cursor: 'pointer',
}

function entryLine(e: JobActivityBoxEntry, onOpenLine?: (line: JobActivityBoxLine) => void) {
  const report = e.kind === 'report'
  const sent = e.kind === 'sent'
  const line = e.kind === 'line' ? e.line : undefined
  const key = `${e.kind}-${e.number ?? line?.id ?? 'x'}-${e.atIso}`
  const inner = (
    <>
      {line ? (
        // The customer's conversation (v2.6689): no number, the channel's tag in orange holds its place.
        <span style={lineTagStyleFor(line)} aria-label={`${line.fromThem ? 'From' : 'To'} the customer, a ${line.tag.toLowerCase()}`}>
          {line.tag}
        </span>
      ) : sent ? (
        // A send to the customer (v2.5633, v2.5636) takes no number: a small Sent tag in the billing blue holds its place.
        <span style={sentTagStyle} aria-label="Sent to the customer">
          Sent
        </span>
      ) : (
        <span style={report ? reportNumStyle : numStyle} aria-label={report ? `Entry ${e.number}, a report` : `Entry ${e.number}`}>
          {e.number}
        </span>
      )}
      <span
        style={{
          minWidth: 0,
          color: 'var(--text-700)',
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitBoxOrient: 'vertical',
          WebkitLineClamp: 2,
          lineHeight: 1.45,
        }}
        title={`${e.number == null ? '' : `(${e.number}) `}${formatDispatchNoteWeekdayShortTimeChicago(e.atIso)} ${e.authorName ?? ''} — ${e.body}`}
      >
        {report ? (
          <span style={{ marginRight: 4 }}>
            <JobsWorkedTodayReportIcon decorative />
          </span>
        ) : null}
        <span style={{ color: 'var(--text-muted)', fontSize: '0.6875rem' }}>
          {entryMetaLabel(e.atIso)}
        </span>{' '}
        <strong style={{ color: line?.fromThem && line.customer ? 'var(--text-orange-800)' : 'var(--text-strong)' }}>{e.authorName ?? '—'}</strong>
        <span style={{ color: 'var(--text-faint)', margin: '0 5px' }}>|</span>
        {e.body}
        {line?.waiting ? <em style={{ color: 'var(--text-orange-700)', fontWeight: 600, marginLeft: 5, fontStyle: 'normal' }}>{NOBODY_HAS_ANSWERED}</em> : null}
      </span>
    </>
  )
  if (line && onOpenLine) {
    return (
      <button
        key={key}
        type="button"
        data-activity-entry-kind={e.kind}
        onClick={(ev) => {
          ev.stopPropagation()
          onOpenLine(line)
        }}
        title="Open the conversation with the customer"
        style={line.fromThem && line.customer ? { ...lineButtonStyle, ...lineInRowStyle } : lineButtonStyle}
      >
        {inner}
      </button>
    )
  }
  return (
    <div key={key} data-activity-entry-kind={e.kind} style={{ display: 'flex', alignItems: 'flex-start', marginTop: 5, ...(line?.fromThem && line.customer ? lineInRowStyle : {}) }}>
      {inner}
    </div>
  )
}

type Props = {
  job: JobWithDetails
  ctx: StagesRowRenderContext
  /** Lazy full-feed loader — the thread expand's loader, fired on first pointer interaction. */
  loadActivityForJob?: (jobId: string) => void
  /** The thread-note pipeline (optimistic + realtime). Absent → no Post pill (read-only box). */
  submitNoteWithBody?: (jobId: string, body: string, source: 'draft' | 'stamp') => Promise<boolean>
}

export function JobsStagesActivityBox({ job, ctx, loadActivityForJob, submitNoteWithBody }: Props) {
  const [composerOpen, setComposerOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const requestedLoadRef = useRef(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const feedScrollRef = useRef<HTMLDivElement | null>(null)

  const activity = ctx.jobThreadActivityByJobId[job.id]
  const loaded = activity != null
  // The customer's lines on the job (v2.6689) and whether the dot is on: their newest line carries the dot's words.
  const lines = ctx.customerLinesByJobId?.get(job.id)
  const waiting = ctx.boardDotByJobId?.get(job.id) != null
  const feed = loaded ? buildJobActivityBoxFeed(activity, { lines, waiting }) : []
  const stat = ctx.jobThreadStatsByJobId[job.id]
  const up = ctx.stagesUpcomingByJobId[job.id]
  // A press on a line opens the bubble's sheet, where the thread's last lines and the reply box are.
  const openLine = ctx.onOpenCustomerDoor ? () => ctx.onOpenCustomerDoor?.(job) : undefined

  const ensureLoaded = () => {
    if (requestedLoadRef.current || loaded || !loadActivityForJob) return
    requestedLoadRef.current = true
    loadActivityForJob(job.id)
  }

  // Pre-load teaser: the newest of the board-wide stats' note and report and the board's lines (v2.6689).
  const teaser = loaded ? null : activityBoxTeaser(stat, lines, waiting)

  const empty = loaded ? feed.length === 0 : teaser == null

  // Chat order keeps the newest at the bottom (v2.2062) — pin the scroll
  // there whenever the feed grows (initial load and each new entry alike).
  useEffect(() => {
    const el = feedScrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [feed.length])

  const openComposer = () => {
    ensureLoaded()
    setComposerOpen(true)
    setTimeout(() => inputRef.current?.focus(), 150)
  }
  const closeComposer = () => {
    setComposerOpen(false)
    setDraft('')
  }
  const post = async () => {
    const body = draft.trim()
    if (!body || !submitNoteWithBody || submitting) {
      if (!body) closeComposer()
      return
    }
    setSubmitting(true)
    try {
      // Only dismiss the composer when the note actually landed — a failed post
      // used to close the bar and take the typed text with it (v2.1673).
      if (await submitNoteWithBody(job.id, body, 'draft')) closeComposer()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      style={columnStyle}
      onPointerEnter={ensureLoaded}
      onFocusCapture={ensureLoaded}
      aria-label={`Job activity for ${(job.job_name ?? '').trim() || 'job'}`}
    >
      <div style={boxStyle}>
        {up ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              ctx.openJobCalendar(job)
            }}
            title="Next scheduled appointment — open the job calendar"
            style={{
              display: 'block',
              width: '100%',
              margin: '0 0 4px',
              padding: '0 8px',
              // Longhands only — a `border` shorthand + `borderLeft` mix trips
              // React's style-diff warning when unkeyed siblings shift (v2.770).
              borderTop: 'none',
              borderRight: 'none',
              borderBottom: 'none',
              borderLeft: '3px solid var(--border-green)',
              background: 'transparent',
              cursor: 'pointer',
              textAlign: 'left',
              font: 'inherit',
              fontSize: '0.6875rem',
              color: 'var(--text-muted)',
            }}
          >
            <span style={{ fontWeight: 700, fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-green-700)' }}>Next</span>
            <span style={{ margin: '0 0.35rem' }}>·</span>
            {formatStagesNextDateLabel(up.ymd)} {formatStagesCompactWindow(up.timeStart, up.timeEnd)} · {up.assigneeNames.join(', ')}
          </button>
        ) : null}
        {/* Nothing floats over the feed (v2.4302): it takes the box's full width. */}
        <div
          ref={feedScrollRef}
          style={{
            maxHeight: 96,
            overflowY: 'auto',
            scrollbarWidth: 'thin',
          }}
        >
          {loaded ? (
            feed.map((e) => entryLine(e, openLine))
          ) : teaser?.kind === 'line' ? (
            // The customer's line is the newest thing on the job: it reads as it will in the feed (v2.6689).
            entryLine({ ...teaser, number: null }, openLine)
          ) : teaser ? (
            <div style={{ display: 'flex', alignItems: 'flex-start', marginTop: 2 }}>
              <span style={{ minWidth: 0, color: 'var(--text-700)', overflow: 'hidden', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, lineHeight: 1.45 }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.6875rem' }}>
                  {entryMetaLabel(teaser.atIso)}
                </span>{' '}
                <strong style={{ color: 'var(--text-strong)' }}>{teaser.authorName ?? '—'}</strong>
                <span style={{ color: 'var(--text-faint)', margin: '0 5px' }}>|</span>
                {teaser.body}
              </span>
            </div>
          ) : null}
          {empty ? (
            // Same vertical metrics as the one-line teaser so empty boxes match
            // the height of boxes with one line of activity.
            <div style={{ color: 'var(--text-faint)', marginTop: 2, lineHeight: 1.45, textAlign: 'center' }}>
              No activity yet — post the first note
            </div>
          ) : null}
        </div>
      </div>
      {/* The strip under the box (v2.4302, owner call: the box keeps its height, the
          buttons go below it). See all on the left (the old corner arrows, now with
          the count); + Add, then the report pill, on the right. */}
      {!composerOpen ? (
        <div style={{ display: 'flex', alignItems: 'stretch', gap: 6, marginTop: 4, height: STRIP_HEIGHT }}>
          {!empty ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                ctx.openJobActivityExpand(job)
              }}
              aria-label="Expand job activity"
              title="Open every note and report on this job"
              className="stages-activity-see-all"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                background: 'transparent',
                border: 'none',
                padding: '0 4px',
                font: 'inherit',
                fontSize: '0.71875rem',
                cursor: 'pointer',
              }}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M9.5 2.5h4v4" />
                <path d="M13.5 2.5 9 7" />
                <path d="M6.5 13.5h-4v-4" />
                <path d="M2.5 13.5 7 9" />
              </svg>
              {seeAllDoorWords(loaded ? feed.length : null, loaded ? feed.filter((e) => e.kind === 'report').length : (job.report_count ?? 0))}
            </button>
          ) : null}
          <div style={{ flex: 1 }} />
          {submitNoteWithBody ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                openComposer()
              }}
              aria-label="Add a note to this job's activity"
              style={{
                background: '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: 999,
                padding: '0 13px',
                fontSize: '0.71875rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              + Add
            </button>
          ) : null}
          {ctx.openNewReportForJob ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                ctx.openNewReportForJob?.(job)
              }}
              aria-label="File a report on this job"
              title="File a report on this job"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--surface)',
                color: 'var(--text-blue-700)',
                border: '1px solid #3b82f6',
                borderRadius: 999,
                padding: '0 9px',
                cursor: 'pointer',
              }}
            >
              <JobsWorkedTodayReportIcon decorative />
            </button>
          ) : null}
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            gap: 6,
            alignItems: 'center',
            marginTop: 4,
            height: STRIP_HEIGHT,
            boxSizing: 'border-box',
            background: 'var(--surface)',
            border: '1px solid #3b82f6',
            borderRadius: 999,
            padding: '0 4px 0 12px',
          }}
        >
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void post()
              if (e.key === 'Escape') closeComposer()
            }}
            placeholder={`Add a note to ${(job.job_name ?? '').trim() || 'this job'}…`}
            aria-label="Note text"
            disabled={submitting}
            style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-strong)', fontSize: '0.75rem' }}
          />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              void post()
            }}
            disabled={submitting}
            style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 999, padding: '1px 12px', fontSize: '0.71875rem', fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer' }}
          >
            {submitting ? '…' : 'Post'}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              closeComposer()
            }}
            aria-label="Cancel note"
            style={{ background: 'none', border: 'none', color: 'var(--text-faint)', fontSize: '0.875rem', cursor: 'pointer', padding: '0 4px' }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}
