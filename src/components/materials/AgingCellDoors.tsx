/**
 * The doors out of the aging cell modal (punch list #132 PR 4, v2.6216). Each is a press that
 * opens a window the Supply houses tab already has — the invoice form through the house
 * detail, or the house's Apply Payment — never a form of the modal's own. Which doors a row
 * offers is `agingCellRowDoors` / `agingCellModalDoors` in `lib/supplyHouseAging.ts`; these
 * only draw them. `busy` is the one row or house whose detail is loading, so a second press
 * cannot open two forms.
 */
import type { AgingCellModalDoors, AgingCellRowDoors } from '../../lib/supplyHouseAging'

/** The invoice number as the row's door: press it and the invoice opens in the house's form. */
export function AgingInvoiceDoor({ invoiceNumber, busy, onOpen }: { invoiceNumber: string; busy: boolean; onOpen: () => void }) {
  return (
    <button
      type="button"
      className="aging-win-inv aging-win-inv--door"
      aria-label={`Edit invoice ${invoiceNumber}`}
      title="Open this invoice in its form: the dates, the jobs, the amount, the scan"
      aria-busy={busy || undefined}
      disabled={busy}
      onClick={onOpen}
    >
      {invoiceNumber}
    </button>
  )
}

/** The row's fix-it doors: Add a due date › on a charge with none, Pick a job › on a charge on no job. */
export function AgingRowDoors({ doors, busy, onAddDueDate, onPickJob }: { doors: AgingCellRowDoors; busy: boolean; onAddDueDate: () => void; onPickJob: () => void }) {
  if (!doors.addDueDate && !doors.pickJob) return null
  return (
    <>
      {doors.addDueDate ? (
        <button type="button" className="aging-win-btn" disabled={busy} onClick={onAddDueDate} title="Open the invoice with its Due date field ready to fill. The bill then moves to its aging column.">
          Add a due date ›
        </button>
      ) : null}
      {doors.pickJob ? (
        <button type="button" className="aging-win-btn" disabled={busy} onClick={onPickJob} title="Open the invoice with its job search ready. The form's own job flow checks the PO and the split.">
          Pick a job ›
        </button>
      ) : null}
    </>
  )
}

/** The footer's payment door on a house-scoped modal: the house's own Apply Payment window. */
export function AgingMakePaymentDoor({ doors, busy, onMakePayment }: { doors: AgingCellModalDoors; busy: boolean; onMakePayment: () => void }) {
  if (!doors.makePayment) return null
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onMakePayment}
      title="Open this house's Apply Payment window and tick the bills the payment covers"
      style={{ padding: '0.4rem 0.9rem', fontSize: '0.875rem', background: 'transparent', color: 'var(--text-teal-700)', border: '1px solid var(--text-teal-700)', borderRadius: 4, cursor: busy ? 'default' : 'pointer', font: 'inherit', opacity: busy ? 0.6 : 1 }}
    >
      {busy ? 'Opening…' : 'Make a payment ›'}
    </button>
  )
}
