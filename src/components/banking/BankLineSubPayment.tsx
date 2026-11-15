/**
 * What a bank line on Banking says about subs (punch list #347, the Banking side of the match).
 *
 * A line a sub payment is matched to says who it paid, in green, with **undo** to take it back. A line nothing
 * has taken, with a sub payment of the same amount within three days, gets the picker the Subs Ledger has from
 * its own side: choose the payment and the two are matched and ticked in one press. Nothing is matched by itself.
 */
import { useState } from 'react'
import { bankLinePaidWords, subPaymentPickWords, type BankSideLine } from '../../lib/subWorkOrders/bankLineSubPayments'
import type { SubSendingResult } from '../../types/laborJob'
import { useToastContext } from '../../contexts/ToastContext'
import { todayYmdInAppTz } from '../../utils/dateUtils'

const NOT_ON = 'Matching a payment to the bank is not switched on yet.'

export function BankLineSubPayment({
  txId,
  side,
  onMatch,
  onUndo,
}: {
  txId: string
  side: BankSideLine | undefined
  onMatch: (transactionId: string, paymentId: string) => Promise<SubSendingResult>
  onUndo: (paymentIds: readonly string[]) => Promise<SubSendingResult>
}) {
  const { showToast } = useToastContext()
  const [busy, setBusy] = useState(false)
  if (!side) return null
  const run = async (act: () => Promise<SubSendingResult>) => {
    setBusy(true)
    try {
      const res = await act()
      if (!res.ok) showToast(res.missing ? NOT_ON : res.message, 'error')
    } finally {
      setBusy(false)
    }
  }
  if (side.paid) {
    const paid = side.paid
    return (
      <span data-bank-sub-paid={txId} onClick={(e) => e.stopPropagation()} style={{ display: 'block', marginTop: 2, fontSize: '0.72rem', color: 'var(--text-green-700)', textDecoration: 'none' }}>
        {bankLinePaidWords(paid)}
        {paid.paymentIds.length > 0 ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(() => onUndo(paid.paymentIds))}
            aria-label="Take this bank line off its sub payment"
            title="Take this bank line off its sub payment. The payment's tick on the Subs Ledger is cleared with it."
            style={{ font: 'inherit', fontSize: '0.72rem', padding: 0, marginLeft: 6, border: 'none', background: 'none', color: 'var(--text-link)', cursor: 'pointer' }}
          >
            undo
          </button>
        ) : null}
      </span>
    )
  }
  if (side.offers.length === 0) return null
  const thisYear = todayYmdInAppTz().slice(0, 4)
  return (
    <select
      data-bank-sub-match={txId}
      aria-label="Match this bank line to a sub payment"
      title="A sub payment of this amount was recorded within three days of this line. Choose it to match the two and tick the payment."
      value=""
      disabled={busy}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => {
        const paymentId = e.target.value
        if (paymentId) void run(() => onMatch(txId, paymentId))
      }}
      style={{ font: 'inherit', display: 'block', marginTop: 3, padding: '0.1rem 0.3rem', fontSize: '0.72rem', maxWidth: 240, minWidth: 0, border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-base)' }}
    >
      <option value="">Match to a sub payment…</option>
      {side.offers.map((c) => (
        <option key={c.paymentId} value={c.paymentId}>
          {subPaymentPickWords(c, c.ymd.slice(0, 4) !== thisYear)}
        </option>
      ))}
    </select>
  )
}
