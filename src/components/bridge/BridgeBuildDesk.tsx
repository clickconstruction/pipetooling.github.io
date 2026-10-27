/**
 * The Build desk (punch list #192, v2.5929): the modal behind the Bridge's
 * Build card. Hours in, work out: the headline, the one verdict, the card's
 * paces, the three tiles, then one row per open job, worst divergence first,
 * each opening to its why-line, its crew chip and its doors. Set the % on a
 * row opens the crews' own percent window (`FieldPctUpdateModal`), the one
 * write here, and the page patches the Build reads so the desk recomputes.
 * The footnote at the foot names every read. Pure on its props: the kernel
 * `src/lib/bridge/build/buildDesk.ts` does the arithmetic and the words.
 */
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import FieldPctUpdateModal from '../dashboard/FieldPctUpdateModal'
import { STAGE_META } from '../../lib/bridge/stageFlow'
import { BUILD_DESK_MOVED_SHOWN, type BuildDesk, type BuildDeskRow, type BuildDeskTone } from '../../lib/bridge/build/buildDesk'

const label: CSSProperties = { fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const det: CSSProperties = { fontSize: '0.78rem', color: 'var(--text-muted)' }
const card: CSSProperties = { background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.7rem 0.85rem' }
const door: CSSProperties = { display: 'inline-flex', alignItems: 'center', minHeight: 36, padding: '0 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '0.82rem', fontWeight: 600, textDecoration: 'none', cursor: 'pointer', font: 'inherit' }

const TONE_COLOR: Record<BuildDeskTone, string> = { red: 'var(--text-red-600)', amber: 'var(--text-amber-800)', green: 'var(--text-green-700)', grey: 'var(--text-muted)' }
const CHIP_BG: Record<BuildDeskTone, string> = { red: 'var(--bg-red-tint, var(--bg-subtle))', amber: 'var(--bg-amber-tint, var(--bg-subtle))', green: 'var(--bg-green-tint, var(--bg-subtle))', grey: 'var(--bg-subtle)' }

export type BridgeBuildDeskProps = {
  desk: BuildDesk
  /** The desk's own reads are still in flight: the rows area says so, the header draws. */
  readsPending: boolean
  readError: string | null
  /** Build is the lit link: the headline reads red. */
  isLink: boolean
  /** "Mon, Oct 26 · pay week Oct 25–31". */
  readStamp: string
  onClose: () => void
  /** The page's savePct: patches the Build reads in place so the desk recomputes. */
  onSavePct: (jobId: string, pct: number) => void
}

function Chip({ tone, words }: { tone: BuildDeskTone; words: string }) {
  return <span style={{ display: 'inline-block', fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap', background: CHIP_BG[tone], color: TONE_COLOR[tone] }}>{words}</span>
}

function Row({ row, open, onToggle, onSetPct }: { row: BuildDeskRow; open: boolean; onToggle: () => void; onSetPct: () => void }) {
  const edge = TONE_COLOR[row.chip.tone]
  return (
    <div style={{ ...card, padding: 0, borderLeft: `4px solid ${edge}` }} data-testid="bridge-build-row">
      <button type="button" aria-expanded={open} aria-controls={`bridge-build-row-${row.id}`} onClick={onToggle} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 48, padding: '8px 12px', background: 'none', border: 0, font: 'inherit', color: 'inherit', textAlign: 'left', cursor: 'pointer', borderRadius: 10, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, minWidth: 0, flex: '1 1 200px' }}>
          {row.label}
          <span style={{ ...det, display: 'block', fontWeight: 400 }}>{row.sub}</span>
        </span>
        <span style={{ display: 'flex', gap: 16, alignItems: 'baseline', fontSize: '0.85rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
          <span>
            <b style={{ color: 'var(--text)' }}>{row.hoursWords}</b>
          </span>
          <span>
            % <b style={{ color: 'var(--text)' }}>{row.pctWords}</b>
          </span>
          <span>
            moved <b style={{ color: 'var(--text)' }}>{row.movedWords}</b>
          </span>
          <Chip tone={row.chip.tone} words={row.chip.words} />
        </span>
        <span aria-hidden="true" style={{ marginLeft: 'auto', color: 'var(--text-muted)', transform: open ? 'rotate(90deg)' : undefined, transition: 'transform 0.12s' }}>
          ›
        </span>
      </button>
      {open && (
        <div id={`bridge-build-row-${row.id}`} style={{ padding: '2px 12px 12px', borderTop: '1px solid var(--border)', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: 8 }} data-testid="bridge-build-row-detail">
          <div>{row.why}</div>
          {row.crew && (
            <div>
              <Chip tone={row.crew.tone} words={row.crew.words} />
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {row.doors.map((d) => (
              <Link key={d.label} to={d.href} style={door}>
                {d.label} ›
              </Link>
            ))}
            {row.canSetPct && (
              <button type="button" onClick={onSetPct} style={{ ...door, borderColor: 'var(--text-amber-800)', color: 'var(--text-amber-800)' }} data-testid="bridge-build-set-pct">
                Set the % ›
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function BridgeBuildDesk(props: BridgeBuildDeskProps) {
  const { desk, readsPending, readError, isLink, readStamp, onClose, onSavePct } = props
  const [openId, setOpenId] = useState<string | null>(null)
  const [foldOpen, setFoldOpen] = useState(false)
  const [editing, setEditing] = useState<BuildDeskRow['modalJob'] | null>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !editing) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, editing])

  // The moved rows past the first three fold under one line after the last moved row shown; everything else is listed.
  const movedTotal = desk.rows.filter((r) => r.group === 'moved').length
  let movedSeen = 0
  const items: ReactNode[] = []
  for (const r of desk.rows) {
    const isMoved = r.group === 'moved'
    if (isMoved) movedSeen += 1
    if (!isMoved || foldOpen || movedSeen <= BUILD_DESK_MOVED_SHOWN) items.push(<Row key={r.id} row={r} open={openId === r.id} onToggle={() => setOpenId((v) => (v === r.id ? null : r.id))} onSetPct={() => setEditing(r.modalJob)} />)
    if (isMoved && desk.movedFold && movedSeen === movedTotal) {
      items.push(
        <button key="fold" type="button" aria-expanded={foldOpen} onClick={() => setFoldOpen((v) => !v)} style={{ textAlign: 'left', background: 'transparent', border: 0, padding: '4px 10px', cursor: 'pointer', font: 'inherit', fontSize: '0.82rem', color: 'var(--text-muted)' }} data-testid="bridge-build-moved-fold">
          {desk.movedFold.words} · {foldOpen ? 'hide' : 'show'}
        </button>,
      )
    }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', zIndex: 750, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 'calc(24px + var(--app-top-chrome, 0px)) 16px 24px', overflow: 'auto' }} data-testid="bridge-build-desk">
      <div role="dialog" aria-modal="true" aria-label="Build, broken down" onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', color: 'var(--text)', borderRadius: 14, border: '1px solid var(--border)', boxShadow: '0 24px 64px rgba(0,0,0,0.3)', width: 'min(1040px, 100%)', padding: '1.1rem 1.3rem 1rem', display: 'flex', flexDirection: 'column', gap: '1rem', fontVariantNumeric: 'tabular-nums' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={label}>
              Build · {STAGE_META.build.object} · last {desk.days} days <span style={{ fontWeight: 400, letterSpacing: 0, textTransform: 'none' }}>· read {readStamp}</span>
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: isLink ? 'var(--text-red-600)' : 'var(--text)', lineHeight: 1.15 }} data-testid="bridge-build-headline">
              {desk.headline}
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 700 }} data-testid="bridge-build-verdict">
              {desk.verdict}
            </div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{desk.subLine}</div>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} style={{ width: 40, height: 40, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-muted)', fontSize: '1.2rem', lineHeight: 1, cursor: 'pointer', flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
            ×
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
          {desk.tiles.map((t) => (
            <div key={t.head} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 3 }} data-testid="bridge-build-tile">
              <div style={label}>{t.head}</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: TONE_COLOR[t.tone] }}>{t.value}</div>
              <div style={{ fontSize: '0.82rem' }}>{t.words}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ fontSize: '1rem', fontWeight: 700 }}>Every open job, by what the hours did</div>
            <span style={det}>hours in against work out · worst divergence first · press a row for the why and the doors</span>
          </div>
          {desk.noPctLine && <div style={det}>{desk.noPctLine}</div>}
          {readError && <div style={{ ...det, color: 'var(--text-amber-800)' }}>The Schedule and the expected hours could not be read ({readError}). The rows read without them.</div>}
          {readsPending && !readError ? (
            <div style={det} data-testid="bridge-build-reading">
              Reading the Build desk…
            </div>
          ) : desk.rows.length === 0 ? (
            <div style={det}>No open job to read.</div>
          ) : (
            items
          )}
        </div>

        <div style={{ ...det, borderTop: '1px solid var(--border)', paddingTop: 10 }} data-testid="bridge-build-footnote">
          <b>How this reads.</b> {desk.footnote}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, borderTop: '1px solid var(--border)', paddingTop: 10, flexWrap: 'wrap' }}>
          <span style={det}>The week’s call is recorded on the link desk above, not here. This desk is the diagnosis. The Schedule and the percent window are the fixes.</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link to="/schedule-dispatch" style={door}>
              Open the Schedule ›
            </Link>
            <Link to="/jobs?tab=stages" style={door}>
              Open Stages ›
            </Link>
            <button type="button" onClick={onClose} style={{ height: 36, padding: '0 14px', borderRadius: 8, border: 0, background: 'var(--text-base)', color: 'var(--surface)', fontWeight: 700, cursor: 'pointer' }}>
              Close
            </button>
          </div>
        </div>
        {editing && (
          <FieldPctUpdateModal
            job={editing}
            onClose={() => setEditing(null)}
            onSaved={(pct) => onSavePct(editing.id, pct)}
          />
        )}
      </div>
    </div>
  )
}
