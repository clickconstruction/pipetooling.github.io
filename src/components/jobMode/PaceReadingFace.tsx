import { useEffect, useState, type CSSProperties } from 'react'
import { PACE_CARD_WORDS } from '../../lib/jobMode/paceCard'
import { PACE_READING_WORDS as W, paceWhatSeenKey, type PaceReading, type PaceReadingBars, type PaceReadingTone } from '../../lib/jobMode/paceReading'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { PHONE_PRESS_MIN_HEIGHT } from '../../lib/phonePress'
import { ValueSentence } from '../valuesInPlace/ValuesInPlace'

/**
 * Job pace, the card's face (the owner's walk of 2026-11-20; `lib/jobMode/paceReading.ts` has the rules and
 * every word). The card's name, a headline that says what is ahead of what, and the two things it compares
 * drawn one over the other on one scale: **Hours used** and **Work done**. The hatched end of the hours bar is
 * the gap, so the gap is seen and not worked out. Under the bars, one sentence of why and the press that
 * answers it.
 *
 * Presentational: the kernel works out the state, the words and the bar lengths.
 */

const BLUE = '#2563eb'
const RED = '#dc2626'
const AMBER = '#d97706'

const HEAD_COLOR: Record<PaceReadingTone, string> = { red: 'var(--text-red-700)', amber: 'var(--text-amber-800)', green: 'var(--text-green-700)', calm: 'var(--text-700)' }

