/**
 * The Supply houses tab's payments, as an engine (SupplyHousesTab map, extraction step 11).
 *
 * The glue around the payment windows, moved from `SupplyHousesTab` as it stood: which window is open (Record a
 * payment, a payment's own window, how it was sent), the finish-later list's door and reload key, the bank side, the
 * bill whose Mark paid is saving, and the two writes that keep the open house's rows where they stand: `toggleInvoicePaid`
 * and `refreshHouseMoney`. The windows themselves are children that own their own work.
 */
import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { supabase } from '../../lib/supabase'
import { formatErrorMessage } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'
import {
} from '../../lib/materials/supplyHouseInvoiceForm'
import { useSupplyHouseBank } from '../../hooks/useSupplyHouseBank'
import { supabaseSupplyBankIo } from '../../lib/materials/payments/supplyPaymentBankIo'
import type { SupplyPayChip } from '../../lib/materials/payments/supplyPayment'
import { supabaseSupplyPaymentsIo, type HousePayments } from '../../lib/materials/payments/supplyPaymentsIo'
import { billPaidBy } from '../../lib/materials/payments/supplyPayment'
import type { SupplyHouse, SupplyHouseInvoice, SupplyHouseInvoiceWithAllocations } from './useSupplyHouseInvoiceForm'


/** What the tab lends the payments, under the tab's own names. */
export type SupplyHousePaymentsHost = {
  supplyHousesList: SupplyHouse[]
  /** The book has read once: the bank side waits for it. */
  agingBookLoaded: boolean
  /** The Needs You line's door: `finish` lands with the finish-later list open. */
  openList?: 'movable' | 'finish' | null
  onOpenListHandled?: () => void
  /** The open house's payments and bills, patched where they stand so the card keeps its place. */
  housePayments: HousePayments
  setHousePayments: Dispatch<SetStateAction<HousePayments>>
  setSupplyHouseInvoices: Dispatch<SetStateAction<SupplyHouseInvoiceWithAllocations[]>>
  setPaidThisVisit: Dispatch<SetStateAction<ReadonlySet<string>>>
  loadSupplyHouseSummary: () => Promise<void>
  loadHousePayments: (houseId: string) => void
}

