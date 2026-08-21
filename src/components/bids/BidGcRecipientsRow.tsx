import { useEffect, useState } from 'react'

import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import type { Database } from '../../types/database'

type Customer = Database['public']['Tables']['customers']['Row']

export type BidGcRecipientRow = {
  id: string
  bid_id: string
  customer_id: string
  source: 'manual' | 'version'
}

export type BidGcRecipientsRowProps = {
  /** null on the New Bid form — the row renders a save-first hint instead. */
  bidId: string | null
  /** The bid-level (primary) GC — excluded from the picker; never duplicated here. */
  bidCustomerId: string | null
  customers: Customer[]
  canEdit: boolean
  getCustomerDisplay: (customer: Customer) => string
}

/**
 * "Also sent to" — the bid's extra GC recipients (`bid_gc_recipients`).
 * Self-contained: loads, adds, and removes rows itself so `BidFormModal`
 * only mounts it. Table name is cast until gen-types runs post-push, and
 * every read degrades to an empty list so a client deployed ahead of the
 * migration renders nothing instead of crashing (Banking quirk-#17 pattern).
 */
export function BidGcRecipientsRow({ bidId, bidCustomerId, customers, canEdit, getCustomerDisplay }: BidGcRecipientsRowProps) {
  const [rows, setRows] = useState<BidGcRecipientRow[]>([])
  const [available, setAvailable] = useState(true)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setRows([])
    setPickerOpen(false)
    setSearch('')
    if (!bidId) return
    let cancelled = false
    void (async () => {
      const { data, error } = await (supabase as never as {
        from: (t: string) => {
          select: (c: string) => { eq: (k: string, v: string) => Promise<{ data: BidGcRecipientRow[] | null; error: { message: string } | null }> }
        }
      })
        .from('bid_gc_recipients')
        .select('id, bid_id, customer_id, source')
        .eq('bid_id', bidId)
      if (cancelled) return
      if (error) {
        setAvailable(false) // table not deployed yet — render nothing
        return
      }
      setAvailable(true)
      setRows(data ?? [])
    })()
    return () => {
      cancelled = true
    }
  }, [bidId])

  if (!available) return null

  const recipientIds = new Set(rows.map((r) => r.customer_id))
  const pickable = customers.filter((c) => {
    if (c.id === bidCustomerId || recipientIds.has(c.id)) return false
    const q = search.toLowerCase()
    return !q || c.name.toLowerCase().includes(q) || (c.address || '').toLowerCase().includes(q)
  })

  async function addRecipient(customerId: string) {
    if (!bidId || busy) return
    setBusy(true)
    try {
      await withSupabaseRetry(
        async () => (supabase as never as { from: (t: string) => { insert: (v: object) => Promise<{ data: unknown; error: { message: string } | null }> } })
          .from('bid_gc_recipients')
          .insert({ bid_id: bidId, customer_id: customerId, source: 'manual' }),
        'add bid recipient',
      )
      const c = customers.find((x) => x.id === customerId)
      setRows((prev) => [...prev, { id: `local-${customerId}`, bid_id: bidId, customer_id: customerId, source: 'manual' }])
      setSearch('')
      setPickerOpen(false)
      void c
    } finally {
      setBusy(false)
    }
  }

  async function removeRecipient(customerId: string) {
    if (!bidId || busy) return
    setBusy(true)
    try {
      await withSupabaseRetry(
        async () => (supabase as never as {
          from: (t: string) => { delete: () => { eq: (k: string, v: string) => { eq: (k2: string, v2: string) => Promise<{ data: unknown; error: { message: string } | null }> } } }
        })
          .from('bid_gc_recipients')
          .delete()
          .eq('bid_id', bidId)
          .eq('customer_id', customerId),
        'remove bid recipient',
      )
      setRows((prev) => prev.filter((r) => r.customer_id !== customerId))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ margin: '-0.25rem 0 1rem' }}>
      <label style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 500 }}>
        Also sent to
        <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
          {' '}— other GCs bidding this project
        </span>
      </label>
      {bidId ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center', position: 'relative' }}>
          {rows.map((r) => {
            const c = customers.find((x) => x.id === r.customer_id)
            return (
              <span
                key={r.customer_id}
                title={r.source === 'version' ? 'Synced from a bid Version pointed at this GC' : 'Added by hand'}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  fontSize: '0.8125rem',
                  padding: '0.25rem 0.35rem 0.25rem 0.6rem',
                  borderRadius: 999,
                  background: 'var(--bg-muted)',
                  color: 'var(--text-700)',
                }}
              >
                {c ? getCustomerDisplay(c) : 'Unknown customer'}
                {canEdit ? (
                  <button
                    type="button"
                    onClick={() => void removeRecipient(r.customer_id)}
                    disabled={busy}
                    aria-label={`Remove recipient ${c?.name ?? ''}`}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      color: 'var(--text-muted)',
                      fontSize: '0.9rem',
                      padding: '0 0.2rem',
                      lineHeight: 1,
                    }}
                  >
                    {'×'}
                  </button>
                ) : null}
              </span>
            )
          })}
          {rows.length === 0 ? (
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Only the GC above.</span>
          ) : null}
          {canEdit ? (
            <span style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setPickerOpen((v) => !v)}
                disabled={busy}
                style={{
                  fontSize: '0.8125rem',
                  padding: '0.25rem 0.6rem',
                  borderRadius: 999,
                  border: '1px dashed var(--border-strong)',
                  background: 'transparent',
                  color: 'var(--text-link)',
                  cursor: 'pointer',
                }}
              >
                + Add GC
              </button>
              {pickerOpen ? (
                <div
                  style={{
                    position: 'absolute',
                    top: '110%',
                    left: 0,
                    width: 280,
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                    zIndex: 120,
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  }}
                >
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search customers..."
                    aria-label="Search recipients to add"
                    autoFocus
                    style={{ width: '100%', boxSizing: 'border-box', padding: '0.45rem 0.5rem', border: 'none', borderBottom: '1px solid var(--border)', borderRadius: '4px 4px 0 0', fontSize: '0.8125rem' }}
                  />
                  <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                    {pickable.slice(0, 30).map((c) => (
                      <div
                        key={c.id}
                        onClick={() => void addRecipient(c.id)}
                        style={{ padding: '0.45rem 0.5rem', cursor: 'pointer', borderBottom: '1px solid var(--border)', fontSize: '0.8125rem' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-muted)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surface)' }}
                      >
                        <div style={{ fontWeight: 500 }}>{c.name}</div>
                        {c.address ? <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.address}</div> : null}
                      </div>
                    ))}
                    {pickable.length === 0 ? (
                      <div style={{ padding: '0.45rem 0.5rem', color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.8125rem' }}>No customers found</div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </span>
          ) : null}
        </div>
      ) : (
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Save the bid first, then add the other GCs it went to.</span>
      )}
    </div>
  )
}
