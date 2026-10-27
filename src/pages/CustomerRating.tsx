/**
 * The customer's rating page (v2.5876, measuring follow-ups item 6): /rate?t=<token>, public like /contract/sign. One
 * tap on a star saves the score through the `job-rating` function; the words are optional after. Since v2.5934 (punch
 * list #185) it is the owner's review ask: the company and the job by name, five stars, at five the ask to put it on
 * Google with the company's own link (their words copied for the paste), below five what we could have done better,
 * and at three or fewer the promise of the office's call; the same Google line shows below five too, which is Google's
 * policy's own shape (`GOOGLE_ASK_AT`). The rules and the words are `src/lib/ratings/rating.ts`; the ask is minted by
 * `mint_customer_rating`. Customer-facing, so the page stays light (`data-theme="light"`).
 */
import { useEffect, useState, type CSSProperties } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SampleModeBanner } from '../components/SampleModeBanner'
import {
  callPromised,
  parseRatingExtras,
  parseRatingState,
  portalReadable,
  rateWordsFor,
  RATING_COMPANY,
  sampleRating,
  showGoogleAsk,
  thanksFor,
  titleFor,
  tokenOk,
  wordsLabelFor,
  WORDS_MAX,
  type RatingExtras,
  type RatingState,
} from '../lib/ratings/rating'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

const STAR_ON = '#f59e0b'
const GO = '#2563eb'

const NO_EXTRAS: RatingExtras = { jobName: null, company: { ...RATING_COMPANY }, lang: 'en', googleLink: null, googlePressed: false, portalUrl: null }

const CARD = (tone: 'ask' | 'plain'): CSSProperties => ({
  border: '1px solid var(--border)',
  borderRadius: '0.75rem',
  padding: '0.8rem 0.9rem',
  background: tone === 'ask' ? 'var(--bg-amber-tint)' : 'var(--bg-subtle)',
  display: 'grid',
  gap: '0.55rem',
  marginTop: '1rem',
})

