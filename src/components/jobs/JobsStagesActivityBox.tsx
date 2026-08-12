import { useRef, useState, type CSSProperties } from 'react'
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { StagesRowRenderContext } from './jobsStagesRowShared'
import { buildJobActivityBoxFeed, type JobActivityBoxEntry } from '../../lib/jobs/jobActivityBoxFeed'
import { formatStagesCompactWindow, formatStagesNextDateLabel } from '../../lib/stagesUpcomingSchedule'
import {
  formatDispatchNoteDaysAgoShortPhrase,
  formatDispatchNoteWeekdayShortTimeChicago,
} from '../../utils/dispatchNoteDisplay'

/**
 * The Pipeline row "Job activity" box (wide desktop ≥1440px only): fills the
 * Job cell's dead middle with the job's conversational trail. Anatomy (owner-
 * approved mockup): pinned NEXT line, a SCROLLING feed of numbered entries
 * (1 = oldest — numbers are stable references: "check note 3" never shifts),
 * a floating Post pill, and a sliding composer bar summoned by it. The feed
 * beyond the latest entry lazy-loads on first pointer interaction via the
 * thread expand's existing loader; posting goes through the same thread-note
 * pipeline as the panel composer (optimistic entry, realtime for others).
 */

const boxStyle: CSSProperties = {
  position: 'relative',
  // No max width: the box spans the Job cell's entire middle (v2.1594) —
  // identity keeps its natural width, the box takes every remaining pixel.
  flex: '1 1 260px',
  minWidth: 240,
  marginLeft: 'auto',
  border: '1px solid var(--border-strong)',
  borderRadius: 10,
  background: 'var(--bg-subtle)',
  padding: '0.5rem 0.65rem',
  fontSize: '0.75rem',
  textAlign: 'left',
}

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

function entryLine(e: JobActivityBoxEntry) {
  return (
    <div key={`${e.kind}-${e.number}-${e.atIso}`} style={{ display: 'flex', alignItems: 'flex-start', marginTop: 5 }}>
      <span style={numStyle} aria-label={`Entry ${e.number}`}>{e.number}</span>
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
        title={`(${e.number}) ${e.authorName ?? ''} ${formatDispatchNoteWeekdayShortTimeChicago(e.atIso)} — ${e.body}`}
      >
        <strong style={{ color: 'var(--text-strong)' }}>{e.authorName ?? '—'}</strong>{' '}
        <span style={{ color: 'var(--text-muted)', fontSize: '0.6875rem' }}>
          {formatDispatchNoteWeekdayShortTimeChicago(e.atIso)} · {formatDispatchNoteDaysAgoShortPhrase(e.atIso)}
        </span>
        <span style={{ color: 'var(--text-faint)', margin: '0 5px' }}>|</span>
        {e.body}
      </span>
    </div>
  )
}

type Props = {
  job: JobWithDetails
  ctx: StagesRowRenderContext
  /** Lazy full-feed loader — the thread expand's loader, fired on first pointer interaction. */
  loadActivityForJob?: (jobId: string) => void
  /** The thread-note pipeline (optimistic + realtime). Absent → no Post pill (read-only box). */
  submitNoteWithBody?: (jobId: string, body: string, source: 'draft' | 'stamp') => Promise<void>
}

