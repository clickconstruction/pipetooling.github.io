/**
 * The Supply houses tab's Add / Edit invoice form, as an engine (SupplyHousesTab map, extraction step 7).
 *
 * Everything the form owns moved here from `SupplyHousesTab` as it stood, in the order it was written: its fields,
 * the job search and the job-account lookup, the bill reader (the fill from a PDF, the thread's files, a tech's
 * tickets, the switch), and open, close, save and delete. The tab calls the hook above its access gate, hands it
 * the open house and the loaders, and reads the form back under the names it always used, so the form's window
 * draws from the same names.
 *
 * It is a guest of the open house: it never loads the house, its bills or its payments. After a save or a delete it
 * asks the tab to read them again through the loaders it was handed.
 */
import { useEffect, useMemo, useRef, useState, type Dispatch, type FormEvent, type MutableRefObject, type SetStateAction } from 'react'
import { supabase } from '../../lib/supabase'
import { saveSupplyInvoice, supabaseSupplyInvoiceDb, supplyInvoiceDraftFromForm } from '../../lib/materials/supplyInvoiceWrite'
import { useBillReadSwitch } from '../../hooks/useBillReadSwitch'
import { fileHref, fileUrl } from '../../lib/files/fileRoute'
import { emptyFields, noPdfPatch, planBillFill, planIntoForm, settle, type BillFillPlan, type BillFormPatch } from '../../lib/materials/bills/billFill'
import { billRowRead, type BillFieldKey, type BillFields, type BillRead } from '../../lib/materials/bills/billRead'
import { billCountsByHouse, billsForHouse, type BillCandidate } from '../../lib/materials/bills/billsToRecord'
import { fileToUpload, supabaseBillsIo, type BillReadAnswer, type BillsIo } from '../../lib/materials/bills/billsToRecordIo'
import type { PaperIo } from '../../lib/materials/lines/paperIo'
import { paperSaveFromBillRead } from '../../lib/materials/lines/paperRows'
import { linkTicketToInvoice, listAccountTicketsForHouse, type TicketPoFacts } from '../../lib/tickets/ticketMatchIo'
import { ticketPageUrl, type TicketWithPages } from '../../lib/tickets/ticketsIo'
import { formatErrorMessage } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'
import { DEFAULT_JOB_LEDGER_PREFIX, formatJobLedgerNumberLabel } from '../../lib/ledgerDisplayPrefixes'
import { useLedgerPrefixMap } from '../../contexts/LedgerDisplayPrefixContext'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { useJobBidSearchEvidence } from '../../hooks/useJobBidSearchEvidence'
import type { Database } from '../../types/database'
import {
  blankInvoiceForm,
  invoiceFormFromRow,
  creditEffectSentence,
  documentKindFromRow,
  documentWords,
  typedAmountCents,
  type InvoiceFormValues,
  type InvoiceJobAllocation,
  type PoLedgerEntriesByCode,
  type SupplyDocumentKind,
} from '../../lib/materials/supplyHouseInvoiceForm'
import type { JobSupplyHouseAccountRow } from '../../lib/materials/jobSupplyHouseAccounts'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { jobsLedgerNamesWithAddress, type JobsLedgerNameRow } from '../../lib/materials/supplyHouseBillRows'
import type { HousePayments } from '../../lib/materials/payments/supplyPaymentsIo'
import { billPaidBy } from '../../lib/materials/payments/supplyPayment'

export type SupplyHouse = Database['public']['Tables']['supply_houses']['Row']
// is_interest and late_invoice_id come with 20261117020000: the generated Row learns them after its push.
export type SupplyHouseInvoice = Database['public']['Tables']['supply_house_invoices']['Row'] & { is_interest?: boolean | null; late_invoice_id?: string | null }
export type SupplyHouseInvoiceWithAllocations = SupplyHouseInvoice & { job_allocations?: InvoiceJobAllocation[] }
export type SupplyHousesTabRole = 'dev' | 'master_technician' | 'assistant' | 'estimator' | 'primary' | 'superintendent'

