/**
 * The document builder's slider (punch list #404, the flow of #389): a paper's stops on one track, Off on
 * the left and the strictest level on the right. The handle glides under the thumb and the setting
 * follows it to the nearest stop while it is dragged, so the page above changes mid-drag. On release
 * the handle rests on its stop. Each stop's name is also a press.
 *
 * The same slider sets one topic and the whole paper's basis. On a topic it also shows the basis: a
 * ring on the track and the word *Basis* under that stop, so how far a page sits off the basis is
 * seen and not said, and a press on that stop is the way back. A stop left of `floor` cannot be
 * picked, and `floorWhy` says why.
 */
import { useEffect, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { levelInk, levelTone } from './levelTone'
import { PAPER_OFF, paperStops, stopAt, stopPercent, stopRank, stopShortName, type PaperDef, type PaperStop } from '../../lib/documentBuilder/documentBuilder'

/** The handle is this wide, so a stop's centre sits a little inside the track's ends. */
const HANDLE_PX = 22
/** The track's units between two stops: enough for the handle to glide. */
const UNIT = 100

const CHIPS: Array<{ background: string; color: string }> = [
  { background: 'var(--bg-blue-tint)', color: 'var(--text-blue-700)' },
  { background: 'var(--bg-teal-tint)', color: 'var(--text-teal-700)' },
  { background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)' },
  { background: 'var(--bg-red-tint)', color: 'var(--text-red-700)' },
]
const QUIET_CHIP = { background: 'var(--bg-muted)', color: 'var(--text-700)' }

const CHIP: CSSProperties = { display: 'inline-flex', alignItems: 'center', borderRadius: 999, padding: '1px 9px', fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap', transition: 'background-color 180ms, color 180ms' }

/** A chip in a level's colour. `stop` picks the colour; without one the chip is grey. */
export function LevelChip({ def, stop, children, wrap = false }: { def: PaperDef; stop?: PaperStop; children: string; wrap?: boolean }) {
  const look = stop == null || stop === PAPER_OFF ? QUIET_CHIP : (CHIPS[Math.min(CHIPS.length - 1, Math.max(0, stopRank(def, stop) - 1))] ?? QUIET_CHIP)
  return <span style={{ ...CHIP, ...look, ...(wrap ? { whiteSpace: 'normal', borderRadius: 10 } : null) }}>{children}</span>
}

/** Four small bars that grow, as many lit as the level is strict. */
export function LevelBars({ def, stop }: { def: PaperDef; stop: PaperStop }) {
  const lit = stopRank(def, stop)
  return (
    <span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'flex-end', gap: 2, height: 18, flex: '0 0 auto' }}>
      {def.levels.map((l, i) => (
        <span key={l.id} style={{ display: 'block', width: 4, height: 6 + i * 4, borderRadius: 2, background: i < lit ? levelTone(def, stop) : 'var(--bg-200)' }} />
      ))}
    </span>
  )
}

function along(percent: number): string {
  return `calc(${percent}% + ${(HANDLE_PX / 2 - (percent * HANDLE_PX) / 100).toFixed(2)}px)`
}

/**
 * A topic's level as a small still track, for a list: a dot at its stop in the level's colour and a
 * tick where the basis sits. Rows of these line up, so the ticks read as one line down the list and
 * a dot off that line is a page off the basis.
 */
export function LevelTrack({ def, stop, basis, width = 96 }: { def: PaperDef; stop: PaperStop; basis: PaperStop; width?: number }) {
  const off = stop === PAPER_OFF
  return (
    <span aria-hidden="true" style={{ position: 'relative', display: 'block', width, height: 16, flex: '0 0 auto' }}>
      <span style={{ position: 'absolute', left: 5, right: 5, top: 7, height: 2, borderRadius: 2, background: 'var(--bg-200)' }} />
      <span style={{ position: 'absolute', left: 5, right: 5, top: 0, bottom: 0 }}>
        <span style={{ position: 'absolute', left: `${stopPercent(def, basis)}%`, top: 0, bottom: 0, width: 2, marginLeft: -1, borderRadius: 1, background: 'var(--border-strong)' }} />
        <span
          style={{
            position: 'absolute',
            left: `${stopPercent(def, stop)}%`,
            top: 3,
            width: 10,
            height: 10,
            marginLeft: -5,
            borderRadius: '50%',
            boxSizing: 'border-box',
            background: off ? 'var(--surface)' : levelTone(def, stop),
            border: `2px solid ${off ? 'var(--text-muted)' : levelTone(def, stop)}`,
            transition: 'left 220ms ease',
          }}
        />
      </span>
    </span>
  )
}

