import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { buildPayPageAssets } from '../../lib/jobs/lienNoticePayPageAssets'
import type { PayPageAssets } from '../../lib/jobs/lienNoticePayPage'
import { ActionPhaseButton } from '../ActionPhaseButton'
import { useActionPhase } from '../../hooks/useActionPhase'
import type { Database } from '../../types/database'
import type { JobWithDetails } from '../../types/jobWithDetails'
import {
  addBusinessDays,
  buildDemandLetterEmailHtml,
  demandPayCodeRows,
  exhibitInvoiceDocument,
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
import { buildDemandLetterPacket, exhibitKind, exhibitLabels, type DemandExhibit, type DemandExhibitInput, type DemandLetterPacket } from '../../lib/jobsDocuments/demandLetterPacket'
import { buildPhysicalInvoicePdfBlob } from '../../lib/physicalInvoicePdf'
import { LienRulesDoor } from './LienRulesDoor'
import { lienRuleHref } from '../../lib/jobs/lienRuleCites'
import { PhysicalInvoicePreview } from './PhysicalInvoicePreview'
import { JOB_CONTRACT_BUCKET } from '../../lib/jobs/jobContractFileWrite'
import { noticeInvoiceDocs } from '../../lib/jobs/noticeInvoiceEnclosure'
import { liveDemandLetters, type JobDemandLetterRow } from '../../lib/jobs/demandLetterTracking'
import { parsePaymentPromisesRpc } from '../../lib/jobs/paymentPromises'
import { computeJobLienClock, type JobLienFilingRow } from '../../lib/jobs/lienDeadlines'
import { buildLienTimelineFromWindow } from '../../lib/jobs/lienTimelineDesk'
import LienTimelineStrip from './LienTimelineStrip'
import { LienLastWorkDayLine } from './LienLastWorkDayLine'
import { isLienOffice } from '../../lib/jobs/lienDesk'
import { lienWindowNextStep } from '../../lib/jobs/lienWindowNextStep'
import LienWindowFoldedSteps from './LienWindowFoldedSteps'
import DemandRecordSendSheet from './DemandRecordSendSheet'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useScrollEdgeFade } from '../../hooks/useScrollEdgeFade'
import { useLienJobSuppliers } from '../../hooks/useLienJobSuppliers'
import { LienJobSuppliersCard } from './LienJobSuppliers'
import { lienSupplierMark } from '../../lib/jobs/lienJobSuppliers'
import { useForecastWorkMonths } from '../../hooks/useForecastWorkMonths'
import { type CustomerAddressRow, type JobPropertyOwnerLike } from '../../lib/jobs/lienProperty'
import LienFilingTabs from './LienFilingTabs'
import { formatYmdMonthDay } from '../../lib/jobs/billedExpectedPay'
import LienStopPaperWindow, { type LienStopPaper } from './LienStopPaperWindow'
import { filingSnapshotPage } from '../../lib/jobs/lienStopPaperPages'
import { lienStopPaperKind } from '../../lib/jobs/lienStopPaper'
import type { LienTimelineStep } from '../../lib/jobs/lienTimeline'
import { openHtmlPreviewWindow } from '../../lib/jobsDocuments/printWindow'
import { fetchPhysicalInvoiceIssuerFromAppSettings, getPhysicalInvoiceIssuerDraft } from '../../lib/physicalInvoiceIssuer'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'
import { useAuth } from '../../hooks/useAuth'
import { APP_CALENDAR_TZ, calendarYmdInAppTzFromIso, todayYmdInAppTz } from '../../utils/dateUtils'

type JobsLedgerInvoice = Database['public']['Tables']['jobs_ledger_invoices']['Row']

/**
 * Lien instruments modal (v2.2640, phase 2 of the Lien Instruments plan): the
 * orange lien icon's new home. Tab 1 is the in-app FINAL DEMAND LETTER —
 * generated from the job's real billing history (dated notice list from
 * invoice sends, Stripe re-sends, and call-mode collection touches), recorded
 * with its tracking number in `job_demand_letters`, and watched after its
 * deadline. The § 53.056 notice and mechanic's-lien tabs landed with phase 3.
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

function billDay(i: JobsLedgerInvoice): string {
  return calendarYmdInAppTzFromIso(i.billed_at ?? '') || calendarYmdInAppTzFromIso(i.sent_to_customer_at ?? '') || calendarYmdInAppTzFromIso(i.created_at ?? '')
}

/** Billed lines with money still open — what a demand letter is about. Same payment rule as the letter's claim (v2.3515). */
function demandableInvoices(job: JobWithDetails): JobsLedgerInvoice[] {
  return (job.invoices ?? [])
    .filter((i) => i.status === 'billed' && Number(i.amount ?? 0) - paymentsAppliedToInvoice(job, i.id) > 0.005)
    .slice()
    // In the order they went out, so the statement and the exhibits read by date; the sequence breaks a tie.
    .sort((a, b) => billDay(a).localeCompare(billDay(b)) || a.sequence_order - b.sequence_order)
}

/** A chip on the band under the timeline (v2.4693): one fact, one door. */
const bandChip: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '2px 10px', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', font: 'inherit', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }

