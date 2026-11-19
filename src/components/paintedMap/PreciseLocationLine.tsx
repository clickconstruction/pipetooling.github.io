/**
 * The line that says how the phone's location is doing, wherever a painted map reads it: on, a
 * weak signal, or a rough area with the steps to the switch for this phone. It is there in every
 * state, so a person is told they are set and not only told when something is wrong. The words and
 * the thresholds are `preciseLocation.ts`.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { PAINT_ROUGH_FIX_METERS } from '../../lib/paintedMap/paintedTrack'
import { PRECISE_ALREADY_ON_WORDS, PRECISE_ROUGH_HOLD_MS, phoneKindOf, preciseSteps, preciseSwitchName, preciseWords, roughCompareWords, type PhoneKind, type PreciseWords } from '../../lib/paintedMap/preciseLocation'

/** Which phone this is, read once. */
export function usePhoneKind(): PhoneKind {
  return useMemo(() => {
    if (typeof navigator === 'undefined') return 'other'
    let standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
    try {
      standalone = standalone || window.matchMedia('(display-mode: standalone)').matches
    } catch {
      // A browser with no media queries is not a Home Screen app.
    }
    return phoneKindOf({ userAgent: navigator.userAgent, standalone, touchPoints: navigator.maxTouchPoints })
  }, [])
}

/**
 * The words for the newest margin. A rough reading is held as *Finding you…* for a few seconds
 * first: a phone with the switch on can open with one off a cell tower, and a better one follows.
 */
export function usePreciseWords(accuracyM: number | null | undefined): PreciseWords & { kind: PhoneKind } {
  const kind = usePhoneKind()
  const rough = typeof accuracyM === 'number' && accuracyM > PAINT_ROUGH_FIX_METERS
  const roughSince = useRef<number | null>(null)
  const [, setTick] = useState(0)
  if (!rough) roughSince.current = null
  else if (roughSince.current == null) roughSince.current = Date.now()
  useEffect(() => {
    if (!rough) return
    const t = window.setTimeout(() => setTick((n) => n + 1), PRECISE_ROUGH_HOLD_MS + 50)
    return () => window.clearTimeout(t)
  }, [rough])
  const roughForMs = roughSince.current == null ? 0 : Date.now() - roughSince.current
  return { ...preciseWords(accuracyM, kind, roughForMs), kind }
}

const GREEN = '#16a34a'
const AMBER = '#d97706'
const amberBox: CSSProperties = { margin: 0, fontSize: '0.875rem', color: 'var(--text-amber-800)', background: 'var(--bg-amber-tint)', border: '1px solid var(--border-amber)', borderRadius: 8, padding: '0.55rem 0.7rem' }

/** A tick in a disc: the phone is set. */
export function Tick() {
  return (
    <svg aria-hidden width="18" height="18" viewBox="0 0 18 18" style={{ flex: 'none' }}>
      <circle cx="9" cy="9" r="9" fill={GREEN} />
      <path d="M5 9.4l2.6 2.6L13 6.6" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** The steps to the switch, numbered, for this phone. */
export function PreciseSteps({ kind }: { kind: PhoneKind }) {
  const steps = preciseSteps(kind)
  return (
    <>
      <ol data-precise-steps style={{ margin: '0.45rem 0 0', paddingLeft: '1.25rem', display: 'grid', gap: '0.2rem' }}>
        {steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      <p style={{ margin: '0.45rem 0 0', fontSize: '0.8125rem' }}>{PRECISE_ALREADY_ON_WORDS}</p>
    </>
  )
}

type Props = {
  /** The newest reading's margin, or null while there is none. */
  accuracyM: number | null | undefined
  /** Said after the words while the signal is weak: what this screen does about it. */
  weakNote?: ReactNode
  /** Said after the words while the reading is rough: what this screen cannot do with it. */
  roughNote?: ReactNode
}

export function PreciseLocationLine({ accuracyM, weakNote, roughNote }: Props) {
  return <PreciseLineView words={usePreciseWords(accuracyM)} accuracyM={accuracyM} weakNote={weakNote} roughNote={roughNote} />
}

/** The line drawn from words a caller already holds, for a screen that also branches on the state. */
export function PreciseLineView({ words, accuracyM, weakNote, roughNote }: { words: PreciseWords & { kind: PhoneKind }; accuracyM?: number | null; weakNote?: ReactNode; roughNote?: ReactNode }) {
  const compare = words.state === 'rough' && words.kind !== 'other' ? roughCompareWords(accuracyM) : null
  if (words.state === 'finding') {
    return (
      <p role="status" data-precise="finding" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
        <span aria-hidden style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--border-strong)', flex: 'none' }} />
        <span>
          <b>{words.lead}</b> {words.tail}
        </span>
      </p>
    )
  }
  if (words.state === 'on') {
    return (
      <p role="status" data-precise="on" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.9375rem', color: 'var(--text-green-700)' }}>
        <Tick />
        <span>
          <b>{words.lead}</b> {words.tail}
        </span>
      </p>
    )
  }
  if (words.state === 'weak') {
    return (
      <p role="status" data-precise="weak" style={{ ...amberBox, display: 'flex', gap: '0.45rem' }}>
        <span aria-hidden style={{ width: 10, height: 10, borderRadius: '50%', background: AMBER, flex: 'none', marginTop: 5 }} />
        <span>
          <b>{words.lead}</b> {words.tail} {weakNote}
        </span>
      </p>
    )
  }
  return (
    <div role="alert" data-precise="rough" style={amberBox}>
      <b>{words.lead}</b>
      {compare ? (
        <dl data-precise-compare style={{ margin: '0.4rem 0', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.15rem 0.75rem', background: 'var(--surface)', border: '1px solid var(--border-amber)', borderRadius: 6, padding: '0.4rem 0.6rem', color: 'var(--text-strong)' }}>
          <dt>Your phone now</dt>
          <dd style={{ margin: 0, fontWeight: 700 }}>{compare.now}</dd>
          <dt>With {preciseSwitchName(words.kind)} on</dt>
          <dd style={{ margin: 0, fontWeight: 700, color: 'var(--text-green-700)' }}>{compare.withItOn}</dd>
        </dl>
      ) : (
        <> {words.tail} </>
      )}
      {roughNote}
      <PreciseSteps kind={words.kind} />
    </div>
  )
}
