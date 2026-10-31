import type { CSSProperties } from 'react'
import {
  NO_FILTER,
  bandCountWords,
  bandLaneWords,
  boardBands,
  boardFilterOptions,
  boardSummary,
  dueWords,
  stepSubParts,
  tileJobWords,
  todayWords,
  type BoardBand,
  type BoardCompany,
  type BoardContext,
  type BoardFilter,
  type BoardLine,
  type BoardRow,
  type BoardSummary,
  type ChipGroup,
  type LineTone,
  type RowPress,
  type SummaryDot,
} from '../../../lib/flows/board'
import type { FlowPhase, FlowStep } from '../../../lib/flows/state'
import { shortDate } from '../../../lib/gc/words'
import { STAGE_COLORS } from '../GcBoardStages'
import type { Tone } from '../gcUi'

/**
 * Everyone by step (Messages cut 4, the prototype's v1.173 and v1.174; v2.5555 gave it the Project Board's shape): a
 * today line, then one band per phase in the flow's order, each wearing the Project Board's stage colour, with every
 * step of the phase its own row. Under each step, whose move it is, late, lapsed, over usual, waiting, and the usual.
 * The chips group by job in the per-job lane, each job on its own line, named once with the day they share. The press
 * at the right is the step's own. The job and the seat pickers (`BoardPickers`, drawn by `GcFlowBoard` in its views
 * row) narrow every row and band. The words and the rules are `flows/board.ts`'s; this only draws them.
 */

export interface BoardPresses {
  /** A chip or a dot: that company at that step. */
  onCompany: (line: BoardLine) => void
  /** The press at a row's right. */
  onRowPress: (step: FlowStep, press: RowPress, lines: readonly BoardLine[]) => void
  /** Needs a hand: Follow up. */
  onNeedsAHand: () => void
}

/** A phase's band wears the Project Board's own stage colour (the owner, 2026-10-15): the papers phase Buying out's blue, pricing Bidding's amber, Building its green. */
const PHASE_TONE: Record<FlowPhase, Tone> = { setup: 'blue', pricing: 'amber', building: 'green' }

const WORDS_COLOR: Record<LineTone, string> = {
  late: 'var(--text-red-700)',
  lapsed: 'var(--text-orange-700)',
  over: 'var(--text-orange-700)',
  wait: 'var(--text-blue-700)',
  '': 'var(--text-muted)',
}

const DOT: Record<SummaryDot['tone'], string> = { bad: 'var(--text-red-700)', warn: 'var(--text-orange-700)', '': 'var(--border-400)' }

