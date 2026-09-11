import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { CUSTOMER_PAYMENT_TERMS, parseCustomerTerms, type CustomerPaymentTerms } from '../../lib/customerPaymentTerms'
import { formatKeptRecord, formatUsualSlip, type CustomerPromiseRecord } from '../../lib/jobs/paymentPromises'

/**
 * Payment terms · <customer> ("Their Word" PR 4): four terms, one note, one
 * place to set them. Opens from Customer review's "set terms…" and from the
 * terms bar on New Bid / New Job. Writes the customers columns directly
 * (the table's RLS decides who may); stamps who set them and when.
 */
export default function CustomerTermsModal({
  customerId,
  customerName,
  record,
  onClose,
  onSaved,
}: {
  customerId: string
  customerName: string
  /** The customer's promise record, when the caller has it — shown as context. */
  record?: CustomerPromiseRecord | null
  onClose: () => void
  onSaved: (terms: CustomerPaymentTerms, note: string | null) => void
}) {
  const { user } = useAuth()
  const { showToast } = useToastContext()
  const [terms, setTerms] = useState<CustomerPaymentTerms>('standard')
  const [note, setNote] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const { data } = await supabase.from('customers').select('payment_terms, payment_terms_note' as never).eq('id', customerId).maybeSingle()
        const parsed = parseCustomerTerms((data as Record<string, unknown> | null) ?? null)
        if (!cancelled) {
          setTerms(parsed.terms)
          setNote(parsed.note ?? '')
        }
      } catch {
        // column not there yet — defaults
      } finally {
        if (!cancelled) setLoaded(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [customerId])

  const save = async () => {
    setSaving(true)
    try {
      const payload = {
        payment_terms: terms,
        payment_terms_note: note.trim() || null,
        payment_terms_set_by: user?.id ?? null,
        payment_terms_set_at: new Date().toISOString(),
      }
      const { error } = await supabase.from('customers').update(payload as never).eq('id', customerId)
      if (error) throw error
      showToast('Payment terms saved.', 'success')
      onSaved(terms, note.trim() || null)
      onClose()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not save the terms'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const recordLine = record ? [formatKeptRecord(record), formatUsualSlip(record), record.openBroken > 0 ? `${record.openBroken} open past promise` : null].filter(Boolean).join(' · ') : ''

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Payment terms for ${customerName}`}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', padding: '1.25rem 1.5rem', borderRadius: 8, width: 'min(460px, calc(100vw - 2rem))' }}>
        <h2 style={{ margin: 0, fontSize: '1.05rem' }}>Payment terms · {customerName}</h2>
        <p style={{ margin: '0.35rem 0 0.85rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          {recordLine ? `Their word: ${recordLine}. ` : ''}The choice here shows on New Bid and New Job for this customer.
        </p>
        <div role="radiogroup" aria-label="Payment terms" style={{ display: 'grid', gap: 6 }}>
          {CUSTOMER_PAYMENT_TERMS.map((t) => {
            const on = terms === t.key
            return (
              <button
                key={t.key}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={!loaded}
                onClick={() => setTerms(t.key)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '18px 1fr',
                  gap: 10,
                  alignItems: 'start',
                  textAlign: 'left',
                  padding: '0.5rem 0.7rem',
                  border: `1px solid ${on ? 'var(--text-link)' : 'var(--border)'}`,
                  background: on ? 'var(--bg-blue-tint)' : 'var(--surface)',
                  color: 'var(--text-base)',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                }}
              >
                <span aria-hidden style={{ width: 14, height: 14, marginTop: 3, borderRadius: '50%', border: `1.5px solid ${on ? 'var(--text-link)' : 'var(--border-strong)'}`, background: on ? 'var(--text-link)' : 'transparent', boxShadow: on ? 'inset 0 0 0 3px var(--surface)' : 'none' }} />
                <span>
                  <span style={{ fontWeight: 600 }}>{t.label}</span>
                  <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.hint}</span>
                </span>
              </button>
            )
          })}
        </div>
        <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.75rem 0 4px' }}>
          Note <span style={{ color: 'var(--text-faint)' }}>(shown with the terms)</span>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 200))}
            placeholder="ask Malachi before bidding Ph. 2"
            aria-label="Terms note"
            style={{ width: '100%', marginTop: 4, padding: '0.45rem 0.6rem', fontSize: '0.9rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'inherit' }}
          />
        </label>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
          <button type="button" onClick={onClose} disabled={saving} style={{ padding: '0.4rem 0.75rem', fontSize: '0.8125rem', background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer' }}>
            Cancel
          </button>
          <button type="button" onClick={() => void save()} disabled={saving || !loaded} style={{ padding: '0.4rem 0.85rem', fontSize: '0.8125rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: 6, cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
            {saving ? '…' : 'Save terms'}
          </button>
        </div>
      </div>
    </div>
  )
}
