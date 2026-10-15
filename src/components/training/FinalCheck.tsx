/**
 * The final check (punch list #111): `final_draw` questions drawn one part at a time so every part is asked,
 * answered all at once and handed in. The bar is `final_pass` right; a pass is recorded once, a miss says the
 * score and offers Try again with a fresh draw. Pure state inside; the side effect is `onPassed`.
 */
import { useMemo, useState } from 'react'
import { drawFinalCheck, gradeFinalCheck, type Course, type FinalCheckResult } from '../../lib/training/courseContent'
import { BTN, BTN_DISABLED, BTN_PRIMARY, inlineBold } from './trainingUi'

export function FinalCheck({ course, onPassed, saving }: { course: Course; onPassed: (r: FinalCheckResult, answers: Record<string, number>) => Promise<boolean>; saving: boolean }) {
  const [seed, setSeed] = useState(() => Date.now() % 1_000_000)
  const [picks, setPicks] = useState<Record<string, number>>({})
  const [result, setResult] = useState<FinalCheckResult | null>(null)
  const [recorded, setRecorded] = useState(false)
  const drawn = useMemo(() => drawFinalCheck(course, seed), [course, seed])
  const answered = drawn.filter((q) => picks[q.id] != null).length
  const canHandIn = answered === drawn.length && result == null && !saving

  const handIn = async () => {
    const r = gradeFinalCheck(drawn, picks, course.finalPass)
    setResult(r)
    if (r.passed) setRecorded(await onPassed(r, picks))
  }
  const tryAgain = () => {
    setSeed((s) => s * 31 + 11)
    setPicks({})
    setResult(null)
    setRecorded(false)
  }

  return (
    <section aria-label="Final check" data-final-check>
      <p style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: 0 }}>Final check</p>
      <h2 style={{ margin: '0.1rem 0 0.5rem', fontSize: '1.4rem', lineHeight: 1.2 }}>
        {drawn.length} questions from every part. {course.finalPass} right passes.
      </h2>
      <p style={{ margin: '0 0 0.75rem', color: 'var(--text-muted)' }}>Answer them all, then hand it in. You can take it again with new questions.</p>
      {drawn.map((q, qi) => {
        const picked = picks[q.id]
        const graded = result != null
        const right = graded && picked != null && Boolean(q.options[picked]?.right)
        return (
          <fieldset
            key={q.id}
            data-question={q.id}
            style={{
              margin: '0.6rem 0 0',
              padding: '0.7rem 0.85rem',
              border: `1px solid ${graded ? (right ? 'var(--border-green)' : 'var(--border-red)') : 'var(--border)'}`,
              borderRadius: 8,
              background: graded ? (right ? 'var(--bg-green-tint)' : 'var(--bg-red-tint)') : 'var(--surface)',
            }}
          >
            <legend style={{ fontWeight: 600, padding: '0 0.25rem' }}>
              {qi + 1}. {inlineBold(q.ask)}
            </legend>
            {q.options.map((o, oi) => (
              <label key={oi} style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', padding: '0.25rem 0', minHeight: 24, cursor: graded ? 'default' : 'pointer' }}>
                <input
                  type="radio"
                  name={`final-${q.id}`}
                  checked={picked === oi}
                  disabled={graded}
                  onChange={() => setPicks((p) => ({ ...p, [q.id]: oi }))}
                  style={{ margin: 0, position: 'relative', top: 2, width: 16, height: 16 }}
                />
                <span>{inlineBold(o.text)}</span>
                {graded && o.right && <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-green-800)' }}>right</span>}
              </label>
            ))}
            {graded && !right && <p style={{ margin: '0.4rem 0 0', fontSize: '0.85rem', color: 'var(--text-red-700)' }}>{inlineBold(q.wrongWhy)}</p>}
          </fieldset>
        )
      })}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
        {result == null ? (
          <>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }} data-final-progress>
              {answered} of {drawn.length} answered
            </span>
            <button type="button" onClick={handIn} disabled={!canHandIn} style={{ ...BTN_PRIMARY, ...(canHandIn ? {} : BTN_DISABLED), marginLeft: 'auto' }}>
              Hand it in
            </button>
          </>
        ) : result.passed ? (
          <span style={{ fontWeight: 700, color: 'var(--text-green-800)' }} data-final-result="passed">
            Passed. {result.right} of {result.total} right.{recorded ? '' : saving ? ' Recording…' : ' Not recorded yet. Try again in a moment.'}
          </span>
        ) : (
          <>
            <span style={{ fontWeight: 700, color: 'var(--text-red-700)' }} data-final-result="missed">
              {result.right} of {result.total} right. {course.finalPass} passes.
            </span>
            <button type="button" onClick={tryAgain} style={{ ...BTN, marginLeft: 'auto' }}>
              Try again
            </button>
          </>
        )}
      </div>
    </section>
  )
}
