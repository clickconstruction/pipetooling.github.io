/**
 * Public supply house quote page — /q/:token (RFQ Phase 2, v2.2631 —
 * docs/SUPPLY_HOUSE_RFQ_PLAN.md). The link a "Copy with quote link" paste
 * carries. Mobile-first: a counter guy fills it with his thumb between
 * customers — big touch targets, one line at a time, sticky submit. Drafts
 * persist per token in localStorage so an interruption ten lines in loses
 * nothing. Partial quotes are fine; "can't supply" is an answer too.
 * Customer-facing surface → light theme pinned (BidRoom precedent).
 */
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

type PageData = {
  status: string
  bidName?: string
  supplyHouse?: string | null
  neededBy?: string | null
  plansLink?: string | null
  /** Rung C (v2.2646): this house's own last prices, keyed lower(fixture); filled only on an explicit tap. */
  prior?: { newestAt: string; prices: Record<string, number> } | null
  lines?: Array<{ fixture: string; count: number; unit?: string | null }>
}

type DraftLine = { price: string; cantSupply: boolean; note: string; fromPrior?: boolean }
type Draft = { quotedBy: string; validUntil: string; freight: string; lines: Record<string, DraftLine> }

const EMPTY_LINE: DraftLine = { price: '', cantSupply: false, note: '' }

function draftKey(token: string) {
  return `rfqQuoteDraft_${token}`
}

function loadDraft(token: string): Draft {
  try {
    const raw = window.localStorage.getItem(draftKey(token))
    if (raw) return JSON.parse(raw) as Draft
  } catch {
    /* fresh draft */
  }
  return { quotedBy: '', validUntil: '', freight: '', lines: {} }
}

function strToCents(s: string): number | null {
  const n = Number(s.replace(/[$,\s]/g, ''))
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null
}