const NAME: CSSProperties = { fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const LINE: CSSProperties = { fontSize: '0.9rem', minWidth: 0 }
const LOUD: CSSProperties = { flex: 1, minHeight: PHONE_PRESS_MIN_HEIGHT, padding: '0 0.75rem', borderRadius: 8, border: 'none', background: BLUE, color: '#fff', fontFamily: 'inherit', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' }
const QUIET: CSSProperties = { flex: 1, minHeight: PHONE_PRESS_MIN_HEIGHT, padding: '0 0.75rem', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', fontFamily: 'inherit', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer' }
const TRACK: CSSProperties = { display: 'block', height: 16, borderRadius: 8, background: 'var(--border)', position: 'relative', overflow: 'hidden' }
const PART: CSSProperties = { position: 'absolute', top: 0, bottom: 0 }
const ROW: CSSProperties = { display: 'grid', gridTemplateColumns: '5.4rem minmax(0, 1fr) auto', columnGap: 8, rowGap: 2, alignItems: 'center' }
const hatch = (color: string, tint: string): string => `repeating-linear-gradient(135deg, ${color} 0 4px, transparent 4px 8px), ${tint}`

function PacePair({ bars, tone }: { bars: PaceReadingBars; tone: PaceReadingTone }) {
  const gapColor = tone === 'amber' ? AMBER : RED
  const gapTint = tone === 'amber' ? 'var(--bg-amber-tint)' : 'var(--bg-red-tint)'
  return (
    <div data-testid="pace-pair" style={{ display: 'grid', gap: 8 }}>
      <div style={ROW}>
        <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{W.hoursLabel}</span>
        <span style={TRACK} data-testid="pace-pair-hours" data-fill={Math.round(bars.hoursFill)} data-gap={Math.round(bars.gapWidth)}>
          <span style={{ ...PART, left: 0, width: `${bars.hoursFill}%`, background: 'var(--text-muted)' }} />
          {bars.gapWidth > 0 ? <span style={{ ...PART, left: `${bars.gapFrom}%`, width: `${bars.gapWidth}%`, background: hatch(gapColor, gapTint) }} /> : null}
        </span>
        <b style={{ fontSize: '0.95rem', fontVariantNumeric: 'tabular-nums', textAlign: 'right', minWidth: '2.6rem' }}>{bars.hoursPct}%</b>
        <span />
        <span style={{ gridColumn: '2 / 4', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{bars.hoursWords}</span>
      </div>
      <div style={ROW}>
        <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{W.workLabel}</span>
        <span style={TRACK} data-testid="pace-pair-work" data-fill={bars.workPct} data-old={bars.workOld ? '' : undefined}>
          <span style={{ ...PART, left: 0, width: `${bars.workPct}%`, background: bars.workOld ? `repeating-linear-gradient(90deg, ${BLUE} 0 6px, transparent 6px 10px)` : BLUE }} />
        </span>
        <b style={{ fontSize: '0.95rem', fontVariantNumeric: 'tabular-nums', textAlign: 'right', minWidth: '2.6rem' }}>{bars.workPct}%</b>
        {bars.workWords ? (
          <>
            <span />
            <span style={{ gridColumn: '2 / 4', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{bars.workWords}</span>
          </>
        ) : null}
      </div>
    </div>
  )
}

export function PaceReadingFace({ reading, onSetPct, onStill, stillBusy = false }: {
  reading: PaceReading
  onSetPct: () => void
  /** **Still 40%**: say the same percent again today. */
  onStill: () => void
  stillBusy?: boolean
}) {
  return (
    <div data-testid="pace-reading" data-state={reading.state} data-tone={reading.tone} style={{ display: 'grid', gap: 10, minWidth: 0 }}>
      <div style={NAME} data-testid="pace-name">{W.name}</div>
      <div data-testid="pace-headline" style={{ fontSize: '1.1rem', fontWeight: 700, lineHeight: 1.25, color: HEAD_COLOR[reading.tone] }}>{reading.headline}</div>
      {reading.bars ? <PacePair bars={reading.bars} tone={reading.tone} /> : null}
      {reading.lines.map((line, i) => (
        <div key={i} style={{ ...LINE, display: 'flex', alignItems: 'center', gap: 6 }} data-testid="pace-line">
          {reading.state === 'over' && i === 0 ? <span aria-hidden="true" title={W.gapKey} style={{ flex: 'none', width: 18, height: 10, borderRadius: 3, background: hatch(RED, 'var(--bg-red-tint)') }} /> : null}
          <span style={{ minWidth: 0 }}><ValueSentence text={line} /></span>
        </div>
      ))}
      {reading.setPctAsk != null ? (
        <div style={{ display: 'grid', gap: 6 }}>
          {reading.setPctAsk ? <div style={{ ...LINE, fontWeight: 600 }}><ValueSentence text={reading.setPctAsk} /></div> : null}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" data-testid="pace-set-pct" onClick={onSetPct} style={LOUD}>{PACE_CARD_WORDS.setPct}</button>
            {reading.stillPct != null ? (
              <button type="button" data-testid="pace-still" disabled={stillBusy} onClick={onStill} style={stillBusy ? { ...QUIET, background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, cursor: 'default' } : QUIET}>
                {W.still(reading.stillPct)}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function readSeen(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === '1'
  } catch {
    return true
  }
}

/**
 * **What is this?** The fold that says what the card compares and why. It opens by itself the first time a
 * person sees the card on this phone, and stays folded after that. A phone that keeps nothing never opens it by
 * itself, so it cannot open on every visit.
 */
export function PaceWhatFold({ userId }: { userId: string | null | undefined }) {
  const key = paceWhatSeenKey(userId)
  const [open, setOpen] = useState(() => !readSeen(key))
  useEffect(() => {
    try {
      window.localStorage.setItem(key, '1')
    } catch {
      // A phone that keeps nothing: the fold still opens on a press.
    }
  }, [key])
  return (
    <div style={{ display: 'grid', gap: 6, borderTop: '1px solid var(--border)', paddingTop: 4 }}>
      <button type="button" data-testid="pace-what" aria-expanded={open} onClick={() => setOpen((o) => !o)} style={{ justifySelf: 'start', minHeight: PHONE_PRESS_MIN_HEIGHT, padding: 0, border: 'none', background: 'none', color: 'var(--text-link)', fontFamily: 'inherit', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
        {W.what} {open ? '▴' : '▾'}
      </button>
      {open ? (
        <ol data-testid="pace-what-body" style={{ margin: 0, padding: '0 0 4px 1.2em', display: 'grid', gap: 5, fontSize: '0.85rem' }}>
          {W.whatLines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
      ) : null}
    </div>
  )
}

export default PaceReadingFace
