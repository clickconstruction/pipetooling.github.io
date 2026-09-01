import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { supabase } from '../../lib/supabase'
import {
  getBillingStripeModePref,
  setBillingStripeModePref,
  stripeModeInvokeBody,
  type BillingStripeModePref,
} from '../../lib/billingStripeModePref'
import { readEdgeFunctionErrorBody } from '../../lib/readEdgeFunctionErrorBody'
import {
  OperationTimeoutError,
  formatErrorMessage,
  withOperationTimeout,
  withSupabaseRetry,
} from '../../utils/errorHandling'
import type {
  StripeInvoiceLinesSnapshot,
  StripeInvoiceLineSource,
  StripeInvoicePreviewSuccess,
} from '../../lib/stripeInvoicePreview'
import {
  parseStripeInvoiceLinesSnapshot,
  parseStripeInvoicePreviewResponse,
} from '../../lib/stripeInvoicePreview'
import {
  buildStripeInvoiceLineDescription,
  STRIPE_INVOICE_LINE_DESCRIPTION_MAX,
} from '../../lib/stripeInvoiceLineDescription'
import {
  fetchStripeInvoiceFooterPresetsFromAppSettings,
  getStripeInvoiceFooterDefaultOnOpen,
  getStripeInvoiceFooterPresetElectrical,
  getStripeInvoiceFooterPresetPlumbing,
  STRIPE_INVOICE_FOOTER_MAX_CHARS,
  stripeInvoiceFooterActivePreset,
} from '../../lib/stripeInvoiceFooter'
import { fetchJobWithDetailsById } from '../../lib/fetchJobWithDetailsById'
import { jobLedgerHasCustomerForBilling } from '../../lib/jobLedgerCustomerForBilling'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import { maybePromoteJobToBilledAfterCustomerInvoice } from '../../lib/promoteJobToBilledIfFullyInvoiced'
import BillCustomerLienReleaseStrip from './BillCustomerLienReleaseStrip'
import { StripeBillPreSubmitPreview } from './StripeBillPreSubmitPreview'
import StripeBillingModeToggle from './StripeBillingModeToggle'
import { HostedStripeBillPanel, type InvoiceWithJobForBillView } from './HostedStripeBillPanel'
import { StripeInvoiceLinesSummary } from './StripeInvoiceLinesSummary'
import { StripeInvoicePreviewMeta } from './StripeInvoicePreviewMeta'
import { StripeInvoiceSharePanel } from './StripeInvoiceSharePanel'
import { StripeInvoiceSendFromStripeButton } from './StripeInvoiceSendFromStripeButton'
import { PhysicalInvoicePreview } from './PhysicalInvoicePreview'
import BillCustomerPreviewLineEditModal, {
  type BillCustomerLineEditSession,
} from './BillCustomerPreviewLineEditModal'
import {
  billableFixtureRefsInOrder,
  billableMaterialRefsInOrder,
  physicalPreviewRowsAreDbBacked,
} from '../../lib/billCustomerPreviewLineRefs'
import {
  buildPhysicalInvoiceDocument,
  buildPhysicalInvoiceEmailBodies,
  formatPhysicalInvoiceLongDateYmd,
  physicalInvoiceEmailSubject,
} from '../../lib/physicalInvoiceDocument'
import { openInvoiceEmailPreviewInNewTab } from '../../lib/openInvoiceEmailPreview'
import { type JobBillingContext } from '../../lib/jobBillingContext'
import { fixturesForInvoiceBill } from '../../lib/invoiceScopedFixtures'
import { buildPhysicalInvoiceDetailFromJob, jobContextForPhysicalDoc } from '../../lib/physicalInvoiceJobContext'
import {
  buildPhysicalInvoicePdfBlob,
  physicalInvoicePdfFilename,
  physicalInvoicePdfToBase64,
} from '../../lib/physicalInvoicePdf'
import {
  hazmatIncidentRowToDraft,
  hazmatNoticeJobInfoFromJob,
  hazmatNoticePublicUrl,
  loadJobHazmatIncidents,
  type JobHazmatIncidentRow,
} from '../../lib/hazmatIncidents'
import { eligibleHazmatRollIns, foldedHazmatFeeLines, hazmatFeeLinesWithinAmount, hazmatRollInTotalDollars, type HazmatRollInLine } from '../../lib/hazmatRollIn'
import {
  applyBillToToJobBillingContext,
  billToDisplayLabel,
  invoiceBillToFromRow,
  type InvoiceBillTo,
} from '../../lib/jobs/invoiceBillTo'
import { isMintedPrimaryDraftStillUntouched } from '../../lib/jobs/mintedPrimaryDraftCleanup'
import { sendHazmatNoticeEmailToCustomer } from '../../lib/sendHazmatNoticeEmail'
import { linkHazmatFeeIncidentToInvoice } from '../../lib/hazmatFeeEdit'
import { buildHazmatNoticeEmailPreviewHtml } from '../../lib/hazmatNoticeEmailPreview'
import { buildHazmatFeeNoticeHtml } from '../../lib/jobsDocuments/hazmatFeeNotice'
import {
  buildHazmatFeeNoticePdfBlob,
  hazmatNoticePdfFilename,
} from '../../lib/jobsDocuments/hazmatFeeNoticePdf'
import {
  fetchPhysicalInvoiceFooterPresetsFromAppSettings,
  getPhysicalInvoiceFooterDefaultOnOpen,
  listPhysicalInvoiceFooterPresets,
  PHYSICAL_INVOICE_FOOTER_MAX_CHARS,
  physicalInvoiceFooterActivePresetId,
  physicalInvoiceFooterSummaryLine,
} from '../../lib/physicalInvoiceFooter'
import {
  BILL_CUSTOMER_MEMO_MAX_CHARS,
  billCustomerMemoActivePresetId,
  billCustomerMemoSummaryLine,
  fetchBillCustomerMemoPresetsFromAppSettings,
  getBillCustomerMemoDefaultOnOpen,
  listBillCustomerMemoPresets,
  type BillCustomerMemoPreset,
} from '../../lib/billCustomerMemoPresets'
import { fetchPhysicalInvoiceIssuerFromAppSettings } from '../../lib/physicalInvoiceIssuer'
import { invoiceDescriptionsNeedLowercaseLeadingHint } from '../../lib/invoiceLineDescriptionLeadingLowercase'
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { SendRecordInvoicePayload } from './SendRecordInvoiceModal.types'

export type { JobBillingContext }
export type { SendRecordInvoicePayload }

type BillCustomerMainTab = 'stripe' | 'housecallpro' | 'physical'

/**
 * Deadlines for the Bill Customer submit round-trips. Retries only fire on
 * failures — a frozen server never settles the fetch, so without these the
 * submit button sticks on its busy state forever (v2.1063 schedule-save hang
 * class). Requests are NOT cancelled by the deadline, so timeout messages
 * say "may or may not". Edge-function bills do real upstream work (Stripe /
 * email with multi-MB PDF payloads) and get proportionally longer deadlines.
 */
const BILL_DB_WRITE_TIMEOUT_MS = 15000
const BILL_STRIPE_INVOKE_TIMEOUT_MS = 30000
const BILL_EMAIL_INVOKE_TIMEOUT_MS = 60000

/** Shared copy shown above Create Stripe invoice / Send email when line wording hits the lowercase-leading check. */
const BILL_CUSTOMER_LEADING_LOWERCASE_HINT =
  'Some line wording starts with a lowercase letter. For many customers this invoice may be their main impression of your company—double-check if that is intentional.'

const BILL_CUSTOMER_LEADING_LOWERCASE_HINT_EL_ID = 'bill-customer-leading-lowercase-hint'

const billCustomerLeadingLowercaseHintParagraphStyle: CSSProperties = {
  margin: '0 0 0.5rem',
  fontSize: '0.8125rem',
  color: 'var(--text-amber-700)',
  lineHeight: 1.35,
}

function billCustomerTopTabButtonStyle(active: boolean): CSSProperties {
  return {
    padding: '0.5rem 0.75rem',
    border: 'none',
    background: active ? '#3b82f6' : 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontWeight: active ? 700 : 400,
    color: active ? 'white' : 'var(--text-muted)',
  }
}

/** Match Edit Job / JobFormModal field styling */
const BILL_CUSTOMER_FIELD_LABEL_STYLE: CSSProperties = {
  display: 'block',
  marginBottom: 4,
  fontWeight: 500,
  fontSize: '0.875rem',
  color: 'var(--text-700)',
}

const BILL_CUSTOMER_CONTROL_STYLE: CSSProperties = {
  width: '100%',
  padding: '0.5rem',
  border: '1px solid var(--border-strong)',
  borderRadius: 4,
  fontSize: '0.875rem',
  boxSizing: 'border-box',
  background: 'var(--surface)',
}

const BILL_CUSTOMER_TEXTAREA_STYLE: CSSProperties = {
  ...BILL_CUSTOMER_CONTROL_STYLE,
  resize: 'vertical',
  lineHeight: 1.4,
  minHeight: '4.25rem',
}

const BILL_CUSTOMER_LINE_ON_BILL_PLACEHOLDER = 'Custom service.'

const BILL_CUSTOMER_LINE_ON_BILL_SUMMARY_MAX = 48

const BILL_CUSTOMER_DISCLOSURE_TOGGLE_STYLE: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '0.5rem',
  width: '100%',
  padding: '0.4rem 0.25rem',
  border: 'none',
  borderRadius: 4,
  background: 'transparent',
  cursor: 'pointer',
  textAlign: 'left',
  font: 'inherit',
  color: 'inherit',
  boxSizing: 'border-box',
}

/** Line item override + Memo + Footer: tighter vertical rhythm than standalone disclosures. */
const BILL_CUSTOMER_MODIFICATIONS_STACK_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
}

/** Stripe + Physical: gray card around invoice modification disclosures. */
const BILL_CUSTOMER_INVOICE_MODIFICATIONS_SHELL_STYLE: CSSProperties = {
  background: 'var(--bg-subtle)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '0.75rem 1rem',
  marginBottom: '0.75rem',
}

const BILL_CUSTOMER_INVOICE_MODIFICATIONS_TITLE_STYLE: CSSProperties = {
  fontSize: '0.875rem',
  fontWeight: 600,
  color: 'var(--text-strong)',
  marginBottom: '0.35rem',
  textAlign: 'center',
}

const BILL_CUSTOMER_PHYSICAL_DATE_LINK_BUTTON_STYLE: CSSProperties = {
  fontSize: '0.875rem',
  color: 'var(--text-link)',
  textDecoration: 'underline',
  textUnderlineOffset: '2px',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: 0,
  font: 'inherit',
  textAlign: 'left',
}

function billCustomerLineOnBillSummaryLine(line: string): string {
  const t = line.replace(/\s+/g, ' ').trim()
  if (!t) return '—'
  if (t.length <= BILL_CUSTOMER_LINE_ON_BILL_SUMMARY_MAX) return t
  return `${t.slice(0, BILL_CUSTOMER_LINE_ON_BILL_SUMMARY_MAX)}…`
}

function todayIsoDate(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function defaultStripeLineDescriptionFromJob(j: JobBillingContext): string {
  return buildStripeInvoiceLineDescription(
    (j.customer_name ?? '').trim() || 'Customer',
    j.job_name,
    j.hcp_number,
  )
}

/** Matches Edge `buildStripeInvoiceItemsFromFixtures` billable rows (Specific Work on the job). */
function jobHasBillableStripeSpecificWorkFixtures(
  fixtures:
    | Array<{
        name: string | null
        count: number | null
        line_unit_price: number | null
      }>
    | undefined
    | null,
): boolean {
  if (!fixtures?.length) return false
  for (const row of fixtures) {
    if (!(row.name ?? '').trim()) continue
    const c = Number(row.count)
    const qty = Number.isFinite(c) && c > 0 ? c : 1
    const unit =
      row.line_unit_price != null && Number.isFinite(Number(row.line_unit_price))
        ? Number(row.line_unit_price)
        : 0
    const dollars = qty * unit
    if (Number.isFinite(dollars) && dollars > 0) return true
  }
  return false
}

function stripeInvoiceFooterSummaryLine(
  footer: string,
  activePreset: ReturnType<typeof stripeInvoiceFooterActivePreset>,
): string {
  if (footer === '') return 'Stripe default'
  if (activePreset === 'plumbing') return 'Plumbing'
  if (activePreset === 'electrical') return 'Electrical'
  return 'Custom'
}

function BillCustomerMemoPresetRow({
  presets,
  valueForHighlight,
  onApplyBoth,
}: {
  presets: BillCustomerMemoPreset[]
  valueForHighlight: string
  onApplyBoth: (body: string) => void
}) {
  const activeId = billCustomerMemoActivePresetId(valueForHighlight)
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.35rem',
        alignItems: 'center',
        marginBottom: '0.35rem',
      }}
    >
      {presets.map((p) => {
        const pressed = activeId === p.id
        return (
          <button
            key={p.id}
            type="button"
            aria-pressed={pressed}
            onClick={() => {
              if (pressed) {
                onApplyBoth('')
                return
              }
              onApplyBoth(p.body)
            }}
            title={`${p.label} memo (click again to clear)`}
            style={{
              padding: '0.25rem 0.5rem',
              fontSize: '0.75rem',
              border: pressed ? '2px solid #2563eb' : '1px solid var(--border-strong)',
              borderRadius: 4,
              background: pressed ? 'var(--bg-blue-tint)' : 'var(--bg-subtle)',
              color: 'var(--text-700)',
              cursor: 'pointer',
              fontWeight: pressed ? 600 : 500,
            }}
          >
            {p.label}
          </button>
        )
      })}
      <button
        type="button"
        onClick={() => onApplyBoth('')}
        style={{
          padding: '0.25rem 0.5rem',
          fontSize: '0.75rem',
          border: '1px solid var(--border-strong)',
          borderRadius: 4,
          background: 'var(--surface)',
          color: 'var(--text-muted)',
          cursor: 'pointer',
        }}
      >
        Clear
      </button>
    </div>
  )
}

type CreateStripeInvoiceFnResponse = {
  success?: boolean
  idempotent?: boolean
  error?: string
  stripe_invoice_id?: string
  hosted_invoice_url?: string
  stripe_invoice_status?: string
  invoice_preview?: unknown
}

