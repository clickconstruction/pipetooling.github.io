import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import {
  formatPortalDate,
  formatPortalUsd,
  parsePortalPayload,
  type PortalPayload,
} from '../lib/portal/portalPayload'
import { PORTAL_SHORT_ORIGIN, portalShortUrl } from '../lib/portal/portalShortOrigin'

/**
 * Customer / GC portal (portal train PR 1): the no-login "account statement"
 * page behind a minted capability token — outstanding bills with pay links,
 * set like a beautifully ruled paper statement (letterhead, ledger lines,
 * accounting double-rule total). Customer-facing ⇒ deliberately single-theme
 * light with every color painted explicitly (house convention: customer
 * surfaces pin light). Request forms arrive in the next portal PR.
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string

const INK = '#16283c'
const PAPER = '#f6f3ec'
const CARD = '#fdfcf9'
const MUTED = '#5a6b7e'
const FAINT = '#8a97a6'
const HAIR = '#ddd6c8'
const COPPER = '#b0662f'

export default function CustomerPortal() {
  const [params] = useSearchParams()
  const { slug: slugParam } = useParams<{ slug?: string }>()
  const token = params.get('t')?.trim() ?? ''
  const slug = (slugParam ?? '').trim().toLowerCase()
  const [state, setState] = useState<
    | { kind: 'loading' }
    | { kind: 'error'; message: string }
    | { kind: 'ready'; payload: PortalPayload }
  >({ kind: 'loading' })

  useEffect(() => {
    let cancelled = false
    if (!token && !slug) {
      setState({ kind: 'error', message: 'This link is missing its key. Please use the exact link we sent you.' })
      return
    }
    void (async () => {
      try {
        const query = token ? `token=${encodeURIComponent(token)}` : `slug=${encodeURIComponent(slug)}`
        const res = await fetch(`${supabaseUrl}/functions/v1/customer-portal?${query}`)
        const body: unknown = await res.json().catch(() => null)
        if (cancelled) return
        const payload = parsePortalPayload(body)
        if (!res.ok || !payload) {
          const msg =
            body != null && typeof body === 'object' && typeof (body as { error?: unknown }).error === 'string'
              ? String((body as { error: string }).error)
              : 'We could not open your statement. Please try again, or call our office.'
          setState({ kind: 'error', message: msg })
          return
        }
        setState({ kind: 'ready', payload })
      } catch {
        if (!cancelled) {
          setState({ kind: 'error', message: 'We could not open your statement. Please check your connection and try again.' })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, slug])

  const today = useMemo(() => {
    const d = new Date()
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December']
    return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
  }, [])

  return (
    <div data-theme="light" style={{ minHeight: '100vh', background: PAPER, color: INK, fontFamily: `-apple-system, 'Segoe UI', Roboto, sans-serif`, padding: '2rem 1rem 4rem' }}>
      <div style={{ maxWidth: 730, margin: '0 auto' }}>
        {/* Letterhead */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', padding: '0.5rem 0 1.1rem' }}>
          <div>
            <div style={{ fontSize: 27, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1 }}>
              CLICK<span style={{ color: COPPER }}>.</span>
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.22em', textTransform: 'uppercase', color: MUTED, marginTop: 4 }}>
              Plumbing &amp; Electrical
            </div>
          </div>
          {state.kind === 'ready' && (
            <div style={{ textAlign: 'right', fontSize: 11.5, color: MUTED, lineHeight: 1.7 }}>
              {[state.payload.company.cityLine, state.payload.company.licenseLine].filter(Boolean).join(' · ')}
              {(state.payload.company.phone || state.payload.company.email) && (
                <>
                  <br />
                  {[state.payload.company.phone, state.payload.company.email].filter(Boolean).join(' · ')}
                </>
              )}
            </div>
          )}
        </div>
        <div style={{ height: 3, background: INK }} />

        {state.kind === 'loading' && (
          <div style={{ padding: '3rem 0', color: MUTED, fontSize: 14 }} aria-busy>
            Opening your statement…
          </div>
        )}

        {state.kind === 'error' && (
          <div style={{ padding: '2.2rem 0', maxWidth: '54ch' }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>We couldn&#8217;t open this page</div>
            <p style={{ marginTop: 8, fontSize: 14, color: MUTED, lineHeight: 1.6 }}>{state.message}</p>
          </div>
        )}

        {state.kind === 'ready' && (
          <>
            <PortalStatement payload={state.payload} today={today} />
            <PortalRequestForms token={state.payload.requestToken ?? token} payload={state.payload} />
            {state.payload.slug && <PortalShortAddressCard slug={state.payload.slug} />}
            <div style={{ padding: '2rem 0 0', display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
              <span style={{ fontSize: 12, color: MUTED }}>
                Thank you for your business — <i>the Click team</i>
              </span>
              <span style={{ fontSize: 10.5, color: FAINT }}>
                This link is private to you · requests go straight to our dispatch desk
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function PortalStatement({ payload, today }: { payload: PortalPayload; today: string }) {
  return (
    <>
      {/* Statement head */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', padding: '1.3rem 0 0.4rem' }}>
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: COPPER }}>
            Account statement
          </div>
          <div style={{ fontSize: 19, fontWeight: 700, marginTop: 2 }}>{payload.customerName}</div>
          <div style={{ fontSize: 12, color: MUTED }}>{today}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: MUTED }}>
            Balance due
          </div>
          <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
            {formatPortalUsd(payload.totalDue)}
          </div>
          <div style={{ width: 64, height: 3, background: COPPER, margin: '6px 0 0 auto' }} />
        </div>
      </div>

      {/* Ledger */}
      {payload.bills.length === 0 ? (
        <div style={{ margin: '1.2rem 0', background: CARD, border: `1px solid ${HAIR}`, padding: '1.2rem 1.3rem', fontSize: 14.5 }}>
          <b>You&#8217;re all paid up.</b>{' '}
          <span style={{ color: MUTED }}>No open bills on your account — thank you.</span>
        </div>
      ) : (
        <div style={{ marginTop: 10, overflowX: 'auto' }}>
          <div style={{ minWidth: 560 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '84px 1fr auto auto', gap: '0 18px', fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: FAINT, padding: '0 0 7px', borderBottom: `1.5px solid ${INK}` }}>
              <span>Billed</span>
              <span>Work</span>
              <span style={{ textAlign: 'right' }}>Amount</span>
              <span />
            </div>
            {payload.bills.map((b, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '84px 1fr auto auto', gap: '0 18px', alignItems: 'center', padding: '13px 0', borderBottom: `1px solid ${HAIR}`, fontSize: 13.5 }}>
                <span style={{ color: MUTED, fontVariantNumeric: 'tabular-nums' }}>{formatPortalDate(b.billedOn) ?? '—'}</span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ fontWeight: 600 }}>{b.jobLabel}</span>
                  {b.asGc && (
                    <span
                      style={{
                        marginLeft: 7,
                        verticalAlign: 1,
                        fontSize: 8.5,
                        fontWeight: 800,
                        letterSpacing: '0.12em',
                        textTransform: 'uppercase',
                        color: COPPER,
                        border: `1px solid ${COPPER}`,
                        borderRadius: 3,
                        padding: '1.5px 5px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      As GC
                    </span>
                  )}
                  {(b.jobAddress || (b.asGc && b.ownerName)) && (
                    <>
                      <br />
                      <span style={{ fontSize: 11.5, color: FAINT }}>
                        {[b.jobAddress, b.asGc && b.ownerName ? `owner: ${b.ownerName}` : null]
                          .filter(Boolean)
                          .join(' — ')}
                      </span>
                    </>
                  )}
                </span>
                <span style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{formatPortalUsd(b.amount)}</span>
                {b.payUrl ? (
                  <a
                    href={b.payUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ background: INK, color: PAPER, padding: '7px 16px', fontSize: 12.5, fontWeight: 600, letterSpacing: '0.02em', textDecoration: 'none', whiteSpace: 'nowrap' }}
                  >
                    PAY ONLINE
                  </a>
                ) : (
                  <span style={{ border: '1px solid #b9c2cc', color: MUTED, padding: '6px 12px', fontSize: 11.5, whiteSpace: 'nowrap' }}>
                    check · ref {b.checkRef || '—'}
                  </span>
                )}
              </div>
            ))}
            <div style={{ display: 'grid', gridTemplateColumns: '84px 1fr auto auto', gap: '0 18px', alignItems: 'center', padding: '11px 0 4px', fontSize: 14 }}>
              <span />
              <span style={{ fontWeight: 700, textAlign: 'right' }}>Total due</span>
              <span style={{ textAlign: 'right', fontWeight: 900, fontVariantNumeric: 'tabular-nums', borderTop: `1px solid ${INK}`, borderBottom: `3px double ${INK}`, padding: '3px 0' }}>
                {formatPortalUsd(payload.totalDue)}
              </span>
              <span />
            </div>
          </div>
        </div>
      )}

    </>
  )
}

