import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties, type Dispatch } from 'react'
import {
  shortDate,
  stageHealth,
  weekdayDate,
  type GcAction,
  type GcProject,
  type GcState,
  type CalendarDay,
  type CalendarWeek,
  type StageCalendar,
  type HealthTab,
  type HealthTile,
  type StageHealth,
  type TileDot,
  type TileState,
  weekIsQuiet,
  weekWorkingDays,
} from '../../lib/gcMode/gcModel'
import { Btn, input } from './gcUi'

/**
 * GC mode design spike: the strip under a project's title that says how its stage is going (the
 * owner, 2026-10-04: "at the top of this page we should have some sort of visual that describes the
 * health of the stage"; the revised design in `to-dos/gc-mode/stage-health-mockup.html`). The same
 * shape in every stage: the verdict with its reason and the one thing to do next, the stage's
 * clock, one tile a trade, a few numbers. The kernel is `stageHealth`.
 */

const VERDICT: Record<StageHealth['verdict'], { words: string; bg: string; fg: string }> = {
  'on track': { words: 'On track', bg: 'var(--bg-green-tint)', fg: 'var(--text-green-700)' },
  watch: { words: 'Watch', bg: 'var(--bg-amber-tint)', fg: 'var(--text-amber-700)' },
  behind: { words: 'Behind', bg: 'var(--bg-red-tint)', fg: 'var(--text-red-700)' },
}

/** The tile colors: saturated on purpose, like the ring's, since they are status marks. */
const TILE: Record<TileState, string> = { good: '#22c55e', warn: '#f59e0b', bad: '#ef4444', ours: '#8b5cf6' }
const DOT: Record<TileDot, string> = { on: '#22c55e', wait: '#f59e0b', us: '#ef4444', off: 'transparent' }

const PATH: { key: string; label: string }[] = [
  { key: 'pursuing', label: 'Bidding' },
  { key: 'buyout', label: 'Buying out' },
  { key: 'building', label: 'Building' },
  { key: 'closed', label: 'Closed' },
]

