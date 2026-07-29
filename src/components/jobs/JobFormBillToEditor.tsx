import { useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'
import { formatCurrency } from '../../lib/jobs/jobFormMoney'
import {
  billToUpdatePayload,
  invoiceBillToFromRow,
  validateBillToDraft,
  type InvoiceBillToRowFields,
} from '../../lib/jobs/invoiceBillTo'

export type BillToEditorInvoice = InvoiceBillToRowFields & {
  id: string
  amount: number | string | null
}

const fieldStyle: CSSProperties = {
  width: '100%',
  padding: '0.45rem 0.6rem',
  fontSize: '0.875rem',
  border: '1px solid var(--border-strong)',
  borderRadius: 6,
  background: 'var(--surface)',
  color: 'var(--text-strong)',
  boxSizing: 'border-box',
}

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: '0.75rem',
  fontWeight: 600,
  color: 'var(--text-600)',
  marginBottom: '0.2rem',
}

/**
 * Per-invoice "Bill to" editor (v2.1086): choose who receives THIS invoice —
 * the job's customer (default) or someone else (e.g. the customer's tenant
 * paying a hazmat fee). Writes `jobs_ledger_invoices.bill_to_*` directly;
 * drafts only (the opener gates on status). Saving with a blank email clears
 * the override.
 */
export function JobFormBillToEditor({
  invoice,
  jobCustomerName,
  onClose,
  onSaved,
  zIndex,
}: {
  invoice: BillToEditorInvoice
  jobCustomerName: string | null
  onClose: () => void
  /** Refetch the job so the invoice list shows the new recipient. */
  onSaved: () => void
  zIndex: number
}) {
  const { showToast } = useToastContext()
  const existing = invoiceBillToFromRow(invoice)
  const [name, setName] = useState(existing?.name ?? '')
  const [email, setEmail] = useState(existing?.email ?? '')
  const [phone, setPhone] = useState(existing?.phone ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function save(draft: { name: string; email: string; phone: string }) {
    const validation = validateBillToDraft(draft)
    if (validation) {
      setError(validation)
      return
    }
    setSaving(true)
    setError(null)
    try {
      await withSupabaseRetry(
        () => supabase.from('jobs_ledger_invoices').update(billToUpdatePayload(draft)).eq('id', invoice.id),
        'save invoice bill-to',
      )
      const cleared = !draft.email.trim()
      showToast(
        cleared
          ? `Invoice goes to the job customer${jobCustomerName ? ` (${jobCustomerName})` : ''} again.`
          : `Invoice will be billed to ${draft.email.trim()}.`,
        'success',
      )
      onSaved()
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not save the recipient')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex,
        padding: '1rem',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose()
      }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Bill this invoice to"
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          padding: '1.25rem',
          maxWidth: 420,
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
        }}
      >
        <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-strong)' }}>
          Bill this invoice to…
        </div>
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
          The <strong>${formatCurrency(Number(invoice.amount ?? 0))}</strong> invoice normally goes to the job
          customer{jobCustomerName ? ` (${jobCustomerName})` : ''}. Enter someone else — a tenant, a property
          manager — and this one invoice bills them instead. The rest of the job still bills the customer.
        </div>
        <div>
          <label style={labelStyle} htmlFor="bill-to-editor-name">
            Name
          </label>
          <input
            id="bill-to-editor-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Tenant"
            style={fieldStyle}
          />
        </div>
        <div>
          <label style={labelStyle} htmlFor="bill-to-editor-email">
            Email (required)
          </label>
          <input
            id="bill-to-editor-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jane@example.com"
            style={fieldStyle}
          />
        </div>
        <div>
          <label style={labelStyle} htmlFor="bill-to-editor-phone">
            Phone (optional)
          </label>
          <input
            id="bill-to-editor-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="555-555-5555"
            style={fieldStyle}
          />
        </div>
        {error ? (
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-red-700)' }}>{error}</div>
        ) : null}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center' }}>
          {existing ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => void save({ name: '', email: '', phone: '' })}
              style={{
                padding: '0.45rem 0.6rem',
                fontSize: '0.8125rem',
                background: 'transparent',
                color: 'var(--text-red-700)',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
              }}
              title="Remove the override — this invoice bills the job customer again"
            >
              Bill the job customer
            </button>
          ) : (
            <span />
          )}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              style={{
                padding: '0.45rem 0.9rem',
                fontSize: '0.8125rem',
                background: 'var(--bg-subtle)',
                color: 'var(--text-700)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void save({ name, email, phone })}
              disabled={saving}
              style={{
                padding: '0.45rem 0.9rem',
                fontSize: '0.8125rem',
                fontWeight: 600,
                background: '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: 6,
                cursor: saving ? 'default' : 'pointer',
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