/**
 * "Your account, any time" — the short address + QR at the foot of the
 * statement (portal custom-links train PR C). Renders only when the company
 * has a custom address, so paper copies and screenshots always carry a way
 * back in. Print keeps it: the page pins light and the QR is inline SVG.
 */
function PortalShortAddressCard({ slug }: { slug: string }) {
  const url = portalShortUrl(slug)
  return (
    <div
      style={{
        marginTop: '1.9rem',
        background: CARD,
        border: `1px solid ${HAIR}`,
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 20,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ flex: 1, minWidth: 220 }}>
        <div style={{ fontSize: 13.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.01em' }}>
          Your account, any time
        </div>
        <div style={{ fontSize: 12.5, color: MUTED, marginTop: 3, lineHeight: 1.55 }}>
          See open bills, pay online, or request a visit — no login needed.
        </div>
        <div style={{ marginTop: 8, fontFamily: 'ui-monospace, monospace', fontSize: 13 }}>
          <span style={{ color: FAINT }}>{PORTAL_SHORT_ORIGIN.replace(/^https:\/\//, '')}</span>
          <span style={{ fontWeight: 700 }}>{slug}</span>
        </div>
      </div>
      <QRCodeSVG value={url} size={84} level="M" bgColor={CARD} fgColor={INK} aria-label={`QR code for ${url}`} />
    </div>
  )
}

const fieldStyle: CSSProperties = {
  border: 'none',
  borderBottom: '1px solid #b9c2cc',
  background: 'transparent',
  padding: '4px 1px',
  fontSize: 13,
  color: INK,
  fontFamily: 'inherit',
  outline: 'none',
  width: '100%',
  borderRadius: 0,
}

function PortalRequestForms({ token, payload }: { token: string; payload: PortalPayload }) {
  return (
    <>
      {/* Tear-off divider (portal train PR 2) */}
      <div style={{ margin: '1.9rem 0 0', display: 'flex', alignItems: 'center', gap: 10, color: FAINT }}>
        <span aria-hidden style={{ fontSize: 13 }}>✂</span>
        <span style={{ flex: 1, borderTop: '2px dashed #c4bfb2' }} />
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase' }}>Send us work</span>
        <span style={{ flex: 1, borderTop: '2px dashed #c4bfb2' }} />
      </div>
      <div style={{ padding: '1.3rem 0 0', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: 22 }}>
        <RequestCard
          token={token}
          kind="visit"
          title="Request a visit"
          sub="We'll call to confirm a time."
          submitLabel="Send request"
          jobs={payload.requestableJobs}
        />
        <RequestCard
          token={token}
          kind="bid"
          title="Ask us to bid your work"
          sub="Remodels, additions, new construction."
          submitLabel="Request a bid"
          jobs={[]}
        />
      </div>
    </>
  )
}

function RequestCard({
  token,
  kind,
  title,
  sub,
  submitLabel,
  jobs,
}: {
  token: string
  kind: 'visit' | 'bid'
  title: string
  sub: string
  submitLabel: string
  jobs: PortalPayload['requestableJobs']
}) {
  const [jobId, setJobId] = useState('')
  const [description, setDescription] = useState('')
  const [availability, setAvailability] = useState('')
  const [phone, setPhone] = useState('')
  const [plansLink, setPlansLink] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (description.trim().length < 5) {
      setStatus('error')
      setErrorMessage('Please tell us a little more about what you need (a sentence or two).')
      return
    }
    setStatus('sending')
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/submit-portal-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          kind,
          jobId: jobId || undefined,
          description: description.trim(),
          availability: availability.trim() || undefined,
          phone: phone.trim() || undefined,
          plansLink: plansLink.trim() || undefined,
          website: honeypot,
        }),
      })
      const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
      if (res.ok && body?.ok) {
        setStatus('sent')
      } else {
        setStatus('error')
        setErrorMessage(body?.error ?? 'We could not send that. Please try again, or call our office.')
      }
    } catch {
      setStatus('error')
      setErrorMessage('We could not send that. Please check your connection and try again.')
    }
  }

  if (status === 'sent') {
    return (
      <div style={{ background: CARD, border: `1px solid ${HAIR}`, padding: '18px 20px' }}>
        <div style={{ fontSize: 13.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.01em' }}>{title}</div>
        <p style={{ marginTop: 12, fontSize: 13.5, lineHeight: 1.6 }}>
          <b>Got it — thank you.</b>{' '}
          <span style={{ color: MUTED }}>
            Your request went straight to our dispatch desk; we&#8217;ll reach out
            {phone.trim() ? ` at ${phone.trim()}` : ''} shortly.
          </span>
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} style={{ background: CARD, border: `1px solid ${HAIR}`, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.01em' }}>{title}</div>
        <div style={{ fontSize: 12, color: FAINT, marginTop: 2 }}>{sub}</div>
      </div>
      {kind === 'visit' && jobs.length > 0 && (
        <label style={{ fontSize: 12.5, color: MUTED, display: 'flex', flexDirection: 'column', gap: 2 }}>
          For
          <select value={jobId} onChange={(e) => setJobId(e.target.value)} style={{ ...fieldStyle, appearance: 'auto' }}>
            <option value="">Something new</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.label}
              </option>
            ))}
          </select>
        </label>
      )}
      <label style={{ fontSize: 12.5, color: MUTED, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {kind === 'visit' ? "What's going on?" : 'Describe the project'}
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          maxLength={2000}
          required
          style={{ ...fieldStyle, resize: 'vertical' }}
        />
      </label>
      {kind === 'visit' ? (
        <label style={{ fontSize: 12.5, color: MUTED, display: 'flex', flexDirection: 'column', gap: 2 }}>
          Best days &amp; times
          <input value={availability} onChange={(e) => setAvailability(e.target.value)} maxLength={300} style={fieldStyle} />
        </label>
      ) : (
        <label style={{ fontSize: 12.5, color: MUTED, display: 'flex', flexDirection: 'column', gap: 2 }}>
          Link to plans (optional)
          <input value={plansLink} onChange={(e) => setPlansLink(e.target.value)} maxLength={500} placeholder="https://…" style={fieldStyle} />
        </label>
      )}
      <label style={{ fontSize: 12.5, color: MUTED, display: 'flex', flexDirection: 'column', gap: 2 }}>
        Best number to reach you
        <input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} type="tel" style={fieldStyle} />
      </label>
      {/* Honeypot: hidden from people, tempting to bots. */}
      <input
        value={honeypot}
        onChange={(e) => setHoneypot(e.target.value)}
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        style={{ position: 'absolute', left: -9999, width: 1, height: 1, opacity: 0 }}
      />
      {status === 'error' && (
        <div style={{ fontSize: 12.5, color: '#a02c2c' }}>{errorMessage}</div>
      )}
      <button
        type="submit"
        disabled={status === 'sending'}
        style={{
          alignSelf: 'flex-end',
          background: COPPER,
          color: CARD,
          border: 'none',
          padding: '8px 20px',
          fontSize: 12.5,
          fontWeight: 700,
          letterSpacing: '0.03em',
          textTransform: 'uppercase',
          cursor: status === 'sending' ? 'wait' : 'pointer',
          fontFamily: 'inherit',
        }}
      >
        {status === 'sending' ? 'Sending…' : submitLabel}
      </button>
    </form>
  )
}
