import { useState, type CSSProperties } from 'react'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { billDateWords } from '../../lib/materials/supplyBillGroups'
import { paidByBill, paymentView, usd, type PaymentViewBill, type SupplyPayment, type SupplyPaymentLine } from '../../lib/materials/payments/supplyPayment'

/**
 * One payment to a supply house, with every bill it touched (the owner's ask of 2026-11-16). A paid row opens it.
 *
 * A typed payment is money that was sent, so Mark unpaid does not unmake it. A payment recorded by mistake is
 * removed here, whole, after a confirm that says what it does to its bills.
 *
 * It draws only; the host holds the payments and does the removal.
 */

const quiet: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.8125rem', lineHeight: 1.4 }

export function SupplyPaymentWindow({
  payment,
  payments,
  lines,
  bills,
  houseName,
  todayYmd,
  zIndex = 1003,
  onClose,
  onRemove,
}: {
  payment: SupplyPayment
  /** The house's payments and lines the host holds: what else sits on the same bills. */
  payments: ReadonlyArray<SupplyPayment>
  lines: ReadonlyArray<SupplyPaymentLine>
  bills: ReadonlyArray<PaymentViewBill>
  houseName: string
  todayYmd: string
  zIndex?: number
  onClose: () => void
  /** Removes the payment; resolves when it is gone. A refusal throws with its reason. */
  onRemove: (payment: SupplyPayment) => Promise<void>
}) {
  useBodyScrollLock(true)
  const confirm = useConfirmDialog()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const paid = paidByBill(payments, lines)
  const view = paymentView(payment, lines, bills, { house: houseName, dayWords: (ymd) => billDateWords(ymd, todayYmd), paidOnBill: (id) => paid.get(id) ?? 0 })
  const receipt = (payment.receipt_link ?? '').trim()

  async function remove() {
    if (busy) return
    if (!(await confirm(view.removeConfirm))) return
    setBusy(true)
    setError(null)
    try {
      await onRemove(payment)
    } catch (e) {
      setError(formatErrorMessage(e, 'The payment was not removed.'))
      setBusy(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex, paddingTop: 'var(--app-top-chrome, 0px)' }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={view.title}
        data-testid="supply-payment-window"
        style={{ background: 'var(--surface)', padding: '1.25rem', borderRadius: 8, width: 'min(560px, calc(100vw - 1rem))', maxHeight: 'calc(100dvh - var(--app-top-chrome, 0px) - 1rem)', overflowY: 'auto', boxSizing: 'border-box' }}
      >
        <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.2rem' }}>{view.title}</h2>
        <p style={{ ...quiet, margin: '0 0 0.9rem' }} data-testid="supply-payment-window-sub">
          {view.sub}
          {receipt ? (
            <>
              {' · '}
              <a href={receipt} target="_blank" rel="noreferrer" style={{ color: 'var(--text-link)', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                Receipt ›
              </a>
            </>
          ) : null}
        </p>
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: '0.6rem' }}>
          {view.rows.map((r, i) => (
            <div key={r.billId} data-testid="supply-payment-window-line" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '2px 12px', padding: '0.5rem 0.75rem', borderTop: i > 0 ? '1px solid var(--border)' : undefined }}>
              <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-strong)', overflowWrap: 'anywhere' }}>{r.label}</div>
                {r.state ? <div style={quiet}>{r.state}</div> : null}
              </div>
              <div style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: r.amount < 0 ? 'var(--text-green-700)' : 'var(--text-strong)' }}>{usd(r.amount)}</div>
            </div>
          ))}
          {view.onAccount > 0 ? (
            <div data-testid="supply-payment-window-account" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '2px 12px', padding: '0.5rem 0.75rem', borderTop: view.rows.length > 0 ? '1px solid var(--border)' : undefined, background: 'var(--bg-muted)' }}>
              <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-strong)' }}>On account with {houseName}</div>
                <div style={quiet}>not on a bill yet</div>
              </div>
              <div style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{usd(view.onAccount)}</div>
            </div>
          ) : null}
        </div>
        <p style={{ ...quiet, margin: '0 0 0.9rem' }}>{view.foot}</p>
        {error ? (
          <p role="alert" style={{ margin: '0 0 0.75rem', color: 'var(--text-red-700)', fontSize: '0.875rem' }}>
            {error}
          </p>
        ) : null}
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button type="button" disabled={busy} onClick={() => void remove()} style={{ padding: '0.5rem 1rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-red-700)', borderRadius: 4, cursor: busy ? 'not-allowed' : 'pointer' }}>
            {busy ? 'Removing…' : 'Remove this payment…'}
          </button>
          <button type="button" disabled={busy} onClick={onClose} style={{ padding: '0.5rem 1rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 4, cursor: busy ? 'not-allowed' : 'pointer' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
