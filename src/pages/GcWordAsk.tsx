import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useSearchParams } from 'react-router-dom'
import { staffAwarePublicHeaders } from '../lib/publicFunctionStaffHeaders'
import { PUBLIC_PREVIEW_PARAM, isPreviewFlag } from '../lib/publicViewCounting'
import { CARD, COPPER, FAINT, HAIR, INK, MUTED, PAPER, PAPER_GREEN, PAPER_RED, PORTAL_FONT } from '../lib/portal/portalTheme'
import { WORD_ASK_NOTE_MAX, WORD_ASK_NOTE_MIN, WORD_ASK_TEMPERATURES, type WordAskGc, type WordAskTemperature } from '../lib/gcWordAsk'
import { gcWordAskDraftsFromPage, gcWordAskSubmission, parseGcWordAskPage, type GcWordAskDraft, type GcWordAskPage } from '../lib/gcWordAskPage'

/**
 * Ask by link (punch list #49, step 7): the no-login page behind the link the
 * office sends an account man (`/ask?t=<token>`). His GCs, what each owes,
 * what was last said and the date they promised; for each, a temperature, a
 * sentence and a pay date. His answers wait for the office to read — nothing
 * here marks a statement sent or writes the week's record. Built for a phone.
 * Pinned light like every page that opens without a sign-in.
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string

type PageState = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; page: GcWordAskPage }

const TEMP_HINT: Record<WordAskTemperature, string> = { hot: 'pay date in hand', warm: 'fine, no date', cool: 'dodging the date', cold: 'disputing or upset' }
const TEMP_TONE: Record<WordAskTemperature, { bg: string; fg: string }> = {
  hot: { bg: '#E1F5EE', fg: '#085041' },
  warm: { bg: '#FAEEDA', fg: '#633806' },
  cool: { bg: '#E6F1FB', fg: '#0C447C' },
  cold: { bg: '#FCEBEB', fg: '#791F1F' },
}

const card: CSSProperties = { background: CARD, border: `1px solid ${HAIR}`, borderRadius: 8, padding: '14px 16px', marginBottom: 12 }
const field: CSSProperties = { width: '100%', boxSizing: 'border-box', font: 'inherit', fontSize: 16, padding: '9px 10px', border: `1px solid ${HAIR}`, borderRadius: 6, background: PAPER, color: INK }

const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`
const ymdLabel = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })
}
const firstName = (name: string) => name.trim().split(/\s+/)[0] || ''

export default function GcWordAsk() {
  const [params] = useSearchParams()
  const token = params.get('t') || params.get('token') || ''
  const preview = isPreviewFlag(params.get(PUBLIC_PREVIEW_PARAM))
  const [state, setState] = useState<PageState>({ kind: 'loading' })
  const [drafts, setDrafts] = useState<Record<string, GcWordAskDraft>>({})
  const [website, setWebsite] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [savedCount, setSavedCount] = useState<number | null>(null)

  useEffect(() => {
    if (!token) {
      setState({ kind: 'error', message: 'This link is missing its key. Please use the exact link the office sent you.' })
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/gc-word-ask?token=${encodeURIComponent(token)}${preview ? `&${PUBLIC_PREVIEW_PARAM}=1` : ''}`, { headers: await staffAwarePublicHeaders() })
        const body = (await res.json().catch(() => null)) as unknown
        if (cancelled) return
        if (!res.ok) {
          const msg = body && typeof body === 'object' && typeof (body as { error?: unknown }).error === 'string' ? (body as { error: string }).error : 'We could not open this link.'
          setState({ kind: 'error', message: msg })
          return
        }
        const page = parseGcWordAskPage(body)
        if (!page) {
          setState({ kind: 'error', message: 'The office answered in a shape this page does not understand. Please tell the office.' })
          return
        }
        setState({ kind: 'ready', page })
        setDrafts(gcWordAskDraftsFromPage(page))
      } catch {
        if (!cancelled) setState({ kind: 'error', message: 'We could not reach the office. Check your connection and try again.' })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, preview])

  const page = state.kind === 'ready' ? state.page : null
  const submission = useMemo(() => (page ? gcWordAskSubmission(page, drafts) : null), [page, drafts])

  const setDraft = (gcId: string, patch: Partial<GcWordAskDraft>) => {
    setDrafts((prev) => ({ ...prev, [gcId]: { ...(prev[gcId] ?? { temperature: null, note: '', payBy: '', noChange: false }), ...patch } }))
    setProblem(null)
    setSavedCount(null)
  }

  const submit = async () => {
    if (!page || !submission || busy) return
    if (submission.problem) {
      setProblem(submission.problem)
      return
    }
    if (preview) {
      setProblem('Preview — nothing is saved from here.')
      return
    }
    setBusy(true)
    setProblem(null)
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/gc-word-ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await staffAwarePublicHeaders()) },
        body: JSON.stringify({ token, answers: submission.answers, website }),
      })
      const body = (await res.json().catch(() => null)) as { ok?: boolean; saved?: number; error?: string } | null
      if (!res.ok || !body?.ok) {
        setProblem(body?.error ?? 'Could not save your answers. Please try again.')
        return
      }
      setSavedCount(body.saved ?? submission.answers.length)
    } catch {
      setProblem('Could not reach the office. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  const shell = (children: React.ReactNode) => (
    <div data-theme="light" style={{ background: PAPER, color: INK, minHeight: '100vh', fontFamily: PORTAL_FONT, padding: '22px 16px 60px' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>{children}</div>
    </div>
  )

  if (state.kind === 'loading') return shell(<p style={{ color: MUTED }}>Opening…</p>)
  if (state.kind === 'error' || !page) {
    return shell(
      <div style={card} role="alert">
        <h1 style={{ margin: '0 0 6px', fontSize: 19 }}>This link did not open</h1>
        <p style={{ margin: 0, color: MUTED, lineHeight: 1.5 }}>{state.kind === 'error' ? state.message : ''}</p>
      </div>,
    )
  }

  const asker = firstName(page.askedByName) || 'the office'
  const total = page.gcs.reduce((t, g) => t + g.amount, 0)
  const answeredCount = submission?.answers.length ?? 0

  return shell(
    <>
      <p style={{ margin: '0 0 2px', fontSize: 11, letterSpacing: '0.07em', textTransform: 'uppercase', color: FAINT }}>Where your GCs stand</p>
      <h1 style={{ margin: '0 0 6px', fontSize: 22, lineHeight: 1.2 }}>
        {firstName(page.ownerName) || 'Hello'}, {page.gcs.length === 1 ? 'one GC' : `${page.gcs.length} GCs`} · {money(total)} owed
      </h1>
      <p style={{ margin: '0 0 16px', color: MUTED, lineHeight: 1.5, fontSize: 14.5 }}>
        For each one: their temperature, a sentence, and the date they said they’d pay. Skip any you have nothing on. {asker} reads your answers before anything is saved.
      </p>

      {page.gcs.length === 0 ? (
        <div style={card}>
          <p style={{ margin: 0, color: MUTED }}>None of the GCs on this link owes over the line any more. Nothing to answer.</p>
        </div>
      ) : null}

      {page.gcs.map((g: WordAskGc) => {
        const d = drafts[g.gcId] ?? { temperature: null, note: '', payBy: '', noChange: false }
        const locked = g.answer?.status === 'accepted'
        return (
          <section key={g.gcId} style={{ ...card, borderLeft: g.promise?.late ? `4px solid ${PAPER_RED}` : card.border }} data-testid="gc-word-ask-gc" aria-label={g.gcName}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
              <h2 style={{ margin: 0, fontSize: 17 }}>{g.gcName}</h2>
              <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{money(g.amount)}</span>
            </div>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: MUTED }}>
              {g.oldestAgeDays != null ? `oldest bill ${g.oldestAgeDays} days` : 'billed'}
              {g.over90 > 0 ? ` · ${money(g.over90)} over 90 days` : ''}
            </p>
            {g.promise ? (
              <p style={{ margin: '4px 0 0', fontSize: 13, fontWeight: 700, color: g.promise.late ? PAPER_RED : PAPER_GREEN }}>
                {g.promise.late ? `promised ${ymdLabel(g.promise.payBy)} — ${g.promise.daysLate} day${g.promise.daysLate === 1 ? '' : 's'} late` : `pays by ${ymdLabel(g.promise.payBy)}`}
              </p>
            ) : null}
            <p style={{ margin: '6px 0 10px', fontSize: 13, color: MUTED, lineHeight: 1.45 }}>
              {g.lastWord
                ? `Last word ${new Date(g.lastWord.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}${g.lastWord.temperature ? ` · ${g.lastWord.temperature}` : ''} · “${g.lastWord.note}” — ${g.lastWord.by}`
                : 'Nobody has written down what this GC said.'}
            </p>

            {locked ? (
              <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: PAPER_GREEN }}>✓ {asker} has your answer for this one.</p>
            ) : (
              <>
                <div role="radiogroup" aria-label={`Temperature for ${g.gcName}`} style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6, marginBottom: 8 }}>
                  {WORD_ASK_TEMPERATURES.map((t) => {
                    const on = !d.noChange && d.temperature === t
                    const tone = TEMP_TONE[t]
                    return (
                      <button
                        key={t}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        aria-label={`${t[0]!.toUpperCase()}${t.slice(1)} — ${TEMP_HINT[t]}`}
                        disabled={d.noChange}
                        onClick={() => setDraft(g.gcId, { temperature: on ? null : t })}
                        style={{
                          font: 'inherit',
                          textAlign: 'left',
                          padding: '8px 10px',
                          borderRadius: 6,
                          border: on ? `2px solid ${tone.fg}` : `1px solid ${HAIR}`,
                          background: on ? tone.bg : CARD,
                          color: on ? tone.fg : INK,
                          opacity: d.noChange ? 0.5 : 1,
                          cursor: d.noChange ? 'default' : 'pointer',
                        }}
                      >
                        <b>
                          {t[0]!.toUpperCase()}
                          {t.slice(1)}
                        </b>
                        <span style={{ display: 'block', fontSize: 12, color: on ? tone.fg : MUTED }}>{TEMP_HINT[t]}</span>
                      </button>
                    )
                  })}
                </div>
                <textarea
                  value={d.noChange ? '' : d.note}
                  disabled={d.noChange}
                  rows={2}
                  maxLength={WORD_ASK_NOTE_MAX}
                  onChange={(e) => setDraft(g.gcId, { note: e.target.value })}
                  placeholder={d.noChange ? 'No change — the last word stands' : 'What did they say? A sentence.'}
                  aria-label={`What ${g.gcName} said`}
                  style={{ ...field, resize: 'vertical', marginBottom: 8 }}
                />
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <label htmlFor={`pay-${g.gcId}`} style={{ fontSize: 13, color: MUTED }}>
                    They said they’d pay by
                  </label>
                  <input id={`pay-${g.gcId}`} type="date" value={d.payBy} onChange={(e) => setDraft(g.gcId, { payBy: e.target.value })} style={{ ...field, width: 'auto', flex: '0 1 170px' }} />
                  {g.noChangeAllowed ? (
                    <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 13, color: MUTED, marginLeft: 'auto' }}>
                      <input type="checkbox" checked={d.noChange} onChange={(e) => setDraft(g.gcId, { noChange: e.target.checked })} style={{ margin: 0, width: 18, height: 18 }} />
                      no change
                    </label>
                  ) : null}
                </div>
              </>
            )}
          </section>
        )
      })}

      {/* Honeypot: people never see or fill this; a filled one is a bot and saves nothing. */}
      <input type="text" name="website" value={website} onChange={(e) => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden style={{ position: 'absolute', left: -9999, width: 1, height: 1, opacity: 0 }} />

      {page.gcs.length > 0 ? (
        <div style={{ position: 'sticky', bottom: 0, background: PAPER, padding: '10px 0 4px', borderTop: `1px solid ${HAIR}` }}>
          {problem ? (
            <p role="alert" style={{ margin: '0 0 8px', fontSize: 13.5, color: PAPER_RED, fontWeight: 600 }}>
              {problem}
            </p>
          ) : null}
          {savedCount != null ? (
            <p role="status" style={{ margin: '0 0 8px', fontSize: 14, color: PAPER_GREEN, fontWeight: 700 }}>
              ✓ Sent to {asker} — {savedCount} answer{savedCount === 1 ? '' : 's'}. You can change them here until {asker} has read them.
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy || answeredCount === 0}
            style={{ width: '100%', font: 'inherit', fontSize: 16, fontWeight: 700, padding: '12px 14px', borderRadius: 8, border: 'none', background: COPPER, color: CARD, opacity: busy || answeredCount === 0 ? 0.55 : 1, cursor: busy || answeredCount === 0 ? 'default' : 'pointer' }}
          >
            {busy ? 'Sending…' : answeredCount === 0 ? `Answer at least one (a sentence of ${WORD_ASK_NOTE_MIN}+ letters)` : `Send ${answeredCount} answer${answeredCount === 1 ? '' : 's'} to ${asker}`}
          </button>
          <p style={{ margin: '8px 0 0', fontSize: 12, color: FAINT, lineHeight: 1.45 }}>
            This link works until {new Date(page.expiresAt).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}. It shows what is owed to the company — please don’t forward it.
          </p>
        </div>
      ) : null}
    </>,
  )
}
