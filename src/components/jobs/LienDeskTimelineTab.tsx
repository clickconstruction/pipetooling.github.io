import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { LienJobNumber } from './LienJobNumber'
import { splitLienJobLabel } from '../../lib/jobs/lienJobLabel'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import { propertyKindWords, normalizePropertyKind } from '../../lib/jobs/propertyKind'
import { filterLienTimelineBook, type LienBookShow, type LienTimelineBook, type LienTimelineBookRow } from '../../lib/jobs/lienTimelineBook'
import LienTimelineStrip from './LienTimelineStrip'
import { lienMoveWords } from '../../lib/jobs/lienTimeline'
import { EmptyState } from '../EmptyState'
import { lienBookEmptyWords } from '../../lib/jobs/lienDeskEmptyWords'
import { lienPropertyRowDoor } from '../../lib/jobs/lienPropertyCard'
import type { LienProperty } from '../../lib/jobs/lienPropertyPapers'
import { groupLienBookByProperty, type LienBookGroup } from '../../lib/jobs/lienPropertyGroups'

/**
 * The Lien desk's Timeline tab (v2.3768): every job in the book, one row
 * each — who and how much, the strip in miniature, the next step — sorted
 * by the next date. A GC filter, a *Something due / All* lens, and *Print
 * the grid*. The tab has no verbs of its own: a row opens the job on the
 * pane its next step belongs to. Under Next, *Waiting on* says whose move it
 * is and for what (v2.3890) — the line the job's own strip carries. Since v2.7488 a row on a property that holds
 * more than one job says so under its GC (*412 Ridgeline Dr · 7 jobs here ›*), a press that opens the property card;
 * a row with no property record says that, with the door to set one. Since v2.7493 the **Group** picker gathers the
 * rows under a head per property (`groupLienBookByProperty`); the head opens the card.
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
  /** A row's job number opens the job itself (v2.4535): the Job window, with its history and Edit. */
  onOpenJob?: (jobId: string) => void
  onPrint: (rows: LienTimelineBookRow[], title: string) => void
  /** The whole book gathered by property (v2.7488), not the rows a filter left: a row's count is every job at its property. */
  properties?: ReadonlyArray<LienProperty>
  /** Open the property card on a row's property, from that row's job. */
  onOpenProperty?: (addressId: string, fromJobId: string | null) => void
  /** Gather the rows under a head per property (v2.7493); absent or `none`, the list is as it was. */
  group?: LienBookGroup
  onGroup?: (g: LienBookGroup) => void
  /** The door to set a property record on a job that has none; absent for a reader who may not. */
  onSetProperty?: (jobId: string) => void
  /** On a phone the two pickers and the print press are a thumb tall (punch list #352, the leftovers). */
  phone?: boolean
  /** A phone's strip at the top of the list, where it scrolls away with it (Payoffs, punch list #428); nothing on a computer. */
  top?: ReactNode
}

const STACK_BELOW_PX = 700

function nextColor(tone: LienTimelineBookRow['timeline']['next']['tone']): string {
  return tone === 'red' ? 'var(--text-red-600)' : tone === 'amber' ? 'var(--text-amber-800)' : tone === 'green' ? 'var(--text-green-800)' : 'var(--text-strong)'
}

const selectStyle: CSSProperties = { padding: '2px 6px', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-700)', font: 'inherit', fontSize: '0.78rem' }
/** A phone's pickers and print press (punch list #352, the leftovers): a thumb tall, and 16 px words so an iPhone does not zoom the page on a picker's focus. */
const PHONE_PRESS_PX = 44
const phoneSelectStyle: CSSProperties = { ...selectStyle, minHeight: PHONE_PRESS_PX, padding: '0 10px', borderRadius: 8, fontSize: '1rem', minWidth: 0, maxWidth: '100%' }

