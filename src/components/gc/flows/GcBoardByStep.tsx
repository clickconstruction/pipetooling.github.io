import { useState, type CSSProperties } from 'react'
import {
  NO_FILTER,
  boardFilterOptions,
  dueWords,
  boardRows,
  boardSummary,
  rowHeadParts,
  type BoardCompany,
  type BoardContext,
  type BoardFilter,
  type BoardLine,
  type BoardRow,
  type ChipGroup,
  type LineTone,
  type RowPress,
} from '../../../lib/flows/board'
import type { FlowStep } from '../../../lib/flows/state'
import { shortDate } from '../../../lib/gc/words'
import { GcBoardTiles } from './GcBoardTiles'

/**
 * Everyone by step (Messages cut 4, the prototype's v1.173 and v1.174): the tiles, then one row per step in the flow's
 * order with the lanes named. Empty steps fold to one line, a lane's last step keeps its own. Under each step, how many
 * are on it, with late, lapsed, over usual and waiting, and the step's usual. The chips group by job in the per-job
 * lane, the job named once with the day they share. The press at the right is the step's own. The job and the seat
 * pickers narrow every row and tile. The words and the rules are `flows/board.ts`'s; this only draws them.
 */

export interface BoardPresses {
  /** A chip or a dot: that company at that step. */
  onCompany: (line: BoardLine) => void
  /** The press at a row's right. */
  onRowPress: (step: FlowStep, press: RowPress, lines: readonly BoardLine[]) => void
  /** Needs a hand: Follow up. */
  onNeedsAHand: () => void
}

const WORDS_COLOR: Record<LineTone, string> = {
  late: 'var(--text-red-700)',
  lapsed: 'var(--text-orange-700)',
  over: 'var(--text-orange-700)',
  wait: 'var(--text-blue-700)',
  '': 'var(--text-muted)',
}

const rowStyle: CSSProperties = { display: 'flex', gap: '0.6rem', alignItems: 'flex-start', flexWrap: 'wrap', padding: '0.5rem 0', borderTop: '1px solid var(--border)' }
const headStyle: CSSProperties = { flex: '0 0 180px', minWidth: 140, fontWeight: 600, fontSize: '0.9rem' }
const subStyle: CSSProperties = { display: 'block', fontWeight: 400, fontSize: '0.75rem', color: 'var(--text-muted)' }
const chipsStyle: CSSProperties = { flex: '1 1 260px', minWidth: 0, display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' }
const empty: CSSProperties = { fontSize: '0.8rem', color: 'var(--text-muted)' }

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
        padding: '0.15rem 0.6rem',
        fontSize: '0.8rem',
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
        <span key={g.jobId ?? '-'} style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' }}>
          {(g.label || g.sharedDue) && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-600)', fontWeight: 600 }}>
              {g.label ?? ''}
              {g.sharedDue ? `${g.label ? ' · ' : ''}due ${dueWords(g.sharedDue, today)}` : ''}
            </span>
          )}
          {g.chips.map((c) => (
            <Chip key={`${c.line.contactId}:${c.line.jobId ?? '-'}`} line={c.line} words={c.words} onPress={onCompany} />
          ))}
        </span>
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
        border: `1px solid ${urgent ? 'var(--text-blue-500)' : 'var(--border-strong)'}`,
        background: urgent ? 'var(--text-blue-500)' : 'var(--surface)',
        color: urgent ? 'var(--surface)' : 'var(--text-700)',
        borderRadius: 8,
        padding: '0.25rem 0.65rem',
        fontSize: '0.8rem',
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
  if (row.kind === 'folded') {
    return (
      <div style={rowStyle} data-board-step={row.steps[0]?.id}>
        <div style={headStyle}>
          {row.steps.map((s) => s.name).join(' · ')}
          <span style={subStyle}>nobody on these</span>
        </div>
        <div style={chipsStyle}>
          <span style={empty}>{row.lands}</span>
        </div>
        {row.press && row.steps[0] && <Press step={row.steps[0]} press={row.press} lines={[]} onPress={presses.onRowPress} />}
      </div>
    )
  }
  const lines = row.groups.flatMap((g) => g.chips.map((c) => c.line))
  return (
    <div style={rowStyle} data-board-step={row.step.id}>
      <div style={headStyle}>
        {row.step.name}
        <span style={subStyle}>{rowHeadParts(row.head).join(' · ')}</span>
      </div>
      <div style={chipsStyle}>{lines.length ? <Groups groups={row.groups} today={today} onCompany={presses.onCompany} /> : <span style={empty}>{row.lands}</span>}</div>
      <Press step={row.step} press={row.press} lines={lines} onPress={presses.onRowPress} />
    </div>
  )
}

