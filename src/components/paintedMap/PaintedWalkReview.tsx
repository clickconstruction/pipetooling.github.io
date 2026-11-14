/**
 * Look it over (punch list #345): the lines a walk made, before anything is saved. Nothing has left
 * the phone yet. The person sees exactly what will be kept, sets right by hand what the phone got
 * wrong, and only then saves. Throwing it away leaves nothing behind.
 */
import type { CSSProperties } from 'react'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { aboutLengthWords, giveOrTakeWords, lineHowWords } from '../../lib/paintedMap/paintedMap'
import type { WalkStroke } from '../../lib/paintedMap/paintedWalk'
import { WALK_NOTHING_LEFT_WORDS } from '../../lib/paintedMap/paintedWalkWords'
import { PAINT_SWATCH } from './paintedMapLook'

type Props = {
  strokes: ReadonlyArray<WalkStroke>
  busy: boolean
  /** The map is already saved: these lines are added to it. */
  mapSaved: boolean
  onFix: (index: number) => void
  onRemove: (index: number) => void
  onSave: () => void
  onKeepPainting: () => void
  onThrowAway: () => void
}

const press: CSSProperties = { minHeight: 44, padding: '0 0.9rem', borderRadius: 8, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', fontFamily: 'inherit', fontWeight: 700, fontSize: '0.9375rem', cursor: 'pointer' }
const quiet: CSSProperties = { background: 'none', border: 'none', padding: 0, color: 'var(--text-link)', fontFamily: 'inherit', fontSize: '0.875rem', textDecoration: 'underline', textUnderlineOffset: 2, cursor: 'pointer', minHeight: 32 }

export function PaintedWalkReview({ strokes, busy, mapSaved, onFix, onRemove, onSave, onKeepPainting, onThrowAway }: Props) {
  const total = strokes.reduce((sum, s) => sum + s.lengthM, 0)
  const canSave = strokes.length > 0 && !busy
  return (
    <div data-painted-review style={{ display: 'grid', gap: '0.65rem' }}>
      {strokes.length === 0 ? (
        <p style={{ margin: 0, fontSize: '0.9375rem', color: 'var(--text-700)' }}>The phone did not move far enough to draw a line, so there is no line to save.</p>
      ) : (
        <>
          <div data-painted-review-total style={{ fontSize: '1.3rem', fontWeight: 700 }}>
            {aboutLengthWords(total).replace(/^a/, 'A')}
            <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-700)' }}> · {strokes.length === 1 ? 'one line' : `${strokes.length} lines`} · read from the phone</span>
          </div>
          {strokes.map((s, i) => {
            const faint = (s.poorParts ?? []).length > 0
            const margin = giveOrTakeWords(s.marginM)
            return (
              <div key={i} data-painted-review-line style={{ borderWidth: 1, borderStyle: 'solid', borderColor: faint ? 'var(--border-amber)' : 'var(--border)', borderRadius: 10, padding: '0.55rem 0.7rem', display: 'grid', gap: '0.3rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span aria-hidden style={PAINT_SWATCH} />
                  <b style={{ fontSize: '0.9375rem' }}>{strokes.length === 1 ? 'The line' : `Line ${i + 1}`}</b>
                </div>
                <div style={{ fontSize: '0.9375rem' }}>
                  <b>{aboutLengthWords(s.lengthM).replace(/^a/, 'A')}</b>
                  {margin ? <span style={{ color: 'var(--text-700)' }}>, {margin}</span> : null}
                  <span style={{ color: 'var(--text-muted)' }}> · {lineHowWords({ how: s.how, fixedByHand: s.fixedByHand === true })}</span>
                </div>
                {faint ? (
                  <p role="status" style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-amber-800)' }}>
                    Part of this line is faint. The phone was not sure there, so that part is left out of the length. Set it right by hand.
                  </p>
                ) : null}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem 0.9rem' }}>
                  <button type="button" style={quiet} onClick={() => onFix(i)}>Fix this line by hand</button>
                  <button type="button" style={quiet} onClick={() => onRemove(i)}>Leave this line out</button>
                </div>
              </div>
            )
          })}
        </>
      )}
      <button type="button" data-painted-review-save style={canSave ? { ...press, minHeight: 52, background: '#2563eb', borderColor: '#2563eb', color: '#fff' } : { ...press, minHeight: 52, background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, borderColor: 'var(--border)', cursor: 'default' }} disabled={!canSave} onClick={onSave}>
        {busy ? 'Saving…' : mapSaved ? (strokes.length === 1 ? 'Save the line' : `Save the ${strokes.length} lines`) : 'Save the map'}
      </button>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        <button type="button" style={press} onClick={onKeepPainting}>Keep painting</button>
        <button type="button" style={press} onClick={onThrowAway}>Throw it away</button>
      </div>
      <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{WALK_NOTHING_LEFT_WORDS}</p>
    </div>
  )
}
