import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import { propertyKindWords, normalizePropertyKind } from '../../lib/jobs/propertyKind'
import { filterLienTimelineBook, type LienBookShow, type LienTimelineBook, type LienTimelineBookRow } from '../../lib/jobs/lienTimelineBook'
import LienTimelineStrip from './LienTimelineStrip'

/**
 * The Lien desk's Timeline tab (v2.3768): every job in the book, one row
 * each — who and how much, the strip in miniature, the next step — sorted
 * by the next date. A GC filter, a *Something due / All* lens, and *Print
 * the grid*. The tab has no verbs of its own: a row opens the job on the
 * pane its next step belongs to.
 */

export type LienDeskTimelineTabProps = {
  book: LienTimelineBook | null
  loading: boolean
  error: string
  gcId: string | null
  onGcId: (id: string | null) => void
  show: LienBookShow
  onShow: (s: LienBookShow) => void
  onOpenRow: (row: LienTimelineBookRow) => void
  onPrint: (rows: LienTimelineBookRow[], title: string) => void
}

const STACK_BELOW_PX = 700

function nextColor(tone: LienTimelineBookRow['timeline']['next']['tone']): string {
  return tone === 'red' ? 'var(--text-red-600)' : tone === 'amber' ? 'var(--text-amber-800)' : tone === 'green' ? 'var(--text-green-800)' : 'var(--text-strong)'
}

const selectStyle: CSSProperties = { padding: '2px 6px', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-700)', font: 'inherit', fontSize: '0.78rem' }

export default function LienDeskTimelineTab({ book, loading, error, gcId, onGcId, show, onShow, onOpenRow, onPrint }: LienDeskTimelineTabProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const [stacked, setStacked] = useState(false)
  useEffect(() => {
    const el = hostRef.current
    if (!el) return
    const read = () => setStacked(el.getBoundingClientRect().width < STACK_BELOW_PX)
    read()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(read)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const rows = book ? filterLienTimelineBook(book, { gcId, show }) : []
  const gc = gcId && book ? book.gcs.find((g) => g.id === gcId) ?? null : null
  const open = rows.reduce((s, r) => s + r.job.openBalance, 0)
  const title = gc ? gc.name : 'all GCs'

  return (
    <div ref={hostRef} data-lien-desk-timeline-tab style={{ overflow: 'auto', minWidth: 0, display: 'grid', alignContent: 'start' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem 0.8rem', alignItems: 'center', padding: '0.55rem 0.9rem', borderBottom: '1px solid var(--border)', fontSize: '0.78rem', position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>
        <label style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-muted)' }}>GC</span>
          <select value={gcId ?? ''} onChange={(e) => onGcId(e.target.value || null)} style={selectStyle} aria-label="GC">
            <option value="">All GCs{book ? ` · ${book.rows.length}` : ''}</option>
            {(book?.gcs ?? []).map((g) => (
              <option key={g.id} value={g.id}>
                {g.name || 'GC'} · {g.count}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-muted)' }}>Show</span>
          <select value={show} onChange={(e) => onShow(e.target.value === 'all' ? 'all' : 'due')} style={selectStyle} aria-label="Show">
            <option value="due">Something due{book ? ` · ${book.counts.due}` : ''}</option>
            <option value="all">All{book ? ` · ${book.counts.all}` : ''}</option>
          </select>
        </label>
        <span style={{ color: 'var(--text-muted)' }}>
          {loading && !book ? 'Reading every unpaid job…' : book ? `${rows.length} ${rows.length === 1 ? 'job' : 'jobs'} · ${formatUsdNoCents(open)} open${show === 'due' && book.counts.later ? ` · ${book.counts.later} more with nothing due yet` : ''}${book.counts.dead ? ` · ${book.counts.dead} gone` : ''}` : error ? `Could not read the book — ${error}` : ''}
        </span>
        <span style={{ flex: 1 }} />
        <button type="button" onClick={() => onPrint(rows, title)} disabled={!rows.length} title="Counsel's grid: one row per job, letter landscape — blanks where the app has no fact yet" style={{ padding: '2px 10px', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: rows.length ? 'var(--text-700)' : 'var(--text-muted)', font: 'inherit', fontSize: '0.78rem', fontWeight: 600, cursor: rows.length ? 'pointer' : 'default' }}>
          ⎙ Print the grid
        </button>
      </div>
      {book && rows.length === 0 ? (
        <p style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{show === 'due' ? 'Nothing due inside 30 days on these jobs — switch Show to All for the whole book.' : 'No job with money open and a lien month.'}</p>
      ) : null}
      {rows.map((r) => {
        const t = r.timeline
        const kind = normalizePropertyKind(r.job.propertyKind)
        return (
          <button
            key={r.jobId}
            type="button"
            data-lien-book-row={r.jobId}
            onClick={() => onOpenRow(r)}
            title="Open this job on the pane its next step belongs to"
            style={{ display: 'grid', gridTemplateColumns: stacked ? 'minmax(0, 1fr)' : 'minmax(200px, 250px) minmax(0, 1fr) minmax(180px, 230px)', gap: stacked ? '0.35rem 0' : '0 1rem', alignItems: 'center', width: '100%', textAlign: 'left', padding: '0.55rem 0.9rem', border: 'none', borderTop: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', font: 'inherit', color: 'inherit', fontSize: '0.8125rem', opacity: r.lens === 'dead' ? 0.7 : 1 }}
          >
            <span style={{ minWidth: 0, display: 'grid', gap: '0.05rem' }}>
              <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.job.label}</strong>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.job.isSub ? r.job.gcName || 'GC' : 'with the owner'} · {propertyKindWords(kind)}
              </span>
              <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatUsdNoCents(r.job.openBalance)}</span>
            </span>
            <LienTimelineStrip timeline={t} layout="mini" withNext={false} />
            <span style={{ minWidth: 0, fontSize: '0.78rem', display: 'grid', gap: '0.05rem' }}>
              <strong style={{ color: nextColor(t.next.tone) }}>{t.next.words}</strong>
              {t.next.aside ? <span style={{ color: 'var(--text-muted)' }}>{t.next.aside}</span> : null}
              {t.kindUnknown ? <span style={{ color: 'var(--text-amber-800)' }}>commercial dates · a month earlier if residential</span> : null}
            </span>
          </button>
        )
      })}
    </div>
  )
}
