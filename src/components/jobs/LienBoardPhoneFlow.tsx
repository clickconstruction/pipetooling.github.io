import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { LienBoardArrow, LienBoardBin, LienBoardBinKey, LienBoardKind } from '../../lib/jobs/lienBoard'
import { LIEN_FLOW_COLUMN_NAME, LIEN_FLOW_VIEWS, lienFlowCrossPath, lienFlowStages, type LienFlowDayLine, type LienFlowRail, type LienFlowStage, type LienFlowTone, type LienFlowView } from '../../lib/jobs/lienBoardFlow'
import { lienBoardDayLineDoorWords } from '../../lib/jobs/lienBoardDayLine'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { thumbInLine } from '../../lib/phonePress'
import type { LienBoardBinPress } from './LienBoard'

/**
 * The flow of a lien paper on a phone (punch list #428, the owner's pick of 2026-11-23: *One screen, pinned line*).
 * Four pieces the Board draws on a phone in the place of its folded bins (`LienBoard.tsx`); the rule and the words
 * are `lienBoardFlow.ts`'s.
 *
 * - The switch, **By day** and **The flow**: what To do shows under its tabs.
 * - The day's one line over the flow, where the four tiles stand down.
 * - The flow: the two columns side by side, each stage one press with its name and its count, and the one arrow
 *   across from *Sent* to *Waiting on its notice*.
 * - The pinned line, while a stage's papers are the screen: the way back, where the stage stands, its column's
 *   cells, and the bin's own press, so no act the bins offered is lost.
 *
 * Nothing here reads or writes. A computer draws none of it.
 */

/** The desk's own blue, a saturated action colour kept literal. */
const LIT = '#2563eb'
/** A press on a phone stands a fingertip tall. */
const PRESS_PX = 44

const TONE_COLOR: Record<Exclude<LienFlowTone, null>, string> = { red: 'var(--text-red-700)', amber: 'var(--text-amber-800)', violet: 'var(--text-violet-700)' }

const KICKER: CSSProperties = { margin: 0, fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }

// ---------- The switch ----------

