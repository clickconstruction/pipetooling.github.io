import { useEffect, type CSSProperties } from 'react'
import { describeRoundRow, type RoundRow } from '../../lib/quickfill/round'
import { rollerDot, type RollerDot } from '../../lib/quickfill/views'
import { QUICKFILL_RHYTHM_STRIP_KEY, rhythmStripAxis, stationRhythmStrip } from '../../lib/quickfill/stationRhythmStrip'
import { ShapeSwitch, SideBySide, useShapeView } from '../prototypes/SideBySide'
import { QuickfillRhythmStripAxis, QuickfillStationRhythmStrip, RhythmStripChip } from './QuickfillStationRhythmStrip'

const RAIL: Record<RollerDot, string> = {
  red: '#dc2626',
  amber: '#d97706',
  green: '#16a34a',
  grey: 'var(--border-strong)',
  hollow: 'var(--border)',
}

type BoardProps = {
  rows: ReadonlyArray<RoundRow>
  currentId: string | null
  questionOf: (sectionId: string) => string | null
  now: Date
  onPick: (sectionId: string) => void
}

/** The Board as it is: every group as a card, the count large, the question, the grey rhythm line. */
function BoardCards({ rows, currentId, questionOf, now, onPick }: BoardProps) {
  return (
    <div data-board-cards style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '0.6rem' }}>
      {rows.map((r) => {
        const current = r.sectionId === currentId
        const question = questionOf(r.sectionId)
        return (
          <button
            key={r.sectionId}
            type="button"
            onClick={() => onPick(r.sectionId)}
            aria-current={current ? 'step' : undefined}
            style={{
              textAlign: 'left',
              font: 'inherit',
              color: 'var(--text)',
              background: current ? 'var(--bg-blue-tint)' : 'var(--surface)',
              border: `1px solid ${current ? 'var(--border-blue)' : 'var(--border)'}`,
              borderLeft: `4px solid ${RAIL[rollerDot(r)]}`,
              borderRadius: 8,
              padding: '0.6rem 0.75rem',
              minHeight: 108,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              cursor: 'pointer',
              minWidth: 0,
            }}
          >
            <span style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <b style={{ flex: 1, minWidth: 0, fontSize: '0.9375rem', color: 'var(--text-strong)', lineHeight: 1.25 }}>{r.label}</b>
              {r.personal ? null : (
                <span style={{ textAlign: 'right', flexShrink: 0 }}>
                  <span style={{ display: 'block', fontSize: '1.375rem', fontWeight: 800, lineHeight: 1, color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums' }}>{r.countSource === 'none' ? '—' : r.count}</span>
                  <span style={{ display: 'block', fontSize: '0.625rem', color: 'var(--text-muted)' }}>{r.countSource === 'open' ? 'open' : r.countSource === 'last_look' ? 'at last look' : ''}</span>
                </span>
              )}
            </span>
            <span style={{ flex: 1, fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
              {r.personal ? 'opens the page ›' : question ?? ''}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{describeRoundRow(r, now)}</span>
          </button>
        )
      })}
    </div>
  )
}

const ROW_COLUMNS = 'minmax(150px, 230px) minmax(0, 1fr) 56px'

/**
 * The Board with the strips (punch list #217, office-8): every group as a row — the name with
 * its state chip, the two-week strip of its looks and its due day, the count — and one axis
 * under them, since every row runs the same days.
 */
function BoardStrips({ rows, currentId, now, onPick, marksOf, hourNow }: BoardProps & { marksOf: (sectionId: string) => ReadonlyArray<string>; hourNow: number | null }) {
  const axis = rhythmStripAxis(now)
  const count: CSSProperties = { textAlign: 'right', fontVariantNumeric: 'tabular-nums' }
  return (
    <div data-board-strips style={{ display: 'grid', gap: 4 }}>
      {rows.map((r) => {
        const current = r.sectionId === currentId
        const strip = stationRhythmStrip(r, marksOf(r.sectionId), now, hourNow)
        return (
          <button
            key={r.sectionId}
            type="button"
            onClick={() => onPick(r.sectionId)}
            aria-current={current ? 'step' : undefined}
            aria-label={`${r.label} — ${strip.words}`}
            style={{
              display: 'grid',
              gridTemplateColumns: ROW_COLUMNS,
              alignItems: 'center',
              gap: '0.75rem',
              textAlign: 'left',
              font: 'inherit',
              color: 'var(--text)',
              background: current ? 'var(--bg-blue-tint)' : 'var(--surface)',
              border: `1px solid ${current ? 'var(--border-blue)' : 'var(--border)'}`,
              borderLeft: `4px solid ${RAIL[rollerDot(r)]}`,
              borderRadius: 8,
              padding: '0.45rem 0.75rem 0.45rem 0.6rem',
              cursor: 'pointer',
              minWidth: 0,
            }}
          >
            <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-start' }}>
              <b style={{ maxWidth: '100%', fontSize: '0.9375rem', color: 'var(--text-strong)', lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.label}</b>
              <RhythmStripChip chip={strip.chip} />
            </span>
            <QuickfillStationRhythmStrip strip={strip} height={18} />
            {r.personal ? (
              <span aria-hidden="true" style={{ ...count, color: 'var(--text-faint)', fontSize: '1.1rem' }}>›</span>
            ) : (
              <span style={count}>
                <span style={{ display: 'block', fontSize: '1.125rem', fontWeight: 800, lineHeight: 1, color: 'var(--text-strong)' }}>{r.countSource === 'none' ? '—' : r.count}</span>
                <span style={{ display: 'block', fontSize: '0.625rem', color: 'var(--text-muted)' }}>{r.countSource === 'open' ? 'open' : r.countSource === 'last_look' ? 'at last look' : ''}</span>
              </span>
            )}
          </button>
        )
      })}
      <div style={{ display: 'grid', gridTemplateColumns: ROW_COLUMNS, gap: '0.75rem', padding: '0 0.75rem 0 calc(0.6rem + 4px)' }}>
        <span />
        <QuickfillRhythmStripAxis axis={axis} />
        <span />
      </div>
    </div>
  )
}

const NO_MARKS: ReadonlyArray<string> = []

/**
 * The Board (punch list #147, v2.5787): every group as a card on one screen — a colour rail
 * in the group's state, the name, the count large, the group's question, when it was last
 * looked at. The Roller's index: a tap opens that group. Drawn in a dialog over the Roller;
 * Escape or the backdrop closes it. Since punch list #217 (office-8) a per-person switch,
 * **Show the strips**, draws every group as a row with its two-week rhythm strip instead; with
 * `?sbs=1` on the page a dev sees both, one above the other.
 */
export function QuickfillBoard({
  rows,
  currentId,
  questionOf,
  now,
  onPick,
  onClose,
  marksOf,
  hourNow = null,
}: BoardProps & {
  onClose: () => void
  /** Each station's marks for the strip (`rhythmMarksBySection` over the round's events); none draws the strips bare. */
  marksOf?: (sectionId: string) => ReadonlyArray<string>
  /** The company-time hour: an afternoon station reads *after 3 p.m.* before its hour. */
  hourNow?: number | null
}) {
  const view = useShapeView(QUICKFILL_RHYTHM_STRIP_KEY)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const cards = <BoardCards rows={rows} currentId={currentId} questionOf={questionOf} now={now} onPick={onPick} />
  const strips = <BoardStrips rows={rows} currentId={currentId} questionOf={questionOf} now={now} onPick={onPick} marksOf={marksOf ?? (() => NO_MARKS)} hourNow={hourNow} />

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="quickfill-board-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 780,
        background: 'rgba(15, 23, 42, 0.45)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: 'calc(3rem + env(safe-area-inset-top, 0px)) 1rem calc(1rem + env(safe-area-inset-bottom, 0px))',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 10,
          maxWidth: 960,
          width: '100%',
          maxHeight: 'min(86vh, 100%)',
          overflow: 'auto',
          padding: '1rem 1.25rem 1.25rem',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <h2 id="quickfill-board-title" style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700 }}>
            Groups · {rows.length}
          </h2>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShapeSwitch view={view} words={{ on: "Show today's look", off: 'Show the strips' }} />
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '0.3rem 0.7rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}
            >
              Close
            </button>
          </span>
        </div>
        {view.sideBySide ? <SideBySide testId="quickfill-board-sbs" label="With the strip" today={cards} shape={strips} /> : view.on ? strips : cards}
      </div>
    </div>
  )
}
