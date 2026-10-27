import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { messagesThreadHref } from '../../lib/messages/customerThread'
import { googleLinkProblem, ratingDay, recentAnswers, REVIEWS_BLOCK_WORDS as W, reviewsMonth, starsGlyphs, type OfficeRating } from '../../lib/ratings/ratingsOffice'
import { supabaseRatingsOfficeIo, type RatingsOfficeIo } from '../../lib/ratings/ratingsOfficeIo'
import { formatErrorMessage } from '../../utils/errorHandling'

/**
 * Settings → What customers see → **Reviews** (v2.5946, punch list #185 PR 4): the company's Google review link the
 * review page asks a customer to post on (`app_settings google_review_link_v1`, the owner's or a dev's to change), this
 * month's asks and answers, and the five newest answers, each opening the customer's thread. Read by everyone on the tab;
 * a training account reads and changes nothing.
 */

const CARD: CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', padding: '0.85rem 1rem', marginBottom: '0.9rem', display: 'grid', gap: '0.8rem' }
const MUTED: CSSProperties = { fontSize: '0.78rem', color: 'var(--text-muted)' }
const FIELD: CSSProperties = { font: 'inherit', fontSize: '0.85rem', width: '100%', boxSizing: 'border-box', padding: '0.4rem 0.5rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)' }
const PRIMARY: CSSProperties = { font: 'inherit', fontSize: '0.8rem', padding: '0.3rem 0.8rem', minHeight: 32, borderRadius: 6, border: '1px solid #2563eb', background: '#2563eb', color: 'white', fontWeight: 600, cursor: 'pointer' }
const STAT: CSSProperties = { display: 'grid', gap: 2, minWidth: '5.5rem' }
const STARS_ON = '#f59e0b'

/** Sixty days back: this month and the end of the last, for the list. */
const SINCE_DAYS = 60

export function SettingsReviewsBlock({ io: ioIn }: { io?: RatingsOfficeIo } = {}) {
  const { role, readOnly } = useAuth()
  const io = useMemo(() => ioIn ?? supabaseRatingsOfficeIo(), [ioIn])
  const canEdit = (role === 'dev' || role === 'master_technician') && !readOnly
  const [link, setLink] = useState('')
  const [saved, setSaved] = useState('')
  const [rows, setRows] = useState<OfficeRating[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    let live = true
    void io.googleLink().then((v) => {
      if (!live) return
      setLink(v)
      setSaved(v)
    })
    void io
      .recent(new Date(Date.now() - SINCE_DAYS * 24 * 3600 * 1000).toISOString())
      .then((r) => live && setRows(r))
      .catch(() => live && setRows([]))
    return () => {
      live = false
    }
  }, [io])

  const problem = googleLinkProblem(link)
  const month = rows ? reviewsMonth(rows) : null
  const recent = rows ? recentAnswers(rows) : []

  const save = async () => {
    if (problem || busy) return
    setBusy(true)
    setNote(null)
    try {
      await io.saveGoogleLink(link)
      setSaved(link.trim())
      setNote({ ok: true, text: W.saved })
    } catch (e) {
      setNote({ ok: false, text: formatErrorMessage(e, 'The link was not saved.') })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section style={CARD} aria-label={W.title}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: '0.95rem' }}>{W.title}</h3>
        <span style={MUTED}>{W.hint}</span>
      </div>

      <div style={{ display: 'grid', gap: 6 }}>
        <label htmlFor="google-review-link" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-strong)' }}>
          {W.linkLabel}
        </label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            id="google-review-link"
            style={{ ...FIELD, flex: '1 1 18rem', width: 'auto' }}
            value={link}
            placeholder="https://g.page/r/…/review"
            onChange={(e) => {
              setLink(e.target.value)
              setNote(null)
            }}
            readOnly={!canEdit}
            aria-describedby="google-review-link-help"
          />
          {canEdit ? (
            <button type="button" style={{ ...PRIMARY, opacity: problem || link.trim() === saved ? 0.5 : 1 }} disabled={Boolean(problem) || busy || link.trim() === saved} onClick={() => void save()}>
              {busy ? 'Saving…' : W.save}
            </button>
          ) : null}
        </div>
        <span id="google-review-link-help" style={MUTED}>
          {problem ?? W.linkHelp}
        </span>
        {!canEdit ? <span style={MUTED}>{W.readOnly}</span> : null}
        {note ? (
          <span role={note.ok ? 'status' : 'alert'} style={{ fontSize: '0.8rem', color: note.ok ? 'var(--text-green-700)' : 'var(--text-red-700)' }}>
            {note.text}
          </span>
        ) : null}
      </div>

      <div style={{ display: 'grid', gap: 6 }}>
        <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{W.monthCap}</span>
        {month ? (
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={STAT}>
              <span style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-strong)' }}>{month.asked}</span>
              <span style={MUTED}>asked</span>
            </div>
            <div style={STAT}>
              <span style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-strong)' }}>{month.answered}</span>
              <span style={MUTED}>answered</span>
            </div>
            <div style={STAT}>
              <span style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-strong)' }}>{month.average ?? '—'}</span>
              <span style={MUTED}>average stars</span>
            </div>
            <div style={STAT}>
              <span style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-strong)' }}>{month.googlePressed}</span>
              <span style={MUTED}>pressed Google</span>
            </div>
            <div style={STAT}>
              <span style={{ fontSize: '1.3rem', fontWeight: 800, color: month.low > month.called ? 'var(--text-red-700)' : 'var(--text-strong)' }}>
                {month.called} of {month.low}
              </span>
              <span style={MUTED}>low ones called</span>
            </div>
          </div>
        ) : (
          <span style={MUTED}>Reading…</span>
        )}
      </div>

      <div style={{ display: 'grid', gap: 6 }}>
        {rows && !recent.length ? <span style={MUTED}>{W.none}</span> : null}
        {recent.map((r) => (
          <div key={r.id} style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap', fontSize: '0.82rem', borderTop: '1px solid var(--border)', paddingTop: 6 }}>
            <span aria-label={`${r.score} stars`} style={{ color: STARS_ON, letterSpacing: 1 }}>
              {starsGlyphs(r.score ?? 0)}
            </span>
            {r.contactId ? (
              <a href={messagesThreadHref(r.contactId)} style={{ fontWeight: 600, color: 'var(--text-link)', textDecoration: 'none' }}>
                {r.customerName.trim() || 'A customer'}
              </a>
            ) : (
              <span style={{ fontWeight: 600 }}>{r.customerName.trim() || 'A customer'}</span>
            )}
            <span style={MUTED}>{ratingDay(r.answeredAt)}</span>
            {r.googlePressedAt ? <span style={MUTED}>· pressed Google</span> : null}
            {r.words.trim() ? <span style={{ color: 'var(--text-700)', flexBasis: '100%' }}>“{r.words.trim()}”</span> : null}
          </div>
        ))}
      </div>
    </section>
  )
}
