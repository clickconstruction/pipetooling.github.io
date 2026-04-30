import { useEffect, useMemo, useState } from 'react'
import { useLedgerPrefixMap } from '../../contexts/LedgerDisplayPrefixContext'
import { formatBidLedgerDocTitle, type LedgerPrefixMap } from '../../lib/ledgerDisplayPrefixes'

export type JobBidLinkOption = {
  id: string
  project_name: string | null
  bid_number: string | null
  customer_id: string | null
  customers: { name: string } | null
  service_type_id?: string | null
}

type JobBidLinkChoiceModalProps = {
  open: boolean
  onClose: () => void
  zIndex: number
  bids: JobBidLinkOption[]
  customerId: string | null
  onLinked: (bidId: string) => void
}

function bidRowTitle(b: JobBidLinkOption, prefixMap: LedgerPrefixMap): string {
  const name = (b.project_name ?? '').trim() || 'Untitled'
  const n = b.bid_number != null && String(b.bid_number).trim() !== '' ? String(b.bid_number).trim() : null
  return n ? formatBidLedgerDocTitle(prefixMap, b.service_type_id ?? null, n, name) : name
}

export default function JobBidLinkChoiceModal({
  open,
  onClose,
  zIndex,
  bids,
  customerId,
  onLinked,
}: JobBidLinkChoiceModalProps) {
  const prefixMap = useLedgerPrefixMap()
  const [showAllBids, setShowAllBids] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!open) return
    setShowAllBids(!customerId)
    setSearch('')
  }, [open, customerId])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const scopedBids = useMemo(() => {
    if (showAllBids || !customerId) return bids
    return bids.filter((b) => b.customer_id === customerId)
  }, [bids, customerId, showAllBids])

  const filteredBids = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return scopedBids
    return scopedBids.filter((b) => {
      if (bidRowTitle(b, prefixMap).toLowerCase().includes(q)) return true
      if (b.bid_number != null && String(b.bid_number).toLowerCase().includes(q)) return true
      if ((b.customers?.name ?? '').toLowerCase().includes(q)) return true
      return false
    })
  }, [scopedBids, search, prefixMap])

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex,
        padding: '1rem',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="job-bid-link-choice-title"
        style={{
          background: 'white',
          padding: '1.25rem 1.5rem',
          borderRadius: 8,
          width: '100%',
          maxWidth: 420,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="job-bid-link-choice-title" style={{ margin: '0 0 0.5rem', fontSize: '1.125rem', fontWeight: 600 }}>
          Link bid proposal
        </h2>
        <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#6b7280' }}>
          Choose a bid to associate with this job. Create new bids from the Bids page.
        </p>
        {customerId ? (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.75rem', fontSize: '0.875rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={showAllBids} onChange={(e) => setShowAllBids(e.target.checked)} />
            Show all bids
          </label>
        ) : null}
        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>
          Search
        </label>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Bid #, title, or customer"
          autoComplete="off"
          style={{
            width: '100%',
            padding: '0.5rem 0.625rem',
            marginBottom: '0.75rem',
            border: '1px solid #d1d5db',
            borderRadius: 6,
            fontSize: '0.875rem',
            boxSizing: 'border-box',
          }}
        />
        <div
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: 6,
            maxHeight: 240,
            overflowY: 'auto',
            flexShrink: 0,
          }}
        >
          {filteredBids.length === 0 ? (
            <div style={{ padding: '1rem', fontSize: '0.875rem', color: '#6b7280' }}>
              {scopedBids.length === 0 && customerId && !showAllBids ? (
                <>
                  No bids for this customer yet. Try <strong>Show all bids</strong> or create a bid on the Bids page.
                </>
              ) : (
                <>No bids match your search.</>
              )}
            </div>
          ) : (
            filteredBids.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => onLinked(b.id)}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '0.6rem 0.75rem',
                  border: 'none',
                  borderBottom: '1px solid #f3f4f6',
                  background: 'white',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: '0.875rem',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f9fafb'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'white'
                }}
              >
                <div style={{ fontWeight: 500 }}>{bidRowTitle(b, prefixMap)}</div>
                {b.customers?.name ? (
                  <div style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: 2 }}>{b.customers.name}</div>
                ) : null}
              </button>
            ))
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            marginTop: '1rem',
            padding: '0.5rem 0.75rem',
            alignSelf: 'flex-start',
            background: '#f3f4f6',
            border: '1px solid #d1d5db',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: '0.875rem',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