const pickerStyle: CSSProperties = { border: '1px solid var(--border-strong)', borderRadius: 8, padding: '0.25rem 0.5rem', background: 'var(--surface)', color: 'inherit', font: 'inherit', fontSize: '0.85rem' }

export function GcBoardByStep({ ctx, companies, presses }: { ctx: BoardContext; companies: readonly BoardCompany[]; presses: BoardPresses }) {
  const [filter, setFilter] = useState<BoardFilter>(NO_FILTER)
  const [showOff, setShowOff] = useState(false)
  const summary = boardSummary(ctx, companies, filter)
  const rows = boardRows(ctx, companies, filter)
  const options = boardFilterOptions(ctx, companies)
  const jump = (stepId: string) => document.querySelector(`[data-board-step="${stepId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  return (
    <div>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
        <select aria-label="Which job" style={pickerStyle} value={filter.jobId ?? ''} onChange={(e) => setFilter({ ...filter, jobId: e.target.value || null })}>
          <option value="">All jobs</option>
          {options.jobs.map((j) => (
            <option key={j.id} value={j.id}>
              {j.name}
            </option>
          ))}
        </select>
        <select aria-label="Whose seat" style={pickerStyle} value={filter.seat ?? ''} onChange={(e) => setFilter({ ...filter, seat: e.target.value || null })}>
          <option value="">Everyone's seat</option>
          {options.seats.map((s) => (
            <option key={s} value={s}>
              {s}'s seat
            </option>
          ))}
        </select>
      </div>
      <GcBoardTiles
        summary={summary}
        ctx={ctx}
        onTile={jump}
        onDot={(d) => presses.onCompany(d.line)}
        onOff={() => {
          setShowOff(true)
          requestAnimationFrame(() => document.querySelector('[data-board-step="off"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
        }}
        onHand={presses.onNeedsAHand}
      />
      {rows.lanes.map((lane) => (
        <section key={lane.lane} aria-label={lane.words}>
          <div style={{ fontSize: '0.7rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: '0.75rem' }}>{lane.words}</div>
          {lane.rows.map((row) => (
            <Row key={row.kind === 'step' ? row.step.id : row.steps.map((s) => s.id).join('+')} row={row} today={ctx.today} presses={presses} />
          ))}
        </section>
      ))}
      <div style={rowStyle} data-board-step="off">
        <div style={{ ...headStyle, color: 'var(--text-muted)' }}>
          Off the flow
          <span style={subStyle}>
            {rows.off.length} · {showOff ? 'shown' : 'folded'}
          </span>
        </div>
        <div style={chipsStyle}>
          {showOff &&
            rows.off.map((o) => (
              <span key={o.contactId} title={o.why} style={{ border: '1px solid var(--border-strong)', borderRadius: 999, padding: '0.15rem 0.6rem', fontSize: '0.8rem' }}>
                {o.name} <span style={{ color: 'var(--text-muted)' }}>since {shortDate(o.since)}</span>
              </span>
            ))}
          <button type="button" onClick={() => setShowOff(!showOff)} style={{ border: 'none', background: 'none', color: 'var(--text-blue-500)', cursor: 'pointer', font: 'inherit', fontSize: '0.8rem' }}>
            {showOff ? 'fold' : 'show'}
          </button>
        </div>
      </div>
    </div>
  )
}
