import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Database } from '../../types/database'
import type { JobWithDetails } from '../../types/jobWithDetails'
import {
  addBusinessDays,
  buildDemandLetterModel,
  buildDemandLetterPdfBlob,
  buildDemandLetterPrefill,
  buildDemandLetterPrintHtml,
  demandLetterPdfFilename,
  demandDate,
  demandDebtorParty,
  demandMoney,
  statementRows,
  buildDeliveryRecordPdfBlob,
  demandInvoicesPhrase,
  jobHasAnyPayment,
  paymentsAppliedToInvoice,
  type DemandInvoiceSource,
  type DemandLetterFields,
  type DemandPriorNotice,
} from '../../lib/jobsDocuments/demandLetter'
import { customerBillingEmail, effectiveInvoiceParty, type EffectiveBillParty } from '../../lib/jobs/billToParty'
import { fetchJobWithDetailsById } from '../../lib/fetchJobWithDetailsById'
import { buildPhysicalInvoiceDocumentForBilledInvoice } from '../../lib/physicalInvoiceDocumentForBilledInvoice'
import { getAccessTokenForEdgeFunctions } from '../../lib/supabaseAccessTokenForEdge'
import { getBillingStripeModePref, stripeModeInvokeBody } from '../../lib/billingStripeModePref'
import { parseStripeInvoiceDetailsResponse } from '../../lib/stripeInvoiceDetailsResponse'
import { buildDemandLetterPacket, type DemandExhibit, type DemandExhibitInput, type DemandLetterPacket } from '../../lib/jobsDocuments/demandLetterPacket'
import { buildPhysicalInvoicePdfBlob } from '../../lib/physicalInvoicePdf'
import { PhysicalInvoicePreview } from './PhysicalInvoicePreview'
import { JOB_CONTRACT_BUCKET } from '../../lib/jobs/jobContractFileWrite'
import { noticeInvoiceDocs } from '../../lib/jobs/noticeInvoiceEnclosure'
import { liveDemandLetters, type JobDemandLetterRow } from '../../lib/jobs/demandLetterTracking'
import { parsePaymentPromisesRpc } from '../../lib/jobs/paymentPromises'
import { computeJobLienClock, type JobLienFilingRow } from '../../lib/jobs/lienDeadlines'
import { type CustomerAddressRow, type JobPropertyOwnerLike } from '../../lib/jobs/lienProperty'
import LienFilingTabs from './LienFilingTabs'
import { openHtmlPreviewWindow } from '../../lib/jobsDocuments/printWindow'
import { fetchPhysicalInvoiceIssuerFromAppSettings, getPhysicalInvoiceIssuerDraft } from '../../lib/physicalInvoiceIssuer'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'
import { useAuth } from '../../hooks/useAuth'
import { APP_CALENDAR_TZ, todayYmdInAppTz } from '../../utils/dateUtils'

type JobsLedgerInvoice = Database['public']['Tables']['jobs_ledger_invoices']['Row']

/**
 * Lien instruments modal (v2.2640, phase 2 of the Lien Instruments plan): the
 * orange lien icon's new home. Tab 1 is the in-app FINAL DEMAND LETTER —
 * generated from the job's real billing history (dated notice list from
 * invoice sends, Stripe re-sends, and call-mode collection touches), recorded
 * with its tracking number in `job_demand_letters`, and watched after its
 * deadline. The § 53.056 notice and mechanic's-lien tabs land with phase 3;
 * lientooling.com stays one click away via the external prefill fallback.
 * Document content lives in `src/lib/jobsDocuments/demandLetter.ts`.
 */

const SENT_METHODS: Array<{ value: string; label: string }> = [
  { value: 'certified_mail', label: 'Certified mail' },
  { value: 'traceable_courier', label: 'Traceable courier' },
  { value: 'email', label: 'Email' },
  { value: 'hand', label: 'Hand-delivered' },
]

function todayYmdLocal(): string {
  return todayYmdInAppTz()
}

