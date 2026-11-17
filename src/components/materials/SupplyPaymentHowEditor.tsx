import { useState, type CSSProperties } from 'react'
import { PaidDateField, PayMethodPicker, RecordPaymentFooter } from '../pay/RecordPaymentPieces'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'
import { formatErrorMessage } from '../../utils/errorHandling'
import { SUPPLY_PAY_CHIPS, SUPPLY_PAY_LATER, isSupplyPayMethod, supplyPayMethodRefField, usd, type SupplyPayChip } from '../../lib/materials/payments/supplyPayment'
import { planHowSent } from '../../lib/materials/payments/supplyPaymentsFinish'
import type { HowSentPatch } from '../../lib/materials/payments/supplyPaymentsFinishIo'

/**
 * How a payment was sent, said after the fact (the owner's call 4, 2026-11-16). Mark paid makes a payment with the
 * day and the amount and no method; this is where the method, its number, the day and the receipt link are filled
 * in, from the finish-later list or from a payment's own window. The amount is the payment's and is not changed here.
 */

const quiet: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.8125rem', lineHeight: 1.4 }
const CHIPS = SUPPLY_PAY_CHIPS.filter((c) => c.key !== SUPPLY_PAY_LATER)

export function SupplyPaymentHowEditor({
  payment,
  title,
  lastMethod = null,
  zIndex = 1004,
  onClose,
  onSave,
}: {
  payment: { id: string; amount: number; paid_on: string; method: string | null; method_ref: string | null; receipt_link: string | null }
  /** `Pecan Supply · S4388310`: what the payment paid, as the list names it. */
  title: string
  /** How this house was paid last, to open the chips on when the payment has no method. */
  lastMethod?: string | null
  zIndex?: number
  onClose: () => void
  /** Saves it; resolves when it is stored. A refusal throws with its reason. */
  onSave: (paymentId: string, patch: HowSentPatch, words: string) => Promise<void>
}) {
  useBodyScrollLock(true)
  const start = isSupplyPayMethod(payment.method) ? payment.method : isSupplyPayMethod(lastMethod) ? lastMethod : null
  const [chip, setChip] = useState<SupplyPayChip | null>(start)
  const [ref, setRef] = useState(payment.method_ref ?? '')
  const [paidOn, setPaidOn] = useState(payment.paid_on)
  const [receiptLink, setReceiptLink] = useState(payment.receipt_link ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const plan = planHowSent({ chip, ref, paidOn, receiptLink }, payment)
  const refField = supplyPayMethodRefField(chip)
  const heading = `How ${usd(Number(payment.amount))} was sent`

  async function save() {
    if (!plan.ok || saving) return
    setSaving(true)
    setError(null)
    try {
      await onSave(payment.id, plan.patch, plan.words)
    } catch (e) {
      setError(formatErrorMessage(e, 'It was not saved.'))
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex, paddingTop: 'var(--app-top-chrome, 0px)' }}>
      <div role="dialog" aria-modal="true" aria-label={heading} data-testid="supply-payment-how" style={{ background: 'var(--surface)', padding: '1.25rem', borderRadius: 8, width: 'min(440px, calc(100vw - 1rem))', maxHeight: 'calc(100dvh - var(--app-top-chrome, 0px) - 1rem)', overflowY: 'auto', boxSizing: 'border-box' }}>
        <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.2rem' }}>{heading}</h2>
        <p style={{ ...quiet, margin: '0 0 0.9rem' }}>{title}</p>
        <PayMethodPicker
          options={CHIPS}
          value={chip}
          disabled={saving}
          onChange={setChip}
          refBox={refField ? { id: 'supply-how-ref', label: refField.label, placeholder: refField.placeholder } : null}
          refValue={ref}
          onRefChange={setRef}
        />
        <PaidDateField label="Date sent" value={paidOn} disabled={saving} onChange={setPaidOn} />
        <label style={{ display: 'block', margin: '0 0 0.75rem', fontSize: '0.875rem' }}>
          <span style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 500 }}>Receipt link (optional)</span>
          <input type="text" value={receiptLink} disabled={saving} onChange={(e) => setReceiptLink(e.target.value)} placeholder="Payment or receipt link…" style={{ width: '100%', padding: '0.35rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box' }} />
        </label>
        <p style={{ ...quiet, margin: '0 0 0.9rem', minHeight: '1.2em' }} data-testid="supply-payment-how-why">
          {plan.ok ? 'The amount stays as it is. Its bills read paid on the day you give.' : plan.reason}
        </p>
        {error ? (
          <p role="alert" style={{ margin: '0 0 0.75rem', color: 'var(--text-red-700)', fontSize: '0.875rem' }}>
            {error}
          </p>
        ) : null}
        <RecordPaymentFooter onCancel={onClose} onConfirm={() => void save()} confirmLabel="Save how it was sent" busy={saving} disabled={!plan.ok} />
      </div>
    </div>
  )
}
