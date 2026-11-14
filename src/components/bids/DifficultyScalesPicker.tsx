/**
 * GC difficulty rating (punch list #357, PR 1): the scales drawn as a person meets them, one block per scale with its
 * rungs as rows a person picks from. The dev's Settings card draws it as the preview of the GC's card; PR 2 draws it on
 * the GC's record (*How they are to work with*) and PR 5 on the master's phone sheet. A bills scale is never picked
 * here: its chip says it is read from the bills, and its sentences are shown for what the points mean.
 *
 * Pure drawing over `difficultyCriteria.ts`: the body, the picks and one callback. 44 px rungs, as the canvas drew them.
 */
import type { CSSProperties } from 'react'
import {
  DIFFICULTY_SCOPE_WORDS,
  DIFFICULTY_SOURCE_WORDS,
  difficultyPointsWords,
  difficultyRangeWords,
  type DifficultyCriteriaBody,
  type DifficultyPicks,
  type DifficultyScale,
} from '../../lib/bids/difficultyCriteria'

const SCALE: CSSProperties = { display: 'grid', gap: '0.45rem' }
const HEAD: CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }
const NAME: CSSProperties = { fontWeight: 600, color: 'var(--text-strong)' }
const RANGE: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.8125rem' }
const POINTS: CSSProperties = { marginLeft: 'auto', fontWeight: 700, color: 'var(--text-strong)' }
const CHIP: CSSProperties = { fontSize: '0.75rem', fontWeight: 600, padding: '0.15rem 0.55rem', borderRadius: 999, background: 'var(--bg-green-tint)', color: 'var(--text-green-800)', border: '1px solid var(--border-green)' }
const BID_CHIP: CSSProperties = { ...CHIP, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', border: '1px solid var(--border-amber)' }
const RUNGS: CSSProperties = { display: 'grid', gap: '0.35rem' }
const SENTENCE: CSSProperties = { lineHeight: 1.4, color: 'var(--text-base)' }

function rungStyle(picked: boolean, pickable: boolean): CSSProperties {
  return {
    display: 'flex',
    gap: '0.6rem',
    alignItems: 'flex-start',
    padding: '0.5rem 0.65rem',
    minHeight: 44,
    boxSizing: 'border-box',
    borderRadius: 8,
    border: picked ? '2px solid #2563eb' : '1px solid var(--border)',
    background: picked ? 'var(--bg-blue-tint)' : 'var(--surface)',
    cursor: pickable ? 'pointer' : 'default',
    fontSize: '0.875rem',
  }
}

export type DifficultyScalesPickerProps = {
  body: DifficultyCriteriaBody
  picks: DifficultyPicks
  /** Absent, or `readOnly`, draws the picks and takes none. */
  onPick?: (key: string, points: number) => void
  readOnly?: boolean
  /** Only scales of this scope; both when absent. */
  scope?: DifficultyScale['scope']
  /** A radio group name prefix, so two pickers on one page never share a group. */
  groupName?: string
  /** Under a bills scale's head: the numbers behind its point (PR 3). */
  billsLine?: (scale: DifficultyScale) => React.ReactNode
}

export default function DifficultyScalesPicker({ body, picks, onPick, readOnly = false, scope, groupName = 'difficulty', billsLine }: DifficultyScalesPickerProps) {
  const scales = body.scales.filter((s) => scope == null || s.scope === scope)
  return (
    <div style={{ display: 'grid', gap: '1rem' }} data-testid="difficulty-scales-picker">
      {scales.map((s) => {
        const picked = picks[s.key]
        const pickable = !readOnly && s.source === 'picked' && onPick != null
        return (
          <section key={s.key} style={SCALE} data-difficulty-scale={s.key} aria-label={s.name}>
            <div style={HEAD}>
              <span style={NAME}>{s.name.trim() || s.key}</span>
              {s.source === 'bills' ? <span style={CHIP}>{DIFFICULTY_SOURCE_WORDS.bills}</span> : <span style={RANGE}>{difficultyRangeWords(s)}</span>}
              {s.scope === 'bid' ? <span style={BID_CHIP}>{DIFFICULTY_SCOPE_WORDS.bid}</span> : null}
              <span style={POINTS} data-difficulty-points={s.key}>
                {picked != null ? difficultyPointsWords(picked) : 'unrated'}
              </span>
            </div>
            {s.source === 'bills' && billsLine ? <div style={{ fontSize: '0.8125rem', color: 'var(--text-base)' }}>{billsLine(s)}</div> : null}
            <div style={RUNGS} role={pickable ? 'radiogroup' : undefined} aria-label={pickable ? s.name : undefined}>
              {s.rungs.map((r, i) => {
                const isPicked = picked === r.points
                const id = `${groupName}-${s.key}-${r.points}`
                return (
                  <label key={`${r.points}-${i}`} htmlFor={id} style={rungStyle(isPicked, pickable)} data-difficulty-rung={`${s.key}:${r.points}`}>
                    <input
                      id={id}
                      type="radio"
                      name={`${groupName}-${s.key}`}
                      checked={isPicked}
                      disabled={!pickable}
                      onChange={() => onPick?.(s.key, r.points)}
                      aria-label={`${s.name}: ${difficultyPointsWords(r.points)}`}
                      style={{ marginTop: 3, flexShrink: 0 }}
                    />
                    <span style={SENTENCE}>
                      <strong>{r.points}</strong> · {r.sentence.trim() || <em style={{ color: 'var(--text-muted)' }}>no sentence yet</em>}
                    </span>
                  </label>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