export function LienBoardFlowSwitch({ view, onView }: { view: LienFlowView; onView: (view: LienFlowView) => void }) {
  return (
    <div role="group" aria-label="What To do shows" data-lien-board-switch={view} style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', border: '1px solid var(--border-strong)', borderRadius: 9, overflow: 'hidden' }}>
      {LIEN_FLOW_VIEWS.map((v) => {
        const on = v.view === view
        return (
          <button
            key={v.view}
            type="button"
            aria-pressed={on}
            data-lien-board-switch-press={v.view}
            onClick={() => onView(v.view)}
            style={{ minHeight: PRESS_PX, padding: '0 8px', border: 'none', borderRadius: 0, fontFamily: 'inherit', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', ...(on ? { background: 'var(--bg-blue-tint)', color: 'var(--text-blue-700)' } : { background: 'var(--surface)', color: 'var(--text-700)' }) }}
          >
            {v.label}
          </button>
        )
      })}
    </div>
  )
}

// ---------- The day's line ----------

export function LienBoardFlowDayLine({ line, picked, onLine }: { line: LienFlowDayLine; /** The list is narrowed to the papers the red line counts: its press is then the way back. */ picked: boolean; onLine?: (() => void) | null }) {
  return (
    <div data-lien-board-flow-day style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: '0 6px', fontSize: '0.8125rem', lineHeight: 1.35, color: 'var(--text-700)' }}>
      <span>
        <b data-lien-board-flow-day-figure data-tone={line.red ? 'red' : undefined} style={{ fontSize: '0.95rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: line.red ? 'var(--text-red-700)' : 'var(--text-strong)' }}>
          {line.figure}
        </b>{' '}
        {line.words}
      </span>
      {line.line ? (
        onLine ? (
          <button type="button" className="lienJobDoor" data-lien-board-flow-day-press aria-pressed={picked} onClick={onLine} title={picked ? 'Show every row again' : 'Show only these rows'} style={{ border: 'none', background: 'none', padding: 0, margin: 0, fontFamily: 'inherit', fontSize: '0.8125rem', lineHeight: 1.35, textAlign: 'left', cursor: 'pointer', borderRadius: 3, ...thumbInLine(32) }}>
            <span data-lien-board-flow-day-line style={{ color: 'var(--text-red-700)' }}>{line.line}</span>{' '}
            <span style={{ color: 'var(--text-link)', fontWeight: 600, whiteSpace: 'nowrap' }}>{lienBoardDayLineDoorWords(picked)} ›</span>
          </button>
        ) : (
          <span data-lien-board-flow-day-line style={{ color: line.red ? 'var(--text-red-700)' : 'var(--text-muted)' }}>{line.line}</span>
        )
      ) : null}
    </div>
  )
}

// ---------- The flow ----------

function StagePress({ stage, lit, onStage }: { stage: LienFlowStage; lit: boolean; onStage?: (key: LienBoardBinKey) => void }) {
  const quiet = stage.empty
  const style: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    minWidth: 0,
    minHeight: PRESS_PX,
    padding: '5px 9px',
    borderWidth: 1,
    borderStyle: quiet || stage.closed ? 'dashed' : 'solid',
    borderColor: lit ? LIT : 'var(--border)',
    borderRadius: 8,
    background: 'var(--surface)',
    color: quiet ? 'var(--text-muted)' : 'var(--text-strong)',
    fontFamily: 'inherit',
    fontSize: '0.77rem',
    textAlign: 'left',
    boxSizing: 'border-box',
    ...(lit ? { boxShadow: `inset 0 0 0 1px ${LIT}` } : null),
    ...(onStage ? { cursor: 'pointer' } : null),
  }
  const inner = (
    <>
      <span data-lien-board-stage-name style={{ flex: 1, minWidth: 0, fontWeight: 600, lineHeight: 1.2, overflowWrap: 'anywhere' }}>{stage.name}</span>
      <span data-lien-board-stage-count style={{ flex: 'none', fontSize: '1rem', fontWeight: quiet ? 600 : 800, fontVariantNumeric: 'tabular-nums', color: stage.tone ? TONE_COLOR[stage.tone] : 'inherit' }}>{stage.count}</span>
    </>
  )
  const marks = { 'data-lien-board-stage': stage.key, 'data-tone': stage.tone ?? undefined, 'data-empty': quiet ? 'yes' : undefined, 'data-closed': stage.closed ? 'yes' : undefined, 'data-lit': lit ? 'yes' : undefined }
  if (!onStage) {
    return (
      <div style={style} {...marks}>
        {inner}
      </div>
    )
  }
  return (
    <button type="button" aria-label={`${stage.name}, ${stage.count}`} title={`Show the ${stage.count === 1 ? 'paper' : 'papers'} in ${stage.name}`} onClick={() => onStage(stage.key)} style={style} {...marks}>
      {inner}
    </button>
  )
}

/** A small mark between two stages of a column: a paper moves down. */
const DOWN: CSSProperties = { height: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, lineHeight: 1, color: 'var(--border-strong)' }

function FlowColumn({ kind, bins, lit, onStage, under }: { kind: LienBoardKind; bins: ReadonlyArray<LienBoardBin>; lit: LienBoardBinKey | null; onStage?: (key: LienBoardBinKey) => void; under?: ReactNode }) {
  const stages = lienFlowStages(bins)
  const flow = stages.filter((s) => !s.closed)
  const closed = stages.filter((s) => s.closed)
  return (
    <div data-lien-board-flow-column={kind} style={{ display: 'grid', alignContent: 'start', minWidth: 0 }}>
      <h3 style={{ ...KICKER, marginBottom: 6 }}>{LIEN_FLOW_COLUMN_NAME[kind]}</h3>
      {flow.map((s, i) => (
        <div key={s.key}>
          {i > 0 ? <div aria-hidden="true" style={DOWN}>▼</div> : null}
          <StagePress stage={s} lit={s.key === lit} onStage={onStage} />
        </div>
      ))}
      {/* The closed end, apart from the flow: no mark runs into it. */}
      {closed.map((s) => (
        <div key={s.key} style={{ marginTop: 10 }}>
          <StagePress stage={s} lit={s.key === lit} onStage={onStage} />
        </div>
      ))}
      {under ? <div style={{ marginTop: 10 }}>{under}</div> : null}
    </div>
  )
}

export function LienBoardFlowGrid({
  notices,
  affidavits,
  arrows,
  lit,
  onStage,
  underNotices,
  underAffidavits,
}: {
  notices: ReadonlyArray<LienBoardBin>
  affidavits: ReadonlyArray<LienBoardBin>
  /** The Board's arrows: the one across is drawn, between the two stages it names. */
  arrows: ReadonlyArray<LienBoardArrow>
  /** The stage a person last had open, lit so the flow opens where it was left. */
  lit: LienBoardBinKey | null
  /** A stage pressed. Absent, the stages only read. */
  onStage?: (key: LienBoardBinKey) => void
  underNotices?: ReactNode
  underAffidavits?: ReactNode
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [cross, setCross] = useState<string | null>(null)
  const across = arrows.find((a) => a.kind === 'cross') ?? null
  // The arrow follows its two stages: measured after every paint of the flow, and again when it changes size.
  useLayoutEffect(() => {
    const grid = ref.current
    if (!grid || !across) {
      setCross(null)
      return
    }
    const measure = () => {
      const origin = grid.getBoundingClientRect()
      const box = (key: string) => {
        const el = grid.querySelector<HTMLElement>(`[data-lien-board-stage="${key}"]`)
        if (!el) return null
        const r = el.getBoundingClientRect()
        return { left: r.left - origin.left, top: r.top - origin.top, width: r.width, height: r.height }
      }
      setCross(lienFlowCrossPath(box(across.from), box(across.to)))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => measure())
    ro.observe(grid)
    return () => ro.disconnect()
  }, [across, notices, affidavits])
  return (
    <div ref={ref} data-lien-board-phone-flow style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', columnGap: 18, alignItems: 'start' }}>
      <svg aria-hidden="true" data-lien-board-flow-arrows style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}>
        <defs>
          <marker id="lienFlowArrowHead" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0.5 L 8 4 L 0 7.5" fill="none" stroke="var(--border-strong)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </marker>
        </defs>
        {cross ? <path data-lien-board-flow-arrow="cross" d={cross} fill="none" stroke="var(--border-strong)" strokeWidth="1.3" strokeDasharray="4 3" markerEnd="url(#lienFlowArrowHead)" /> : null}
      </svg>
      <FlowColumn kind="notice" bins={notices} lit={lit} onStage={onStage} under={underNotices} />
      <FlowColumn kind="affidavit" bins={affidavits} lit={lit} onStage={onStage} under={underAffidavits} />
    </div>
  )
}

// ---------- The pinned line ----------

const LINE_DOOR: CSSProperties = { border: 'none', background: 'none', padding: 0, margin: 0, fontFamily: 'inherit', fontSize: 'inherit', fontWeight: 600, color: 'var(--text-link)', cursor: 'pointer', borderRadius: 3 }

export function LienBoardFlowRail({
  rail,
  press,
  onBack,
  onCell,
}: {
  rail: LienFlowRail
  /** The bin's own press, with its lines: the act every paper in the stage shares. Null when the bin offers none now. */
  press: LienBoardBinPress | null
  /** **‹ The flow**: the way back. */
  onBack: () => void
  /** A cell pressed: the pick moves to that stage. */
  onCell: (key: LienBoardBinKey) => void
}) {
  const lit = rail.cells.find((c) => c.lit)
  return (
    <div data-lien-board-line={lit?.key ?? ''} style={{ display: 'grid', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <button type="button" data-lien-board-line-back onClick={onBack} style={{ flex: 'none', minHeight: PRESS_PX, padding: '0 12px', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text-link)', fontFamily: 'inherit', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}>
          ‹ The flow
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div data-lien-board-line-where style={KICKER}>{rail.where}</div>
          <div data-lien-board-line-name style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-strong)', lineHeight: 1.25, overflowWrap: 'anywhere' }}>
            {rail.name} · <span style={{ fontVariantNumeric: 'tabular-nums' }}>{rail.count}</span>
          </div>
        </div>
      </div>
      <div role="group" aria-label={`The stages of ${LIEN_FLOW_COLUMN_NAME[rail.kind]}`} data-lien-board-line-cells style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, rail.cells.length)}, minmax(0, 1fr))`, gap: 4 }}>
        {rail.cells.map((c) => (
          <button
            key={c.key}
            type="button"
            data-lien-board-line-cell={c.key}
            data-lit={c.lit ? 'yes' : undefined}
            aria-current={c.lit ? 'true' : undefined}
            aria-label={`${c.name}, ${c.count}`}
            title={c.name}
            onClick={() => onCell(c.key)}
            style={{
              minWidth: 0,
              minHeight: PRESS_PX,
              padding: 0,
              borderRadius: 6,
              fontFamily: 'inherit',
              fontSize: '0.8125rem',
              fontVariantNumeric: 'tabular-nums',
              cursor: 'pointer',
              ...(c.lit ? { border: `1px solid ${LIT}`, background: LIT, color: '#fff', fontWeight: 700 } : c.empty ? { border: '1px dashed var(--border)', background: 'var(--surface)', color: 'var(--text-muted)', fontWeight: 500 } : { border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-700)', fontWeight: 700 }),
            }}
          >
            {c.count}
          </button>
        ))}
      </div>
      {press ? (
        <div data-lien-board-line-act style={{ display: 'grid', gap: 2 }}>
          <button
            type="button"
            data-lien-board-bin-press={lit?.key}
            {...press.marks}
            disabled={Boolean(press.dead)}
            onClick={press.onPress}
            title={press.title}
            style={{
              width: '100%',
              minHeight: PRESS_PX,
              padding: '4px 12px',
              borderRadius: 8,
              fontFamily: 'inherit',
              fontSize: '0.8125rem',
              fontWeight: 600,
              lineHeight: 1.2,
              cursor: press.dead ? 'default' : 'pointer',
              ...(press.dead ? { border: '1px solid transparent', background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT } : press.filled ? { border: `1px solid ${LIT}`, background: LIT, color: '#fff' } : { border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-link)' }),
            }}
          >
            {press.label}
          </button>
          {(press.lines ?? []).map((line) => (
            <div key={line.key} data-lien-board-bin-line={line.key} {...line.marks} style={{ fontSize: '0.76rem', lineHeight: 1.35, color: line.tone === 'amber' ? 'var(--text-amber-800)' : 'var(--text-muted)', minWidth: 0 }}>
              {line.words}
              {(line.doors ?? []).map((door) => (
                <span key={door.key}>
                  {' · '}
                  <button type="button" className="lienJobDoor" data-lien-board-bin-door={door.key} {...door.marks} disabled={Boolean(door.dead)} onClick={door.onPress} style={{ ...LINE_DOOR, ...(door.dead ? { color: 'var(--text-muted)', cursor: 'default' } : null), minHeight: 32 }}>
                    {door.label}
                  </button>
                </span>
              ))}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
