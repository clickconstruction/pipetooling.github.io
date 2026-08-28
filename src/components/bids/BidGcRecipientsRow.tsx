import { useEffect, useState, type ReactNode } from 'react'

import { supabase } from '../../lib/supabase'
import { addGcsButtonLabel, filterPickableGcs, tickedSummary } from '../../lib/bids/gcRecipientPicker'
import { extractContactFromCustomer } from '../../lib/customerContactDisplay'
import { withSupabaseRetry } from '../../utils/errorHandling'
import type { Database } from '../../types/database'

type Customer = Database['public']['Tables']['customers']['Row']

export type BidGcRecipientRow = {
  id: string
  bid_id: string
  customer_id: string
  source: 'manual' | 'version'
}

export type GcCardRole = 'primary' | 'same' | 'packet'

const ROLE_CHIP: Record<GcCardRole, { label: (sameAs: string | null) => string; title: string; bg: string; fg: string }> = {
  primary: {
    label: () => '★ Bid’s GC',
    title: 'The bid runs in their name — their letter is the letter.',
    bg: 'var(--bg-amber-tint)',
    fg: 'var(--text-amber-800)',
  },
  same: {
    label: (sameAs) => (sameAs ? `same letter as ${sameAs}` : 'same letter'),
    title: 'Got the same letter as the bid’s GC — its answer is tracked with the bid. Use ＋ Add GC on the bid’s pages to price it separately.',
    bg: 'var(--bg-blue-tint)',
    fg: 'var(--text-blue-800)',
  },
  packet: {
    label: () => 'own packet',
    title: 'Has its own packet — its own prices, letter, and answer. See Send to on the bid’s pages.',
    bg: 'var(--bg-green-tint)',
    fg: 'var(--text-green-800)',
  },
}

/**
 * One GC as a card (v2.2383, owner-approved prototype): every GC on a bid —
 * the bid's own GC included — renders the same shape (name, address, contact
 * chips) with its ROLE as a small chip instead of a different layout.
 */
export function GcCard({
  name,
  address,
  phone,
  email,
  role,
  sameAsName = null,
  action,
  onRemove,
  removeBusy = false,
  details,
}: {
  name: string
  address?: string | null
  phone?: string | null
  email?: string | null
  role: GcCardRole
  /** The bid GC's name, for the same-letter chip's label. */
  sameAsName?: string | null
  /** Optional right-side action (e.g. the primary card's "change ▸"). */
  action?: ReactNode
  onRemove?: () => void
  removeBusy?: boolean
  /** Full-width slot under the card row (per-GC due / submitted-to / ITB, Phase 4). */
  details?: ReactNode
}) {
  const chip = ROLE_CHIP[role]
  const ph = (phone ?? '').trim()
  const em = (email ?? '').trim()
  const hasPhone = Boolean(ph) && ph !== '—'
  const hasEmail = Boolean(em) && em !== '—'
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        flexWrap: 'wrap',
        background: 'var(--bg-muted)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '0.55rem 0.8rem',
        marginBottom: '0.45rem',
      }}
    >
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{name}</div>
        {address ? <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{address}</div> : null}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.2rem' }}>
          {hasPhone ? (
            <span style={{ fontSize: '0.72rem', padding: '0.05rem 0.5rem', borderRadius: 999, background: 'var(--surface)', color: 'var(--text-700)' }}>☎ {ph}</span>
          ) : null}
          {hasEmail ? (
            <span style={{ fontSize: '0.72rem', padding: '0.05rem 0.5rem', borderRadius: 999, background: 'var(--surface)', color: 'var(--text-700)' }}>✉ {em}</span>
          ) : null}
          {!hasPhone && !hasEmail ? (
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>no contact on file</span>
          ) : null}
        </div>
      </div>
      <span
        title={chip.title}
        style={{
          fontSize: '0.68rem',
          fontWeight: 700,
          borderRadius: 999,
          padding: '0.12rem 0.6rem',
          whiteSpace: 'nowrap',
          background: chip.bg,
          color: chip.fg,
          cursor: 'help',
        }}
      >
        {chip.label(sameAsName)}
      </span>
      {action}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          disabled={removeBusy}
          aria-label={`Remove ${name} from this bid`}
          title="Remove from this bid"
          style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1rem', padding: '0 0.2rem', lineHeight: 1 }}
        >
          {'×'}
        </button>
      ) : null}
      {details ? <div style={{ flexBasis: '100%', minWidth: 0 }}>{details}</div> : null}
    </div>
  )
}

