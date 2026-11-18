import { useCallback, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useToastContext } from '../contexts/ToastContext'
import { formatErrorMessage } from '../utils/errorHandling'
import SubSheetDrawBillModal from '../components/jobs/SubSheetDrawBillModal'
import { DRAW_BILL_REQUEST_PRESS, DRAW_BILL_SAVE_PRESS, drawBillOptions, drawTieOnArrival, type DrawBillOption } from '../lib/subWorkOrders/drawTie'
import { loadDrawTieSheet, saveDrawBill } from '../lib/subWorkOrders/drawTieIo'

/**
 * What the office answered before a sheet moves to Waiting on customer. `go: false` is Cancel: the sheet
 * does not move. `pick` is there only when the office picked in the window, a bill's id or `null` for No
 * bill; without it the database decides, tying the job's one open bill when it has exactly one.
 */
export type DrawBillAnswer = { go: false } | { go: true; pick?: string | null }

type Pending =
  | { mode: 'arrival'; subName: string; options: DrawBillOption[]; initial: string | null | undefined; resolve: (a: DrawBillAnswer) => void }
  | { mode: 'change'; sheetId: string; subName: string; options: DrawBillOption[]; initial: string | null | undefined; resolve: (saved: boolean) => void }

/**
 * The sheet's tie to one bill, around a stage move (v2.7835, punch list #388, step 1). Every screen that
 * moves a sheet to Waiting on customer asks here first, then ties after its own move:
 *
 *   const drawBill = useDrawBillPick()
 *   const answer = stage === 'customer_pay' ? await drawBill.askOnArrival(sheetId, subName) : { go: true as const }
 *   if (!answer.go) return
 *   …the screen's own set_sub_sheet_stage…
 *   await drawBill.tieAfterMove(sheetId, answer)
 *   …and {drawBill.host} somewhere in what it renders.
 *
 * `change` opens the same window from the sheet's row, to pick, change or clear the tie later.
 */
export function useDrawBillPick(): {
  askOnArrival: (sheetId: string, subName: string) => Promise<DrawBillAnswer>
  tieAfterMove: (sheetId: string, answer: DrawBillAnswer) => Promise<void>
  change: (sheetId: string, subName: string) => Promise<boolean>
  host: ReactNode
} {
  const { showToast } = useToastContext()
  const [pending, setPending] = useState<Pending | null>(null)
  const [busy, setBusy] = useState(false)

  const askOnArrival = useCallback(async (sheetId: string, subName: string): Promise<DrawBillAnswer> => {
    const sheet = await loadDrawTieSheet(supabase, sheetId).catch(() => null)
    // No read (or no column yet), or a sheet already there: nothing to ask, the move goes on as before.
    if (!sheet || sheet.stage === 'customer_pay') return { go: true }
    const arrival = drawTieOnArrival(sheet.bills)
    if (arrival.kind !== 'pick') return { go: true }
    return new Promise<DrawBillAnswer>((resolve) => {
      setPending({ mode: 'arrival', subName, options: drawBillOptions(sheet.bills), initial: arrival.preselect ?? undefined, resolve })
    })
  }, [])

  const tieAfterMove = useCallback(
    async (sheetId: string, answer: DrawBillAnswer): Promise<void> => {
      // No pick, no write: the window never opened, and the database tied what it could.
      if (!answer.go || answer.pick === undefined) return
      try {
        await saveDrawBill(supabase, sheetId, answer.pick)
      } catch (e) {
        showToast(`The draw is requested, but the bill was not tied: ${formatErrorMessage(e)}. Pick it from the sheet’s row.`, 'error')
      }
    },
    [showToast],
  )

  const change = useCallback(
    async (sheetId: string, subName: string): Promise<boolean> => {
      const sheet = await loadDrawTieSheet(supabase, sheetId).catch(() => null)
      if (!sheet) {
        showToast('Could not read this sheet’s bills. Try again in a moment.', 'error')
        return false
      }
      return new Promise<boolean>((resolve) => {
        setPending({ mode: 'change', sheetId, subName, options: drawBillOptions(sheet.bills), initial: sheet.drawInvoiceId ?? undefined, resolve })
      })
    },
    [showToast],
  )

  const cancel = () => {
    if (!pending) return
    if (pending.mode === 'arrival') pending.resolve({ go: false })
    else pending.resolve(false)
    setPending(null)
  }

  const confirm = async (billId: string | null) => {
    if (!pending) return
    if (pending.mode === 'arrival') {
      pending.resolve({ go: true, pick: billId })
      setPending(null)
      return
    }
    setBusy(true)
    try {
      await saveDrawBill(supabase, pending.sheetId, billId)
      showToast(billId ? 'The sheet’s bill is saved.' : 'The sheet rides on no bill now.', 'success')
      pending.resolve(true)
      setPending(null)
    } catch (e) {
      showToast(`Could not save the sheet’s bill: ${formatErrorMessage(e)}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  const host = pending ? (
    <SubSheetDrawBillModal
      subName={pending.subName}
      options={pending.options}
      initial={pending.initial}
      confirmLabel={pending.mode === 'arrival' ? DRAW_BILL_REQUEST_PRESS : DRAW_BILL_SAVE_PRESS}
      busy={busy}
      onCancel={cancel}
      onConfirm={(billId) => void confirm(billId)}
    />
  ) : null

  return { askOnArrival, tieAfterMove, change, host }
}
