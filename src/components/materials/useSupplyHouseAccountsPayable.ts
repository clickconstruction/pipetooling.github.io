/**
 * The Supply houses tab's data (SupplyHousesTab map, extraction step 9): the house list, the book, and the open house.
 *
 * Moved from `SupplyHousesTab` as it stood, in the order it was written. One engine for both of the tab's mounts:
 * Materials hands in its house list and its reload, and Quickfill hands in nothing, so the hook loads the houses
 * itself. It reads the book once at mount, opens a house the link names, and hands back the loaders and the setters
 * the tab's windows patch rows through. Every window is a guest of the one open house it holds.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { openSupplyBook, summarizeSupplyHouseBalances } from '../../lib/materials/supplyHousePhone'
import { supabase } from '../../lib/supabase'
import type { Database } from '../../types/database'
import {
  groupAllocationsByInvoice,
  poLedgerCodes,
  poLedgerEntriesFromRows,
  type PoGeneratorLedgerRow,
  type PoLedgerEntriesByCode,
} from '../../lib/materials/supplyHouseInvoiceForm'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { dueGroupKey } from '../../lib/materials/supplyBillGroups'
import { interestByHouse } from '../../lib/materials/payments/supplyInterest'
import { jobsLedgerNames, type JobsLedgerNameRow } from '../../lib/materials/supplyHouseBillRows'
import { supabaseSupplyPaymentsIo, type HousePayments } from '../../lib/materials/payments/supplyPaymentsIo'
import type { SupplyHouse, SupplyHouseInvoice, SupplyHouseInvoiceWithAllocations } from './useSupplyHouseInvoiceForm'

export type InvoiceJobAllocation = { job_id: string; pct: number }
export type MaterialPart = Database['public']['Tables']['material_parts']['Row']
export type PurchaseOrder = Database['public']['Tables']['purchase_orders']['Row']
export type PurchaseOrderItem = Database['public']['Tables']['purchase_order_items']['Row']

export type POItemWithDetails = PurchaseOrderItem & {
  part: MaterialPart
  supply_house?: SupplyHouse
  source_template?: { id: string; name: string } | null
}
export type PurchaseOrderWithItems = PurchaseOrder & { items: POItemWithDetails[] }

export type SupplyHouseSummaryRow = {
  supply_house_id: string
  name: string
  outstanding: number
  monthlyPaymentDay: number | null
  lastInvoiceUpdatedAt: string | null
  lastInvoicePaidAt: string | null
}

/**
 * The aging fetch's rows (v2.5673): enough to draw the matrix AND to list a cell's invoices
 * in the drill-down modal, still one slim select — never the whole table row.
 */
export type AgingInvoiceRow = {
  id: string
  supply_house_id: string
  invoice_number: string
  purchase_order_number: string | null
  invoice_date: string
  amount: number
  /** The bill's own amount, when a payment has taken part of it and `amount` is what is left. */
  billed?: number
  /** Interest or a late fee: it is on no job by rule, so the row offers no Pick a job. */
  is_interest?: boolean | null
  due_date: string | null
  on_job_account: boolean | null
  link: string | null
  credits_invoice_id: string | null
}

/** What the tab lends the data, under the tab's own names. */
export type SupplyHouseAccountsPayableHost = {
  /** Materials' house list and its reload. Both absent in Quickfill, where the hook loads the houses itself. */
  supplyHousesProp?: SupplyHouse[]
  onSupplyHousesChange?: () => void | Promise<void>
  /** The house a link names: opened once the list has it, then reported back. */
  autoOpenHouseId?: string | null
  onAutoOpenHouseHandled?: () => void
  setError: (message: string | null) => void
  /** The open house's papers (bill lines), read beside its bills. */
  loadPapersFor: (invoices: ReadonlyArray<{ id: string }>) => Promise<void>
}