export type BidGcRecipientsRowProps = {
  /** null on the New Bid form — the row renders a save-first hint instead. */
  bidId: string | null
  /** The bid-level (primary) GC — excluded from the picker; never duplicated here. */
  bidCustomerId: string | null
  customers: Customer[]
  canEdit: boolean
  /** When set (v2.2383), the add-GC picker offers "＋ New GC…" — opens the app's
      customer form stacked over Edit Bid and adds the result straight to the bid. */
  onCreateNew?: (onCreated: (customer: Customer | null) => void) => void
  /** Per-GC due / submitted-to / ITB editor slot (Phase 4) — rendered under each card. */
  renderGcDetails?: (customerId: string) => ReactNode
}

/**
 * The bid's extra GC recipients (`bid_gc_recipients`), rendered as GcCards
 * under the bid-GC card (v2.2383 — was the "Also sent to" chip row).
 * Self-contained: loads, adds, and removes rows itself so `BidFormModal`
 * only mounts it. Table name is cast until gen-types runs post-push, and
 * every read degrades to an empty list so a client deployed ahead of the
 * migration renders nothing instead of crashing (Banking quirk-#17 pattern).
 */
export function BidGcRecipientsRow({ bidId, bidCustomerId, customers, canEdit, onCreateNew, renderGcDetails }: BidGcRecipientsRowProps) {
  const [rows, setRows] = useState<BidGcRecipientRow[]>([])
  const [available, setAvailable] = useState(true)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [ticked, setTicked] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setRows([])
    setPickerOpen(false)
    setSearch('')
    setTicked(new Set())
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
  const pickable = filterPickableGcs(customers, { bidCustomerId, recipientIds, search })
  const bidGcName = customers.find((c) => c.id === bidCustomerId)?.name ?? "the bid's GC"

  function toggleTicked(customerId: string) {
    setTicked((prev) => {
      const next = new Set(prev)
      if (next.has(customerId)) next.delete(customerId)
      else next.add(customerId)
      return next
    })
  }

  function closePicker() {
    setPickerOpen(false)
    setSearch('')
    setTicked(new Set())
  }

  async function insertRecipients(customerIds: string[]) {
    if (!bidId || customerIds.length === 0) return
    await withSupabaseRetry(
      async () => (supabase as never as { from: (t: string) => { insert: (v: object) => Promise<{ data: unknown; error: { message: string } | null }> } })
        .from('bid_gc_recipients')
        .insert(customerIds.map((customerId) => ({ bid_id: bidId, customer_id: customerId, source: 'manual' }))),
      'add bid recipients',
    )
    setRows((prev) => [...prev, ...customerIds.map((customerId) => ({ id: `local-${customerId}`, bid_id: bidId, customer_id: customerId, source: 'manual' as const }))])
  }

  async function addTickedRecipients() {
    if (!bidId || busy || ticked.size === 0) return
    const customerIds = [...ticked].filter((id) => !recipientIds.has(id))
    if (customerIds.length === 0) {
      closePicker()
      return
    }
    setBusy(true)
    try {
      await insertRecipients(customerIds)
      closePicker()
    } finally {
      setBusy(false)
    }
  }

  /** "＋ New GC…" — the app's customer form opens STACKED over Edit Bid; the
      new customer joins the bid the moment it saves. Nobody leaves the modal. */
  function createAndAdd() {
    if (!onCreateNew) return
    closePicker()
    onCreateNew((c) => {
      if (!c || recipientIds.has(c.id) || c.id === bidCustomerId) return
      setBusy(true)
      void insertRecipients([c.id]).finally(() => setBusy(false))
    })
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
    <div style={{ margin: '0 0 1rem' }}>
      {bidId ? (
        <>
          {rows.map((r) => {
            const c = customers.find((x) => x.id === r.customer_id)
            const contact = c ? extractContactFromCustomer(c) : { phone: '', email: '' }
            return (
              <GcCard
                key={r.customer_id}
                name={c?.name ?? 'Unknown customer'}
                address={c?.address}
                phone={contact.phone}
                email={contact.email}
                role={r.source === 'version' ? 'packet' : 'same'}
                sameAsName={bidGcName}
                onRemove={canEdit ? () => void removeRecipient(r.customer_id) : undefined}
                removeBusy={busy}
                details={renderGcDetails?.(r.customer_id)}
              />
            )
          })}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', position: 'relative' }}>
            {canEdit ? (
              <span style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => (pickerOpen ? closePicker() : setPickerOpen(true))}
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
                  + Add GCs
                </button>
                {pickerOpen ? (
                  <div
                    style={{
                      position: 'absolute',
                      top: '110%',
                      left: 0,
                      width: 300,
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
                      placeholder="Search customers — tick all that apply"
                      aria-label="Search recipients to add"
                      autoFocus
                      onKeyDown={(e) => { if (e.key === 'Escape') closePicker() }}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '0.45rem 0.5rem', border: 'none', borderBottom: '1px solid var(--border)', borderRadius: '4px 4px 0 0', fontSize: '0.8125rem' }}
                    />
                    <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                      {pickable.slice(0, 30).map((c) => (
                        <div
                          key={c.id}
                          onClick={() => toggleTicked(c.id)}
                          style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', padding: '0.45rem 0.5rem', cursor: 'pointer', borderBottom: '1px solid var(--border)', fontSize: '0.8125rem' }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-muted)' }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surface)' }}
                        >
                          <input
                            type="checkbox"
                            checked={ticked.has(c.id)}
                            onChange={() => toggleTicked(c.id)}
                            onClick={(e) => e.stopPropagation()}
                            aria-label={`Add ${c.name}`}
                            style={{ marginTop: 2 }}
                          />
                          <span>
                            <span style={{ display: 'block', fontWeight: 500 }}>{c.name}</span>
                            {c.address ? <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.address}</span> : null}
                          </span>
                        </div>
                      ))}
                      {pickable.length === 0 ? (
                        <div style={{ padding: '0.45rem 0.5rem', color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.8125rem' }}>No customers found</div>
                      ) : null}
                      {onCreateNew ? (
                        <div
                          onClick={createAndAdd}
                          style={{ padding: '0.45rem 0.5rem', cursor: 'pointer', color: 'var(--text-link)', fontWeight: 600, fontSize: '0.8125rem', borderTop: '1px solid var(--border)' }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-muted)' }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surface)' }}
                          title="Opens the customer form on top of this modal — the new GC joins the bid the moment it saves"
                        >
                          ＋ New GC — create without leaving this modal
                        </div>
                      ) : null}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', padding: '0.4rem 0.5rem', borderTop: '1px solid var(--border)', background: 'var(--bg-muted)', borderRadius: '0 0 4px 4px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{tickedSummary(ticked.size)}</span>
                      <span style={{ display: 'flex', gap: '0.4rem' }}>
                        <button type="button" onClick={closePicker} disabled={busy} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.8125rem', cursor: 'pointer' }}>
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => void addTickedRecipients()}
                          disabled={busy || ticked.size === 0}
                          style={{
                            background: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: 4,
                            padding: '0.28rem 0.7rem',
                            fontSize: '0.8125rem',
                            fontWeight: 600,
                            cursor: busy || ticked.size === 0 ? 'default' : 'pointer',
                            opacity: busy || ticked.size === 0 ? 0.5 : 1,
                          }}
                        >
                          {busy ? 'Adding…' : addGcsButtonLabel(ticked.size)}
                        </button>
                      </span>
                    </div>
                  </div>
                ) : null}
              </span>
            ) : null}
            {rows.length === 0 ? (
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Only {bidGcName} so far. GCs with their own packet appear here on their own.</span>
            ) : null}
          </div>
        </>
      ) : (
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Save the bid first, then add the other GCs it went to.</span>
      )}
      {bidId && canEdit ? (
        <p style={{ margin: '0.45rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: '60ch' }}>
          Same-letter GCs get {bidGcName}&rsquo;s letter — give one its own packet with{' '}
          <strong style={{ fontWeight: 600, color: 'var(--text-700)' }}>＋ Add GC</strong> on the bid&rsquo;s pages.
        </p>
      ) : null}
    </div>
  )
}