export function JobsStagesActivityBox({ job, ctx, loadActivityForJob, submitNoteWithBody }: Props) {
  const [composerOpen, setComposerOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const requestedLoadRef = useRef(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const activity = ctx.jobThreadActivityByJobId[job.id]
  const loaded = activity != null
  const feed = loaded ? buildJobActivityBoxFeed(activity) : []
  const stat = ctx.jobThreadStatsByJobId[job.id]
  const up = ctx.stagesUpcomingByJobId[job.id]

  const ensureLoaded = () => {
    if (requestedLoadRef.current || loaded || !loadActivityForJob) return
    requestedLoadRef.current = true
    loadActivityForJob(job.id)
  }

  // Pre-load teaser from the board-wide stats (latest note or report only).
  const teaser = (() => {
    if (loaded || !stat) return null
    const tNote = stat.last_note_at ? Date.parse(stat.last_note_at) : null
    const tRep = stat.last_report_at ? Date.parse(stat.last_report_at) : null
    if (tNote == null && tRep == null) return null
    const useReport = tRep != null && (tNote == null || tRep > tNote)
    return {
      authorName: (useReport ? stat.last_report_author_name : stat.last_note_author_name)?.trim() || null,
      atIso: (useReport ? stat.last_report_at : stat.last_note_at) as string,
      body: useReport
        ? (stat.last_report_preview ?? '').trim() || `Report: ${(stat.last_report_template_name ?? '').trim() || 'Report'}`
        : (stat.last_note_body ?? '').trim(),
    }
  })()

  const empty = loaded ? feed.length === 0 : teaser == null

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
      await submitNoteWithBody(job.id, body, 'draft')
      closeComposer()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      style={boxStyle}
      onPointerEnter={ensureLoaded}
      onFocusCapture={ensureLoaded}
      aria-label={`Job activity for ${(job.job_name ?? '').trim() || 'job'}`}
    >
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
            padding: '0 0 0 8px',
            border: 'none',
            borderLeft: '3px solid var(--border-green)',
            background: 'transparent',
            cursor: 'pointer',
            textAlign: 'left',
            font: 'inherit',
            fontSize: '0.6875rem',
            color: 'var(--text-muted)',
          }}
        >
          <span style={{ fontWeight: 700, fontSize: '0.65rem', textTransform: 'uppercase', color: '#15803d' }}>Next</span>
          <span style={{ margin: '0 0.35rem' }}>·</span>
          {formatStagesNextDateLabel(up.ymd)} {formatStagesCompactWindow(up.timeStart, up.timeEnd)} · {up.assigneeNames.join(', ')}
        </button>
      ) : null}
      <div
        style={{
          maxHeight: 96,
          overflowY: 'auto',
          paddingRight: composerOpen ? 0 : 52,
          scrollbarWidth: 'thin',
        }}
      >
        {loaded ? (
          feed.map(entryLine)
        ) : teaser ? (
          <div style={{ display: 'flex', alignItems: 'flex-start', marginTop: 2 }}>
            <span style={{ minWidth: 0, color: 'var(--text-700)', overflow: 'hidden', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, lineHeight: 1.45 }}>
              <strong style={{ color: 'var(--text-strong)' }}>{teaser.authorName ?? '—'}</strong>{' '}
              <span style={{ color: 'var(--text-muted)', fontSize: '0.6875rem' }}>
                {formatDispatchNoteWeekdayShortTimeChicago(teaser.atIso)} · {formatDispatchNoteDaysAgoShortPhrase(teaser.atIso)}
              </span>
              <span style={{ color: 'var(--text-faint)', margin: '0 5px' }}>|</span>
              {teaser.body}
            </span>
          </div>
        ) : null}
        {empty ? (
          <div style={{ color: 'var(--text-faint)', padding: '6px 0', textAlign: 'center' }}>
            No activity yet — post the first note
          </div>
        ) : null}
      </div>
      {submitNoteWithBody && !composerOpen ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            openComposer()
          }}
          aria-label="Post a note to this job's activity"
          style={{
            position: 'absolute',
            right: 8,
            bottom: 8,
            zIndex: 2,
            background: '#3b82f6',
            color: '#fff',
            border: 'none',
            borderRadius: 999,
            padding: '4px 13px',
            fontSize: '0.71875rem',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 2px 10px rgba(0,0,0,0.35)',
          }}
        >
          Post
        </button>
      ) : null}
      {composerOpen ? (
        <div
          style={{
            position: 'absolute',
            left: 8,
            right: 8,
            bottom: 6,
            zIndex: 3,
            display: 'flex',
            gap: 6,
            alignItems: 'center',
            background: 'var(--surface)',
            border: '1px solid #3b82f6',
            borderRadius: 999,
            padding: '4px 6px 4px 12px',
            boxShadow: '0 6px 18px rgba(0,0,0,0.35)',
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
            style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 999, padding: '3px 12px', fontSize: '0.71875rem', fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer' }}
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
      ) : null}
    </div>
  )
}
