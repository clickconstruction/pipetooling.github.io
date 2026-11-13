/**
 * "How it was sent" (v2.3717): the one method picker every Record payment door on a pay report
 * shows — the pay-run row's modal, Balances' split modal. Five pills in the kinds' order; the
 * chosen one clears on a second press (a method is welcome, not required). Cash App alone opens
 * the transaction-id box, because it is the only id a person can read off a screen; the other
 * kinds' ids are the app's own rows. The door turns the pick into columns and a memo with
 * `paySourceWrite()`.
 *
 * Since v2.7176 the pills and the box are `PayMethodPicker` (`RecordPaymentPieces.tsx`), which
 * the sub's Record payment window draws too with its own methods; this file is the pay report's
 * kinds on top of it.
 */
import { PAY_SOURCE_KINDS, paySourceLabel, type PaySourceKind } from '../../lib/people/paySources'
import { PayMethodPicker } from './RecordPaymentPieces'

export type PaySourcePickerProps = {
  kind: PaySourceKind | null
  onKind: (kind: PaySourceKind | null) => void
  cashAppId: string
  onCashAppId: (id: string) => void
  disabled?: boolean
  /** Prefix for the element ids (`${idPrefix}-cashapp-id`), so a page with two doors stays unique. */
  idPrefix?: string
}

const OPTIONS: ReadonlyArray<{ key: PaySourceKind; label: string }> = PAY_SOURCE_KINDS.map((key) => ({ key, label: paySourceLabel(key) }))

export function PaySourcePicker({ kind, onKind, cashAppId, onCashAppId, disabled = false, idPrefix = 'pay-source' }: PaySourcePickerProps) {
  return (
    <PayMethodPicker
      options={OPTIONS}
      value={kind}
      onChange={onKind}
      disabled={disabled}
      refValue={cashAppId}
      onRefChange={onCashAppId}
      refBox={
        kind === 'cashapp'
          ? {
              id: `${idPrefix}-cashapp-id`,
              label: 'Cash App transaction id (optional)',
              placeholder: '#D-3V3MVPKVP',
              title: 'Paste the Transaction ID from the activity export or the app — it goes on the payment and into the memo, so the Cash App reconcile matches this payment exactly.',
            }
          : null
      }
    />
  )
}
