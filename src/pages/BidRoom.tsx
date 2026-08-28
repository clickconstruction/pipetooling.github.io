/**
 * The Bid Room — the GC's durable proposal page (Signable Bids Phase 1, v2.2468). One permanent
 * link per GC packet; always shows the latest PUBLISHED letter revision: base + offered
 * alternates as choices (the letter's own document model — fixture/count lists and one lump
 * total each), inclusions/exclusions/terms, the Google Docs letter riding along. Phase 2 adds
 * sign & decline right here.
 *
 * Customer-facing surface: pinned light, the accept flow's orange as the action accent.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import AuthPublicLandingLayout from '../components/AuthPublicLandingLayout'
import EstimateCustomerAttachmentCard from '../components/estimates/EstimateCustomerAttachmentCard'
import { acceptHeaderBrandImageSrc, acceptHeaderBrandLabel, parseAcceptHeaderBrand } from '../lib/estimateAcceptHeaderBrand'
import {
  parseBidRoomRevisionPayload,
  roomBaseOption,
  type BidRoomRevisionPayloadV1,
  type RoomOption,
} from '../lib/bids/bidRoomPayload'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

type RoomFetch = {
  revision: { id: string; rev_number: number; note: string; published_at: string }
  payload: BidRoomRevisionPayloadV1
  attachment: { url: string; label: string | null } | null
  outcome: { event_type: string; metadata: unknown; occurred_at: string } | null
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <AuthPublicLandingLayout
      titleLinkText="Click Plumbing and Electrical"
      titleLinkAriaLabel="Visit Click Plumbing and Electrical (opens in new tab)"
    >
      <div className="auth-public-landing__signin-stack auth-public-landing__signin-stack--wide">
        <div className="auth-public-landing__signin-box">{children}</div>
      </div>
    </AuthPublicLandingLayout>
  )
}

function formatMoney(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(cents / 100)
}

function publishedLine(rev: RoomFetch['revision']): string {
  const d = new Date(rev.published_at)
  const when = Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  return `Rev ${rev.rev_number}${when ? ` · published ${when}` : ''}${rev.note.trim() ? ` — “${rev.note.trim()}”` : ''}`
}

export default function BidRoom() {
  const [params] = useSearchParams()
  const token = params.get('t')?.trim() ?? ''
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [room, setRoom] = useState<RoomFetch | null>(null)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  // Sign & decline (Phase 2, v2.2470)
  const [printedName, setPrintedName] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [declineOpen, setDeclineOpen] = useState(false)
  const [declineCategory, setDeclineCategory] = useState<string | null>(null)
  const [declineNote, setDeclineNote] = useState('')
  const [localOutcome, setLocalOutcome] = useState<{ event_type: string; metadata: unknown; occurred_at: string } | null>(null)
  const [reloadNonce, setReloadNonce] = useState(0)

  useEffect(() => {
    if (!token) {
      setError('This link is incomplete.')
      setLoading(false)
      return
    }
    const ac = new AbortController()
    void (async () => {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/get-bid-proposal-room?t=${encodeURIComponent(token)}`, {
          headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
          signal: ac.signal,
        })
        const json = (await res.json()) as RoomFetch & { error?: string; code?: string }
        if (!res.ok) {
          setError(
            json.code === 'closed'
              ? 'This proposal has been withdrawn. Please contact us for the current version.'
              : json.code === 'empty'
                ? 'Nothing has been published to this link yet — check back shortly.'
                : json.error || 'Could not load the proposal.',
          )
          return
        }
        const payload = parseBidRoomRevisionPayload(json.payload)
        if (!payload) {
          setError('Could not load the proposal.')
          return
        }
        if (!ac.signal.aborted) {
          setRoom({ ...json, payload })
          setSelectedKey(roomBaseOption(payload).key)
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        if (!ac.signal.aborted) setError('Could not load the proposal. Check your connection.')
      } finally {
        if (!ac.signal.aborted) setLoading(false)
      }
    })()
    return () => ac.abort()
  }, [token, reloadNonce])

  function selectOption(key: string) {
    setSelectedKey(key)
    void fetch(`${supabaseUrl}/functions/v1/get-bid-proposal-room`, {
      method: 'POST',
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, event: 'option_viewed', optionKey: key }),
    }).catch(() => undefined)
  }

  async function post(body: Record<string, unknown>): Promise<boolean> {
    setSubmitting(true)
    setFormError(null)
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/sign-bid-room`, {
        method: 'POST',
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, revision_id: room?.revision.id, ...body }),
      })
      const json = (await res.json()) as { ok?: boolean; error?: string; code?: string }
      if (!res.ok || !json.ok) {
        if (json.code === 'stale_revision') {
          setFormError('The proposal was just revised — here is the current version.')
          setReloadNonce((n) => n + 1)
          return false
        }
        setFormError(json.error || 'Could not record your response. Please try again.')
        return false
      }
      return true
    } catch {
      setFormError('Could not record your response. Check your connection and try again.')
      return false
    } finally {
      setSubmitting(false)
    }
  }

  async function submitSign(selected: RoomOption) {
    if (!printedName.trim()) {
      setFormError('Please enter your full name.')
      return
    }
    if (!agreed) {
      setFormError('Please confirm you agree to the proposal and terms above.')
      return
    }
    const ok = await post({ action: 'sign', optionKey: selected.key, printedName: printedName.trim(), agreedTerms: true })
    if (ok) {
      setLocalOutcome({
        event_type: 'signed',
        metadata: { option_name: selected.name, total_cents: selected.total_cents, printed_name: printedName.trim() },
        occurred_at: new Date().toISOString(),
      })
    }
  }

  async function submitDecline() {
    if (!declineCategory && !declineNote.trim()) {
      setFormError('Pick a reason or tell us in a sentence.')
      return
    }
    const ok = await post({ action: 'decline', category: declineCategory ?? undefined, note: declineNote.trim() || undefined })
    if (ok) setLocalOutcome({ event_type: 'declined', metadata: {}, occurred_at: new Date().toISOString() })
  }

  if (loading) return <Shell><p style={{ margin: 0 }}>Loading proposal…</p></Shell>
  if (error || !room) return <Shell><p style={{ margin: 0 }}>{error ?? 'Could not load the proposal.'}</p></Shell>

  const { payload } = room
  const options = payload.options
  const outcome = localOutcome ?? room.outcome
  const answered = outcome != null
  const selected = options.find((o) => o.key === selectedKey) ?? roomBaseOption(payload)
  const brand = parseAcceptHeaderBrand(payload.header_brand)
  const outcomeMeta = (outcome?.metadata ?? {}) as { option_name?: string; total_cents?: number; printed_name?: string }

  const textBlock = (heading: string, body: string) =>
    body.trim() ? (
      <section key={heading} style={{ marginTop: '1.2rem', borderTop: '1px solid var(--border-rule)', paddingTop: '0.9rem' }}>
        <h2 style={{ fontSize: '1.05rem', margin: '0 0 0.35rem' }}>{heading}</h2>
        <p style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '0.9rem', color: 'var(--text-700)' }}>{body.trim()}</p>
      </section>
    ) : null

  return (
    <Shell>
      {/* Customer-facing document: pinned light regardless of viewer theme (house rule). */}
      <div data-theme="light">
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
          <div style={{ flex: '1 1 16rem', minWidth: 0 }}>
            <h1 style={{ margin: 0 }}>Proposal — {payload.project_name || 'your project'}</h1>
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.9rem', color: 'var(--text-700)' }}>
              <strong>For:</strong> {payload.gc_name || '—'}
              {payload.project_address ? <> · {payload.project_address}</> : null}
            </p>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{publishedLine(room.revision)}</p>
          </div>
          {brand ? (
            <img
              src={acceptHeaderBrandImageSrc(brand)}
              alt={acceptHeaderBrandLabel(brand)}
              width={140}
              height={56}
              style={{ maxWidth: 140, maxHeight: 56, width: 'auto', height: 'auto', objectFit: 'contain', flex: '0 0 auto' }}
            />
          ) : null}
        </div>

        {answered ? (
          <div
            role="status"
            style={{
              marginTop: '1rem',
              borderRadius: 10,
              padding: '0.7rem 0.9rem',
              fontSize: '0.9rem',
              fontWeight: 600,
              background: outcome!.event_type === 'signed' ? '#f2fbf5' : 'var(--bg-subtle)',
              border: outcome!.event_type === 'signed' ? '1px solid #b5e5c4' : '1px solid var(--border-strong)',
              color: outcome!.event_type === 'signed' ? 'var(--text-green-800)' : 'var(--text-700)',
            }}
          >
            {outcome!.event_type === 'signed' ? (
              <>
                ✍ Signed{outcomeMeta.printed_name ? ` by ${outcomeMeta.printed_name}` : ''}
                {outcomeMeta.option_name ? ` — “${outcomeMeta.option_name}”` : ''}
                {typeof outcomeMeta.total_cents === 'number' ? ` · ${formatMoney(outcomeMeta.total_cents)}` : ''}
                {'. '}Thank you — we&rsquo;ll be in touch shortly.
              </>
            ) : (
              <>This proposal was declined. Changed your mind, or want to talk it through? Just reply to our email or give us a call.</>
            )}
          </div>
        ) : null}

        {options.length > 1 ? (
          <section role="radiogroup" aria-label="Choose your option" style={{ margin: '1.1rem 0 0.3rem' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#9a5b13', marginBottom: '0.45rem' }}>
              Choose your option
            </div>
            {options.map((o) => (
              <RoomOptionCard key={o.key} option={o} selected={o.key === selected.key} onSelect={() => { if (!answered) selectOption(o.key) }} />
            ))}
          </section>
        ) : null}

        <section style={{ marginTop: '1.2rem', borderTop: '1px solid var(--border-rule)', paddingTop: '0.9rem' }}>
          <h2 style={{ fontSize: '1.05rem', margin: '0 0 0.5rem' }}>
            {options.length > 1 ? <>Your selection — {selected.name.trim() || 'Option'}</> : 'Scope of work'}
          </h2>
          {selected.fixture_rows.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.9rem' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, padding: '0.3rem 0.5rem', borderBottom: '1px solid var(--border)' }}>Fixture / scope item</th>
                    <th style={{ textAlign: 'right', color: 'var(--text-muted)', fontWeight: 600, padding: '0.3rem 0.5rem', borderBottom: '1px solid var(--border)' }}>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.fixture_rows.map((r, i) => (
                    <tr key={i}>
                      <td style={{ padding: '0.32rem 0.5rem', borderBottom: '1px solid var(--border)' }}>{r.fixture || '—'}</td>
                      <td style={{ padding: '0.32rem 0.5rem', borderBottom: '1px solid var(--border)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{String(r.count)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          <p style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1.05rem', margin: '0.7rem 0 0' }}>
            <span>{options.length > 1 ? `Total — ${selected.name.trim() || 'Option'}` : 'Total'}</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatMoney(selected.total_cents)}</span>
          </p>
        </section>

        {textBlock('Inclusions', payload.inclusions)}
        {textBlock('Exclusions', payload.exclusions)}
        {textBlock('Terms', payload.terms)}

        {room.attachment ? (
          <EstimateCustomerAttachmentCard attachment={{ url: room.attachment.url, label: room.attachment.label }} />
        ) : null}

        {!answered ? (
          <section style={{ marginTop: '1.4rem', borderTop: '1px solid var(--border-rule)', paddingTop: '1rem' }}>
            <h2 style={{ fontSize: '1.05rem', margin: '0 0 0.4rem' }}>Approve this proposal</h2>
            <p style={{ margin: '0 0 0.6rem', fontSize: '0.85rem', color: 'var(--text-700)' }}>
              Typing your name below has the same force and effect as your written signature, and applies to the option
              selected above{options.length > 1 ? ` — ${selected.name.trim() || 'Option'}` : ''}.
            </p>
            <input
              type="text"
              value={printedName}
              onChange={(e) => setPrintedName(e.target.value)}
              placeholder="Type your full name to sign"
              aria-label="Full name"
              autoComplete="name"
              style={{ font: 'inherit', width: '100%', maxWidth: 380, padding: '0.55rem 0.7rem', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text-strong)', fontFamily: 'Georgia, serif', fontStyle: 'italic' }}
            />
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', margin: '0.7rem 0 0', fontSize: '0.85rem', color: 'var(--text-700)', maxWidth: '56ch', cursor: 'pointer' }}>
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} style={{ marginTop: 3 }} />
              <span>I agree to conduct business electronically and accept this proposal, its inclusions, exclusions, and terms.</span>
            </label>
            {formError ? <p style={{ margin: '0.6rem 0 0', fontSize: '0.85rem', color: 'var(--text-red-700)' }}>{formError}</p> : null}
            <button
              type="button"
              disabled={submitting}
              onClick={() => void submitSign(selected)}
              style={{ display: 'inline-block', marginTop: '0.8rem', background: '#ea580c', color: '#fff', fontWeight: 800, fontSize: '0.95rem', border: 'none', borderRadius: 9, padding: '0.6rem 1.4rem', cursor: submitting ? 'wait' : 'pointer', opacity: submitting ? 0.6 : 1 }}
            >
              {submitting ? 'Recording…' : `Approve “${selected.name.trim() || 'Option'}” — ${formatMoney(selected.total_cents)}`}
            </button>

            <div style={{ marginTop: '1.1rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Not moving forward?{' '}
              <button
                type="button"
                onClick={() => setDeclineOpen((v) => !v)}
                style={{ font: 'inherit', border: 'none', background: 'none', color: '#b3541e', fontWeight: 600, cursor: 'pointer', padding: 0 }}
              >
                Tell us why
              </button>
            </div>
            {declineOpen ? (
              <div style={{ marginTop: '0.5rem', display: 'grid', gap: '0.5rem', maxWidth: 480 }}>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {(
                    [
                      ['price', 'Price'],
                      ['other_sub', 'Went with another sub'],
                      ['project_died', 'Project died / on hold'],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={declineCategory === key}
                      onClick={() => setDeclineCategory((c) => (c === key ? null : key))}
                      style={{ font: 'inherit', fontSize: '0.8rem', fontWeight: 600, padding: '0.3rem 0.7rem', borderRadius: 999, border: declineCategory === key ? '1.5px solid #b3541e' : '1px solid var(--border-strong)', background: declineCategory === key ? '#fff8f3' : 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer' }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <textarea
                  value={declineNote}
                  onChange={(e) => setDeclineNote(e.target.value)}
                  placeholder="Anything you can share helps — even one sentence. (Optional)"
                  rows={2}
                  style={{ font: 'inherit', fontSize: '0.85rem', padding: '0.5rem 0.65rem', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text-strong)', resize: 'vertical' }}
                />
                <div>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => void submitDecline()}
                    style={{ font: 'inherit', fontSize: '0.82rem', fontWeight: 700, padding: '0.4rem 0.9rem', borderRadius: 7, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', cursor: submitting ? 'wait' : 'pointer' }}
                  >
                    {submitting ? 'Sending…' : 'Send answer'}
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </Shell>
  )
}

function RoomOptionCard({ option, selected, onSelect }: { option: RoomOption; selected: boolean; onSelect: () => void }) {
  return (
    <div
      role="radio"
      aria-checked={selected}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
      style={{
        border: selected ? '1.5px solid #ea580c' : '1.5px solid var(--border-strong)',
        boxShadow: selected ? '0 0 0 1.5px #ea580c inset' : 'none',
        background: selected ? '#fff8f3' : 'var(--surface)',
        borderRadius: 12,
        padding: '0.7rem 0.8rem',
        marginBottom: '0.55rem',
        cursor: 'pointer',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.6rem' }}>
        <span style={{ fontWeight: 700, fontSize: '0.95rem', display: 'inline-flex', alignItems: 'center', gap: '0.45rem', minWidth: 0 }}>
          <span
            aria-hidden
            style={{
              width: 14,
              height: 14,
              flex: '0 0 auto',
              borderRadius: '50%',
              border: selected ? '4px solid #ea580c' : '2px solid var(--border-strong)',
              background: 'var(--surface)',
              boxSizing: 'border-box',
            }}
          />
          {option.name.trim() || 'Option'}
          <span
            style={{
              fontSize: '0.6rem',
              fontWeight: 800,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: option.is_base ? '#9a5b13' : 'var(--text-muted)',
              background: option.is_base ? '#fdeed9' : 'var(--bg-subtle)',
              borderRadius: 999,
              padding: '0.12rem 0.5rem',
              whiteSpace: 'nowrap',
            }}
          >
            {option.is_base ? 'Proposed' : 'Alternate'}
          </span>
        </span>
        <span style={{ fontWeight: 800, fontSize: '1.02rem', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
          {formatMoney(option.total_cents)}
        </span>
      </span>
      {option.fixture_rows.length > 0 ? (
        <details style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '0.4rem' }} onClick={(e) => e.stopPropagation()}>
          <summary style={{ cursor: 'pointer', color: '#b3541e', fontWeight: 600 }}>What&rsquo;s included</summary>
          <ul style={{ margin: '0.3rem 0 0', paddingLeft: '1.1rem' }}>
            {option.fixture_rows.map((r, i) => (
              <li key={i}>
                {r.fixture || '—'}
                {String(r.count).trim() ? ` — ${r.count}` : ''}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  )
}