export function useSupplyHouseAccountsPayable(host: SupplyHouseAccountsPayableHost) {
  const { supplyHousesProp, onSupplyHousesChange, autoOpenHouseId, onAutoOpenHouseHandled, setError, loadPapersFor } = host

  const [supplyHousesInternal, setSupplyHousesState] = useState<SupplyHouse[]>(supplyHousesProp ?? [])
  const supplyHousesList = supplyHousesProp ?? supplyHousesInternal

  const [supplyHouseSummary, setSupplyHouseSummary] = useState<SupplyHouseSummaryRow[]>([])
  const [supplyHouseSummaryLoading, setSupplyHouseSummaryLoading] = useState(false)
  const [agingUnpaidInvoices, setAgingUnpaidInvoices] = useState<AgingInvoiceRow[]>([])

  const [agingBookLoaded, setAgingBookLoaded] = useState(false)

  const [selectedSupplyHouseForDetail, setSelectedSupplyHouseForDetail] = useState<SupplyHouse | null>(null)
  const [supplyHouseInvoices, setSupplyHouseInvoices] = useState<SupplyHouseInvoiceWithAllocations[]>([])
  const [supplyHousePOs, setSupplyHousePOs] = useState<PurchaseOrderWithItems[]>([])
  /** Ledger po_code values visible for this supply house (rows for this house + rows with no supply house); null if fetch failed (no warning icons). */
  /** This house's PO Generator rows by code (plus the house-less ones), for the invoice form's PO check and its card (v2.3599). */
  const [poGeneratorEntriesForSelectedHouse, setPoGeneratorEntriesForSelectedHouse] = useState<PoLedgerEntriesByCode | null>(null)
  const poGeneratorCodesForSelectedHouse = useMemo(() => poLedgerCodes(poGeneratorEntriesForSelectedHouse), [poGeneratorEntriesForSelectedHouse])

  /** `&due=<YYYY-MM-DD>` beside `house`: the Bridge's press names the day its bills fall due, and the card lands on that group. */
  const pendingDueRef = useRef<string | null>(typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('due'))
  const [supplyHouseDetailLoading, setSupplyHouseDetailLoading] = useState(false)
  const [supplyHouseJobDetailsMap, setSupplyHouseJobDetailsMap] = useState<Record<string, { hcp_number: string; click_number?: string; job_name: string }>>({})

  const [housePayments, setHousePayments] = useState<HousePayments>({ payments: [], lines: [] })

  /** `Interest and late fees in 2026: $61.20 · …`, under the Accounts payable total; empty in a year with none. */
  const [interestYearWords, setInterestYearWords] = useState('')

  const [paidThisVisit, setPaidThisVisit] = useState<ReadonlySet<string>>(() => new Set())

  async function loadSupplyHousesInternal() {
    const { data, error: err } = await supabase.from('supply_houses').select('*').order('name')
    if (err) {
      const fallback = await supabase.from('supply_houses').select('id, name, phone, address, notes, website_url, created_at, updated_at').order('name')
      if (fallback.error) setError(`Failed to load supply houses: ${err.message}`)
      else setSupplyHousesState((fallback.data ?? []).map((h) => ({ ...h, monthly_payment_day: null })) as SupplyHouse[])
    } else {
      setSupplyHousesState((data as SupplyHouse[]) ?? [])
    }
  }

  async function loadSupplyHouses() {
    if (supplyHousesProp) {
      await onSupplyHousesChange?.()
    } else {
      await loadSupplyHousesInternal()
    }
  }

  async function loadSupplyHouseSummary() {
    setSupplyHouseSummaryLoading(true)
    let housesList: { id: string; name: string; monthly_payment_day: number | null }[]
    const housesRes = await supabase.from('supply_houses').select('id, name, monthly_payment_day').order('name')
    if (housesRes.error) {
      const fallbackRes = await supabase.from('supply_houses').select('id, name').order('name')
      const fallback = (fallbackRes.data ?? []) as { id: string; name: string }[]
      housesList = fallback.map((h) => ({ ...h, monthly_payment_day: null }))
    } else {
      housesList = (housesRes.data ?? []) as { id: string; name: string; monthly_payment_day: number | null }[]
    }
    type SummaryInvoice = AgingInvoiceRow & { is_paid: boolean; updated_at: string | null; paid_at: string | null; amount_paid: number | null; is_interest?: boolean | null }
    const summaryColumns = 'id, supply_house_id, invoice_number, purchase_order_number, invoice_date, amount, amount_paid, is_paid, updated_at, paid_at, due_date, on_job_account, link, credits_invoice_id'
    // is_interest comes with its own migration (20261117020000). Until that is pushed the read is refused for the
    // column, so it is made again without it: the summary must never go empty over a column that only adds a line.
    let invoicesRes = await supabase.from('supply_house_invoices').select(`${summaryColumns}, is_interest` as '*')
    if (invoicesRes.error) invoicesRes = await supabase.from('supply_house_invoices').select(summaryColumns as '*')
    const invoices = (invoicesRes.data ?? []) as unknown as SummaryInvoice[]
    // An unpaid bill counts for what is left on it (v2.7450 amount_paid): a bill paid in part is not owed whole, here
    // or in the aging table. `billed` keeps the bill's own amount for the row that says so.
    const { book: invoicesList, unpaid } = openSupplyBook(invoices)
    // What paying late cost this year, by house: every interest bill billed in it, paid or not.
    setInterestYearWords(interestByHouse(invoices, housesList, todayYmdInAppTz().slice(0, 4)).words)
    setAgingUnpaidInvoices(unpaid)
    setAgingBookLoaded(true)
    // The balance per house is a tested kernel since v2.3888 (it was inline here, untested).
    const rows: SupplyHouseSummaryRow[] = summarizeSupplyHouseBalances(housesList, invoicesList)
    setSupplyHouseSummary(rows)
    setSupplyHouseSummaryLoading(false)
  }

  async function loadSupplyHouseDetail(sh: SupplyHouse): Promise<SupplyHouseInvoiceWithAllocations[]> {
    setSupplyHouseDetailLoading(true)
    setPaidThisVisit(new Set())
    setHousePayments({ payments: [], lines: [] })
    setPoGeneratorEntriesForSelectedHouse(null)
    const shRes = await supabase.from('supply_houses').select('*').eq('id', sh.id).single()
    const shData = shRes.error
      ? (await supabase.from('supply_houses').select('id, name, phone, address, notes, website_url, created_at, updated_at').eq('id', sh.id).single()).data
      : shRes.data
    setSelectedSupplyHouseForDetail((shData as SupplyHouse) ?? sh)
    const [invRes, poRes, allocRes, genRes] = await Promise.all([
      supabase.from('supply_house_invoices').select('*').eq('supply_house_id', sh.id).order('invoice_date', { ascending: false }),
      supabase.from('purchase_orders').select('*').eq('supply_house_id', sh.id).order('created_at', { ascending: false }),
      supabase.from('supply_house_invoice_job_allocations').select('invoice_id, job_id, pct'),
      supabase
        .from('material_po_generator_entries')
        .select(
          `po_code, notes, created_at, job_ledger_id,
          jobs_ledger(hcp_number, click_number, job_name),
          for_user:users!material_po_generator_entries_for_user_id_fkey(name, email),
          created_by_user:users!material_po_generator_entries_created_by_fkey(name, email)`,
        )
        .or(`supply_house_id.eq.${sh.id},supply_house_id.is.null`),
    ])
    const invoices = (invRes.data as SupplyHouseInvoice[]) ?? []
    const allocations = (allocRes.data as { invoice_id: string; job_id: string; pct: number }[]) ?? []
    const byInvoice = groupAllocationsByInvoice(allocations)
    const invoicesWithAllocations: SupplyHouseInvoiceWithAllocations[] = invoices.map((inv) => ({
      ...inv,
      job_allocations: byInvoice[inv.id] ?? [],
    }))
    setSupplyHouseInvoices(invoicesWithAllocations)
    void loadPapersFor(invoicesWithAllocations)
    loadHousePayments(sh.id)
    const jobIds = [...new Set(allocations.map((a) => a.job_id))]
    if (jobIds.length > 0) {
      supabase.rpc('get_jobs_ledger_by_ids', { p_job_ids: jobIds }).then(({ data }) => {
        setSupplyHouseJobDetailsMap(jobsLedgerNames((data ?? []) as JobsLedgerNameRow[]))
      })
    } else {
      setSupplyHouseJobDetailsMap({})
    }
    const pos = (poRes.data as PurchaseOrder[]) ?? []
    const posWithItems: PurchaseOrderWithItems[] = await Promise.all(
      pos.map(async (po) => {
        const { data: itemsData } = await supabase
          .from('purchase_order_items')
          .select('*, material_parts(*), supply_houses(*), source_template:material_templates!source_template_id(id, name)')
          .eq('purchase_order_id', po.id)
          .order('sequence_order', { ascending: true })
        const items = (itemsData as unknown as (PurchaseOrderItem & { material_parts: MaterialPart; supply_houses: SupplyHouse | null; source_template?: { id: string; name: string } | null })[]) ?? []
        const itemsWithDetails: POItemWithDetails[] = items.map((item) => ({
          ...item,
          part: item.material_parts,
          supply_house: item.supply_houses ?? undefined,
          source_template: item.source_template ?? null,
        }))
        return { ...po, items: itemsWithDetails }
      })
    )
    setSupplyHousePOs(posWithItems)
    if (genRes.error) {
      setPoGeneratorEntriesForSelectedHouse(null)
    } else {
      setPoGeneratorEntriesForSelectedHouse(poLedgerEntriesFromRows((genRes.data ?? []) as unknown as PoGeneratorLedgerRow[]))
    }
    setSupplyHouseDetailLoading(false)
    return invoicesWithAllocations
  }

  useEffect(() => {
    loadSupplyHouseSummary()
    if (!supplyHousesProp) loadSupplyHousesInternal()
  }, [])

  useEffect(() => {
    if (supplyHousesProp) setSupplyHousesState(supplyHousesProp)
  }, [supplyHousesProp])

  // Held for suppliers → "Open house": open the requested house's detail once the list has it.
  useEffect(() => {
    if (!autoOpenHouseId) return
    const sh = supplyHousesList.find((s: SupplyHouse) => s.id === autoOpenHouseId)
    if (!sh) return
    // The house's card opens in the list under the aging table, below the fold on most screens. A link that names a
    // house should land on it, so the row is brought up once its card has read.
    const houseId = sh.id
    void loadSupplyHouseDetail(sh).then(() => {
      const due = pendingDueRef.current
      pendingDueRef.current = null
      const target = (): Element | null => (due ? document.querySelector(`[data-due-group="${dueGroupKey(due, todayYmdInAppTz())}"]`) : null) ?? document.querySelector(`[data-supply-house-row="${houseId}"]`)
      requestAnimationFrame(() => target()?.scrollIntoView({ block: 'start', behavior: 'smooth' }))
      // The rows under the card settle a moment after it reads (the bills' line counts arrive), which moves the
      // place. One more look, and a second scroll only when the target has drifted well off the top.
      window.setTimeout(() => {
        const el = target()
        if (el && Math.abs(el.getBoundingClientRect().top) > 160) el.scrollIntoView({ block: 'start', behavior: 'smooth' })
      }, 1200)
    })
    onAutoOpenHouseHandled?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenHouseId, supplyHousesList])

  /** The open house's payments, for what each paid row names. A read that fails leaves the rows as they always read. */
  function loadHousePayments(houseId: string) {
    supabaseSupplyPaymentsIo
      .loadHouse(houseId)
      .then(setHousePayments)
      .catch(() => setHousePayments({ payments: [], lines: [] }))
  }

  return {
    supplyHousesList,
    supplyHouseSummary,
    supplyHouseSummaryLoading,
    agingUnpaidInvoices,
    setAgingUnpaidInvoices,
    agingBookLoaded,
    selectedSupplyHouseForDetail,
    setSelectedSupplyHouseForDetail,
    supplyHouseInvoices,
    setSupplyHouseInvoices,
    supplyHousePOs,
    poGeneratorEntriesForSelectedHouse,
    setPoGeneratorEntriesForSelectedHouse,
    poGeneratorCodesForSelectedHouse,
    supplyHouseDetailLoading,
    supplyHouseJobDetailsMap,
    housePayments,
    setHousePayments,
    interestYearWords,
    paidThisVisit,
    setPaidThisVisit,
    loadSupplyHouses,
    loadSupplyHouseSummary,
    loadSupplyHouseDetail,
    loadHousePayments,
  }
}

/** The tab's data as its windows read it. */
export type SupplyHouseAccountsPayable = ReturnType<typeof useSupplyHouseAccountsPayable>
