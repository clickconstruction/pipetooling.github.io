import { useLocation, useNavigate } from 'react-router-dom'
import { CallPhoneButton } from './CallPhoneButton'
import { useCustomerWaitingOptional } from '../contexts/CustomerWaitingContext'
import { useIntervalNowMs } from '../hooks/useIntervalNowMs'
import { APP_CALENDAR_TZ } from '../utils/dateUtils'
import { buildCustomerWaitingBanner, isInboxRoute } from '../lib/customerWaiting'

/**
 * The strip that follows the team (Customer Waiting, v2.3248). Sits in the
 * Layout banner slot above the top nav — the same slot as training mode and
 * the digital-twin notice — on every authenticated page, for members of the
 * inbox the request is in, until the request is lowered or closed.
 *
 * Three states (kernel `buildCustomerWaitingBanner`): waiting (red, the wait
 * ticks, Call + Open), called (amber, who and when, Open), and on the inbox
 * page itself one quiet line with no buttons — the request is already the
 * first thing on screen there.
 */
export function CustomerWaitingBanner() {
  const ctx = useCustomerWaitingOptional()
  const location = useLocation()
  const navigate = useNavigate()
  const nowMs = useIntervalNowMs(30_000)
  if (!ctx || !ctx.eligible || ctx.rows.length === 0) return null
  const b = buildCustomerWaitingBanner(ctx.rows, nowMs, APP_CALENDAR_TZ)
  if (!b) return null

  const waiting = b.state === 'waiting'
  const palette = waiting
    ? { background: 'var(--bg-red-tint)', borderBottom: '1px solid var(--border-red)', color: 'var(--text-red-800)' }
    : { background: 'var(--bg-amber-100)', borderBottom: '1px solid var(--border-amber)', color: 'var(--text-amber-800)' }

  const open = () => {
    const href = ctx.inboxHref
    const [path, hash] = href.split('#')
    if (location.pathname === path && hash) {
      document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    navigate(href)
  }

  if (isInboxRoute(location.pathname)) {
    return (
      <div role="status" data-testid="customer-waiting-banner-collapsed" style={{ ...palette, padding: '0.25rem 1rem', fontSize: '0.78rem', textAlign: 'center', fontWeight: 600 }}>
        {waiting ? (
          <>
            <Pulse /> {b.waitingCount === 1 ? '1 customer waiting' : `${b.waitingCount} customers waiting`}
            {b.wait ? ` · ${b.wait.short}` : ''}
          </>
        ) : (
          <>📞 {b.calledLine}</>
        )}
      </div>
    )
  }

  const headline = waiting ? `${b.leadName} is waiting${b.wait ? ` · ${b.wait.short}` : ''}` : b.calledLine
  const sub = waiting ? b.snippet ?? b.leadKind : `${b.leadKind}${b.snippet ? ` · ${b.snippet}` : ''} · still open`

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="customer-waiting-banner"
      style={{ ...palette, padding: '0.4rem 1rem', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}
    >
      {waiting ? <Pulse /> : <span aria-hidden style={{ fontSize: '1rem' }}>📞</span>}
      <div style={{ flex: 1, minWidth: 160, lineHeight: 1.25 }}>
        <div style={{ fontWeight: 700 }}>{headline}</div>
        {sub ? <div style={{ fontSize: '0.75rem', opacity: 0.9, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div> : null}
      </div>
      {waiting && b.leadPhone ? (
        <CallPhoneButton phone={b.leadPhone} onUsed={() => void ctx.logCall(b.lead.inbox, b.lead.id, b.leadPhone ?? '')} style={{ padding: '0.3rem 0.7rem', fontSize: '0.8125rem' }} />
      ) : null}
      <button
        type="button"
        onClick={open}
        style={{ padding: '0.3rem 0.7rem', borderRadius: 6, border: '1px solid currentColor', background: 'transparent', color: 'inherit', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
      >
        {b.others > 0 ? `Open · +${b.others} more` : 'Open'}
      </button>
    </div>
  )
}

function Pulse() {
  return (
    <span
      aria-hidden
      data-waiting="true"
      style={{ width: 9, height: 9, borderRadius: '50%', background: '#dc2626', display: 'inline-block', flexShrink: 0, animation: 'customerWaitingPulse 1.8s ease-in-out infinite' }}
    />
  )
}