const BUYOUT_STEPS = 'award · master agreement · insurance · W-9 · statement of work'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** The strip for one project. Nothing for a bid we lost or a closed job. */
export function GcStageHealth({
  state,
  project,
  dispatch,
  onTab,
}: {
  state: GcState
  project: GcProject
  dispatch: Dispatch<GcAction>
  onTab: (tab: HealthTab) => void
}) {
  const health = useMemo(() => stageHealth(state, project), [state, project])
  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(900)
  useEffect(() => {
    const el = box.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const watch = new ResizeObserver(([entry]) => setWidth(entry?.contentRect.width ?? 900))
    watch.observe(el)
    return () => watch.disconnect()
  }, [])
  if (!health) return null
  const v = VERDICT[health.verdict]
  const stageAt = PATH.findIndex((p) => p.key === project.stage)
  return (
    <div ref={box} data-tour="gc-stage-health" style={{ borderTop: '1px solid var(--border)', marginTop: '0.75rem', paddingTop: '0.75rem', display: 'grid', gap: '0.75rem', minWidth: 0 }}>
      {/* Where the job is in its life */}
      <div aria-label="Where the job is" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.2rem 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
        {PATH.map((p, i) => (
          <span key={p.key} style={{ display: 'inline-flex', alignItems: 'center' }}>
            {i > 0 && <span aria-hidden style={{ display: 'inline-block', width: 20, height: 2, background: 'var(--border)', margin: '0 0.4rem' }} />}
            <span
              aria-hidden
              style={{
                width: 9,
                height: 9,
                borderRadius: '50%',
                marginRight: '0.35rem',
                border: `2px solid ${i < stageAt ? TILE.good : i === stageAt ? 'var(--text-blue-500)' : 'var(--border-strong)'}`,
                background: i < stageAt ? TILE.good : i === stageAt ? 'var(--text-blue-500)' : 'transparent',
              }}
            />
            <span style={i === stageAt ? { color: 'var(--text-base)', fontWeight: 700 } : undefined}>{p.label}</span>
          </span>
        ))}
      </div>

      {/* The verdict and the one thing to do next */}
      <div style={{ display: 'flex', gap: '0.6rem 1rem', alignItems: 'flex-start', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'baseline', flex: '1 1 24rem', minWidth: 0 }}>
          <span style={{ padding: '0.15rem 0.65rem', borderRadius: 999, background: v.bg, color: v.fg, fontWeight: 800, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{v.words}</span>
          <span style={{ fontWeight: 600, fontSize: '0.92rem' }}>{health.why}</span>
        </div>
        {health.next && (
          <Btn kind="primary" onClick={() => onTab(health.next?.tab ?? 'packages')} wrap>
            Next: {health.next.words} →
          </Btn>
        )}
      </div>

      <Calendar calendar={health.calendar} width={width} stage={project.stage} />
      {health.askStartDate && <SetStart onSet={(date) => dispatch({ type: 'setStartDate', projectId: project.id, date })} today={state.today} />}

      {health.bars.length > 0 && (
        <div style={{ display: 'grid', gap: '0.45rem' }}>
          {health.bars.map((b) => (
            <div
              key={b.kind}
              title={b.money ? 'In the real build, the owner and the controller see money rows, as on the Money tab.' : undefined}
              style={{ display: 'grid', gridTemplateColumns: width < 560 ? '6.5rem minmax(0, 1fr) 6.5rem' : '9.5rem minmax(0, 1fr) 8.5rem', gap: '0.6rem', alignItems: 'center', fontSize: '0.82rem' }}
            >
              <span style={{ color: 'var(--text-muted)' }}>{b.label}</span>
              <span style={{ position: 'relative', height: 10, borderRadius: 999, background: 'var(--bg-muted)' }}>
                <span
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: `${Math.min(100, Math.max(0, b.pct))}%`,
                    borderRadius: 999,
                    background: b.kind === 'work' || b.kind === 'paid' ? TILE.good : 'var(--text-blue-500)',
                    opacity: b.kind === 'time' ? 0.55 : 1,
                  }}
                />
                {b.mark !== undefined && (
                  <span
                    title={b.kind === 'work' ? `Planned for today: ${b.mark}%` : `Work in place: ${b.mark}%`}
                    style={{ position: 'absolute', top: -4, bottom: -4, width: 2, left: `${Math.min(100, Math.max(0, b.mark))}%`, background: 'var(--text-base)' }}
                  />
                )}
              </span>
              <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{b.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* One tile a trade */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${width < 420 ? 130 : 150}px, 1fr))`, gap: '0.5rem' }}>
        {health.tiles.map((t) => (
          <Tile key={t.packageId} tile={t} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: '0.3rem 1rem', flexWrap: 'wrap', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
        <Key color={TILE.good} words="done for this stage" />
        <Key color={TILE.warn} words="under way, or waiting on a company" />
        <Key color={TILE.bad} words="a hole, a problem, or waiting on us" />
        <Key color={TILE.ours} words="our own crew" />
        {project.stage === 'buyout' && <span>Dots, in order: {BUYOUT_STEPS}</span>}
        {project.stage === 'pursuing' && <span>Dots: quotes in, amber on old plans</span>}
      </div>

      {/* A few numbers */}
      <div style={{ display: 'flex', gap: '0.6rem 1.75rem', flexWrap: 'wrap' }}>
        {health.numbers.map((n) => (
          <div key={n.label} style={{ display: 'grid', gap: '0.05rem', minWidth: 0 }} title={n.money ? 'In the real build, the owner and the controller see this, as on the Money tab.' : undefined}>
            <span style={{ fontSize: '0.68rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>{n.label}</span>
            <span
              style={{
                fontSize: '1.05rem',
                fontWeight: 800,
                fontVariantNumeric: 'tabular-nums',
                color: n.tone === 'bad' ? 'var(--text-red-700)' : n.tone === 'warn' ? 'var(--text-amber-700)' : n.tone === 'good' ? 'var(--text-green-700)' : 'var(--text-base)',
              }}
            >
              {n.value}
            </span>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{n.note}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Key({ color, words }: { color: string; words: string }) {
  return (
    <span style={{ display: 'inline-flex', gap: '0.3rem', alignItems: 'center' }}>
      <span aria-hidden style={{ width: 9, height: 9, borderRadius: '50%', background: color, display: 'inline-block' }} />
      {words}
    </span>
  )
}

function Tile({ tile }: { tile: HealthTile }) {
  const color = TILE[tile.state]
  return (
    <div
      style={{
        border: `1px solid ${color}`,
        borderRadius: 8,
        padding: '0.45rem 0.6rem',
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr)',
        gap: '0.2rem',
        background: tile.state === 'bad' ? 'var(--bg-red-tint)' : 'var(--bg-subtle)',
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.4rem', alignItems: 'flex-start', fontWeight: 700, fontSize: '0.84rem', minWidth: 0 }}>
        {/* A long trade name wraps rather than losing its words. */}
        <span style={{ minWidth: 0, overflowWrap: 'anywhere', lineHeight: 1.25 }}>
          {tile.trade}
        </span>
        {tile.dots ? (
          <span style={{ display: 'inline-flex', gap: 3, flexShrink: 0, marginTop: 3 }} aria-label={tile.dots.join(', ')}>
            {tile.dots.map((d, i) => (
              <span key={i} style={{ width: 9, height: 9, borderRadius: '50%', display: 'inline-block', background: DOT[d], border: `1.5px solid ${d === 'off' ? 'var(--border-strong)' : DOT[d]}` }} />
            ))}
          </span>
        ) : tile.pct !== undefined ? (
          <span style={{ fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{tile.main}</span>
        ) : (
          <span aria-hidden style={{ width: 9, height: 9, borderRadius: '50%', background: color, flexShrink: 0 }} />
        )}
      </div>
      {tile.pct !== undefined ? (
        <span style={{ height: 6, borderRadius: 999, background: 'var(--bg-muted)', overflow: 'hidden' }}>
          <span style={{ display: 'block', height: '100%', width: `${Math.min(100, tile.pct)}%`, background: tile.state === 'good' ? TILE.good : tile.state === 'ours' ? TILE.ours : TILE.warn, borderRadius: 999 }} />
        </span>
      ) : (
        <span style={{ fontSize: '0.82rem', fontVariantNumeric: 'tabular-nums' }}>{tile.main}</span>
      )}
      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{tile.note}</span>
    </div>
  )
}

/** Set a start date right here, when buying out has none: it starts the stage's clock. */
function SetStart({ onSet, today }: { onSet: (date: string) => void; today: string }) {
  const [date, setDate] = useState('')
  return (
    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.85rem' }}>
      <label htmlFor="gc-health-start" style={{ fontWeight: 600 }}>
        Set a start date
      </label>
      <input id="gc-health-start" type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} style={{ ...input, height: 32, boxSizing: 'border-box' }} />
      <Btn onClick={() => date && onSet(date)} disabled={date === ''}>
        Save
      </Btn>
      <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>It also checks off "A start date is set" on Get started.</span>
    </div>
  )
}

/** The square colors: saturated on purpose for the deadlines, theme tints for the days. */
const SQUARE_CLOSE = '#f59e0b'
const SQUARE_DUE = '#ef4444'

function daySquareStyle(d: CalendarDay, openEnd: boolean, narrow: boolean, sz: CalendarSizes): CSSProperties {
  const base: CSSProperties = {
    width: narrow ? '100%' : d.weekend ? sz.weekend : sz.day,
    height: narrow ? 34 : sz.day,
    borderRadius: 6,
    border: '1.5px solid var(--border)',
    background: 'var(--surface)',
    position: 'relative',
    display: 'grid',
    placeItems: 'center',
    fontSize: '0.7rem',
    fontVariantNumeric: 'tabular-nums',
    color: 'var(--text-muted)',
    boxSizing: 'border-box',
    opacity: d.weekend ? 0.8 : 1,
  }
  if (!d.inStage) return { ...base, borderStyle: 'dashed', opacity: 0.35 }
  if (d.deadline === 'due') return { ...base, background: SQUARE_DUE, borderColor: SQUARE_DUE, color: '#fff', fontWeight: 800 }
  if (d.deadline === 'close') return { ...base, background: 'var(--bg-amber-tint)', borderColor: SQUARE_CLOSE, color: 'var(--text-amber-700)', fontWeight: 700 }
  if (d.today) return { ...base, border: '3px solid var(--text-blue-500)', color: 'var(--text-blue-500)', fontWeight: 700 }
  if (d.past) return { ...base, background: 'var(--bg-blue-tint)', color: 'var(--text-base)' }
  if (openEnd) return { ...base, borderStyle: 'dashed', borderColor: SQUARE_DUE }
  return base
}

function DaySquare({ d, openEnd, narrow, sz = ROOMY }: { d: CalendarDay; openEnd: boolean; narrow: boolean; sz?: CalendarSizes }) {
  const title = [weekdayDate(d.on), ...d.events].join('. ').replace(/\.\./g, '.')
  return (
    <div style={daySquareStyle(d, openEnd, narrow, sz)} title={title} aria-label={title} data-today={d.today ? 'yes' : undefined}>
      {Number(d.on.slice(8))}
      {(d.came.length > 0 || d.questions > 0 || d.promised.length > 0) && d.inStage && (
        <span aria-hidden style={{ position: 'absolute', left: 0, right: 0, bottom: 2, display: 'flex', gap: 2, justifyContent: 'center' }}>
          {d.came.slice(0, 4).map((_, i) => (
            <span key={`c${i}`} style={{ width: 5, height: 5, borderRadius: '50%', background: TILE.good }} />
          ))}
          {Array.from({ length: Math.min(2, d.questions) }, (_, i) => (
            <span key={`q${i}`} style={{ width: 5, height: 5, borderRadius: 1, background: SQUARE_CLOSE }} />
          ))}
          {d.promised.slice(0, 2).map((_, i) => (
            <span key={`p${i}`} style={{ width: 5, height: 5, borderRadius: '50%', border: `1.5px solid ${TILE.good}`, boxSizing: 'border-box' }} />
          ))}
        </span>
      )}
      {d.tag && (
        <span aria-hidden style={{ position: 'absolute', top: -7, right: -7, minWidth: 15, height: 15, padding: '0 3px', borderRadius: 8, background: 'var(--text-blue-500)', color: '#fff', fontSize: '0.58rem', fontWeight: 800, display: 'grid', placeItems: 'center', boxSizing: 'border-box' }}>
          {d.tag}
        </span>
      )}
    </div>
  )
}

/** The calendar's sizes; a strip too narrow for them takes the compact ones before it scrolls. */
interface CalendarSizes {
  day: number
  weekend: number
  gap: number
  week: number
  quiet: number
}
const ROOMY: CalendarSizes = { day: 34, weekend: 18, gap: 4, week: 14, quiet: 104 }
const COMPACT: CalendarSizes = { day: 28, weekend: 15, gap: 3, week: 10, quiet: 86 }
const LANE_HEIGHT = 30
/** Lines a week's label lane may take: two as a rule, a third when labels crowd. */
const LANE_ROWS = 3
const LABEL_AIR = 8

/** How wide the day calendar draws at a size: busy weeks as days, quiet weeks as one rectangle. */
function calendarWidth(weeks: CalendarDay[][], sz: CalendarSizes): number {
  return weeks.reduce((w, week) => w + (weekIsQuiet(week) ? quietWeekWidth(sz) : 5 * sz.day + 2 * sz.weekend + 6 * sz.gap), 0) + sz.week * Math.max(0, weeks.length - 1)
}

/** A quiet week: its working-week rectangle, then Saturday and Sunday as the narrow squares a busy week has. */
function quietWeekWidth(sz: CalendarSizes): number {
  return sz.quiet + 2 * (sz.weekend + sz.gap)
}

/** Monday to Friday of a week: "Sep 14 – 18". The rectangle of a quiet week says these, its weekend stands beside it (the owner, 2026-10-05). */
function workWeekRange(week: CalendarDay[]): string {
  return weekRange(week.filter((d) => !d.weekend))
}

/**
 * Saturday or Sunday beside a quiet week's rectangle: the busy week's narrow square with no number
 * (the rectangle gives the dates; the hover names the day). Ahead of today it is dashed grey, never
 * red: the red stays on the working days that are running out.
 */
function QuietWeekend({ d, sz, full }: { d: CalendarDay; sz: CalendarSizes; full: boolean }) {
  const ahead = d.inStage && !d.past && !d.today
  return (
    <div
      title={weekdayDate(d.on)}
      aria-label={weekdayDate(d.on)}
      data-weekend="yes"
      style={{
        ...daySquareStyle(d, false, full, sz),
        height: 34,
        ...(ahead ? { borderStyle: 'dashed', borderColor: 'var(--border-strong)', background: 'transparent' } : {}),
      }}
    />
  )
}

/** A week's two ends: "Sep 28 – Oct 4", or "Oct 5 – 11" inside one month. */
function weekRange(week: CalendarDay[]): string {
  const first = week[0]?.on ?? ''
  const last = week[week.length - 1]?.on ?? ''
  return first.slice(5, 7) === last.slice(5, 7) ? `${shortDate(first)} – ${Number(last.slice(8))}` : `${shortDate(first)} – ${shortDate(last)}`
}

/** The labels under a week's squares, each centered on its day, a second line when two would touch. */
function laneLabels(week: CalendarDay[], sz: CalendarSizes): { on: string; lines: string[]; left: number; width: number; row: number; color: string }[] {
  const out: { on: string; lines: string[]; left: number; width: number; row: number; color: string }[] = []
  const weekWidth = week.reduce((w, d) => w + (d.weekend ? sz.weekend : sz.day), 0) + sz.gap * (week.length - 1)
  let x = 0
  for (const d of week) {
    const size = d.weekend ? sz.weekend : sz.day
    const label = d.inStage ? d.label : undefined
    if (label) {
      const lines = label.split(' · ')
      // About 5.6px a character at the label's size, with a little air.
      const width = Math.round(Math.max(...lines.map((l) => l.length)) * 5.6 + 4)
      const left = Math.min(Math.max(x + size / 2 - width / 2, -sz.week / 2), weekWidth + sz.week / 2 - width)
      const rows = lines.length
      // The first row that is free across this label's width.
      let row = 0
      // Two labels need a little air between them on a line, else the later one drops a line.
      while (row < LANE_ROWS && out.some((o) => o.left < left + width + LABEL_AIR && left < o.left + o.width + LABEL_AIR && rangesTouch(o.row, o.lines.length, row, rows))) row++
      if (row + rows <= LANE_ROWS) {
        out.push({
          on: d.on,
          lines,
          left,
          width,
          row,
          color: d.today ? 'var(--text-blue-500)' : d.deadline === 'due' ? 'var(--text-red-700)' : d.deadline === 'close' ? 'var(--text-amber-700)' : 'var(--text-base)',
        })
      }
    }
    x += size + sz.gap
  }
  return out
}

function rangesTouch(rowA: number, linesA: number, rowB: number, linesB: number): boolean {
  return rowA < rowB + linesB && rowB < rowA + linesA
}

/**
 * The stage's calendar (the owner, 2026-10-04): a square a day with a little space where one week
 * becomes the next, weekends narrow; building is a square a week with a space between months. On a
 * phone the weeks stack as rows of a small calendar. Every square's hover lists its day.
 */
function Calendar({ calendar, width, stage }: { calendar: StageCalendar; width: number; stage: GcProject['stage'] }) {
  const scroller = useRef<HTMLDivElement>(null)
  // A calendar wider than the strip opens with today in view.
  useEffect(() => {
    const el = scroller.current
    if (!el || el.scrollWidth <= el.clientWidth) return
    const today = el.querySelector<HTMLElement>('[data-today="yes"]')
    if (today) el.scrollLeft = Math.max(0, today.offsetLeft - el.clientWidth / 2)
  }, [calendar, width])
  const buyout = stage === 'buyout'
  const summary = calendar.summary.length > 0 && (
    <div style={{ display: 'flex', gap: '0.3rem 1.1rem', flexWrap: 'wrap', fontSize: '0.85rem' }}>
      {calendar.summary.map((x) => (
        <span key={x.label} style={{ color: x.tone === 'bad' ? 'var(--text-red-700)' : x.tone === 'warn' ? 'var(--text-amber-700)' : x.tone === 'good' ? 'var(--text-green-700)' : 'var(--text-base)' }}>
          {x.value && <b style={{ fontVariantNumeric: 'tabular-nums' }}>{x.value}</b>} {x.label}
        </span>
      ))}
    </div>
  )
  const legendDot = (style: CSSProperties, words: string) => (
    <span style={{ display: 'inline-flex', gap: '0.3rem', alignItems: 'center' }}>
      <span aria-hidden style={{ display: 'inline-block', boxSizing: 'border-box', ...style }} />
      {words}
    </span>
  )

  if (calendar.mode === 'weeks') {
    const months: { month: number; weeks: CalendarWeek[] }[] = []
    for (const w of calendar.squares) {
      const last = months[months.length - 1]
      if (last && last.month === w.month) last.weeks.push(w)
      else months.push({ month: w.month, weeks: [w] })
    }
    return (
      <div style={{ display: 'grid', gap: '0.45rem', minWidth: 0 }}>
        {summary}
        <div ref={scroller} style={{ overflowX: 'auto', paddingBottom: 4 }}>
          <div style={{ display: 'flex', gap: 10, width: 'max-content' }}>
            {months.map((m) => (
              <div key={`${m.month}-${m.weeks[0]?.start}`} style={{ display: 'grid', gap: 4 }}>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{MONTHS[m.month]}</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {m.weeks.map((w) => {
                    const title = [`Week of ${shortDate(w.start)}`, ...w.events, ...(w.current ? ['This week.'] : [])].join('. ').replace(/\.\./g, '.')
                    const style: CSSProperties = {
                      width: 22,
                      height: 22,
                      borderRadius: 5,
                      border: '1.5px solid var(--border)',
                      background: 'var(--surface)',
                      position: 'relative',
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: '0.55rem',
                      color: 'var(--text-muted)',
                      boxSizing: 'border-box',
                      ...(w.past ? { background: 'var(--bg-blue-tint)', color: 'var(--text-base)' } : {}),
                      ...(w.current ? { border: '3px solid var(--text-blue-500)', color: 'var(--text-blue-500)', fontWeight: 700 } : {}),
                      ...(w.kind === 'next' ? { background: 'var(--bg-amber-tint)', borderColor: SQUARE_CLOSE } : {}),
                      ...(w.kind === 'late' ? { background: SQUARE_DUE, borderColor: SQUARE_DUE, color: '#fff' } : {}),
                      ...(w.kind === 'end' ? { border: `3px solid ${SQUARE_DUE}`, color: 'var(--text-red-700)', fontWeight: 800 } : {}),
                    }
                    return (
                      <div key={w.start} style={style} title={title} aria-label={title} data-today={w.current ? 'yes' : undefined}>
                        {Number(w.start.slice(8))}
                        {w.marks.length > 0 && (
                          <span aria-hidden style={{ position: 'absolute', left: 0, right: 0, bottom: 1, display: 'flex', gap: 2, justifyContent: 'center' }}>
                            {w.marks.slice(0, 3).map((k, i) => (
                              <span key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: k === 'good' ? TILE.good : '#fff', border: k === 'bad' ? `1px solid ${SQUARE_DUE}` : 'none' }} />
                            ))}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.3rem 1rem', flexWrap: 'wrap', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
          <span>A square a week, the months apart.</span>
          {legendDot({ width: 12, height: 12, borderRadius: 3, background: 'var(--bg-blue-tint)', border: '1.5px solid var(--border)' }, 'gone by')}
          {legendDot({ width: 12, height: 12, borderRadius: 3, border: '3px solid var(--text-blue-500)' }, 'this week')}
          {legendDot({ width: 12, height: 12, borderRadius: 3, background: 'var(--bg-amber-tint)', border: `1.5px solid ${SQUARE_CLOSE}` }, 'next milestone')}
          {legendDot({ width: 12, height: 12, borderRadius: 3, background: SQUARE_DUE }, 'a late milestone')}
          {legendDot({ width: 12, height: 12, borderRadius: 3, border: `3px solid ${SQUARE_DUE}` }, 'the finish')}
          {legendDot({ width: 6, height: 6, borderRadius: '50%', background: TILE.good }, 'milestone met')}
        </div>
      </div>
    )
  }

  const narrow = width < 560
  // The roomy sizes when they fit; the compact ones before the strip has to scroll.
  const sz = calendarWidth(calendar.weeks, ROOMY) <= width ? ROOMY : COMPACT
  const openEnd = calendar.openEnd
  const legend = (
    <div style={{ display: 'flex', gap: '0.3rem 1rem', flexWrap: 'wrap', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
      {legendDot({ width: 12, height: 12, borderRadius: 3, background: 'var(--bg-blue-tint)', border: '1.5px solid var(--border)' }, 'gone by')}
      {legendDot({ width: 12, height: 12, borderRadius: 3, border: '3px solid var(--text-blue-500)' }, 'today')}
      {!buyout && legendDot({ width: 12, height: 12, borderRadius: 3, background: 'var(--bg-amber-tint)', border: `1.5px solid ${SQUARE_CLOSE}` }, 'questions close · quotes wanted')}
      {legendDot({ width: 12, height: 12, borderRadius: 3, background: SQUARE_DUE }, buyout ? 'the start' : 'bid due')}
      {legendDot({ width: 6, height: 6, borderRadius: '50%', background: TILE.good }, buyout ? 'a paper came in' : 'a quote came in')}
      {!buyout && legendDot({ width: 6, height: 6, borderRadius: 1, background: SQUARE_CLOSE }, 'a question was asked')}
      {!buyout && legendDot({ width: 6, height: 6, borderRadius: '50%', border: `1.5px solid ${TILE.good}` }, 'a quote promised by')}
      {legendDot({ width: 22, height: 10, borderRadius: 3, border: '1.5px dashed var(--border-strong)' }, 'a week with nothing in it')}
    </div>
  )
  /** A quiet week: one rectangle with its dates, and what kind of quiet under it. */
  const lastWeek = calendar.weeks[calendar.weeks.length - 1]
  const quietWords = (week: CalendarDay[]) => {
    // Every week past today on a job with no last day is dashed red; the last one says why.
    const isOpen = Boolean(openEnd) && week.some((d) => d.inStage) && week.every((d) => !d.inStage || (!d.past && !d.today))
    const past = week.every((d) => d.past || !d.inStage)
    const n = weekWorkingDays(week)
    return {
      isOpen,
      past,
      words: isOpen && week === lastWeek ? (openEnd ?? '') : past ? 'nothing came in' : `${n} working ${n === 1 ? 'day' : 'days'}`,
    }
  }
  const quietBox = (week: CalendarDay[], full: boolean): CSSProperties => {
    const q = quietWords(week)
    return {
      height: 34,
      width: full ? '100%' : sz.quiet,
      borderRadius: 6,
      boxSizing: 'border-box',
      display: 'grid',
      placeItems: 'center',
      fontSize: '0.72rem',
      fontVariantNumeric: 'tabular-nums',
      border: `1.5px ${q.past ? 'solid' : 'dashed'} ${q.isOpen ? SQUARE_DUE : q.past ? 'var(--border)' : 'var(--border-strong)'}`,
      background: q.past ? 'var(--bg-blue-tint)' : 'transparent',
      color: q.isOpen ? 'var(--text-red-700)' : q.past ? 'var(--text-base)' : 'var(--text-muted)',
    }
  }

  if (narrow) {
    // A phone: the weeks stack as rows of a small calendar; a quiet week is one row.
    return (
      <div style={{ display: 'grid', gap: '0.45rem', minWidth: 0 }}>
        {summary}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr)) repeat(2, minmax(0, 0.55fr))', gap: 4 }}>
          {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((h) => (
            <span key={h} style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textAlign: 'center', fontWeight: 700 }}>{h}</span>
          ))}
          {calendar.weeks.map((week) =>
            weekIsQuiet(week) ? (
              <Fragment key={week[0]?.on}>
                <div style={{ gridColumn: '1 / 6', ...quietBox(week, true) }} title={`${workWeekRange(week)}: ${quietWords(week).words}`}>
                  {workWeekRange(week)} · {quietWords(week).words}
                </div>
                {week.filter((d) => d.weekend).map((d) => (
                  <QuietWeekend key={d.on} d={d} sz={sz} full />
                ))}
              </Fragment>
            ) : (
              week.map((d) => <DaySquare key={d.on} d={d} openEnd={Boolean(openEnd) && d.inStage && !d.past && !d.today} narrow />)
            ),
          )}
        </div>
        {/* A phone has no hover: the days that matter are listed under the calendar. */}
        <div style={{ display: 'grid', gap: '0.15rem', fontSize: '0.8rem' }}>
          {calendar.weeks.flat().filter((d) => d.inStage && d.label).map((d) => (
            <span key={d.on} style={{ color: d.today ? 'var(--text-blue-500)' : d.deadline === 'due' ? 'var(--text-red-700)' : d.deadline === 'close' ? 'var(--text-amber-700)' : 'var(--text-base)' }}>
              <b style={{ fontVariantNumeric: 'tabular-nums' }}>{weekdayDate(d.on)}</b> · {d.label?.replace(' · ', ', ')}
            </span>
          ))}
          {openEnd && <span style={{ color: 'var(--text-red-700)', fontWeight: 700 }}>{openEnd}</span>}
        </div>
        {legend}
      </div>
    )
  }
  return (
    <div style={{ display: 'grid', gap: '0.45rem', minWidth: 0 }}>
      {summary}
      <div ref={scroller} style={{ overflowX: 'auto', paddingBottom: 4, paddingTop: 8 }}>
        <div style={{ display: 'flex', gap: sz.week, width: 'max-content', alignItems: 'flex-start' }}>
          {calendar.weeks.map((week) => {
            const head = (
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', whiteSpace: 'nowrap', height: 14 }}>
                {weekIsQuiet(week) ? '' : weekRange(week)}
              </span>
            )
            if (weekIsQuiet(week)) {
              const q = quietWords(week)
              return (
                <div key={week[0]?.on} style={{ display: 'grid', gap: 3, width: quietWeekWidth(sz) }}>
                  {head}
                  <span style={{ height: 12 }} />
                  {/* The rectangle is Monday to Friday; the weekend stands beside it as it does in a busy week (the owner, 2026-10-05). */}
                  <div style={{ display: 'flex', gap: sz.gap }}>
                    <div style={quietBox(week, false)} title={`${workWeekRange(week)}: ${q.words}`} aria-label={`${workWeekRange(week)}: ${q.words}`}>
                      {workWeekRange(week)}
                    </div>
                    {week.filter((d) => d.weekend).map((d) => (
                      <QuietWeekend key={d.on} d={d} sz={sz} full={false} />
                    ))}
                  </div>
                  <span style={{ height: LANE_HEIGHT, fontSize: '0.66rem', textAlign: 'center', fontWeight: q.isOpen ? 700 : 500, color: q.isOpen ? 'var(--text-red-700)' : 'var(--text-muted)' }}>{q.words}</span>
                </div>
              )
            }
            const labels = laneLabels(week, sz)
            return (
              <div key={week[0]?.on} style={{ display: 'grid', gap: 3 }}>
                {head}
                {/* The weekday over each square, so a number reads as a day. */}
                <div style={{ display: 'flex', gap: sz.gap }} aria-hidden>
                  {week.map((d, i) => (
                    <span key={d.on} style={{ width: d.weekend ? sz.weekend : sz.day, textAlign: 'center', fontSize: '0.62rem', fontWeight: 700, color: d.today ? 'var(--text-blue-500)' : 'var(--text-muted)' }}>
                      {'MTWTFSS'[i]}
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: sz.gap }}>
                  {week.map((d) => (
                    <DaySquare key={d.on} d={d} openEnd={Boolean(openEnd) && d.inStage && !d.past && !d.today} narrow={false} sz={sz} />
                  ))}
                </div>
                {/* Labels in their own lane: they never move a square, and two that would touch take two lines. */}
                <div style={{ position: 'relative', height: Math.max(LANE_HEIGHT, ...labels.map((l) => (l.row + l.lines.length) * 14 + 2)) }}>
                  {labels.map((l) => (
                    <span key={l.on} style={{ position: 'absolute', top: l.row * 14, left: l.left, width: l.width, textAlign: 'center', fontSize: '0.66rem', lineHeight: 1.15, fontWeight: 700, whiteSpace: 'nowrap', color: l.color }}>
                      {l.lines.map((line) => (
                        <span key={line} style={{ display: 'block' }}>
                          {line}
                        </span>
                      ))}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      {legend}
    </div>
  )
}
