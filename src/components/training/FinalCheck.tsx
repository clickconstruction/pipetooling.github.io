/**
 * The final check (punch list #111): `final_draw` questions drawn one part at a time so every part is asked,
 * answered all at once and handed in. The bar is `final_pass` right; a pass is recorded once, a miss says the
 * score and offers Try again with a fresh draw. Pure state inside; the side effect is `onPassed`.
 *
 * v2.5575: a pass ends with the day it is due again and one blue press home (`onHome`) beside *Read a lesson
 * again* (`onReadAgain`); each question is a labelled group with the question as a heading inside the box; every
 * answer row and press is 44 px tall on a touch screen.
 */
import { useMemo, useState } from 'react'
import { drawFinalCheck, gradeFinalCheck, type Course, type FinalCheckResult } from '../../lib/training/courseContent'
import { BTN, BTN_DISABLED, BTN_PRIMARY, BTN_QUIET, inlineBold } from './trainingUi'

export function FinalCheck({
  course,
  onPassed,
  saving,
  recordedLine,
  onHome,
  onReadAgain,
}: {
  course: Course
  onPassed: (r: FinalCheckResult, answers: Record<string, number>) => Promise<boolean>
  saving: boolean
  /** "Recorded, due again Oct 16, 2027." once the pass is on record; null before. */
  recordedLine: string | null
  onHome: () => void
  onReadAgain: () => void
}) {
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
        const askId = `final-${q.id.replace(/[^a-z0-9-]/gi, '-')}-ask`
        return (
          <div
            key={q.id}
            role="group"
            aria-labelledby={askId}
            data-question={q.id}
            style={{
              margin: '0.6rem 0 0',
              padding: '0.7rem 0.85rem 0.6rem',
              border: `1px solid ${graded ? (right ? 'var(--border-green)' : 'var(--border-red)') : 'var(--border)'}`,
              borderRadius: 8,
              background: graded ? (right ? 'var(--bg-green-tint)' : 'var(--bg-red-tint)') : 'var(--surface)',
            }}
          >
            <p id={askId} style={{ fontWeight: 600, margin: '0 0 0.35rem' }}>
              {qi + 1}. {inlineBold(q.ask)}
            </p>
            {q.options.map((o, oi) => (
              <label key={oi} className="trainingOption" style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', padding: '0.25rem 0', minHeight: 28, cursor: graded ? 'default' : 'pointer' }}>
                <input
                  type="radio"
                  name={`final-${q.id}`}
                  checked={picked === oi}
                  disabled={graded}
                  onChange={() => setPicks((p) => ({ ...p, [q.id]: oi }))}
                  style={{ margin: 0, width: 18, height: 18, flex: 'none' }}
                />
                <span>{inlineBold(o.text)}</span>
                {graded && o.right && <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-green-800)' }}>right</span>}
              </label>
            ))}
            {graded && !right && <p style={{ margin: '0.4rem 0 0', fontSize: '0.85rem', color: 'var(--text-red-700)' }}>{inlineBold(q.wrongWhy)}</p>}
          </div>
        )
      })}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
        {result == null ? (
          <>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }} data-final-progress>
              {answered} of {drawn.length} answered
            </span>
            <button type="button" className="trainingPress" onClick={handIn} disabled={!canHandIn} style={{ ...BTN_PRIMARY, ...(canHandIn ? {} : BTN_DISABLED), marginLeft: 'auto' }}>
              Hand it in
            </button>
          </>
        ) : result.passed ? (
          <div style={{ display: 'grid', gap: '0.75rem', width: '100%' }} data-final-result="passed">
            <span style={{ fontWeight: 700, color: 'var(--text-green-800)' }}>
              Passed. {result.right} of {result.total} right.{recorded && recordedLine ? ` ${recordedLine}` : saving ? ' Recording…' : recorded ? '' : ' Not recorded yet. Try again in a moment.'}
            </span>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button type="button" className="trainingPress" onClick={onHome} style={BTN_PRIMARY}>
                ‹ Back to the Dashboard
              </button>
              <button type="button" className="trainingPress" onClick={onReadAgain} style={BTN_QUIET}>
                Read a lesson again
              </button>
            </div>
          </div>
        ) : (
          <>
            <span style={{ fontWeight: 700, color: 'var(--text-red-700)' }} data-final-result="missed">
              {result.right} of {result.total} right. {course.finalPass} passes.
            </span>
            <button type="button" className="trainingPress" onClick={tryAgain} style={{ ...BTN, marginLeft: 'auto' }}>
              Try again
            </button>
          </>
        )}
      </div>
    </section>
  )
}
