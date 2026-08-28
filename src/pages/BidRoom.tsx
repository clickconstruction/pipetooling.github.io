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
  }, [token])

  function selectOption(key: string) {
    setSelectedKey(key)
    void fetch(`${supabaseUrl}/functions/v1/get-bid-proposal-room`, {
      method: 'POST',
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, event: 'option_viewed', optionKey: key }),
    }).catch(() => undefined)
  }

  if (loading) return <Shell><p style={{ margin: 0 }}>Loading proposal…</p></Shell>
  if (error || !room) return <Shell><p style={{ margin: 0 }}>{error ?? 'Could not load the proposal.'}</p></Shell>

  const { payload } = room
  const options = payload.options
  const selected = options.find((o) => o.key === selectedKey) ?? roomBaseOption(payload)
  const brand = parseAcceptHeaderBrand(payload.header_brand)

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

        {options.length > 1 ? (
          <section role="radiogroup" aria-label="Choose your option" style={{ margin: '1.1rem 0 0.3rem' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#9a5b13', marginBottom: '0.45rem' }}>
              Choose your option
            </div>
            {options.map((o) => (
              <RoomOptionCard key={o.key} option={o} selected={o.key === selected.key} onSelect={() => selectOption(o.key)} />
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