export function DocumentBuilderSlider({
  def,
  value,
  label,
  onPick,
  floor = 0,
  floorWhy = '',
  basis,
  id,
}: {
  def: PaperDef
  value: PaperStop
  /** What the slider sets, for a screen reader: the topic's name. */
  label: string
  onPick: (stop: PaperStop) => void
  /** The loosest place the handle can sit. */
  floor?: number
  floorWhy?: string
  /** The paper's basis, marked on the track. Left out on the slider that sets the basis itself. */
  basis?: PaperStop
  id?: string
}) {
  const stops = paperStops(def)
  const last = stops.length - 1
  const rank = Math.max(0, stopRank(def, value))
  // Where the handle is while it is held, in track units. Null once it is let go: it then rests on its stop.
  const [held, setHeld] = useState<number | null>(null)
  const letGo = () => setHeld(null)
  // A handle left behind by a release the browser never reported goes back to its stop.
  useEffect(() => {
    setHeld((h) => (h != null && Math.round(h / UNIT) !== rank ? null : h))
  }, [rank])

  const shown = held ?? rank * UNIT
  const tone = levelTone(def, value)
  const pick = (to: number) => {
    letGo()
    onPick(stopAt(def, Math.max(floor, to)))
  }
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const to = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? rank + 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? rank - 1 : e.key === 'Home' ? floor : e.key === 'End' ? last : null
    if (to == null) return
    e.preventDefault()
    pick(Math.min(last, to))
  }
  const showRing = basis != null && basis !== value
  return (
    <div style={{ display: 'grid', minWidth: 0 }}>
      <div style={{ position: 'relative' }}>
        <input
          id={id}
          className="documentBuilderSlider"
          type="range"
          min={0}
          max={last * UNIT}
          step={1}
          value={shown}
          aria-label={label}
          aria-valuetext={stopShortName(def, value)}
          onChange={(e) => {
            const at = Math.max(floor * UNIT, Number(e.target.value))
            setHeld(at)
            const stop = stopAt(def, at / UNIT)
            if (stop !== value) onPick(stop)
          }}
          onKeyDown={onKeyDown}
          onPointerUp={letGo}
          onPointerCancel={letGo}
          onTouchEnd={letGo}
          onBlur={letGo}
          style={{ ['--builder-tone' as string]: tone, ['--builder-fill' as string]: along((shown / (last * UNIT)) * 100) }}
        />
        {basis != null ? (
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: along(stopPercent(def, basis)),
              top: '50%',
              width: 14,
              height: 14,
              marginLeft: -7,
              marginTop: -7,
              borderRadius: '50%',
              boxSizing: 'border-box',
              background: 'var(--surface)',
              border: `3px solid ${levelTone(def, basis)}`,
              pointerEvents: 'none',
              opacity: showRing ? 1 : 0,
              transition: 'opacity 160ms',
            }}
          />
        ) : null}
      </div>
      {/* A stop is a press, so its row is 44 px with or without the word *Basis* under a stop. */}
      <div style={{ position: 'relative', height: 44 }}>
        {stops.map((stop, i) => {
          const dead = i < floor
          const on = stop === value
          const isBasis = basis != null && stop === basis
          const place: CSSProperties = i === 0 ? { left: 0, alignItems: 'flex-start' } : i === last ? { right: 0, alignItems: 'flex-end' } : { left: along(stopPercent(def, stop)), transform: 'translateX(-50%)', alignItems: 'center' }
          return (
            <button
              key={stop}
              type="button"
              disabled={dead}
              title={dead ? floorWhy : undefined}
              aria-label={isBasis ? `${stopShortName(def, stop)}, the basis` : undefined}
              aria-current={on ? 'true' : undefined}
              onClick={() => pick(i)}
              style={{
                position: 'absolute',
                top: 0,
                ...place,
                display: 'flex',
                flexDirection: 'column',
                border: 0,
                background: 'none',
                padding: '4px 0',
                minHeight: 44,
                fontFamily: 'inherit',
                fontSize: '0.78rem',
                lineHeight: 1.3,
                whiteSpace: 'nowrap',
                color: on ? 'var(--text-strong)' : 'var(--text-muted)',
                fontWeight: on ? 700 : 400,
                opacity: dead ? 0.5 : 1,
                cursor: dead ? 'not-allowed' : 'pointer',
              }}
            >
              <span>{stopShortName(def, stop)}</span>
              {isBasis ? <span style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: levelInk(def, stop) }}>Basis</span> : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
