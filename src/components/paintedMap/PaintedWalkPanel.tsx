/**
 * Painting a walk: what the person reads and presses while the phone is being followed (punch list
 * #345). The length so far sits over the line that says how the phone's location is doing, and the
 * line is there in every state while the phone is read (#402): finding, on, a weak signal, or a
 * rough area with the way to the switch. Every pause says why, and a refusal always offers drawing
 * by hand, which needs no location.
 */
import type { CSSProperties } from 'react'
import { usePhoneKind } from '../../hooks/usePreciseLocation'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { aboutLengthWords } from '../../lib/paintedMap/paintedMap'
import { canResumeWalk, walkSure, type WalkState } from '../../lib/paintedMap/paintedWalk'
import { WALK_CANNOT_STAY_AWAKE_WORDS, WALK_ROUGH_NOTE_WORDS, WALK_WEAK_NOTE_WORDS, walkPausedWords, walkRefusalWords, type WalkRefusal } from '../../lib/paintedMap/paintedWalkWords'
import { preciseStateOf } from '../../lib/paintedMap/preciseLocation'
import { PreciseLocationLine } from './PreciseLocationLine'

type Props = {
  state: WalkState
  refusal: WalkRefusal | null
  awake: 'held' | 'cannot' | 'off'
  /** The readings have stayed rough for the wait (`useRoughHeld`). The window counts it once, for this panel and for the map beside it. */
  roughHeld: boolean
  /** The walk's length so far, in metres, with what was painted before this stroke. */
  lengthM: number
  placeCount: number
  /** There is a line to look over. */
  hasLine: boolean
  onPlace: () => void
  onPause: () => void
  onResume: (join: boolean) => void
  onTryAgain: () => void
  onDone: () => void
  onDrawInstead: () => void
}

const press: CSSProperties = { minHeight: 48, padding: '0 0.9rem', borderRadius: 8, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', fontFamily: 'inherit', fontWeight: 700, fontSize: '0.9375rem', cursor: 'pointer', flex: '1 1 0' }
const bluePress: CSSProperties = { ...press, background: '#2563eb', borderColor: '#2563eb', color: '#fff' }
const redPress: CSSProperties = { ...press, background: '#dc2626', borderColor: '#dc2626', color: '#fff' }
const deadPress: CSSProperties = { ...press, background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, borderColor: 'var(--border)', cursor: 'default' }
const amber: CSSProperties = { margin: 0, fontSize: '0.875rem', color: 'var(--text-amber-800)', background: 'var(--bg-amber-tint)', border: '1px solid var(--border-amber)', borderRadius: 8, padding: '0.5rem 0.65rem' }

export function PaintedWalkPanel({ state, refusal, awake, roughHeld, lengthM, placeCount, hasLine, onPlace, onPause, onResume, onTryAgain, onDone, onDrawInstead }: Props) {
  const kind = usePhoneKind()
  const { accuracyM } = walkSure(state)
  const painting = state.status === 'painting'
  const doneStyle = hasLine || placeCount > 0 ? bluePress : deadPress

  if (refusal) {
    return (
      <div data-painted-walk="refused" style={{ display: 'grid', gap: '0.6rem' }}>
        <p role="alert" style={amber}>{walkRefusalWords(refusal)}</p>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {refusal === 'none' ? null : (
            <button type="button" style={press} onClick={onTryAgain}>Try again</button>
          )}
          <button type="button" style={bluePress} onClick={onDrawInstead}>Draw it by hand instead</button>
        </div>
        {hasLine ? <button type="button" style={press} onClick={onDone}>Look over what was painted</button> : null}
      </div>
    )
  }

  // A rough reading is called rough only once the readings have stayed rough. Until then the line says it is still finding you.
  if (painting && preciseStateOf(accuracyM, roughHeld) === 'rough') {
    return (
      <div data-painted-walk="rough" style={{ display: 'grid', gap: '0.6rem' }}>
        <PreciseLocationLine accuracyM={accuracyM} kind={kind} roughHeld roughNote={WALK_ROUGH_NOTE_WORDS} />
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" style={press} onClick={onPause}>Pause</button>
          <button type="button" style={bluePress} onClick={onDrawInstead}>Draw it by hand instead</button>
        </div>
      </div>
    )
  }

  const readout = (
    <div data-painted-walk-readout style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '0.15rem 0.75rem' }}>
      <span style={{ fontSize: '1.3rem', fontWeight: 700 }}>{hasLine ? aboutLengthWords(lengthM) : 'A new line'}</span>
      <span style={{ fontSize: '0.875rem', color: 'var(--text-700)' }}>
        {hasLine ? 'so far' : 'start walking'}
        {placeCount > 0 ? ` · ${placeCount} place${placeCount === 1 ? '' : 's'}` : ''}
      </span>
    </div>
  )

  if (painting) {
    return (
      <div data-painted-walk="painting" style={{ display: 'grid', gap: '0.6rem' }}>
        {readout}
        <PreciseLocationLine accuracyM={accuracyM} kind={kind} roughHeld={roughHeld} weakNote={WALK_WEAK_NOTE_WORDS} />
        {awake === 'cannot' ? <p role="status" style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{WALK_CANNOT_STAY_AWAKE_WORDS}</p> : null}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="button" data-painted-walk-place style={press} onClick={onPlace}>＋ Place</button>
          <button type="button" data-painted-walk-pause style={press} onClick={onPause}>Pause</button>
          <button type="button" data-painted-walk-done style={doneStyle} disabled={!hasLine && placeCount === 0} onClick={onDone}>Done</button>
        </div>
      </div>
    )
  }

  const words = walkPausedWords(state)
  const resumable = canResumeWalk(state)
  return (
    <div data-painted-walk={`paused-${state.pausedWhy ?? 'press'}`} style={{ display: 'grid', gap: '0.6rem' }}>
      {readout}
      <p role="status" style={state.pausedWhy === 'press' ? { margin: 0, fontSize: '0.9375rem', color: 'var(--text-700)' } : amber}>
        <b>{words.lead}</b> {words.tail}
      </p>
      {resumable ? (
        <button type="button" data-painted-walk-resume style={{ ...redPress, flex: 'none' }} onClick={() => onResume(false)}>
          {state.pausedWhy === 'hidden' ? 'Keep painting from here' : 'Keep painting'}
        </button>
      ) : null}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {resumable && state.pausedWhy === 'hidden' && state.strokes.length > 0 ? (
          <button type="button" data-painted-walk-join style={press} onClick={() => onResume(true)}>Join the gap with a straight line</button>
        ) : null}
        <button type="button" data-painted-walk-done style={doneStyle} disabled={!hasLine && placeCount === 0} onClick={onDone}>Done</button>
      </div>
    </div>
  )
}