export function useSupplyHousePayments(host: SupplyHousePaymentsHost) {
  const { supplyHousesList, agingBookLoaded, openList, onOpenListHandled, housePayments, setHousePayments, setSupplyHouseInvoices, setPaidThisVisit, loadSupplyHouseSummary, loadHousePayments } = host
  const { showToast } = useToastContext()

  /** Record a payment (2026-11-16): the window that took Apply Payment's place, and the open house's payments. */
  const [recordPaymentOpen, setRecordPaymentOpen] = useState(false)
  /** The payment a paid row opened, by id. */
  const [paymentViewId, setPaymentViewId] = useState<string | null>(null)
  /** The finish-later list under Accounts payable: opened by the Needs You door, and read again when a payment changes. */
  const [finishListOpen, setFinishListOpen] = useState(false)
  const [finishReloadKey, setFinishReloadKey] = useState(0)
  /** The payment whose "how it was sent" is being edited from its own window or a paid row. */
  const [howEditId, setHowEditId] = useState<string | null>(null)
  /** The removed payment whose Put it back is saving. */
  const [puttingBackPaymentId, setPuttingBackPaymentId] = useState<string | null>(null)
  /** The bank side (v2.7471): the feed's money out, the matches that stand, and the lines to a house nobody recorded. Supply houses only: a line to an insurer or a rental yard is not a bill's payment. */
  const bankHouses = useMemo(() => supplyHousesList.filter((h: SupplyHouse) => (h.vendor_kind ?? 'supply_house') === 'supply_house').map((h: SupplyHouse) => ({ id: h.id, name: h.name })), [supplyHousesList])
  const bankSide = useSupplyHouseBank(agingBookLoaded, supabaseSupplyBankIo, bankHouses)
  /** Record a payment opened from a bank line: what to fill, and the line the recorded payment is matched to. */
  const [recordStart, setRecordStart] = useState<{ lineId: string; amount: number; paidOn: string; chip: SupplyPayChip; words: string } | null>(null)

  /** The bill whose Mark paid is saving, and the bills marked paid on this visit, which stay where they were. */
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null)

  // The other Needs You door (v2.7469): `?list=finish` lands with the finish-later list open.
  useEffect(() => {
    if (openList !== 'finish') return
    setFinishListOpen(true)
    onOpenListHandled?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openList])

  function openRecordPayment() {
    setRecordPaymentOpen(true)
  }

  /**
   * After a payment is recorded, moved, removed or put back: the house's bills and payments are read again where
   * they stand. The card keeps its place and an open payment window stays open, since neither is emptied first.
   */
  async function refreshHouseMoney(houseId: string) {
    const [billsRes, pays] = await Promise.all([
      supabase.from('supply_house_invoices').select('id, is_paid, paid_at').eq('supply_house_id', houseId),
      supabaseSupplyPaymentsIo.loadHouse(houseId).catch(() => null),
    ])
    const now = new Map((billsRes.data ?? []).map((r) => [r.id, r]))
    setSupplyHouseInvoices((list) =>
      list.map((row) => {
        const fresh = now.get(row.id)
        return fresh ? { ...row, is_paid: fresh.is_paid, paid_at: fresh.paid_at } : row
      }),
    )
    if (pays) setHousePayments(pays)
    setFinishReloadKey((k) => k + 1)
    void loadSupplyHouseSummary()
  }

  async function toggleInvoicePaid(inv: SupplyHouseInvoice) {
    // One bill at a time. The row is changed where it stands: reading the whole card again would fold it to
    // "Loading…" and lose the place, which made paying several bills in a row a scroll back each time.
    if (inv.is_paid) {
      // A typed payment is money that was sent, so Mark unpaid does not unmake it: the row opens the payment instead.
      const typed = billPaidBy(inv.id, housePayments.payments, housePayments.lines).typed[0]
      if (typed) {
        setPaymentViewId(typed.payment.id)
        return
      }
    }
    setPayingInvoiceId(inv.id)
    try {
      const { data: saved, error } = await supabase
        .from('supply_house_invoices')
        .update({ is_paid: !inv.is_paid })
        .eq('id', inv.id)
        .select('is_paid, paid_at')
        .single()
      if (error) {
        showToast(`${inv.invoice_number} was not changed. ${formatErrorMessage(error)}`, 'error', 5000)
        return
      }
      const isPaid = saved?.is_paid ?? !inv.is_paid
      setSupplyHouseInvoices((list) => list.map((row) => (row.id === inv.id ? { ...row, is_paid: isPaid, paid_at: saved?.paid_at ?? null } : row)))
      setPaidThisVisit((ids) => {
        const next = new Set(ids)
        if (isPaid) next.add(inv.id)
        else next.delete(inv.id)
        return next
      })
      void loadSupplyHouseSummary()
      loadHousePayments(inv.supply_house_id)
      // Mark paid made a payment with no method: the finish-later list counts it.
      setFinishReloadKey((k) => k + 1)
    } finally {
      setPayingInvoiceId(null)
    }
  }

  return {
    recordPaymentOpen,
    setRecordPaymentOpen,
    paymentViewId,
    setPaymentViewId,
    finishListOpen,
    setFinishListOpen,
    finishReloadKey,
    setFinishReloadKey,
    howEditId,
    setHowEditId,
    puttingBackPaymentId,
    setPuttingBackPaymentId,
    bankHouses,
    bankSide,
    recordStart,
    setRecordStart,
    payingInvoiceId,
    setPayingInvoiceId,
    openRecordPayment,
    refreshHouseMoney,
    toggleInvoicePaid,
  }
}

/** The payments as their windows read them. */
export type SupplyHousePayments = ReturnType<typeof useSupplyHousePayments>
