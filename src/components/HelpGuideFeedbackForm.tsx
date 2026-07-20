/** Feedback box at the bottom of a /help guide — writes help_feedback and pushes devs. */
import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import {
  HELP_FEEDBACK_BODY_MAX,
  submitHelpFeedback,
} from '../lib/helpFeedbackHelpers'

export function HelpGuideFeedbackForm({ guideSlug }: { guideSlug: string }) {
  const { user: authUser } = useAuth()
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!authUser?.id) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!authUser?.id || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await submitHelpFeedback({ fromUserId: authUser.id, guideSlug, body })
      setBody('')
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit feedback')
    } finally {
      setSubmitting(false)
    }
  }

  const trimmedLength = body.trim().length
  const canSubmit = trimmedLength > 0 && trimmedLength <= HELP_FEEDBACK_BODY_MAX && !submitting

  return (
    <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
      <h2 style={{ margin: '0 0 0.35rem', fontSize: '0.9375rem', fontWeight: 600 }}>
        Feedback on this guide or feature?
      </h2>
      <p style={{ margin: '0 0 0.6rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
        Suggestions, confusion, or something the app should do differently — it goes straight to the devs.
      </p>
      {submitted ? (
        <p style={{ fontSize: '0.875rem', color: 'var(--text-green-800)', background: 'var(--bg-green-tint)', border: '1px solid var(--border-green)', borderRadius: 6, padding: '0.5rem 0.75rem', margin: 0 }}>
          Thanks — feedback sent.{' '}
          <button
            type="button"
            onClick={() => setSubmitted(false)}
            style={{ background: 'none', border: 'none', color: 'var(--text-green-800)', textDecoration: 'underline', cursor: 'pointer', padding: 0, fontSize: '0.875rem' }}
          >
            Send more
          </button>
        </p>
      ) : (
        <form onSubmit={handleSubmit}>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            maxLength={HELP_FEEDBACK_BODY_MAX + 100}
            placeholder="What could be better?"
            style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 6, boxSizing: 'border-box', fontSize: '0.875rem' }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.4rem' }}>
            <button
              type="submit"
              disabled={!canSubmit}
              style={{ padding: '0.4rem 0.9rem', background: canSubmit ? '#2563eb' : '#9ca3af', color: 'white', border: 'none', borderRadius: 4, cursor: canSubmit ? 'pointer' : 'not-allowed', fontSize: '0.875rem', fontWeight: 500 }}
            >
              {submitting ? 'Sending…' : 'Send feedback'}
            </button>
            <span style={{ fontSize: '0.75rem', color: trimmedLength > HELP_FEEDBACK_BODY_MAX ? 'var(--text-red-700)' : 'var(--text-faint)' }}>
              {trimmedLength}/{HELP_FEEDBACK_BODY_MAX}
            </span>
            {error && <span style={{ fontSize: '0.8125rem', color: 'var(--text-red-700)' }}>{error}</span>}
          </div>
        </form>
      )}
    </div>
  )
}