const rowStyle: CSSProperties = { display: 'flex', gap: '0.75rem', alignItems: 'flex-start', flexWrap: 'wrap', padding: '0.6rem 0.9rem 0.6rem 1.1rem', borderTop: '1px solid var(--border)' }
const headStyle: CSSProperties = { flex: '0 0 220px', minWidth: 140, fontWeight: 600, fontSize: '0.9rem' }
const subStyle: CSSProperties = { display: 'block', fontWeight: 400, fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }
const chipsStyle: CSSProperties = { flex: '1 1 260px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem' }
const groupStyle: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: '0.35rem 0.6rem', alignItems: 'center' }
const labelStyle: CSSProperties = { fontSize: '0.72rem', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const pressCol: CSSProperties = { flex: '0 0 auto', marginLeft: 'auto', display: 'flex', justifyContent: 'flex-end' }
const empty: CSSProperties = { fontSize: '0.85rem', color: 'var(--text-muted)' }
const smallPill = (fg: string, bg: string): CSSProperties => ({ fontSize: '0.72rem', fontWeight: 600, padding: '0.05rem 0.5rem', borderRadius: 999, color: fg, background: bg })

function Chip({ line, words, onPress }: { line: BoardLine; words: string; onPress: (l: BoardLine) => void }) {
  const late = line.tone === 'late'
  return (
    <button
      type="button"
      onClick={() => onPress(line)}
      title={`${line.name}${words ? `, ${words}` : ''}${line.usual != null ? `. Usually ${line.usual} days.` : ''}`}
      style={{
        border: `1px solid ${late ? 'var(--border-red)' : 'var(--border-strong)'}`,
        background: late ? 'var(--bg-red-tint)' : 'var(--surface)',
        borderRadius: 999,
        padding: '0.2rem 0.7rem',
        fontSize: '0.85rem',
        color: 'inherit',
        cursor: 'pointer',
        font: 'inherit',
      }}
    >
      {line.name}
      {words && <span style={{ marginLeft: 6, color: WORDS_COLOR[line.tone], fontWeight: line.tone === 'over' || late ? 600 : 400 }}>{words}</span>}
    </button>
  )
}

function Groups({ groups, today, onCompany }: { groups: ChipGroup[]; today: string; onCompany: (l: BoardLine) => void }) {
  return (
    <>
      {groups.map((g) => (
        <div key={g.jobId ?? '-'} style={groupStyle}>
          {(g.label || g.sharedDue) && (
            <span style={labelStyle}>
              {g.label ?? ''}
              {g.sharedDue ? `${g.label ? ' · ' : ''}due ${dueWords(g.sharedDue, today)}` : ''}
            </span>
          )}
          {g.chips.map((c) => (
            <Chip key={`${c.line.contactId}:${c.line.jobId ?? '-'}`} line={c.line} words={c.words} onPress={onCompany} />
          ))}
        </div>
      ))}
    </>
  )
}

function Press({ step, press, lines, onPress }: { step: FlowStep; press: RowPress | null; lines: readonly BoardLine[]; onPress: BoardPresses['onRowPress'] }) {
  if (!press) return null
  const urgent = press.kind === 'nudge' && press.late
  return (
    <button
      type="button"
      onClick={() => onPress(step, press, lines)}
      title={press.kind === 'nudge' ? "The step's line to each, one send window at a time. Nothing sends until you press Send." : press.label}
      style={{
        border: `1px solid ${urgent ? '#2563eb' : 'var(--border-strong)'}`,
        background: urgent ? '#2563eb' : 'var(--surface)',
        color: urgent ? '#fff' : 'var(--text-700)',
        borderRadius: 8,
        padding: '0.3rem 0.75rem',
        fontSize: '0.85rem',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        font: 'inherit',
      }}
    >
      {press.label}
    </button>
  )
}

function Row({ row, today, presses }: { row: BoardRow; today: string; presses: BoardPresses }) {
  const lines = row.groups.flatMap((g) => g.chips.map((c) => c.line))
  return (
    <div style={rowStyle} data-board-step={row.step.id}>
      <div style={headStyle}>
        {row.step.name}
        <span style={subStyle}>{stepSubParts(row.step, row.head).join(' · ')}</span>
      </div>
      <div style={chipsStyle}>{lines.length ? <Groups groups={row.groups} today={today} onCompany={presses.onCompany} /> : <span style={empty}>{row.lands}</span>}</div>
      {row.press && (
        <div style={pressCol}>
          <Press step={row.step} press={row.press} lines={lines} onPress={presses.onRowPress} />
        </div>
      )}
    </div>
  )
}

function Dot({ d, onPress }: { d: SummaryDot; onPress: (d: SummaryDot) => void }) {
  return (
    <button
      type="button"
      aria-label={`${d.name}: ${d.line.step.name}`}
      title={`${d.name}, ${d.line.step.name}`}
      onClick={() => onPress(d)}
      style={{ width: 10, height: 10, borderRadius: '50%', border: 'none', padding: 0, cursor: 'pointer', background: DOT[d.tone] }}
    />
  )
}

/** The band's head: the Project Board's own band with the phase's colour, the count, its jobs, late and lapsed, a dot per company, and the lanes' words. */
function Band({ band, ctx, presses }: { band: BoardBand; ctx: BoardContext; presses: BoardPresses }) {
  const c = STAGE_COLORS[PHASE_TONE[band.phase]]
  const jobs = tileJobWords(ctx, band)
  return (
    <section aria-label={band.words} data-board-band={band.phase} style={{ marginTop: '0.9rem' }}>
      <div className="stagesSectionBand" style={{ ...({ '--stage-color': c.bar } as CSSProperties), display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
        <span className="stagesBandTitle">{band.words}</span>
        <span className="stagesBandCount" style={{ color: c.fg }}>
          {bandCountWords(ctx, band)}
        </span>
        {jobs && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{jobs}</span>}
        {band.late > 0 && <span style={smallPill('var(--text-red-700)', 'var(--bg-red-tint)')}>{band.late} late</span>}
        {band.lapsed > 0 && <span style={smallPill('var(--text-orange-700)', 'var(--surface)')}>{band.lapsed} lapsed</span>}
        {band.dots.length > 0 && (
          <span style={{ display: 'inline-flex', gap: 3, flexWrap: 'wrap' }}>
            {band.dots.map((d) => (
              <Dot key={d.contactId} d={d} onPress={(dot) => presses.onCompany(dot.line)} />
            ))}
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{bandLaneWords(ctx, band)}</span>
      </div>
      {band.rows.map((row) => (
        <Row key={row.step.id} row={row} today={ctx.today} presses={presses} />
      ))}
    </section>
  )
}

/** The line over the bands: who needs a hand today, the watches, the companies off the flow, and the door to Follow up. */
function TodayLine({ ctx, summary, onHand }: { ctx: BoardContext; summary: BoardSummary; onHand: () => void }) {
  const words = todayWords(ctx, summary)
  const loud = summary.hand.count > 0
  const quiet: CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', fontSize: '0.85rem', color: 'var(--text-muted)', padding: '0.15rem 0' }
  const banner: CSSProperties = { ...quiet, color: 'var(--text-700)', padding: '0.55rem 0.85rem', border: '1px solid var(--border-orange)', borderRadius: 10, background: 'var(--bg-orange-tint)' }
  return (
    <div data-board-today={loud ? 'loud' : 'quiet'} style={loud ? banner : quiet}>
      <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: loud ? 'var(--text-red-700)' : 'var(--text-green-600)' }} />
      {loud ? <strong style={{ color: 'var(--text-strong)' }}>{words.hand}</strong> : <span>{words.hand}</span>}
      {words.watch.map((w) => (
        <span key={w}>{w}</span>
      ))}
      <button type="button" onClick={onHand} style={{ border: 'none', background: 'none', color: 'var(--text-blue-500)', cursor: 'pointer', font: 'inherit', fontSize: '0.85rem', padding: 0 }}>
        Open Follow up →
      </button>
    </div>
  )
}

const pickerWrap: CSSProperties = { position: 'relative', display: 'inline-flex', alignItems: 'center' }
/** A real select, its own chevron drawn so it sits inside the pill with room, not on the edge (v2.5555). */
const pickerStyle: CSSProperties = {
  appearance: 'none',
  WebkitAppearance: 'none',
  border: '1px solid var(--border-strong)',
  borderRadius: 8,
  padding: '0.3rem 1.9rem 0.3rem 0.7rem',
  background: 'var(--surface)',
  color: 'inherit',
  font: 'inherit',
  fontSize: '0.85rem',
  cursor: 'pointer',
}

function Chevron() {
  return (
    <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', right: '0.6rem', pointerEvents: 'none', color: 'var(--text-muted)' }}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

/** The board's two pickers: which job, whose seat. Drawn in the views row by `GcFlowBoard`, which holds the filter. */
export function BoardPickers({ ctx, companies, filter, onFilter }: { ctx: BoardContext; companies: readonly BoardCompany[]; filter: BoardFilter; onFilter: (f: BoardFilter) => void }) {
  const options = boardFilterOptions(ctx, companies)
  return (
    <div role="group" aria-label="Narrow the board" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
      <span style={pickerWrap}>
        <select aria-label="Which job" style={{ ...pickerStyle, maxWidth: 'min(16rem, 70vw)' }} value={filter.jobId ?? ''} onChange={(e) => onFilter({ ...filter, jobId: e.target.value || null })}>
          <option value="">All jobs</option>
          {options.jobs.map((j) => (
            <option key={j.id} value={j.id}>
              {j.name}
            </option>
          ))}
        </select>
        <Chevron />
      </span>
      <span style={pickerWrap}>
        <select aria-label="Whose seat" style={pickerStyle} value={filter.seat ?? ''} onChange={(e) => onFilter({ ...filter, seat: e.target.value || null })}>
          <option value="">Everyone's seat</option>
          {options.seats.map((s) => (
            <option key={s} value={s}>
              {s}'s seat
            </option>
          ))}
        </select>
        <Chevron />
      </span>
    </div>
  )
}

export function GcBoardByStep({ ctx, companies, presses, filter = NO_FILTER }: { ctx: BoardContext; companies: readonly BoardCompany[]; presses: BoardPresses; filter?: BoardFilter }) {
  const summary = boardSummary(ctx, companies, filter)
  const bands = boardBands(ctx, companies, filter)
  const grey = STAGE_COLORS.grey
  return (
    <div>
      <TodayLine ctx={ctx} summary={summary} onHand={presses.onNeedsAHand} />
      <div role="group" aria-label="Where everyone stands">
        {bands.map((b) => (
          <Band key={b.phase} band={b} ctx={ctx} presses={presses} />
        ))}
        {summary.off.length > 0 && (
          <section aria-label="Off the flow" data-board-step="off" style={{ marginTop: '0.9rem' }}>
            <div className="stagesSectionBand" style={{ ...({ '--stage-color': grey.bar } as CSSProperties), display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', color: 'var(--text-muted)' }}>
              <span className="stagesBandTitle">Off the flow</span>
              <span className="stagesBandCount" style={{ color: grey.fg }}>
                {summary.off.length}
              </span>
              <span style={{ fontSize: '0.8rem' }}>Declined, went elsewhere, or let go.</span>
            </div>
            <div style={{ ...rowStyle, gap: '0.35rem' }}>
              {summary.off.map((o) => (
                <span key={o.contactId} title={o.why} style={{ border: '1px solid var(--border-strong)', borderRadius: 999, padding: '0.2rem 0.7rem', fontSize: '0.85rem' }}>
                  {o.name} <span style={{ color: 'var(--text-muted)' }}>since {shortDate(o.since)}</span>
                </span>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