/** What the tab lends the form, under the tab's own names. */
export type SupplyHouseInvoiceFormHost = {
  myRole: SupplyHousesTabRole | null
  /** The open house. The form is its guest: it reads the house, its bills, its PO ledger and its payments, and loads none of them. */
  selectedSupplyHouseForDetail: SupplyHouse | null
  supplyHouseInvoices: SupplyHouseInvoiceWithAllocations[]
  poGeneratorEntriesForSelectedHouse: PoLedgerEntriesByCode | null
  housePayments: HousePayments
  /** The houses on the book, for the bills waiting on their threads. */
  supplyHouseSummary: ReadonlyArray<{ supply_house_id: string }>
  supplyHousesList: SupplyHouse[]
  /** The house a link names, and the thread file to open the form on once that house is open. */
  autoOpenHouseId?: string | null
  openBill?: string | null
  onOpenBillHandled?: () => void
  /** The field an aging cell's door asked the form to open on. The door writes it; the form reads it once it is on screen. */
  agingCellFormFocusRef: MutableRefObject<'invoice-due' | 'invoice-job-search' | null>
  paperIo: PaperIo
  loadSupplyHouseDetail: (sh: SupplyHouse) => Promise<SupplyHouseInvoiceWithAllocations[]>
  loadSupplyHouseSummary: () => Promise<void>
  setError: (message: string | null) => void
  /** Bumped after a save, so the Bill lines line reads again. */
  setLinesRefresh: Dispatch<SetStateAction<number>>
  /** The open aging cell window, if any: a save or a delete under it makes it read its jobs again. */
  agingCellModal: unknown
  setAgingCellJobsRefresh: Dispatch<SetStateAction<number>>
}

