import type { CSSProperties, ReactNode } from 'react'
import type { BidWithBuilder, EstimatorUser } from '../../types/bidWithBuilder'
import {
  bidAttestationDisplayName,
  normalizeBidDateInput,
  wholeCalendarDaysSinceSentDate,
} from '../../lib/bidDateSentDisplay'

function formatCompactCurrency(n: number | null): string {
  if (n == null) return '—'
  const k = n / 1000
  if (k % 1 === 0) return `$${k}k`
  return `$${k.toFixed(1)}k`
}

/** Matches Bids submission tables / bid due display (calendar bracket style). */
function formatDateYYMMDD(dateStr: string | null): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr + 'T12:00:00')
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  const diffMs = d.getTime() - today.getTime()
  const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000))
  const formattedDate = `${m}/${day}`
  if (diffDays < 0) return `${formattedDate} [+${Math.abs(diffDays)}]`
  return `${formattedDate} [-${diffDays}]`
}

function outcomeLabel(outcome: string | null): string {
  if (!outcome?.trim()) return '—'
  if (outcome === 'won') return 'Won'
  if (outcome === 'lost') return 'Lost'
  if (outcome === 'started_or_complete') return 'Started or Complete'
  return outcome
}

function formatLastContactDisplay(iso: string | null): string {
  if (!iso?.trim()) return '—'
  const ms = new Date(iso).getTime()
  if (!Number.isFinite(ms)) return '—'
  return new Date(iso).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })
}

function dash(v: string | null | undefined): string {
  const t = (v ?? '').trim()
  return t === '' ? '—' : t
}

function SectionTitle({ children }: { children: ReactNode }) {
  const style: CSSProperties = {
    gridColumn: '1 / -1',
    marginTop: 0,
    marginBottom: '0.35rem',
    paddingTop: '0.65rem',
    borderTop: '1px solid #e5e7eb',
    fontSize: '0.75rem',
    fontWeight: 700,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    textAlign: 'right',
  }
  return <div style={style}>{children}</div>
}

function DetailPair({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto minmax(0, 1fr)',
        columnGap: '0.75rem',
        rowGap: '0.15rem',
        alignItems: 'baseline',
        fontSize: '0.875rem',
        minWidth: 0,
      }}
    >
      <strong style={{ color: '#374151', fontWeight: 600 }}>{label}</strong>
      <span style={{ color: '#111827', wordBreak: 'break-word' }}>{value}</span>
    </div>
  )
}

function BidDateSentNote({ bid, estimatorUsers }: { bid: BidWithBuilder; estimatorUsers: EstimatorUser[] }) {
  const raw = bid.bid_date_sent
  if (!raw?.trim()) return null
  const dNorm = normalizeBidDateInput(raw)
  const days = wholeCalendarDaysSinceSentDate(dNorm)
  const serverSent = normalizeBidDateInput(bid.bid_date_sent)
  const ackById = bid.bid_date_sent_attested_by
  return (
    <div style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: '0.25rem', lineHeight: 1.45 }}>
      <div>
        Sent {days} day{days === 1 ? '' : 's'} ago (by calendar date).
      </div>
      {ackById ? (
        <div>Acknowledged by {bidAttestationDisplayName(estimatorUsers, ackById)}</div>
      ) : serverSent === dNorm ? (
        <div style={{ color: '#b45309' }}>No attestation on file (saved before this feature).</div>
      ) : null}
    </div>
  )
}

export type BidSubmissionFollowupExpandableDetailsProps = {
  bid: BidWithBuilder
  narrowViewport640: boolean
  estimatorUsers: EstimatorUser[]
}

export function BidSubmissionFollowupExpandableDetails({
  bid,
  narrowViewport640,
  estimatorUsers,
}: BidSubmissionFollowupExpandableDetailsProps) {
  const gridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: narrowViewport640 ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))',
    gap: '0.6rem 1.25rem',
    alignItems: 'start',
    paddingTop: '0.35rem',
    marginTop: '0.35rem',
  }

  const notesText = (bid.notes ?? '').trim()

  return (
    <details style={{ marginTop: '0.75rem' }}>
      <summary
        style={{
          cursor: 'pointer',
          listStyle: 'none',
          padding: '0.5rem 0.75rem',
          background: '#f9fafb',
          border: '1px solid #e5e7eb',
          borderRadius: 6,
          fontWeight: 600,
          fontSize: '0.875rem',
          color: '#374151',
        }}
      >
        Full bid details
      </summary>
      <div style={gridStyle}>
        <SectionTitle>Trade &amp; lifecycle</SectionTitle>
        <DetailPair label="Service type" value={dash(bid.service_type?.name ?? null)} />
        <DetailPair label="Bid due date" value={formatDateYYMMDD(bid.bid_due_date)} />
        <DetailPair label="Win / Loss" value={outcomeLabel(bid.outcome)} />
        <div style={{ minWidth: 0 }}>
          <DetailPair label="Bid date sent" value={formatDateYYMMDD(bid.bid_date_sent)} />
          <BidDateSentNote bid={bid} estimatorUsers={estimatorUsers} />
        </div>
        {bid.outcome === 'lost' ? (
          <DetailPair label="Why did we lose?" value={dash(bid.loss_reason)} />
        ) : null}
        {bid.outcome === 'won' ? (
          <DetailPair label="Start date" value={formatDateYYMMDD(bid.estimated_job_start_date)} />
        ) : null}

        <SectionTitle>Site &amp; plans</SectionTitle>
        <DetailPair
          label="Distance to office"
          value={dash(bid.distance_from_office != null ? String(bid.distance_from_office).trim() : null)}
        />
        <DetailPair label="Plan pages" value={dash(bid.plan_pages)} />
        <DetailPair label="Design drawing plan date" value={formatDateYYMMDD(bid.design_drawing_plan_date)} />

        <SectionTitle>Submission</SectionTitle>
        <DetailPair label="Submitted to" value={dash(bid.submitted_to)} />

        <SectionTitle>Financial</SectionTitle>
        <DetailPair label="Bid value" value={formatCompactCurrency(bid.bid_value != null ? Number(bid.bid_value) : null)} />
        <DetailPair label="Agreed value" value={formatCompactCurrency(bid.agreed_value != null ? Number(bid.agreed_value) : null)} />
        <DetailPair label="Maximum profit" value={formatCompactCurrency(bid.profit != null ? Number(bid.profit) : null)} />

        <SectionTitle>Tracking</SectionTitle>
        <div style={{ gridColumn: '1 / -1', minWidth: 0 }}>
          <DetailPair label="Last contact (bid)" value={formatLastContactDisplay(bid.last_contact)} />
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.8125rem', color: '#6b7280', lineHeight: 1.45 }}>
            Separate from &quot;Last update&quot; in the list below, which uses submission notes and customer contacts.
          </p>
        </div>

        <SectionTitle>Notes</SectionTitle>
        <div style={{ gridColumn: '1 / -1', minWidth: 0 }}>
          {notesText === '' ? (
            <span style={{ fontSize: '0.875rem', color: '#111827' }}>—</span>
          ) : (
            <pre
              style={{
                margin: 0,
                fontFamily: 'inherit',
                fontSize: '0.875rem',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                color: '#111827',
              }}
            >
              {bid.notes}
            </pre>
          )}
        </div>
      </div>
      <style>{`
        details summary::-webkit-details-marker {
          display: none;
        }
      `}</style>
    </details>
  )
}
