import type { BidWithBuilder } from '../../types/bidWithBuilder'
import { bidDisplayName } from '../../lib/bids/bidFormatting'
import { getBidStatusLabel } from '../../lib/bids/bidStatusLabel'
import { compareBidsForPartyDetail } from '../../lib/bids/compareBidsForPartyDetail'
import { ModalShell } from './ModalShell'

/**
 * Shared detail dialog for a bid "party" (a customer or a legacy GC/builder): shows their
 * name, address, contact rows, won/lost bid lists, and a sorted table of all their bids.
 *
 * Presentational only. The parent (`Bids.tsx`) owns the open state, derives the bid arrays,
 * and builds `contactRows` so the customer (phone/email, present-only) vs builder
 * (contact number, always shown) differences are preserved.
 */
export function BidPartyDetailModal({
  open,
  name,
  address,
  contactRows,
  wonBids,
  lostBids,
  allBids,
  onClose,
  onSelectBid,
}: {
  open: boolean
  name: string
  address: string | null
  contactRows: { label: string; value: string }[]
  wonBids: BidWithBuilder[]
  lostBids: BidWithBuilder[]
  allBids: BidWithBuilder[]
  onClose: () => void
  onSelectBid?: (bid: BidWithBuilder) => void
}) {
  if (!open) return null

  return (
    <ModalShell zIndex={990} cardStyle={{ background: 'white', padding: '2rem', borderRadius: 8, maxWidth: '500px', width: '90%' }}>
      <h2 style={{ marginBottom: '1rem' }}>{name}</h2>
      <p style={{ margin: '0.25rem 0' }}><strong>Address:</strong> {address || '—'}</p>
      {contactRows.map((r) => (
        <p key={r.label} style={{ margin: '0.25rem 0' }}><strong>{r.label}:</strong> {r.value}</p>
      ))}
      <p style={{ margin: '0.25rem 0' }}><strong>Won bids:</strong> {wonBids.length}</p>
      {wonBids.length > 0 && (
        <ul style={{ margin: '0.25rem 0 1rem 1.5rem', padding: 0 }}>
          {wonBids.map((b) => (
            <li key={b.id}>{bidDisplayName(b) || b.id}</li>
          ))}
        </ul>
      )}
      <p style={{ margin: '0.25rem 0' }}><strong>Lost bids:</strong> {lostBids.length}</p>
      {lostBids.length > 0 && (
        <ul style={{ margin: '0.25rem 0 1rem 1.5rem', padding: 0 }}>
          {lostBids.map((b) => (
            <li key={b.id}>{bidDisplayName(b) || b.id}</li>
          ))}
        </ul>
      )}
      <p style={{ margin: '1rem 0 0.5rem', fontWeight: 600 }}>All bids</p>
      <div style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 4 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#f9fafb', position: 'sticky', top: 0 }}>
            <tr>
              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Bid / Project</th>
              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {[...allBids]
              .sort(compareBidsForPartyDetail)
              .map((b) => (
                <tr
                  key={b.id}
                  onClick={onSelectBid ? () => onSelectBid(b) : undefined}
                  title={onSelectBid ? 'Open bid' : undefined}
                  style={{ borderBottom: '1px solid #e5e7eb', cursor: onSelectBid ? 'pointer' : undefined }}
                  onMouseEnter={onSelectBid ? (e) => { e.currentTarget.style.background = '#f9fafb' } : undefined}
                  onMouseLeave={onSelectBid ? (e) => { e.currentTarget.style.background = '' } : undefined}
                >
                  <td style={{ padding: '0.5rem 0.75rem' }}>{bidDisplayName(b) || b.id}</td>
                  <td style={{ padding: '0.5rem 0.75rem' }}>{getBidStatusLabel(b)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <button type="button" onClick={onClose} style={{ marginTop: '1rem', padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>
        Close
      </button>
    </ModalShell>
  )
}
