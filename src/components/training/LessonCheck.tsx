/**
 * Check yourself (punch list #111): a lesson's four questions, one right answer each, in the course's own
 * wording. A pick answers at once: a right one says why in one line, a wrong one says why and offers Try again
 * with the options reshuffled. The lesson is done when all four are right; the page records it once, with how
 * many tries it took. Pure state inside; the one side effect is `onPassed`.
 *
 * v2.5575: each question is a labelled group with the question as a heading inside the box (a legend wrapped
 * onto the border on a phone), and every answer row and press is 44 px tall on a touch screen (`trainingOption`,
 * `trainingPress` in index.css).
 */
import { useEffect, useMemo, useState } from 'react'
import { shuffleOptions, type CourseLesson, type CourseQuestion } from '../../lib/training/courseContent'
import { BTN, inlineBold } from './trainingUi'

type QuestionState = { seed: number; pick: number | null }

export function LessonCheck({ lesson, seed, alreadyPassed, onPassed }: { lesson: CourseLesson; seed: number; alreadyPassed: boolean; onPassed: (tries: number) => void }) {
  const [states, setStates] = useState<QuestionState[]>(() => lesson.questions.map((_, i) => ({ seed: seed + i, pick: null })))
  const [tries, setTries] = useState(1)
  const [reported, setReported] = useState(false)

  // A new lesson or a fresh seed starts the check over.
  useEffect(() => {
    setStates(lesson.questions.map((_, i) => ({ seed: seed + i, pick: null })))
    setTries(1)
    setReported(false)
  }, [lesson.key, seed, lesson.questions])

  const drawn: CourseQuestion[] = useMemo(() => lesson.questions.map((q, i) => shuffleOptions(q, states[i]?.seed ?? seed + i)), [lesson.questions, states, seed])

  const rightCount = drawn.filter((q, i) => {
    const pick = states[i]?.pick
    return pick != null && q.options[pick]?.right
  }).length
  const allRight = rightCount === drawn.length

  useEffect(() => {
    if (allRight && !reported) {
      setReported(true)
      onPassed(tries)
    }
  }, [allRight, reported, onPassed, tries])

  const pick = (qi: number, oi: number) => {
    setStates((prev) => prev.map((s, i) => (i === qi && s.pick == null ? { ...s, pick: oi } : s)))
  }
  const tryAgain = (qi: number) => {
    setTries((t) => t + 1)
    setStates((prev) => prev.map((s, i) => (i === qi ? { seed: s.seed * 31 + 7, pick: null } : s)))
  }

  return (
    <section aria-label="Check yourself" style={{ marginTop: '1.25rem' }}>
      <h3 style={h5}>Check yourself</h3>
      {drawn.map((q, qi) => {
        const st = states[qi]
        const picked = st?.pick ?? null
        const answered = picked != null
        const right = answered && Boolean(q.options[picked]?.right)
        const tone = !answered ? null : right ? 'right' : 'wrong'
        const askId = `${lesson.key}-${q.n}-ask`
        return (
          <div
            key={q.id}
            role="group"
            aria-labelledby={askId}
            data-question={q.id}
            data-state={tone ?? 'open'}
            style={{
              margin: '0.6rem 0 0',
              padding: '0.7rem 0.85rem 0.6rem',
              border: `1px solid ${tone === 'right' ? 'var(--border-green)' : tone === 'wrong' ? 'var(--border-red)' : 'var(--border)'}`,
              borderRadius: 8,
              background: tone === 'right' ? 'var(--bg-green-tint)' : tone === 'wrong' ? 'var(--bg-red-tint)' : 'var(--surface)',
            }}
          >
            <p id={askId} style={{ fontWeight: 600, margin: '0 0 0.35rem' }}>
              {qi + 1}. {inlineBold(q.ask)}
            </p>
            {q.options.map((o, oi) => (
              <label key={oi} className="trainingOption" style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', padding: '0.25rem 0', minHeight: 28, cursor: answered ? 'default' : 'pointer' }}>
                <input
                  type="radio"
                  name={`${lesson.key}-${q.id}`}
                  checked={picked === oi}
                  disabled={answered}
                  onChange={() => pick(qi, oi)}
                  style={{ margin: 0, width: 18, height: 18, flex: 'none' }}
                />
                <span>{inlineBold(o.text)}</span>
              </label>
            ))}
            {tone === 'right' && (
              <p style={{ margin: '0.4rem 0 0', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-green-800)' }}>Right. {inlineBold(q.rightWhy)}</p>
            )}
            {tone === 'wrong' && (
              <div style={{ margin: '0.4rem 0 0', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-red-700)', display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <span>Not this one. {inlineBold(q.wrongWhy)}</span>
                <button type="button" className="trainingPress" onClick={() => tryAgain(qi)} style={{ ...BTN, padding: '0.35rem 0.8rem', minHeight: 32 }}>
                  Try again
                </button>
              </div>
            )}
          </div>
        )
      })}
      <p style={{ margin: '0.9rem 0 0', fontSize: '0.875rem', color: allRight ? 'var(--text-green-800)' : 'var(--text-muted)', fontWeight: allRight ? 600 : 400 }} data-check-progress>
        {allRight ? (alreadyPassed ? 'All four right. This lesson is done.' : 'All four right. Lesson done.') : `Done when all four are right · ${rightCount} of ${drawn.length}`}
      </p>
    </section>
  )
}

const h5 = { margin: '1rem 0 0.25rem', fontSize: '0.75rem', letterSpacing: '0.05em', textTransform: 'uppercase' as const, color: 'var(--text-muted)' }