export default function LienDeskTimelineTab({ book, loading, error, gcId, onGcId, show, onShow, onOpenRow, onOpenJob, onPrint, properties, onOpenProperty, onSetProperty, group = 'none', onGroup, phone = false, top = null }: LienDeskTimelineTabProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const picker = phone ? phoneSelectStyle : selectStyle
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

  const sections = group === 'property' && properties ? groupLienBookByProperty(rows, properties) : null

  const renderRow = (r: LienTimelineBookRow, underOwnHead = false) => {
    const t = r.timeline
    const kind = normalizePropertyKind(r.job.propertyKind)
    const door = properties ? lienPropertyRowDoor(properties, r) : null
    const doorStyle: CSSProperties = { border: 'none', background: 'none', padding: 0, font: 'inherit', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-blue-700)', cursor: 'pointer', textAlign: 'left', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ...(phone ? { minHeight: PHONE_PRESS_PX, fontSize: '0.875rem' } : null) }
    return (
      // The row opens the job's pane wherever it is clicked; its number is its own door to the job (v2.4535).
      <div
        key={r.jobId}
        role="row"
        data-lien-book-row={r.jobId}
        onClick={() => onOpenRow(r)}
        title="Open this job on the pane its next step belongs to"
        style={{ display: 'grid', gridTemplateColumns: stacked ? 'minmax(0, 1fr)' : 'minmax(200px, 250px) minmax(0, 1fr) minmax(180px, 230px)', gap: stacked ? '0.35rem 0' : '0 1rem', alignItems: 'center', width: '100%', textAlign: 'left', padding: '0.55rem 0.9rem', boxSizing: 'border-box', borderTop: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: '0.8125rem', opacity: r.lens === 'dead' ? 0.7 : 1 }}
      >
        <span style={{ minWidth: 0, display: 'grid', gap: '0.05rem' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            {onOpenJob ? <LienJobNumber number={splitLienJobLabel(r.job.label).number} onOpen={() => onOpenJob(r.jobId)} /> : null}
            {/* the name is the row's keyboard stop; its click rides up to the row */}
            <button type="button" style={{ minWidth: 0, border: 'none', background: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', color: 'inherit', font: 'inherit', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {onOpenJob ? splitLienJobLabel(r.job.label).name || r.job.label : r.job.label}
            </button>
          </span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {r.job.isSub ? r.job.gcName || 'GC' : 'with the owner'} · {propertyKindWords(kind)}
          </span>
          {door?.shared && door.addressId && onOpenProperty && !underOwnHead ? (
            <button
              type="button"
              data-lien-book-property={door.addressId}
              title="Every job at this property, with where each paper stands"
              style={doorStyle}
              onClick={(e) => {
                e.stopPropagation()
                onOpenProperty(door.addressId!, r.jobId)
              }}
            >
              {door.words} ›
            </button>
          ) : door && !door.addressId ? (
            <span data-lien-book-no-property style={{ display: 'flex', gap: 6, alignItems: 'center', minWidth: 0, fontSize: '0.72rem', color: 'var(--text-amber-800)' }}>
              {door.words}
              {onSetProperty ? (
                <button
                  type="button"
                  style={doorStyle}
                  onClick={(e) => {
                    e.stopPropagation()
                    onSetProperty(r.jobId)
                  }}
                >
                  Set the property ›
                </button>
              ) : null}
            </span>
          ) : null}
          <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatUsdNoCents(r.job.openBalance)}</span>
        </span>
        <LienTimelineStrip timeline={t} layout="mini" withNext={false} />
        <span style={{ minWidth: 0, fontSize: '0.78rem', display: 'grid', gap: '0.05rem' }}>
          <strong style={{ color: nextColor(t.next.tone) }}>{t.next.words}</strong>
          {t.next.aside ? <span style={{ color: 'var(--text-muted)' }}>{t.next.aside}</span> : null}
          {t.waitingOn ? (
            <span data-lien-book-waiting style={{ color: 'var(--text-muted)' }}>
              Waiting on <strong style={{ color: 'var(--text-strong)' }}>{lienMoveWords(t.waitingOn.who)}</strong> — {t.waitingOn.words}
            </span>
          ) : null}
          {t.kindUnknown ? <span style={{ color: 'var(--text-amber-800)' }}>kind not set · residential dates · a month later if commercial</span> : null}
        </span>
      </div>
    )
  }

  return (
    <div ref={hostRef} data-lien-desk-timeline-tab style={{ overflow: 'auto', minWidth: 0, display: 'grid', alignContent: 'start' }}>
      {top}
      {/* The control bar stays over the rows on a computer. On a phone its presses are a thumb tall, so the bar scrolls away with the list sooner than hold a taller strip of the screen (punch list #352: a thumb-tall row makes a pinned header taller). */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem 0.8rem', alignItems: 'center', padding: '0.55rem 0.9rem', borderBottom: '1px solid var(--border)', fontSize: '0.78rem', position: phone ? 'static' : 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>
        <label style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-muted)' }}>GC</span>
          <select value={gcId ?? ''} onChange={(e) => onGcId(e.target.value || null)} style={picker} aria-label="GC">
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
          <select value={show} onChange={(e) => onShow(e.target.value === 'all' ? 'all' : 'due')} style={picker} aria-label="Show">
            <option value="due">Something due{book ? ` · ${book.counts.due}` : ''}</option>
            <option value="all">All{book ? ` · ${book.counts.all}` : ''}</option>
          </select>
        </label>
        {onGroup && properties ? (
          <label style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)' }}>Group</span>
            <select value={group} onChange={(e) => onGroup(e.target.value === 'property' ? 'property' : 'none')} style={picker} aria-label="Group">
              <option value="none">None</option>
              <option value="property">By property</option>
            </select>
          </label>
        ) : null}
        <span style={{ color: 'var(--text-muted)' }}>
          {loading && !book ? 'Reading every unpaid job…' : book ? `${rows.length} ${rows.length === 1 ? 'job' : 'jobs'} · ${formatUsdNoCents(open)} open${show === 'due' && book.counts.later ? ` · ${book.counts.later} more with nothing due yet` : ''}${book.counts.dead ? ` · ${book.counts.dead} gone` : ''}` : error ? `Could not read the book — ${error}` : ''}
        </span>
        <span style={{ flex: 1 }} />
        <button type="button" onClick={() => onPrint(rows, title)} disabled={!rows.length} title="Counsel's grid: one row per job, letter landscape — blanks where the app has no fact yet" style={{ padding: '2px 10px', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: rows.length ? 'var(--text-700)' : 'var(--text-muted)', font: 'inherit', fontSize: '0.78rem', fontWeight: 600, cursor: rows.length ? 'pointer' : 'default', ...(phone ? { minHeight: PHONE_PRESS_PX, padding: '0 14px', borderRadius: 8, fontSize: '0.875rem' } : null) }}>
          ⎙ Print the grid
        </button>
      </div>
      {book && rows.length === 0 ? (
        // Empty words (punch list #184, sweep C): the sentence that said "switch Show to All" is that press now.
        <div data-lien-book-empty={show}>
          <EmptyState compact {...lienBookEmptyWords(show, () => onShow('all'))} />
        </div>
      ) : null}
      {sections
        ? sections.map((sec) => (
            <section key={sec.key} data-lien-book-section={sec.kind} aria-label={sec.title}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.15rem 0.6rem', alignItems: 'baseline', padding: '0.45rem 0.9rem', borderTop: '1px solid var(--border)', background: 'var(--bg-subtle)', fontSize: '0.8125rem' }}>
                {sec.addressId && onOpenProperty ? (
                  <button type="button" data-lien-book-section-open={sec.addressId} title="Every job at this property, with where each paper stands" onClick={() => onOpenProperty(sec.addressId!, null)} style={{ border: 'none', background: 'none', padding: 0, font: 'inherit', fontWeight: 700, color: 'var(--text-blue-700)', cursor: 'pointer', textAlign: 'left', ...(phone ? { minHeight: PHONE_PRESS_PX } : null) }}>
                    {sec.title} ›
                  </button>
                ) : (
                  <strong>{sec.title}</strong>
                )}
                <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{sec.words}</span>
              </div>
              {sec.rows.map((r) => renderRow(r, sec.kind === 'property'))}
            </section>
          ))
        : rows.map((r) => renderRow(r))}
    </div>
  )
}