/** Bill Customer — Stripe hosted invoice, or HouseCall Pro / Physical invoice (external send). */
export default function SendRecordInvoiceModal({
  payload,
  onClose,
  onSuccess,
  onAfterEnsureSuccess,
  onAfterOobUnwindSuccess,
  jobUpdating,
  invoiceUpdating,
  overlayZIndex = 60,
}: {
  payload: SendRecordInvoicePayload | null
  onClose: () => void
  onSuccess: () => Promise<void>
  onAfterEnsureSuccess?: () => void | Promise<void>
  onAfterOobUnwindSuccess?: () => void | Promise<void>
  jobUpdating: boolean
  invoiceUpdating: boolean
  /** Use &gt; JobFormModal (1010) when opened from Edit Job */
  overlayZIndex?: number
}) {
  const onAfterEnsureSuccessRef = useRef(onAfterEnsureSuccess)
  onAfterEnsureSuccessRef.current = onAfterEnsureSuccess
  const onAfterOobUnwindSuccessRef = useRef(onAfterOobUnwindSuccess)
  onAfterOobUnwindSuccessRef.current = onAfterOobUnwindSuccess

  const { role: authRole } = useAuth()
  const { showToast } = useToastContext()

  const [tab, setTab] = useState<BillCustomerMainTab>('stripe')
  /**
   * v2.1531: HouseCall Pro is deliberately tucked behind a caret — Stripe bill and
   * Physical invoice are the two primary choices; the ▾ reveals the HCP tab for
   * the rare job that still needs it (owner request: keep it, but further away).
   */
  const [hcpTabRevealed, setHcpTabRevealed] = useState(false)
  const [sentDate, setSentDate] = useState(todayIsoDate)
  const [externalNote, setExternalNote] = useState('')
  const [billAmountStr, setBillAmountStr] = useState('')
  const [outsideError, setOutsideError] = useState<string | null>(null)
  const [outsideSubmitting, setOutsideSubmitting] = useState(false)
  const [physicalSubmitting, setPhysicalSubmitting] = useState(false)
  const [physicalPdfPreviewLoading, setPhysicalPdfPreviewLoading] = useState(false)
  const [physicalError, setPhysicalError] = useState<string | null>(null)
  /** Full job row for physical invoice line items + payments (same fetch as Stripe fixture multiline). */
  const [billCustomerJobDetails, setBillCustomerJobDetails] = useState<JobWithDetails | null>(null)

  const [ensuredInvoice, setEnsuredInvoice] = useState<{ jobId: string; id: string; amount: number } | null>(null)
  const [ensureError, setEnsureError] = useState<string | null>(null)
  const [ensureLoading, setEnsureLoading] = useState(false)
  /** Set when THIS open's ensure INSERTed the primary draft (`created: true`) — the cancel-leak guard's memory. */
  const mintedPrimaryDraftRef = useRef<{ jobId: string; invoiceId: string } | null>(null)
  /** Job id the modal is currently open for (kind:'job'), so a late cleanup never deletes a row a re-open is using. */
  const openJobIdRef = useRef<string | null>(null)

  const [stripeDueDate, setStripeDueDate] = useState(todayIsoDate)
  const [editDueDateOpen, setEditDueDateOpen] = useState(false)
  const [draftDueYmd, setDraftDueYmd] = useState('')
  const [draftServiceYmd, setDraftServiceYmd] = useState('')
  const [stripeLineDescription, setStripeLineDescription] = useState('')
  /** True when the job has Specific Work rows that become multiple Stripe lines unless line description overrides. */
  const [stripeFixtureMultiLineAvailable, setStripeFixtureMultiLineAvailable] = useState<boolean | null>(null)
  const [stripeMemo, setStripeMemo] = useState('')
  const [stripeInvoiceFooter, setStripeInvoiceFooter] = useState(() => getStripeInvoiceFooterDefaultOnOpen())
  const [stripeFooterSectionOpen, setStripeFooterSectionOpen] = useState(false)
  const [lineOnBillSectionOpen, setLineOnBillSectionOpen] = useState(false)
  const [memoSectionOpen, setMemoSectionOpen] = useState(false)
  const [physicalInvoiceFooter, setPhysicalInvoiceFooter] = useState(() => getPhysicalInvoiceFooterDefaultOnOpen())
  const [physicalFooterPresetsGeneration, setPhysicalFooterPresetsGeneration] = useState(0)
  const [billCustomerMemoPresetsGeneration, setBillCustomerMemoPresetsGeneration] = useState(0)
  const [physicalFooterSectionOpen, setPhysicalFooterSectionOpen] = useState(false)
  const [stripeSubmitting, setStripeSubmitting] = useState(false)
  const [stripeError, setStripeError] = useState<string | null>(null)
  const [stripeResult, setStripeResult] = useState<{
    hosted_invoice_url: string
    stripe_invoice_id: string
    stripe_invoice_status: string | null
    idempotent?: boolean
    invoice_preview: StripeInvoiceLinesSnapshot | null
  } | null>(null)
  const [stripeSuccessInvoice, setStripeSuccessInvoice] = useState<InvoiceWithJobForBillView | null>(null)
  const stripeSuccessInvoiceRef = useRef<InvoiceWithJobForBillView | null>(null)
  stripeSuccessInvoiceRef.current = stripeSuccessInvoice

  const [stripePreview, setStripePreview] = useState<StripeInvoicePreviewSuccess | null>(null)
  const [stripePreviewLoading, setStripePreviewLoading] = useState(false)
  const [stripePreviewError, setStripePreviewError] = useState<string | null>(null)
  /** Set when the invoice being billed is a hazmat rider — offers attaching the notice. */
  const [hazmatIncidentForInvoice, setHazmatIncidentForInvoice] = useState<JobHazmatIncidentRow | null>(null)
  // v2.1028 folded fees: incidents whose fee is ALREADY inside this primary
  // bill's amount — split out as labeled line items at billing time.
  const [foldedFeeLines, setFoldedFeeLines] = useState<HazmatRollInLine[]>([])
  const [foldedFeeIncidents, setFoldedFeeIncidents] = useState<JobHazmatIncidentRow[]>([])
  const [attachHazmatNotice, setAttachHazmatNotice] = useState(true)
  /** Stripe path: Stripe invoices can't carry attachments — companion email instead. */
  const [emailHazmatNoticeWithStripe, setEmailHazmatNoticeWithStripe] = useState(false)
  /** v2.1002: unsent hazmat rider invoices on this job, offered for roll-in as labeled line items. */
  const [hazmatRollInLines, setHazmatRollInLines] = useState<HazmatRollInLine[]>([])
  const [includeHazmatRollIn, setIncludeHazmatRollIn] = useState(true)
  const [hazmatNoticeEmailStatus, setHazmatNoticeEmailStatus] = useState<'sent' | string | null>(null)
  const [noticeEmailBusy, setNoticeEmailBusy] = useState(false)

  // "Email the notice now" on the success screen (v2.1039): the checkbox no
  // longer defaults to on, so this is the one-click catch-up for the fee
  // notices that rode this bill. Same sender the checkbox path uses.
  const emailNoticeNow = async () => {
    if (!job) return
    const incidents = hazmatIncidentForInvoice ? [hazmatIncidentForInvoice] : foldedFeeIncidents
    const email = (job.customer_email ?? '').trim()
    if (incidents.length === 0 || !email) return
    setNoticeEmailBusy(true)
    try {
      let status: string = 'sent'
      for (const incident of incidents) {
        const res = await sendHazmatNoticeEmailToCustomer({
          jobId: job.id,
          incident,
          jobInfo: hazmatNoticeJobInfoFromJob(job),
          customerEmail: email,
          invoiceReference: `Stripe invoice for job ${(job.hcp_number ?? '').trim() || (job.click_number ?? '').trim() || job.job_name}`,
        })
        if (!res.ok) status = res.error ?? 'Notice email failed'
      }
      setHazmatNoticeEmailStatus(status)
    } finally {
      setNoticeEmailBusy(false)
    }
  }
  const stripePreviewReqId = useRef(0)
  /** Keeps last known “had a preview” for stale-while-revalidate (timeout closure reads current value). */
  const stripePreviewExistsRef = useRef(false)
  const [stripeModePref, setStripeModePref] = useState<BillingStripeModePref>(() => getBillingStripeModePref())
  const stripeModeForBilling: BillingStripeModePref = authRole === 'dev' ? stripeModePref : 'live'

  const open = payload !== null
  const kind = payload?.kind ?? 'job'
  const jobRaw = payload?.job ?? null
  /** Inline email fix (v2.936): a just-saved email overlays the payload so every
      gate and send in this modal sees it immediately — no reopen needed. */
  const [emailOverride, setEmailOverride] = useState<string | null>(null)
  const [emailFixDraft, setEmailFixDraft] = useState('')
  const [emailFixAlsoCustomer, setEmailFixAlsoCustomer] = useState(true)
  const [emailFixSaving, setEmailFixSaving] = useState(false)
  const [emailFixError, setEmailFixError] = useState<string | null>(null)
  /** Per-invoice Bill-to override (v2.1086): when the billing target invoice
      has bill_to_email, overlay the alternate recipient onto the job context —
      every gate, preview payload, physical prefill, and notice send downstream
      sees the tenant instead of the job customer. Server-side the edge
      functions read the invoice row themselves (v2.1085); this overlay keeps
      the UI honest about who gets billed. */
  const [billToOverride, setBillToOverride] = useState<InvoiceBillTo | null>(null)
  const jobWithBillTo = jobRaw ? applyBillToToJobBillingContext(jobRaw, billToOverride) : jobRaw
  const job = jobWithBillTo && emailOverride ? { ...jobWithBillTo, customer_email: emailOverride } : jobWithBillTo
  useEffect(() => {
    setEmailOverride(null)
    setEmailFixDraft('')
    setEmailFixAlsoCustomer(true)
    setEmailFixError(null)
  }, [open, jobRaw?.id])

  /** Customer contact persons with emails (v2.940): offered as extra recipients on the
      physical-invoice email — one send, extra addresses in the same email's `to`. */
  const [customerContacts, setCustomerContacts] = useState<Array<{ id: string; name: string; email: string }>>([])
  const [extraRecipientIds, setExtraRecipientIds] = useState<Set<string>>(() => new Set())
  const [oneOffEmail, setOneOffEmail] = useState('')
  useEffect(() => {
    setExtraRecipientIds(new Set())
    setOneOffEmail('')
    if (!open || !jobRaw?.customer_id) {
      setCustomerContacts([])
      return
    }
    let cancelled = false
    void supabase
      .from('customer_contact_persons')
      .select('id, name, email')
      .eq('customer_id', jobRaw.customer_id)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (cancelled) return
        setCustomerContacts(
          ((data ?? []) as Array<{ id: string; name: string | null; email: string | null }>)
            .filter((c) => (c.email ?? '').trim())
            .map((c) => ({ id: c.id, name: (c.name ?? '').trim() || 'Contact', email: (c.email ?? '').trim() })),
        )
      })
    return () => {
      cancelled = true
    }
  }, [open, jobRaw?.customer_id])

  function physicalAdditionalEmails(): string[] {
    // Bill-to override: the customer's contact persons must not ride on an
    // invoice that bills someone else (e.g. a tenant). One-off extras still
    // allowed — the office typed those deliberately.
    const out: string[] = []
    if (!billToOverride) {
      for (const c of customerContacts) {
        if (extraRecipientIds.has(c.id) && !out.includes(c.email.toLowerCase())) out.push(c.email.toLowerCase())
      }
    }
    const oneOff = oneOffEmail.trim().toLowerCase()
    if (oneOff && oneOff.includes('@') && !out.includes(oneOff)) out.push(oneOff)
    return out.slice(0, 10)
  }

  async function saveMissingCustomerEmail() {
    if (!jobRaw || emailFixSaving) return
    const email = emailFixDraft.trim()
    if (!email || !email.includes('@')) {
      setEmailFixError('Enter a valid email address.')
      return
    }
    setEmailFixSaving(true)
    setEmailFixError(null)
    const { error } = await supabase.from('jobs_ledger').update({ customer_email: email }).eq('id', jobRaw.id)
    if (error) {
      setEmailFixSaving(false)
      setEmailFixError(error.message)
      return
    }
    // Best-effort: also fill the customer record's email when it's blank.
    if (emailFixAlsoCustomer && jobRaw.customer_id) {
      try {
        const { data: cust } = await supabase
          .from('customers')
          .select('contact_info')
          .eq('id', jobRaw.customer_id)
          .maybeSingle()
        const ci =
          cust?.contact_info && typeof cust.contact_info === 'object' && !Array.isArray(cust.contact_info)
            ? (cust.contact_info as Record<string, unknown>)
            : {}
        const existing = typeof ci.email === 'string' ? ci.email.trim() : ''
        if (!existing) {
          await supabase
            .from('customers')
            .update({ contact_info: { ...ci, email } as never })
            .eq('id', jobRaw.customer_id)
        }
      } catch {
        // job-level email saved; customer fill is a bonus
      }
    }
    setEmailFixSaving(false)
    setEmailOverride(email)
  }
  const invoice = payload?.kind === 'invoice' ? payload.invoice : null
  // A stored memo (e.g. Turnaway trip charges) beats the preset default on open.
  const storedInvoiceMemo = (invoice?.stripe_invoice_memo ?? '').trim()

  // Bill-to override loader (v2.1086): the invoice ROW is authoritative for
  // the recipient — openers' payloads don't carry it. Refetches whenever the
  // billing target changes (incl. the ensured primary for kind:'job').
  const billToTargetInvoiceId = kind === 'invoice' ? invoice?.id ?? null : ensuredInvoice?.id ?? null
  useEffect(() => {
    setBillToOverride(null)
    if (!open || !billToTargetInvoiceId) return
    let cancelled = false
    void (async () => {
      try {
        const { data } = await supabase
          .from('jobs_ledger_invoices')
          .select('bill_to_name, bill_to_email, bill_to_phone')
          .eq('id', billToTargetInvoiceId)
          .maybeSingle()
        if (cancelled) return
        setBillToOverride(invoiceBillToFromRow(data))
      } catch {
        if (!cancelled) setBillToOverride(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, billToTargetInvoiceId])

  const handleHostedStripeOobUnwindSuccess = useCallback(async () => {
    const invSnap = stripeSuccessInvoiceRef.current
    const jobId = job?.id ?? null
    if (jobId && invSnap) {
      const fresh = await fetchJobWithDetailsById(jobId)
      const row = fresh?.invoices?.find((i) => i.id === invSnap.id)
      if (fresh && row) setStripeSuccessInvoice({ ...row, job: fresh })
    }
    await onAfterOobUnwindSuccessRef.current?.()
  }, [job?.id])

  const handleAfterVoidStripeInvoiceSuccess = useCallback(async () => {
    await onSuccess()
    onClose()
  }, [onSuccess, onClose])

  const activeStripeFooterPreset = stripeInvoiceFooterActivePreset(stripeInvoiceFooter)
  const physicalFooterPresets = useMemo(() => listPhysicalInvoiceFooterPresets(), [open, physicalFooterPresetsGeneration])
  const memoPresets = useMemo(() => listBillCustomerMemoPresets(), [open, billCustomerMemoPresetsGeneration])

  const applyMemoPresetToBoth = useCallback((body: string) => {
    const b = body.slice(0, BILL_CUSTOMER_MEMO_MAX_CHARS)
    setExternalNote(b)
    setStripeMemo(b)
  }, [])

  useLayoutEffect(() => {
    if (!open) {
      stripePreviewExistsRef.current = false
      return
    }
    stripePreviewExistsRef.current = stripePreview != null
  }, [open, stripePreview])

  useEffect(() => {
    if (!open) {
      setEnsuredInvoice(null)
      setEnsureError(null)
      setEnsureLoading(false)
      setPhysicalPdfPreviewLoading(false)
      setBillCustomerJobDetails(null)
      return
    }
    if (!job) return
    // Always open on Stripe (v2.1531) — even with no customer email, the
    // missing-email banner above the tabs explains and fixes it inline.
    // (Previously no-email jobs landed on HouseCall Pro first.)
    setTab('stripe')
    setHcpTabRevealed(false)
    const billCustomerOpenYmd = todayIsoDate()
    setSentDate(billCustomerOpenYmd)
    setStripeDueDate(billCustomerOpenYmd)
    const memoDefault = storedInvoiceMemo || getBillCustomerMemoDefaultOnOpen()
    setExternalNote(memoDefault)
    setOutsideError(null)
    setOutsideSubmitting(false)
    setPhysicalSubmitting(false)
    setPhysicalPdfPreviewLoading(false)
    setPhysicalError(null)
    setEnsuredInvoice(null)
    setEnsureError(null)
    setEnsureLoading(false)
    setEditDueDateOpen(false)
    setDraftDueYmd('')
    setDraftServiceYmd('')
    // Empty until fixtures load: billable Specific Work must omit line_description for
    // multi-line Stripe items. Exception: non-primary rows with a stored memo (standalone
    // charges like Turnaway trip charges) pre-fill it, forcing one clean Stripe line.
    setStripeLineDescription(
      storedInvoiceMemo && invoice?.is_primary_rtb_bundle === false ? storedInvoiceMemo : '',
    )
    setStripeMemo(memoDefault)
    setStripeInvoiceFooter(getStripeInvoiceFooterDefaultOnOpen())
    setStripeFooterSectionOpen(false)
    setLineOnBillSectionOpen(false)
    setMemoSectionOpen(false)
    setPhysicalInvoiceFooter(getPhysicalInvoiceFooterDefaultOnOpen())
    setPhysicalFooterSectionOpen(false)
    setStripeSubmitting(false)
    setStripeError(null)
    setStripeResult(null)
    setStripeSuccessInvoice(null)
    setStripePreview(null)
    setStripePreviewLoading(false)
    setStripePreviewError(null)
    setStripeModePref(getBillingStripeModePref())
    if (invoice) {
      setBillAmountStr(String(Number(invoice.amount)))
    } else {
      setBillAmountStr('')
    }
    setStripeFixtureMultiLineAvailable(null)
  }, [open, job?.id, job?.customer_email, invoice?.id])

  // Hazmat detection for the invoice being billed. Two shapes (v2.1028):
  // - PRIMARY bill with linked incidents → folded fees: the amounts are already
  //   inside this bill; split each out as its own labeled line item at billing
  //   time (Stripe extra_line_items / physical PDF fee rows) + notice flows.
  // - NON-primary linked invoice → legacy rider: the whole invoice IS the fee;
  //   keep the separate-notice flow unchanged.
  useEffect(() => {
    setHazmatIncidentForInvoice(null)
    setFoldedFeeLines([])
    setFoldedFeeIncidents([])
    setAttachHazmatNotice(true)
    // Deliberately unchecked (v2.1039): the office sends the notice email when
    // they choose to — from here or after the fact from Edit Job's RIDERS row.
    setEmailHazmatNoticeWithStripe(false)
    setHazmatNoticeEmailStatus(null)
    if (!open || kind !== 'invoice' || !invoice?.id || !job?.id) return
    let cancelled = false
    void (async () => {
      try {
        const allRows = await loadJobHazmatIncidents(job.id)
        if (cancelled) return
        // Voided fees (v2.1038) have no financial effect and send no notice.
        const rows = allRows.filter((r) => !r.voided_at)
        const linked = rows.filter((r) => r.invoice_id === invoice.id)
        const anyUnlinked = rows.some((r) => !(r.invoice_id ?? '').trim())
        if (linked.length === 0 && !anyUnlinked) return
        // Not every opener's invoice payload carries is_primary_rtb_bundle —
        // fetch the flag so classification never silently degrades.
        let isPrimary = invoice.is_primary_rtb_bundle === true
        if (invoice.is_primary_rtb_bundle == null) {
          const { data: invRow } = await supabase
            .from('jobs_ledger_invoices')
            .select('is_primary_rtb_bundle')
            .eq('id', invoice.id)
            .maybeSingle()
          if (cancelled) return
          isPrimary = (invRow as { is_primary_rtb_bundle?: boolean | null } | null)?.is_primary_rtb_bundle === true
        }
        // v2.1035 job-total incidents: the auto-maintained primary equals the
        // job's full unallocated remainder (revenue − payments − other bills),
        // and the fee bumped revenue at creation — so this bill's amount
        // ALREADY carries the fee. Split it out as a labeled line (inside the
        // amount) and repoint on success. (v2.1033 briefly added it on top,
        // which double-counted once the primary auto-repriced.)
        const unlinked = isPrimary ? rows.filter((r) => !(r.invoice_id ?? '').trim()) : []
        if (linked.length === 0 && unlinked.length === 0) return
        if (isPrimary) {
          const folded = [...linked, ...unlinked]
          setFoldedFeeIncidents(folded)
          setFoldedFeeLines(
            foldedHazmatFeeLines({
              billingInvoice: { id: invoice.id, is_primary_rtb_bundle: true },
              incidents: folded,
            }),
          )
        } else {
          setHazmatIncidentForInvoice(linked[0] ?? null)
        }
        // Stripe carries no attachments — put the public notice link(s) in the
        // footer (visible + editable in the Footer disclosure before sending).
        for (const found of [...linked, ...unlinked]) {
          if (!found.public_token) continue
          const noticeLine = `Biohazard Remediation Fee Notice: ${hazmatNoticePublicUrl(found.public_token)}`
          setStripeInvoiceFooter((f) => {
            if (f.includes(hazmatNoticePublicUrl(found.public_token!))) return f
            const next = f.trim().length > 0 ? `${f.trimEnd()}\n\n${noticeLine}` : noticeLine
            return next.length <= STRIPE_INVOICE_FOOTER_MAX_CHARS ? next : f
          })
          if (!isPrimary) break
        }
      } catch {
        if (!cancelled) {
          setHazmatIncidentForInvoice(null)
          setFoldedFeeLines([])
          setFoldedFeeIncidents([])
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, kind, invoice?.id, invoice?.is_primary_rtb_bundle, job?.id])

  // v2.1002 hazmat roll-in: when this job has OTHER unsent hazmat rider
  // invoices, offer (default ON) folding them into this bill as their own
  // labeled Stripe line items instead of separate rider invoices.
  useEffect(() => {
    setHazmatRollInLines([])
    setIncludeHazmatRollIn(true)
    if (!open || !job?.id) return
    let cancelled = false
    void (async () => {
      try {
        const rows = await loadJobHazmatIncidents(job.id)
        if (cancelled || rows.length === 0) return
        const billingId = kind === 'invoice' ? invoice?.id ?? '' : ''
        const riderIds = [
          ...new Set(rows.map((r) => r.invoice_id).filter((id): id is string => !!id && id !== billingId)),
        ]
        if (riderIds.length === 0) return
        const { data: invRows } = await supabase
          .from('jobs_ledger_invoices')
          .select('id, amount, status, stripe_invoice_id, sent_to_customer_at, external_send_channel, bill_to_email')
          .in('id', riderIds)
        if (cancelled) return
        const lines = eligibleHazmatRollIns({
          billingInvoiceId: billingId,
          incidents: rows,
          invoices: (invRows ?? []) as {
            id: string
            amount: number | null
            status: string | null
            stripe_invoice_id: string | null
            sent_to_customer_at: string | null
            external_send_channel: string | null
            bill_to_email: string | null
          }[],
        })
        setHazmatRollInLines(lines)
        // Same footer treatment as billing a rider directly: the public notice
        // link rides in the footer (Stripe can't attach files).
        for (const line of lines) {
          const incident = rows.find((r) => r.id === line.incidentId)
          if (!incident?.public_token) continue
          const noticeLine = `Biohazard Remediation Fee Notice: ${hazmatNoticePublicUrl(incident.public_token)}`
          setStripeInvoiceFooter((f) => {
            if (f.includes('/hazmat-notice?token=')) return f
            const next = f.trim().length > 0 ? `${f.trimEnd()}\n\n${noticeLine}` : noticeLine
            return next.length <= STRIPE_INVOICE_FOOTER_MAX_CHARS ? next : f
          })
        }
      } catch {
        if (!cancelled) setHazmatRollInLines([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, kind, invoice?.id, job?.id])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void (async () => {
      await Promise.all([
        fetchPhysicalInvoiceFooterPresetsFromAppSettings({ authRole }),
        fetchStripeInvoiceFooterPresetsFromAppSettings({ authRole }),
        fetchBillCustomerMemoPresetsFromAppSettings({ authRole }),
        fetchPhysicalInvoiceIssuerFromAppSettings({ authRole }),
      ])
      if (cancelled) return
      setPhysicalFooterPresetsGeneration((g) => g + 1)
      setPhysicalInvoiceFooter(getPhysicalInvoiceFooterDefaultOnOpen())
      setStripeInvoiceFooter(getStripeInvoiceFooterDefaultOnOpen())
      setBillCustomerMemoPresetsGeneration((g) => g + 1)
      const memoDefaultAfterFetch = storedInvoiceMemo || getBillCustomerMemoDefaultOnOpen()
      setExternalNote(memoDefaultAfterFetch)
      setStripeMemo(memoDefaultAfterFetch)
    })()
    return () => {
      cancelled = true
    }
  }, [open, authRole])

  useEffect(() => {
    if (!open || !job?.id) {
      setStripeFixtureMultiLineAvailable(null)
      setBillCustomerJobDetails(null)
      return
    }
    let cancelled = false
    void (async () => {
      const fresh = await fetchJobWithDetailsById(job.id)
      if (cancelled) return
      setBillCustomerJobDetails(fresh)
      // v2.1133: a segment invoice's multi-line availability considers only its
      // OWN linked line items (kind 'job' bills the unlinked remainder — the
      // scoping helper falls back to the full list there).
      const billable = jobHasBillableStripeSpecificWorkFixtures(
        fixturesForInvoiceBill(fresh?.fixtures, kind === 'invoice' ? invoice?.id ?? null : null),
      )
      setStripeFixtureMultiLineAvailable(billable)
    })()
    return () => {
      cancelled = true
    }
  }, [open, job?.id, kind, invoice?.id])

  // v2.2464 cancel-leak guard: when THIS open's ensure MINTED the primary
  // draft and the modal closes with the row still exactly as the mint left it
  // (no Stripe object, never sent/billed, no outside-send record, no bill-to
  // override, no payment), delete it again. Opening Bill Customer and backing
  // out must not permanently plant the full-remainder "auto" draft — that is
  // what seeded job 978's confusion. Best-effort: on any doubt, keep the row
  // (a kept draft resizes/deletes on the next remainder resync anyway).
  const cleanupMintedPrimaryDraft = useCallback(async () => {
    const minted = mintedPrimaryDraftRef.current
    if (!minted) return
    // A fast close→reopen of the same job reuses the same primary row (the
    // reopen's ensure finds it, created:false) — a late cleanup from the
    // first open must not delete it out from under the live modal.
    if (openJobIdRef.current === minted.jobId) return
    mintedPrimaryDraftRef.current = null
    try {
      const rowRes = await supabase
        .from('jobs_ledger_invoices')
        .select(
          'status, is_primary_rtb_bundle, stripe_invoice_id, stripe_invoice_status, hosted_invoice_url, sent_to_customer_at, billed_at, external_send_channel, bill_to_name, bill_to_email, bill_to_phone, bill_to_stripe_customer_id',
        )
        .eq('id', minted.invoiceId)
        .maybeSingle()
      if (rowRes.error) return
      const payRes = await supabase
        .from('jobs_ledger_payments')
        .select('id', { count: 'exact', head: true })
        .eq('invoice_id', minted.invoiceId)
      if (payRes.error) return
      if (!isMintedPrimaryDraftStillUntouched(rowRes.data, payRes.count ?? 0)) return
      const del = await supabase.rpc('delete_ready_to_bill_invoice', { p_invoice_id: minted.invoiceId })
      const delOk = (del.data as { ok?: boolean } | null)?.ok === true
      if (del.error || !delOk) return
      try {
        await onAfterEnsureSuccessRef.current?.()
      } catch {
        /* ignore */
      }
    } catch {
      /* best-effort — never surface cleanup noise over a routine close */
    }
  }, [])

  useEffect(() => {
    openJobIdRef.current = open && kind === 'job' ? (job?.id ?? null) : null
    if (!open) void cleanupMintedPrimaryDraft()
    // Cleared here (declared before the unmount effect below, so this runs
    // first) so the unmount cleanup isn't blocked by the open-job guard.
    return () => {
      openJobIdRef.current = null
    }
  }, [open, kind, job?.id, cleanupMintedPrimaryDraft])

  // Provider teardown / route change while open: same guard on unmount.
  useEffect(
    () => () => {
      void cleanupMintedPrimaryDraft()
    },
    [cleanupMintedPrimaryDraft],
  )

  // Ensure primary RTB line when opening for a job row (shared for Outside submit).
  useEffect(() => {
    if (!open || !job?.id || kind !== 'job') return
    if (ensuredInvoice?.jobId === job.id) return
    // Payload swapped to another job while open: settle the previous job's
    // minted draft before this job can record its own.
    if (mintedPrimaryDraftRef.current && mintedPrimaryDraftRef.current.jobId !== job.id) {
      void cleanupMintedPrimaryDraft()
    }

    let cancelled = false
    setEnsureLoading(true)
    setEnsureError(null)

    void (async () => {
      try {
        const raw = await withSupabaseRetry(
          async () =>
            await supabase.rpc('ensure_single_ready_to_bill_invoice_for_job', {
              p_job_id: job.id,
            }),
          'ensure RTB invoice for Bill Customer'
        )
        const obj = raw as Record<string, unknown> | null
        // Record a mint BEFORE the cancelled bail-out — the row exists
        // server-side either way, and the close cleanup must know about it.
        if (obj?.ok === true && obj.created === true && typeof obj.invoice_id === 'string') {
          mintedPrimaryDraftRef.current = { jobId: job.id, invoiceId: obj.invoice_id }
        }
        if (cancelled) {
          // Modal closed (or moved on) while the ensure was in flight — the
          // close-time cleanup ran before the mint was recorded, so settle it
          // now.
          void cleanupMintedPrimaryDraft()
          return
        }
        if (obj && typeof obj.error === 'string' && obj.error.length > 0) {
          setEnsuredInvoice(null)
          setEnsureError(obj.error)
          return
        }
        // Post-fix RPC: fully allocated with no primary to bill returns ok
        // without an invoice — same dead-end as the old "nothing left" error,
        // said plainly.
        if (obj?.ok === true && obj.fully_allocated === true) {
          setEnsuredInvoice(null)
          setEnsureError('Nothing left to bill for this job — every dollar is already on an invoice.')
          return
        }
        if (obj?.ok === true && typeof obj.invoice_id === 'string') {
          const rawAmt = obj.amount
          const amt =
            typeof rawAmt === 'number' ? rawAmt : typeof rawAmt === 'string' ? Number(rawAmt) : NaN
          if (!Number.isFinite(amt)) {
            setEnsuredInvoice(null)
            setEnsureError('Unexpected response from server')
            return
          }
          setEnsuredInvoice({ jobId: job.id, id: obj.invoice_id, amount: amt })
          setBillAmountStr(String(amt))
          setEnsureError(null)
          try {
            await onAfterEnsureSuccessRef.current?.()
          } catch {
            /* ignore */
          }
        } else {
          setEnsuredInvoice(null)
          setEnsureError('Unexpected response from server')
        }
      } catch (e) {
        if (cancelled) return
        setEnsuredInvoice(null)
        setEnsureError(e instanceof Error ? e.message : 'Failed to ensure invoice')
      } finally {
        if (!cancelled) setEnsureLoading(false)
      }
    })()

    return () => {
      cancelled = true
      setEnsureLoading(false)
    }
  }, [open, job?.id, kind])

  useEffect(() => {
    if (!open || !job || tab !== 'stripe' || stripeResult || stripeSuccessInvoice) {
      return
    }

    const amt = Number(billAmountStr)
    const invId = kind === 'invoice' ? invoice?.id : ensuredInvoice?.id
    const outsideReadyForPreview =
      kind === 'invoice'
        ? invoice != null
        : kind === 'job' && ensuredInvoice != null && !ensureLoading && !ensureError

    const canPreview =
      jobLedgerHasCustomerForBilling(job.customer_id) &&
      (job.customer_email ?? '').trim().length > 0 &&
      Number.isFinite(amt) &&
      amt > 0 &&
      Boolean(invId) &&
      stripeDueDate.trim().length > 0 &&
      outsideReadyForPreview

    if (!canPreview) {
      setStripePreview(null)
      setStripePreviewLoading(false)
      setStripePreviewError(null)
      return
    }

    const handle = window.setTimeout(() => {
      const req = ++stripePreviewReqId.current
      setStripePreviewLoading(true)
      setStripePreviewError(null)
      if (!stripePreviewExistsRef.current) {
        setStripePreview(null)
      }

      void (async () => {
        try {
          const { data: auth } = await supabase.auth.getSession()
          const token = auth.session?.access_token
          if (!token) {
            if (stripePreviewReqId.current === req) {
              setStripePreviewLoading(false)
              setStripePreviewError('Not signed in')
            }
            return
          }
          if (stripePreviewReqId.current !== req) return

          const lineDescTrim = stripeLineDescription.trim()
          // Mirror the create call exactly (v2.1034/35): folded + job-total fees
          // split inside the amount; roll-ins add on top — so the preview shows
          // the hazmat fee line the customer will actually see.
          const previewRollIns = includeHazmatRollIn && !hazmatIncidentForInvoice ? hazmatRollInLines : []
          const previewFolded = lineDescTrim.length > 0 ? [] : hazmatFeeLinesWithinAmount(foldedFeeLines, amt)
          const previewExtras = [...previewFolded, ...previewRollIns]
          const previewTotal = amt + hazmatRollInTotalDollars(previewRollIns)
          const { data: raw, error: fnErr } = await supabase.functions.invoke('preview-stripe-invoice', {
            body: {
              jobs_ledger_invoice_id: invId,
              customer_id: job.customer_id!,
              amount_dollars: previewTotal,
              customer_email: (job.customer_email ?? '').trim(),
              customer_name: (job.customer_name ?? '').trim() || 'Customer',
              due_date: stripeDueDate.trim(),
              ...(lineDescTrim ? { line_description: lineDescTrim } : {}),
              ...(previewExtras.length > 0
                ? { extra_line_items: previewExtras.map((l) => ({ amount_cents: l.amountCents, description: l.description })) }
                : {}),
              ...stripeModeInvokeBody(stripeModeForBilling),
            },
            headers: { Authorization: `Bearer ${token}` },
          })

          if (stripePreviewReqId.current !== req) return

          if (fnErr) {
            const detail = await readEdgeFunctionErrorBody(fnErr)
            setStripePreview(null)
            setStripePreviewError(detail ?? formatErrorMessage(fnErr, 'Preview failed'))
            return
          }

          const body = raw as Record<string, unknown> | null
          if (body && typeof body.error === 'string' && body.error.length > 0) {
            setStripePreview(null)
            setStripePreviewError(body.error)
            return
          }
          const parsedPreview = parseStripeInvoicePreviewResponse(body)
          if (parsedPreview) {
            setStripePreview(parsedPreview)
            setStripePreviewError(null)
          } else {
            setStripePreview(null)
            setStripePreviewError('Unexpected response from server')
          }
        } catch (e) {
          if (stripePreviewReqId.current !== req) return
          setStripePreview(null)
          setStripePreviewError(formatErrorMessage(e, 'Preview failed'))
        } finally {
          if (stripePreviewReqId.current === req) setStripePreviewLoading(false)
        }
      })()
    }, 450)

    return () => window.clearTimeout(handle)
  }, [
    open,
    job?.id,
    job?.customer_id,
    job?.customer_email,
    job?.customer_name,
    tab,
    stripeResult,
    stripeSuccessInvoice,
    billAmountStr,
    stripeDueDate,
    kind,
    invoice?.id,
    ensuredInvoice?.id,
    ensureLoading,
    ensureError,
    authRole,
    stripeModeForBilling,
    stripeLineDescription,
    foldedFeeLines,
    hazmatRollInLines,
    includeHazmatRollIn,
    hazmatIncidentForInvoice,
    stripeFixtureMultiLineAvailable,
  ])

  async function submitPhysicalInvoiceEmail() {
    if (!job) return
    const amt = Number(billAmountStr)
    if (!Number.isFinite(amt) || amt <= 0) {
      setPhysicalError('Enter a valid bill amount greater than 0')
      return
    }
    if (!(job.customer_email ?? '').trim()) {
      setPhysicalError('Customer email is required. Add it on Edit Job.')
      return
    }
    if (!stripeDueDate.trim()) {
      setPhysicalError('Choose a due date')
      return
    }
    const invId = kind === 'invoice' ? invoice?.id : ensuredInvoice?.id
    if (!invId) {
      setPhysicalError(ensureError || 'Could not prepare invoice line for this job')
      return
    }
    const lineDesc = stripeLineDescription.trim()
    const physicalInvId = kind === 'invoice' ? invoice?.id ?? null : ensuredInvoice?.id ?? null
    // A Line item override covers the whole amount, fee included (v2.1036).
    const physFeeLines = lineDesc.length > 0 ? [] : foldedFeeLines
    const doc = buildPhysicalInvoiceDocument({
      job: jobContextForPhysicalDoc(job, billCustomerJobDetails),
      amountDollars: amt,
      lineDescription: lineDesc,
      physicalLineOnBillRaw: stripeLineDescription.trim(),
      memo: externalNote,
      footer: physicalInvoiceFooter,
      invoiceDateYmd: sentDate.trim(),
      dueDateYmd: stripeDueDate.trim(),
      hazmatFeeLines: physFeeLines,
      detailFromJob: buildPhysicalInvoiceDetailFromJob(
        billCustomerJobDetails,
        kind === 'invoice' ? 'invoice' : 'job',
        physicalInvId,
      ),
    })
    if (!doc) {
      setPhysicalError('Could not build invoice preview')
      return
    }

    setPhysicalSubmitting(true)
    setPhysicalError(null)
    try {
      const { data: auth } = await supabase.auth.getSession()
      const token = auth.session?.access_token
      if (!token) {
        setPhysicalError('Not signed in')
        return
      }

      const pdfBlob = await buildPhysicalInvoicePdfBlob(doc)
      const pdfBase64 = await physicalInvoicePdfToBase64(pdfBlob)
      if (pdfBase64.length > 5_500_000) {
        setPhysicalError('Generated PDF is too large to email')
        return
      }

      // Hazmat notice travels as its own PDF beside the invoice — for a legacy
      // rider incident, or for every fee folded into this bill (v2.1028).
      let extraAttachments: Array<{ filename: string; content_base64: string }> | undefined
      const attachIncidents = hazmatIncidentForInvoice ? [hazmatIncidentForInvoice] : foldedFeeIncidents
      if (attachIncidents.length > 0 && attachHazmatNotice) {
        const noticeJobInfo = hazmatNoticeJobInfoFromJob(job)
        const list: Array<{ filename: string; content_base64: string }> = []
        let totalLen = pdfBase64.length
        for (const [i, incident] of attachIncidents.entries()) {
          const noticeBlob = await buildHazmatFeeNoticePdfBlob(noticeJobInfo, hazmatIncidentRowToDraft(incident))
          const noticeBase64 = await physicalInvoicePdfToBase64(noticeBlob)
          totalLen += noticeBase64.length
          if (totalLen > 8_500_000) {
            setPhysicalError('Invoice + notice PDFs are too large to email together')
            return
          }
          const baseName = hazmatNoticePdfFilename(noticeJobInfo)
          const filename = i === 0 ? baseName : baseName.replace(/\.pdf$/i, `-${i + 1}.pdf`)
          list.push({ filename, content_base64: noticeBase64 })
        }
        extraAttachments = list
      }

      const sentAt = sentDate.trim()
        ? new Date(sentDate.trim() + 'T12:00:00').toISOString()
        : new Date().toISOString()
      const { text, html } = buildPhysicalInvoiceEmailBodies(doc)
      const { data: invokeData, error: fnErr } = await withOperationTimeout(
        supabase.functions.invoke('send-physical-invoice-email', {
          body: {
            jobs_ledger_invoice_id: invId,
            job_id: job.id,
            amount_dollars: amt,
            sent_to_customer_at: sentAt,
            external_send_note: externalNote.trim() || null,
            customer_email: (job.customer_email ?? '').trim(),
            ...(physicalAdditionalEmails().length > 0 ? { additional_emails: physicalAdditionalEmails() } : {}),
            subject: physicalInvoiceEmailSubject(doc),
            pdf_base64: pdfBase64,
            pdf_filename: physicalInvoicePdfFilename(job.hcp_number, sentDate.trim()),
            email_text: text,
            email_html: html,
            ...(extraAttachments ? { extra_attachments: extraAttachments } : {}),
          },
          headers: { Authorization: `Bearer ${token}` },
        }),
        BILL_EMAIL_INVOKE_TIMEOUT_MS,
        'Send invoice email',
      )
      if (fnErr) {
        const detail = await readEdgeFunctionErrorBody(fnErr)
        setPhysicalError(detail ?? formatErrorMessage(fnErr, 'Send invoice email failed'))
        return
      }
      const resp = invokeData as { success?: boolean; error?: string } | null
      if (resp && typeof resp.error === 'string' && resp.error.length > 0) {
        setPhysicalError(resp.error)
        return
      }
      const promote = await maybePromoteJobToBilledAfterCustomerInvoice(job.id)
      if (!promote.ok) {
        setPhysicalError(promote.error)
        return
      }
      // Job-total incidents whose fee shipped inside this physical invoice
      // link to it now, so they never split twice on a later bill.
      for (const inc of foldedFeeIncidents) {
        if ((inc.invoice_id ?? '').trim()) continue
        const linked = await linkHazmatFeeIncidentToInvoice(inc.id, invId)
        if (!linked.ok) {
          console.error('hazmat job-total repoint failed (physical invoice sent ok)', linked.error)
        }
      }
      await onSuccess()
      onClose()
    } catch (e) {
      // Timeout: the request wasn't cancelled — the email may still send when
      // the server recovers, so say so instead of implying failure.
      setPhysicalError(
        e instanceof OperationTimeoutError
          ? 'The server is not responding. The invoice email may or may not have been sent — check the invoice status before sending again.'
          : e instanceof Error
            ? e.message
            : 'Send invoice email failed',
      )
    } finally {
      setPhysicalSubmitting(false)
    }
  }

  async function confirmOutsideBill() {
    if (!job) return
    const amt = Number(billAmountStr)
    if (!Number.isFinite(amt) || amt <= 0) {
      setOutsideError('Enter a valid bill amount greater than 0')
      return
    }
    setOutsideSubmitting(true)
    setOutsideError(null)
    const sentAt = sentDate.trim() ? new Date(sentDate + 'T12:00:00').toISOString() : new Date().toISOString()
    try {
      if (kind === 'invoice' && invoice) {
        await withOperationTimeout(
          withSupabaseRetry(
            () =>
              supabase
                .from('jobs_ledger_invoices')
                .update({
                  status: 'billed',
                  amount: amt,
                  external_send_channel: 'housecallpro',
                  external_send_note: externalNote.trim() || null,
                  sent_to_customer_at: sentAt,
                })
                .eq('id', invoice.id),
            'record outside bill on invoice'
          ),
          BILL_DB_WRITE_TIMEOUT_MS,
          'Record outside bill',
        )
      } else {
        const invId = ensuredInvoice?.id
        if (!invId) {
          throw new Error(ensureError || 'Could not prepare invoice line for this job')
        }
        await withOperationTimeout(
          withSupabaseRetry(
            () =>
              supabase
                .from('jobs_ledger_invoices')
                .update({
                  status: 'billed',
                  amount: amt,
                  external_send_channel: 'housecallpro',
                  external_send_note: externalNote.trim() || null,
                  sent_to_customer_at: sentAt,
                })
                .eq('id', invId),
            'record outside bill on ensured invoice'
          ),
          BILL_DB_WRITE_TIMEOUT_MS,
          'Record outside bill',
        )
      }
      const promote = await maybePromoteJobToBilledAfterCustomerInvoice(job.id)
      if (!promote.ok) {
        setOutsideError(promote.error)
        return
      }
      await onSuccess()
      onClose()
    } catch (e) {
      // Timeout: the request wasn't cancelled — it may still land when the
      // server recovers, so say so instead of implying failure.
      setOutsideError(
        e instanceof OperationTimeoutError
          ? 'The server is not responding. The bill may or may not have been recorded — check the invoice status before retrying.'
          : e instanceof Error
            ? e.message
            : 'Failed to save',
      )
    } finally {
      setOutsideSubmitting(false)
    }
  }

  async function submitStripeInvoice() {
    if (!job?.customer_id) return
    const amt = Number(billAmountStr)
    if (!Number.isFinite(amt) || amt <= 0) {
      setStripeError('Enter a valid bill amount greater than 0')
      return
    }
    if (!(job.customer_email ?? '').trim()) {
      setStripeError('Customer email is required for Stripe invoices. Add it on Edit Job.')
      return
    }
    const invId = kind === 'invoice' ? invoice?.id : ensuredInvoice?.id
    if (!invId) {
      setStripeError(ensureError || 'Could not prepare invoice line for this job')
      return
    }
    if (!stripeDueDate.trim()) {
      setStripeError('Choose a due date')
      return
    }

    setStripeSubmitting(true)
    setStripeError(null)
    try {
      const { data: auth } = await supabase.auth.getSession()
      const token = auth.session?.access_token
      if (!token) {
        setStripeError('Not signed in')
        return
      }

      let body: CreateStripeInvoiceFnResponse | null
      const lineDescTrim = stripeLineDescription.trim()
      // v2.1002: fold eligible unsent hazmat riders into this bill (never when
      // billing a rider itself — that keeps the separate-notice flow).
      const rollIns = includeHazmatRollIn && !hazmatIncidentForInvoice ? hazmatRollInLines : []
      // Folded + job-total fees are ALREADY inside amt (the auto-maintained
      // primary carries them via the remainder math) — they split out as
      // labeled lines, guarded within the amount so work lines keep at least
      // a cent. A Line item override covers the WHOLE amount, fee included, so
      // no separate fee line is sent (v2.1036). Legacy roll-ins add on top.
      const lineOverrideActive = lineDescTrim.length > 0
      const feeLines = lineOverrideActive ? [] : hazmatFeeLinesWithinAmount(foldedFeeLines, amt)
      const extraLines = [...feeLines, ...rollIns]
      const totalAmountDollars = amt + hazmatRollInTotalDollars(rollIns)
      const { data: invokeData, error: fnErr } = await withOperationTimeout(
        supabase.functions.invoke('create-stripe-invoice', {
          body: {
            jobs_ledger_invoice_id: invId,
            customer_id: job.customer_id,
            amount_dollars: totalAmountDollars,
            customer_email: (job.customer_email ?? '').trim(),
            customer_name: (job.customer_name ?? '').trim() || 'Customer',
            due_date: stripeDueDate.trim(),
            memo: stripeMemo.trim() || undefined,
            footer: stripeInvoiceFooter.trim() || undefined,
            ...(lineDescTrim ? { line_description: lineDescTrim } : {}),
            ...(extraLines.length > 0
              ? { extra_line_items: extraLines.map((l) => ({ amount_cents: l.amountCents, description: l.description })) }
              : {}),
            ...stripeModeInvokeBody(stripeModeForBilling),
          },
          headers: { Authorization: `Bearer ${token}` },
        }),
        BILL_STRIPE_INVOKE_TIMEOUT_MS,
        'Create Stripe invoice',
      )
      if (fnErr) {
        const detail = await readEdgeFunctionErrorBody(fnErr)
        setStripeError(detail ?? formatErrorMessage(fnErr, 'Stripe invoice failed'))
        return
      }
      body = invokeData as CreateStripeInvoiceFnResponse | null
      if (body && typeof body.error === 'string' && body.error.length > 0) {
        setStripeError(body.error)
        return
      }

      const hosted = typeof body?.hosted_invoice_url === 'string' ? body.hosted_invoice_url.trim() : ''
      const stripeId = typeof body?.stripe_invoice_id === 'string' ? body.stripe_invoice_id.trim() : ''
      if (!hosted || !stripeId) {
        setStripeError('Unexpected response from server')
        return
      }

      const promote = await maybePromoteJobToBilledAfterCustomerInvoice(job.id)
      if (!promote.ok) {
        setStripeError(promote.error)
        return
      }

      // Fold rolled-in riders: repoint each incident at the final invoice FIRST
      // (a dangling incident -> deleted-invoice link is worse than a leftover
      // draft row), then delete the rider so balance math counts the fee once.
      for (const l of rollIns) {
        try {
          const linked = await linkHazmatFeeIncidentToInvoice(l.incidentId, invId)
          if (!linked.ok) throw new Error(linked.error ?? 'repoint failed')
          await withSupabaseRetry(
            async () => supabase.from('jobs_ledger_invoices').delete().eq('id', l.invoiceId),
            'delete rolled-in hazmat rider invoice',
          )
        } catch (foldErr) {
          console.error('hazmat roll-in fold failed (Stripe invoice created ok)', foldErr)
        }
      }

      // Job-total incidents whose fee just shipped on this invoice link to it
      // now, so they never split twice. Under a line override the fee ships
      // inside the single line — still shipped, still repointed.
      for (const inc of foldedFeeIncidents) {
        if ((inc.invoice_id ?? '').trim()) continue
        if (!lineOverrideActive && !feeLines.some((l) => l.incidentId === inc.id)) continue
        const linked = await linkHazmatFeeIncidentToInvoice(inc.id, invId)
        if (!linked.ok) {
          console.error('hazmat job-total repoint failed (Stripe invoice created ok)', linked.error)
        }
      }

      // Companion notice email (Stripe can't attach files). Failure never rolls back
      // the created invoice — the Riders strip in Edit Job re-sends any time.
      // Covers the legacy rider incident AND v2.1028 fees folded into this bill.
      const noticeIncidents = hazmatIncidentForInvoice ? [hazmatIncidentForInvoice] : foldedFeeIncidents
      if (noticeIncidents.length > 0 && emailHazmatNoticeWithStripe && (job.customer_email ?? '').trim()) {
        let noticeStatus: string = 'sent'
        for (const incident of noticeIncidents) {
          const noticeRes = await sendHazmatNoticeEmailToCustomer({
            jobId: job.id,
            incident,
            jobInfo: hazmatNoticeJobInfoFromJob(job),
            customerEmail: (job.customer_email ?? '').trim(),
            invoiceReference: `Stripe invoice for job ${(job.hcp_number ?? '').trim() || (job.click_number ?? '').trim() || job.job_name}`,
          })
          if (!noticeRes.ok) noticeStatus = noticeRes.error ?? 'Notice email failed'
        }
        setHazmatNoticeEmailStatus(noticeStatus)
      }

      const fresh = await fetchJobWithDetailsById(job.id)
      const row = fresh?.invoices?.find((i) => i.id === invId)
      if (fresh && row) {
        setStripeSuccessInvoice({ ...row, job: fresh })
        setStripeResult(null)
      } else {
        setStripeSuccessInvoice(null)
        setStripeResult({
          hosted_invoice_url: hosted,
          stripe_invoice_id: stripeId,
          stripe_invoice_status: typeof body?.stripe_invoice_status === 'string' ? body.stripe_invoice_status : null,
          idempotent: body?.idempotent === true,
          invoice_preview: parseStripeInvoiceLinesSnapshot(body?.invoice_preview),
        })
      }
      await onSuccess()
    } catch (e) {
      // Timeout: the request wasn't cancelled — the invoice may still be
      // created when the server recovers, so say so instead of implying failure.
      setStripeError(
        e instanceof OperationTimeoutError
          ? "The server is not responding. The invoice may or may not have been created — check the job's invoices (and Stripe) before submitting again."
          : e instanceof Error
            ? e.message
            : 'Stripe invoice failed',
      )
    } finally {
      setStripeSubmitting(false)
    }
  }

  const lineLeadingLowercaseHint = useMemo(() => {
    if (!open || !job) return false

    const trimmedOverride = stripeLineDescription.trim()
    const descs: string[] = trimmedOverride
      ? [trimmedOverride]
      : [defaultStripeLineDescriptionFromJob(job)]

    if (tab === 'stripe' && stripePreview?.lines?.length) {
      for (const line of stripePreview.lines) {
        descs.push(line.description)
      }
    }

    if (tab === 'physical' && jobLedgerHasCustomerForBilling(job.customer_id)) {
      const amt = Number(billAmountStr)
      const previewInvId = kind === 'invoice' ? invoice?.id ?? null : ensuredInvoice?.id ?? null
      const physDoc = buildPhysicalInvoiceDocument({
        job: jobContextForPhysicalDoc(job, billCustomerJobDetails),
        amountDollars: amt,
        lineDescription: trimmedOverride,
        physicalLineOnBillRaw: stripeLineDescription.trim(),
        memo: externalNote,
        footer: physicalInvoiceFooter,
        invoiceDateYmd: sentDate.trim(),
        dueDateYmd: stripeDueDate.trim(),
        hazmatFeeLines: trimmedOverride ? [] : foldedFeeLines,
        detailFromJob: buildPhysicalInvoiceDetailFromJob(
          billCustomerJobDetails,
          kind === 'invoice' ? 'invoice' : 'job',
          previewInvId,
        ),
      })
      if (physDoc) {
        if (physDoc.lineDescription.trim()) descs.push(physDoc.lineDescription)
        for (const row of physDoc.serviceLines) descs.push(row.description)
        for (const row of physDoc.materialLines) descs.push(row.description)
      }
    }

    return invoiceDescriptionsNeedLowercaseLeadingHint(descs)
  }, [
    open,
    job,
    tab,
    stripeLineDescription,
    stripePreview,
    billAmountStr,
    billCustomerJobDetails,
    externalNote,
    physicalInvoiceFooter,
    sentDate,
    stripeDueDate,
    kind,
    invoice?.id,
    ensuredInvoice?.id,
  ])

  // v2.1133: everything the bill renders or edits is scoped to the invoice's
  // linked line items (segment invoices); dollar invoices fall back to all.
  // v2.2469: the unlinked primary remainder composes from still-unlinked
  // segments when they sum exactly to its amount (kind:'job' ensures the
  // primary, so its context is primary by definition).
  const billScopedFixtures = useMemo(
    () =>
      fixturesForInvoiceBill(
        billCustomerJobDetails?.fixtures,
        kind === 'invoice' ? invoice?.id ?? null : ensuredInvoice?.id ?? null,
        kind === 'invoice'
          ? invoice ?? null
          : ensuredInvoice
            ? { is_primary_rtb_bundle: true, amount: ensuredInvoice.amount }
            : null,
      ),
    [billCustomerJobDetails?.fixtures, kind, invoice, ensuredInvoice],
  )

  const physicalFixtureEditRefs = useMemo(
    () => billableFixtureRefsInOrder(billScopedFixtures),
    [billScopedFixtures],
  )

  const physicalMaterialEditRefs = useMemo(
    () => billableMaterialRefsInOrder(billCustomerJobDetails?.materials),
    [billCustomerJobDetails?.materials],
  )

  const physicalPreviewDbBacked = useMemo(() => {
    const amt = Number(billAmountStr)
    return physicalPreviewRowsAreDbBacked(
      billScopedFixtures,
      billCustomerJobDetails?.materials,
      amt,
    )
  }, [billScopedFixtures, billCustomerJobDetails?.materials, billAmountStr])

  const [lineEditSession, setLineEditSession] = useState<BillCustomerLineEditSession | null>(null)

  useEffect(() => {
    if (!open) setLineEditSession(null)
  }, [open])

  const refreshBillCustomerJobDetails = useCallback(async () => {
    if (!job?.id) return
    const fresh = await fetchJobWithDetailsById(job.id)
    setBillCustomerJobDetails(fresh)
    setStripeFixtureMultiLineAvailable(
      jobHasBillableStripeSpecificWorkFixtures(
        fixturesForInvoiceBill(fresh?.fixtures, kind === 'invoice' ? invoice?.id ?? null : null),
      ),
    )
  }, [job?.id, kind, invoice?.id])

  const handleStripePreviewLineClick = useCallback(
    ({ source }: { lineIndex: number; source: StripeInvoiceLineSource | undefined }) => {
      if (!job) return
      if (source?.kind === 'fixture') {
        const row = billCustomerJobDetails?.fixtures?.find((f) => f.id === source.jobs_ledger_fixture_id)
        if (!row) return
        setLineEditSession({
          mode: 'fixture',
          jobId: job.id,
          fixtureId: row.id,
          initialName: row.name,
          initialLineDescription: row.line_description ?? '',
        })
        return
      }
      if (source?.kind === 'single_line' && stripeLineDescription.trim() !== '') {
        setLineEditSession({
          mode: 'stripe_override',
          initialLineDescription: stripeLineDescription.trim(),
        })
      }
    },
    [job, billCustomerJobDetails?.fixtures, stripeLineDescription],
  )

  const openPhysicalServiceLineEdit = useCallback(
    (rowIndex: number) => {
      if (!job || !physicalPreviewDbBacked) return
      const ref = physicalFixtureEditRefs[rowIndex]
      if (!ref) return
      setLineEditSession({
        mode: 'fixture',
        jobId: job.id,
        fixtureId: ref.id,
        initialName: ref.name,
        initialLineDescription: ref.line_description ?? '',
      })
    },
    [job, physicalPreviewDbBacked, physicalFixtureEditRefs],
  )

  const openPhysicalMaterialLineEdit = useCallback(
    (rowIndex: number) => {
      if (!job || !physicalPreviewDbBacked) return
      const ref = physicalMaterialEditRefs[rowIndex]
      if (!ref) return
      setLineEditSession({
        mode: 'material',
        jobId: job.id,
        materialId: ref.id,
        initialDescription: ref.description ?? '',
        amountDollars: ref.amount,
      })
    },
    [job, physicalPreviewDbBacked, physicalMaterialEditRefs],
  )

  if (!open || !job) return null

  const busy = jobUpdating || invoiceUpdating || outsideSubmitting || stripeSubmitting || physicalSubmitting
  const stripeFallbackLedgerInvoiceId =
    kind === 'invoice' ? (invoice?.id ?? '') : (ensuredInvoice?.id ?? '')

  if (!jobLedgerHasCustomerForBilling(job.customer_id)) {
    return (
      <div
        style={{
          position: 'fixed',
          padding: 'calc(1rem + env(safe-area-inset-top, 0px)) 1rem calc(1rem + env(safe-area-inset-bottom, 0px))',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: overlayZIndex,
        }}
      >
        <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, width: 'min(520px, calc(100vw - 2rem))', maxWidth: 520, maxHeight: 'min(90vh, 100%)', overflow: 'auto' }}>
          <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem' }}>Bill Customer</h2>
          <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            {effectiveJobLedgerNumber(job.hcp_number, job.click_number) || '—'} · {job.job_name ?? '—'}
          </p>
          <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-red-700)' }}>
            Link this job to a customer on the Jobs page before billing.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '0.5rem 1rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 4, cursor: 'pointer' }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )
  }

  const outsideReady =
    kind === 'invoice'
      ? invoice != null
      : kind === 'job' && ensuredInvoice != null && !ensureLoading && !ensureError

  const effectivePhysicalLineDesc = stripeLineDescription.trim()
  const previewInvId = kind === 'invoice' ? invoice?.id ?? null : ensuredInvoice?.id ?? null
  const physicalDocPreview =
    job && tab === 'physical'
      ? buildPhysicalInvoiceDocument({
          job: jobContextForPhysicalDoc(job, billCustomerJobDetails),
          amountDollars: Number(billAmountStr),
          lineDescription: effectivePhysicalLineDesc,
          physicalLineOnBillRaw: stripeLineDescription.trim(),
          memo: externalNote,
          footer: physicalInvoiceFooter,
          invoiceDateYmd: sentDate.trim(),
          dueDateYmd: stripeDueDate.trim(),
          hazmatFeeLines: effectivePhysicalLineDesc ? [] : foldedFeeLines,
          detailFromJob: buildPhysicalInvoiceDetailFromJob(
            billCustomerJobDetails,
            kind === 'invoice' ? 'invoice' : 'job',
            previewInvId,
          ),
        })
      : null

  const physicalServiceDateLinkLabel =
    physicalDocPreview?.invoiceDateDisplay ?? formatPhysicalInvoiceLongDateYmd(sentDate)
  const physicalDueDateLinkLabel =
    physicalDocPreview?.dueDateDisplay ?? formatPhysicalInvoiceLongDateYmd(stripeDueDate)

  const physicalSendReady =
    outsideReady &&
    (job?.customer_email ?? '').trim().length > 0 &&
    stripeDueDate.trim().length > 0 &&
    physicalDocPreview != null

  // Preview email (v2.2340): the exact bodies the send builds, a moment
  // earlier — what you preview is byte-for-byte what sends.
  function openPhysicalInvoiceEmailPreviewInNewTab() {
    if (!physicalDocPreview) return
    openInvoiceEmailPreviewInNewTab(physicalDocPreview, {
      toEmail: job?.customer_email ?? '',
      contextNote: 'Preview — nothing has been sent',
      onBlocked: () => showToast('Pop-up blocked. Allow pop-ups for this site to preview the email.', 'warning'),
    })
  }

  async function openPhysicalInvoicePdfInNewTab() {
    if (!physicalDocPreview) return
    const win = window.open('', '_blank')
    if (!win) {
      showToast('Pop-up blocked. Allow pop-ups for this site to preview the PDF.', 'warning')
      return
    }
    setPhysicalPdfPreviewLoading(true)
    setPhysicalError(null)
    let objectUrl: string | null = null
    try {
      const blob = await buildPhysicalInvoicePdfBlob(physicalDocPreview)
      objectUrl = URL.createObjectURL(blob)
      win.location.href = objectUrl
      window.setTimeout(() => {
        if (objectUrl) URL.revokeObjectURL(objectUrl)
      }, 60_000)
    } catch (e) {
      win.close()
      setPhysicalError(e instanceof Error ? e.message : 'Could not build PDF preview')
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    } finally {
      setPhysicalPdfPreviewLoading(false)
    }
  }

  const billDateInputStyle: CSSProperties = {
    ...BILL_CUSTOMER_CONTROL_STYLE,
    colorScheme: 'light',
  }

  const physicalFooterActiveId = physicalInvoiceFooterActivePresetId(physicalInvoiceFooter)

  /** "Preview the email…" (v2.1037): opens exactly what the customer receives —
   * envelope + body from the sender's own helpers + the notice inlined. */
  function openHazmatNoticeEmailPreview() {
    if (!job) return
    const incidents = hazmatIncidentForInvoice ? [hazmatIncidentForInvoice] : foldedFeeIncidents
    if (incidents.length === 0) return
    const jobInfo = hazmatNoticeJobInfoFromJob(job)
    const invoiceReference = `Stripe invoice for job ${(job.hcp_number ?? '').trim() || (job.click_number ?? '').trim() || job.job_name}`
    const html = buildHazmatNoticeEmailPreviewHtml(
      incidents.map((incident) => ({
        jobNumber: jobInfo.jobNumber,
        customerEmail: (job.customer_email ?? '').trim() || '—',
        attachmentFilename: hazmatNoticePdfFilename(jobInfo),
        noticeHtml: buildHazmatFeeNoticeHtml(jobInfo, hazmatIncidentRowToDraft(incident)),
        invoiceReference,
      })),
    )
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(html)
    w.document.close()
  }

  return (
    <Fragment>
      <div
        style={{
          position: 'fixed',
          padding: 'calc(1rem + env(safe-area-inset-top, 0px)) 1rem calc(1rem + env(safe-area-inset-bottom, 0px))',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: overlayZIndex,
        }}
      >
      <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, width: 'min(520px, calc(100vw - 2rem))', maxWidth: 520, maxHeight: 'min(90vh, 100%)', overflow: 'auto' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '0.75rem',
            marginBottom: '1rem',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ minWidth: 0, flex: '1 1 auto' }}>
            <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem' }}>Bill Customer</h2>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              {effectiveJobLedgerNumber(job.hcp_number, job.click_number) || '—'} · {job.job_name ?? '—'}
              {invoice
                ? ` · RTB $${Number(invoice.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                : kind === 'job' && ensuredInvoice && !ensureLoading && !ensureError
                  ? ` · RTB $${Number(ensuredInvoice.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                  : ''}
            </p>
          </div>
          {tab === 'stripe' && !stripeResult && !stripeSuccessInvoice && authRole === 'dev' && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.2rem',
                fontSize: '0.8125rem',
                fontWeight: 500,
                color: 'var(--text-700)',
                flex: '0 0 auto',
              }}
            >
              <span>Stripe</span>
              <StripeBillingModeToggle
                value={stripeModePref}
                onChange={(next) => {
                  setStripeModePref(next)
                  setBillingStripeModePref(next)
                }}
                disabled={stripeSubmitting}
              />
            </div>
          )}
        </div>

        {!(job.customer_email ?? '').trim() ? (
          <div
            role="group"
            aria-label="Customer email missing"
            style={{
              border: '1px solid #d97706',
              background: 'var(--bg-amber-tint)',
              borderRadius: 8,
              padding: '0.6rem 0.75rem',
              marginBottom: '1rem',
            }}
          >
            <p style={{ margin: '0 0 0.4rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-amber-700)' }}>
              No customer email on this job — Stripe and emailed invoices need one.
            </p>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              <input
                type="email"
                value={emailFixDraft}
                onChange={(e) => setEmailFixDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void saveMissingCustomerEmail()
                  }
                }}
                placeholder="customer@email.com"
                aria-label="Customer email"
                style={{ flex: '1 1 200px', padding: '0.4rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 6 }}
              />
              <button
                type="button"
                onClick={() => void saveMissingCustomerEmail()}
                disabled={emailFixSaving || !emailFixDraft.trim()}
                style={{ padding: '0.4rem 0.9rem', background: emailFixSaving || !emailFixDraft.trim() ? '#9ca3af' : '#2563eb', color: 'white', border: 'none', borderRadius: 6, cursor: emailFixSaving || !emailFixDraft.trim() ? 'not-allowed' : 'pointer', fontWeight: 600 }}
              >
                {emailFixSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
            {jobRaw?.customer_id ? (
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.4rem', fontSize: '0.8125rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={emailFixAlsoCustomer}
                  onChange={(e) => setEmailFixAlsoCustomer(e.target.checked)}
                />
                Also add to {job.customer_name ?? 'the customer'}&rsquo;s record if it has no email
              </label>
            ) : null}
            {emailFixError ? (
              <p style={{ margin: '0.4rem 0 0', fontSize: '0.8125rem', color: 'var(--text-red-700)' }}>{emailFixError}</p>
            ) : null}
          </div>
        ) : null}

        {billToOverride ? (
          <div
            style={{
              marginBottom: '0.75rem',
              padding: '0.5rem 0.75rem',
              borderRadius: 6,
              background: 'var(--bg-amber-tint)',
              border: '1px solid var(--border-strong)',
              fontSize: '0.8125rem',
              color: 'var(--text-amber-800)',
              lineHeight: 1.4,
            }}
          >
            <strong>Billing to {billToDisplayLabel(billToOverride)}</strong> — not the job customer
            {(jobRaw?.customer_name ?? '').trim() ? ` (${(jobRaw?.customer_name ?? '').trim()})` : ''}. Change or
            remove this on Edit Job → Invoices → Bill to…
          </div>
        ) : null}

        {/* Lien releases for this job (v2.2582) — issued list + clearance + new/unconditional follow-up. */}
        <BillCustomerLienReleaseStrip
          open={open}
          jobId={jobRaw?.id ?? null}
          jobDetails={billCustomerJobDetails}
          jobNumber={effectiveJobLedgerNumber(job.hcp_number, job.click_number) || '—'}
        />

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" onClick={() => setTab('stripe')} style={billCustomerTopTabButtonStyle(tab === 'stripe')}>
            Stripe bill
          </button>
          <button
            type="button"
            onClick={() => setTab('physical')}
            style={billCustomerTopTabButtonStyle(tab === 'physical')}
          >
            Physical invoice
          </button>
          {hcpTabRevealed || tab === 'housecallpro' ? (
            <button
              type="button"
              onClick={() => setTab('housecallpro')}
              style={billCustomerTopTabButtonStyle(tab === 'housecallpro')}
            >
              HouseCall Pro
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setHcpTabRevealed(true)}
              title="More billing options"
              aria-label="Show more billing options"
              aria-expanded={false}
              style={{
                ...billCustomerTopTabButtonStyle(false),
                padding: '0.5rem 0.6rem',
                color: 'var(--text-faint)',
                fontSize: '0.8125rem',
              }}
            >
              ▾
            </button>
          )}
        </div>

        {tab === 'housecallpro' && (
          <>
            {kind === 'job' && ensureLoading && (
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>Preparing billing line…</p>
            )}
            {kind === 'job' && !ensureLoading && ensureError && (
              <p style={{ color: 'var(--text-red-700)', fontSize: '0.875rem', marginBottom: '0.75rem' }}>{ensureError}</p>
            )}
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={BILL_CUSTOMER_FIELD_LABEL_STYLE}>Date</label>
              <input type="date" value={sentDate} onChange={(e) => setSentDate(e.target.value)} style={billDateInputStyle} />
            </div>
            <button
              type="button"
              aria-expanded={memoSectionOpen}
              aria-controls="bill-customer-hcp-memo-section-panel"
              onClick={() => setMemoSectionOpen((v) => !v)}
              style={{
                ...BILL_CUSTOMER_DISCLOSURE_TOGGLE_STYLE,
                marginBottom: memoSectionOpen ? '0.35rem' : '0.65rem',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', minWidth: 0 }}>
                <span style={{ fontSize: '0.75rem', flexShrink: 0 }} aria-hidden>
                  {memoSectionOpen ? '▼' : '\u25b6'}
                </span>
                <span
                  id="bill-customer-hcp-memo-disclosure-heading"
                  style={{
                    fontWeight: 500,
                    fontSize: '0.875rem',
                    color: 'var(--text-700)',
                  }}
                >
                  Memo
                </span>
              </span>
              <span
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  flexShrink: 0,
                }}
              >
                {billCustomerMemoSummaryLine(externalNote)}
              </span>
            </button>
            <div
              id="bill-customer-hcp-memo-section-panel"
              role="region"
              aria-labelledby="bill-customer-hcp-memo-disclosure-heading"
              hidden={!memoSectionOpen}
              style={{ marginBottom: '0.75rem' }}
            >
              <span style={{ ...BILL_CUSTOMER_FIELD_LABEL_STYLE, fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                ({externalNote.length} / {BILL_CUSTOMER_MEMO_MAX_CHARS})
              </span>
              <BillCustomerMemoPresetRow
                presets={memoPresets}
                valueForHighlight={externalNote}
                onApplyBoth={applyMemoPresetToBoth}
              />
              <textarea
                value={externalNote}
                onChange={(e) => setExternalNote(e.target.value.slice(0, BILL_CUSTOMER_MEMO_MAX_CHARS))}
                rows={3}
                style={{ ...BILL_CUSTOMER_TEXTAREA_STYLE, marginBottom: 0 }}
              />
            </div>
            {outsideError && <p style={{ color: 'var(--text-red-700)', fontSize: '0.875rem' }}>{outsideError}</p>}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
              <button type="button" onClick={onClose} style={{ padding: '0.5rem 1rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 4, cursor: 'pointer' }}>
                Cancel
              </button>
              <button
                type="button"
                disabled={!outsideReady || busy}
                onClick={() => void confirmOutsideBill()}
                style={{
                  padding: '0.5rem 1rem',
                  background: outsideReady && !busy ? '#3b82f6' : '#9ca3af',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: outsideReady && !busy ? 'pointer' : 'not-allowed',
                }}
              >
                {busy ? '…' : 'Save'}
              </button>
            </div>
          </>
        )}

        {tab === 'physical' && (
          <>
            {kind === 'job' && ensureLoading && (
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>Preparing billing line…</p>
            )}
            {kind === 'job' && !ensureLoading && ensureError && (
              <p style={{ color: 'var(--text-red-700)', fontSize: '0.875rem', marginBottom: '0.75rem' }}>{ensureError}</p>
            )}
            {!(job.customer_email ?? '').trim() ? (
              <p style={{ color: 'var(--text-red-700)', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
                Customer email is required to send a physical invoice by email. Add it on Edit Job.
              </p>
            ) : null}
            {(customerContacts.length > 0 || (job.customer_email ?? '').trim()) && (
              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>Send to</div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: customerContacts.length > 0 ? '0.25rem' : 0 }}>
                  {(job.customer_email ?? '').trim() || '—'}{' '}
                  <span style={{ color: 'var(--text-faint)' }}>{billToOverride ? '(bill-to recipient)' : '(primary)'}</span>
                </div>
                {/* Bill-to override: the customer's contact persons never ride on an
                    invoice that bills someone else. */}
                {(billToOverride ? [] : customerContacts).map((c) => (
                  <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8125rem', cursor: 'pointer', padding: '0.1rem 0' }}>
                    <input
                      type="checkbox"
                      checked={extraRecipientIds.has(c.id)}
                      onChange={(e) => {
                        setExtraRecipientIds((prev) => {
                          const next = new Set(prev)
                          if (e.target.checked) next.add(c.id)
                          else next.delete(c.id)
                          return next
                        })
                      }}
                    />
                    <span>
                      {c.name} <span style={{ color: 'var(--text-muted)' }}>{c.email}</span>
                    </span>
                  </label>
                ))}
                <input
                  type="email"
                  value={oneOffEmail}
                  onChange={(e) => setOneOffEmail(e.target.value)}
                  placeholder="Also send to… (one-off email)"
                  aria-label="Additional one-off email recipient"
                  style={{ width: '100%', padding: '0.35rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, marginTop: '0.25rem', boxSizing: 'border-box', fontSize: '0.8125rem' }}
                />
              </div>
            )}
            <div style={BILL_CUSTOMER_INVOICE_MODIFICATIONS_SHELL_STYLE}>
              <div style={BILL_CUSTOMER_INVOICE_MODIFICATIONS_TITLE_STYLE}>
                Invoice Modifications (optional)
              </div>
              <div style={BILL_CUSTOMER_MODIFICATIONS_STACK_STYLE}>
            <button
              type="button"
              aria-expanded={lineOnBillSectionOpen}
              aria-controls="bill-customer-physical-line-on-bill-section-panel"
              onClick={() => setLineOnBillSectionOpen((v) => !v)}
              style={{
                ...BILL_CUSTOMER_DISCLOSURE_TOGGLE_STYLE,
                marginBottom: 0,
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', minWidth: 0 }}>
                <span style={{ fontSize: '0.75rem', flexShrink: 0 }} aria-hidden>
                  {lineOnBillSectionOpen ? '▼' : '\u25b6'}
                </span>
                <span
                  id="bill-customer-physical-line-on-bill-disclosure-heading"
                  style={{
                    fontWeight: 500,
                    fontSize: '0.875rem',
                    color: 'var(--text-700)',
                  }}
                >
                  Line item override
                </span>
              </span>
              <span
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  flexShrink: 0,
                }}
              >
                {billCustomerLineOnBillSummaryLine(stripeLineDescription)}
              </span>
            </button>
            <div
              id="bill-customer-physical-line-on-bill-section-panel"
              role="region"
              aria-labelledby="bill-customer-physical-line-on-bill-disclosure-heading"
              hidden={!lineOnBillSectionOpen}
              style={{ marginBottom: 0 }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.5rem',
                  marginBottom: 4,
                  flexWrap: 'wrap',
                }}
              >
                <span
                  id="bill-customer-physical-line-on-bill-count"
                  style={{
                    fontSize: '0.72rem',
                    color: 'var(--text-muted)',
                    fontWeight: 400,
                    flex: '1 1 auto',
                    minWidth: 0,
                  }}
                >
                  ({stripeLineDescription.length} / {STRIPE_INVOICE_LINE_DESCRIPTION_MAX})
                </span>
                <button
                  type="button"
                  onClick={() => job && setStripeLineDescription(defaultStripeLineDescriptionFromJob(job))}
                  disabled={!job}
                  title="Reset line item override to default"
                  aria-label="Reset line item override to default"
                  style={{
                    padding: 0,
                    border: 'none',
                    background: 'none',
                    color: 'var(--text-link)',
                    cursor: job ? 'pointer' : 'not-allowed',
                    fontSize: '0.8125rem',
                    textDecoration: 'underline',
                    textUnderlineOffset: '2px',
                    flexShrink: 0,
                  }}
                >
                  default
                </button>
              </div>
              <textarea
                id="bill-customer-physical-line-description"
                aria-describedby="bill-customer-physical-line-on-bill-count"
                placeholder={BILL_CUSTOMER_LINE_ON_BILL_PLACEHOLDER}
                value={stripeLineDescription}
                onChange={(e) =>
                  setStripeLineDescription(e.target.value.slice(0, STRIPE_INVOICE_LINE_DESCRIPTION_MAX))
                }
                rows={2}
                style={{
                  ...BILL_CUSTOMER_TEXTAREA_STYLE,
                  marginBottom: 0,
                  minHeight: '3.5rem',
                }}
              />
            </div>
            <button
              type="button"
              aria-expanded={memoSectionOpen}
              aria-controls="bill-customer-physical-memo-section-panel"
              onClick={() => setMemoSectionOpen((v) => !v)}
              style={{
                ...BILL_CUSTOMER_DISCLOSURE_TOGGLE_STYLE,
                marginBottom: 0,
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', minWidth: 0 }}>
                <span style={{ fontSize: '0.75rem', flexShrink: 0 }} aria-hidden>
                  {memoSectionOpen ? '▼' : '\u25b6'}
                </span>
                <span
                  id="bill-customer-physical-memo-disclosure-heading"
                  style={{
                    fontWeight: 500,
                    fontSize: '0.875rem',
                    color: 'var(--text-700)',
                  }}
                >
                  Memo
                </span>
              </span>
              <span
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  flexShrink: 0,
                }}
              >
                {billCustomerMemoSummaryLine(externalNote)}
              </span>
            </button>
            <div
              id="bill-customer-physical-memo-section-panel"
              role="region"
              aria-labelledby="bill-customer-physical-memo-disclosure-heading"
              hidden={!memoSectionOpen}
              style={{ marginBottom: 0 }}
            >
              <span style={{ ...BILL_CUSTOMER_FIELD_LABEL_STYLE, fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                ({externalNote.length} / {BILL_CUSTOMER_MEMO_MAX_CHARS})
              </span>
              <BillCustomerMemoPresetRow
                presets={memoPresets}
                valueForHighlight={externalNote}
                onApplyBoth={applyMemoPresetToBoth}
              />
              <textarea
                value={externalNote}
                onChange={(e) => setExternalNote(e.target.value.slice(0, BILL_CUSTOMER_MEMO_MAX_CHARS))}
                rows={2}
                style={{ ...BILL_CUSTOMER_TEXTAREA_STYLE, marginBottom: 0, minHeight: '3.5rem' }}
              />
            </div>
            <button
              type="button"
              aria-expanded={physicalFooterSectionOpen}
              aria-controls="bill-customer-physical-footer-section-panel"
              onClick={() => setPhysicalFooterSectionOpen((v) => !v)}
              style={{
                ...BILL_CUSTOMER_DISCLOSURE_TOGGLE_STYLE,
                marginBottom: 0,
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', minWidth: 0 }}>
                <span style={{ fontSize: '0.75rem', flexShrink: 0 }} aria-hidden>
                  {physicalFooterSectionOpen ? '▼' : '\u25b6'}
                </span>
                <span
                  id="bill-customer-physical-footer-disclosure-heading"
                  style={{
                    fontWeight: 500,
                    fontSize: '0.875rem',
                    color: 'var(--text-700)',
                  }}
                >
                  Footer
                </span>
              </span>
              <span
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  flexShrink: 0,
                }}
              >
                {physicalInvoiceFooterSummaryLine(physicalInvoiceFooter)}
              </span>
            </button>
            <div
              id="bill-customer-physical-footer-section-panel"
              role="region"
              aria-labelledby="bill-customer-physical-footer-disclosure-heading"
              hidden={!physicalFooterSectionOpen}
              style={{ marginBottom: 0 }}
            >
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.5rem',
                  marginBottom: '0.35rem',
                }}
              >
                <span
                  id="bill-customer-physical-invoice-footer-count"
                  style={{
                    fontSize: '0.72rem',
                    color: 'var(--text-muted)',
                    fontWeight: 400,
                    flex: '1 1 auto',
                    minWidth: 0,
                  }}
                >
                  ({physicalInvoiceFooter.length} / {PHYSICAL_INVOICE_FOOTER_MAX_CHARS})
                </span>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.35rem',
                    alignItems: 'center',
                    flexShrink: 0,
                    justifyContent: 'flex-end',
                  }}
                >
                  {physicalFooterPresets.map((p) => {
                    const pressed = physicalFooterActiveId === p.id
                    return (
                      <button
                        key={p.id}
                        type="button"
                        aria-pressed={pressed}
                        onClick={() => {
                          if (pressed) {
                            setPhysicalInvoiceFooter('')
                            return
                          }
                          setPhysicalInvoiceFooter(p.body.slice(0, PHYSICAL_INVOICE_FOOTER_MAX_CHARS))
                        }}
                        title={`${p.label} physical footer (click again to clear)`}
                        style={{
                          padding: '0.25rem 0.5rem',
                          fontSize: '0.75rem',
                          border: pressed ? '2px solid #2563eb' : '1px solid var(--border-strong)',
                          borderRadius: 4,
                          background: pressed ? 'var(--bg-blue-tint)' : 'var(--bg-subtle)',
                          color: 'var(--text-700)',
                          cursor: 'pointer',
                          fontWeight: pressed ? 600 : 500,
                        }}
                      >
                        {p.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              <textarea
                id="bill-customer-physical-invoice-footer"
                aria-labelledby="bill-customer-physical-footer-disclosure-heading"
                aria-describedby="bill-customer-physical-invoice-footer-count"
                value={physicalInvoiceFooter}
                onChange={(e) =>
                  setPhysicalInvoiceFooter(e.target.value.slice(0, PHYSICAL_INVOICE_FOOTER_MAX_CHARS))
                }
                rows={3}
                style={{ ...BILL_CUSTOMER_TEXTAREA_STYLE, marginBottom: 0, minHeight: '4.5rem' }}
              />
            </div>
              </div>
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'flex-start',
                  gap: '1rem',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ flex: '0 1 auto', minWidth: '8.5rem' }}>
                  <span style={BILL_CUSTOMER_FIELD_LABEL_STYLE}>Service date</span>
                  <button
                    type="button"
                    onClick={() => {
                      setDraftServiceYmd(sentDate)
                      setDraftDueYmd(stripeDueDate)
                      setEditDueDateOpen(true)
                    }}
                    aria-label="Edit service date and due date"
                    style={BILL_CUSTOMER_PHYSICAL_DATE_LINK_BUTTON_STYLE}
                  >
                    {physicalServiceDateLinkLabel}
                  </button>
                </div>
                <div style={{ flex: '1 1 280px', minWidth: 0 }}>
                  <span style={BILL_CUSTOMER_FIELD_LABEL_STYLE}>Due date</span>
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.5rem',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setDraftServiceYmd(sentDate)
                        setDraftDueYmd(stripeDueDate)
                        setEditDueDateOpen(true)
                      }}
                      aria-label="Edit service date and due date"
                      style={BILL_CUSTOMER_PHYSICAL_DATE_LINK_BUTTON_STYLE}
                    >
                      {physicalDueDateLinkLabel}
                    </button>
                    <button
                      type="button"
                      disabled={!physicalDocPreview || physicalPdfPreviewLoading}
                      onClick={() => void openPhysicalInvoicePdfInNewTab()}
                      style={{
                        padding: '0.25rem 0.5rem',
                        fontSize: '0.8125rem',
                        border: '1px solid var(--border-strong)',
                        background: 'var(--bg-subtle)',
                        borderRadius: 4,
                        cursor:
                          !physicalDocPreview || physicalPdfPreviewLoading ? 'not-allowed' : 'pointer',
                        opacity: !physicalDocPreview || physicalPdfPreviewLoading ? 0.55 : 1,
                      }}
                    >
                      {physicalPdfPreviewLoading ? '…' : 'Preview'}
                    </button>
                    <button
                      type="button"
                      disabled={!physicalDocPreview}
                      onClick={() => openPhysicalInvoiceEmailPreviewInNewTab()}
                      title="See the exact email the customer will receive — nothing is sent"
                      style={{
                        padding: '0.25rem 0.5rem',
                        fontSize: '0.8125rem',
                        border: '1px solid var(--border-strong)',
                        background: 'var(--bg-subtle)',
                        borderRadius: 4,
                        cursor: !physicalDocPreview ? 'not-allowed' : 'pointer',
                        opacity: !physicalDocPreview ? 0.55 : 1,
                      }}
                    >
                      Preview email
                    </button>
                  </div>
                </div>
              </div>
            </div>
            {physicalDocPreview ? (
              <PhysicalInvoicePreview
                document={physicalDocPreview}
                hideIssuerContact
                emphasizeLowercaseLeadingDescriptions
                detailedServiceLineDescriptionClick={
                  physicalPreviewDbBacked ? openPhysicalServiceLineEdit : undefined
                }
                detailedMaterialLineDescriptionClick={
                  physicalPreviewDbBacked && authRole !== 'superintendent'
                    ? openPhysicalMaterialLineEdit
                    : undefined
                }
              />
            ) : (
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                Enter a valid bill amount and dates to preview the PDF.
              </p>
            )}
            {physicalError && <p style={{ color: 'var(--text-red-700)', fontSize: '0.875rem' }}>{physicalError}</p>}
            {lineLeadingLowercaseHint ? (
              <p
                id={BILL_CUSTOMER_LEADING_LOWERCASE_HINT_EL_ID}
                role="status"
                aria-live="polite"
                style={{
                  ...billCustomerLeadingLowercaseHintParagraphStyle,
                  marginBottom: '0.5rem',
                  marginTop: physicalError ? '0.35rem' : 0,
                  textAlign: 'center',
                }}
              >
                {BILL_CUSTOMER_LEADING_LOWERCASE_HINT}
              </p>
            ) : null}
            {hazmatIncidentForInvoice || foldedFeeIncidents.length > 0 ? (
              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.5rem',
                  margin: '0.5rem 0 0',
                  padding: '0.5rem 0.65rem',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  background: 'var(--bg-red-tint)',
                  fontSize: '0.8125rem',
                  color: 'var(--text-700)',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={attachHazmatNotice}
                  onChange={(e) => setAttachHazmatNotice(e.target.checked)}
                  style={{ marginTop: 2 }}
                />
                <span>
                  <strong>☣ Attach the Biohazard Remediation Fee Notice</strong> — sends the notice as a
                  second PDF alongside the invoice (incident summary, photos, statements, terms clause).
                </span>
              </label>
            ) : null}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
              <button type="button" onClick={onClose} style={{ padding: '0.5rem 1rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 4, cursor: 'pointer' }}>
                Cancel
              </button>
              <button
                type="button"
                disabled={!physicalSendReady || busy}
                aria-describedby={lineLeadingLowercaseHint ? BILL_CUSTOMER_LEADING_LOWERCASE_HINT_EL_ID : undefined}
                onClick={() => void submitPhysicalInvoiceEmail()}
                style={{
                  padding: '0.5rem 1rem',
                  background: physicalSendReady && !busy ? '#3b82f6' : '#9ca3af',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: physicalSendReady && !busy ? 'pointer' : 'not-allowed',
                }}
              >
                {busy ? '…' : 'Send email'}
              </button>
            </div>
          </>
        )}

        {tab === 'stripe' && (
          <div style={{ padding: '0.5rem 0' }}>
            {kind === 'job' && ensureLoading && (
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>Preparing billing line…</p>
            )}
            {kind === 'job' && !ensureLoading && ensureError && (
              <p style={{ color: 'var(--text-red-700)', fontSize: '0.875rem', marginBottom: '0.75rem' }}>{ensureError}</p>
            )}
            {stripeSuccessInvoice ? (
              <>
                <p style={{ fontSize: '0.875rem', color: '#15803d', marginBottom: '0.75rem', fontWeight: 600 }}>
                  Stripe invoice created
                  {stripeSuccessInvoice.stripe_invoice_status
                    ? ` (${stripeSuccessInvoice.stripe_invoice_status})`
                    : ''}
                  .
                </p>
                {hazmatNoticeEmailStatus ? (
                  <p
                    role="status"
                    style={{
                      margin: '-0.35rem 0 0.75rem',
                      fontSize: '0.8125rem',
                      color: hazmatNoticeEmailStatus === 'sent' ? 'var(--text-green-800)' : 'var(--text-red-700)',
                    }}
                  >
                    {hazmatNoticeEmailStatus === 'sent'
                      ? '☣ Biohazard notice emailed to the customer.'
                      : `☣ Notice email failed: ${hazmatNoticeEmailStatus} — re-send from Edit Job → Riders.`}
                  </p>
                ) : null}
                {!hazmatNoticeEmailStatus &&
                (hazmatIncidentForInvoice || foldedFeeIncidents.length > 0) &&
                (job.customer_email ?? '').trim() ? (
                  <div
                    style={{
                      margin: '-0.35rem 0 0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                      ☣ The Biohazard Fee Notice email has not been sent for this bill.
                    </span>
                    <button
                      type="button"
                      disabled={noticeEmailBusy}
                      onClick={() => void emailNoticeNow()}
                      style={{
                        padding: '0.3rem 0.7rem',
                        fontSize: '0.8125rem',
                        border: '1px solid var(--border-strong)',
                        borderRadius: 4,
                        background: 'var(--surface)',
                        cursor: noticeEmailBusy ? 'wait' : 'pointer',
                        fontWeight: 600,
                      }}
                    >
                      {noticeEmailBusy ? 'Sending…' : 'Email the notice now'}
                    </button>
                  </div>
                ) : null}
                <HostedStripeBillPanel
                  invoice={stripeSuccessInvoice}
                  onAfterOobUnwindSuccess={handleHostedStripeOobUnwindSuccess}
                  onAfterVoidStripeInvoiceSuccess={handleAfterVoidStripeInvoiceSuccess}
                  viewBillOnClose={onClose}
                  voidConfirmOverlayZIndex={overlayZIndex + 1}
                />
              </>
            ) : stripeResult ? (
              <>
                <p style={{ fontSize: '0.875rem', color: '#15803d', marginBottom: '0.5rem', fontWeight: 600 }}>
                  {stripeResult.idempotent ? 'Stripe invoice already exists.' : 'Stripe invoice created.'}{' '}
                  {stripeResult.stripe_invoice_status ? `(${stripeResult.stripe_invoice_status})` : ''}
                </p>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-amber-700)', marginBottom: '0.75rem' }}>
                  Could not reload job details; showing summary from the server response.
                </p>
                <StripeInvoiceSharePanel
                  hostedInvoiceUrl={stripeResult.hosted_invoice_url}
                  stripeInvoiceId={stripeResult.stripe_invoice_id}
                  customerEmail={job.customer_email}
                  customerName={job.customer_name}
                  jobName={job.job_name}
                  hcpNumber={job.hcp_number}
                  amountLabel={`$${Number(billAmountStr).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                />
                {stripeFallbackLedgerInvoiceId ? (
                  <StripeInvoiceSendFromStripeButton
                    jobsLedgerInvoiceId={stripeFallbackLedgerInvoiceId}
                    stripeInvoiceId={stripeResult.stripe_invoice_id}
                    customerEmail={job.customer_email}
                    stripeModeForBilling={stripeModeForBilling}
                  />
                ) : null}
                {stripeResult.invoice_preview ? (
                  <div style={{ marginTop: '0.75rem' }}>
                    <div
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: 'var(--text-700)',
                        margin: '0 0 0.35rem',
                      }}
                    >
                      Invoice (Stripe)
                    </div>
                    <StripeInvoicePreviewMeta
                      customerName={
                        stripeResult.invoice_preview.customer_name ?? job.customer_name
                      }
                      customerEmail={
                        stripeResult.invoice_preview.customer_email ?? job.customer_email
                      }
                      invoiceNumber={stripeResult.invoice_preview.invoice_number ?? null}
                      dueYmd={stripeDueDate}
                      memo={stripeMemo}
                      footer={stripeInvoiceFooter}
                    />
                    <StripeInvoiceLinesSummary snapshot={stripeResult.invoice_preview} showTitle={false} />
                  </div>
                ) : null}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                  <button
                    type="button"
                    onClick={onClose}
                    style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                  >
                    Done
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={BILL_CUSTOMER_INVOICE_MODIFICATIONS_SHELL_STYLE}>
                  <div style={BILL_CUSTOMER_INVOICE_MODIFICATIONS_TITLE_STYLE}>
                    Invoice Modifications (optional)
                  </div>
                  <div style={BILL_CUSTOMER_MODIFICATIONS_STACK_STYLE}>
                  <button
                    type="button"
                    aria-expanded={lineOnBillSectionOpen}
                    aria-controls="bill-customer-stripe-line-on-bill-section-panel"
                    onClick={() => setLineOnBillSectionOpen((v) => !v)}
                    style={{
                      ...BILL_CUSTOMER_DISCLOSURE_TOGGLE_STYLE,
                      marginBottom: 0,
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', minWidth: 0 }}>
                      <span style={{ fontSize: '0.75rem', flexShrink: 0 }} aria-hidden>
                        {lineOnBillSectionOpen ? '▼' : '\u25b6'}
                      </span>
                      <span
                        id="bill-customer-stripe-line-on-bill-disclosure-heading"
                        style={{
                          fontWeight: 500,
                          fontSize: '0.875rem',
                          color: 'var(--text-700)',
                        }}
                      >
                        Line item override
                      </span>
                    </span>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-muted)',
                        flexShrink: 0,
                      }}
                    >
                      {billCustomerLineOnBillSummaryLine(stripeLineDescription)}
                    </span>
                  </button>
                  <div
                    id="bill-customer-stripe-line-on-bill-section-panel"
                    role="region"
                    aria-labelledby="bill-customer-stripe-line-on-bill-disclosure-heading"
                    hidden={!lineOnBillSectionOpen}
                    style={{ marginBottom: 0 }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.5rem',
                        marginBottom: 4,
                        flexWrap: 'wrap',
                      }}
                    >
                      <span
                        id="bill-customer-stripe-line-on-bill-count"
                        style={{
                          fontSize: '0.72rem',
                          color: 'var(--text-muted)',
                          fontWeight: 400,
                          flex: '1 1 auto',
                          minWidth: 0,
                        }}
                      >
                        ({stripeLineDescription.length} / {STRIPE_INVOICE_LINE_DESCRIPTION_MAX})
                      </span>
                      <button
                        type="button"
                        onClick={() => job && setStripeLineDescription(defaultStripeLineDescriptionFromJob(job))}
                        disabled={!job}
                        title="Reset line item override to default"
                        aria-label="Reset line item override to default"
                        style={{
                          padding: 0,
                          border: 'none',
                          background: 'none',
                          color: 'var(--text-link)',
                          cursor: job ? 'pointer' : 'not-allowed',
                          fontSize: '0.8125rem',
                          textDecoration: 'underline',
                          textUnderlineOffset: '2px',
                          flexShrink: 0,
                        }}
                      >
                        default
                      </button>
                    </div>
                    <textarea
                      id="bill-customer-stripe-line-description"
                      aria-describedby="bill-customer-stripe-line-on-bill-count"
                      placeholder={BILL_CUSTOMER_LINE_ON_BILL_PLACEHOLDER}
                      value={stripeLineDescription}
                      onChange={(e) =>
                        setStripeLineDescription(
                          e.target.value.slice(0, STRIPE_INVOICE_LINE_DESCRIPTION_MAX),
                        )
                      }
                      rows={2}
                      style={{
                        ...BILL_CUSTOMER_TEXTAREA_STYLE,
                        marginBottom: 0,
                        minHeight: '3.5rem',
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    aria-expanded={memoSectionOpen}
                    aria-controls="bill-customer-stripe-memo-section-panel"
                    onClick={() => setMemoSectionOpen((v) => !v)}
                    style={{
                      ...BILL_CUSTOMER_DISCLOSURE_TOGGLE_STYLE,
                      marginBottom: 0,
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', minWidth: 0 }}>
                      <span style={{ fontSize: '0.75rem', flexShrink: 0 }} aria-hidden>
                        {memoSectionOpen ? '▼' : '\u25b6'}
                      </span>
                      <span
                        id="bill-customer-stripe-memo-disclosure-heading"
                        style={{
                          fontWeight: 500,
                          fontSize: '0.875rem',
                          color: 'var(--text-700)',
                        }}
                      >
                        Memo
                      </span>
                    </span>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-muted)',
                        flexShrink: 0,
                      }}
                    >
                      {billCustomerMemoSummaryLine(stripeMemo)}
                    </span>
                  </button>
                  <div
                    id="bill-customer-stripe-memo-section-panel"
                    role="region"
                    aria-labelledby="bill-customer-stripe-memo-disclosure-heading"
                    hidden={!memoSectionOpen}
                    style={{ marginBottom: 0 }}
                  >
                    <span style={{ ...BILL_CUSTOMER_FIELD_LABEL_STYLE, fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                      ({stripeMemo.length} / {BILL_CUSTOMER_MEMO_MAX_CHARS})
                    </span>
                    <BillCustomerMemoPresetRow
                      presets={memoPresets}
                      valueForHighlight={stripeMemo}
                      onApplyBoth={applyMemoPresetToBoth}
                    />
                    <textarea
                      value={stripeMemo}
                      onChange={(e) => setStripeMemo(e.target.value.slice(0, BILL_CUSTOMER_MEMO_MAX_CHARS))}
                      rows={2}
                      style={{ ...BILL_CUSTOMER_TEXTAREA_STYLE, marginBottom: 0, minHeight: '3.5rem' }}
                    />
                  </div>
                  <button
                    type="button"
                    aria-expanded={stripeFooterSectionOpen}
                    aria-controls="bill-customer-footer-section-panel"
                    onClick={() => setStripeFooterSectionOpen((v) => !v)}
                    style={{
                      ...BILL_CUSTOMER_DISCLOSURE_TOGGLE_STYLE,
                      marginBottom: 0,
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', minWidth: 0 }}>
                      <span style={{ fontSize: '0.75rem', flexShrink: 0 }} aria-hidden>
                        {stripeFooterSectionOpen ? '▼' : '\u25b6'}
                      </span>
                      <span
                        id="bill-customer-footer-disclosure-heading"
                        style={{
                          fontWeight: 500,
                          fontSize: '0.875rem',
                          color: 'var(--text-700)',
                        }}
                      >
                        Footer
                      </span>
                    </span>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-muted)',
                        flexShrink: 0,
                      }}
                    >
                      {stripeInvoiceFooterSummaryLine(stripeInvoiceFooter, activeStripeFooterPreset)}
                    </span>
                  </button>
                  <div
                    id="bill-customer-footer-section-panel"
                    role="region"
                    aria-labelledby="bill-customer-footer-disclosure-heading"
                    hidden={!stripeFooterSectionOpen}
                    style={{ marginBottom: 0 }}
                  >
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '0.5rem',
                          marginBottom: '0.35rem',
                        }}
                      >
                        <span
                          id="bill-customer-stripe-invoice-footer-count"
                          style={{
                            fontSize: '0.72rem',
                            color: 'var(--text-muted)',
                            fontWeight: 400,
                            flex: '1 1 auto',
                            minWidth: 0,
                          }}
                        >
                          ({stripeInvoiceFooter.length} / {STRIPE_INVOICE_FOOTER_MAX_CHARS})
                        </span>
                        <div
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '0.35rem',
                            alignItems: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <button
                            type="button"
                            aria-pressed={activeStripeFooterPreset === 'plumbing'}
                            onClick={() => {
                              if (activeStripeFooterPreset === 'plumbing') {
                                setStripeInvoiceFooter('')
                                return
                              }
                              setStripeInvoiceFooter(
                                getStripeInvoiceFooterPresetPlumbing().slice(0, STRIPE_INVOICE_FOOTER_MAX_CHARS),
                              )
                            }}
                            title="Plumbing footer (click again to clear and use Stripe default)"
                            style={{
                              padding: '0.25rem 0.5rem',
                              fontSize: '0.75rem',
                              border:
                                activeStripeFooterPreset === 'plumbing'
                                  ? '2px solid #2563eb'
                                  : '1px solid #d1d5db',
                              borderRadius: 4,
                              background: activeStripeFooterPreset === 'plumbing' ? 'var(--bg-blue-tint)' : 'var(--bg-subtle)',
                              color: 'var(--text-700)',
                              cursor: 'pointer',
                              fontWeight: activeStripeFooterPreset === 'plumbing' ? 600 : 500,
                            }}
                          >
                            Plumbing
                          </button>
                          <button
                            type="button"
                            aria-pressed={activeStripeFooterPreset === 'electrical'}
                            onClick={() => {
                              if (activeStripeFooterPreset === 'electrical') {
                                setStripeInvoiceFooter('')
                                return
                              }
                              setStripeInvoiceFooter(
                                getStripeInvoiceFooterPresetElectrical().slice(0, STRIPE_INVOICE_FOOTER_MAX_CHARS),
                              )
                            }}
                            title="Electrical footer (click again to clear and use Stripe default)"
                            style={{
                              padding: '0.25rem 0.5rem',
                              fontSize: '0.75rem',
                              border:
                                activeStripeFooterPreset === 'electrical'
                                  ? '2px solid #2563eb'
                                  : '1px solid #d1d5db',
                              borderRadius: 4,
                              background: activeStripeFooterPreset === 'electrical' ? 'var(--bg-blue-tint)' : 'var(--bg-subtle)',
                              color: 'var(--text-700)',
                              cursor: 'pointer',
                              fontWeight: activeStripeFooterPreset === 'electrical' ? 600 : 500,
                            }}
                          >
                            Electrical
                          </button>
                        </div>
                      </div>
                      <textarea
                        id="bill-customer-stripe-invoice-footer"
                        aria-labelledby="bill-customer-footer-disclosure-heading"
                        aria-describedby="bill-customer-stripe-invoice-footer-count"
                        value={stripeInvoiceFooter}
                        onChange={(e) =>
                          setStripeInvoiceFooter(e.target.value.slice(0, STRIPE_INVOICE_FOOTER_MAX_CHARS))
                        }
                        rows={3}
                        style={{ ...BILL_CUSTOMER_TEXTAREA_STYLE, marginBottom: 0, minHeight: '4.5rem' }}
                      />
                  </div>
                  </div>
                </div>
                {job ? (
                  <StripeBillPreSubmitPreview
                    customerName={job.customer_name}
                    customerEmail={job.customer_email}
                    jobName={job.job_name}
                    hcpNumber={job.hcp_number}
                    amountLabel={
                      Number.isFinite(Number(billAmountStr)) && Number(billAmountStr) > 0
                        ? `$${Number(billAmountStr).toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}`
                        : '—'
                    }
                    dueDateYmd={stripeDueDate}
                    memo={stripeMemo}
                    footer={stripeFooterSectionOpen ? stripeInvoiceFooter : ''}
                    localLineDescription={
                      stripeLineDescription.trim() || defaultStripeLineDescriptionFromJob(job)
                    }
                    stripePreview={stripePreview}
                    stripePreviewLoading={stripePreviewLoading}
                    stripePreviewError={stripePreviewError}
                    previewIdleHint={
                      kind === 'job' && ensureLoading
                        ? 'Preparing billing line…'
                        : kind === 'job' && !ensureLoading && ensureError
                          ? 'Fix the billing line error above, then edit due date in What the customer will see when ready.'
                          : null
                    }
                    onEditDueDate={() => {
                      setDraftDueYmd(stripeDueDate)
                      setEditDueDateOpen(true)
                    }}
                    emphasizeLowercaseLeadingDescriptions
                    onLineDescriptionClick={handleStripePreviewLineClick}
                    stripeLineOverrideActive={stripeLineDescription.trim() !== ''}
                  />
                ) : null}
                {stripeError && <p style={{ color: 'var(--text-red-700)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>{stripeError}</p>}
                {lineLeadingLowercaseHint ? (
                  <p
                    id={BILL_CUSTOMER_LEADING_LOWERCASE_HINT_EL_ID}
                    role="status"
                    aria-live="polite"
                    style={{
                      ...billCustomerLeadingLowercaseHintParagraphStyle,
                      marginBottom: '0.5rem',
                      textAlign: 'center',
                    }}
                  >
                    {BILL_CUSTOMER_LEADING_LOWERCASE_HINT}
                  </p>
                ) : null}
                {hazmatIncidentForInvoice || foldedFeeIncidents.length > 0 ? (
                  <div
                    style={{
                      margin: '0.5rem 0 0',
                      padding: '0.5rem 0.65rem',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      background: 'var(--bg-red-tint)',
                      fontSize: '0.8125rem',
                      color: 'var(--text-700)',
                    }}
                  >
                    {foldedFeeLines.length > 0 ? (
                      <p style={{ margin: '0 0 0.5rem' }}>
                        <strong>
                          ☣ This bill includes {foldedFeeLines.length === 1 ? 'a hazmat fee' : 'hazmat fees'} ($
                          {hazmatRollInTotalDollars(foldedFeeLines).toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                          )
                        </strong>{' '}
                        — already part of the amount above.{' '}
                        {stripeLineDescription.trim()
                          ? 'Your Line item override covers it, so no separate fee line will appear.'
                          : 'It will appear on the invoice as its own labeled line item, with the rest allocated to the work lines.'}
                      </p>
                    ) : null}
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={emailHazmatNoticeWithStripe}
                        onChange={(e) => setEmailHazmatNoticeWithStripe(e.target.checked)}
                        style={{ marginTop: 2 }}
                      />
                      <span>
                        <strong>Also email the Biohazard Remediation Fee Notice</strong> — Stripe invoices
                        can't carry attachments, so the notice PDF goes to the customer as its own email.
                        Re-send any time from Edit Job → Riders.
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={openHazmatNoticeEmailPreview}
                      style={{ marginTop: '0.4rem', marginLeft: '1.6rem', padding: 0, border: 'none', background: 'none', color: 'var(--text-link)', fontSize: '0.8125rem', cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      Preview the email…
                    </button>
                  </div>
                ) : null}
                {!hazmatIncidentForInvoice && hazmatRollInLines.length > 0 ? (
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.5rem',
                      margin: '0.5rem 0 0',
                      padding: '0.5rem 0.65rem',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      background: 'var(--bg-red-tint)',
                      fontSize: '0.8125rem',
                      color: 'var(--text-700)',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={includeHazmatRollIn}
                      onChange={(e) => setIncludeHazmatRollIn(e.target.checked)}
                      style={{ marginTop: 2 }}
                    />
                    <span>
                      <strong>
                        ☣ Include hazmat fee ($
                        {hazmatRollInTotalDollars(hazmatRollInLines).toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                        ) as a line item
                      </strong>{' '}
                      — the unsent biohazard fee bill folds into this invoice as its own labeled line and the
                      separate draft is removed. Uncheck to keep billing it separately.
                      {Number.isFinite(Number(billAmountStr)) && Number(billAmountStr) > 0 ? (
                        <>
                          {' '}
                          Invoice total becomes{' '}
                          <strong>
                            $
                            {(Number(billAmountStr) + hazmatRollInTotalDollars(hazmatRollInLines)).toLocaleString(
                              'en-US',
                              { minimumFractionDigits: 2, maximumFractionDigits: 2 },
                            )}
                          </strong>
                          .
                        </>
                      ) : null}
                    </span>
                  </label>
                ) : null}
                {hazmatNoticeEmailStatus ? (
                  <p
                    role="status"
                    style={{
                      margin: '0.35rem 0 0',
                      fontSize: '0.8125rem',
                      color: hazmatNoticeEmailStatus === 'sent' ? 'var(--text-green-800)' : 'var(--text-red-700)',
                    }}
                  >
                    {hazmatNoticeEmailStatus === 'sent'
                      ? 'Notice emailed to the customer.'
                      : `Notice email failed: ${hazmatNoticeEmailStatus} — re-send from Edit Job → Riders.`}
                  </p>
                ) : null}
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={onClose}
                    style={{ padding: '0.5rem 1rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 4, cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!outsideReady || busy}
                    aria-describedby={lineLeadingLowercaseHint ? BILL_CUSTOMER_LEADING_LOWERCASE_HINT_EL_ID : undefined}
                    onClick={() => void submitStripeInvoice()}
                    style={{
                      padding: '0.5rem 1rem',
                      background: outsideReady && !busy ? '#3b82f6' : '#9ca3af',
                      color: 'white',
                      border: 'none',
                      borderRadius: 4,
                      cursor: outsideReady && !busy ? 'pointer' : 'not-allowed',
                    }}
                  >
                    {busy ? '…' : 'Create Stripe invoice'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
    {editDueDateOpen ? (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.45)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: overlayZIndex + 20,
          padding: '1rem',
        }}
        role="presentation"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) setEditDueDateOpen(false)
        }}
      >
        <div
          role="dialog"
          aria-labelledby="edit-bill-customer-dates-title"
          style={{
            background: 'var(--surface)',
            padding: '1.25rem',
            borderRadius: 8,
            minWidth: 280,
            maxWidth: 400,
            boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <h2 id="edit-bill-customer-dates-title" style={{ margin: '0 0 0.75rem', fontSize: '1.1rem', fontWeight: 600 }}>
            {tab === 'physical' ? 'Edit dates' : 'Edit Due Date'}
          </h2>
          {tab === 'physical' ? (
            <>
              <label htmlFor="bill-customer-edit-service-date" style={{ ...BILL_CUSTOMER_FIELD_LABEL_STYLE, display: 'block' }}>
                Service date
              </label>
              <input
                id="bill-customer-edit-service-date"
                type="date"
                value={draftServiceYmd}
                onChange={(e) => setDraftServiceYmd(e.target.value)}
                style={{ ...billDateInputStyle, marginBottom: '1rem' }}
              />
            </>
          ) : null}
          <label htmlFor="bill-customer-edit-due-date" style={{ ...BILL_CUSTOMER_FIELD_LABEL_STYLE, display: 'block' }}>
            Due date
          </label>
          <input
            id="bill-customer-edit-due-date"
            type="date"
            value={draftDueYmd}
            onChange={(e) => setDraftDueYmd(e.target.value)}
            style={{ ...billDateInputStyle, marginBottom: '1rem' }}
          />
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setEditDueDateOpen(false)}
              style={{ padding: '0.5rem 1rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 4, cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (tab === 'physical') {
                  setSentDate(draftServiceYmd.trim())
                }
                setStripeDueDate(draftDueYmd.trim())
                setEditDueDateOpen(false)
              }}
              style={{
                padding: '0.5rem 1rem',
                background: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    ) : null}
    <BillCustomerPreviewLineEditModal
      open={lineEditSession != null}
      session={lineEditSession}
      onClose={() => setLineEditSession(null)}
      zIndex={overlayZIndex + 30}
      materialEditDisabled={authRole === 'superintendent'}
      materialEditDisabledReason="Superintendents cannot edit materials from Bill Customer. Use Edit Job or ask office staff."
      onFixtureSaved={refreshBillCustomerJobDetails}
      onMaterialSaved={refreshBillCustomerJobDetails}
      onStripeOverrideSaved={async (text) => {
        setStripeLineDescription(text)
        await refreshBillCustomerJobDetails()
      }}
    />
    </Fragment>
  )
}