export function useSupplyHouseInvoiceForm(host: SupplyHouseInvoiceFormHost) {
  const { myRole, selectedSupplyHouseForDetail, supplyHouseInvoices, poGeneratorEntriesForSelectedHouse, housePayments, supplyHouseSummary, supplyHousesList, autoOpenHouseId, openBill, onOpenBillHandled, agingCellFormFocusRef, paperIo, loadSupplyHouseDetail, loadSupplyHouseSummary, setError, setLinesRefresh, agingCellModal, setAgingCellJobsRefresh } = host
  const confirmDialog = useConfirmDialog()
  const { showToast } = useToastContext()

  /**
   * Supply-house bill capture (punch list #179, v2.6095): the fill from a PDF. The Add invoice window stays the one
   * way a bill is recorded; its first question is the bill. The switch gates every door; the candidates are the files
   * on the houses' threads waiting to be recorded (the picker, the rows' counts); a pick reads the file through
   * `bill-read` and fills the fields, each with where its value came from (`billFields`), never over one the person
   * typed (`billTypedRef`); the PDF sits beside the fields; Save keeps the read on the row.
   */
  const billsIo = useMemo<BillsIo>(() => supabaseBillsIo(), [])
  const { on: billFillOn, refresh: refreshBillSwitch } = useBillReadSwitch(myRole)

  const [billCandidates, setBillCandidates] = useState<BillCandidate[]>([])
  const billCounts = useMemo(() => billCountsByHouse(billCandidates), [billCandidates])
  const [billPick, setBillPick] = useState<{ source: 'thread'; attachmentId: string } | { source: 'upload'; name: string } | { source: 'ticket'; ticketId: string } | 'none' | null>(null)
  /** A tech's account tickets at the open house (punch list #295, PR 4): the form's Start from offers them beside the thread's files. */
  const [ticketBills, setTicketBills] = useState<(TicketWithPages & { po: TicketPoFacts })[]>([])
  const billTicketRef = useRef<string | null>(null)
  /** `/materials?tab=supply-houses&house=<id>&ticket=<id>`: the Tickets tab's Record as a bill lands here. */
  const pendingTicketRef = useRef<string | null>(typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('ticket'))

  const [billBusy, setBillBusy] = useState(false)
  const [billRefusal, setBillRefusal] = useState<string | null>(null)
  const [billRead, setBillRead] = useState<{ read: BillRead; file: Extract<BillReadAnswer, { ok: true }>['file']; model: string; readId: string | null; readAt: string } | null>(null)
  const [billPlan, setBillPlan] = useState<BillFillPlan | null>(null)
  const [billFields, setBillFields] = useState<BillFields>(emptyFields())
  const billTypedRef = useRef<Set<BillFieldKey>>(new Set())
  const [billPane, setBillPane] = useState<{ kind: 'pdf'; bytes: ArrayBuffer; href: string } | { kind: 'image'; url: string; href: string } | null>(null)
  const [billDriveInstead, setBillDriveInstead] = useState(false)
  const [billSwitchBusy, setBillSwitchBusy] = useState(false)
  const billFileInputRef = useRef<HTMLInputElement>(null)
  /** The row's id, chosen when the form opens, so a dropped-in file's lasting link can name the row before Save. */
  const billInvoiceIdRef = useRef<string>('')
  /** A bill to open the form on once its house is open: the thread's door, or the row's Record them. */
  const pendingBillRef = useRef<{ houseId: string; attachmentId: string | null } | null>(null)

  const [invoiceFormOpen, setInvoiceFormOpen] = useState(false)
  const [editingInvoice, setEditingInvoice] = useState<SupplyHouseInvoice | null>(null)
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceDate, setInvoiceDate] = useState('')
  const [invoiceDueDate, setInvoiceDueDate] = useState('')
  const [invoiceAmount, setInvoiceAmount] = useState('')
  /** What the paper is (v2.3503). The amount box stays positive; this is what decides the sign. */
  const [invoiceDocumentKind, setInvoiceDocumentKind] = useState<SupplyDocumentKind>('invoice')
  /** v2.5035 · on a credit, the same house's invoice it credits ('' = not paired). */
  const [invoiceCreditsInvoiceId, setInvoiceCreditsInvoiceId] = useState('')
  const [invoicePurchaseOrderNumber, setInvoicePurchaseOrderNumber] = useState('')
  const [invoiceLink, setInvoiceLink] = useState('')
  const [invoiceIsPaid, setInvoiceIsPaid] = useState(false)
  /** "Paid on" calendar day (company tz); '' lets the DB trigger stamp now() when the invoice flips to paid. */
  const [invoicePaidOn, setInvoicePaidOn] = useState('')
  const [invoiceOnJobAccount, setInvoiceOnJobAccount] = useState(false)
  const [invoiceJobAllocations, setInvoiceJobAllocations] = useState<InvoiceJobAllocation[]>([])
  /** Inline job search inside the form (v2.3474) — replaces the stacked "Add job for invoice" modal. */
  const [invoiceJobSearchText, setInvoiceJobSearchText] = useState('')
  const [invoiceJobSearchResults, setInvoiceJobSearchResults] = useState<Array<{ id: string; hcp_number: string; click_number?: string; job_name: string; job_address: string; service_type_id?: string | null; service_type_name?: string | null }>>([])
  const invoiceJobPrefixMap = useLedgerPrefixMap()
  const invoiceJobResultsUnified = useMemo(
    () => invoiceJobSearchResults.map((j) => ({ source: 'job' as const, ...j })),
    [invoiceJobSearchResults],
  )
  const { jobEvidence: invoiceJobEvidence, evidenceMode: invoiceJobEvidenceMode } =
    useJobBidSearchEvidence(invoiceJobResultsUnified)
  /** Job accounts are per property — the flag applies only when the invoice is allocated to exactly one job. */
  const invoiceSingleAllocatedJobId =
    invoiceJobAllocations.length === 1 ? (invoiceJobAllocations[0]?.job_id ?? null) : null
  /**
   * v2.3430: the job's account at THIS house (job_supply_house_accounts), keyed so we
   * fetch once per (job, house). Open → the flag defaults on for a new invoice; else a
   * nudge with Mark opened. Replaces the v2.2669 share-packet cross-check.
   */
  const [invoiceJobAccount, setInvoiceJobAccount] = useState<JobSupplyHouseAccountRow | null>(null)
  const [invoiceJobAccountKey, setInvoiceJobAccountKey] = useState<string | null>(null)
  const [invoiceJobAccountReps, setInvoiceJobAccountReps] = useState<Array<{ id: string; name: string | null; email: string; phone: string | null }>>([])
  const [invoiceMarkOpenedOpen, setInvoiceMarkOpenedOpen] = useState(false)
  /** The user touched the checkbox this session — stop defaulting it. */
  const invoiceOnJobAccountTouchedRef = useRef(false)
  useEffect(() => {
    const houseId = selectedSupplyHouseForDetail?.id ?? null
    if (!invoiceFormOpen || !invoiceSingleAllocatedJobId || !houseId) {
      setInvoiceJobAccount(null)
      setInvoiceJobAccountKey(null)
      return
    }
    const key = `${invoiceSingleAllocatedJobId}:${houseId}`
    if (invoiceJobAccountKey === key) return
    let cancelled = false
    void (async () => {
      const [accRes, repRes] = await Promise.all([
        supabase
          .from('job_supply_house_accounts')
          .select('id, job_id, supply_house_id, status, account_ref, opened_via, rep_contact_id, requested_by, requested_at, requested_from_counter, opened_by, opened_at, note')
          .eq('job_id', invoiceSingleAllocatedJobId)
          .eq('supply_house_id', houseId)
          .maybeSingle(),
        supabase
          .from('supply_house_contacts')
          .select('id, name, email, phone')
          .eq('supply_house_id', houseId)
          .eq('role', 'job_accounts')
          .is('archived_at', null),
      ])
      if (cancelled) return
      const row = accRes.error ? null : ((accRes.data as JobSupplyHouseAccountRow | null) ?? null)
      setInvoiceJobAccount(row)
      setInvoiceJobAccountReps(repRes.error ? [] : ((repRes.data ?? []) as Array<{ id: string; name: string | null; email: string; phone: string | null }>))
      setInvoiceJobAccountKey(key)
      // The default: a new invoice on a job with an open account here is on the account.
      if (!editingInvoice && !invoiceOnJobAccountTouchedRef.current && row?.status === 'open') setInvoiceOnJobAccount(true)
    })()
    return () => {
      cancelled = true
    }
  }, [invoiceFormOpen, invoiceSingleAllocatedJobId, invoiceJobAccountKey, selectedSupplyHouseForDetail?.id, editingInvoice])
  const [invoiceJobDetailsMap, setInvoiceJobDetailsMap] = useState<Record<string, { hcp_number: string; click_number?: string; job_name: string; job_address: string }>>({})

  const [savingInvoice, setSavingInvoice] = useState(false)

  /** The Edit window's "This is interest or a late fee", and the bill that ran late ('' for none). */
  const [invoiceIsInterest, setInvoiceIsInterest] = useState(false)
  const [invoiceLateInvoiceId, setInvoiceLateInvoiceId] = useState('')

  /** The bill in the Edit window is paid by a typed payment: its status follows that payment. */
  const editingTypedPaid = !!editingInvoice?.is_paid && billPaidBy(editingInvoice.id, housePayments.payments, housePayments.lines).typed.length > 0

  // Supply-house bill capture (punch list #179): the bills waiting at the houses on the book, for the rows' counts and
  // the form's picker; read again after a Save or a Not a bill.
  useEffect(() => {
    void reloadBillCandidates()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billFillOn, supplyHouseSummary])

  // A tech's account tickets at the house (punch list #295, PR 4), read as the house opens; a read that fails offers none.
  useEffect(() => {
    const houseId = selectedSupplyHouseForDetail?.id
    if (!billFillOn || !houseId) {
      setTicketBills([])
      return
    }
    let live = true
    void listAccountTicketsForHouse(houseId)
      .then((rows) => {
        if (live) setTicketBills(rows)
      })
      .catch(() => {
        if (live) setTicketBills([])
      })
    return () => {
      live = false
    }
  }, [billFillOn, selectedSupplyHouseForDetail?.id])

  // The Tickets tab's Record as a bill: the house opens through ?house=; the form opens on the ticket once its tickets have read.
  useEffect(() => {
    const ticketId = pendingTicketRef.current
    if (!ticketId || !billFillOn || !selectedSupplyHouseForDetail) return
    const t = ticketBills.find((x) => x.id === ticketId)
    if (!t) return
    pendingTicketRef.current = null
    openAddInvoice()
    setTimeout(() => void pickTicketBill(t), 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketBills, billFillOn, selectedSupplyHouseForDetail])

  // The thread's Record this bill: the house opens through autoOpenHouseId; the form opens on the file once it has.
  useEffect(() => {
    if (!openBill || !autoOpenHouseId) return
    pendingBillRef.current = { houseId: autoOpenHouseId, attachmentId: openBill }
    onOpenBillHandled?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openBill, autoOpenHouseId])

  useEffect(() => {
    const pending = pendingBillRef.current
    if (!pending || !billFillOn || selectedSupplyHouseForDetail?.id !== pending.houseId) return
    const candidate = pending.attachmentId ? billCandidates.find((c) => c.attachmentId === pending.attachmentId) : billsForHouse(billCandidates, pending.houseId)[0]
    if (!candidate) return
    pendingBillRef.current = null
    openAddInvoice()
    // The form's state lands with this render; the pick reads the house alone.
    setTimeout(() => pickThreadBill(candidate), 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSupplyHouseForDetail, billCandidates, billFillOn])

  // PR 4: the field a modal door asked for gets the focus once the form is on screen.
  useEffect(() => {
    const id = agingCellFormFocusRef.current
    if (!invoiceFormOpen || !id) return
    agingCellFormFocusRef.current = null
    const el = document.getElementById(id)
    if (el instanceof HTMLElement) {
      el.focus()
      el.scrollIntoView?.({ block: 'center' })
    }
  }, [invoiceFormOpen, agingCellFormFocusRef])

  useEffect(() => {
    if (!invoiceFormOpen || !invoiceJobSearchText.trim()) {
      setInvoiceJobSearchResults([])
      return
    }
    const t = setTimeout(() => {
      supabase.rpc('search_jobs_ledger', { search_text: invoiceJobSearchText }).then(({ data }) => {
        setInvoiceJobSearchResults((data ?? []) as Array<{ id: string; hcp_number: string; click_number?: string; job_name: string; job_address: string }>)
      })
    }, 300)
    return () => clearTimeout(t)
  }, [invoiceFormOpen, invoiceJobSearchText])

  useEffect(() => {
    const jobIds = invoiceJobAllocations.map((a) => a.job_id).filter((id) => !invoiceJobDetailsMap[id])
    if (jobIds.length === 0) return
    supabase.rpc('get_jobs_ledger_by_ids', { p_job_ids: jobIds }).then(({ data }) => {
      const map = jobsLedgerNamesWithAddress((data ?? []) as JobsLedgerNameRow[])
      setInvoiceJobDetailsMap((prev) => ({ ...prev, ...map }))
    })
  }, [invoiceJobAllocations, invoiceJobDetailsMap])

  // Every label that names the document follows the kind (v2.3503).
  const invoiceWords = documentWords(invoiceDocumentKind)
  const invoiceCreditJobLabel = (() => {
    const only = invoiceJobAllocations.length === 1 ? invoiceJobAllocations[0] : null
    if (!only) return null
    const d = invoiceJobDetailsMap[only.job_id]
    return d ? formatJobLedgerNumberLabel(DEFAULT_JOB_LEDGER_PREFIX, d.hcp_number, d.click_number) : null
  })()
  const creditEffect = creditEffectSentence({
    amountTyped: invoiceAmount,
    houseName: selectedSupplyHouseForDetail?.name ?? '',
    jobLabel: invoiceCreditJobLabel,
  })

  /** The form's fields into its state: a new bill's blanks, or a stored row's. */
  function setInvoiceFormValues(v: InvoiceFormValues) {
    setInvoiceNumber(v.number)
    setInvoiceDate(v.dateYmd)
    setInvoiceDueDate(v.dueDateYmd)
    setInvoiceAmount(v.amountTyped)
    setInvoiceDocumentKind(v.kind)
    setInvoiceIsInterest(v.isInterest)
    setInvoiceLateInvoiceId(v.lateInvoiceId)
    setInvoiceCreditsInvoiceId(v.creditsInvoiceId)
    setInvoiceLink(v.link)
    setInvoiceIsPaid(v.isPaid)
    setInvoicePaidOn(v.paidOnYmd)
    setInvoiceOnJobAccount(v.onJobAccount)
    setInvoicePurchaseOrderNumber(v.purchaseOrderNumber)
    setInvoiceJobAllocations(v.allocations)
  }

  /** What a fill, or No PDF, may write into the form: only the keys the patch carries. */
  function applyBillFormPatch(patch: BillFormPatch) {
    if (patch.kind !== undefined) setInvoiceDocumentKind(patch.kind)
    if (patch.number !== undefined) setInvoiceNumber(patch.number)
    if (patch.dateYmd !== undefined) setInvoiceDate(patch.dateYmd)
    if (patch.amountTyped !== undefined) setInvoiceAmount(patch.amountTyped)
    if (patch.purchaseOrder !== undefined) setInvoicePurchaseOrderNumber(patch.purchaseOrder)
    if (patch.dueYmd !== undefined) setInvoiceDueDate(patch.dueYmd)
    if (patch.creditsInvoiceId !== undefined) setInvoiceCreditsInvoiceId(patch.creditsInvoiceId)
    if (patch.link !== undefined) setInvoiceLink(patch.link)
    if (patch.allocations !== undefined) setInvoiceJobAllocations(patch.allocations)
    if (patch.onJobAccount !== undefined) setInvoiceOnJobAccount(patch.onJobAccount)
  }

  function openAddInvoice() {
    resetBill()
    billInvoiceIdRef.current = crypto.randomUUID()
    invoiceOnJobAccountTouchedRef.current = false
    setInvoiceJobAccountKey(null)
    setEditingInvoice(null)
    // The due day is prefilled from the house's monthly payment day (its next occurrence): editable, just a default.
    setInvoiceFormValues(blankInvoiceForm(selectedSupplyHouseForDetail?.monthly_payment_day, todayYmdInAppTz()))
    setInvoiceJobSearchText('')
    setInvoiceFormOpen(true)
  }

  function openEditInvoice(inv: SupplyHouseInvoice | SupplyHouseInvoiceWithAllocations) {
    invoiceOnJobAccountTouchedRef.current = true
    setInvoiceJobAccountKey(null)
    setEditingInvoice(inv)
    setInvoiceFormValues(invoiceFormFromRow(inv))
    setInvoiceJobSearchText('')
    setInvoiceFormOpen(true)
  }

  function closeInvoiceForm() {
    setInvoiceFormOpen(false)
    setEditingInvoice(null)
    setInvoiceJobSearchText('')
    resetBill()
  }

  // ---------- Supply-house bill capture (punch list #179, v2.6095) ----------

  function resetBill() {
    setBillPick(null)
    setBillBusy(false)
    setBillRefusal(null)
    setBillRead(null)
    setBillPlan(null)
    setBillFields(emptyFields())
    billTypedRef.current = new Set()
    setBillPane(null)
    setBillDriveInstead(false)
  }

  async function reloadBillCandidates() {
    if (!billFillOn) {
      setBillCandidates([])
      return
    }
    const ids = supplyHouseSummary.map((r) => r.supply_house_id)
    setBillCandidates(await billsIo.loadCandidates(ids))
  }

  /** A field the person typed or answered is theirs: the fill never writes over it again, and the count line says so. */
  function markBillTyped(key: BillFieldKey, value: string) {
    if (!billRead) return
    billTypedRef.current.add(key)
    setBillFields((f) => settle(f, key, value))
  }

  /** The plan into the form's state, every field the person typed left as it is. */
  function applyPlanToForm(plan: BillFillPlan): BillFields {
    // The rules (never over a field the person typed, a credit's job from the invoice it credits) are `planIntoForm`.
    const { patch, fields } = planIntoForm(billFields, plan, billTypedRef.current, { driveInstead: billDriveInstead, rows: supplyHouseInvoices })
    // The fill set the job-account flag, so the open-account default may set it again.
    if (patch.onJobAccount !== undefined) invoiceOnJobAccountTouchedRef.current = false
    applyBillFormPatch(patch)
    setBillFields(fields)
    return fields
  }

  /** The fill: the file to the function, the answer planned against what the form holds, the plan into the fields, the paper into the pane. */
  async function fillFromBill(body: Parameters<BillsIo['readBill']>[0]) {
    const house = selectedSupplyHouseForDetail
    if (!house) return
    setBillBusy(true)
    setBillRefusal(null)
    setBillRead(null)
    setBillPlan(null)
    setBillPane(null)
    const answer = await billsIo.readBill(body)
    if (!answer.ok) {
      setBillRefusal(answer.words)
      setBillBusy(false)
      return
    }
    const read = answer.read
    const [accounts, jobs] = await Promise.all([billsIo.loadAccounts(house.id).catch(() => []), billsIo.searchJobs(read.jobText || read.shipTo).catch(() => [])])
    const linkUrl = answer.file.attachmentId ? fileUrl('messages', answer.file.attachmentId) : fileUrl('bills', billInvoiceIdRef.current)
    const plan = planBillFill(read, {
      houseName: house.name,
      paymentDay: house.monthly_payment_day,
      ledger: poGeneratorEntriesForSelectedHouse,
      accounts,
      jobs,
      rows: supplyHouseInvoices,
      todayYmd: todayYmdInAppTz(),
      linkUrl,
      editingId: null,
    })
    setBillRead({ read, file: answer.file, model: answer.model, readId: answer.readId, readAt: new Date().toISOString() })
    setBillPlan(plan)
    applyPlanToForm(plan)
    setBillBusy(false)
    // The paper beside the form: our copy, signed for a minute.
    const url = await billsIo.fileUrl(answer.file.path).catch(() => null)
    if (!url) return
    const href = answer.file.attachmentId ? fileHref('messages', answer.file.attachmentId) : url
    if (/pdf/i.test(answer.file.mime ?? '') || /\.pdf$/i.test(answer.file.name)) {
      try {
        const bytes = await fetch(url).then((r) => r.arrayBuffer())
        setBillPane({ kind: 'pdf', bytes, href })
      } catch {
        setBillPane(null)
      }
    } else setBillPane({ kind: 'image', url, href })
  }

  function pickThreadBill(c: BillCandidate) {
    if (!selectedSupplyHouseForDetail) return
    setBillPick({ source: 'thread', attachmentId: c.attachmentId })
    void fillFromBill({ attachment_id: c.attachmentId, supply_house_id: selectedSupplyHouseForDetail.id })
  }

  async function pickUploadedBill(file: File) {
    if (!selectedSupplyHouseForDetail) return
    setBillPick({ source: 'upload', name: file.name })
    const upload = await fileToUpload(file)
    void fillFromBill({ supply_house_id: selectedSupplyHouseForDetail.id, file: upload })
  }

  /** A tech's ticket (punch list #295, PR 4): its first page, read as a dropped-in file; the ticket takes the bill at Save. */
  async function pickTicketBill(t: TicketWithPages) {
    if (!selectedSupplyHouseForDetail) return
    const page = t.counter_ticket_pages[0]
    if (!page?.storage_path) {
      setError('That ticket has no page to read.')
      return
    }
    setBillPick({ source: 'ticket', ticketId: t.id })
    billTicketRef.current = t.id
    try {
      const url = await ticketPageUrl(page.storage_path)
      if (!url) throw new Error('The ticket’s page did not open.')
      const blob = await (await fetch(url)).blob()
      const ext = page.mime === 'application/pdf' ? 'pdf' : 'jpg'
      const upload = await fileToUpload(new File([blob], `${t.taken_by_name || 'ticket'} ticket.${ext}`, { type: page.mime }))
      void fillFromBill({ supply_house_id: selectedSupplyHouseForDetail.id, file: upload })
    } catch (e) {
      setError(formatErrorMessage(e, 'The ticket’s page did not read.'))
    }
  }

  /** No PDF, I will type it: the fields the fill wrote go back to blank; the ones the person typed stay. */
  function pickNoPdf() {
    applyBillFormPatch(noPdfPatch(billTypedRef.current, { todayYmd: todayYmdInAppTz(), paymentDay: selectedSupplyHouseForDetail?.monthly_payment_day }))
    setBillRead(null)
    setBillPlan(null)
    setBillPane(null)
    setBillRefusal(null)
    setBillFields(emptyFields())
    setBillPick('none')
  }

  /** Yes on the job guess: the job is theirs from then on, and the count falls. */
  function settleJob(jobId: string) {
    billTypedRef.current.add('job')
    setBillFields((f) => settle(f, 'job', jobId))
  }

  /** Pick another job: the guess goes, the search is open. */
  function pickAnotherJob() {
    billTypedRef.current.add('job')
    setInvoiceJobAllocations([])
    setBillFields((f) => settle(f, 'job', ''))
  }

  function settlePair(invoiceId: string) {
    billTypedRef.current.add('creditsInvoice')
    setBillFields((f) => settle(f, 'creditsInvoice', invoiceId))
  }

  /** The house opened and its Add invoice window on a bill: the thread's door and the row's Record them. */
  function openHouseOnBill(houseId: string, attachmentId: string | null) {
    pendingBillRef.current = { houseId, attachmentId }
    const sh = supplyHousesList.find((s: SupplyHouse) => s.id === houseId)
    if (sh) void loadSupplyHouseDetail(sh)
  }

  async function toggleBillSwitch() {
    setBillSwitchBusy(true)
    try {
      await billsIo.setSwitch(!billFillOn)
      const on = await refreshBillSwitch()
      showToast(on ? 'The fill is on. The office can start a bill from its PDF.' : 'The fill is off. Bills are typed from the paper.', 'success')
    } catch (e) {
      showToast(formatErrorMessage(e, 'The switch did not change.'), 'error')
    } finally {
      setBillSwitchBusy(false)
    }
  }

  async function saveInvoice(e: FormEvent) {
    e.preventDefault()
    if (!selectedSupplyHouseForDetail) return
    setSavingInvoice(true)
    setError(null)
    // The one write (punch list #179, v2.6088): the payload rules and the three writes live in supplyInvoiceWrite.ts,
    // so a bill typed here and a bill filled from its PDF save through the same path.
    const form: InvoiceFormValues = {
      number: invoiceNumber,
      dateYmd: invoiceDate,
      dueDateYmd: invoiceDueDate,
      amountTyped: invoiceAmount,
      kind: invoiceDocumentKind,
      isInterest: invoiceIsInterest,
      lateInvoiceId: invoiceLateInvoiceId,
      creditsInvoiceId: invoiceCreditsInvoiceId,
      link: invoiceLink,
      isPaid: invoiceIsPaid,
      paidOnYmd: invoicePaidOn,
      onJobAccount: invoiceOnJobAccount,
      purchaseOrderNumber: invoicePurchaseOrderNumber,
      allocations: invoiceJobAllocations,
    }
    // Supply-house bill capture (punch list #179): the read the row keeps when the bill was filled from its PDF.
    const bill =
      billRead && billPlan
        ? {
            rowRead: billRowRead({ read: billRead.read, model: billRead.model, readAt: billRead.readAt, readId: billRead.readId, file: { path: billRead.file.path, name: billRead.file.name, mime: billRead.file.mime, attachmentId: billRead.file.attachmentId }, fields: billFields, checks: billPlan.checks }),
            attachmentId: billRead.file.attachmentId,
            newRowId: billInvoiceIdRef.current,
          }
        : null
    const saved = await saveSupplyInvoice(supabaseSupplyInvoiceDb, supplyInvoiceDraftFromForm(selectedSupplyHouseForDetail.id, form, bill), editingInvoice)
    if (!saved.ok) {
      setError(saved.problem)
      setSavingInvoice(false)
      return
    }
    if (saved.allocationProblem) setError(saved.allocationProblem)
    if (billRead && billPlan && !editingInvoice) {
      // Supply house bill lines (punch list #298 PR 1b): the paper and its lines, checked against the amount just
      // saved, written beside the row. A refusal here never undoes the save; the row then reads *No lines yet*.
      const out = paperSaveFromBillRead({ read: billRead.read, rowAmountCents: typedAmountCents(invoiceAmount), filePath: billRead.file.path, readId: billRead.readId, readAt: billRead.readAt, model: billRead.model })
      await paperIo.save(saved.id, out.paper, out.lines).catch((e) => showToast(formatErrorMessage(e, 'The bill saved, but its lines were not kept.'), 'error'))
    }
    if (billTicketRef.current) {
      // The ticket became this bill (punch list #295, PR 4): a refusal here never undoes the save.
      const ticketId = billTicketRef.current
      billTicketRef.current = null
      await linkTicketToInvoice(ticketId, saved.id).catch(() => undefined)
      setTicketBills((cur) => cur.filter((t) => t.id !== ticketId))
    }
    if (billRead?.file.attachmentId) {
      // The thread file is on a row now: the offer and the count let it go. A refusal here never undoes the save.
      await billsIo.markRecorded(billRead.file.attachmentId).catch(() => undefined)
      void reloadBillCandidates()
    }
    await loadSupplyHouseDetail(selectedSupplyHouseForDetail)
    setLinesRefresh((k) => k + 1)
    await loadSupplyHouseSummary()
    closeInvoiceForm()
    if (agingCellModal) setAgingCellJobsRefresh((n) => n + 1)
    setSavingInvoice(false)
  }

  async function deleteInvoice(inv: SupplyHouseInvoice) {
    // v2.3506: the confirm names the paper too — a credit memo is never called an invoice on screen.
    const paper = documentKindFromRow(inv) === 'credit' ? 'credit' : 'invoice'
    if (!(await confirmDialog({ message: `Delete this ${paper}?`, confirmLabel: 'Delete', danger: true }))) return
    const { error } = await supabase.from('supply_house_invoices').delete().eq('id', inv.id)
    if (!error && selectedSupplyHouseForDetail) {
      await loadSupplyHouseDetail(selectedSupplyHouseForDetail)
      await loadSupplyHouseSummary()
      closeInvoiceForm()
      if (agingCellModal) setAgingCellJobsRefresh((n) => n + 1)
    }
  }

  return {
    billsIo,
    billFillOn,
    billCandidates,
    billCounts,
    billPick,
    ticketBills,
    billBusy,
    billRefusal,
    billRead,
    billPlan,
    billFields,
    billPane,
    billDriveInstead,
    setBillDriveInstead,
    billSwitchBusy,
    billFileInputRef,
    invoiceFormOpen,
    editingInvoice,
    invoiceNumber,
    setInvoiceNumber,
    invoiceDate,
    setInvoiceDate,
    invoiceDueDate,
    setInvoiceDueDate,
    invoiceAmount,
    setInvoiceAmount,
    invoiceDocumentKind,
    setInvoiceDocumentKind,
    invoiceCreditsInvoiceId,
    setInvoiceCreditsInvoiceId,
    invoicePurchaseOrderNumber,
    setInvoicePurchaseOrderNumber,
    invoiceLink,
    setInvoiceLink,
    invoiceIsPaid,
    setInvoiceIsPaid,
    invoicePaidOn,
    setInvoicePaidOn,
    invoiceOnJobAccount,
    setInvoiceOnJobAccount,
    invoiceJobAllocations,
    setInvoiceJobAllocations,
    invoiceJobSearchText,
    setInvoiceJobSearchText,
    invoiceJobSearchResults,
    invoiceJobPrefixMap,
    invoiceJobEvidence,
    invoiceJobEvidenceMode,
    invoiceSingleAllocatedJobId,
    invoiceJobAccount,
    setInvoiceJobAccount,
    invoiceJobAccountKey,
    invoiceJobAccountReps,
    invoiceMarkOpenedOpen,
    setInvoiceMarkOpenedOpen,
    invoiceOnJobAccountTouchedRef,
    invoiceJobDetailsMap,
    setInvoiceJobDetailsMap,
    savingInvoice,
    invoiceIsInterest,
    setInvoiceIsInterest,
    invoiceLateInvoiceId,
    setInvoiceLateInvoiceId,
    editingTypedPaid,
    invoiceWords,
    creditEffect,
    openAddInvoice,
    openEditInvoice,
    closeInvoiceForm,
    markBillTyped,
    pickThreadBill,
    pickUploadedBill,
    pickTicketBill,
    pickNoPdf,
    settleJob,
    pickAnotherJob,
    settlePair,
    openHouseOnBill,
    toggleBillSwitch,
    saveInvoice,
    deleteInvoice,
  }
}

/** The form as its window reads it: every name the tab's form JSX uses. */
export type SupplyHouseInvoiceForm = ReturnType<typeof useSupplyHouseInvoiceForm>