/** A Stripe unix timestamp as a company-calendar day (v2.3445). */
function unixToAppYmd(sec: number | null | undefined): string | null {
  if (!sec || !Number.isFinite(sec)) return null
  return new Intl.DateTimeFormat('en-CA', { timeZone: APP_CALENDAR_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(sec * 1000))
}

/** "Invoice #867-2608180928, as sent August 18, 2026" (v2.3429). */
function exhibitATitle(invoiceNumber: string, sentYmd: string): string {
  return `Invoice ${invoiceNumber}${sentYmd ? `, as sent ${demandDate(sentYmd)}` : ''}`
}

/** Billed lines with money still open — what a demand letter is about. Same payment rule as the letter's claim (v2.3515). */
function demandableInvoices(job: JobWithDetails): JobsLedgerInvoice[] {
  return (job.invoices ?? [])
    .filter((i) => i.status === 'billed' && Number(i.amount ?? 0) - paymentsAppliedToInvoice(job, i.id) > 0.005)
    .slice()
    .sort((a, b) => a.sequence_order - b.sequence_order)
}

export default function LienInstrumentsModal({
  open,
  onClose,
  job,
  invoice,
  signerNameFallback,
  authEmail,
  onOpenExternalPrefill,
  onRecorded,
  initialTab,
  noticeMonths,
}: {
  open: boolean
  onClose: () => void
  job: JobWithDetails | null
  /** Row-level hint: preselect this bill line when demandable. */
  invoice: JobsLedgerInvoice | null
  /** Job master's People "Full name and title" with session-name fallback. */
  signerNameFallback: string
  authEmail: string
  /** Fallback to the external lientooling.com field-review flow (the pre-v2.2640 modal). */
  onOpenExternalPrefill: () => void
  /** Fired after a letter is recorded so openers can refresh badges/watches. */
  onRecorded?: () => void
  /** Land on this tab when the window opens (the forecast's Send notice… door opens on 'notice'). */
  initialTab?: 'demand' | 'notice' | 'affidavit' | 'release_record'
  /** The Lien desk's months for the § 53.056 notice (v2.3405) — recorded as months_covered instead of the last work month alone. */
  noticeMonths?: string[] | null
}) {
  const { role: authRole, user: authUser } = useAuth()
  const { showToast } = useToastContext()
  const [activeTab, setActiveTab] = useState<'demand' | 'notice' | 'affidavit' | 'release_record'>('demand')
  const [filings, setFilings] = useState<JobLienFilingRow[]>([])
  const [linkedAddress, setLinkedAddress] = useState<CustomerAddressRow | null>(null)
  const [jobOwnerRow, setJobOwnerRow] = useState<JobPropertyOwnerLike>(null)
  const [gcEmail, setGcEmail] = useState('')
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<ReadonlySet<string>>(() => new Set())
  const [fields, setFields] = useState<DemandLetterFields | null>(null)
  const [issuerGen, setIssuerGen] = useState(0)
  const [priorNotices, setPriorNotices] = useState<DemandPriorNotice[]>([])
  const [customerAddress, setCustomerAddress] = useState('')
  const [propertyKind, setPropertyKind] = useState('')
  const [historyRows, setHistoryRows] = useState<JobDemandLetterRow[]>([])
  const [voidPendingId, setVoidPendingId] = useState<string | null>(null)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [recordOpen, setRecordOpen] = useState(false)
  const [recordMethod, setRecordMethod] = useState('certified_mail')
  const [recordTracking, setRecordTracking] = useState('')
  const [recordSentOn, setRecordSentOn] = useState(todayYmdLocal())
  const [recordBusy, setRecordBusy] = useState(false)
  // v2.3425 — the letter reads the bill: the full job (fixtures for the
  // invoice document), what Stripe rendered per hosted invoice, the payer rows.
  const [fullJob, setFullJob] = useState<JobWithDetails | null>(null)
  const [stripeByInvoice, setStripeByInvoice] = useState<Record<string, { invoiceNumber: string | null; lines: { description: string; quantity: number | null; amount: number }[]; dueYmd: string | null }>>({})
  const [payerRows, setPayerRows] = useState<Record<string, { name: string; address: string; email: string }>>({})
  const [addressTouched, setAddressTouched] = useState(false)
  // v2.3429 — the exhibits: the signed agreement when the job has one (Exhibit B), and the two switches.
  const [signedAgreement, setSignedAgreement] = useState<{ path: string; title: string } | null>(null)
  const [includeAgreement, setIncludeAgreement] = useState(true)
  const [includeDeliveryRecord, setIncludeDeliveryRecord] = useState(true)
  // v2.3436 — Email with the PDF: a second channel beside certified mail.
  const [emailOpen, setEmailOpen] = useState(false)
  const [emailTo, setEmailTo] = useState('')
  const [emailBusy, setEmailBusy] = useState(false)

  const issuer = useMemo(() => (open ? getPhysicalInvoiceIssuerDraft() : null), [open, issuerGen])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void (async () => {
      await fetchPhysicalInvoiceIssuerFromAppSettings({ authRole })
      if (cancelled) return
      setIssuerGen((g) => g + 1)
    })()
    return () => {
      cancelled = true
    }
  }, [open, authRole])

  const loadHistory = useCallback(async () => {
    if (!job?.id) {
      setHistoryRows([])
      return
    }
    try {
      const { data } = await supabase
        .from('job_demand_letters')
        .select('*')
        .eq('job_id', job.id)
        .order('created_at', { ascending: false })
      setHistoryRows((data ?? []) as JobDemandLetterRow[])
    } catch {
      setHistoryRows([])
    }
  }, [job?.id])

  const loadFilings = useCallback(async () => {
    if (!job?.id) {
      setFilings([])
      return
    }
    try {
      const { data } = await supabase
        .from('job_lien_filings')
        .select('*')
        .eq('job_id', job.id)
        .order('created_at', { ascending: false })
      setFilings((data ?? []) as JobLienFilingRow[])
    } catch {
      setFilings([])
    }
  }, [job?.id])

  // Open-reset + context fetches (history, customer address, property kind).
  useEffect(() => {
    if (!open || !job) {
      setFields(null)
      setHistoryRows([])
      setRecordOpen(false)
      setVoidPendingId(null)
      setPriorNotices([])
      setCustomerAddress('')
      setPropertyKind('')
      return
    }
    const demandable = demandableInvoices(job)
    if (invoice && demandable.some((i) => i.id === invoice.id)) {
      setSelectedInvoiceIds(new Set([invoice.id]))
    } else {
      setSelectedInvoiceIds(new Set(demandable.map((i) => i.id)))
    }
    setActiveTab(initialTab ?? 'demand')
    setRecordMethod('certified_mail')
    setRecordTracking('')
    setRecordSentOn(todayYmdLocal())
    setAddressTouched(false)
    setFullJob(null)
    setStripeByInvoice({})
    setPayerRows({})
    setSignedAgreement(null)
    setIncludeAgreement(true)
    setIncludeDeliveryRecord(true)
    setEmailOpen(false)
    setEmailTo('')
    void loadHistory()
    void loadFilings()
    let cancelled = false
    void (async () => {
      try {
        // The full job: fixtures and materials feed the invoice document the statement reads.
        try {
          const full = await fetchJobWithDetailsById(job.id)
          if (!cancelled && full) setFullJob(full)
        } catch {
          // the board row is enough for a single-line statement
        }
        const payerIds = [job.customer_id, job.gc_customer_id].filter((id): id is string => Boolean(id))
        if (payerIds.length > 0) {
          const { data } = await supabase.from('customers').select('id, name, address, billing_email, contact_info').in('id', payerIds)
          if (!cancelled) {
            const next: Record<string, { name: string; address: string; email: string }> = {}
            for (const r of (data ?? []) as { id: string; name: string | null; address: string | null; billing_email: string | null; contact_info: unknown }[]) {
              next[r.id] = { name: (r.name ?? '').trim(), address: (r.address ?? '').trim(), email: customerBillingEmail(r) }
            }
            setPayerRows(next)
            if (job.customer_id) setCustomerAddress(next[job.customer_id]?.address ?? '')
          }
        }
        // Exhibit B: the job's signed agreement, when one exists as a PDF.
        try {
          const { data: contracts } = await supabase
            .from('job_contracts')
            .select('template_name, signed_at, signed_pdf_path, paper_upload_path, paper_signed_on, status, voided_at')
            .eq('job_id', job.id)
            .is('voided_at', null)
            .order('signed_at', { ascending: false })
          const rows = (contracts ?? []) as { template_name: string | null; signed_at: string | null; signed_pdf_path: string | null; paper_upload_path: string | null; paper_signed_on: string | null; status: string }[]
          const signed = rows.find((r) => (r.signed_pdf_path ?? '').trim()) ?? rows.find((r) => /\.pdf$/i.test((r.paper_upload_path ?? '').trim()))
          if (!cancelled) {
            if (signed) {
              const path = (signed.signed_pdf_path ?? '').trim() || (signed.paper_upload_path ?? '').trim()
              const when = (signed.signed_at ?? '').slice(0, 10) || (signed.paper_signed_on ?? '').slice(0, 10)
              setSignedAgreement({ path, title: `Signed agreement — ${(signed.template_name ?? '').trim() || 'contract'}${when ? `, signed ${demandDate(when)}` : ''}` })
            } else {
              setSignedAgreement(null)
            }
          }
        } catch {
          // no agreement to enclose
        }
        const linkedId = job.customer_address_id ?? null
        if (linkedId) {
          const { data } = await supabase
            .from('customer_addresses')
            .select('*')
            .eq('id', linkedId)
            .maybeSingle()
          if (!cancelled) {
            setLinkedAddress((data as CustomerAddressRow) ?? null)
            setPropertyKind(((data as CustomerAddressRow | null)?.property_kind ?? '').trim())
          }
        } else if (!cancelled) {
          setLinkedAddress(null)
        }
        {
          const { data } = await supabase
            .from('job_property_owners')
            .select('owner_mode, owner_name, company_name, mailing_address, owner_email')
            .eq('job_id', job.id)
            .maybeSingle()
          if (!cancelled) setJobOwnerRow((data as JobPropertyOwnerLike) ?? null)
        }
        if (job.gc_customer_id) {
          const { data } = await supabase
            .from('customers')
            .select('contact_info')
            .eq('id', job.gc_customer_id)
            .maybeSingle()
          if (!cancelled) {
            const ci = (data?.contact_info ?? null) as { email?: unknown } | null
            setGcEmail(typeof ci?.email === 'string' ? ci.email.trim() : '')
          }
        } else if (!cancelled) {
          setGcEmail('')
        }
      } catch {
        // prefill niceties only
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, job?.id, invoice?.id, loadHistory, loadFilings])

  const effJob = fullJob && job && fullJob.id === job.id ? fullJob : job
  const demandable = useMemo(() => (effJob ? demandableInvoices(effJob) : []), [effJob])

  // What Stripe rendered for each hosted bill: the number the customer saw and the lines as they saw them.
  useEffect(() => {
    if (!open || !job) return
    const hosted = demandable.filter((i) => (i.stripe_invoice_id ?? '').trim() && !stripeByInvoice[i.id])
    if (hosted.length === 0) return
    let cancelled = false
    void (async () => {
      const token = await getAccessTokenForEdgeFunctions().catch(() => null)
      if (!token || cancelled) return
      const mode = authRole === 'dev' ? getBillingStripeModePref() : 'live'
      await Promise.all(
        hosted.map(async (inv) => {
          try {
            const { data } = await supabase.functions.invoke('get-stripe-invoice-details', {
              body: { jobs_ledger_invoice_id: inv.id, ...stripeModeInvokeBody(mode) },
              headers: { Authorization: `Bearer ${token}` },
            })
            const parsed = parseStripeInvoiceDetailsResponse(data as Record<string, unknown> | null)
            if (!parsed || cancelled) return
            setStripeByInvoice((prev) => ({ ...prev, [inv.id]: { invoiceNumber: parsed.invoice_number, lines: parsed.lines, dueYmd: unixToAppYmd(parsed.due_date) } }))
          } catch {
            // the statement falls back to the app's own document
          }
        }),
      )
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, job?.id, demandable.map((i) => i.id).join(','), authRole])
  const selectedInvoices = useMemo(
    () => demandable.filter((i) => selectedInvoiceIds.has(i.id)),
    [demandable, selectedInvoiceIds],
  )

  // The dated notice history: invoice sends + Stripe re-sends + collection calls.
  useEffect(() => {
    if (!open || !job || selectedInvoices.length === 0) {
      setPriorNotices([])
      return
    }
    let cancelled = false
    void (async () => {
      const notices: DemandPriorNotice[] = []
      for (const inv of selectedInvoices) {
        const billed = (inv.billed_at ?? inv.created_at ?? '').slice(0, 10)
        if (/^\d{4}-\d{2}-\d{2}$/.test(billed)) notices.push({ date: billed, label: 'Invoice sent' })
        const sentOut = (inv.sent_to_customer_at ?? '').slice(0, 10)
        if (/^\d{4}-\d{2}-\d{2}$/.test(sentOut) && sentOut !== billed)
          notices.push({ date: sentOut, label: 'Invoice delivered to customer' })
      }
      try {
        const { data: resends } = await supabase
          .from('jobs_ledger_invoice_stripe_email_sends')
          .select('jobs_ledger_invoice_id, sent_at')
          .in('jobs_ledger_invoice_id', selectedInvoices.map((i) => i.id))
        for (const r of (resends ?? []) as { sent_at: string }[]) {
          const d = (r.sent_at ?? '').slice(0, 10)
          if (/^\d{4}-\d{2}-\d{2}$/.test(d)) notices.push({ date: d, label: 'Invoice re-sent by email' })
        }
      } catch {
        // fail-soft
      }
      // Their Word PR 4: the customer's own pay-by dates, in their words. A
      // portal self-promise is a date the customer put in writing.
      try {
        const { data: promRaw } = await supabase.rpc('list_job_payment_promises' as never)
        for (const pr of parsePaymentPromisesRpc(promRaw as unknown) ?? []) {
          if (pr.jobId !== job.id) continue
          const d = pr.createdAt.slice(0, 10)
          if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue
          const by =
            pr.source === 'customer'
              ? 'by the customer, in writing, from their statement page'
              : `${pr.saidBy ? `by ${pr.saidBy}` : 'by the customer'}${pr.channel === 'phone' ? ' by phone' : pr.channel === 'text' ? ' by text' : pr.channel === 'email' ? ' by email' : pr.channel === 'in_person' ? ' in person' : ''}${pr.heardByName ? ` to ${pr.heardByName}` : ''}`
          notices.push({ date: d, label: `Payment promised by ${demandDate(pr.promisedYmd)} — ${by}` })
        }
      } catch {
        // fail-soft — not an office role, or the RPC isn't pushed yet
      }
      try {
        const { data: touches } = await supabase
          .from('job_payment_chase_touches')
          .select('created_at, outcome')
          .eq('job_id', job.id)
        for (const t of (touches ?? []) as { created_at: string; outcome: string }[]) {
          const d = (t.created_at ?? '').slice(0, 10)
          if (/^\d{4}-\d{2}-\d{2}$/.test(d))
            notices.push({ date: d, label: `Collection call — ${(t.outcome ?? '').replace(/_/g, ' ') || 'recorded'}` })
        }
      } catch {
        // fail-soft
      }
      if (cancelled) return
      const seen = new Set<string>()
      const deduped = notices
        .filter((n) => {
          const k = `${n.date}|${n.label}`
          if (seen.has(k)) return false
          seen.add(k)
          return true
        })
        .sort((a, b) => a.date.localeCompare(b.date))
      setPriorNotices(deduped)
    })()
    return () => {
      cancelled = true
    }
  }, [open, job?.id, selectedInvoices])

  // Who owes it (v2.3425): the party the bill was addressed to, by the
  // invoice's own who-pays rule — the GC when the bill went to the GC, the
  // customer when it went to the customer, a typed payer when one was typed.
  const partyOf = useCallback(
    (inv: JobsLedgerInvoice): EffectiveBillParty =>
      effJob
        ? effectiveInvoiceParty(
            { gc_customer_id: effJob.gc_customer_id ?? null, customer_id: effJob.customer_id ?? null, bill_to_party: effJob.bill_to_party ?? null },
            { bill_to_email: inv.bill_to_email ?? null, bill_to_party: inv.bill_to_party ?? null },
          )
        : 'customer',
    [effJob],
  )
  const debtorParty: EffectiveBillParty = effJob ? demandDebtorParty(effJob, selectedInvoices) : 'customer'
  const debtor = useMemo(() => {
    if (!effJob) return { name: '', email: '', address: '', label: '' }
    const first = selectedInvoices[0]
    if (debtorParty === 'other' && first) {
      return { name: (first.bill_to_name ?? '').trim() || (first.bill_to_email ?? '').trim(), email: (first.bill_to_email ?? '').trim(), address: '', label: 'the payer typed on the bill' }
    }
    if (debtorParty === 'gc' && effJob.gc_customer_id) {
      const row = payerRows[effJob.gc_customer_id]
      return { name: row?.name || (effJob.gcCustomer?.name ?? '').trim() || 'the GC', email: row?.email ?? gcEmail, address: row?.address ?? '', label: 'the GC on the job' }
    }
    const row = effJob.customer_id ? payerRows[effJob.customer_id] : undefined
    return { name: row?.name || (effJob.customer_name ?? '').trim(), email: row?.email || (effJob.customer_email ?? '').trim(), address: row?.address ?? customerAddress, label: 'the customer on the job' }
  }, [effJob, selectedInvoices, debtorParty, payerRows, gcEmail, customerAddress])

  // The unpaid bills behind the § 53.056 notice (v2.3437) — every one, not just the demand's selection.
  const noticeDocs = useMemo(() => (effJob ? noticeInvoiceDocs(effJob) : []), [effJob])

  const sources = useMemo<DemandInvoiceSource[]>(() => {
    if (!effJob) return []
    return selectedInvoices.map((inv) => {
      let doc = null
      try {
        doc = buildPhysicalInvoiceDocumentForBilledInvoice(effJob, inv)
      } catch {
        doc = null
      }
      return { inv, doc, stripe: stripeByInvoice[inv.id] ?? null }
    })
  }, [effJob, selectedInvoices, stripeByInvoice])

  // Prefill rebuild — keeps user-typed deadline/paymentMethod edits and an address the user corrected.
  useEffect(() => {
    if (!open || !effJob) return
    const recipient = { name: debtor.name, email: debtor.email, address: debtor.address }
    setFields((prev) => {
      const next = buildDemandLetterPrefill({
        job: effJob,
        invoices: selectedInvoices,
        sources,
        issuer,
        senderName: signerNameFallback,
        senderEmailFallback: authEmail,
        recipient,
        priorNotices,
        propertyKind,
        homestead: Boolean(linkedAddress?.homestead),
        todayYmd: todayYmdLocal(),
      })
      // The exhibits the letter names (v2.3429). Page counts arrive when the packet is built.
      const enclosures: DemandExhibit[] = []
      ;(next.statement ?? []).forEach((st, i) => {
        if (sources[i]?.doc) enclosures.push({ label: 'A', title: exhibitATitle(st.invoiceNumber, st.sentYmd), pages: 0 })
      })
      if (signedAgreement && includeAgreement) enclosures.push({ label: 'B', title: signedAgreement.title, pages: 0 })
      if (includeDeliveryRecord) enclosures.push({ label: 'C', title: 'Delivery record', pages: 0 })
      const nextWithExhibits = { ...next, enclosures }
      if (!prev) return nextWithExhibits
      return {
        ...nextWithExhibits,
        recipientAddress: addressTouched && prev.recipientAddress.trim() ? prev.recipientAddress : next.recipientAddress,
        deadlineDate: prev.deadlineDate || next.deadlineDate,
        paymentMethod: prev.paymentMethod,
        includeSmallClaims: prev.includeSmallClaims,
        // A switch keeps the user's setting while its basis is unchanged; when the
        // basis changes (the first bills arrive, the property record loads), the
        // default for the new basis wins (v2.3433).
        includeLien: prev.lienBlockedReason === next.lienBlockedReason ? prev.includeLien && !next.lienBlockedReason : next.includeLien,
        includeTheftOfServices: prev.includeTheftOfServices,
        includeLateFees: prev.interestBasis === next.interestBasis ? prev.includeLateFees : next.includeLateFees,
        includeNotarial: prev.includeNotarial,
      }
    })
  }, [open, effJob, selectedInvoices, sources, debtor, addressTouched, issuer, priorNotices, propertyKind, linkedAddress?.homestead, signerNameFallback, authEmail, signedAgreement, includeAgreement, includeDeliveryRecord])

  // The packet (v2.3429): the letter, then Exhibit A per covered invoice (the
  // invoice as the customer received it), B the signed agreement, C the
  // delivery record — one PDF, every exhibit page stamped. Built twice so the
  // letter's enclosures line can carry the page counts.
  const buildPacket = useCallback(async (): Promise<DemandLetterPacket | null> => {
    if (!fields) return null
    const today = todayYmdLocal()
    const statement = fields.statement ?? []
    const inputs: DemandExhibitInput[] = []
    for (let i = 0; i < sources.length; i++) {
      const doc = sources[i]?.doc
      const st = statement[i]
      if (!doc || !st) continue
      inputs.push({ label: 'A', title: exhibitATitle(st.invoiceNumber, st.sentYmd), blob: await buildPhysicalInvoicePdfBlob(doc) })
    }
    if (signedAgreement && includeAgreement) {
      try {
        const { data } = await supabase.storage.from(JOB_CONTRACT_BUCKET).download(signedAgreement.path)
        if (data) inputs.push({ label: 'B', title: signedAgreement.title, blob: data })
      } catch {
        // the letter still goes without it; the enclosures line follows what was actually merged
      }
    }
    if (includeDeliveryRecord) {
      inputs.push({
        label: 'C',
        title: 'Delivery record',
        blob: await buildDeliveryRecordPdfBlob({ businessName: fields.businessName, invoicesPhrase: demandInvoicesPhrase(statement), recipientName: fields.recipientName, rows: fields.priorNotices, todayYmd: today }),
      })
    }
    const first = await buildDemandLetterPacket(await buildDemandLetterPdfBlob({ ...fields, enclosures: inputs.map((i) => ({ label: i.label, title: i.title, pages: 0 })) }, today), inputs)
    const letter = await buildDemandLetterPdfBlob({ ...fields, enclosures: first.exhibits }, today)
    return buildDemandLetterPacket(letter, inputs)
  }, [fields, sources, signedAgreement, includeAgreement, includeDeliveryRecord])

  // Clamp: § 31.04 can never ride a letter for a job with payments (owner rule). Any payment on
  // the job, not the letter's claim sum — that counts only what its covered bills attribute (v2.3515).
  const jobPaidAnything = effJob ? jobHasAnyPayment(effJob) : false
  useEffect(() => {
    if (!fields) return
    if (jobPaidAnything && fields.includeTheftOfServices) {
      setFields((prev) => (prev ? { ...prev, includeTheftOfServices: false } : prev))
    }
  }, [fields, jobPaidAnything])

  const jobNumber = job ? effectiveJobLedgerNumber(job.hcp_number, job.click_number) || '—' : '—'
  const isSub = Boolean(job?.gc_customer_id)
  const clock = useMemo(
    () => computeJobLienClock({ lastWorkYmd: job?.last_work_date ?? null, propertyKind, isSub }),
    [job?.last_work_date, propertyKind, isSub],
  )
  const originalContractorName = isSub
    ? (job?.gcCustomer?.name ?? '').trim() || (job?.customer_name ?? '').trim()
    : (issuer?.companyName ?? '').trim() || 'Click Plumbing and Electrical'
  const hasFiledAffidavit = filings.some((f) => f.voided_at == null && f.kind === 'affidavit' && f.filed_at)

  const setField = <K extends keyof DemandLetterFields>(key: K, value: DemandLetterFields[K]) => {
    setFields((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  // Print opens the packet PDF (letter + exhibits) in a new tab — one print, every page.
  const printLetter = useCallback(async () => {
    if (!fields || pdfBusy) return
    setPdfBusy(true)
    try {
      const packet = await buildPacket()
      if (!packet) return
      const url = URL.createObjectURL(packet.blob)
      const win = window.open(url, '_blank', 'noopener')
      if (!win) showToast('Popup blocked — allow popups to print.', 'error')
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch {
      showToast('Could not build the packet.', 'error')
    } finally {
      setPdfBusy(false)
    }
  }, [fields, pdfBusy, buildPacket, showToast])

  const downloadPdf = useCallback(async () => {
    if (!fields || pdfBusy) return
    setPdfBusy(true)
    try {
      const packet = await buildPacket()
      if (!packet) return
      const blob = packet.blob
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = demandLetterPdfFilename(jobNumber)
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      showToast('Could not build the PDF.', 'error')
    } finally {
      setPdfBusy(false)
    }
  }, [fields, jobNumber, pdfBusy, buildPacket, showToast])

  const recordSend = useCallback(async (channel?: { method: string; tracking: string; sentOn: string; exhibits: DemandExhibit[] }) => {
    if (!fields || !job || recordBusy) return
    setRecordBusy(true)
    try {
      const amountNum = Number((fields.outstanding ?? '').replace(/[$,\s]/g, ''))
      // The exhibits with their page counts, as they went out (v2.3429).
      let exhibits: DemandExhibit[] = channel?.exhibits ?? fields.enclosures ?? []
      if (!channel) {
        try {
          const packet = await buildPacket()
          if (packet) exhibits = packet.exhibits
        } catch {
          // record what the letter named
        }
      }
      const fieldsSnapshot = JSON.parse(JSON.stringify({ ...fields, enclosures: exhibits })) as { [key: string]: never }
      const base = {
        job_id: job.id,
        invoice_ids: [...selectedInvoiceIds],
        amount: Number.isFinite(amountNum) ? Math.max(0, Math.round(amountNum * 100) / 100) : 0,
        deadline_date: fields.deadlineDate || null,
        fields: fieldsSnapshot,
        recipient_name: fields.recipientName.trim(),
        recipient_email: fields.recipientEmail.trim(),
        recipient_address: fields.recipientAddress.trim(),
        sent_method: channel?.method ?? recordMethod,
        tracking_number: (channel?.tracking ?? recordTracking).trim(),
        sent_at: (channel?.sentOn ?? recordSentOn) || null,
        created_by: authUser?.id ?? null,
      }
      const withExhibits = { ...base, exhibits: exhibits as unknown as never, debtor_party: (fields.debtorParty ?? '') as never }
      try {
        await withSupabaseRetry<{ id: string }>(
          () => supabase.from('job_demand_letters').insert(withExhibits).select('id').single(),
          'record demand letter send',
        )
      } catch (e) {
        // The v2.3429 columns are pushed right after the client deploys; until then, the old shape.
        const msg = e instanceof Error ? e.message : String(e)
        if (!/exhibits|debtor_party/.test(msg)) throw e
        await withSupabaseRetry<{ id: string }>(
          () => supabase.from('job_demand_letters').insert(base).select('id').single(),
          'record demand letter send',
        )
      }
      showToast(channel ? 'Demand letter emailed and recorded — the deadline watch is armed.' : 'Demand letter recorded — the deadline watch is armed.', 'success')
      setRecordOpen(false)
      setEmailOpen(false)
      void loadHistory()
      onRecorded?.()
    } catch {
      showToast('Could not record the send.', 'error')
    } finally {
      setRecordBusy(false)
    }
  }, [fields, job, selectedInvoiceIds, recordMethod, recordTracking, recordSentOn, authUser?.id, recordBusy, buildPacket, showToast, loadHistory, onRecorded])

  // Email with the PDF (v2.3436): the packet goes through the notice's edge
  // function as one attachment; the Resend id becomes the tracking string
  // and the send is recorded as method `email`. Certified mail stays the
  // default — this is the second channel, never the only one for a letter
  // that has to be proven.
  const emailPacket = useCallback(async () => {
    if (!fields || !job || emailBusy) return
    const to = emailTo.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      showToast('Enter a valid email address.', 'error')
      return
    }
    setEmailBusy(true)
    try {
      const packet = await buildPacket()
      if (!packet) return
      const buf = new Uint8Array(await packet.blob.arrayBuffer())
      let binary = ''
      for (let i = 0; i < buf.length; i += 0x8000) binary += String.fromCharCode(...buf.subarray(i, i + 0x8000))
      const statement = fields.statement ?? []
      const { data, error } = await supabase.functions.invoke('send-lien-filing-email', {
        body: {
          job_id: job.id,
          to_email: to,
          recipient_label: fields.recipientName.trim(),
          email_type: 'demand_letter',
          subject: `Final demand for payment — ${demandInvoicesPhrase(statement)} · ${demandMoney(fields.outstanding)}`,
          email_text: `${fields.recipientName.trim() || 'To whom it may concern'},\n\nAttached is ${fields.businessName.trim() || 'our'} final demand for payment of ${demandMoney(fields.outstanding)} on ${demandInvoicesPhrase(statement)}, with the invoice and its exhibits, as one PDF. Payment is due by ${demandDate(fields.deadlineDate)}.\n\n${fields.senderName.trim()}\n${fields.businessName.trim()}${fields.businessPhone.trim() ? ` · ${fields.businessPhone.trim()}` : ''}`,
          pdf_base64: btoa(binary),
          pdf_filename: demandLetterPdfFilename(jobNumber),
        },
      })
      const err = error ?? ((data as { error?: string } | null)?.error ? new Error((data as { error?: string }).error) : null)
      if (err) throw err
      const resendId = ((data as { resend_email_id?: string | null } | null)?.resend_email_id ?? '').trim()
      await recordSend({ method: 'email', tracking: `${resendId ? `resend:${resendId}` : 'emailed'} → ${to}`, sentOn: todayYmdLocal(), exhibits: packet.exhibits })
    } catch (e) {
      showToast(e instanceof Error && e.message ? `Could not email the letter: ${e.message}` : 'Could not email the letter.', 'error')
    } finally {
      setEmailBusy(false)
    }
  }, [fields, job, emailBusy, emailTo, buildPacket, jobNumber, recordSend, showToast])

  const viewHistoryLetter = useCallback(
    (r: JobDemandLetterRow) => {
      const snap = r.fields as unknown as DemandLetterFields | null
      if (!snap || typeof snap !== 'object' || !('outstanding' in snap)) {
        showToast('This record has no stored letter snapshot.', 'error')
        return
      }
      const ok = openHtmlPreviewWindow(buildDemandLetterPrintHtml(snap, (r.sent_at ?? r.created_at).slice(0, 10), jobNumber))
      if (!ok) showToast('Popup blocked — allow popups to view the letter.', 'error')
    },
    [jobNumber, showToast],
  )

  const voidHistoryLetter = useCallback(
    async (r: JobDemandLetterRow) => {
      try {
        await withSupabaseRetry(
          () => supabase.from('job_demand_letters').update({ voided_at: new Date().toISOString() }).eq('id', r.id),
          'void demand letter',
        )
        showToast('Demand letter voided.', 'success')
        setVoidPendingId(null)
        void loadHistory()
        onRecorded?.()
      } catch {
        showToast('Could not void the letter.', 'error')
      }
    },
    [showToast, loadHistory, onRecorded],
  )

  if (!open || !job || !fields) return null

  const liveHistory = liveDemandLetters(historyRows)
  const model = buildDemandLetterModel(fields, todayYmdLocal())
  const toggle = (key: keyof DemandLetterFields, label: string, extra?: string) => (
    <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8125rem', marginBottom: '0.3rem', cursor: 'pointer' }}>
      <input type="checkbox" checked={Boolean(fields[key])} onChange={(e) => setField(key, e.target.checked as never)} />
      {label}
      {extra ? <span style={{ color: 'var(--text-amber-700)', fontSize: '0.6875rem', fontWeight: 700 }}>{extra}</span> : null}
    </label>
  )

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="lien-instruments-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1100,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'calc(1rem + env(safe-area-inset-top, 0px)) 1rem calc(1rem + env(safe-area-inset-bottom, 0px))',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          maxWidth: 920,
          width: '100%',
          maxHeight: 'min(92vh, 100%)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
          <h2 id="lien-instruments-title" style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600 }}>
            Lien instruments
          </h2>
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            {(job.job_name ?? '').trim() || 'Job'} · {jobNumber} · {demandMoney(fields.outstanding)} open
            {clock.workMonth ? (
              <span style={{ marginLeft: '0.6rem', fontWeight: 700 }}>
                {clock.noticeDeadline ? (
                  <span style={{ color: 'var(--text-amber-700)' }}>⏱ Notice by {demandDate(clock.noticeDeadline)}</span>
                ) : null}
                <span style={{ color: 'var(--text-red-700)', marginLeft: clock.noticeDeadline ? '0.6rem' : 0 }}>
                  File by {demandDate(clock.filingDeadline)}
                </span>
              </span>
            ) : null}
          </p>
        </div>

        <div style={{ padding: '0.7rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
          {(
            [
              ['demand', 'Demand letter'],
              ['notice', '§ 53.056 notice'],
              ['affidavit', "Mechanic's lien"],
              ...(hasFiledAffidavit ? ([['release_record', 'Release of record']] as const) : []),
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setActiveTab(value)}
              style={{
                padding: '0.4rem 0.75rem',
                fontSize: '0.8125rem',
                borderRadius: 6,
                border: activeTab === value ? '2px solid #2563eb' : '1px solid var(--border-strong)',
                background: activeTab === value ? 'var(--bg-blue-tint)' : 'var(--surface)',
                cursor: 'pointer',
                fontWeight: activeTab === value ? 600 : 400,
              }}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={onOpenExternalPrefill}
            style={{ marginLeft: 'auto', padding: '0.4rem 0.75rem', fontSize: '0.8125rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            lientooling.com ↗
          </button>
        </div>

        {activeTab === 'demand' ? (
          <>
        <div style={{ display: 'flex', flexWrap: 'wrap', overflowY: 'auto', flex: 1 }}>
          <div style={{ flex: '1 1 20rem', minWidth: '18rem', padding: '1rem 1.25rem' }}>
            {liveHistory.length > 0 && (
              <div style={{ marginBottom: '0.9rem', padding: '0.5rem 0.6rem', borderRadius: 8, background: 'var(--bg-amber-tint)', border: '1px solid var(--border-strong)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.35rem' }}>Sent on this job</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  {liveHistory.map((r) => (
                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '0.3rem 0.45rem', fontSize: '0.72rem' }}>
                      <span style={{ fontWeight: 700, color: 'var(--text-amber-700)' }}>Demand · {demandMoney(String(r.amount ?? ''))}</span>
                      <span style={{ color: 'var(--text-muted)' }}>
                        {r.sent_method ? r.sent_method.replace(/_/g, ' ') : 'unsent'}
                        {r.tracking_number ? ` ${r.tracking_number.slice(0, 10)}…` : ''}
                        {r.sent_at ? ` · sent ${demandDate(r.sent_at)}` : ''}
                        {r.deadline_date ? ` · deadline ${demandDate(r.deadline_date)}` : ''}
                      </span>
                      <span style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
                        <button type="button" onClick={() => viewHistoryLetter(r)} style={{ background: 'none', border: 'none', color: 'var(--text-link)', fontWeight: 600, cursor: 'pointer', padding: 0, fontSize: '0.72rem' }}>
                          View
                        </button>
                        {voidPendingId === r.id ? (
                          <button type="button" onClick={() => void voidHistoryLetter(r)} style={{ background: 'none', border: 'none', color: 'var(--text-red-700)', fontWeight: 700, cursor: 'pointer', padding: 0, fontSize: '0.72rem' }}>
                            Confirm void
                          </button>
                        ) : (
                          <button type="button" onClick={() => setVoidPendingId(r.id)} title="Void this record (withdrawn letter / recorded in error)" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, fontSize: '0.72rem' }}>
                            Void
                          </button>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {demandable.length > 0 ? (
              <div style={{ marginBottom: '0.9rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Demand covers bill(s)</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {demandable.map((i) => {
                    const on = selectedInvoiceIds.has(i.id)
                    const party = partyOf(i)
                    const samePayer = selectedInvoices.length === 0 || party === debtorParty
                    const num = stripeByInvoice[i.id]?.invoiceNumber ? `#${(stripeByInvoice[i.id]?.invoiceNumber ?? '').replace(/^#/, '')}` : `#${i.sequence_order}`
                    return (
                      <button
                        key={i.id}
                        type="button"
                        title={samePayer ? undefined : 'Billed to a different payer — one letter per payer; picking it starts a letter for that payer'}
                        onClick={() =>
                          setSelectedInvoiceIds((prev) => {
                            if (!samePayer) return new Set([i.id])
                            const next = new Set(prev)
                            if (next.has(i.id)) next.delete(i.id)
                            else next.add(i.id)
                            return next
                          })
                        }
                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.8125rem', borderRadius: 6, border: on ? '2px solid #16a34a' : '1px solid var(--border-strong)', background: on ? 'var(--bg-green-tint)' : 'var(--surface)', cursor: 'pointer', fontWeight: on ? 600 : 400, opacity: samePayer ? 1 : 0.6 }}
                      >
                        {num} · ${Number(i.amount ?? 0).toLocaleString('en-US')}
                        {party !== debtorParty || demandable.some((d) => partyOf(d) !== party) ? <span style={{ marginLeft: '0.35rem', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>· {party === 'gc' ? 'GC' : party === 'other' ? 'other payer' : 'customer'}</span> : null}
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : (
              <p style={{ margin: '0 0 0.9rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                No billed lines with an open balance — a demand letter needs billed, unpaid work.
              </p>
            )}

            {/* Who owes it (v2.3425): read from the bill, never typed — the demand goes where the bill went. */}
            <div style={{ marginBottom: '0.65rem', fontSize: '0.875rem' }} data-demand-debtor>
              <span style={{ display: 'block', fontWeight: 500, marginBottom: '0.2rem' }}>
                Who owes it{' '}
                <span style={{ display: 'inline-block', marginLeft: '0.3rem', padding: '0.05rem 0.45rem', borderRadius: 999, fontSize: '0.6875rem', fontWeight: 700, background: 'var(--bg-blue-tint)', color: 'var(--text-link)' }}>from the bill</span>
              </span>
              <div style={{ padding: '0.45rem 0.5rem', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-subtle)' }}>
                <div style={{ fontWeight: 600 }}>
                  {fields.recipientName.trim() || '—'}
                  <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}> · {debtor.label}</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {fields.recipientEmail.trim() || 'no email on file'}
                  {!fields.recipientAddress.trim() ? (
                    <span style={{ marginLeft: '0.4rem', padding: '0.05rem 0.45rem', borderRadius: 999, fontSize: '0.6875rem', fontWeight: 700, background: 'var(--bg-red-tint)', color: 'var(--text-red-700)' }}>needs a mailing address</span>
                  ) : null}
                </div>
              </div>
              {debtorParty === 'gc' && (effJob?.customer_id ?? '') ? (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                  The bill was addressed to the GC, so the demand goes there too. The property owner gets the{' '}
                  <button type="button" onClick={() => setActiveTab('notice')} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--text-link)', fontWeight: 600, cursor: 'pointer', fontSize: '0.75rem' }}>
                    § 53.056 notice
                  </button>{' '}
                  instead — that is the paper the statute sends an owner.
                </div>
              ) : null}
            </div>
            <label style={{ display: 'block', marginBottom: '0.65rem', fontSize: '0.875rem' }}>
              <span style={{ display: 'block', fontWeight: 500, marginBottom: '0.2rem' }}>Mailing address</span>
              <input
                type="text"
                value={fields.recipientAddress}
                onChange={(e) => {
                  setAddressTouched(true)
                  setField('recipientAddress', e.target.value)
                }}
                placeholder="Where the letter is mailed — from the payer's record when one is on file"
                style={{ width: '100%', boxSizing: 'border-box', padding: '0.45rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem' }}
              />
            </label>

            {/* The statement of account (v2.3425): the bill as sent, read-only. A wrong line is fixed on the bill, and the letter follows. */}
            {(fields.statement ?? []).length > 0 ? (
              <div style={{ marginBottom: '0.65rem', fontSize: '0.875rem' }} data-demand-statement>
                <span style={{ display: 'block', fontWeight: 500, marginBottom: '0.2rem' }}>
                  What the letter claims <span style={{ fontWeight: 400, fontSize: '0.75rem', color: 'var(--text-muted)' }}>· the bill as sent, read-only</span>
                </span>
                <div style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden', fontSize: '0.78rem' }}>
                  {statementRows({ invoices: fields.statement ?? [], balance: fields.outstanding }).map((r, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: '0.6rem',
                        padding: r.kind === 'invoice' ? '0.4rem 0.55rem 0.25rem' : '0.25rem 0.55rem',
                        paddingLeft: r.kind === 'invoice' ? '0.55rem' : '1rem',
                        borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                        background: r.kind === 'invoice' || r.kind === 'total' ? 'var(--bg-subtle)' : 'var(--surface)',
                        fontWeight: r.kind === 'invoice' || r.kind === 'total' || (r.kind === 'balance' && (fields.statement ?? []).length === 1) ? 700 : 400,
                        color: r.kind === 'paid' ? 'var(--text-muted)' : 'var(--text-base)',
                      }}
                    >
                      <span>{r.left}</span>
                      <span style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{r.right}</span>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Something wrong here? Fix it on the bill — the letter re-reads it, so the two never disagree.
                </div>
              </div>
            ) : null}
            {/* Enclosed (v2.3429): the invoice always, the agreement and the delivery record by switch. */}
            <div style={{ marginBottom: '0.65rem', fontSize: '0.875rem' }} data-demand-enclosed>
              <span style={{ display: 'block', fontWeight: 500, marginBottom: '0.2rem' }}>Enclosed</span>
              <div style={{ border: '1px dashed var(--border-strong)', borderRadius: 6, padding: '0.45rem 0.55rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.8125rem' }}>
                {(fields.statement ?? []).map((st, i) =>
                  sources[i]?.doc ? (
                    <div key={`a-${i}`} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center' }}>
                      <span>
                        <b>Exhibit A</b> · {exhibitATitle(st.invoiceNumber, st.sentYmd)}
                      </span>
                      <span style={{ padding: '0.05rem 0.45rem', borderRadius: 999, fontSize: '0.6875rem', fontWeight: 700, background: 'var(--bg-green-tint)', color: 'var(--text-green-700)' }}>always</span>
                    </div>
                  ) : (
                    <div key={`a-${i}`} style={{ color: 'var(--text-muted)' }}>
                      <b>Exhibit A</b> · {st.invoiceNumber} — the bill could not be rendered from this job; open it from Bill Customer and try again
                    </div>
                  ),
                )}
                <label style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center', cursor: signedAgreement ? 'pointer' : 'default', color: signedAgreement ? undefined : 'var(--text-muted)' }}>
                  <span>
                    <b>Exhibit B</b> · {signedAgreement ? signedAgreement.title : 'Signed agreement — none on this job'}
                  </span>
                  {signedAgreement ? <input type="checkbox" checked={includeAgreement} onChange={(e) => setIncludeAgreement(e.target.checked)} /> : <span style={{ padding: '0.05rem 0.45rem', borderRadius: 999, fontSize: '0.6875rem', fontWeight: 700, background: 'var(--bg-subtle)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>no contract</span>}
                </label>
                <label style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center', cursor: 'pointer' }}>
                  <span>
                    <b>Exhibit C</b> · Delivery record — {priorNotices.length === 0 ? 'the invoice date only' : `${priorNotices.length} dated send${priorNotices.length === 1 ? '' : 's'} and contact${priorNotices.length === 1 ? '' : 's'}`}
                  </span>
                  <input type="checkbox" checked={includeDeliveryRecord} onChange={(e) => setIncludeDeliveryRecord(e.target.checked)} />
                </label>
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Print and Download PDF produce one file: the letter, then every exhibit, each page stamped.</div>
            </div>
            <label style={{ display: 'block', marginBottom: '0.65rem', fontSize: '0.875rem' }}>
              <span style={{ display: 'block', fontWeight: 500, marginBottom: '0.2rem' }}>
                Payment deadline{' '}
                <button type="button" onClick={() => setField('deadlineDate', addBusinessDays(todayYmdLocal(), 10))} style={{ background: 'none', border: 'none', color: 'var(--text-link)', fontSize: '0.6875rem', fontWeight: 700, cursor: 'pointer', padding: 0 }}>
                  +10 business days
                </button>
              </span>
              <input type="date" value={fields.deadlineDate} onChange={(e) => setField('deadlineDate', e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '0.45rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem' }} />
              {fields.feeClockYmd ? (
                <span data-demand-fee-clock style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Attorney's fees become recoverable if the claim is still unpaid 30 days after this letter — <b>{demandDate(fields.feeClockYmd)}</b> (CPRC § 38.002). The letter says both dates.
                </span>
              ) : null}
            </label>
            <label style={{ display: 'block', marginBottom: '0.65rem', fontSize: '0.875rem' }}>
              <span style={{ display: 'block', fontWeight: 500, marginBottom: '0.2rem' }}>Payment method line (optional)</span>
              <input type="text" value={fields.paymentMethod} onChange={(e) => setField('paymentMethod', e.target.value)} placeholder="e.g. Checks payable to Click Plumbing and Electrical." style={{ width: '100%', boxSizing: 'border-box', padding: '0.45rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem' }} />
            </label>

            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', margin: '0.8rem 0 0.3rem' }}>Notice history the letter cites</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 6, padding: '0.4rem 0.55rem', marginBottom: '0.8rem', background: 'var(--bg-subtle)' }}>
              {priorNotices.length === 0 ? 'Just the invoice date — no re-sends or collection calls recorded yet.' : priorNotices.map((n) => `${demandDate(n.date)} — ${n.label}`).join(' · ')}
            </div>

            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.3rem' }}>What the letter may say</div>
            {toggle(
              'includeSmallClaims',
              Number((fields.outstanding ?? '').replace(/[$,\s]/g, '')) <= 20_000 ? 'Suit in justice court' : 'Suit in county or district court',
              Number((fields.outstanding ?? '').replace(/[$,\s]/g, '')) <= 20_000 ? `${demandMoney(fields.outstanding)} is within the $20,000 limit` : 'above the $20,000 justice-court limit',
            )}
            {fields.lienBlockedReason ? (
              <label data-demand-lien-blocked style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem', fontSize: '0.8125rem', marginBottom: '0.3rem', cursor: 'not-allowed', opacity: 0.6 }}>
                <input type="checkbox" checked={false} disabled readOnly style={{ marginTop: '0.2rem' }} />
                <span>
                  Mechanic's lien under Chapter 53
                  <span style={{ display: 'block', color: 'var(--text-red-700)', fontSize: '0.6875rem', fontWeight: 700 }}>not offered — {fields.lienBlockedReason}</span>
                </span>
              </label>
            ) : (
              toggle('includeLien', 'Mechanic\'s lien under Chapter 53', fields.lienFilingDeadline ? `filing window open through ${demandDate(fields.lienFilingDeadline)}` : undefined)
            )}
            {(() => {
              // Owner rule (2026-09-02): § 31.04 only applies when the client
              // has made NO payments on the job — a partial payment defeats it.
              // Every payment on the job counts, whichever bill it sits on (v2.3515).
              const hasPayments = jobPaidAnything
              return (
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8125rem', marginBottom: '0.3rem', cursor: hasPayments ? 'not-allowed' : 'pointer', opacity: hasPayments ? 0.55 : 1 }}>
                  <input
                    type="checkbox"
                    checked={Boolean(fields.includeTheftOfServices) && !hasPayments}
                    disabled={hasPayments}
                    onChange={(e) => setField('includeTheftOfServices', e.target.checked)}
                  />
                  Theft-of-services report (Penal Code § 31.04)
                  <span style={{ color: hasPayments ? 'var(--text-muted)' : 'var(--text-amber-700)', fontSize: '0.6875rem', fontWeight: 700 }}>
                    {hasPayments ? 'not applicable — payments have been made on this job' : 'available — no payments made on this job'}
                  </span>
                </label>
              )
            })()}
            {fields.interestBasis === 'ch28' && fields.interestFromYmd
              ? toggle('includeLateFees', 'Interest at 1.5 % a month', `Prop. Code § 28.004 — the bill was a written payment request; from ${demandDate(fields.interestFromYmd)}`)
              : fields.interestBasis === 'legal_rate' && fields.interestFromYmd
                ? toggle('includeLateFees', 'Interest at 6 % a year', `Fin. Code § 302.002 — no rate agreed and the bill was never sent; from ${demandDate(fields.interestFromYmd)}`)
                : fields.feeClockYmd
                  ? (
                    <label data-demand-interest-none style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8125rem', marginBottom: '0.3rem', cursor: 'not-allowed', opacity: 0.6 }}>
                      <input type="checkbox" checked={false} disabled readOnly />
                      Interest
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.6875rem', fontWeight: 700 }}>not offered — the bill has no sent or due date to run from</span>
                    </label>
                  )
                  : toggle('includeLateFees', 'Late-fees / interest note')}
            {toggle('includeNotarial', 'Notarial block (certified mail only)')}
          </div>

          {/* Live preview — pinned light like the printed letter. */}
          <div data-theme="light" style={{ flex: '1 1 22rem', minWidth: '19rem', padding: '1.25rem', background: 'var(--bg-subtle)', borderLeft: '1px solid var(--border)' }}>
            <div style={{ background: 'var(--surface)', color: 'var(--text-base)', border: '1px solid var(--border)', borderRadius: 4, padding: '1.2rem 1.35rem', fontFamily: "Georgia, 'Times New Roman', serif", fontSize: '0.78rem', lineHeight: 1.65, boxShadow: '0 4px 14px rgba(0,0,0,0.08)' }}>
              {model.map((b, i) => {
                switch (b.kind) {
                  case 'senderBlock':
                    return (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1.5rem', margin: '0 0 0.9em', paddingBottom: '0.6em', borderBottom: '1px solid #cfcbc2' }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '1.12em' }}>{b.company}</div>
                          {b.licenseLine ? <div style={{ fontFamily: "'Helvetica Neue', Arial, sans-serif", fontSize: '0.72em', color: '#7a756c', marginTop: '0.15em' }}>{b.licenseLine}</div> : null}
                        </div>
                        <div style={{ fontFamily: "'Helvetica Neue', Arial, sans-serif", flex: '0 0 auto', whiteSpace: 'nowrap', textAlign: 'right', fontSize: '0.8em', color: '#5f5a52', lineHeight: 1.45 }}>
                          {b.contactLines.map((l, j) => (
                            <span key={j}>
                              {l}
                              <br />
                            </span>
                          ))}
                        </div>
                      </div>
                    )
                  case 'meta':
                    return (
                      <p key={i} style={{ margin: '0 0 0.4em' }}>
                        {b.text}
                      </p>
                    )
                  case 'reLine':
                    return (
                      <p key={i} style={{ textAlign: 'center', fontWeight: 700, margin: '0.7em 0' }}>
                        {b.text}
                      </p>
                    )
                  case 'heading':
                    return (
                      <p key={i} style={{ fontWeight: 700, margin: '0.8em 0 0.25em' }}>
                        {b.text}
                      </p>
                    )
                  case 'paragraph':
                    return (
                      <p key={i} style={{ margin: '0 0 0.6em' }}>
                        {b.text}
                      </p>
                    )
                  case 'listItem':
                    return (
                      <p key={i} style={{ margin: '0 0 0.2em 1.1em' }}>
                        • {b.text}
                      </p>
                    )
                  case 'signature':
                    return (
                      <p key={i} style={{ margin: '1em 0 0' }}>
                        {b.lines.map((l, j) => (
                          <span key={j}>
                            {l}
                            <br />
                          </span>
                        ))}
                      </p>
                    )
                  case 'statement':
                    return (
                      <table key={i} style={{ borderCollapse: 'collapse', width: '100%', margin: '0.3em 0 0.8em', fontSize: '0.95em' }}>
                        <tbody>
                          {statementRows(b).map((r, j) => {
                            const strong = r.kind === 'invoice' || r.kind === 'total' || (r.kind === 'balance' && b.invoices.length === 1)
                            const rule = r.kind === 'total' || (r.kind === 'balance' && b.invoices.length === 1) ? '2px solid #333' : '1px solid #e3ded2'
                            return (
                              <tr key={j}>
                                <td style={{ padding: r.kind === 'invoice' ? '0.6em 0.4em 0.25em 0' : '0.25em 0.4em 0.25em 0', borderBottom: rule, fontWeight: strong ? 700 : 400, color: r.kind === 'paid' ? '#555' : undefined }}>{r.left}</td>
                                <td style={{ padding: '0.25em 0 0.25em 0.6em', borderBottom: rule, textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', fontWeight: strong ? 700 : 400, color: r.kind === 'paid' ? '#555' : undefined }}>{r.right}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    )
                  case 'notarial':
                    return (
                      <p key={i} style={{ margin: '1.6em 0 0', color: 'var(--text-muted)' }}>
                        STATE OF TEXAS · COUNTY OF ___ · notarial block
                      </p>
                    )
                  default:
                    return null
                }
              })}
            </div>
            {/* The exhibits, as the pages they will be (v2.3429). */}
            {(fields.enclosures ?? []).map((ex, i) => {
              const stamp = (
                <div style={{ position: 'absolute', top: 10, right: 12, border: '2px solid #8a1c1c', color: '#8a1c1c', fontFamily: "'Helvetica Neue', Arial, sans-serif", fontWeight: 700, fontSize: '0.68rem', letterSpacing: '0.08em', padding: '3px 6px', background: 'rgba(255,255,255,0.85)', transform: 'rotate(-4deg)' }}>
                  EXHIBIT {ex.label}
                </div>
              )
              const card = (children: React.ReactNode) => (
                <div key={`${ex.label}-${i}`} data-demand-exhibit={ex.label} style={{ position: 'relative', marginTop: '1rem', background: 'var(--surface)', color: 'var(--text-base)', border: '1px solid var(--border)', borderRadius: 4, padding: '1.2rem 1.35rem', boxShadow: '0 4px 14px rgba(0,0,0,0.08)' }}>
                  {stamp}
                  {children}
                </div>
              )
              if (ex.label === 'A') {
                const aIndex = (fields.enclosures ?? []).slice(0, i).filter((e) => e.label === 'A').length
                const doc = sources[aIndex]?.doc ?? null
                return card(doc ? <PhysicalInvoicePreview document={doc} /> : <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{ex.title}</div>)
              }
              if (ex.label === 'B') {
                return card(
                  <div style={{ fontFamily: "'Helvetica Neue', Arial, sans-serif", fontSize: '0.8rem', paddingRight: '6rem' }}>
                    <div style={{ fontWeight: 700 }}>{ex.title}</div>
                    <div style={{ color: 'var(--text-muted)', marginTop: '0.3rem' }}>Attached from the job's contract file as stored — every page of the signed PDF follows the letter.</div>
                  </div>,
                )
              }
              return card(
                <div style={{ fontFamily: "'Helvetica Neue', Arial, sans-serif", fontSize: '0.8rem', paddingRight: '6rem' }}>
                  <div style={{ fontWeight: 700 }}>Delivery record</div>
                  <div style={{ color: 'var(--text-muted)', margin: '0.15rem 0 0.5rem' }}>{demandInvoicesPhrase(fields.statement ?? [])} · {fields.recipientName || '—'}</div>
                  {priorNotices.length === 0 ? (
                    <div>No sends or contacts are on record beyond the invoice itself.</div>
                  ) : (
                    priorNotices.map((n, j) => (
                      <div key={j} style={{ display: 'grid', gridTemplateColumns: '9rem 1fr', gap: '0.5rem', padding: '0.15rem 0', borderBottom: '1px solid #e3ded2' }}>
                        <b>{demandDate(n.date)}</b>
                        <span>{n.label}</span>
                      </div>
                    ))
                  )}
                </div>,
              )
            })}
          </div>
        </div>

        {emailOpen ? (
          <div data-demand-email style={{ padding: '0.9rem 1.25rem', borderTop: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
            <div style={{ fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.2rem' }}>Email the letter and its exhibits as one PDF</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              A second channel, not the only one: certified mail with a return receipt is what proves delivery (and what § 31.04 and a chapter 53 notice require). The send is recorded on the job with the email's id as its tracking.
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'flex-end' }}>
              <label style={{ flex: '1 1 16rem', fontSize: '0.8125rem' }}>
                <span style={{ display: 'block', fontWeight: 500, marginBottom: '0.2rem' }}>To</span>
                <input type="email" value={emailTo} onChange={(e) => setEmailTo(e.target.value)} placeholder={fields.recipientEmail.trim() || 'no email on file for the payer'} style={{ width: '100%', boxSizing: 'border-box', padding: '0.45rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem' }} />
              </label>
              <button type="button" onClick={() => setEmailOpen(false)} style={{ padding: '0.45rem 0.8rem', fontSize: '0.8125rem', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}>
                Back
              </button>
              <button type="button" onClick={() => void emailPacket()} disabled={emailBusy || recordBusy} style={{ padding: '0.45rem 0.9rem', fontSize: '0.8125rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: 4, cursor: emailBusy ? 'wait' : 'pointer', fontWeight: 600 }}>
                {emailBusy ? 'Sending…' : `Send · ${1 + (fields.enclosures ?? []).length} documents`}
              </button>
            </div>
          </div>
        ) : null}
        {recordOpen ? (
          <div style={{ padding: '0.9rem 1.25rem', borderTop: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
            <div style={{ fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.45rem' }}>Record the send — the letter only counts if it can be proven</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.55rem' }}>
              {SENT_METHODS.map((m) => (
                <button key={m.value} type="button" onClick={() => setRecordMethod(m.value)} style={{ padding: '0.3rem 0.6rem', fontSize: '0.78rem', borderRadius: 6, border: recordMethod === m.value ? '2px solid var(--text-amber-700)' : '1px solid var(--border-strong)', background: recordMethod === m.value ? 'var(--bg-amber-tint)' : 'var(--surface)', cursor: 'pointer', fontWeight: recordMethod === m.value ? 700 : 400 }}>
                  {m.label}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'flex-end' }}>
              <label style={{ fontSize: '0.78rem', flex: '2 1 14rem' }}>
                <span style={{ display: 'block', fontWeight: 600, marginBottom: '0.15rem' }}>Tracking / receipt number</span>
                <input type="text" value={recordTracking} onChange={(e) => setRecordTracking(e.target.value)} placeholder="9407 1112 0108 …" style={{ width: '100%', boxSizing: 'border-box', padding: '0.4rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.8125rem' }} />
              </label>
              <label style={{ fontSize: '0.78rem', flex: '1 1 9rem' }}>
                <span style={{ display: 'block', fontWeight: 600, marginBottom: '0.15rem' }}>Sent on (effective on mailing)</span>
                <input type="date" value={recordSentOn} onChange={(e) => setRecordSentOn(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '0.4rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.8125rem' }} />
              </label>
              <button type="button" onClick={() => setRecordOpen(false)} style={{ padding: '0.45rem 0.9rem', fontSize: '0.8125rem', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}>
                Back
              </button>
              <button type="button" onClick={() => void recordSend()} disabled={recordBusy} style={{ padding: '0.45rem 1rem', fontSize: '0.8125rem', background: '#b45309', color: 'white', border: 'none', borderRadius: 4, cursor: recordBusy ? 'wait' : 'pointer', fontWeight: 600 }}>
                {recordBusy ? 'Recording…' : 'Record'}
              </button>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
              Deadline watch: if the covered lines are still unpaid after {demandDate(fields.deadlineDate)}, a Needs You card hands you the next step.
            </div>
          </div>
        ) : (
          <div style={{ padding: '0.9rem 1.25rem', borderTop: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}>
              Cancel
            </button>
            <button type="button" onClick={() => void printLetter()} disabled={pdfBusy} style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', background: 'var(--surface)', border: '1px solid #2563eb', color: 'var(--text-link)', borderRadius: 4, cursor: pdfBusy ? 'wait' : 'pointer' }}>
              Print packet
            </button>
            <button type="button" onClick={() => void downloadPdf()} disabled={pdfBusy} style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', background: 'var(--surface)', border: '1px solid #2563eb', color: 'var(--text-link)', borderRadius: 4, cursor: pdfBusy ? 'wait' : 'pointer' }}>
              {pdfBusy ? 'Building…' : 'Download PDF'}{pdfBusy ? '' : ` · ${1 + (fields.enclosures ?? []).length} documents`}
            </button>
            <button
              type="button"
              onClick={() => {
                setEmailTo((prev) => prev || fields.recipientEmail.trim())
                setEmailOpen(true)
                setRecordOpen(false)
              }}
              disabled={pdfBusy || emailBusy}
              style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', background: 'var(--surface)', border: '1px solid #2563eb', color: 'var(--text-link)', borderRadius: 4, cursor: 'pointer' }}
            >
              Email with the PDF…
            </button>
            <button type="button" onClick={() => setRecordOpen(true)} style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', background: '#b45309', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>
              Save &amp; record send…
            </button>
          </div>
        )}
          </>
        ) : (
          <LienFilingTabs
            noticeMonths={noticeMonths ?? null}
            job={job}
            jobNumber={jobNumber}
            activeTab={activeTab}
            issuer={issuer}
            signerNameFallback={signerNameFallback}
            linkedAddress={linkedAddress}
            invoiceDocs={noticeDocs}
            jobOwnerRow={jobOwnerRow}
            filings={filings}
            clock={clock}
            isSub={isSub}
            originalContractorName={originalContractorName}
            ownerEmail={(jobOwnerRow?.owner_email ?? '').trim()}
            originalContractorEmail={isSub ? gcEmail : ''}
            onChanged={() => {
              void loadFilings()
              onRecorded?.()
            }}
          />
        )}
      </div>
    </div>
  )
}
