/**
 * The open house's payment windows (SupplyHousesTab map, extraction step 11): Record a payment, a payment's own
 * window, and how a payment was sent.
 *
 * The three mounts moved from `SupplyHousesTab` as they stood. Each window is a child that owns its own work; this
 * file only decides which is open and hands each the open house's bills and payments, and what to read again after.
 * It holds no state: which window is open lives in the payments' engine (`useSupplyHousePayments`).
 */
import { formatErrorMessage } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'
import {
} from '../../lib/materials/supplyHouseInvoiceForm'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { supabaseSupplyFinishIo } from '../../lib/materials/payments/supplyPaymentsFinishIo'
import { SupplyPaymentHowEditor } from './SupplyPaymentHowEditor'
import { supabaseSupplyBankIo } from '../../lib/materials/payments/supplyPaymentBankIo'
import { bankCandidatesFor } from '../../lib/materials/payments/supplyPaymentBank'
import { paymentWindowBills, recordPaymentBills } from '../../lib/materials/supplyHouseBillRows'
import { RecordSupplyPaymentModal } from './RecordSupplyPaymentModal'
import { supabaseSupplyPaymentsIo } from '../../lib/materials/payments/supplyPaymentsIo'
import { lastMethodUsed } from '../../lib/materials/payments/supplyPayment'
import { SupplyPaymentWindow } from './SupplyPaymentWindow'
import type { SupplyHousePayments } from './useSupplyHousePayments'
import type { SupplyHouseAccountsPayable } from './useSupplyHouseAccountsPayable'


export interface SupplyHousePaymentWindowsProps {
  /** The tab's data, whole: the house list, the book and the open house. */
  ap: SupplyHouseAccountsPayable
  /** The payments' engine, whole. */
  payments: SupplyHousePayments
}

export function SupplyHousePaymentWindows({ ap, payments }: SupplyHousePaymentWindowsProps) {
  const { selectedSupplyHouseForDetail, supplyHouseInvoices, supplyHouseJobDetailsMap, housePayments } = ap
  const { recordPaymentOpen, setRecordPaymentOpen, paymentViewId, setPaymentViewId, howEditId, setHowEditId, bankSide, recordStart, setRecordStart, refreshHouseMoney } = payments
  const { showToast } = useToastContext()
  return (
  <>
    {recordPaymentOpen && selectedSupplyHouseForDetail && (
      <RecordSupplyPaymentModal
        house={{
          id: selectedSupplyHouseForDetail.id,
          name: selectedSupplyHouseForDetail.name,
          monthlyPaymentDay: selectedSupplyHouseForDetail.monthly_payment_day ?? null,
        }}
        bills={recordPaymentBills(supplyHouseInvoices, supplyHouseJobDetailsMap)}
        io={supabaseSupplyPaymentsIo}
        todayYmd={todayYmdInAppTz()}
        parts
        start={recordStart ?? undefined}
        onClose={() => {
          setRecordPaymentOpen(false)
          setRecordStart(null)
        }}
        onRecorded={(result, words) => {
          const houseId = selectedSupplyHouseForDetail.id
          const fromBank = recordStart
          setRecordPaymentOpen(false)
          setRecordStart(null)
          showToast(words, 'success')
          // Opened from a bank line: the payment it recorded is the one that line is.
          const matched = fromBank && result.payment_id ? supabaseSupplyBankIo.match(result.payment_id, fromBank.lineId, false).catch((e: unknown) => showToast(formatErrorMessage(e, 'The payment is recorded. It was not matched to its bank line.'), 'error', 6000)) : Promise.resolve()
          void matched.then(() => {
            bankSide.reload()
            return refreshHouseMoney(houseId)
          })
        }}
      />
    )}

    {(() => {
      const viewed = paymentViewId ? housePayments.payments.find((p) => p.id === paymentViewId) : null
      if (!viewed || !selectedSupplyHouseForDetail) return null
      const house = selectedSupplyHouseForDetail
      return (
        <SupplyPaymentWindow
          payment={viewed}
          payments={housePayments.payments}
          lines={housePayments.lines}
          bills={paymentWindowBills(supplyHouseInvoices, supplyHouseJobDetailsMap)}
          events={housePayments.events}
          houseName={house.name.trim() || 'this house'}
          todayYmd={todayYmdInAppTz()}
          onClose={() => setPaymentViewId(null)}
          onRemove={async (payment, reason) => {
            await supabaseSupplyPaymentsIo.remove(payment.id, reason)
            setPaymentViewId(null)
            showToast('The payment is removed. Its bills read unpaid again. It can be put back for 30 days.', 'success')
            await refreshHouseMoney(house.id)
          }}
          onMove={async (input) => {
            await supabaseSupplyPaymentsIo.move(input)
            showToast('The money is moved. Both bills say where it went.', 'success')
            await refreshHouseMoney(house.id)
          }}
          onUndoMove={async (eventId) => {
            await supabaseSupplyPaymentsIo.undoMove(eventId)
            showToast('The move is taken back.', 'success')
            await refreshHouseMoney(house.id)
          }}
          onEditHow={() => setHowEditId(viewed.id)}
          bank={{
            matched: bankSide.lines.find((b) => b.id === bankSide.matchedByPayment.get(viewed.id)) ?? null,
            hasMatch: bankSide.matchedByPayment.has(viewed.id),
            candidates: bankSide.matchedByPayment.has(viewed.id) ? [] : bankCandidatesFor(viewed, house.name, bankSide.lines, bankSide.taken),
            onMatch: async (bankLineId) => {
              await supabaseSupplyBankIo.match(viewed.id, bankLineId, false)
              showToast('The bank agrees with this payment.', 'success')
              bankSide.reload()
            },
            onUnmatch: async () => {
              await supabaseSupplyBankIo.unmatch(viewed.id)
              showToast('The payment is off its bank line.', 'success')
              bankSide.reload()
            },
          }}
        />
      )
    })()}

    {/* How a payment was sent, said after the fact: from a paid row's Finish…, or from the payment's own window. */}
    {(() => {
      const editing = howEditId ? housePayments.payments.find((p) => p.id === howEditId) : null
      if (!editing || !selectedSupplyHouseForDetail) return null
      const house = selectedSupplyHouseForDetail
      const numbers = [...new Set(housePayments.lines.filter((l) => l.payment_id === editing.id).map((l) => supplyHouseInvoices.find((inv) => inv.id === l.invoice_id)?.invoice_number ?? ''))].filter(Boolean)
      return (
        <SupplyPaymentHowEditor
          payment={editing}
          title={[house.name.trim() || 'This house', numbers.length === 1 ? numbers[0] : numbers.length > 1 ? `${numbers.length} bills` : 'on account'].join(' · ')}
          lastMethod={lastMethodUsed(housePayments.payments)}
          onClose={() => setHowEditId(null)}
          onSave={async (paymentId, patch, words) => {
            await supabaseSupplyFinishIo.saveHowSent(paymentId, patch)
            setHowEditId(null)
            showToast(words, 'success')
            await refreshHouseMoney(house.id)
          }}
        />
      )
    })()}
  </>
  )
}
