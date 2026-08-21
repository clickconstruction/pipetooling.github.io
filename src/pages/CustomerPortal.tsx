import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  formatPortalDate,
  formatPortalUsd,
  parsePortalPayload,
  type PortalPayload,
} from '../lib/portal/portalPayload'

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
  const token = params.get('t')?.trim() ?? ''
  const [state, setState] = useState<
    | { kind: 'loading' }
    | { kind: 'error'; message: string }
    | { kind: 'ready'; payload: PortalPayload }
  >({ kind: 'loading' })

  useEffect(() => {
    let cancelled = false
    if (!token) {
      setState({ kind: 'error', message: 'This link is missing its key. Please use the exact link we sent you.' })
      return
    }
    void (async () => {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/customer-portal?token=${encodeURIComponent(token)}`)
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
  }, [token])

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
          <PortalStatement payload={state.payload} today={today} />
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
                  {b.jobAddress && (
                    <>
                      <br />
                      <span style={{ fontSize: 11.5, color: FAINT }}>{b.jobAddress}</span>
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

      {/* Sign-off */}
      <div style={{ padding: '2rem 0 0', display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
        <span style={{ fontSize: 12, color: MUTED }}>
          Thank you for your business — <i>the Click team</i>
        </span>
        <span style={{ fontSize: 10.5, color: FAINT }}>This link is private to you</span>
      </div>
    </>
  )
}
