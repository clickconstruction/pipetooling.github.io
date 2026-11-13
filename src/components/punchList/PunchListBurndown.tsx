import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { Area, Bar, BarChart, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { GROUP_COLOR } from '../../lib/todos/punchListView'
import {
  BURNDOWN_RANGES,
  axisTicks,
  cardsFromItems,
  chartPoints,
  countWords,
  dayWords,
  heldCount,
  hourWords,
  hourlyRows,
  paceOver,
  rangeLabel,
  rangeWords,
  signedWords,
  slowestStageWords,
  stageRows,
  takeawayWords,
  tickWords,
  waveBins,
  waveHours,
  type BurndownMeasure,
  type BurndownRange,
  type ChartPoint,
  type Pace,
  type PunchListHistory,
  type StageRow,
  type WaveBin,
} from '../../lib/todos/punchListHistory'
import type { BoardItem } from '../../lib/todos/todoBoard'
import { EmptyState } from '../EmptyState'

/**
 * The burndown at the top of /punch-list: the open cards hour by hour, replayed from every change of
 * `to-dos/` on main, with what came in and what closed in waves, where the open work sits, and when
 * the list clears at the pace of the stretch the reader picks. The numbers are `punchListHistory.ts`'s;
 * the cards open now are the board's own. `/punch-list#burndown` lands on it. Hide folds it to one
 * line and the device remembers, as the Shortlist does.
 */
export function PunchListBurndown({ history, items, now = Date.now }: { history: PunchListHistory; items: readonly BoardItem[]; now?: () => number }) {
  const [open, setOpen] = useState<boolean>(() => readOpen())
  const [range, setRange] = useState<BurndownRange>('7d')
  const [measure, setMeasure] = useState<BurndownMeasure>('cards')
  const nowMs = useMemo(() => now(), [now])
  const rows = useMemo(() => hourlyRows(history.events, nowMs), [history, nowMs])
  const cards = useMemo(() => cardsFromItems(items), [items])
  const firstMs = rows[0]?.start ?? null
  const cardPace = useMemo(() => paceOver(rows, range, 'cards'), [rows, range])
  const pointPace = useMemo(() => paceOver(rows, range, 'points'), [rows, range])
  const pace = measure === 'points' ? pointPace : cardPace
  const points = useMemo(() => chartPoints(rows, range, measure, pace), [rows, range, measure, pace])
  const bin = waveHours(range, rows.length)
  const waves = useMemo(() => waveBins(rows, range, measure, bin), [rows, range, measure, bin])
  const stages = useMemo(() => stageRows(rows, cards, range, measure), [rows, cards, range, measure])
  const toggle = () => {
    const next = !open
    setOpen(next)
    writeOpen(next)
  }
  const enough = rows.length >= 2 && cardPace !== null && pointPace !== null && pace !== null
  const openPoints = cards.reduce((a, c) => a + c.p, 0)

  return (
    <section id="burndown" data-testid="punch-burndown" style={{ marginTop: '2rem' }}>
      {/* Six tiles in rows of two, three or six; inline styles cannot carry a media query. */}
      <style>{`
        .punch-burn-tiles { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .punch-burn-body > * { min-width: 0; }
        @media (min-width: 640px) { .punch-burn-tiles { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
        @media (min-width: 1100px) { .punch-burn-tiles { grid-template-columns: repeat(6, minmax(0, 1fr)); } }
      `}</style>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Burndown</h2>
        <span style={{ ...mono, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {cards.length} open · {openPoints} points
        </span>
        <button type="button" onClick={toggle} aria-expanded={open} aria-controls="burndown-body" style={{ ...pill(false), marginLeft: 'auto', fontSize: '0.8rem', padding: '0.2rem 0.6rem' }}>
          {open ? 'Hide the burndown' : 'Show the burndown'}
        </button>
      </div>
      {!open ? null : !enough || !cardPace || !pointPace || !pace ? (
        <div id="burndown-body">
          <EmptyState
            main={
              history.shallow
                ? 'This build read only the newest commit, so it has no history to draw.'
                : 'This build could not read the history of the to-dos folder, so there is no burndown to draw.'
            }
            tail="The next deploy reads it again."
          />
        </div>
      ) : (
        <div id="burndown-body" className="punch-burn-body" style={{ display: 'grid', gap: '1.25rem', minWidth: 0 }}>
          <p data-testid="burndown-takeaway" style={{ margin: 0, maxWidth: '74ch', lineHeight: 1.6 }}>
            {takeawayWords({ cards: cardPace, points: pointPace, held: heldCount(cards), firstMs, nowMs }).join(' ')}
          </p>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <label htmlFor="burndown-range" style={eyebrow}>
              Look at
            </label>
            <select
              id="burndown-range"
              value={range}
              onChange={(e) => setRange(e.target.value as BurndownRange)}
              style={{ font: 'inherit', fontSize: '0.85rem', padding: '0.3rem 0.5rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-base)' }}
            >
              {BURNDOWN_RANGES.map((r) => (
                <option key={r} value={r}>
                  {rangeLabel(r, firstMs)}
                </option>
              ))}
            </select>
            <span style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 0.25rem' }} aria-hidden />
            <span style={eyebrow}>Count by</span>
            {(['cards', 'points'] as const).map((m) => (
              <button key={m} type="button" onClick={() => setMeasure(m)} aria-pressed={measure === m} style={pill(measure === m)}>
                {m === 'cards' ? 'Cards' : 'Points by size'}
              </button>
            ))}
          </div>

          <Tiles cards={cardPace} points={pointPace} pace={pace} measure={measure} firstMs={firstMs} nowMs={nowMs} />

          <div>
            <h3 style={h3}>Open work hour by hour, and where it heads</h3>
            <Legend
              keys={[
                { label: 'Open', line: 'solid' },
                { label: 'With no new cards', line: 'dashed' },
                { label: 'At this pace', line: 'dotted' },
              ]}
            />
            <BurndownChart points={points} measure={measure} />
          </div>

          <div>
            <h3 style={h3}>New and closed, in waves</h3>
            <p style={note}>
              Each column is {bin === 1 ? 'one hour' : bin === 24 ? 'one day' : `${bin} hours`}. Tall columns close together are a wave.
            </p>
            <Legend
              keys={[
                { label: measure === 'points' ? 'New points, above the line' : 'New cards, above the line', swatch: NEW },
                { label: measure === 'points' ? 'Points closed, below the line' : 'Cards closed, below the line', swatch: CLOSED },
              ]}
            />
            <WaveChart bins={waves} measure={measure} bin={bin} />
          </div>

          <div>
            <h3 style={h3}>Where the open work sits</h3>
            <p data-testid="burndown-slowest" style={note}>
              {slowestStageWords(stages, range, firstMs, nowMs)}
            </p>
            <StageTable stages={stages} range={range} firstMs={firstMs} />
          </div>

          <details style={{ maxWidth: '74ch', color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.6 }}>
            <summary style={{ cursor: 'pointer', color: 'var(--text-base)', fontWeight: 500 }}>How this is counted</summary>
            <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.2em', display: 'grid', gap: 6 }}>
              <li>A card is open while its file is in the to-dos folder on main. It closes when it leaves the board, shipped or dropped.</li>
              <li>Every change of that folder on main is replayed when the app is built, and the board is read at the end of each hour. The last point is this build.</li>
              <li>Points weigh a card by the size it has left. XS is 1, S is 2, M is 4, L is 8 and XL is 16. A card with no size counts as 4.</li>
              <li>A pace uses whole hours of the stretch you pick. Each projection is a straight line from that pace.</li>
              <li>A stage drains by every card that left it, closed or moved on to another stage.</li>
              <li>Cards waiting on an owner decision or on time close when that decision or that time comes. A building pace cannot clear them.</li>
            </ul>
          </details>
        </div>
      )}
    </section>
  )
}

function Tiles({ cards, points, pace, measure, firstMs, nowMs }: { cards: Pace; points: Pace; pace: Pace; measure: BurndownMeasure; firstMs: number | null; nowMs: number }) {
  const stretch = rangeWords(pace.range, firstMs)
  const delta = (p: Pace) => (
    <>
      <b style={{ fontWeight: 600, color: p.change < 0 ? GOOD : p.change > 0 ? BAD : 'inherit' }}>{signedWords(p.change)}</b> since {hourWords(p.changeSinceMs)}
    </>
  )
  return (
    <div data-testid="burndown-tiles" className="punch-burn-tiles" style={{ border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 6, overflow: 'hidden' }}>
      <Tile label="Open cards" value={cards.open.toLocaleString('en-US')} sub={delta(cards)} />
      <Tile label="Work left, in points" value={points.open.toLocaleString('en-US')} sub={delta(points)} />
      <Tile label="Closed a day" value={pace.closedPerDay.toLocaleString('en-US')} sub={`${countWords(pace.closed, measure)} ${stretch}`} />
      <Tile label="New a day" value={pace.addedPerDay.toLocaleString('en-US')} sub={`${countWords(pace.added, measure)} ${stretch}`} />
      <Tile
        label="Clears with no new cards"
        value={pace.clearNoNewMs === null ? 'No pace yet' : dayWords(pace.clearNoNewMs, nowMs)}
        sub={pace.daysNoNew === null ? `Nothing closed ${stretch}` : `In ${pace.daysNoNew.toLocaleString('en-US')} days if nothing new is added`}
      />
      <Tile
        label="Clears at this pace"
        value={pace.clearAtPaceMs === null ? 'Not at this pace' : dayWords(pace.clearAtPaceMs, nowMs)}
        sub={
          <>
            Net change <b style={{ fontWeight: 600, color: pace.netPerDay < 0 ? GOOD : pace.netPerDay > 0 ? BAD : 'inherit' }}>{signedWords(pace.netPerDay)}</b> a day
          </>
        }
      />
    </div>
  )
}

function Tile({ label, value, sub }: { label: string; value: string; sub: ReactNode }) {
  return (
    <div style={{ padding: '0.75rem 1rem', borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)', marginBottom: -1, minWidth: 0 }}>
      <div style={eyebrow}>{label}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 600, lineHeight: 1.25, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>{sub}</div>
    </div>
  )
}

function Legend({ keys }: { keys: { label: string; line?: 'solid' | 'dashed' | 'dotted'; swatch?: string }[] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem 1.1rem', fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.25rem 0 0.4rem' }}>
      {keys.map((k) => (
        <span key={k.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {k.swatch ? (
            <span aria-hidden style={{ width: 10, height: 10, borderRadius: 2, background: k.swatch, display: 'inline-block' }} />
          ) : (
            <svg aria-hidden width="22" height="8">
              <line x1="1" y1="4" x2="21" y2="4" stroke={k.line === 'solid' ? OPEN : 'var(--text-muted)'} strokeWidth="2" strokeLinecap="round" strokeDasharray={k.line === 'dashed' ? '6 5' : k.line === 'dotted' ? '1 5' : undefined} />
            </svg>
          )}
          {k.label}
        </span>
      ))}
    </div>
  )
}

const axisTick = { fill: 'var(--text-muted)', fontSize: 12 }

function BurndownChart({ points, measure }: { points: ChartPoint[]; measure: BurndownMeasure }) {
  const first = points[0]
  const last = points[points.length - 1]
  if (!first || !last) return null
  const nowT = [...points].reverse().find((p) => p.open !== null)?.t ?? last.t
  return (
    <div data-burndown-chart role="img" aria-label={`Open ${measure} at each hour, then two lines to where the list heads: with no new cards, and at this pace.`} style={{ width: '100%', height: 300 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={points} margin={{ top: 16, right: 16, bottom: 0, left: -8 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="t" type="number" scale="time" domain={[first.t, last.t]} ticks={axisTicks(first.t, last.t)} tickFormatter={tickWords} tick={axisTick} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 'auto']} allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} width={44} />
          <Tooltip content={<BurndownTip measure={measure} nowT={nowT} />} cursor={{ stroke: 'var(--border-strong)' }} />
          <ReferenceLine x={nowT} stroke="var(--border-strong)" label={{ value: 'Now', position: 'top', fill: 'var(--text-muted)', fontSize: 12 }} />
          <Area type="linear" dataKey="open" stroke={OPEN} strokeWidth={2} fill={OPEN} fillOpacity={0.08} dot={false} activeDot={{ r: 4 }} connectNulls={false} isAnimationActive={false} />
          <Line type="linear" dataKey="noNew" stroke="var(--text-muted)" strokeWidth={2} strokeDasharray="6 5" dot={false} activeDot={false} connectNulls isAnimationActive={false} />
          <Line type="linear" dataKey="atPace" stroke="var(--text-muted)" strokeWidth={2} strokeDasharray="1 5" strokeLinecap="round" dot={false} activeDot={false} connectNulls isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

function BurndownTip({ active, payload, measure, nowT }: { active?: boolean; payload?: { payload: ChartPoint }[]; measure: BurndownMeasure; nowT: number }) {
  const p = active && payload && payload[0] ? payload[0].payload : null
  if (!p) return null
  return (
    <div style={tip}>
      <div style={{ fontWeight: 600 }}>{p.t > nowT ? `${hourWords(p.t)}, projected` : hourWords(p.t)}</div>
      {p.open !== null ? <div>{countWords(p.open, measure)} open</div> : null}
      {p.t > nowT && p.noNew !== null ? <div>With no new cards: {Math.round(p.noNew).toLocaleString('en-US')}</div> : null}
      {p.t > nowT && p.atPace !== null ? <div>At this pace: {Math.round(p.atPace).toLocaleString('en-US')}</div> : null}
    </div>
  )
}

type WaveRow = WaveBin & { closedDown: number }

function WaveChart({ bins, measure, bin }: { bins: WaveBin[]; measure: BurndownMeasure; bin: number }) {
  const rows: WaveRow[] = bins.map((b) => ({ ...b, closedDown: -b.closed }))
  const every = Math.max(1, Math.ceil(rows.length / 8))
  return (
    <div data-burndown-waves role="img" aria-label={`New ${measure} above the line and closed ${measure} below it, a column for every ${bin === 1 ? 'hour' : bin === 24 ? 'day' : `${bin} hours`}.`} style={{ width: '100%', height: 220 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} stackOffset="sign" margin={{ top: 8, right: 16, bottom: 0, left: -8 }} barCategoryGap={rows.length > 60 ? 0 : '18%'}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="start" interval={every - 1} tickFormatter={(t: number) => (bin === 24 ? dayWords(t) : tickWords(t))} tick={axisTick} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tickFormatter={(v: number) => String(Math.abs(v))} tick={axisTick} axisLine={false} tickLine={false} width={44} />
          <Tooltip content={<WaveTip measure={measure} bin={bin} />} cursor={{ fill: 'var(--bg-subtle)' }} />
          <ReferenceLine y={0} stroke="var(--border-strong)" />
          <Bar dataKey="added" stackId="w" fill={NEW} maxBarSize={24} isAnimationActive={false} />
          <Bar dataKey="closedDown" stackId="w" fill={CLOSED} maxBarSize={24} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function WaveTip({ active, payload, measure, bin }: { active?: boolean; payload?: { payload: WaveRow }[]; measure: BurndownMeasure; bin: number }) {
  const b = active && payload && payload[0] ? payload[0].payload : null
  if (!b) return null
  return (
    <div style={tip}>
      <div style={{ fontWeight: 600 }}>
        {bin === 24 ? dayWords(b.start) : hourWords(b.start)}
        {b.partial ? ', so far' : ''}
      </div>
      <div>{countWords(b.added, measure)} new</div>
      <div>{countWords(b.closed, measure)} closed</div>
    </div>
  )
}

function StageTable({ stages, range, firstMs }: { stages: StageRow[]; range: BurndownRange; firstMs: number | null }) {
  return (
    <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)' }}>
      <table data-testid="burndown-stages" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
        <thead>
          <tr>
            <th style={th}>Stage</th>
            <th style={th}>{rangeLabel(range, firstMs)}</th>
            <th style={thNum}>Open cards</th>
            <th style={thNum}>Points</th>
            <th style={thNum}>Moved on or closed</th>
            <th style={thNum}>A day</th>
            <th style={thNum}>Days to clear with no new cards</th>
          </tr>
        </thead>
        <tbody>
          {stages.map((s) => (
            <tr key={s.group} data-testid={`burndown-stage-${s.group}`}>
              <td style={td}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                  <span aria-hidden style={{ width: 10, height: 10, borderRadius: 2, background: GROUP_COLOR[s.group], display: 'inline-block' }} />
                  {s.label}
                </span>
              </td>
              <td style={td}>
                <Spark line={s.line} color={GROUP_COLOR[s.group]} />
              </td>
              <td style={tdNum}>{s.cards}</td>
              <td style={tdNum}>{s.points}</td>
              <td style={tdNum}>{s.left}</td>
              <td style={tdNum}>{s.perDay}</td>
              <td style={tdNum}>{s.days === null ? (s.cards === 0 ? 'Clear' : 'No rate yet') : s.days}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** A stage's small line over the stretch: its own scale, so the shape reads at a glance. */
function Spark({ line, color }: { line: number[]; color: string }) {
  const W = 120
  const H = 26
  if (line.length < 2) return null
  const max = Math.max(1, ...line)
  const path = line.map((v, i) => `${i === 0 ? 'M' : 'L'}${((i / (line.length - 1)) * (W - 4) + 2).toFixed(1)},${(H - 3 - (v / max) * (H - 6)).toFixed(1)}`).join('')
  return (
    <svg aria-hidden width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

const OPEN = 'var(--text-strong)'
const NEW = 'var(--text-amber-800)'
const CLOSED = 'var(--text-green-700)'
const GOOD = 'var(--text-green-700)'
const BAD = 'var(--text-red-700)'

const mono: CSSProperties = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }
const eyebrow: CSSProperties = { fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const h3: CSSProperties = { margin: '0 0 0.25rem', fontSize: '1rem' }
const note: CSSProperties = { margin: '0 0 0.4rem', maxWidth: '74ch', color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.55 }
const tip: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '0.4rem 0.6rem', fontSize: '0.8rem', color: 'var(--text-strong)' }
const th: CSSProperties = { textAlign: 'left', padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontWeight: 500, whiteSpace: 'nowrap' }
const thNum: CSSProperties = { ...th, textAlign: 'right' }
const td: CSSProperties = { padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }
const tdNum: CSSProperties = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }

function pill(active: boolean): CSSProperties {
  return {
    font: 'inherit',
    fontSize: '0.85rem',
    fontWeight: 500,
    padding: '0.3rem 0.75rem',
    borderRadius: 999,
    border: `1px solid ${active ? 'var(--text-strong)' : 'var(--border-strong)'}`,
    background: active ? 'var(--text-strong)' : 'var(--surface)',
    color: active ? 'var(--bg-page)' : 'var(--text-base)',
    cursor: 'pointer',
  }
}

const OPEN_KEY = 'punchListBurndownOpen'

function readOpen(): boolean {
  try {
    return window.localStorage.getItem(OPEN_KEY) !== '0'
  } catch {
    return true
  }
}

function writeOpen(open: boolean): void {
  try {
    window.localStorage.setItem(OPEN_KEY, open ? '1' : '0')
  } catch {
    // A private window keeps the choice for this visit only.
  }
}
