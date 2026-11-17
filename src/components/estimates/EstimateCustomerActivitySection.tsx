import { useState, type ReactNode } from 'react'
import type { Tables } from '../../types/database'
import { estimateDeclinedLabel, parseEstimateDeclineMetadata } from '../../../supabase/functions/_shared/estimateDecline'
import { goodThroughExtendedLine, parseGoodThroughExtendedMetadata } from '../../lib/estimates/estimateGoodThroughExtend'
import { estimateCustomerEventLabel } from '../../lib/estimates/estimateListRows'
import { formatEstimateUpdatedRelativeCompact } from '../../lib/formatEstimateListUpdated'
import { formatNotificationDatetime } from '../../utils/formatNotificationDatetime'
import { EmptyState } from '../EmptyState'
import IpAddressMapButton from './IpAddressMapButton'

/**
 * Customer activity on a sent, accepted or declined estimate: every view, pick, acceptance, decline
 * and date move on record, newest first. Moved whole from the estimate page (v2.7613); the page's
 * sent view mounts it once per status.
 */
function EstimateCustomerActivityDetails({
  defaultOpen,
  children,
}: {
  defaultOpen: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <details
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
      style={{ marginTop: '1rem' }}
    >
      {children}
    </details>
  )
}

export default function EstimateDetailCustomerActivitySection({
  estimateId,
  status,
  defaultOpen,
  loading,
  events,
}: {
  estimateId: string
  status: 'sent' | 'customer_accepted' | 'declined'
  defaultOpen: boolean
  loading: boolean
  events: Tables<'estimate_customer_events'>[]
}) {
  return (
    <EstimateCustomerActivityDetails
      key={`customer-activity-${estimateId}-${status}`}
      defaultOpen={defaultOpen}
    >
      <summary
        style={{
          fontSize: '1rem',
          fontWeight: 600,
          cursor: 'pointer',
          color: 'var(--text-strong)',
        }}
      >
        Customer activity
      </summary>
      {loading ? (
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Loading…</p>
      ) : events.length === 0 ? (
        <EmptyState compact main="No link views or acceptance events recorded yet." />
      ) : (
        <ul
          style={{
            margin: '0.5rem 0 0',
            paddingLeft: '1.25rem',
            fontSize: '0.9rem',
            color: 'var(--text-700)',
          }}
        >
          {events.map((ev) => {
            const meta = ev.metadata && typeof ev.metadata === 'object' && !Array.isArray(ev.metadata)
              ? (ev.metadata as Record<string, unknown>)
              : null
            const sig =
              ev.event_type === 'public_accept_submitted' && meta && meta.had_signature === true
                ? ' (with signature)'
                : ''
            const optionName =
              ev.event_type === 'option_viewed' && meta && typeof meta.option_name === 'string' && meta.option_name.trim()
                ? ` — ${meta.option_name.trim()}`
                : ''
            // v2.2873: "Declined by customer — went with another bid" / "Declined — office heard it by phone — …".
            const declineMeta = ev.event_type === 'declined' ? parseEstimateDeclineMetadata(meta) : null
            // v2.5992: the office's own line — "Good-through date extended to Nov 26, 2026 by Taunya (was Oct 24, 2026)".
            const extendedMeta = ev.event_type === 'good_through_extended' ? parseGoodThroughExtendedMetadata(meta) : null
            const declineNote = declineMeta?.note ? ` — “${declineMeta.note}”` : ''
            return (
              <li key={ev.id} style={{ marginBottom: '0.35rem' }}>
                {ev.event_type === 'declined'
                  ? estimateDeclinedLabel(declineMeta)
                  : extendedMeta
                    ? goodThroughExtendedLine(extendedMeta)
                    : estimateCustomerEventLabel(ev.event_type)}
                {optionName}
                {declineNote}
                {sig}
                {ev.client_ip?.trim() ? (
                  <>
                    {' · '}
                    <IpAddressMapButton ip={ev.client_ip} />
                  </>
                ) : null}{' '}
                — {formatNotificationDatetime(ev.occurred_at)}
                {ev.occurred_at?.trim() ? ` ${formatEstimateUpdatedRelativeCompact(ev.occurred_at)}` : ''}
              </li>
            )
          })}
        </ul>
      )}
    </EstimateCustomerActivityDetails>
  )
}
