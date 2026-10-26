import { useEffect, useState, type CSSProperties } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import AuthPublicLandingLayout from '../components/AuthPublicLandingLayout'
import { publicFunctionHeaders, SAMPLE_BANNER_TEXT, sampleStateFromToken } from '../lib/customerSampleMode'
import { PORTAL_SPANISH_ON } from '../lib/gc/portalI18n'
import {
  answered,
  portalReadable,
  REVIEW_GOOD_STARS,
  reviewView,
  reviewWords,
  sampleReviewAnswer,
  sendWords,
  showGoogleAsk,
  starWord,
  type ReviewAnswer,
  type ReviewLang,
  type ReviewView,
} from '../lib/reviews/reviewPage'

/**
 * `/r/:token` (v2.5896, punch list #185): the customer's review page. Opened from the Review asked step's text after
 * a job is paid: five stars, a line in their words, Send. At five stars the ask to put it on Google with the
 * company's own link; at fewer, what we could have done better and the office's call. Public, light, in the
 * customer's language; the `customer-review` function answers by the token. The sample tokens draw the What
 * customers see fixture and save nothing.
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const FUNCTION_URL = `${supabaseUrl}/functions/v1/customer-review`

const STAR_ON = '#f59e0b'
const GO = '#2563eb'

const S = {
  shell: { display: 'grid', gap: '0.9rem', fontSize: '1rem', lineHeight: 1.45, color: 'var(--text-base)' } as CSSProperties,
  co: { display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-strong)' } as CSSProperties,
  lang: { marginLeft: 'auto', font: 'inherit', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-link)', background: 'none', border: 0, padding: 0, cursor: 'pointer' } as CSSProperties,
  h1: { margin: 0, fontSize: '1.45rem', lineHeight: 1.2, color: 'var(--text-strong)', textWrap: 'balance' } as CSSProperties,
  sub: { margin: 0, color: 'var(--text-600)', fontSize: '0.95rem' } as CSSProperties,
  stars: { display: 'flex', gap: '0.3rem', justifyContent: 'center', padding: '0.2rem 0' } as CSSProperties,
  star: (on: boolean, small: boolean): CSSProperties => ({ border: 0, background: 'transparent', fontSize: small ? '1.8rem' : '2.9rem', lineHeight: 1, color: on ? STAR_ON : 'var(--text-faint)', cursor: small ? 'default' : 'pointer', padding: '0.1rem', minWidth: small ? 0 : 48, minHeight: small ? 0 : 48 }),
  starWord: { textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)', minHeight: '1.2rem' } as CSSProperties,
  ta: { width: '100%', minHeight: 88, border: '1px solid var(--border-strong)', borderRadius: 10, padding: '0.6rem 0.75rem', font: 'inherit', color: 'var(--text-strong)', background: 'var(--surface)', resize: 'vertical', boxSizing: 'border-box' } as CSSProperties,
  btn: (primary: boolean): CSSProperties => ({ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', width: '100%', minHeight: 48, borderRadius: 10, fontWeight: 700, fontSize: '1rem', padding: '0.7rem 1rem', border: `1px solid ${primary ? GO : 'var(--border-strong)'}`, background: primary ? GO : 'var(--surface)', color: primary ? '#fff' : 'var(--text-strong)', cursor: 'pointer', font: 'inherit', textDecoration: 'none' }),
  fine: { margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' } as CSSProperties,
  card: (tone: 'plain' | 'good' | 'ask'): CSSProperties => ({ border: '1px solid var(--border)', borderRadius: 12, padding: '0.75rem 0.9rem', background: tone === 'good' ? 'var(--bg-green-tint)' : tone === 'ask' ? 'var(--bg-amber-tint)' : 'var(--bg-subtle)', display: 'grid', gap: '0.5rem' }),
  thanks: { margin: 0, fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-strong)' } as CSSProperties,
  foot: { borderTop: '1px solid var(--border)', paddingTop: '0.6rem', fontSize: '0.82rem', color: 'var(--text-muted)' } as CSSProperties,
  copied: { margin: 0, fontSize: '0.82rem', color: 'var(--text-green-700)', fontWeight: 600 } as CSSProperties,
  problem: { margin: 0, fontSize: '0.85rem', color: 'var(--text-red-700)' } as CSSProperties,
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <AuthPublicLandingLayout titleLinkText="Click Plumbing and Electrical" titleLinkAriaLabel="Visit Click Plumbing and Electrical (opens in new tab)" compact>
      <div className="auth-public-landing__signin-stack">
        <div className="auth-public-landing__signin-box" data-theme="light">
          {children}
        </div>
      </div>
    </AuthPublicLandingLayout>
  )
}

function Stars({ value, onPick, small }: { value: number; onPick?: (n: number) => void; small?: boolean }) {
  return (
    <div style={S.stars} role={onPick ? 'radiogroup' : undefined} aria-label={onPick ? 'Stars' : undefined}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" style={S.star(n <= value, Boolean(small))} onClick={onPick ? () => onPick(n) : undefined} disabled={!onPick} aria-label={`${n} ${n === 1 ? 'star' : 'stars'}`} aria-pressed={onPick ? n <= value : undefined} tabIndex={onPick ? 0 : -1}>
          ★
        </button>
      ))}
    </div>
  )
}

export default function CustomerReview() {
  const { token = '' } = useParams<{ token: string }>()
  const [params] = useSearchParams()
  const sample = sampleStateFromToken(token)
  const [view, setView] = useState<ReviewView>(() => (sample ? { kind: 'ready', answer: sampleReviewAnswer(sample) } : token ? { kind: 'loading' } : { kind: 'not_found' }))
  const [langPick, setLangPick] = useState<ReviewLang | null>(params.get('lang') === 'es' ? 'es' : params.get('lang') === 'en' ? 'en' : null)
  const [stars, setStars] = useState(0)
  const [words, setWords] = useState('')
  const [better, setBetter] = useState('')
  const [betterSent, setBetterSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const answer: ReviewAnswer | null = view.kind === 'ready' ? view.answer : null
  const lang: ReviewLang = PORTAL_SPANISH_ON ? (langPick ?? answer?.lang ?? 'en') : 'en'
  const w = reviewWords(lang)

  useEffect(() => {
    document.title = `${w.pageTitle} · Click Plumbing and Electrical`
  }, [w.pageTitle])

  useEffect(() => {
    if (sample || !token) return
    let live = true
    ;(async () => {
      try {
        const res = await fetch(`${FUNCTION_URL}?t=${encodeURIComponent(token)}`, { headers: await publicFunctionHeaders(null) })
        const body: unknown = await res.json().catch(() => null)
        if (live) setView(reviewView(res.status, body))
      } catch {
        if (live) setView({ kind: 'error' })
      }
    })()
    return () => {
      live = false
    }
  }, [token, sample])

  async function post(body: Record<string, unknown>): Promise<unknown> {
    const res = await fetch(FUNCTION_URL, { method: 'POST', headers: { ...(await publicFunctionHeaders(null)), 'Content-Type': 'application/json' }, body: JSON.stringify({ token, ...body }) })
    const json: unknown = await res.json().catch(() => null)
    if (!res.ok) throw new Error(typeof (json as { error?: unknown })?.error === 'string' ? String((json as { error: string }).error) : `HTTP ${res.status}`)
    return json
  }

  async function send() {
    if (!answer || stars < 1 || sending) return
    setProblem(null)
    if (answer.sample) {
      setView({ kind: 'ready', answer: answered(answer, stars, words) })
      return
    }
    setSending(true)
    try {
      const json = await post({ stars, words, lang })
      const next = reviewView(200, json)
      setView(next.kind === 'ready' ? next : { kind: 'ready', answer: answered(answer, stars, words) })
    } catch {
      setProblem(w.error)
    } finally {
      setSending(false)
    }
  }

  async function sendBetter() {
    if (!answer || !better.trim() || sending) return
    setProblem(null)
    const said = better.trim()
    if (answer.sample) {
      setView({ kind: 'ready', answer: { ...answer, better: said } })
      setBetterSent(true)
      return
    }
    setSending(true)
    try {
      await post({ action: 'better', better: said })
      setView({ kind: 'ready', answer: { ...answer, better: said } })
      setBetterSent(true)
    } catch {
      setProblem(w.error)
    } finally {
      setSending(false)
    }
  }

  function pressGoogle() {
    if (!answer) return
    const text = answer.words ?? ''
    if (text) {
      try {
        void navigator.clipboard?.writeText(text)
        setCopied(true)
      } catch {
        /* the link still opens */
      }
    }
    if (!answer.sample) void post({ action: 'google' }).catch(() => undefined)
  }

  const banner = sample ? <p style={{ ...S.fine, background: 'var(--bg-amber-tint)', border: '1px solid var(--border-amber)', borderRadius: 8, padding: '0.4rem 0.6rem' }}>{SAMPLE_BANNER_TEXT}</p> : null
  // The layout's header already names the company; this line holds only the language switch, and only once Spanish is on.
  const company =
    PORTAL_SPANISH_ON && answer ? (
      <div style={S.co}>
        <button type="button" style={S.lang} onClick={() => setLangPick(lang === 'es' ? 'en' : 'es')}>
          {w.langLink}
        </button>
      </div>
    ) : null
  const footer = answer ? (
    <div style={S.foot}>
      {answer.portalUrl ? (
        <>
          {w.everything}{' '}
          <a href={answer.sample ? '#sample' : answer.portalUrl} style={{ color: 'var(--text-link)' }}>
            {portalReadable(answer.portalUrl)}
          </a>
          {answer.company.phone ? ' · ' : ''}
        </>
      ) : null}
      {answer.company.phone ? (
        <>
          {w.callUs}{' '}
          <a href={`tel:${answer.company.phone.replace(/[^\d+]/g, '')}`} style={{ color: 'var(--text-link)', whiteSpace: 'nowrap' }}>
            {answer.company.phone}
          </a>
        </>
      ) : null}
    </div>
  ) : null

  if (view.kind === 'loading') {
    return (
      <Shell>
        <div style={S.shell}>
          {company}
          <p style={S.sub}>{w.loading}</p>
        </div>
      </Shell>
    )
  }
  if (view.kind !== 'ready') {
    const line = view.kind === 'not_found' ? w.notFound : view.kind === 'expired' ? w.expired : w.error
    return (
      <Shell>
        <div style={S.shell}>
          {company}
          <h1 style={S.h1}>{w.pageTitle}</h1>
          <p style={S.sub} role="alert">
            {line}
          </p>
          <div style={S.foot}>
            {w.callUs} <a href="tel:+15123600599" style={{ color: 'var(--text-link)', whiteSpace: 'nowrap' }}>(512) 360-0599</a>
          </div>
        </div>
      </Shell>
    )
  }

  const a = view.answer
  if (a.state === 'open') {
    return (
      <Shell>
        <div style={S.shell}>
          {banner}
          {company}
          <h1 style={S.h1}>{w.question(a.first, a.jobName)}</h1>
          <p style={S.sub}>{w.sub}</p>
          <Stars value={stars} onPick={setStars} />
          <div style={S.starWord} aria-live="polite">
            {starWord(stars, lang)}
          </div>
          <textarea style={S.ta} value={words} onChange={(e) => setWords(e.target.value.slice(0, 1000))} placeholder={w.wordsHint} aria-label={w.wordsHint} maxLength={1000} />
          <button type="button" style={{ ...S.btn(true), opacity: stars < 1 ? 0.45 : 1 }} disabled={stars < 1 || sending} onClick={() => void send()}>
            {sendWords(stars, sending, lang)}
          </button>
          {problem ? (
            <p style={S.problem} role="alert">
              {problem}
            </p>
          ) : null}
          <p style={S.fine}>{w.fine(a.company.name)}</p>
          {footer}
        </div>
      </Shell>
    )
  }

  const good = (a.stars ?? 0) >= REVIEW_GOOD_STARS
  const google = showGoogleAsk(a.stars, a.googleLink)
  const googleCard = google ? (
    <div style={S.card('ask')}>
      <p style={{ margin: 0 }}>{good ? w.googleAsk : w.googleAskLow}</p>
      {a.googlePressed ? (
        <p style={S.copied}>{w.googlePressed}</p>
      ) : (
        <a href={a.googleLink ?? '#'} target={a.sample ? undefined : '_blank'} rel="noopener noreferrer" style={S.btn(false)} onClick={a.sample ? (e) => { e.preventDefault(); pressGoogle() } : pressGoogle}>
          <span aria-hidden="true" style={{ fontWeight: 800, color: '#4285f4' }}>G</span>
          {w.googleButton}
        </a>
      )}
      {copied ? <p style={S.copied}>{w.copied}</p> : null}
    </div>
  ) : null

  return (
    <Shell>
      <div style={S.shell}>
        {banner}
        {company}
        <Stars value={a.stars ?? 0} small />
        <p style={S.thanks}>{good ? w.thanks(a.first) : w.thanksLow(a.first)}</p>
        {a.words ? (
          <div style={S.card(good ? 'good' : 'plain')}>
            <p style={{ margin: 0 }}>
              <b>{w.yourWords}</b> “{a.words}”
            </p>
          </div>
        ) : null}
        {good ? (
          <>
            {googleCard}
            <p style={S.fine}>{w.officeReads(a.company.name)}</p>
          </>
        ) : (
          <>
            {a.better || betterSent ? (
              <div style={S.card('plain')}>
                <p style={{ margin: 0 }}>
                  <b>{w.better}</b> {a.better ? `“${a.better}”` : ''}
                </p>
                <p style={S.copied}>{w.betterSent}</p>
              </div>
            ) : (
              <>
                <p style={{ ...S.sub, color: 'var(--text-strong)', fontWeight: 700 }}>{w.better}</p>
                <textarea style={S.ta} value={better} onChange={(e) => setBetter(e.target.value.slice(0, 1000))} placeholder={w.betterHint} aria-label={w.better} maxLength={1000} />
                <button type="button" style={{ ...S.btn(true), opacity: !better.trim() ? 0.45 : 1 }} disabled={!better.trim() || sending} onClick={() => void sendBetter()}>
                  {sending ? w.sending : w.betterSend}
                </button>
              </>
            )}
            <div style={S.card('ask')}>
              <p style={{ margin: 0 }}>
                <b>{w.call}</b>
              </p>
            </div>
            {googleCard}
          </>
        )}
        {problem ? (
          <p style={S.problem} role="alert">
            {problem}
          </p>
        ) : null}
        {footer}
      </div>
    </Shell>
  )
}
