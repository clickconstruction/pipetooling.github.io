import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { CallPhoneButton } from './CallPhoneButton'
import { useCustomerWaitingOptional } from '../contexts/CustomerWaitingContext'
import { useIntervalNowMs } from '../hooks/useIntervalNowMs'
import { APP_CALENDAR_TZ } from '../utils/dateUtils'
import {
  HIDDEN_FOR_ME_STORAGE_PREFIX,
  buildCustomerWaitingBanner,
  canHideForMe,
  isInboxRoute,
  pruneHiddenIds,
  rowsVisibleToViewer,
  type CustomerWaitingRow,
} from '../lib/customerWaiting'

/** This viewer's own hidden calls, per device (v2.3524). Storage may be unavailable — then nothing is remembered. */
function useHiddenForMe(viewerId: string | null, rows: ReadonlyArray<CustomerWaitingRow>): { hidden: Set<string>; hide: (id: string) => void } {
  const key = viewerId ? `${HIDDEN_FOR_ME_STORAGE_PREFIX}${viewerId}` : null
  const [hidden, setHidden] = useState<Set<string>>(() => {
    if (!key) return new Set()
    try {
      const raw = localStorage.getItem(key)
      return new Set(raw ? (JSON.parse(raw) as string[]) : [])
    } catch {
      return new Set()
    }
  })
  // Forget ids whose request is gone, so the list never outlives the rows.
  useEffect(() => {
    if (!key || hidden.size === 0 || rows.length === 0) return
    const kept = pruneHiddenIds(hidden, rows)
    if (kept.length !== hidden.size) {
      const next = new Set(kept)
      setHidden(next)
      try {
        localStorage.setItem(key, JSON.stringify([...next]))
      } catch {
        /* per-device convenience only */
      }
    }
  }, [key, hidden, rows])
  const hide = useCallback(
    (id: string) => {
      setHidden((prev) => {
        const next = new Set(prev)
        next.add(id)
        if (key) {
          try {
            localStorage.setItem(key, JSON.stringify([...next]))
          } catch {
            /* per-device convenience only */
          }
        }
        return next
      })
    },
    [key],
  )
  return { hidden, hide }
}

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
 *
 * Hide for me (v2.3524): on the called state, the viewer who made the call may
 * hide the strip for themselves on this device — never a dismiss for the team;
 * the row stays open until someone lowers or closes it.
 */
export function CustomerWaitingBanner() {
  const ctx = useCustomerWaitingOptional()
  const location = useLocation()
  const navigate = useNavigate()
  const nowMs = useIntervalNowMs(30_000)
  const viewerId = ctx?.viewerId ?? null
  const allRows = ctx?.rows ?? []
  const { hidden, hide } = useHiddenForMe(viewerId, allRows)
  const rows = useMemo(() => rowsVisibleToViewer(allRows, viewerId, hidden), [allRows, viewerId, hidden])
  if (!ctx || !ctx.eligible || rows.length === 0) return null
  const b = buildCustomerWaitingBanner(rows, nowMs, APP_CALENDAR_TZ)
  if (!b) return null
  const hideForMe = canHideForMe(b, viewerId)

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
      {hideForMe ? (
        <button
          type="button"
          onClick={() => hide(b.lead.id)}
          title="You made this call, so you may hide the strip for yourself on this device. Everyone else keeps it; the request stays open until it is lowered or closed."
          data-testid="customer-waiting-hide-for-me"
          style={{ padding: '0.3rem 0.5rem', border: 'none', background: 'transparent', color: 'inherit', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline dotted', textUnderlineOffset: 3, whiteSpace: 'nowrap', fontFamily: 'inherit' }}
        >
          Hide for me
        </button>
      ) : null}
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
