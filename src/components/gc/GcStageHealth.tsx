import { useEffect, useMemo, useRef, useState, type CSSProperties, type Dispatch } from 'react'
import {
  daysBetween,
  shortDate,
  stageHealth,
  type GcAction,
  type GcProject,
  type GcState,
  type HealthMark,
  type HealthTab,
  type HealthTile,
  type StageHealth,
  type TileDot,
  type TileState,
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

      <Clock health={health} width={width} />
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
        gap: '0.2rem',
        background: tile.state === 'bad' ? 'var(--bg-red-tint)' : 'var(--bg-subtle)',
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.4rem', alignItems: 'center', fontWeight: 700, fontSize: '0.84rem' }}>
        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={tile.trade}>
          {tile.trade}
        </span>
        {tile.dots ? (
          <span style={{ display: 'inline-flex', gap: 3, flexShrink: 0 }} aria-label={tile.dots.join(', ')}>
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

/** The stage's clock: its first and last day, each mark, and today. Labels that would collide are left to the hover. */
function Clock({ health, width }: { health: StageHealth; width: number }) {
  const { from, to, today, marks, openWords } = health.clock
  // An open clock (no last day yet) puts today about two thirds along, with the rest dashed.
  const end = to ?? (() => {
    const used = Math.max(1, daysBetween(from, today))
    const d = new Date(`${from}T12:00:00Z`)
    d.setUTCDate(d.getUTCDate() + Math.round(used / 0.64))
    return d.toISOString().slice(0, 10)
  })()
  const span = Math.max(1, daysBetween(from, end))
  const at = (on: string) => Math.min(100, Math.max(0, (daysBetween(from, on) / span) * 100))
  const todayAt = at(today)
  type Label = { pct: number; text: string; color: string; weight: number; align: 'start' | 'center' | 'end'; priority: number }
  const color = (m: HealthMark) => (m.kind === 'late' ? 'var(--text-red-700)' : m.kind === 'end' ? 'var(--text-base)' : 'var(--text-muted)')
  const labels: Label[] = [
    { pct: todayAt, text: `Today · ${shortDate(today)}`, color: 'var(--text-blue-500)', weight: 700, align: 'center', priority: 0 },
    ...marks.map((m) => ({
      pct: at(m.on),
      text: `${shortDate(m.on)} · ${m.label}${m.kind === 'met' ? ' ✓' : ''}`,
      color: color(m),
      weight: m.kind === 'end' || m.kind === 'late' ? 700 : 500,
      align: (m.kind === 'start' ? 'start' : m.kind === 'end' ? 'end' : 'center') as Label['align'],
      priority: m.kind === 'end' ? 1 : m.kind === 'start' ? 2 : m.kind === 'late' ? 3 : 4,
    })),
    ...(to === null && openWords ? [{ pct: 100, text: openWords, color: 'var(--text-red-700)', weight: 700, align: 'end' as const, priority: 1 }] : []),
  ]
  // Lay the labels out above and below the line, most important first; one that fits nowhere keeps its mark and hover.
  const placed: (Label & { row: 0 | 1 })[] = []
  const extent = (l: Label) => {
    const w = (l.text.length * 6.3 + 8) / Math.max(1, width) * 100
    const left = l.align === 'start' ? l.pct : l.align === 'end' ? l.pct - w : l.pct - w / 2
    return [Math.max(0, left), Math.min(100, left + w)] as const
  }
  for (const l of [...labels].sort((a, b) => a.priority - b.priority)) {
    const [a, b] = extent(l)
    for (const row of [0, 1] as const) {
      const clash = placed.some((p) => p.row === row && (() => {
        const [c, d] = extent(p)
        return a < d && c < b
      })())
      if (!clash) {
        placed.push({ ...l, row })
        break
      }
    }
  }
  const labelStyle = (l: Label & { row: 0 | 1 }): CSSProperties => ({
    position: 'absolute',
    top: l.row === 0 ? 0 : 46,
    left: `${l.pct}%`,
    transform: l.align === 'start' ? 'none' : l.align === 'end' ? 'translateX(-100%)' : 'translateX(-50%)',
    whiteSpace: 'nowrap',
    fontSize: '0.72rem',
    color: l.color,
    fontWeight: l.weight,
  })
  return (
    <div
      role="img"
      aria-label={[`Today ${shortDate(today)}`, ...marks.map((m) => `${m.label} ${shortDate(m.on)}`), ...(to === null && openWords ? [openWords] : [])].join(', ')}
      style={{ position: 'relative', height: 62, margin: '0 0.25rem' }}
    >
      <span style={{ position: 'absolute', left: 0, right: to === null ? `${100 - todayAt - 2}%` : 0, top: 29, height: 6, borderRadius: 999, background: 'var(--bg-muted)' }} />
      {to === null && (
        <span style={{ position: 'absolute', left: `${todayAt + 2}%`, right: 0, top: 29, height: 6, borderTop: `2px dashed ${TILE.bad}`, borderBottom: `2px dashed ${TILE.bad}`, boxSizing: 'border-box' }} />
      )}
      <span style={{ position: 'absolute', left: 0, width: `${todayAt}%`, top: 29, height: 6, borderRadius: 999, background: 'var(--text-blue-500)', opacity: 0.5 }} />
      {marks.map((m) => (
        <span
          key={`${m.on}-${m.label}`}
          title={`${m.label}, ${shortDate(m.on)}`}
          style={{
            position: 'absolute',
            left: `${at(m.on)}%`,
            top: 22,
            width: 2,
            height: 20,
            transform: 'translateX(-1px)',
            background: m.kind === 'late' ? TILE.bad : m.kind === 'met' ? TILE.good : m.kind === 'end' ? 'var(--text-base)' : 'var(--text-muted)',
          }}
        />
      ))}
      <span title={`Today, ${shortDate(today)}`} style={{ position: 'absolute', left: `${todayAt}%`, top: 18, width: 3, height: 28, transform: 'translateX(-1px)', background: 'var(--text-blue-500)', borderRadius: 2 }} />
      {placed.map((l) => (
        <span key={l.text} style={labelStyle(l)}>
          {l.text}
        </span>
      ))}
    </div>
  )
}
