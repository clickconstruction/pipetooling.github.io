/**
 * The customer's page → **What the rating did** (punch list #357, PR 6), under *How they are to work with*: the bids
 * to the GC since it was first rated, how many were won, the difficulty cost priced into them, and for the office
 * how the jobs ran against the hours priced. When hours ran past, the card asks whether to rate again and the press
 * goes to the rating above. Read only; nothing draws for a GC nobody has rated.
 */
import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { buildDifficultyFeedback, DIFFICULTY_FEEDBACK_WORDS as W, difficultyFeedbackJobWords, type DifficultyFeedback } from '../../lib/bids/difficultyFeedback'
import { supabaseDifficultyFeedbackIo, type DifficultyFeedbackIo } from '../../lib/bids/difficultyFeedbackIo'
import { GC_DIFFICULTY_CHANGED_EVENT } from '../../lib/bids/gcDifficultyRatingIo'
import { formatErrorMessage } from '../../utils/errorHandling'

const DEFAULT_IO = supabaseDifficultyFeedbackIo()

const CARD: CSSProperties = { border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', marginBottom: 16 }
const HEAD: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, padding: '9px 13px', borderBottom: '1px solid var(--border)', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-strong)', flexWrap: 'wrap' }
const BODY: CSSProperties = { padding: '12px 13px', display: 'grid', gap: '0.45rem', fontSize: '0.875rem', color: 'var(--text-base)', lineHeight: 1.45 }
const MUTED: CSSProperties = { margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.45 }
const QUIET: CSSProperties = { font: 'inherit', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-link)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }

/** Goes to the rating card above and puts the cursor on its first sentence. */
function goRate() {
  const card = document.getElementById('gc-difficulty')
  if (!card) return
  card.scrollIntoView({ behavior: 'smooth', block: 'start' })
  card.querySelector<HTMLInputElement>('input[type="radio"]:not(:disabled)')?.focus({ preventScroll: true })
}

export default function GcDifficultyFeedbackCard({ customerId, withHours, io = DEFAULT_IO }: { customerId: string; /** The office reads the hours on the jobs; an estimator reads the bids. */ withHours: boolean; io?: DifficultyFeedbackIo }) {
  const [feedback, setFeedback] = useState<DifficultyFeedback | null>(null)
  const [rated, setRated] = useState<boolean | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const [showJobs, setShowJobs] = useState(false)

  const load = useCallback(async () => {
    try {
      const read = await io.load(customerId, { withHours })
      setFailed(null)
      setRated(read.firstRatedAt != null)
      setFeedback(read.firstRatedAt ? buildDifficultyFeedback({ firstRatedAt: read.firstRatedAt, bids: read.bids, jobs: read.jobs }) : null)
    } catch (e) {
      setFailed(formatErrorMessage(e, W.failed))
    }
  }, [io, customerId, withHours])

  useEffect(() => {
    void load()
    const onChanged = () => void load()
    window.addEventListener(GC_DIFFICULTY_CHANGED_EVENT, onChanged)
    return () => window.removeEventListener(GC_DIFFICULTY_CHANGED_EVENT, onChanged)
  }, [load])

  // A GC nobody has rated has nothing to show yet: the card above says to rate them.
  if (rated === false || (rated == null && !failed)) return null

  return (
    <section style={CARD} data-testid="gc-difficulty-feedback" aria-label={W.cardTitle}>
      <div style={HEAD}>
        {W.cardTitle}
        <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>{W.cardLead}</span>
      </div>
      <div style={BODY}>
        {failed ? (
          <p style={{ ...MUTED, color: 'var(--text-amber-800)' }} role="alert">
            {failed}{' '}
            <button type="button" style={QUIET} onClick={() => void load()}>
              Try again
            </button>
          </p>
        ) : null}
        {feedback?.lines.map((l) => (
          <span key={l} data-testid="gc-difficulty-feedback-line">
            {l}
          </span>
        ))}
        {feedback && !withHours && feedback.bids > 0 ? <span style={MUTED}>{W.hoursHidden}</span> : null}
        {feedback?.nudge ? (
          <p data-testid="gc-difficulty-feedback-nudge" style={{ margin: '0.2rem 0 0', border: '1px solid var(--border-amber)', background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', borderRadius: 8, padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem 0.75rem', flexWrap: 'wrap' }}>
            <span style={{ flex: '1 1 14rem' }}>{feedback.nudge}</span>
            <button type="button" onClick={goRate} style={{ font: 'inherit', fontSize: '0.8125rem', fontWeight: 600, minHeight: 36, padding: '0 0.8rem', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text-strong)', cursor: 'pointer' }}>
              {W.rateAgain}
            </button>
          </p>
        ) : null}
        {feedback && feedback.jobs.length > 0 ? (
          <div>
            <button type="button" style={QUIET} onClick={() => setShowJobs((v) => !v)} aria-expanded={showJobs}>
              {showJobs ? 'Hide the jobs' : `Show the jobs (${feedback.jobs.length})`}
            </button>
            {showJobs ? (
              <ul style={{ margin: '0.4rem 0 0', paddingLeft: '1.1rem', display: 'grid', gap: '0.25rem', fontSize: '0.8125rem' }} data-testid="gc-difficulty-feedback-jobs">
                {feedback.jobs.map((j) => (
                  <li key={j.jobId}>{difficultyFeedbackJobWords(j)}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  )
}