export default function CustomerRating() {
  const [params] = useSearchParams()
  const token = params.get('t')
  const sample = sampleRating(token)
  const [state, setState] = useState<RatingState | null>(null)
  const [extras, setExtras] = useState<RatingExtras>(NO_EXTRAS)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [words, setWords] = useState('')
  const [wordsSent, setWordsSent] = useState(false)
  const [copied, setCopied] = useState(false)
  const [pressed, setPressed] = useState(false)

  const { rate: W, review: R, labels } = rateWordsFor(extras.lang)

  useEffect(() => {
    // What customers see (Settings) renders the page on the sample tokens: made-up state, no read, no save.
    if (sample) {
      setState(sample.state)
      setExtras(sample.extras)
      setWords(sample.state.words)
      setLoading(false)
      return
    }
    if (!tokenOk(token)) {
      setError(W.badLink)
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
        const body: unknown = await res.json()
        const parsed = parseRatingState(body)
        if (ac.signal.aborted) return
        if (!res.ok || !parsed) {
          setError(W.badLink)
          return
        }
        setState(parsed)
        setExtras(parseRatingExtras(body))
        setWords(parsed.words)
        setPressed(parseRatingExtras(body).googlePressed)
      } catch {
        if (!ac.signal.aborted) setError(W.problem)
      } finally {
        if (!ac.signal.aborted) setLoading(false)
      }
    })()
    return () => ac.abort()
    // The sample is read from the token; W only words a message.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  useEffect(() => {
    document.title = `${titleFor(state?.name ?? '', extras.jobName, extras.lang)} · ${extras.company.name}`
  }, [state?.name, extras])

  const save = async (score: number, withWords: boolean) => {
    if (sample) {
      setState((s) => ({ name: s?.name ?? 'Sam', words: s?.words ?? '', score, answered: true }))
      if (withWords) setWordsSent(true)
      return
    }
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
        setError(W.problem)
        return
      }
      setState((s) => ({ ...(s ?? parsed), score: parsed.score, answered: true }))
      if (withWords) setWordsSent(true)
    } catch {
      setError(W.problem)
    } finally {
      setSaving(false)
    }
  }

  /** Post it on Google: their words copied for the paste (and saved, when typed and not sent yet), the press stamped once. */
  const pressGoogle = (score: number) => {
    const text = words.trim()
    if (text) {
      try {
        void navigator.clipboard
          ?.writeText(text)
          .then(() => setCopied(true))
          .catch(() => undefined)
      } catch {
        /* the link still opens */
      }
      if (!wordsSent && text !== (state?.words ?? '').trim()) void save(score, true)
    }
    setPressed(true)
    if (sample || !tokenOk(token)) return
    void fetch(`${supabaseUrl}/functions/v1/job-rating`, {
      method: 'POST',
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ t: token, action: 'google' }),
    }).catch(() => undefined)
  }

  const score = state?.answered ? (state.score ?? 0) : 0
  const google = state?.answered && showGoogleAsk(state.score, extras.googleLink)

  return (
    <div data-theme="light" style={{ minHeight: '100vh', background: 'var(--surface)', color: 'var(--text-strong)', display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: '26rem', padding: '2rem 1rem 3rem', boxSizing: 'border-box' }}>
        {sample ? <SampleModeBanner /> : null}
        <p style={{ margin: '0 0 1.2rem', textAlign: 'center', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.02em', color: 'var(--text-700)' }}>{extras.company.name}</p>
        {loading ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</p>
        ) : !state ? (
          <p role="alert" style={{ textAlign: 'center' }}>{error ?? W.badLink}</p>
        ) : (
          <>
            <h1 style={{ margin: 0, fontSize: '1.4rem', lineHeight: 1.25, textAlign: 'center', textWrap: 'balance' }}>{titleFor(state.name, extras.jobName, extras.lang)}</h1>
            <p style={{ margin: '0.4rem 0 1.1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.95rem' }}>{W.sub}</p>
            <div role="group" aria-label={R.stars} style={{ display: 'flex', justifyContent: 'center', gap: '0.15rem' }}>
              {labels.map((label, i) => {
                const n = i + 1
                const picked = state.score === n
                const lit = state.score != null && n <= state.score
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => void save(n, false)}
                    disabled={saving}
                    aria-label={label}
                    aria-pressed={picked}
                    title={label}
                    style={{
                      fontSize: '2.6rem',
                      lineHeight: 1,
                      minWidth: 52,
                      minHeight: 52,
                      padding: '0.1rem',
                      border: 0,
                      background: 'transparent',
                      color: lit ? STAR_ON : 'var(--text-faint)',
                      cursor: 'pointer',
                      opacity: saving ? 0.6 : 1,
                    }}
                  >
                    <span aria-hidden>★</span>
                  </button>
                )
              })}
            </div>
            <p aria-live="polite" style={{ margin: '0.2rem 0 0', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)', minHeight: '1.2rem' }}>
              {state.score ? labels[state.score - 1] : R.tapStar}
            </p>
            {error ? (
              <p role="alert" style={{ textAlign: 'center', color: 'var(--text-red-700)', fontSize: '0.9rem' }}>{error}</p>
            ) : null}
            {state.answered && score ? (
              <>
                <p style={{ textAlign: 'center', marginTop: '1.1rem', fontWeight: 600 }}>{thanksFor(score)}</p>
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.3rem 0 1.2rem' }}>{W.change}</p>
                {callPromised(score) ? (
                  <div style={CARD('ask')}>
                    <p style={{ margin: 0, fontWeight: 600 }}>{R.call}</p>
                  </div>
                ) : null}
                <label style={{ display: 'block', fontSize: '0.9rem', margin: '1rem 0 0.35rem', fontWeight: score < 5 ? 600 : 400 }} htmlFor="rating-words">
                  {wordsLabelFor(score, extras.lang)}
                </label>
                <textarea
                  id="rating-words"
                  value={words}
                  maxLength={WORDS_MAX}
                  onChange={(e) => {
                    setWords(e.target.value)
                    setWordsSent(false)
                    setCopied(false)
                  }}
                  rows={4}
                  style={{ width: '100%', boxSizing: 'border-box', borderRadius: '0.6rem', border: '1px solid var(--border)', padding: '0.6rem', font: 'inherit', background: 'var(--surface)', color: 'var(--text-strong)' }}
                />
                <button
                  type="button"
                  onClick={() => void save(score, true)}
                  disabled={saving || wordsSent || !words.trim()}
                  style={{
                    marginTop: '0.6rem',
                    width: '100%',
                    minHeight: 44,
                    padding: '0.65rem',
                    borderRadius: '0.6rem',
                    border: 'none',
                    background: wordsSent ? '#16a34a' : GO,
                    color: '#fff',
                    fontWeight: 600,
                    cursor: saving || wordsSent || !words.trim() ? 'default' : 'pointer',
                    opacity: saving ? 0.7 : !words.trim() && !wordsSent ? 0.55 : 1,
                  }}
                >
                  {wordsSent ? W.sent : W.send}
                </button>
                {google ? (
                  <div style={CARD('ask')}>
                    <p style={{ margin: 0 }}>{score >= 5 ? R.googleAsk : R.googleAskBelow}</p>
                    <a
                      href={extras.googleLink ?? '#'}
                      target={sample ? undefined : '_blank'}
                      rel="noopener noreferrer"
                      onClick={(e) => {
                        if (sample) e.preventDefault()
                        pressGoogle(score)
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        minHeight: 44,
                        borderRadius: '0.6rem',
                        border: '1px solid var(--border-strong)',
                        background: 'var(--surface)',
                        color: 'var(--text-strong)',
                        fontWeight: 600,
                        textDecoration: 'none',
                      }}
                    >
                      <span aria-hidden style={{ fontWeight: 800, color: '#4285f4' }}>
                        G
                      </span>
                      {R.googleButton}
                    </a>
                    {copied ? <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-green-700)', fontWeight: 600 }}>{R.copied}</p> : null}
                    {pressed && !copied ? <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-green-700)', fontWeight: 600 }}>{R.googlePressed}</p> : null}
                  </div>
                ) : null}
              </>
            ) : null}
            <div style={{ marginTop: '1.6rem', borderTop: '1px solid var(--border)', paddingTop: '0.7rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              {extras.portalUrl ? (
                <>
                  {R.everything}{' '}
                  <a href={sample ? '#sample' : extras.portalUrl} style={{ color: 'var(--text-link)' }}>
                    {portalReadable(extras.portalUrl)}
                  </a>
                  {' · '}
                </>
              ) : null}
              {R.callUs}{' '}
              <a href={`tel:${extras.company.phone.replace(/[^\d+]/g, '')}`} style={{ color: 'var(--text-link)', whiteSpace: 'nowrap' }}>
                {extras.company.phone}
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
