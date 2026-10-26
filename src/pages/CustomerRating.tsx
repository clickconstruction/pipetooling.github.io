/**
 * The customer's one-tap rating page (v2.5876, measuring follow-ups item 6): /rate?t=<token>, public
 * like /contract/sign. One tap on a face saves the score through the `job-rating` function; the words
 * are optional after. The rules and the words are `src/lib/ratings/rating.ts`; the ask is minted by
 * `mint_customer_rating`. Customer-facing, so the page stays light (`data-theme="light"`).
 */
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { parseRatingState, RATE_WORDS, SCORE_LABELS, thanksFor, tokenOk, WORDS_MAX, type RatingState } from '../lib/ratings/rating'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

const FACES = ['😞', '😕', '😐', '🙂', '😃'] as const

export default function CustomerRating() {
  const [params] = useSearchParams()
  const token = params.get('t')
  const [state, setState] = useState<RatingState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [words, setWords] = useState('')
  const [wordsSent, setWordsSent] = useState(false)

  useEffect(() => {
    if (!tokenOk(token)) {
      setError(RATE_WORDS.badLink)
      setLoading(false)
      return
    }
    const ac = new AbortController()
    void (async () => {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/job-rating?t=${encodeURIComponent(token)}`, {
          headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
          signal: ac.signal,
        })
        const parsed = parseRatingState(await res.json())
        if (ac.signal.aborted) return
        if (!res.ok || !parsed) {
          setError(RATE_WORDS.badLink)
          return
        }
        setState(parsed)
        setWords(parsed.words)
      } catch {
        if (!ac.signal.aborted) setError(RATE_WORDS.problem)
      } finally {
        if (!ac.signal.aborted) setLoading(false)
      }
    })()
    return () => ac.abort()
  }, [token])

  const save = async (score: number, withWords: boolean) => {
    if (!tokenOk(token) || saving) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/job-rating`, {
        method: 'POST',
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(withWords ? { t: token, score, words } : { t: token, score }),
      })
      const parsed = parseRatingState(await res.json())
      if (!res.ok || !parsed) {
        setError(RATE_WORDS.problem)
        return
      }
      setState((s) => ({ ...(s ?? parsed), score: parsed.score, answered: true }))
      if (withWords) setWordsSent(true)
    } catch {
      setError(RATE_WORDS.problem)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div data-theme="light" style={{ minHeight: '100vh', background: 'var(--surface)', color: 'var(--text-strong)', display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: '26rem', padding: '2.5rem 1rem 3rem' }}>
        {loading ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</p>
        ) : !state ? (
          <p role="alert" style={{ textAlign: 'center' }}>{error ?? RATE_WORDS.badLink}</p>
        ) : (
          <>
            <h1 style={{ margin: 0, fontSize: '1.4rem', textAlign: 'center' }}>{RATE_WORDS.title(state.name)}</h1>
            <p style={{ margin: '0.4rem 0 1.4rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.95rem' }}>{RATE_WORDS.sub}</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.4rem' }}>
              {FACES.map((face, i) => {
                const score = i + 1
                const picked = state.score === score
                return (
                  <button
                    key={score}
                    type="button"
                    onClick={() => void save(score, false)}
                    disabled={saving}
                    aria-label={SCORE_LABELS[i]}
                    aria-pressed={picked}
                    style={{
                      fontSize: '2rem',
                      lineHeight: 1,
                      padding: '0.55rem 0.45rem 0.35rem',
                      borderRadius: '0.75rem',
                      border: picked ? '2px solid #2563eb' : '1px solid var(--border)',
                      background: picked ? 'var(--bg-blue-tint)' : 'var(--surface)',
                      cursor: 'pointer',
                      opacity: saving ? 0.6 : state.answered && !picked ? 0.55 : 1,
                    }}
                  >
                    <span aria-hidden>{face}</span>
                    <span style={{ display: 'block', fontSize: '0.6rem', marginTop: '0.3rem', color: 'var(--text-muted)' }}>{SCORE_LABELS[i]}</span>
                  </button>
                )
              })}
            </div>
            {error ? (
              <p role="alert" style={{ textAlign: 'center', color: 'var(--text-red-700)', fontSize: '0.9rem' }}>{error}</p>
            ) : null}
            {state.answered && state.score ? (
              <>
                <p style={{ textAlign: 'center', marginTop: '1.2rem', fontWeight: 600 }}>{thanksFor(state.score)}</p>
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.3rem 0 1.4rem' }}>{RATE_WORDS.change}</p>
                <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.35rem' }} htmlFor="rating-words">
                  {RATE_WORDS.wordsLabel}
                </label>
                <textarea
                  id="rating-words"
                  value={words}
                  maxLength={WORDS_MAX}
                  onChange={(e) => {
                    setWords(e.target.value)
                    setWordsSent(false)
                  }}
                  rows={4}
                  style={{ width: '100%', boxSizing: 'border-box', borderRadius: '0.6rem', border: '1px solid var(--border)', padding: '0.6rem', font: 'inherit', background: 'var(--surface)', color: 'var(--text-strong)' }}
                />
                <button
                  type="button"
                  onClick={() => void save(state.score!, true)}
                  disabled={saving || wordsSent || !words.trim()}
                  style={{
                    marginTop: '0.6rem',
                    width: '100%',
                    padding: '0.65rem',
                    borderRadius: '0.6rem',
                    border: 'none',
                    background: wordsSent ? '#16a34a' : '#2563eb',
                    color: '#fff',
                    fontWeight: 600,
                    cursor: saving || wordsSent || !words.trim() ? 'default' : 'pointer',
                    opacity: saving ? 0.7 : 1,
                  }}
                >
                  {wordsSent ? RATE_WORDS.sent : RATE_WORDS.send}
                </button>
              </>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