export default function LienInstrumentsModal({
  open,
  onClose,
  job,
  invoice,
  signerNameFallback,
  authEmail,
  onRecorded,
  initialTab,
  noticeMonths,
  onOpenLienDesk,
  onOpenRelease,
  openLastWork = false,
  onLastWorkSaved,
}: {
  open: boolean
  onClose: () => void
  job: JobWithDetails | null
  /** Row-level hint: preselect this bill line when demandable. */
  invoice: JobsLedgerInvoice | null
  /** Job master's People "Full name and title" with session-name fallback. */
  signerNameFallback: string
  authEmail: string
  /** Fired after a letter is recorded so openers can refresh badges/watches. */
  onRecorded?: () => void
  /** Land on this tab when the window opens (the forecast's Send notice… door opens on 'notice'). */
  initialTab?: 'demand' | 'notice' | 'affidavit' | 'release_record'
  /** The Lien desk's months for the § 53.056 notice (v2.3405) — recorded as months_covered instead of the last work month alone. */
  noticeMonths?: string[] | null
  /** The next step's door to the Lien desk on this job (punch list #82): notices and retainage are drafted, approved and sent there. Absent, the card has no desk button. */
  onOpenLienDesk?: (jobId: string, kind: 'notice' | 'retainage') => void
  /** *Waivers on the bills* (punch list #82): the Release of Lien window for this job, opened over this one. */
  onOpenRelease?: (job: JobWithDetails) => void
  /** Open with the last day of work's line already editing (v2.4735): the Deadlines grid's last-day label. */
  openLastWork?: boolean
  /** The last day of work was set or cleared here: the opener re-reads its clocks and the desk. */
  onLastWorkSaved?: () => void
}) {
  const { role: authRole, user: authUser } = useAuth()
  const { showToast } = useToastContext()
  const [activeTab, setActiveTab] = useState<'demand' | 'notice' | 'affidavit' | 'release_record'>('demand')
  const [filings, setFilings] = useState<JobLienFilingRow[]>([])
  // A stop's paper (v2.4793): the timeline stop whose window is open; null when closed, and closed with the window.
  const [stopOpen, setStopOpen] = useState<number | null>(null)
  useEffect(() => {
    if (!open) setStopOpen(null)
  }, [open])
  const [linkedAddress, setLinkedAddress] = useState<CustomerAddressRow | null>(null)
  const [jobOwnerRow, setJobOwnerRow] = useState<JobPropertyOwnerLike>(null)
  const [gcEmail, setGcEmail] = useState('')
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<ReadonlySet<string>>(() => new Set())
  const [fields, setFields] = useState<DemandLetterFields | null>(null)
  // The pay codes (v2.4849): one per covered Stripe bill, drawn in the browser from the bill's /pay address and handed to every renderer.
  const [payAssets, setPayAssets] = useState<PayPageAssets>({})
  const payCodeRows = useMemo(() => demandPayCodeRows(fields?.statement ?? []), [fields?.statement])
  const payCodeKey = payCodeRows.map((r) => r.invoiceId).join('|')
  useEffect(() => {
    let cancelled = false
    if (!payCodeKey) {
      setPayAssets({})
      return
    }
    void buildPayPageAssets(payCodeRows.map((r) => ({ invoiceId: r.invoiceId, label: r.label, description: '', openAmount: 0, payable: true })))
      .then((a) => {
        if (!cancelled) setPayAssets(a)
      })
      .catch(() => {
        if (!cancelled) setPayAssets({})
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the bill ids, not the row objects
  }, [payCodeKey])
  const [issuerGen, setIssuerGen] = useState(0)
  const [priorNotices, setPriorNotices] = useState<DemandPriorNotice[]>([])
  const [customerAddress, setCustomerAddress] = useState('')
  const [propertyKind, setPropertyKind] = useState('')
  const [historyRows, setHistoryRows] = useState<JobDemandLetterRow[]>([])
  // The last day of work (v2.4735): the timeline's *change ›* opens the All filings line here; a save re-reads the job's five columns.
  const [lastWorkOpen, setLastWorkOpen] = useState(openLastWork)
  const [lastWorkPatch, setLastWorkPatch] = useState<Partial<Pick<JobWithDetails, 'last_work_date' | 'lien_last_work_on' | 'lien_last_work_note' | 'lien_last_work_set_at' | 'lien_last_work_set_by'>> | null>(null)
  useEffect(() => {
    setLastWorkOpen(open && openLastWork)
    setLastWorkPatch(null)
  }, [open, job?.id, openLastWork])
  const [voidPendingId, setVoidPendingId] = useState<string | null>(null)
  const [pdfBusy, setPdfBusy] = useState(false)
  // The footer's three doors say what they are doing (v2.4584): busy for at least 1.5 s, then done for 2 s, at one width.
  const printPhase = useActionPhase()
  const downloadPhase = useActionPhase()
  const emailPhase = useActionPhase()
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
  // v2.3429 — the exhibits: the signed agreement when the job has one, and the two switches.
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
        // The job's signed agreement, when one exists as a PDF.
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
              const when = calendarYmdInAppTzFromIso(signed.signed_at ?? '') || (signed.paper_signed_on ?? '').slice(0, 10)
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
        // Every notice below is an instant: its day in APP_CALENDAR_TZ, never its UTC date.
        const billed = calendarYmdInAppTzFromIso(inv.billed_at ?? inv.created_at ?? '')
        if (/^\d{4}-\d{2}-\d{2}$/.test(billed)) notices.push({ date: billed, label: 'Invoice sent' })
        const sentOut = calendarYmdInAppTzFromIso(inv.sent_to_customer_at ?? '')
        if (/^\d{4}-\d{2}-\d{2}$/.test(sentOut) && sentOut !== billed)
          notices.push({ date: sentOut, label: 'Invoice delivered to customer' })
      }
      try {
        const { data: resends } = await supabase
          .from('jobs_ledger_invoice_stripe_email_sends')
          .select('jobs_ledger_invoice_id, sent_at')
          .in('jobs_ledger_invoice_id', selectedInvoices.map((i) => i.id))
        for (const r of (resends ?? []) as { sent_at: string }[]) {
          const d = calendarYmdInAppTzFromIso(r.sent_at ?? '')
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
          const d = calendarYmdInAppTzFromIso(pr.createdAt)
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
          const d = calendarYmdInAppTzFromIso(t.created_at ?? '')
          if (/^\d{4}-\d{2}-\d{2}$/.test(d))
            notices.push({ date: d, label: `Collection call: ${(t.outcome ?? '').replace(/_/g, ' ') || 'recorded'}` })
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
      const withDoc = (next.statement ?? []).filter((_, i) => sources[i]?.doc)
      const labels = exhibitLabels({ invoices: withDoc.length, agreement: Boolean(signedAgreement && includeAgreement), delivery: includeDeliveryRecord })
      withDoc.forEach((st, i) => enclosures.push({ label: labels.invoices[i]!, kind: 'invoice', title: exhibitATitle(st.invoiceNumber, st.sentYmd), pages: 0 }))
      if (signedAgreement && includeAgreement) enclosures.push({ label: labels.agreement, kind: 'agreement', title: signedAgreement.title, pages: 0 })
      if (includeDeliveryRecord) enclosures.push({ label: labels.delivery, kind: 'delivery', title: 'Delivery record', pages: 0 })
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
        includePayCodes: prev.includePayCodes ?? true,
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
    const bills = sources.flatMap((src, i) => (src.doc && statement[i] ? [{ doc: src.doc, st: statement[i]! }] : []))
    let agreementBlob: Blob | null = null
    if (signedAgreement && includeAgreement) {
      try {
        const { data } = await supabase.storage.from(JOB_CONTRACT_BUCKET).download(signedAgreement.path)
        agreementBlob = data ?? null
      } catch {
        // the letter still goes without it; the labels and the enclosures follow what was actually merged
      }
    }
    const labels = exhibitLabels({ invoices: bills.length, agreement: agreementBlob != null, delivery: includeDeliveryRecord })
    for (let i = 0; i < bills.length; i++) {
      const { doc, st } = bills[i]!
      // The exhibit carries the letter's number and due day for this bill.
      inputs.push({ label: labels.invoices[i]!, kind: 'invoice', title: exhibitATitle(st.invoiceNumber, st.sentYmd), blob: await buildPhysicalInvoicePdfBlob(exhibitInvoiceDocument(doc, st)) })
    }
    if (signedAgreement && agreementBlob) inputs.push({ label: labels.agreement, kind: 'agreement', title: signedAgreement.title, blob: agreementBlob })
    if (includeDeliveryRecord) {
      inputs.push({
        label: labels.delivery,
        kind: 'delivery',
        title: 'Delivery record',
        blob: await buildDeliveryRecordPdfBlob({ businessName: fields.businessName, invoicesPhrase: demandInvoicesPhrase(statement), recipientName: fields.recipientName, rows: fields.priorNotices, todayYmd: today }),
      })
    }
    const first = await buildDemandLetterPacket(await buildDemandLetterPdfBlob({ ...fields, enclosures: inputs.map((i) => ({ label: i.label, kind: i.kind, title: i.title, pages: 0 })) }, today, { payAssets }), inputs)
    const letter = await buildDemandLetterPdfBlob({ ...fields, enclosures: first.exhibits }, today, { payAssets })
    return buildDemandLetterPacket(letter, inputs)
  }, [fields, sources, signedAgreement, includeAgreement, includeDeliveryRecord, payAssets])

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
  const lastWorkJob = useMemo(() => (job ? { ...job, ...(lastWorkPatch ?? {}) } : null), [job, lastWorkPatch])
  const canSetLastWork = isLienOffice(authRole)
  const reReadLastWork = useCallback(async () => {
    if (!job) return
    const { data } = await supabase.from('jobs_ledger').select('last_work_date, lien_last_work_on, lien_last_work_note, lien_last_work_set_at, lien_last_work_set_by').eq('id', job.id).maybeSingle()
    if (data) setLastWorkPatch(data as NonNullable<typeof lastWorkPatch>)
    setLastWorkOpen(false)
    onLastWorkSaved?.()
  }, [job, onLastWorkSaved])
  const clock = useMemo(
    () => computeJobLienClock({ lastWorkYmd: job?.last_work_date ?? null, propertyKind, isSub }),
    [job?.last_work_date, propertyKind, isSub],
  )
  // The header's timeline (v2.3781): the job's work months (approved sessions) plus its filings, through the same kernel the desk draws — the creation month when there are no hours.
  const forecastJobs = useMemo(() => (job ? [{ id: job.id, gc_customer_id: job.gc_customer_id ?? null, customer_address_id: job.customer_address_id ?? null }] : null), [job])
  const { byJob: windowWorkMonths } = useForecastWorkMonths(open ? forecastJobs : null, todayYmdLocal())
  // On a phone (v2.4398) the steps fold to one strip and the papers are one bar; the bar says when a paper is past its right edge.
  const isMobile = useIsMobile()
  // The band under the timeline, folded (v2.4693): on a computer the waivers and the supply house are chips, and the supply-house card opens under *Details*.
  const [bandDetailsOpen, setBandDetailsOpen] = useState(false)
  // Supply houses on this job (v2.4404): one folded line in the header, the desk's card when opened.
  const supplierJobIds = useMemo(() => (job ? [job.id] : []), [job])
  const suppliers = useLienJobSuppliers(supplierJobIds, open && job != null)
  const supplierJob = job ? suppliers.byJob.get(job.id) : undefined
  const papersBar = useScrollEdgeFade<HTMLDivElement>()
  const timeline = useMemo(
    () =>
      job
        ? buildLienTimelineFromWindow({
            workMonths: windowWorkMonths?.[job.id] ?? null,
            filings,
            // v2.4735: the day set by hand reaches the window's timeline too (it read the clock hours and the creation day only).
            job: { id: job.id, created_at: job.created_at ?? null, last_work_date: lastWorkJob?.last_work_date ?? null, lien_contract_ended_on: (job as { lien_contract_ended_on?: string | null }).lien_contract_ended_on ?? null, lien_last_work_on: lastWorkJob?.lien_last_work_on ?? null },
            isSub,
            propertyKind,
            openBalance: Math.max(0, Number(job.revenue ?? 0) - Number(job.payments_made ?? 0)),
            todayYmd: todayYmdLocal(),
            demandLetters: historyRows,
          })
        : null,
    [job, lastWorkJob, windowWorkMonths, filings, isSub, propertyKind, historyRows],
  )

  // A stop's paper (v2.4793): what the window shows for each stop, from the job's Lien window — a filing's own snapshot once it
  // went out, else the tab here that prints it; the notice and the retainage notice are drafted and sent on the Lien desk.
  const stopPaperFor = (step: LienTimelineStep): LienStopPaper => {
    const none: LienStopPaper = { pages: [], envelope: null, before: [], record: null, act: null }
    if (!job) return none
    const live = filings.filter((f) => !f.voided_at)
    const when = (ymd: string | null, iso: string) => formatYmdMonthDay(ymd ?? calendarYmdInAppTzFromIso(iso))
    const asSent = (f: JobLienFilingRow, words: string, extra: Partial<LienStopPaper> = {}): LienStopPaper => {
      const page = filingSnapshotPage(f, { issuer, jobNumber })
      return { ...none, pages: page ? [page] : [], record: { words, href: f.document_url || null }, note: page ? 'The paper as it went out, from the record.' : null, ...extra }
    }
    const tab = (t: 'notice' | 'affidavit' | 'release_record', label: string) => ({ label, onPress: () => { setStopOpen(null); setActiveTab(t) } })
    const kind = lienStopPaperKind(step)
    if (kind === 'notice') {
      const sent = step.monthKey ? live.find((f) => f.kind === 'notice_53_056' && (f.months_covered ?? []).includes(step.monthKey!)) : undefined
      if (sent) return asSent(sent, `Mailed ${when(sent.filed_at, sent.created_at)}`)
      if (step.state === 'missed' || step.fold) return { ...none, note: 'The window closed with nothing sent. The lien right on that work is gone; the money is still owed.' }
      return { ...none, act: tab('notice', 'Open the Notice tab ›'), note: 'The notice is drafted, approved and sent on the Lien desk. The Notice tab here prints it and records a mailing by hand.' }
    }
    if (kind === 'retainage') {
      const sent = live.find((f) => f.kind === 'retainage_53_057')
      if (sent) return asSent(sent, `Mailed ${when(sent.filed_at, sent.created_at)}`)
      return { ...none, act: onOpenLienDesk ? { label: 'Open it on the Lien desk ›', onPress: () => { setStopOpen(null); onOpenLienDesk(job.id, 'retainage') } } : null, note: 'The § 53.057 retainage notice is drafted and sent on the Lien desk, under Retainage.' }
    }
    if (kind === 'affidavit' || kind === 'serve') {
      const filed = live.filter((f) => f.kind === 'affidavit' && f.filed_at).sort((a, b) => (b.filed_at ?? '').localeCompare(a.filed_at ?? ''))[0]
      if (filed) {
        const words = kind === 'serve' ? (filed.served_at ? `Served ${when(filed.served_at, filed.created_at)}` : `Filed ${formatYmdMonthDay(filed.filed_at!)} · a copy to the owner and the GC is still owed`) : `Filed ${formatYmdMonthDay(filed.filed_at!)}${filed.recording_number ? ` · ${filed.recording_number}` : ''}`
        return asSent(filed, words, { envelope: kind === 'serve' ? 'A copy of the filed affidavit to the owner and the GC' : null })
      }
      return { ...none, act: tab('affidavit', 'Open the Affidavit tab ›'), note: kind === 'serve' ? 'Served as filed: the same affidavit, a copy in each envelope, within five days of filing.' : 'The Affidavit tab here draws the affidavit as it would file today, prints it for notarization and records the filing.' }
    }
    if (kind === 'release') {
      const filed = live.find((f) => f.kind === 'release_of_record')
      if (filed) return asSent(filed, `Released ${when(filed.filed_at, filed.created_at)}`)
      return { ...none, act: tab('release_record', 'Open the Release tab ›'), note: 'The release of record is made once the job is paid.' }
    }
    if (kind === 'demand') return { ...none, act: { label: 'Open the Demand letter tab ›', onPress: () => { setStopOpen(null); setActiveTab('demand') } }, note: 'The demand letter is sent from this window; its reply day is on the strip.' }
    return none
  }
  const originalContractorName = isSub
    ? (job?.gcCustomer?.name ?? '').trim() || (job?.customer_name ?? '').trim()
    : (issuer?.companyName ?? '').trim() || 'Click Plumbing and Electrical'
  const hasFiledAffidavit = filings.some((f) => f.voided_at == null && f.kind === 'affidavit' && f.filed_at)

  const setField = <K extends keyof DemandLetterFields>(key: K, value: DemandLetterFields[K]) => {
    setFields((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  // Print opens the packet PDF (letter + exhibits) in a new tab — one print, every page.
  const printLetter = useCallback(async (): Promise<boolean> => {
    if (!fields || pdfBusy) return false
    setPdfBusy(true)
    try {
      const packet = await buildPacket()
      if (!packet) return false
      const url = URL.createObjectURL(packet.blob)
      const win = window.open(url, '_blank', 'noopener')
      if (!win) showToast('Popup blocked — allow popups to print.', 'error')
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
      return Boolean(win)
    } catch {
      showToast('Could not build the packet.', 'error')
      return false
    } finally {
      setPdfBusy(false)
    }
  }, [fields, pdfBusy, buildPacket, showToast])

  const downloadPdf = useCallback(async (): Promise<boolean> => {
    if (!fields || pdfBusy) return false
    setPdfBusy(true)
    try {
      const packet = await buildPacket()
      if (!packet) return false
      const blob = packet.blob
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = demandLetterPdfFilename(jobNumber)
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      return true
    } catch {
      showToast('Could not build the PDF.', 'error')
      return false
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
      // The sheet has closed; the footer's Email button says it went.
      emailPhase.flashDone()
    } catch (e) {
      showToast(e instanceof Error && e.message ? `Could not email the letter: ${e.message}` : 'Could not email the letter.', 'error')
    } finally {
      setEmailBusy(false)
    }
  }, [fields, job, emailBusy, emailTo, buildPacket, jobNumber, recordSend, showToast, emailPhase])

  const viewHistoryLetter = useCallback(
    (r: JobDemandLetterRow) => {
      const snap = r.fields as unknown as DemandLetterFields | null
      if (!snap || typeof snap !== 'object' || !('outstanding' in snap)) {
        showToast('This record has no stored letter snapshot.', 'error')
        return
      }
      const ok = openHtmlPreviewWindow(buildDemandLetterPrintHtml(snap, r.sent_at ? r.sent_at.slice(0, 10) : calendarYmdInAppTzFromIso(r.created_at), jobNumber))
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
  const letterHtml = buildDemandLetterEmailHtml(fields, todayYmdLocal(), { payAssets })
  // The Enclosed panel names each exhibit by the letter it will wear: in order, no gap.
  const panelLabels = exhibitLabels({ invoices: sources.filter((src) => src.doc).length, agreement: Boolean(signedAgreement && includeAgreement), delivery: includeDeliveryRecord })
  // `extraHref` (v2.3594): a basis line that names a section links to that rule's row in the guide.
  const toggle = (key: keyof DemandLetterFields, label: string, extra?: string, extraHref?: string) => (
    <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8125rem', marginBottom: '0.3rem', cursor: 'pointer' }}>
      <input type="checkbox" checked={Boolean(fields[key])} onChange={(e) => setField(key, e.target.checked as never)} />
      {label}
      {extra ? (
        extraHref ? (
          <a href={extraHref} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: 'var(--text-amber-700)', fontSize: '0.6875rem', fontWeight: 700, textDecoration: 'underline dotted' }} title="Read this rule in the guide">
            {extra}
          </a>
        ) : (
          <span style={{ color: 'var(--text-amber-700)', fontSize: '0.6875rem', fontWeight: 700 }}>{extra}</span>
        )
      ) : null}
    </label>
  )

  // The next step, named (punch list #82): the timeline's own Next on the path, with the one door that goes there.
  const nextStep = timeline ? lienWindowNextStep(timeline.next, timeline.waitingOn) : null
  const nextDoor = nextStep?.button?.door ?? null
  const nextStepButton =
    nextStep?.button && nextDoor && (nextDoor.to === 'tab' || onOpenLienDesk) ? (
      <button
        type="button"
        data-lien-window-next-step-button
        onClick={() => {
          if (nextDoor.to === 'tab') setActiveTab(nextDoor.tab)
          else if (job) onOpenLienDesk?.(job.id, nextDoor.kind)
        }}
        style={{ flexShrink: 0, padding: '6px 14px', borderRadius: 7, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer', ...(isMobile ? { width: '100%', padding: '9px 14px' } : {}) }}
      >
        {nextStep.button.label} ›
      </button>
    ) : null
  const paperTabs = [
    ['demand', 'Demand letter'],
    ['notice', '§ 53.056 notice'],
    ['affidavit', "Mechanic's lien"],
    ...(hasFiledAffidavit ? ([['release_record', 'Release of record']] as const) : []),
  ] as const
  // Save & record send… on a phone is a sheet over the whole card (v2.4414); a computer keeps the panel at the foot.
  const recordSheetOpen = isMobile && recordOpen && activeTab === 'demand'
  // A foot button on a phone: half the row, its name on up to two lines.
  const phoneFootButton: CSSProperties = isMobile ? { padding: '0.35rem 0.5rem', fontSize: '0.8125rem', lineHeight: 1.25, minHeight: 44 } : {}
  const rulesWhere = activeTab === 'demand' ? 'window_demand' : activeTab === 'notice' ? 'window_notice' : activeTab === 'affidavit' ? 'window_affidavit' : 'window_release'

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
          // A phone's record sheet is drawn over the card (v2.4414); index.css keeps the card at its full height while one is up.
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
        data-lien-window-card
      >
        {recordSheetOpen ? (
          <DemandRecordSendSheet
            headline={`Demand letter · ${demandMoney(fields.outstanding)}`}
            lines={[`${(job.job_name ?? '').trim() || 'Job'} · ${jobNumber}`, ...(fields.deadlineDate ? [`Pay by ${demandDate(fields.deadlineDate)}`] : [])]}
            methods={SENT_METHODS}
            method={recordMethod}
            onMethod={setRecordMethod}
            tracking={recordTracking}
            onTracking={setRecordTracking}
            sentOn={recordSentOn}
            onSentOn={setRecordSentOn}
            note={`Deadline watch: if the covered lines are still unpaid after ${demandDate(fields.deadlineDate)}, a Needs You card hands you the next step.`}
            busy={recordBusy}
            onBack={() => setRecordOpen(false)}
            onClose={onClose}
            onRecord={() => void recordSend()}
          />
        ) : null}
        {/* The title bar. On a phone (v2.4398) the title, § Rules and × share one line and the steps fold to a strip, so the paper below gets the window; a computer keeps the steps as a row and gains the ×. */}
        <div style={{ position: 'relative', padding: isMobile ? '0.35rem 1rem 0.65rem' : '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
          {isMobile ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minHeight: 44 }}>
              <h2 id="lien-instruments-title" style={{ margin: 0, fontSize: '1.0625rem', fontWeight: 600, flex: 1, minWidth: 0 }}>
                Liens on job {jobNumber}
              </h2>
              <LienRulesDoor where={rulesWhere} style={{ minHeight: 34, padding: '0 0.65rem' }} />
              <button type="button" onClick={onClose} aria-label="Close" style={{ flexShrink: 0, width: 44, height: 44, marginRight: '-0.6rem', border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.4rem', lineHeight: 1, color: 'var(--text-muted)' }}>×</button>
            </div>
          ) : (
            <>
              <h2 id="lien-instruments-title" style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, paddingRight: '2rem' }}>
                Liens on job {jobNumber}
              </h2>
              <button type="button" onClick={onClose} aria-label="Close" style={{ position: 'absolute', right: '0.8rem', top: '0.7rem', border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.25rem', color: 'var(--text-muted)', padding: 4 }}>×</button>
            </>
          )}
          <p style={{ margin: isMobile ? 0 : '0.35rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            {(job.job_name ?? '').trim() || 'Job'} · {jobNumber} · {demandMoney(fields.outstanding)} open
            {propertyKind ? ` · ${propertyKind === 'residential' ? 'residential' : 'commercial'}` : ''}
          </p>
          {timeline ? (
            isMobile ? (
              <>
                <LienWindowFoldedSteps timeline={timeline} />
                {canSetLastWork && !lastWorkOpen ? (
                  <button type="button" data-lien-window-last-work-door onClick={() => setLastWorkOpen(true)} style={{ marginTop: '0.3rem', border: 'none', background: 'none', padding: 0, color: 'var(--text-link)', font: 'inherit', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', minHeight: 32 }}>
                    Change the last day of work ›
                  </button>
                ) : null}
              </>
            ) : (
              <div data-lien-window-timeline style={{ marginTop: '0.6rem', border: '1px solid var(--border)', borderRadius: 9, padding: '0.55rem 0.8rem 0.5rem', background: 'var(--surface)' }}>
                <LienTimelineStrip timeline={timeline} nextDoor={nextStepButton} onChangeLastWork={canSetLastWork && !lastWorkOpen ? () => setLastWorkOpen(true) : undefined} onOpenStep={(s) => setStopOpen(Math.max(0, timeline.steps.findIndex((x) => x.key === s.key)))} />
                {stopOpen != null ? <LienStopPaperWindow steps={timeline.steps} index={stopOpen} onIndex={setStopOpen} onClose={() => setStopOpen(null)} jobLabel={`${jobNumber} · ${(job.job_name ?? '').trim() || 'Job'}`} paperFor={stopPaperFor} timeline={timeline} /> : null}
              </div>
            )
          ) : null}
          {lastWorkOpen && lastWorkJob ? (
            // The All filings line, already editing: Save the day opens the window that shows what moves (v2.4717) before anything is written.
            <div data-lien-window-last-work style={{ marginTop: '0.5rem' }}>
              <LienLastWorkDayLine
                jobId={lastWorkJob.id}
                job={lastWorkJob}
                todayYmd={todayYmdLocal()}
                canEdit={canSetLastWork}
                userId={authUser?.id ?? null}
                onSaved={() => void reReadLastWork()}
                startEditing
                onCancel={() => setLastWorkOpen(false)}
                jobLabel={`${jobNumber} · ${(lastWorkJob.job_name ?? '').trim()}`}
                clockMonths={(windowWorkMonths?.[lastWorkJob.id]?.months ?? []).map((m) => m.key)}
                noticedMonths={[...new Set(filings.filter((f) => f.kind === 'notice_53_056' && f.voided_at == null).flatMap((f) => f.months_covered ?? []))]}
                propertyKind={propertyKind}
              />
            </div>
          ) : null}
          {nextStep && (isMobile || !timeline) ? (
            <div data-lien-window-next-step data-tone={nextStep.tone} style={{ marginTop: isMobile ? '0.4rem' : '0.6rem', border: `1px solid ${nextStep.tone === 'red' ? 'var(--text-red-600)' : 'var(--border-strong)'}`, borderRadius: 9, padding: '0.55rem 0.8rem', background: nextStep.tone === 'red' ? 'var(--bg-red-tint)' : nextStep.tone === 'amber' ? 'var(--bg-amber-tint)' : nextStep.tone === 'green' ? 'var(--bg-green-tint)' : 'var(--bg-subtle)', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 16rem', minWidth: 0 }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  Your next step{nextStep.daysWords ? <span style={{ color: nextStep.tone === 'red' ? 'var(--text-red-600)' : 'var(--text-700)' }}> · {nextStep.daysWords}</span> : null}
                </div>
                <div style={{ fontSize: '0.92rem', fontWeight: 700, marginTop: 2 }}>{nextStep.words}</div>
                {nextStep.waitingWords ? <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>{nextStep.waitingWords}</div> : null}
              </div>
              {nextStepButton}
            </div>
          ) : null}
          {!isMobile && (onOpenRelease || supplierJob) ? (
            // v2.4693: the two single facts as chips on one line; the supply-house card unfolds under Details.
            <div data-lien-window-chips style={{ marginTop: '0.45rem', display: 'flex', gap: '0.4rem 0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              {onOpenRelease ? (
                <span data-lien-window-waivers>
                  <button type="button" onClick={() => onOpenRelease(job)} title="Waivers on the bills are their own paper — the Release of Lien window" style={bandChip}>
                    Waivers are their own paper ›
                  </button>
                </span>
              ) : null}
              {supplierJob ? (
                <button type="button" data-lien-window-supply onClick={() => setBandDetailsOpen((o) => !o)} title={lienSupplierMark(supplierJob)?.title ?? 'Supply houses on this job'} aria-expanded={bandDetailsOpen} style={bandChip}>
                  <span aria-hidden>🏪</span> {lienSupplierMark(supplierJob)?.words ?? 'Supply houses on this job'} ›
                </button>
              ) : null}
              {supplierJob ? (
                <button type="button" data-lien-window-details onClick={() => setBandDetailsOpen((o) => !o)} aria-expanded={bandDetailsOpen} style={{ ...bandChip, marginLeft: 'auto', color: 'var(--text-muted)' }}>
                  Details {bandDetailsOpen ? '∧' : '∨'}
                </button>
              ) : null}
            </div>
          ) : null}
          {isMobile && onOpenRelease ? (
            <div data-lien-window-waivers style={{ marginTop: '0.4rem', fontSize: '0.8125rem', color: 'var(--text-muted)', display: 'flex', gap: '0.4rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
              <span>Waivers on the bills are their own paper.</span>
              <button type="button" onClick={() => onOpenRelease(job)} style={{ border: 'none', background: 'none', padding: 0, color: 'var(--text-link)', fontWeight: 600, cursor: 'pointer', fontSize: '0.8125rem' }}>
                Open Release of Lien ›
              </button>
            </div>
          ) : null}
          {supplierJob && (isMobile || bandDetailsOpen) ? (
            // The header does not scroll, so the opened card scrolls inside its own height and the paper keeps the window.
            <div style={{ marginTop: isMobile ? '0.4rem' : '0.5rem', maxHeight: '42dvh', overflowY: 'auto' }}>
              <LienJobSuppliersCard
                job={supplierJob}
                propertyKind={propertyKind}
                todayYmd={todayYmdLocal()}
                openBalance={Math.max(0, Number(job.revenue ?? 0) - Number(job.payments_made ?? 0))}
                payerName={(job.gcCustomer?.name ?? '').trim() || (job.customer_name ?? '').trim()}
                jobLabel={`${jobNumber} · ${(job.job_name ?? '').trim() || 'Job'}`}
                isMobile={isMobile}
                startFolded={isMobile}
              />
            </div>
          ) : null}
        </div>

        {isMobile ? (
          // The papers as one bar (v2.4398): three fill the width; a fourth (Release of record) makes the bar scroll, its cut edge faded until the end is in view.
          <div style={{ padding: '0.5rem 1rem', borderBottom: '1px solid var(--border)' }}>
            <div
              ref={papersBar.ref}
              role="tablist"
              aria-label="Paper"
              data-lien-window-papers
              onScroll={papersBar.onScroll}
              style={{ display: 'grid', gridAutoFlow: 'column', gridAutoColumns: 'minmax(max-content, 1fr)', minHeight: 40, border: '1px solid var(--border-strong)', borderRadius: 8, overflowX: 'auto', overflowY: 'hidden', ...papersBar.style }}
            >
              {paperTabs.map(([value, label]) => (
                <button key={value} type="button" role="tab" aria-selected={activeTab === value} onClick={() => setActiveTab(value)} style={{ border: 'none', background: activeTab === value ? '#2563eb' : 'var(--surface)', color: activeTab === value ? '#fff' : 'var(--text-700)', font: 'inherit', fontSize: '0.75rem', fontWeight: 600, padding: '0 0.5rem', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        ) : (
        <div style={{ padding: '0.7rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
          {paperTabs.map(([value, label]) => (
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
          <LienRulesDoor where={rulesWhere} style={{ marginLeft: 'auto', padding: '0.35rem 0.75rem', fontSize: '0.8125rem' }} />
        </div>
        )}

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
                        <b>Exhibit {panelLabels.invoices[sources.slice(0, i).filter((src) => src.doc).length]}</b> · {exhibitATitle(st.invoiceNumber, st.sentYmd)}
                      </span>
                      <span style={{ padding: '0.05rem 0.45rem', borderRadius: 999, fontSize: '0.6875rem', fontWeight: 700, background: 'var(--bg-green-tint)', color: 'var(--text-green-700)' }}>always</span>
                    </div>
                  ) : (
                    <div key={`a-${i}`} style={{ color: 'var(--text-muted)' }}>
                      <b>Not enclosed</b> · {st.invoiceNumber} — the bill could not be rendered from this job; open it from Bill Customer and try again
                    </div>
                  ),
                )}
                <label style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center', cursor: signedAgreement ? 'pointer' : 'default', color: signedAgreement ? undefined : 'var(--text-muted)' }}>
                  <span>
                    {panelLabels.agreement ? <><b>Exhibit {panelLabels.agreement}</b> · </> : null}{signedAgreement ? signedAgreement.title : 'Signed agreement — none on this job'}
                  </span>
                  {signedAgreement ? <input type="checkbox" checked={includeAgreement} onChange={(e) => setIncludeAgreement(e.target.checked)} /> : <span style={{ padding: '0.05rem 0.45rem', borderRadius: 999, fontSize: '0.6875rem', fontWeight: 700, background: 'var(--bg-subtle)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>no contract</span>}
                </label>
                <label style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center', cursor: 'pointer' }}>
                  <span>
                    {panelLabels.delivery ? <><b>Exhibit {panelLabels.delivery}</b> · </> : null}Delivery record — {priorNotices.length === 0 ? 'the invoice date only' : `${priorNotices.length} dated send${priorNotices.length === 1 ? '' : 's'} and contact${priorNotices.length === 1 ? '' : 's'}`}
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
              ? toggle('includeLateFees', 'Interest at 1.5 % a month', `Prop. Code § 28.004 — the bill was a written payment request; from ${demandDate(fields.interestFromYmd)}`, lienRuleHref('§ 28.004'))
              : fields.interestBasis === 'legal_rate' && fields.interestFromYmd
                ? toggle('includeLateFees', 'Interest at 6 % a year', `Fin. Code § 302.002 — no rate agreed and the bill was never sent; from ${demandDate(fields.interestFromYmd)}`, lienRuleHref('§ 302.002'))
                : fields.feeClockYmd
                  ? (
                    <label data-demand-interest-none style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8125rem', marginBottom: '0.3rem', cursor: 'not-allowed', opacity: 0.6 }}>
                      <input type="checkbox" checked={false} disabled readOnly />
                      Interest
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.6875rem', fontWeight: 700 }}>not offered — the bill has no sent or due date to run from</span>
                    </label>
                  )
                  : toggle('includeLateFees', 'Late-fees / interest note')}
            {payCodeRows.length > 0
              ? toggle('includePayCodes', 'Pay codes', `${payCodeRows.length === 1 ? 'one code' : `${payCodeRows.length} codes`} under the amount box — each opens that bill's own payment page`)
              : (
                  <label data-demand-pay-codes-none style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8125rem', marginBottom: '0.3rem', cursor: 'not-allowed', opacity: 0.6 }}>
                    <input type="checkbox" checked={false} disabled readOnly />
                    Pay codes
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.6875rem', fontWeight: 700 }}>not offered — no covered bill has a payment page</span>
                  </label>
                )}
            {toggle('includeNotarial', 'Notarial block (certified mail only)')}
          </div>

          {/* Live preview — pinned light like the printed letter. */}
          <div data-theme="light" style={{ flex: '1 1 22rem', minWidth: '19rem', padding: '1.25rem', background: 'var(--bg-subtle)', borderLeft: '1px solid var(--border)' }}>
            {/* The letter as it prints: the print and PDF renderers' own HTML, so the preview cannot drift from the paper. */}
            <div style={{ background: 'var(--surface)', color: 'var(--text-base)', border: '1px solid var(--border)', borderRadius: 4, padding: '1.2rem 1.35rem', fontFamily: "Georgia, 'Times New Roman', serif", fontSize: '0.78rem', lineHeight: 1.65, boxShadow: '0 4px 14px rgba(0,0,0,0.08)', overflowX: 'auto' }} dangerouslySetInnerHTML={{ __html: letterHtml }} />
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
              if (exhibitKind(ex) === 'invoice') {
                const aIndex = (fields.enclosures ?? []).slice(0, i).filter((e) => exhibitKind(e) === 'invoice').length
                const bill = sources.flatMap((src, k) => (src.doc ? [{ doc: src.doc, st: (fields.statement ?? [])[k] }] : []))[aIndex]
                const doc = bill ? (bill.st ? exhibitInvoiceDocument(bill.doc, bill.st) : bill.doc) : null
                return card(doc ? <PhysicalInvoicePreview document={doc} /> : <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{ex.title}</div>)
              }
              if (exhibitKind(ex) === 'agreement') {
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
              <ActionPhaseButton
                action="email-send"
                phase={emailBusy ? 'busy' : 'idle'}
                onClick={() => void emailPacket()}
                disabled={recordBusy}
                busyLabel="Sending…"
                doneLabel="Sent"
                busyBackground="#1d4ed8"
                outlined={false}
                style={{ padding: '0.45rem 0.9rem', fontSize: '0.8125rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}
              >
                Send · {1 + (fields.enclosures ?? []).length} documents
              </ActionPhaseButton>
            </div>
          </div>
        ) : null}
        {recordSheetOpen ? null : recordOpen ? (
          <div data-demand-record-panel style={{ padding: '0.9rem 1.25rem', borderTop: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
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
        ) : isMobile && emailOpen ? null : (
          // The foot. On a phone (v2.4409) the four doors sit in two rows of two and × closes the window, so Cancel is not drawn; while the email panel is open it stands in for this row (it has its own Back and Send).
          <div data-demand-foot style={isMobile ? { padding: '0.6rem 1rem', borderTop: '1px solid var(--border)', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.5rem' } : { padding: '0.9rem 1.25rem', borderTop: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'flex-end' }}>
            {isMobile ? null : (
              <button type="button" onClick={onClose} style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}>
                Cancel
              </button>
            )}
            <ActionPhaseButton action="print" phase={printPhase.phase} onClick={() => void printPhase.run(printLetter)} disabled={pdfBusy} busyLabel="Opening…" doneLabel="Opened" style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', background: 'var(--surface)', border: '1px solid #2563eb', color: 'var(--text-link)', borderRadius: 4, cursor: pdfBusy ? 'wait' : 'pointer', ...phoneFootButton }}>
              Print packet
            </ActionPhaseButton>
            <ActionPhaseButton action="download" phase={downloadPhase.phase} onClick={() => void downloadPhase.run(downloadPdf)} disabled={pdfBusy} busyLabel="Downloading…" doneLabel="Downloaded" style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', background: 'var(--surface)', border: '1px solid #2563eb', color: 'var(--text-link)', borderRadius: 4, cursor: pdfBusy ? 'wait' : 'pointer', ...phoneFootButton }}>
              Download PDF · {1 + (fields.enclosures ?? []).length} documents
            </ActionPhaseButton>
            <ActionPhaseButton
              action="email"
              phase={emailPhase.phase}
              onClick={() => {
                setEmailTo((prev) => prev || fields.recipientEmail.trim())
                setEmailOpen(true)
                setRecordOpen(false)
              }}
              disabled={pdfBusy || emailBusy}
              busyLabel="Sending…"
              doneLabel="Emailed"
              style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', background: 'var(--surface)', border: '1px solid #2563eb', color: 'var(--text-link)', borderRadius: 4, cursor: 'pointer', ...phoneFootButton }}
            >
              Email with the PDF…
            </ActionPhaseButton>
            <button type="button" onClick={() => setRecordOpen(true)} style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', background: '#b45309', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600, ...phoneFootButton }}>
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
            onClose={onClose}
          />
        )}
      </div>
    </div>
  )
}
