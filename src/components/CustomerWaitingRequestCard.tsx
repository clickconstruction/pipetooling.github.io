import { CallPhoneButton } from './CallPhoneButton'
import { useIntervalNowMs } from '../hooks/useIntervalNowMs'
import { APP_CALENDAR_TZ } from '../utils/dateUtils'
import { parsePortalRequestPayload } from '../lib/portalRequestPayload'
import { describeCalled, describeWait, portalKindLabel } from '../lib/requestPriority'

/**
 * The high-priority inbox row (Customer Waiting, v2.3247) — what a dispatch
 * or estimator group member sees at the top of the list when a customer has
 * sent a request from their portal. The header is the wait, not a label; the
 * customer's name is the title; the request is their own words in full;
 * availability and the number are facts; Call is the one big target. The
 * footer says whether a teammate has already called (the same fact the
 * app-wide banner reads).
 *
 * Presentational: the parent owns the RPC calls (log the call, lower).
 */
export type CustomerWaitingRow = {
  id: string
  title: string
  created_at: string | null
  reference_summary: string | null
  pending_payload?: unknown
  pending_action?: string | null
  last_called_at?: string | null
  last_called_by?: { name: string | null } | null
}

export function CustomerWaitingRequestCard({
  row,
  narrow,
  onCall,
  onLower,
  onClose,
}: {
  row: CustomerWaitingRow
  narrow: boolean
  /** Fires when Call / Text is used — log the 📞 note + last_called stamp. */
  onCall: (phoneDisplay: string) => void
  onLower: () => void
  /** Opens the row's thread (where Send-and-close lives). */
  onClose: () => void
}) {
  const nowMs = useIntervalNowMs(30_000)
  const portal = parsePortalRequestPayload(row.pending_payload)
  const wait = describeWait(row.created_at, nowMs)
  const called = describeCalled(row.last_called_at, row.last_called_by?.name, nowMs, APP_CALENDAR_TZ)
  const name = portal?.customerName ?? 'A customer'
  const kind = portalKindLabel(portal?.kind ?? (row.pending_action === 'gc_stage_ask' ? 'gc_stage_ask' : null))
  const phone = portal?.phone ?? null
  const description = portal?.description ?? null

  return (
    <div
      data-testid="customer-waiting-card"
      style={{
        border: '1px solid var(--border-red)',
        borderLeft: '4px solid #dc2626',
        borderRadius: 8,
        background: 'var(--surface)',
        padding: '0.75rem',
        display: 'grid',
        gap: '0.5rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.8125rem' }}>
        <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: '#dc2626', display: 'inline-block' }} />
        <span style={{ fontWeight: 700, color: wait?.red ? 'var(--text-red-700)' : 'var(--text-red-600)' }}>
          Customer waiting{wait ? ` · ${wait.short}` : ''}
        </span>
        <span
          style={{ fontSize: '0.72rem', fontWeight: 600, padding: '0.08rem 0.5rem', borderRadius: 999, border: '1px solid var(--border)', background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}
        >
          Portal · {kind.replace(/^asks for (a |an )?/, '')}
        </span>
      </div>
      <div style={{ fontSize: '1rem', fontWeight: 600 }}>
        {name}
        {row.reference_summary?.trim() ? (
          <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.8125rem' }}> · {row.reference_summary.trim()}</span>
        ) : null}
      </div>
      {description ? (
        <div style={{ fontSize: '0.9375rem', lineHeight: 1.45, color: 'var(--text-strong)' }}>&ldquo;{description}&rdquo;</div>
      ) : (
        <div style={{ fontSize: '0.9375rem', lineHeight: 1.45, color: 'var(--text-strong)' }}>{row.title}</div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 0.5rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
        {portal?.availability ? (
          <>
            <span>{portal.kind === 'gc_stage_ask' ? 'Asks for' : 'Can be there'}</span>
            <span style={{ color: 'var(--text-strong)' }}>{portal.availability}</span>
          </>
        ) : null}
        <span>Reach them at</span>
        <span style={{ color: 'var(--text-strong)' }}>
          {phone ?? 'No number on file'}
          {phone && portal?.phoneSource === 'on_file' ? <span style={{ color: 'var(--text-muted)' }}> · from the customer record</span> : null}
        </span>
        {portal?.plansLink ? (
          <>
            <span>Plans</span>
            <a href={portal.plansLink} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-link)' }} onClick={(e) => e.stopPropagation()}>
              {portal.plansLink}
            </a>
          </>
        ) : null}
      </div>
      {phone ? <CallPhoneButton phone={phone} size="big" onUsed={() => onCall(phone)} /> : null}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flexDirection: narrow ? 'row' : 'row' }}>
        {phone ? <CallPhoneButton phone={phone} mode="text" onUsed={() => onCall(phone)} /> : null}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onLower()
          }}
          title="Take it off the banner without closing it — asks why"
          style={{ padding: '0.35rem 0.75rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}
        >
          Lower priority ▾
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onClose()
          }}
          title="Open the thread — add a note and mark it closed"
          style={{ padding: '0.35rem 0.75rem', borderRadius: 6, border: '1px solid var(--border-green)', background: 'var(--bg-green-tint)', color: 'var(--text-green-800)', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}
        >
          ✓ Close
        </button>
      </div>
      <div style={{ borderTop: '1px dashed var(--border)', paddingTop: '0.4rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
        {called ? (
          <span>
            <span aria-hidden>📞 </span>
            <span style={{ color: 'var(--text-strong)', fontWeight: 500 }}>{called}</span>
            <span> — still open until it is lowered or closed</span>
          </span>
        ) : (
          'Nobody has called yet.'
        )}
      </div>
    </div>
  )
}