export default function SupplyHouseQuotePage() {
  const { token = '' } = useParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState<PageData | null>(null)
  const [draft, setDraft] = useState<Draft>(() => loadDraft(token))
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState<number | null>(null)

  useEffect(() => {
    if (!token) {
      setError('This link is incomplete.')
      setLoading(false)
      return
    }
    const ac = new AbortController()
    void (async () => {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/get-rfq-quote-page?t=${encodeURIComponent(token)}`, {
          headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
          signal: ac.signal,
        })
        if (res.status === 404) {
          setError('This quote link doesn’t exist — check the link you were sent.')
          return
        }
        if (!res.ok) throw new Error('fetch failed')
        setPage((await res.json()) as PageData)
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          setError('Couldn’t load the quote request. Check your connection and reload.')
        }
      } finally {
        setLoading(false)
      }
    })()
    return () => ac.abort()
  }, [token])

  useEffect(() => {
    if (!token || done != null) return
    try {
      window.localStorage.setItem(draftKey(token), JSON.stringify(draft))
    } catch {
      /* draft just won't survive a reload */
    }
  }, [draft, token, done])

  function patchLine(fixture: string, patch: Partial<DraftLine>) {
    // Any hand edit clears the "from last time" tag — the vendor owns it now.
    setDraft((d) => ({ ...d, lines: { ...d.lines, [fixture]: { ...(d.lines[fixture] ?? EMPTY_LINE), fromPrior: false, ...patch, ...(patch.fromPrior === undefined ? { fromPrior: false } : {}) } } }))
  }

  /** One deliberate tap: fill empty lines with this house's own last prices. */
  function fillFromPrior() {
    const prices = page?.prior?.prices
    if (!prices || !page?.lines) return
    setDraft((d) => {
      const next = { ...d.lines }
      for (const l of page.lines ?? []) {
        const cents = prices[l.fixture.trim().toLowerCase()]
        const existing = next[l.fixture]
        if (cents != null && (!existing || (!existing.cantSupply && existing.price.trim() === ''))) {
          next[l.fixture] = { price: (cents / 100).toFixed(2), cantSupply: false, note: existing?.note ?? '', fromPrior: true }
        }
      }
      return { ...d, lines: next }
    })
  }

  const priorAgeDays = page?.prior?.newestAt ? Math.max(0, Math.floor((Date.now() - new Date(page.prior.newestAt).getTime()) / 86_400_000)) : null
  const priorCount = page?.prior ? (page.lines ?? []).filter((l) => page.prior?.prices[l.fixture.trim().toLowerCase()] != null).length : 0

  const answered = useMemo(
    () =>
      (page?.lines ?? []).filter((l) => {
        const dl = draft.lines[l.fixture]
        return dl && (dl.cantSupply || strToCents(dl.price) != null)
      }).length,
    [page, draft],
  )

  async function submit() {
    if (!page?.lines || answered === 0) return
    setSubmitting(true)
    try {
      const lines = page.lines
        .map((l) => {
          const dl = draft.lines[l.fixture]
          if (!dl) return null
          const cents = dl.cantSupply ? null : strToCents(dl.price)
          if (!dl.cantSupply && cents == null) return null
          return { fixture: l.fixture, unitPriceEachCents: cents, cantSupply: dl.cantSupply, note: dl.note.trim() || null }
        })
        .filter((l): l is NonNullable<typeof l> => l != null)
      const res = await fetch(`${supabaseUrl}/functions/v1/submit-rfq-quote`, {
        method: 'POST',
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          quotedBy: draft.quotedBy.trim() || undefined,
          validUntil: draft.validUntil || undefined,
          freightCents: strToCents(draft.freight) ?? undefined,
          lines,
        }),
      })
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; savedLines?: number; error?: string }
      if (res.status === 410) {
        setError('This request has been closed — no prices needed anymore.')
        return
      }
      if (!res.ok || !body.ok) throw new Error(body.error || 'submit failed')
      setDone(body.savedLines ?? lines.length)
      try {
        window.localStorage.removeItem(draftKey(token))
      } catch {
        /* fine */
      }
    } catch (err) {
      setError(err instanceof Error && err.message !== 'submit failed' ? err.message : 'Couldn’t send the quote. Your entries are saved on this phone — try again in a minute.')
    } finally {
      setSubmitting(false)
    }
  }

  const input: React.CSSProperties = {
    padding: '0.65rem 0.7rem',
    border: '1px solid var(--border-strong)',
    borderRadius: 8,
    font: 'inherit',
    fontSize: '1rem',
    background: 'var(--surface)',
    color: 'var(--text-strong)',
    width: '100%',
    boxSizing: 'border-box',
  }

  return (
    <div data-theme="light" style={{ minHeight: '100vh', background: 'var(--bg-subtle)', color: 'var(--text-strong)' }}>
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '1rem 1rem 6.5rem' }}>
        {loading ? (
          <p style={{ color: 'var(--text-muted)', padding: '3rem 0', textAlign: 'center' }}>Loading…</p>
        ) : error ? (
          <div style={{ padding: '3rem 0.5rem', textAlign: 'center' }}>
            <p style={{ fontSize: '1.05rem', color: 'var(--text-strong)', margin: 0 }}>{error}</p>
          </div>
        ) : page?.status === 'closed' ? (
          <div style={{ padding: '3rem 0.5rem', textAlign: 'center' }}>
            <p style={{ fontSize: '1.05rem', margin: 0 }}>This pricing request has been closed.</p>
            <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>Nothing needed — thanks for looking.</p>
          </div>
        ) : done != null ? (
          <div style={{ padding: '3rem 0.5rem', textAlign: 'center' }}>
            <p style={{ fontSize: '1.4rem', margin: 0 }}>✓ Quote sent</p>
            <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              {done} line{done === 1 ? '' : 's'} on {page?.bidName ?? 'the job'}. You can reopen this link to send a revised quote.
            </p>
          </div>
        ) : page ? (
          <>
            <header style={{ margin: '0.5rem 0 1rem' }}>
              <h1 style={{ fontSize: '1.25rem', margin: 0 }}>Price these parts</h1>
              <p style={{ color: 'var(--text-muted)', margin: '0.3rem 0 0', fontSize: '0.9rem' }}>
                {page.bidName}
                {page.supplyHouse ? ` · for ${page.supplyHouse}` : ''}
                {page.neededBy ? ` · needed by ${page.neededBy}` : ''}
              </p>
              <p style={{ color: 'var(--text-muted)', margin: '0.3rem 0 0', fontSize: '0.8rem' }}>
                Price what you can — $ each (or per ft where the line is footage). Skip what you don’t carry, or tap “can’t supply”. Your entries save on this phone as you go.
              </p>
              {page.plansLink ? (
                <a href={page.plansLink} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-link)' }}>
                  Job plans (cut sheets, details) ↗
                </a>
              ) : null}
              {priorCount > 0 ? (
                <div style={{ marginTop: '0.7rem', background: '#eef4ff', border: '1px solid #c7d8f8', borderRadius: 8, padding: '0.6rem 0.85rem' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>You priced {priorCount} of these for us before</span>
                  {priorAgeDays != null ? <span style={{ color: '#5b6577', fontSize: '0.8rem' }}> (newest {priorAgeDays === 0 ? 'today' : `${priorAgeDays} day${priorAgeDays === 1 ? '' : 's'} ago`})</span> : null}
                  <div style={{ marginTop: '0.45rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button type="button" onClick={fillFromPrior} style={{ background: '#2563eb', color: '#fff', fontWeight: 700, padding: '0.45rem 1rem', borderRadius: 7, fontSize: '0.85rem', border: 'none', cursor: 'pointer', font: 'inherit' }}>
                      Fill with last time’s prices
                    </button>
                    <span style={{ color: '#5b6577', fontSize: '0.78rem' }}>then just change what moved</span>
                  </div>
                </div>
              ) : null}
            </header>

            <div style={{ display: 'grid', gap: '0.6rem', marginBottom: '1rem' }}>
              <input style={input} placeholder="Your name / branch (optional)" value={draft.quotedBy} onChange={(e) => setDraft((d) => ({ ...d, quotedBy: e.target.value }))} />
              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <label style={{ flex: 1, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Prices good until
                  <input style={{ ...input, marginTop: 4 }} type="date" value={draft.validUntil} onChange={(e) => setDraft((d) => ({ ...d, validUntil: e.target.value }))} />
                </label>
                <label style={{ flex: 1, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Freight $ (optional)
                  <input style={{ ...input, marginTop: 4 }} inputMode="decimal" placeholder="0" value={draft.freight} onChange={(e) => setDraft((d) => ({ ...d, freight: e.target.value }))} />
                </label>
              </div>
            </div>

            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {(page.lines ?? []).map((l) => {
                const dl = draft.lines[l.fixture] ?? EMPTY_LINE
                const unit = (l.unit ?? '').trim()
                return (
                  <div key={l.fixture} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.7rem 0.75rem', opacity: dl.cantSupply ? 0.75 : 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'baseline' }}>
                      <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '0.95rem', overflowWrap: 'anywhere' }}>{l.fixture}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>× {l.count}{unit ? ` ${unit}` : ''}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', alignItems: 'center' }}>
                      <input
                        style={{ ...input, width: '7.5rem', textAlign: 'right', ...(dl.fromPrior ? { borderColor: '#2563eb' } : {}) }}
                        inputMode="decimal"
                        placeholder="$"
                        aria-label={`Price for ${l.fixture}`}
                        disabled={dl.cantSupply}
                        value={dl.price}
                        onChange={(e) => patchLine(l.fixture, { price: e.target.value })}
                      />
                      {dl.fromPrior ? <span style={{ fontSize: '0.7rem', color: 'var(--text-link)', fontWeight: 600, whiteSpace: 'nowrap' }}>from last time</span> : null}
                      <button
                        type="button"
                        onClick={() => patchLine(l.fixture, { cantSupply: !dl.cantSupply })}
                        style={{
                          padding: '0.55rem 0.7rem',
                          borderRadius: 8,
                          border: dl.cantSupply ? '1px solid #f59e0b' : '1px solid var(--border-strong)',
                          background: dl.cantSupply ? 'var(--bg-yellow-tint)' : 'var(--surface)',
                          color: dl.cantSupply ? 'var(--text-amber-700)' : 'var(--text-muted)',
                          font: 'inherit',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        can’t supply
                      </button>
                      <input
                        style={{ ...input, flex: 1, minWidth: 0 }}
                        placeholder="note (alt brand…)"
                        aria-label={`Note for ${l.fixture}`}
                        value={dl.note}
                        onChange={(e) => patchLine(l.fixture, { note: e.target.value })}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        ) : null}
      </div>

      {page && page.status !== 'closed' && done == null && !loading && !error ? (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--surface)', borderTop: '1px solid var(--border)', padding: '0.75rem 1rem calc(0.75rem + env(safe-area-inset-bottom))' }}>
          <div style={{ maxWidth: 560, margin: '0 auto', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', flex: 1 }}>
              {answered} of {page.lines?.length ?? 0} lines answered{answered > 0 ? ' — partial is fine' : ''}
            </span>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={submitting || answered === 0}
              style={{
                padding: '0.8rem 1.4rem',
                background: answered === 0 ? 'var(--bg-200)' : '#16a34a',
                color: answered === 0 ? 'var(--text-faint)' : 'white',
                border: 'none',
                borderRadius: 10,
                font: 'inherit',
                fontSize: '1rem',
                fontWeight: 700,
                cursor: submitting || answered === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? 'Sending…' : 'Send quote'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
