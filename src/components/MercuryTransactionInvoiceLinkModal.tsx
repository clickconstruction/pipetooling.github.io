import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useToastContext } from '../contexts/ToastContext'
import { withSupabaseRetry } from '../utils/errorHandling'
import type { Database } from '../types/database'

type MercuryTxRow = Database['public']['Tables']['mercury_transactions']['Row']
type InvoiceLinkRow =
  Database['public']['Functions']['list_supply_house_invoices_for_tally_link']['Returns'][number]

export type MercuryTransactionInvoiceLinkModalProps = {
  open: boolean
  onClose: () => void
  transaction: MercuryTxRow | null
  /** When false, the Banking admin flow saves via the staff RPC. */
  tallySelfService?: boolean
  /** When set, staff are linking on this user's behalf (still saved via the staff RPC). */
  tallyActAsUserId?: string | null
  /** Fires after a successful save so the parent can refresh / close. */
  onSaved: () => void
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

function formatInvoiceDate(iso: string | null): string {
  if (!iso) return '—'
  // invoice_date / due_date are plain YYYY-MM-DD; render without TZ drift.
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return iso
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function MercuryTransactionInvoiceLinkModal({
  open,
  onClose,
  transaction,
  tallySelfService = false,
  tallyActAsUserId = null,
  onSaved,
}: MercuryTransactionInvoiceLinkModalProps) {
  const { showToast } = useToastContext()
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<InvoiceLinkRow[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const seededRef = useRef(false)

  const txId = transaction?.id ?? null

  const runSearch = useCallback(
    async (text: string) => {
      if (!txId) return
      setLoading(true)
      try {
        const data = await withSupabaseRetry(
          async () =>
            supabase.rpc('list_supply_house_invoices_for_tally_link', {
              p_mercury_transaction_id: txId,
              search_text: text,
            }),
          'list_supply_house_invoices_for_tally_link',
        )
        const list = (data as InvoiceLinkRow[]) ?? []
        setRows(list)
        if (!seededRef.current) {
          seededRef.current = true
          setSelected(new Set(list.filter((r) => r.already_linked).map((r) => r.invoice_id)))
        }
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Failed to load invoices', 'error')
      } finally {
        setLoading(false)
      }
    },
    [txId, showToast],
  )

  // Reset + initial load when opened.
  useEffect(() => {
    if (!open || !txId) return
    seededRef.current = false
    setSearch('')
    setSelected(new Set())
    setRows([])
    void runSearch('')
  }, [open, txId, runSearch])

  // Debounced search on input.
  useEffect(() => {
    if (!open || !txId || !seededRef.current) return
    const h = setTimeout(() => void runSearch(search.trim()), 250)
    return () => clearTimeout(h)
  }, [search, open, txId, runSearch])

  // Esc to close.
  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  const toggle = useCallback((invoiceId: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(invoiceId)) next.delete(invoiceId)
      else next.add(invoiceId)
      return next
    })
  }, [])

  async function handleSave() {
    if (!txId) return
    setSaving(true)
    try {
      const invoiceIds = Array.from(selected)
      const useStaff = !tallySelfService || Boolean(tallyActAsUserId)
      if (useStaff) {
        await withSupabaseRetry(
          async () =>
            supabase.rpc('replace_mercury_transaction_invoice_links_as_staff', {
              p_mercury_transaction_id: txId,
              p_invoice_ids: invoiceIds,
            }),
          'replace_mercury_transaction_invoice_links_as_staff',
        )
      } else {
        await withSupabaseRetry(
          async () =>
            supabase.rpc('replace_mercury_transaction_invoice_links_for_my_linked_card', {
              p_mercury_transaction_id: txId,
              p_invoice_ids: invoiceIds,
            }),
          'replace_mercury_transaction_invoice_links_for_my_linked_card',
        )
      }
      showToast(
        invoiceIds.length === 0
          ? 'Cleared invoice links.'
          : `Linked ${invoiceIds.length} invoice${invoiceIds.length === 1 ? '' : 's'}.`,
        'success',
      )
      onSaved()
      onClose()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!open || !transaction) return null

  const txAmount = Math.abs(Number(transaction.amount))

  return (
    <div
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1200,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="mercury-invoice-link-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          width: 'min(640px, calc(100vw - 2rem))',
          maxHeight: '90vh',
          overflow: 'auto',
          padding: '1rem 1.25rem',
          boxSizing: 'border-box',
        }}
      >
        <h2
          id="mercury-invoice-link-title"
          style={{ margin: '0 0 0.5rem', fontSize: '1.125rem', fontWeight: 600 }}
        >
          Link invoices
        </h2>
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
          This card charge of <strong>{formatCurrency(txAmount)}</strong>
          {transaction.counterparty_name ? (
            <>
              {' '}
              to <strong>{transaction.counterparty_name}</strong>
            </>
          ) : null}{' '}
          paid the invoice(s) you select below. The invoice's own job allocations handle job
          costing — this just records the match so the transaction is no longer flagged.
        </p>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by invoice #, supply house, or PO #"
          aria-label="Search supply-house invoices"
          style={{
            width: '100%',
            padding: '8px 10px',
            marginBottom: '0.5rem',
            fontSize: '0.875rem',
            boxSizing: 'border-box',
          }}
        />

        {loading ? (
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', padding: '0.5rem 0' }}>Loading…</div>
        ) : rows.length === 0 ? (
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', padding: '0.5rem 0' }}>
            No invoices found.
          </div>
        ) : (
          <div
            style={{
              border: '1px solid var(--border)',
              borderRadius: 6,
              overflow: 'hidden',
              marginBottom: '0.75rem',
            }}
          >
            {rows.map((r) => {
              const isSel = selected.has(r.invoice_id)
              return (
                <label
                  key={r.invoice_id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.6rem',
                    padding: '0.55rem 0.65rem',
                    borderBottom: '1px solid #f3f4f6',
                    background: isSel ? 'var(--bg-blue-tint)' : 'var(--surface)',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isSel}
                    onChange={() => toggle(r.invoice_id)}
                    style={{ marginTop: 3 }}
                  />
                  <span style={{ flex: 1, minWidth: 0, fontSize: '0.8125rem' }}>
                    <span style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 600 }}>
                        {r.supply_house_name} · #{r.invoice_number}
                        {r.counterparty_match ? (
                          <span
                            style={{
                              marginLeft: 6,
                              fontSize: '0.6875rem',
                              fontWeight: 600,
                              color: 'var(--text-blue-700)',
                              background: '#dbeafe',
                              borderRadius: 4,
                              padding: '1px 5px',
                            }}
                          >
                            match
                          </span>
                        ) : null}
                      </span>
                      <span style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>
                        {formatCurrency(Number(r.amount))}
                      </span>
                    </span>
                    <span style={{ display: 'block', color: 'var(--text-muted)', marginTop: 2 }}>
                      {formatInvoiceDate(r.invoice_date)}
                      {' · '}
                      {r.is_paid ? 'Paid' : 'Unpaid'}
                      {r.purchase_order_number ? ` · PO ${r.purchase_order_number}` : ''}
                    </span>
                    {r.job_allocation_summary ? (
                      <span style={{ display: 'block', color: 'var(--text-faint)', marginTop: 2 }}>
                        Jobs: {r.job_allocation_summary}
                      </span>
                    ) : (
                      <span style={{ display: 'block', color: 'var(--text-amber-700)', marginTop: 2 }}>
                        No job allocation on this invoice yet.
                      </span>
                    )}
                  </span>
                </label>
              )
            })}
          </div>
        )}

        <div
          style={{
            fontSize: '0.8125rem',
            color: 'var(--text-700)',
            marginBottom: '0.75rem',
          }}
        >
          {selected.size === 0
            ? 'No invoices selected — saving will clear any existing links.'
            : `${selected.size} invoice${selected.size === 1 ? '' : 's'} selected.`}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.45rem 0.85rem',
              border: '1px solid var(--border-strong)',
              background: 'var(--surface)',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            style={{
              padding: '0.45rem 1rem',
              borderRadius: 4,
              border: '1px solid #1d4ed8',
              background: saving ? '#93c5fd' : '#2563eb',
              color: 'white',
              cursor: saving ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
            }}
          >
            {saving ? 'Saving…' : 'Save links'}
          </button>
        </div>
      </div>
    </div>
  )
}
