import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Database } from '../../types/database'
import type { JobWithDetails } from '../../types/jobWithDetails'
import {
  LIEN_WAIVER_FORM_CITES,
  UNCONDITIONAL_WAIVER_WARNING,
  buildLienWaiverParagraphs,
  buildLienWaiverPdfBlob,
  buildLienWaiverPrefill,
  buildLienWaiverFoot,
  buildLienWaiverPrintHtml,
  lienWaiverDate,
  lienWaiverDatesUnfinished,
  lienWaiverFormFrom,
  lienWaiverInvoiceOpenRemaining,
  lienWaiverMoney,
  lienWaiverPrefillAmount,
  lienWaiverPdfFilename,
  lienWaiverTitle,
  lienWaiverToggles,
  lienWaiverUnfinishedDateBlocksIssue,
  lienWaiverUsesField,
  lienWaiverWhy,
  pickLienWaiverForBill,
  type LienWaiverFields,
  type LienWaiverFormType,
  type LienWaiverSignature,
} from '../../lib/jobsDocuments/lienWaiverRelease'
import { sendLienReleaseEmailToCustomer } from '../../lib/sendLienReleaseEmail'
import { draftHeldByDateMessage } from '../../lib/autosaveDateHold'
import { openHtmlWindowWhenReady } from '../../lib/jobsDocuments/printWindow'
import { printAndFile, printWhenReadyAndFile } from '../../lib/sent/sentCopiesIo'
import { lienReleaseRowSignatureWithInk, lienReleaseSignedPdfBlob, loadLienReleaseInk } from '../../lib/jobs/lienReleaseInk'
import {
  isConditionalLienForm,
  isLienWaiverFormType,
  lienReleaseFieldsFromSnapshot,
  lienReleaseFormLabel,
  liveLienReleases,
  type JobLienReleaseRow,
} from '../../lib/jobs/lienReleaseTracking'
import {
  lienReleaseCancelTarget,
  lienReleaseChips,
  lienReleaseIsEditable,
  lienReleaseIsMinted,
  lienReleaseRowSignature,
  lienReleaseSignatureAuditLine,
  lienReleaseStatus,
  type LienReleaseChip,
} from '../../lib/jobs/lienReleaseLifecycle'
import { LIEN_RELEASE_DOCUMENTS_BUCKET, lienReleaseMintedPdfPath } from '../../lib/jobs/lienReleaseDocuments'
import LienReleaseSignModal from './LienReleaseSignModal'
import { LienWaiverFootPreview } from './LienWaiverFootPreview'
import { MarkedWaiverAmount, WaiverCoveredNote, WaiverMathBox, WaiverPaidNote } from './LienWaiverAmountMath'
import { LienReleaseStepRow, LienWaiverSignedLook } from './LienReleaseStepRow'
import { MoneyTypingInput } from '../MoneyTypingInput'
import { lienReleaseSteps, releaseStepLookNote, releaseStepPagePart } from '../../lib/jobs/lienReleaseSteps'
import { lienReleaseBillStatusWord, lienReleaseOpening, lienReleaseSelectableInvoices } from '../../lib/jobs/lienReleaseOpening'
import { lienWaiverAlreadyCovered, lienWaiverAmountMath, lienWaiverPaidUnwaived } from '../../lib/jobs/lienWaiverAmountMath'
import {
  customerAddressLienGaps,
  customerAddressLienReady,
  lienPropertyOwnerDisplayName,
  resolveLienProperty,
  suggestCustomerAddressForJob,
  type CustomerAddressRow,
  type JobPropertyOwnerLike,
} from '../../lib/jobs/lienProperty'
import { fetchPhysicalInvoiceIssuerFromAppSettings, getPhysicalInvoiceIssuerDraft } from '../../lib/physicalInvoiceIssuer'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { useNavigate } from 'react-router-dom'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { useAuth } from '../../hooks/useAuth'

type JobsLedgerInvoice = Database['public']['Tables']['jobs_ledger_invoices']['Row']

/**
 * Release of lien modal (v2.2579): generate one of the four owner-drafted
 * waiver-and-release forms straight from a Stages row — prefilled from the
 * job's bill lines, owner row, and the physical-invoice issuer; every field
 * editable; output via copy-for-email, print, or PDF download. Document
 * content lives in `src/lib/jobsDocuments/lienWaiverRelease.ts`.
 *
 * v2.4274 (our waiver to the GC): the form is two toggles — Conditional |
 * Unconditional, Progress | Final — pre-set from the bill when one is chosen
 * (`pickLienWaiverForBill`), with one line of why. The signer block names the
 * job's leader: *Later, from his desk* requests the signature as before; *He
 * signs now* lets the leader draw on this screen (or a phone handed to him) —
 * the signer of record is the leader, the device is named. A signed waiver has
 * *Send to <GC>*: the GC's billing email on a sub job, else the customer's.
 *
 * v2.4314: the left side is six numbered steps on a rail (`lienReleaseSteps`, `LienReleaseStepRow`)
 * — 1 Pick the bills · 2 Check the form · 3 Check the amount · 4 Check the details · 5 Get it
 * signed · 6 Send it — each a tick, the one to do, a fix, or waiting; a problem holds the steps
 * after it; the page beside them stays in view and marks what the current step fills. 1200 px wide.
 */

type MasterOption = { id: string; name: string }

const seg = (on: boolean, disabled = false): React.CSSProperties => ({
  padding: '0.35rem 0.75rem',
  fontSize: '0.8125rem',
  fontWeight: 600,
  border: 'none',
  background: on ? 'var(--text-strong)' : 'var(--surface)',
  color: on ? 'var(--surface)' : 'var(--text-700)',
  cursor: disabled ? 'default' : 'pointer',
  opacity: disabled && !on ? 0.5 : 1,
})
const segWrap: React.CSSProperties = { display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 8, overflow: 'hidden' }

const FIELD_LABELS: Record<keyof LienWaiverFields, string> = {
  companyName: 'Contractor / releasing party',
  checkFrom: 'Check from (owner / GC)',
  amount: 'Amount ($)',
  projectDescription: 'Project (name — address)',
  throughDate: 'Progress payments through',
  signedDate: 'Signature date',
  signerName: 'Signed by (the leader)',
  signerTitle: 'His title',
}

const FIELD_ORDER: (keyof LienWaiverFields)[] = [
  'checkFrom',
  'amount',
  'companyName',
  'projectDescription',
  'throughDate',
  'signedDate',
  'signerName',
  'signerTitle',
]

/** Chip styles for the lifecycle states (matches the age-chip idiom). */
function lienChipStyle(c: LienReleaseChip): React.CSSProperties {
  const base: React.CSSProperties = {
    fontSize: '0.68rem',
    fontWeight: 700,
    padding: '0.05rem 0.4rem',
    borderRadius: 9999,
    whiteSpace: 'nowrap',
  }
  switch (c.tone) {
    case 'awaiting':
      return { ...base, background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)' }
    case 'signed':
    case 'sent':
      return { ...base, background: 'var(--bg-green-tint)', color: 'var(--text-green-700)' }
    case 'voided':
      return { ...base, background: 'var(--bg-red-100)', color: 'var(--text-red-700)' }
    default:
      return { ...base, background: 'var(--bg-subtle)', color: 'var(--text-muted)', border: '1px solid var(--border)' }
  }
}

export default function LienReleaseModal({
  open,
  onClose,
  job,
  invoice,
  signerNameFallback,
  onIssued,
  initialFormType,
}: {
  open: boolean
  onClose: () => void
  job: JobWithDetails | null
  /** Row-level hint: preselect this bill line when it is selectable. */
  invoice: JobsLedgerInvoice | null
  /** Job master's People "Full name and title" with session-name fallback (same line the lien prefill uses). */
  signerNameFallback: string
  /** Fired after a release row is recorded (v2.2582) so openers can refresh badges/strips. */
  onIssued?: () => void
  /** Open on this form type instead of conditional-progress (e.g. the unconditional follow-up). */
  initialFormType?: LienWaiverFormType
}) {
  const { role: authRole, user: authUser, profileName } = useAuth()
  const { showToast } = useToastContext()
  const confirmDialog = useConfirmDialog()
  const [formType, setFormType] = useState<LienWaiverFormType>('conditional_progress')
  // v2.4274: the leaders who can sign (the job's master first), the one standing here, and the GC's email.
  const [masters, setMasters] = useState<MasterOption[]>([])
  const [presentSignerId, setPresentSignerId] = useState<string | null>(null)
  const [presentOpen, setPresentOpen] = useState(false)
  const [gcEmail, setGcEmail] = useState<string | null>(null)
  const [sendBusy, setSendBusy] = useState(false)
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<ReadonlySet<string>>(() => new Set())
  const [fields, setFields] = useState<LienWaiverFields | null>(null)
  const [issuerGen, setIssuerGen] = useState(0)
  const [pdfBusy, setPdfBusy] = useState(false)
  // The row this modal session works on: an autosaving draft until an output
  // action mints it (v2.2619 — the mint gate), then the locked minted row.
  const [releaseRow, setReleaseRow] = useState<JobLienReleaseRow | null>(null)
  const [autosaveState, setAutosaveState] = useState<'idle' | 'saving' | 'saved' | 'error' | 'held'>('idle')
  const [mintBusy, setMintBusy] = useState(false)
  const [signOpen, setSignOpen] = useState(false)
  // True once the user actually edits — mere open/close never mints a draft.
  const userTouchedRef = useRef(false)
  /** v2.4285: the signer lines follow the leader picked (and Settings → Jobs & billing) until someone types in them. */
  const signerTouchedRef = useRef(false)
  // Resumed drafts keep their saved fields — the prefill rebuild stays off.
  const hydratedDraftRef = useRef(false)
  // Issued-on-this-job history (v2.2588): reachable from every row with the
  // release button — billed rows have no Bill Customer, so the strip alone
  // couldn't view/void there. Fail-soft like the strip.
  const [historyRows, setHistoryRows] = useState<JobLienReleaseRow[]>([])
  /** The job's releases have been read for this open: only then is it known whether a draft resumes. */
  const [historyReady, setHistoryReady] = useState(false)
  /** The window opened on an unconditional form nobody pressed for (v2.4582): asked once the history is read. */
  const openUnconditionalAskRef = useRef<{ preset: boolean; fallback: LienWaiverFormType } | null>(null)
  const [voidPendingId, setVoidPendingId] = useState<string | null>(null)

  const loadHistory = useCallback(async () => {
    if (!job?.id) {
      setHistoryRows([])
      return
    }
    try {
      const { data } = await supabase
        .from('job_lien_releases')
        .select('*')
        .eq('job_id', job.id)
        .order('created_at', { ascending: false })
      setHistoryRows((data ?? []) as JobLienReleaseRow[])
    } catch {
      setHistoryRows([])
    } finally {
      setHistoryReady(true)
    }
  }, [job?.id])

  useEffect(() => {
    if (!open) {
      setHistoryRows([])
      setHistoryReady(false)
      setVoidPendingId(null)
      return
    }
    void loadHistory()
  }, [open, loadHistory])

  // The pick belongs to one opening on one job (v2.4567): cleared here, the load below sets this job's default.
  useEffect(() => {
    setPresentSignerId(null)
  }, [open, job?.id])

  useEffect(() => {
    if (!open || !job) {
      setMasters([])
      setGcEmail(null)
      setPresentOpen(false)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const { data } = await supabase.from('users').select('id, name, notes, archived_at').eq('role', 'master_technician')
        if (cancelled) return
        const rows = ((data ?? []) as Array<{ id: string; name: string | null; notes: string | null; archived_at: string | null }>)
          .filter((u) => !u.archived_at)
          .map((u) => ({ id: u.id, name: (u.notes?.trim() || u.name?.trim() || 'the leader').replace(/,.*$/, '') }))
          .sort((a, b) => (a.id === job.master_user_id ? -1 : b.id === job.master_user_id ? 1 : a.name.localeCompare(b.name)))
        setMasters(rows)
        // v2.4285: the company's signer (Settings → Jobs & billing) is the default; the job's master, then anyone, after.
        const companySigner = (getPhysicalInvoiceIssuerDraft().signerName ?? '').trim().toLowerCase()
        const byCompany = companySigner ? rows.find((r) => r.name.trim().toLowerCase() === companySigner)?.id : undefined
        setPresentSignerId((cur) => cur ?? byCompany ?? job.master_user_id ?? rows[0]?.id ?? null)
      } catch {
        setMasters([])
      }
      if (job.gc_customer_id) {
        try {
          const { data } = await supabase.from('customers').select('billing_email').eq('id', job.gc_customer_id).maybeSingle()
          if (!cancelled) setGcEmail(((data as { billing_email?: string | null } | null)?.billing_email ?? '').trim() || null)
        } catch {
          if (!cancelled) setGcEmail(null)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, job?.id, job?.master_user_id, job?.gc_customer_id])

  const issuer = useMemo(() => (open ? getPhysicalInvoiceIssuerDraft() : null), [open, issuerGen])

  // Company issuer block (same org-wide settings the physical invoice stamps).
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

  // Owner precedence (v2.2614): per-job job_property_owners override → the
  // linked property record's owner → (blank → GC/customer fallback downstream).
  const [jobOwnerRow, setJobOwnerRow] = useState<JobPropertyOwnerLike>(null)
  useEffect(() => {
    if (!open || !job) {
      setJobOwnerRow(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const { data } = await supabase
          .from('job_property_owners')
          .select('owner_mode, owner_name, company_name, mailing_address')
          .eq('job_id', job.id)
          .maybeSingle()
        if (cancelled) return
        setJobOwnerRow((data as JobPropertyOwnerLike) ?? null)
      } catch {
        // prefill nicety — the field stays editable either way
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, job?.id])

  // Property record (v2.2614): the job's linked customer_addresses row, plus
  // link candidates (the job customer's + GC's addresses) when unlinked.
  const [linkedAddress, setLinkedAddress] = useState<CustomerAddressRow | null>(null)
  const [candidateAddresses, setCandidateAddresses] = useState<CustomerAddressRow[]>([])
  const [linkChoiceId, setLinkChoiceId] = useState<string>('')
  const [linkBusy, setLinkBusy] = useState(false)

  const loadPropertyRecord = useCallback(async () => {
    if (!job?.id) {
      setLinkedAddress(null)
      setCandidateAddresses([])
      return
    }
    try {
      const linkedId = job.customer_address_id ?? null
      if (linkedId) {
        const { data } = await supabase.from('customer_addresses').select('*').eq('id', linkedId).maybeSingle()
        setLinkedAddress((data as CustomerAddressRow) ?? null)
        setCandidateAddresses([])
        return
      }
      setLinkedAddress(null)
      const customerIds = [job.customer_id, job.gc_customer_id].filter((v): v is string => Boolean(v))
      if (customerIds.length === 0) {
        setCandidateAddresses([])
        return
      }
      const { data } = await supabase
        .from('customer_addresses')
        .select('*')
        .in('customer_id', customerIds)
        .order('sequence_order', { ascending: true })
      const rows = (data ?? []) as CustomerAddressRow[]
      setCandidateAddresses(rows)
      setLinkChoiceId(suggestCustomerAddressForJob(job.job_address ?? '', rows)?.id ?? '')
    } catch {
      setLinkedAddress(null)
      setCandidateAddresses([])
    }
  }, [job])

  useEffect(() => {
    if (!open) {
      setLinkedAddress(null)
      setCandidateAddresses([])
      setLinkChoiceId('')
      return
    }
    void loadPropertyRecord()
  }, [open, loadPropertyRecord])

  const linkPropertyRecord = useCallback(async () => {
    if (!job?.id || !linkChoiceId || linkBusy) return
    setLinkBusy(true)
    try {
      await withSupabaseRetry(
        () => supabase.from('jobs_ledger').update({ customer_address_id: linkChoiceId }).eq('id', job.id),
        'link job to property record',
      )
      const chosen = candidateAddresses.find((r) => r.id === linkChoiceId) ?? null
      setLinkedAddress(chosen)
      setCandidateAddresses([])
      showToast('Property record linked to the job.', 'success')
    } catch {
      showToast('Could not link the property record.', 'error')
    } finally {
      setLinkBusy(false)
    }
  }, [job?.id, linkChoiceId, linkBusy, candidateAddresses, showToast])

  const resolvedProperty = useMemo(() => resolveLienProperty(linkedAddress, jobOwnerRow), [linkedAddress, jobOwnerRow])
  const ownerName = useMemo(() => lienPropertyOwnerDisplayName(resolvedProperty.owner) || null, [resolvedProperty])

  // #87 I: a paid bill is a line a release can cover — what an unconditional is for.
  const invoices = useMemo(() => (job ? lienReleaseSelectableInvoices(job.invoices) : []), [job])

  // Open-reset: default the selection to the row's invoice, else billed lines, else everything selectable.
  useEffect(() => {
    if (!open || !job) return
    setReleaseRow(null)
    setAutosaveState('idle')
    setSignOpen(false)
    userTouchedRef.current = false
    signerTouchedRef.current = false
    hydratedDraftRef.current = false
    // The row's bill alone, picking its own form (v2.4274) unless the opener asked for one; else the billed
    // lines. A paid bill (#87 I) is selected only when it is the row's bill — Add the unconditional's.
    const opening = lienReleaseOpening({
      selectable: lienReleaseSelectableInvoices(job.invoices),
      invoiceId: invoice?.id ?? null,
      initialFormType: initialFormType ?? null,
      formForBill: (id) => {
        const bill = (job.invoices ?? []).find((i) => i.id === id)
        return bill ? pickLienWaiverForBill(job, bill).formType : 'conditional_progress'
      },
    })
    setFormType(opening.formType)
    openUnconditionalAskRef.current = opening.askUnconditional
    setSelectedInvoiceIds(new Set(opening.invoiceIds))
  }, [open, job?.id, invoice?.id, initialFormType])

  // Resume the newest live draft (v2.2619) — and, since v2.2641, a pending
  // awaiting-signature release too: while a request is out, reopening the
  // modal must show the amber strip (Cancel request / Sign now) instead of a
  // fresh form, or the request becomes uncancelable once the modal closes.
  // Signed/sent/issued rows do NOT resume — the modal is then for the next
  // release, and those live in the history box.
  useEffect(() => {
    if (!open || releaseRow) return
    const draft =
      historyRows.find((r) => lienReleaseStatus(r) === 'draft' && !r.voided_at) ??
      historyRows.find((r) => lienReleaseStatus(r) === 'awaiting_signature' && !r.voided_at)
    if (!draft) return
    hydratedDraftRef.current = true
    setReleaseRow(draft)
    if (isLienWaiverFormType(draft.form_type)) setFormType(draft.form_type)
    setSelectedInvoiceIds(new Set(draft.invoice_ids ?? []))
    const s = lienReleaseFieldsFromSnapshot(draft.fields)
    setFields({
      companyName: s.companyName ?? '',
      checkFrom: s.checkFrom ?? '',
      amount: s.amount ?? String(draft.amount ?? ''),
      projectDescription: s.projectDescription ?? '',
      throughDate: s.throughDate ?? draft.through_date ?? '',
      signedDate: s.signedDate ?? draft.signed_date ?? '',
      signerName: s.signerName ?? '',
      signerTitle: s.signerTitle ?? '',
    })
    setAutosaveState('saved')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, historyRows])

  // Every route into Unconditional asks (v2.4582, the owner's call on punch list #83 row 1): a window opened
  // already on an unconditional form — Issue unconditional's preset, or a settled bill's own pick — asks the
  // same question the step 2 switch does. A resumed draft or pending request does not: that choice was made.
  // Stay conditional closes a preset window (it was opened for the unconditional) and steps a picked form back.
  useEffect(() => {
    if (!open || !historyReady) return
    const ask = openUnconditionalAskRef.current
    if (!ask) return
    openUnconditionalAskRef.current = null
    if (hydratedDraftRef.current) return
    void (async () => {
      if (await confirmDialog(UNCONDITIONAL_WAIVER_WARNING)) return
      if (ask.preset) onClose()
      else setFormType(ask.fallback)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, historyReady])

  const selectedInvoices = useMemo(
    () => invoices.filter((i) => selectedInvoiceIds.has(i.id)),
    [invoices, selectedInvoiceIds],
  )

  const presentSigner = useMemo(() => masters.find((m) => m.id === presentSignerId) ?? null, [masters, presentSignerId])
  const iAmTheSigner = presentSigner != null && presentSigner.id === authUser?.id
  /**
   * v2.4285: whoever the row names as signer (else the leader picked) is the signer of record on
   * every path into the pad — not only He signs now. When that is not the signed-in user the pad
   * locks to drawing, so a typed name can never stand in for the leader's hand (job 650's first waiver).
   */
  const signerOfRecord = useMemo(() => {
    const id = releaseRow?.signer_user_id ?? presentSignerId
    const m = (id ? masters.find((x) => x.id === id) : null) ?? presentSigner
    return m && m.id !== authUser?.id ? m : null
  }, [releaseRow?.signer_user_id, presentSignerId, masters, presentSigner, authUser?.id])

  // Rebuild the prefill whenever its inputs change; keep user-typed signer lines.
  // A resumed draft opts out entirely — its saved fields ARE the document.
  useEffect(() => {
    if (!open || !job) {
      setFields(null)
      return
    }
    if (hydratedDraftRef.current) return
    setFields((prev) => {
      // v2.4285: the signer of record is the leader picked under Signed by the leader — never the
      // person at the keyboard — else the company's signer from Settings → Jobs & billing, else the session's
      // name; his title rides along when the name is the company signer's.
      const companySigner = (issuer?.signerName ?? '').trim()
      const leaderName = (presentSigner?.name ?? '').trim() || companySigner || signerNameFallback
      const sameAsCompany = companySigner !== '' && leaderName.toLowerCase() === companySigner.toLowerCase()
      const next = buildLienWaiverPrefill(formType, {
        job,
        invoices: selectedInvoices,
        issuer,
        ownerName,
        signerName: leaderName,
        signerTitle: sameAsCompany ? (issuer?.signerTitle ?? '') : '',
      })
      if (!prev) return next
      return {
        ...next,
        signerName: signerTouchedRef.current && prev.signerName.trim() ? prev.signerName : next.signerName,
        signerTitle: signerTouchedRef.current ? prev.signerTitle : next.signerTitle,
      }
    })
  }, [open, job, formType, selectedInvoices, issuer, ownerName, signerNameFallback, presentSigner])

  const jobNumber = job ? effectiveJobLedgerNumber(job.hcp_number, job.click_number) || '—' : '—'

  const setField = (key: keyof LienWaiverFields, value: string) => {
    userTouchedRef.current = true
    if (key === 'signerName' || key === 'signerTitle') signerTouchedRef.current = true
    setFields((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  /**
   * v2.4296: a resumed draft keeps its typed fields, but the amount and the through date follow the
   * bills and the form — before this, a chip clicked on a reopened draft changed the selection and
   * left the amount and the page as they were (job 650's draft: both bills, $9,022.49 — bill #1's).
   * A fresh window gets the same through the prefill effect.
   */
  const refillFromSelection = (nextForm: LienWaiverFormType, nextIds: ReadonlySet<string>) => {
    if (!hydratedDraftRef.current || !job) return
    const picked = invoices.filter((i) => nextIds.has(i.id))
    const pre = buildLienWaiverPrefill(nextForm, { job, invoices: picked, issuer, ownerName, signerName: '' })
    setFields((prev) => (prev ? { ...prev, amount: pre.amount, throughDate: pre.throughDate } : prev))
  }

  const toggleInvoice = (id: string) => {
    userTouchedRef.current = true
    const next = new Set(selectedInvoiceIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedInvoiceIds(next)
    refillFromSelection(formType, next)
  }

  const editable = lienReleaseIsEditable(releaseRow)
  const rowStatus = releaseRow ? lienReleaseStatus(releaseRow) : null
  // v2.4296: how the amount is figured, a waiver already covering a picked bill, paid money not yet waived.
  const [amountHot, setAmountHot] = useState(false)
  // v2.4335: once signed, the page shows the ink stored at signing (it showed only the name).
  const [inkUrl, setInkUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!releaseRow || lienReleaseStatus(releaseRow) !== 'signed') {
      setInkUrl(null)
      return
    }
    let cancelled = false
    void loadLienReleaseInk(releaseRow).then((u) => {
      if (!cancelled) setInkUrl(u)
    })
    return () => {
      cancelled = true
    }
  }, [releaseRow])
  const amountMath = useMemo(() => (job ? lienWaiverAmountMath(formType, job, selectedInvoices, invoices) : null), [job, formType, selectedInvoices, invoices])
  const amountCoverage = useMemo(
    () => (editable ? lienWaiverAlreadyCovered(formType, selectedInvoices.map((i) => i.id), invoices, historyRows, releaseRow?.id ?? null) : null),
    [editable, formType, selectedInvoices, invoices, historyRows, releaseRow?.id],
  )
  const paidUnwaived = useMemo(() => (job && editable ? lienWaiverPaidUnwaived(formType, job, selectedInvoices, historyRows) : null), [job, editable, formType, selectedInvoices, historyRows])

  /** The exact row payload for the current document state (draft and mint share it). */
  const buildRowPayload = useCallback(() => {
    if (!fields || !job) return null
    const amountNum = Number((fields.amount ?? '').replace(/[$,\s]/g, ''))
    const usesThrough = lienWaiverUsesField(formType, 'throughDate')
    return {
      job_id: job.id,
      invoice_ids: [...selectedInvoiceIds],
      form_type: formType,
      amount: Number.isFinite(amountNum) ? Math.max(0, Math.round(amountNum * 100) / 100) : 0,
      through_date: usesThrough && fields.throughDate ? fields.throughDate : null,
      signed_date: fields.signedDate || null,
      fields: { ...fields } as Record<string, string>,
    }
  }, [fields, job, formType, selectedInvoiceIds])

  // Autosave (v2.2619): the draft writes itself, debounced, from the first
  // real edit — no Save button, ✕ just closes. Stops the moment the row mints.
  // A through or signature date caught half typed (the year "2026" arrives as
  // 0002, 0020, 0202) holds the draft until it is finished: the dates are
  // written as columns and inside `fields`, so nothing is written without them.
  const datesUnfinished = fields ? lienWaiverDatesUnfinished(formType, fields) : false
  useEffect(() => {
    if (!open || !fields || !job || !editable || !userTouchedRef.current) return
    const t = window.setTimeout(() => {
      if (datesUnfinished) {
        setAutosaveState('held')
        return
      }
      void (async () => {
        const payload = buildRowPayload()
        if (!payload) return
        setAutosaveState('saving')
        try {
          if (releaseRow && lienReleaseStatus(releaseRow) === 'draft') {
            await withSupabaseRetry(
              () => supabase.from('job_lien_releases').update(payload).eq('id', releaseRow.id).eq('status', 'draft'),
              'autosave lien release draft',
            )
          } else if (!releaseRow) {
            const data = await withSupabaseRetry<JobLienReleaseRow>(
              () =>
                supabase
                  .from('job_lien_releases')
                  .insert({ ...payload, status: 'draft', created_by: authUser?.id ?? null })
                  .select('*')
                  .single(),
              'create lien release draft',
            )
            if (data) setReleaseRow(data)
          }
          setAutosaveState('saved')
        } catch {
          setAutosaveState('error')
        }
      })()
    }, 800)
    return () => window.clearTimeout(t)
  }, [open, fields, datesUnfinished, job, editable, formType, selectedInvoiceIds, releaseRow, buildRowPayload, authUser?.id])

  /**
   * The mint gate (owner decision): no paper without the record. Flushes the
   * draft with the current fields and locks it at `target`; blocking on
   * failure. The stored minted PDF is best-effort — the row is the document
   * of record and every rendering regenerates from its snapshot.
   */
  const ensureMinted = useCallback(
    async (target: 'issued' | 'awaiting_signature'): Promise<JobLienReleaseRow | null> => {
      if (!fields || !job || mintBusy) return null
      if (releaseRow && lienReleaseIsMinted(releaseRow)) return releaseRow
      // The mint locks the row as it reads: a through or signature date with its year half typed stops here.
      const dateBlocks = lienWaiverUnfinishedDateBlocksIssue(formType, fields, new Date().getFullYear())
      if (dateBlocks) {
        showToast(dateBlocks, 'error')
        return null
      }
      const payload = buildRowPayload()
      if (!payload) return null
      setMintBusy(true)
      try {
        const nowIso = new Date().toISOString()
        const mintFields = {
          status: target,
          minted_at: nowIso,
          ...(target === 'awaiting_signature'
            ? {
                signature_requested_at: nowIso,
                signature_requested_by: authUser?.id ?? null,
                signer_user_id: presentSignerId ?? job.master_user_id ?? null,
              }
            : {}),
        }
        let row: JobLienReleaseRow | null = null
        if (releaseRow) {
          row = await withSupabaseRetry<JobLienReleaseRow>(
            () =>
              supabase
                .from('job_lien_releases')
                .update({ ...payload, ...mintFields })
                .eq('id', releaseRow.id)
                .eq('status', 'draft')
                .select('*')
                .single(),
            'mint lien release',
          )
        } else {
          row = await withSupabaseRetry<JobLienReleaseRow>(
            () =>
              supabase
                .from('job_lien_releases')
                .insert({ ...payload, ...mintFields, created_by: authUser?.id ?? null })
                .select('*')
                .single(),
            'mint lien release',
          )
        }
        if (!row) throw new Error('mint returned no row')
        setReleaseRow(row)
        setAutosaveState('saved')
        void loadHistory()
        onIssued?.()
        // Audit copy of the minted (unsigned) document — best-effort.
        void (async () => {
          try {
            const pdf = await buildLienWaiverPdfBlob(formType, fields)
            const path = lienReleaseMintedPdfPath(row.id)
            const { error } = await supabase.storage
              .from(LIEN_RELEASE_DOCUMENTS_BUCKET)
              .upload(path, pdf, { contentType: 'application/pdf', upsert: true })
            if (!error) await supabase.from('job_lien_releases').update({ minted_pdf_path: path }).eq('id', row.id)
          } catch {
            /* regenerable from the snapshot */
          }
        })()
        return row
      } catch {
        showToast('Could not record the release — nothing was produced. Try again.', 'error')
        return null
      } finally {
        setMintBusy(false)
      }
    },
    [fields, job, mintBusy, releaseRow, buildRowPayload, authUser?.id, presentSignerId, formType, loadHistory, onIssued, showToast],
  )

  const requestSignature = useCallback(async () => {
    if (!job) return
    if (releaseRow && lienReleaseIsMinted(releaseRow)) {
      if (lienReleaseStatus(releaseRow) !== 'issued') return
      try {
        const data = await withSupabaseRetry<JobLienReleaseRow>(
          () =>
            supabase
              .from('job_lien_releases')
              .update({
                status: 'awaiting_signature',
                signature_requested_at: new Date().toISOString(),
                signature_requested_by: authUser?.id ?? null,
                signer_user_id: presentSignerId ?? job.master_user_id ?? null,
              })
              .eq('id', releaseRow.id)
              .eq('status', 'issued')
              .select('*')
              .single(),
          'request lien release signature',
        )
        if (data) setReleaseRow(data)
        void loadHistory()
        onIssued?.()
      } catch {
        showToast('Could not request the signature.', 'error')
      }
      return
    }
    const row = await ensureMinted('awaiting_signature')
    if (row) showToast('Signature requested.', 'success')
  }, [job, releaseRow, authUser?.id, presentSignerId, ensureMinted, loadHistory, onIssued, showToast])

  const cancelSignatureRequest = useCallback(async () => {
    if (!releaseRow || lienReleaseStatus(releaseRow) !== 'awaiting_signature') return
    // #87 C: a waiver minted by its own request goes back to a draft you can change; one printed first stays issued.
    const target = lienReleaseCancelTarget(releaseRow)
    try {
      const data = await withSupabaseRetry<JobLienReleaseRow>(
        () =>
          supabase
            .from('job_lien_releases')
            .update(
              target === 'draft'
                ? { status: 'draft', minted_at: null, minted_pdf_path: null, signature_requested_at: null, signature_requested_by: null }
                : { status: 'issued' },
            )
            .eq('id', releaseRow.id)
            .eq('status', 'awaiting_signature')
            .select('*')
            .single(),
        'cancel lien signature request',
      )
      if (data) setReleaseRow(data)
      void loadHistory()
      if (target === 'draft') showToast('Request taken back. The waiver is a draft again, so you can change it.', 'success')
    } catch {
      showToast('Could not cancel the request.', 'error')
    }
  }, [releaseRow, loadHistory, showToast])

  /**
   * He signs now (v2.4274): mint the row as awaiting the chosen leader's signature, then open the
   * pad for him on this screen. When the signed-in user is that leader, it is simply Sign now.
   */
  const signNow = useCallback(async () => {
    if (!job) return
    const signerId = presentSignerId ?? job.master_user_id ?? null
    let row = releaseRow
    if (!row || !lienReleaseIsMinted(row)) {
      row = await ensureMinted('awaiting_signature')
      if (!row) return
    }
    if (lienReleaseStatus(row) === 'issued') {
      try {
        const data = await withSupabaseRetry<JobLienReleaseRow>(
          () =>
            supabase
              .from('job_lien_releases')
              .update({ status: 'awaiting_signature', signature_requested_at: new Date().toISOString(), signature_requested_by: authUser?.id ?? null, signer_user_id: signerId })
              .eq('id', row!.id)
              .eq('status', 'issued')
              .select('*')
              .single(),
          'open lien release for signing',
        )
        if (data) {
          row = data
          setReleaseRow(data)
        }
      } catch {
        showToast('Could not open the release for signing.', 'error')
        return
      }
    } else if (row.signer_user_id !== signerId && signerId) {
      try {
        const data = await withSupabaseRetry<JobLienReleaseRow>(
          () => supabase.from('job_lien_releases').update({ signer_user_id: signerId }).eq('id', row!.id).eq('status', 'awaiting_signature').select('*').single(),
          'name the signer',
        )
        if (data) {
          row = data
          setReleaseRow(data)
        }
      } catch {
        /* the pad still opens; the signer is stamped on signing */
      }
    }
    setPresentOpen(true)
  }, [job, presentSignerId, releaseRow, ensureMinted, authUser?.id, showToast])

  const gcName = (job?.gcCustomer?.name ?? '').trim()
  const sendToName = gcName || (job?.customer_name ?? '').trim() || 'the customer'
  const sendRecipient = gcName ? gcEmail : (job?.customer_email ?? '').trim() || null

  const sendToPayor = useCallback(async () => {
    if (!job || !releaseRow || sendBusy) return
    setSendBusy(true)
    try {
      const idx = selectedInvoices.length === 1 ? invoices.findIndex((i) => i.id === selectedInvoices[0]!.id) + 1 : 0
      const billLabel = idx > 0 ? `Bill ${idx} · ${jobNumber} ${(job.job_name ?? '').trim()}`.trim() : null
      const r = await sendLienReleaseEmailToCustomer(
        releaseRow,
        { id: job.id, customer_email: job.customer_email ?? null, hcp_number: job.hcp_number ?? null, click_number: job.click_number ?? null },
        { recipient: sendRecipient, billLabel },
      )
      if (r.ok) {
        showToast(`Sent to ${r.sentTo}.`, 'success')
        const { data } = await supabase.from('job_lien_releases').select('*').eq('id', releaseRow.id).maybeSingle()
        if (data) setReleaseRow(data as JobLienReleaseRow)
        void loadHistory()
        onIssued?.()
      } else {
        showToast(r.message, 'error')
      }
    } finally {
      setSendBusy(false)
    }
  }, [job, releaseRow, sendBusy, selectedInvoices, invoices, jobNumber, sendRecipient, showToast, loadHistory, onIssued])

  /** Whose screen a row was signed on, for the audit sentence: this session's name, or "the office" for another's. */
  const deviceNameFor = useCallback(
    (row: Pick<JobLienReleaseRow, 'signed_on_device_of' | 'signer_user_id'>): string | null =>
      row.signed_on_device_of && row.signed_on_device_of !== row.signer_user_id ? (row.signed_on_device_of === authUser?.id ? (profileName ?? '').trim() || 'this' : 'the office') : null,
    [authUser?.id, profileName],
  )

  /** Signature for renders of an unsigned row (v2.4285: the shared reading). A signed row reads its stored ink instead (v2.4335, lienReleaseInk). */
  const renderSignature = useCallback((row: JobLienReleaseRow | null): LienWaiverSignature | null => (row ? lienReleaseRowSignature(row, deviceNameFor(row)) : null), [deviceNameFor])

  // Every output action mints first (no paper without the record) and renders
  // the signature once one exists.
  const printRelease = useCallback(async () => {
    if (!fields) return
    const row = await ensureMinted('issued')
    if (!row) return
    // v2.4335: a signed waiver prints with the ink stored at signing (it printed the name in type).
    // A print counts as a send (docs/SENT_COPIES.md): the release is filed on the job as it printed.
    const signed = lienReleaseStatus(row) === 'signed'
    const filing = { kind: 'lien_release', title: signed ? `Release of lien — Job ${jobNumber}` : `Release of lien, unsigned — Job ${jobNumber}`, jobIds: [row.job_id], source: { table: 'job_lien_releases', id: row.id } }
    const ok = signed
      ? await printWhenReadyAndFile(async () => buildLienWaiverPrintHtml(formType, fields, jobNumber, await lienReleaseRowSignatureWithInk(row, deviceNameFor(row))), filing)
      : printAndFile(buildLienWaiverPrintHtml(formType, fields, jobNumber, renderSignature(row)), filing)
    if (!ok) showToast('Popup blocked — allow popups to print.', 'error')
  }, [fields, formType, jobNumber, ensureMinted, renderSignature, deviceNameFor, showToast])

  const viewHistoryRelease = useCallback(
    (r: JobLienReleaseRow) => {
      const snapshot = lienReleaseFieldsFromSnapshot(r.fields)
      const historyForm: LienWaiverFormType = isLienWaiverFormType(r.form_type) ? r.form_type : 'conditional_progress'
      const historyFields: LienWaiverFields = {
        companyName: snapshot.companyName ?? '',
        checkFrom: snapshot.checkFrom ?? '',
        amount: snapshot.amount ?? String(r.amount ?? ''),
        projectDescription: snapshot.projectDescription ?? '',
        throughDate: snapshot.throughDate ?? r.through_date ?? '',
        signedDate: snapshot.signedDate ?? r.signed_date ?? '',
        signerName: snapshot.signerName ?? '',
        signerTitle: snapshot.signerTitle ?? '',
      }
      // v2.4335: the page as signed, with the stored ink.
      void openHtmlWindowWhenReady(async () => buildLienWaiverPrintHtml(historyForm, historyFields, jobNumber, await lienReleaseRowSignatureWithInk(r, deviceNameFor(r)))).then((ok) => {
        if (!ok) showToast('Popup blocked — allow popups to view the release.', 'error')
      })
    },
    [jobNumber, deviceNameFor, showToast],
  )

  const voidHistoryRelease = useCallback(
    async (r: JobLienReleaseRow) => {
      try {
        await withSupabaseRetry(
          () =>
            supabase
              .from('job_lien_releases')
              .update({ voided_at: new Date().toISOString(), voided_by: authUser?.id ?? null })
              .eq('id', r.id),
          'void lien release',
        )
        showToast('Release voided.', 'success')
        setVoidPendingId(null)
        void loadHistory()
        onIssued?.()
      } catch {
        showToast('Could not void the release.', 'error')
      }
    },
    [showToast, loadHistory, onIssued, authUser?.id],
  )

  const downloadPdf = useCallback(async () => {
    if (!fields || pdfBusy) return
    const row = await ensureMinted('issued')
    if (!row) return
    setPdfBusy(true)
    try {
      // v2.4335: a signed waiver downloads as it was signed — the stored PDF with the ink, the same file
      // the GC gets (it was rebuilt here without the picture, the name in italic type over the line).
      const blob =
        lienReleaseStatus(row) === 'signed' ? await lienReleaseSignedPdfBlob(row, formType, fields, deviceNameFor(row)) : await buildLienWaiverPdfBlob(formType, fields, renderSignature(row))
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = lienWaiverPdfFilename(formType, jobNumber)
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      showToast('Could not build the PDF.', 'error')
    } finally {
      setPdfBusy(false)
    }
  }, [fields, formType, jobNumber, pdfBusy, ensureMinted, renderSignature, deviceNameFor, showToast])

  // v2.4314 — the window in six steps: what a fix was waved through, the details in edit mode, the history opened.
  const navigate = useNavigate()
  const [overrides, setOverrides] = useState<ReadonlySet<'covered' | 'early'>>(() => new Set())
  const [editDetails, setEditDetails] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  // v2.4337 — click to look: the folded steps opened again (read-only), and the one opened last, which the page marks.
  const [looking, setLooking] = useState<ReadonlySet<number>>(() => new Set())
  const [lookAt, setLookAt] = useState<number | null>(null)
  useEffect(() => {
    if (!open) return
    setOverrides(new Set())
    setEditDetails(false)
    setHistoryOpen(false)
  }, [open, job?.id])
  // A new state (asked, signed, a new waiver) folds a different set of steps: start from all folded.
  useEffect(() => {
    setLooking(new Set())
    setLookAt(null)
  }, [open, job?.id, rowStatus])
  // After an open or a fold the card is redrawn: once it is on the page, bring it into view and keep
  // the keyboard on that step (its Fold button once open, its own button once folded).
  const [stepToShow, setStepToShow] = useState<{ n: number; focus: 'fold' | 'open' | null; at: number } | null>(null)
  useEffect(() => {
    if (!stepToShow) return
    const el = document.querySelector(`[data-testid="lien-step-${stepToShow.n}"]`)
    el?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
    if (stepToShow.focus) (el?.querySelector(stepToShow.focus === 'fold' ? '.lienStep-foldClose' : '.lienStep-foldBtn') as HTMLElement | null)?.focus({ preventScroll: true })
  }, [stepToShow])
  const showStep = (n: number, focus: 'fold' | 'open' | null = null) => setStepToShow({ n, focus, at: Date.now() })
  const toggleLook = (n: number) => {
    const next = new Set(looking)
    if (next.has(n)) {
      next.delete(n)
      setLookAt(lookAt === n ? ([...next].pop() ?? null) : lookAt)
      showStep(n, 'open')
    } else {
      next.add(n)
      setLookAt(n)
      showStep(n, 'fold')
    }
    setLooking(next)
  }
  const detailKeys = useMemo(() => FIELD_ORDER.filter((k) => k !== 'amount' && lienWaiverUsesField(formType, k)), [formType])
  const amountNum = fields ? Number((fields.amount ?? '').replace(/[$,\s]/g, '')) : 0
  // A blank detail the page prints holds signing; a year still being typed does not (the footer and the issue check cover it).
  const detailsMissing = fields ? detailKeys.filter((k) => k !== 'signerTitle' && !String(fields[k] ?? '').trim()).length : 0
  const coveredBlocks = amountCoverage != null && !overrides.has('covered')
  const steps = useMemo(
    () =>
      lienReleaseSteps({
        billCount: invoices.length,
        billsPicked: selectedInvoiceIds.size,
        covered: coveredBlocks,
        amount: Number.isFinite(amountNum) ? amountNum : 0,
        tooEarly: amountMath?.tooEarly != null && !overrides.has('early'),
        detailsMissing,
        rowStatus,
        sent: Boolean(releaseRow?.sent_to_customer_at),
      }),
    [invoices.length, selectedInvoiceIds, coveredBlocks, amountNum, amountMath, overrides, detailsMissing, rowStatus, releaseRow?.sent_to_customer_at],
  )

  if (!open || !job || !fields) return null

  const paragraphs = buildLienWaiverParagraphs(formType, fields)
  const signedFoot = rowStatus === 'signed' && releaseRow?.signer_printed_name ? { printedName: releaseRow.signer_printed_name, signedYmd: releaseRow.signed_at ? calendarYmdInAppTzFromIso(releaseRow.signed_at) : null } : null
  const foot = buildLienWaiverFoot(fields, signedFoot)
  const cur = steps.current
  const stepAt = (n: number) => steps.steps[n - 1]!
  // v2.4337 — click to look: a folded step's card and its number open it read-only; an open step's number brings it into view.
  const lookNote = releaseStepLookNote(rowStatus, Boolean(releaseRow?.sent_to_customer_at), releaseRow ? lienReleaseCancelTarget(releaseRow) === 'draft' : true)
  const lookProps = (n: number) => {
    const folded = stepAt(n).folded
    return {
      open: folded && looking.has(n),
      onToggle: folded ? () => toggleLook(n) : undefined,
      onDot: () => (folded ? toggleLook(n) : showStep(n)),
      lookNote: folded ? lookNote : null,
    }
  }
  const lookPart = lookAt != null && looking.has(lookAt) ? releaseStepPagePart(lookAt) : null
  const leadsInto = (n: number) => cur?.n === n + 1
  const usd = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const STEP_TITLES = ['Pick the bills', 'Check the form', 'Check the amount', 'Check the details', 'Get it signed', `Send it to ${sendToName}`]
  const pickedNumbers = invoices.map((inv, idx) => (selectedInvoiceIds.has(inv.id) ? idx + 1 : 0)).filter((n) => n > 0)
  const leaderName = presentSigner?.name ?? (fields.signerName.trim() || 'the leader')
  const deviceName = (profileName ?? '').trim()
  const others = liveLienReleases(historyRows).filter((r) => r.id !== releaseRow?.id)
  const shownOthers = historyOpen ? others : others.slice(0, 1)
  const showDetailInputs = editable && (editDetails || detailsMissing > 0)
  const asked = rowStatus === 'awaiting_signature'
  const choice: React.CSSProperties = { borderRadius: 10, padding: '0.7rem 0.85rem', fontFamily: 'inherit', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '0.2rem', minHeight: 76, cursor: mintBusy ? 'wait' : 'pointer' }
  const quietBtn: React.CSSProperties = { padding: '0.4rem 0.8rem', fontSize: '0.8125rem', borderRadius: 7, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-base)', fontFamily: 'inherit', cursor: 'pointer' }
  const linkBtn: React.CSSProperties = { background: 'none', border: 'none', padding: 0, color: 'var(--text-link)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit', textDecoration: 'underline' }
  const discardDraft = () => {
    if (!releaseRow) return
    void (async () => {
      await voidHistoryRelease(releaseRow)
      onClose()
    })()
  }
  const waivePaid = () => {
    // The same bills, now as the waiver for money already in hand; the amount follows (a resumed draft keeps no prefill).
    // It asks first (v2.4582), as the step 2 switch does; on a form already unconditional there is nothing to ask.
    void (async () => {
      if (isConditionalLienForm(formType) && !(await confirmDialog(UNCONDITIONAL_WAIVER_WARNING))) return
      userTouchedRef.current = true
      setFormType('unconditional_progress')
      setField('amount', lienWaiverPrefillAmount('unconditional_progress', job, selectedInvoices).toFixed(2))
    })()
  }
  const historyRow = (r: JobLienReleaseRow) => (
    <div key={r.id} style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem', fontSize: '0.75rem' }}>
      <span style={{ fontWeight: 700 }}>{lienReleaseFormLabel(r.form_type)}</span>
      <span style={{ fontWeight: 700 }}>{Number(r.amount ?? 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</span>
      <span style={{ color: 'var(--text-muted)' }}>{lienWaiverDate(calendarYmdInAppTzFromIso(r.created_at ?? ''))}</span>
      {lienReleaseChips(r).map((c) => (
        <span key={c.label} style={lienChipStyle(c)}>
          {c.label}
        </span>
      ))}
      <span style={{ marginLeft: 'auto', display: 'flex', gap: '0.6rem' }}>
        <button type="button" onClick={() => viewHistoryRelease(r)} style={{ ...linkBtn, textDecoration: 'none', fontSize: '0.75rem' }}>
          View
        </button>
        {voidPendingId === r.id ? (
          <button type="button" onClick={() => void voidHistoryRelease(r)} style={{ ...linkBtn, textDecoration: 'none', color: 'var(--text-red-700)', fontWeight: 700, fontSize: '0.75rem' }}>
            Confirm void
          </button>
        ) : (
          <button type="button" onClick={() => setVoidPendingId(r.id)} title="Void this release record (the document itself is unaffected)" style={{ ...linkBtn, textDecoration: 'none', color: 'var(--text-muted)', fontWeight: 500, fontSize: '0.75rem' }}>
            Void
          </button>
        )}
      </span>
    </div>
  )

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="lien-release-title"
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
          borderRadius: 10,
          maxWidth: 1200,
          width: '100%',
          maxHeight: 'min(94vh, 100%)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '0.9rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
          <div>
            <h2 id="lien-release-title" style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>
              Release of Lien
            </h2>
            <p style={{ margin: '0.3rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              {(job.job_name ?? '').trim() || 'Job'} · job {jobNumber} · {sendToName} pays
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.25rem', lineHeight: 1, cursor: 'pointer', padding: '0.1rem 0.35rem' }}
          >
            ✕
          </button>
        </div>

        <div className="lienRelease-body">
          <div className="lienRelease-steps">
            {others.length > 0 ? (
              <div style={{ marginBottom: '0.9rem', padding: '0.55rem 0.75rem', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-subtle)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }} data-testid="lien-release-already">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: 'var(--text-muted)' }}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <path d="M14 2v6h6" />
                  </svg>
                  <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>Already on this job</span>
                  {others.length > 1 ? (
                    <button type="button" onClick={() => setHistoryOpen((v) => !v)} aria-expanded={historyOpen} style={{ ...linkBtn, marginLeft: 'auto', textDecoration: 'none', fontSize: '0.75rem' }}>
                      {historyOpen ? 'Show fewer' : `Show all ${others.length}`}
                    </button>
                  ) : null}
                </div>
                {shownOthers.map(historyRow)}
              </div>
            ) : null}

            <LienReleaseStepRow step={stepAt(1)} {...lookProps(1)} title={STEP_TITLES[0]!} say={invoices.length > 0 ? 'Pick the bill or bills this waiver is for.' : 'This job has no bills yet, so the waiver covers the whole job.'} nextIsCurrent={leadsInto(1)} summary={pickedNumbers.length > 0 ? pickedNumbers.map((n) => `#${n}`).join(' and ') : 'the whole job'}>
              {invoices.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
                  {invoices.map((i, idx) => {
                    const on = selectedInvoiceIds.has(i.id)
                    const openRem = lienWaiverInvoiceOpenRemaining(job, i)
                    // v2.4296: the chip names what is still owed; the bill's face and any waiver on file under it.
                    const face = Number(i.amount ?? 0)
                    const paidOn = face - openRem
                    const onFile = historyRows.some((r) => r.voided_at == null && lienReleaseStatus(r) !== 'draft' && r.id !== releaseRow?.id && (r.invoice_ids ?? []).includes(i.id))
                    const sub = paidOn <= 0.005 ? 'nothing paid' : openRem <= 0.005 ? 'paid in full' : `of $${face.toLocaleString('en-US')}`
                    return (
                      <button
                        key={i.id}
                        type="button"
                        disabled={!editable}
                        aria-pressed={on}
                        onClick={() => toggleInvoice(i.id)}
                        title={`${lienReleaseBillStatusWord(i.status)} — $${Number(i.amount ?? 0).toLocaleString('en-US')} (open $${openRem.toLocaleString('en-US')})`}
                        style={{
                          padding: '0.35rem 0.7rem',
                          fontSize: '0.8125rem',
                          borderRadius: 9,
                          border: on ? '2px solid #16a34a' : '1px solid var(--border-strong)',
                          background: on ? 'var(--bg-green-tint)' : 'var(--surface)',
                          cursor: editable ? 'pointer' : 'default',
                          fontFamily: 'inherit',
                          color: 'inherit',
                        }}
                      >
                        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1 }}>
                          <span style={{ fontWeight: 700 }}>
                            #{idx + 1} · {openRem <= 0.005 ? `$${face.toLocaleString('en-US')}` : `${lienWaiverMoney(String(openRem))} owed`}
                          </span>
                          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                            {sub}
                            {onFile ? ' · waiver on file' : ''}
                          </span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              ) : null}
              {amountCoverage && coveredBlocks ? (
                <WaiverCoveredNote
                  coverage={amountCoverage}
                  paidUnwaived={paidUnwaived}
                  canDiscard={rowStatus === 'draft'}
                  onOpenCovered={() => viewHistoryRelease(amountCoverage.release)}
                  onDiscard={discardDraft}
                  onWaivePaid={waivePaid}
                  onMakeAnyway={() => setOverrides((prev) => new Set([...prev, 'covered']))}
                />
              ) : null}
            </LienReleaseStepRow>

            <LienReleaseStepRow step={stepAt(2)} {...lookProps(2)} title={STEP_TITLES[1]!} say="The app picks the form from the bills. Change it only if the bills have it wrong." nextIsCurrent={leadsInto(2)} summary={`${lienReleaseFormLabel(formType)} · ${LIEN_WAIVER_FORM_CITES[formType]}`}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 0.75rem', alignItems: 'center' }} data-testid="lien-waiver-form">
                {(() => {
                  const t = lienWaiverToggles(formType)
                  const pick = (next: Partial<typeof t>) => {
                    userTouchedRef.current = true
                    const nextForm = lienWaiverFormFrom({ ...t, ...next })
                    setFormType(nextForm)
                    refillFromSelection(nextForm, selectedInvoiceIds)
                  }
                  // v2.4507: the Unconditional button asks first; staying conditional changes nothing.
                  const pickUnconditional = () => {
                    if (!t.conditional) return
                    void (async () => {
                      if (await confirmDialog(UNCONDITIONAL_WAIVER_WARNING)) pick({ conditional: false })
                    })()
                  }
                  const picked = selectedInvoices.length === 1 ? pickLienWaiverForBill(job, selectedInvoices[0]!) : null
                  return (
                    <>
                      <div style={segWrap} role="group" aria-label="Conditional or unconditional">
                        <button type="button" disabled={!editable} aria-pressed={t.conditional} onClick={() => pick({ conditional: true })} style={seg(t.conditional, !editable)}>
                          Conditional
                        </button>
                        <button type="button" disabled={!editable} aria-pressed={!t.conditional} onClick={pickUnconditional} style={seg(!t.conditional, !editable)}>
                          Unconditional
                        </button>
                      </div>
                      <div style={segWrap} role="group" aria-label="Progress or final">
                        <button type="button" disabled={!editable} aria-pressed={!t.final} onClick={() => pick({ final: false })} style={seg(!t.final, !editable)}>
                          Progress
                        </button>
                        <button type="button" disabled={!editable} aria-pressed={t.final} onClick={() => pick({ final: true })} style={seg(t.final, !editable)}>
                          Final
                        </button>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {LIEN_WAIVER_FORM_CITES[formType]}
                        {picked ? ` · ${picked.formType === formType ? 'picked from the bill' : 'the bill would pick ' + lienReleaseFormLabel(picked.formType)} · ${picked.facts.join(' · ')}` : ''}
                      </span>
                      <span style={{ flexBasis: '100%', fontSize: '0.8125rem', lineHeight: 1.45 }} data-testid="lien-waiver-why">
                        {lienWaiverWhy(formType, fields.checkFrom || sendToName)}
                      </span>
                    </>
                  )
                })()}
              </div>
              {paidUnwaived != null && editable && !coveredBlocks ? <WaiverPaidNote paidUnwaived={paidUnwaived} onWaivePaid={waivePaid} /> : null}
            </LienReleaseStepRow>

            <LienReleaseStepRow step={stepAt(3)} {...lookProps(3)} title={STEP_TITLES[2]!} say="The amount comes from the bills. The box shows how." nextIsCurrent={leadsInto(3)} summary={`${usd(Number.isFinite(amountNum) ? amountNum : 0)}${amountMath ? ` · ${amountMath.totalLabel.toLowerCase()}` : ''}`}>
              <label style={{ display: 'block', fontSize: '0.875rem', maxWidth: '14rem' }}>
                <span style={{ display: 'block', fontWeight: 600, marginBottom: '0.2rem' }}>{FIELD_LABELS.amount}</span>
                {/* v2.4334: commas while typing; the value kept stays plain ("17777.51"). */}
                <MoneyTypingInput
                  value={fields.amount}
                  disabled={!editable}
                  onChange={(v) => setField('amount', v)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '0.45rem 0.55rem', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: '0.875rem', fontFamily: 'inherit', fontVariantNumeric: 'tabular-nums', opacity: editable ? 1 : 0.7 }}
                />
              </label>
              <WaiverMathBox math={amountMath} typedAmount={fields.amount} editable={editable} onUseAmount={(n) => setField('amount', n.toFixed(2))} onHover={setAmountHot} onGoOn={() => setOverrides((prev) => new Set([...prev, 'early']))} />
            </LienReleaseStepRow>

            <LienReleaseStepRow step={stepAt(4)} {...lookProps(4)} title={STEP_TITLES[3]!} say={detailsMissing > 0 ? 'Fill in the blank ones below. The page prints them.' : 'These come from the job. Change one only if it is wrong.'} nextIsCurrent={leadsInto(4)} summary="from the job">
              {showDetailInputs ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {detailKeys.map((key) => (
                    <label key={key} style={{ display: 'block', fontSize: '0.875rem' }}>
                      <span style={{ display: 'block', fontWeight: 600, marginBottom: '0.2rem' }}>{FIELD_LABELS[key]}</span>
                      <input
                        type={key === 'throughDate' || key === 'signedDate' ? 'date' : 'text'}
                        value={fields[key]}
                        disabled={!editable}
                        onChange={(e) => setField(key, e.target.value)}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '0.45rem 0.55rem', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: '0.875rem', fontFamily: 'inherit', opacity: editable ? 1 : 0.7 }}
                      />
                    </label>
                  ))}
                  {editDetails && detailsMissing === 0 ? (
                    <div>
                      <button type="button" onClick={() => setEditDetails(false)} style={quietBtn}>
                        Done
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <>
                  <dl style={{ display: 'grid', gridTemplateColumns: 'minmax(8rem, auto) minmax(0, 1fr)', rowGap: '0.35rem', columnGap: '0.9rem', margin: 0, fontSize: '0.8125rem' }} data-testid="lien-waiver-details">
                    {detailKeys.map((key) => {
                      const v = String(fields[key] ?? '').trim()
                      const shown = key === 'throughDate' || key === 'signedDate' ? lienWaiverDate(v) : v || (key === 'signerTitle' ? 'none' : '—')
                      return (
                        <Fragment key={key}>
                          <dt style={{ color: 'var(--text-muted)', margin: 0 }}>{FIELD_LABELS[key]}</dt>
                          <dd style={{ margin: 0 }}>{shown}</dd>
                        </Fragment>
                      )
                    })}
                  </dl>
                  {editable ? (
                    <div>
                      <button type="button" onClick={() => setEditDetails(true)} style={quietBtn}>
                        Change a detail
                      </button>
                    </div>
                  ) : null}
                </>
              )}
              {/* Property record (v2.2614): the job's link into the customer's address book — county / legal description / owner of record. */}
              {linkedAddress ? (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <span style={{ fontWeight: 700, color: 'var(--text-base)' }}>Property record:</span> {linkedAddress.address}
                  {customerAddressLienReady(linkedAddress) ? (
                    <span style={{ marginLeft: '0.4rem', fontWeight: 700, color: 'var(--text-green-700)' }}>✓ lien-ready</span>
                  ) : (
                    <span style={{ marginLeft: '0.4rem', color: 'var(--text-amber-700)', fontWeight: 600 }}>
                      missing {customerAddressLienGaps(linkedAddress).join(', ')} — add on the customer's addresses
                    </span>
                  )}
                </div>
              ) : candidateAddresses.length > 0 ? (
                <div style={{ padding: '0.45rem 0.55rem', borderRadius: 8, border: '1px dashed var(--border-strong)', fontSize: '0.75rem', display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700 }}>Property record:</span>
                  <select value={linkChoiceId} onChange={(e) => setLinkChoiceId(e.target.value)} aria-label="Link a property record" style={{ flex: '1 1 10rem', padding: '0.25rem 0.35rem', fontSize: '0.75rem' }}>
                    <option value="">— pick the property —</option>
                    {candidateAddresses.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.address}
                        {suggestCustomerAddressForJob(job.job_address ?? '', [r]) ? ' (matches job address)' : ''}
                      </option>
                    ))}
                  </select>
                  <button type="button" onClick={() => void linkPropertyRecord()} disabled={!linkChoiceId || linkBusy} style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', borderRadius: 6, border: '1px solid #2563eb', background: 'var(--surface)', color: 'var(--text-link)', cursor: linkChoiceId ? 'pointer' : 'not-allowed', fontWeight: 600 }}>
                    {linkBusy ? 'Linking…' : 'Link'}
                  </button>
                </div>
              ) : null}
            </LienReleaseStepRow>

            <LienReleaseStepRow
              step={stepAt(5)}
              {...lookProps(5)}
              title={STEP_TITLES[4]!}
              say={asked ? undefined : iAmTheSigner ? 'You are the leader on this job. Sign here and it is done.' : 'The leader signs for the company. Pick how he signs.'}
              nextIsCurrent={leadsInto(5)}
              summary={
                releaseRow?.signer_printed_name
                  ? `by ${releaseRow.signer_printed_name}${(() => {
                      const d = releaseRow ? deviceNameFor(releaseRow) : null
                      return d ? ` · drawn on ${d === 'this' ? 'this' : `${d}’s`} screen` : ''
                    })()}`
                  : 'signed'
              }
            >
              {rowStatus === 'signed' && releaseRow ? (
                <LienWaiverSignedLook
                  name={releaseRow.signer_printed_name ?? fields.signerName}
                  title={fields.signerTitle}
                  company={fields.companyName}
                  auditLine={lienReleaseSignatureAuditLine(releaseRow, deviceNameFor(releaseRow))}
                />
              ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }} data-testid="lien-waiver-signer">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap', fontSize: '0.8125rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Signs</span>
                  {masters.length > 1 ? (
                    <select value={presentSignerId ?? ''} onChange={(e) => setPresentSignerId(e.target.value || null)} aria-label="Who signs" disabled={asked} style={{ fontSize: '0.8125rem', padding: '0.25rem 0.4rem', border: '1px solid var(--border-strong)', borderRadius: 7, background: 'var(--surface)', color: 'inherit', fontFamily: 'inherit' }}>
                      {masters.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <strong>{leaderName}</strong>
                  )}
                  {fields.signerTitle.trim() ? (
                    <span style={{ color: 'var(--text-muted)' }}>{fields.signerTitle.trim()}</span>
                  ) : (
                    <span style={{ color: 'var(--text-amber-800)', background: 'var(--bg-amber-100)', borderRadius: 999, padding: '0.1rem 0.6rem', fontSize: '0.75rem' }}>
                      No title on the page ·{' '}
                      <button
                        type="button"
                        onClick={() => {
                          onClose()
                          navigate('/settings?tab=settings-jobs&focus=issuer.signerName')
                        }}
                        style={{ ...linkBtn, color: 'var(--text-amber-800)', fontSize: '0.75rem' }}
                      >
                        Add his title in Settings ›
                      </button>
                    </span>
                  )}
                </div>
                {asked && releaseRow ? (
                  <div style={{ padding: '0.55rem 0.7rem', borderRadius: 9, background: 'var(--bg-amber-100)', border: '1px solid var(--border-strong)', fontSize: '0.8125rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <strong style={{ color: 'var(--text-amber-800)' }}>✍ Waiting for {fields.signerName.trim() || 'the signer'} to sign</strong>
                    <span style={{ color: 'var(--text-muted)' }}>Asked for his signature {lienWaiverDate(calendarYmdInAppTzFromIso(releaseRow.signature_requested_at ?? ''))}. Until it is signed, the waiver stays locked.</span>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      {authUser?.id && releaseRow.signer_user_id === authUser.id ? (
                        <button type="button" onClick={() => setSignOpen(true)} style={{ padding: '0.35rem 0.85rem', fontSize: '0.8125rem', fontWeight: 700, background: '#2563eb', color: '#ffffff', border: 'none', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit' }}>
                          Sign now
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void cancelSignatureRequest()}
                        title={lienReleaseCancelTarget(releaseRow) === 'draft' ? 'Take the request back. The waiver becomes a draft you can change.' : 'Take the request back. It was printed, so the waiver stays issued.'}
                        style={{ ...linkBtn, fontSize: '0.8125rem' }}
                      >
                        Cancel request
                      </button>
                    </div>
                  </div>
                ) : null}
                {rowStatus === 'issued' ? <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Printed for a paper signature. He can still sign it here instead.</div> : null}
                {asked && authUser?.id && releaseRow?.signer_user_id === authUser.id ? null : (
                  <div style={{ display: 'grid', gridTemplateColumns: iAmTheSigner || asked ? 'minmax(0, 1fr)' : 'repeat(auto-fit, minmax(12rem, 1fr))', gap: '0.6rem' }}>
                    <button
                      type="button"
                      onClick={() => void signNow()}
                      disabled={mintBusy}
                      data-testid="lien-waiver-sign-now"
                      aria-label={iAmTheSigner ? '✍ Sign it now' : '✍ He is here, he signs now'}
                      aria-describedby="lien-waiver-sign-now-why"
                      style={{ ...choice, border: 'none', background: '#2563eb', color: '#ffffff' }}
                    >
                      <span style={{ fontSize: '0.95rem', fontWeight: 700 }}>{iAmTheSigner ? '✍ Sign it now' : '✍ He is here, he signs now'}</span>
                      <span id="lien-waiver-sign-now-why" style={{ fontSize: '0.75rem', lineHeight: 1.4, opacity: 0.92 }}>
                        {iAmTheSigner ? 'Draw or type your signature on this screen.' : 'Hand him the phone or turn the screen. He draws his signature.'}
                      </span>
                    </button>
                    {iAmTheSigner || asked ? null : (
                      <button
                        type="button"
                        onClick={() => void requestSignature()}
                        disabled={mintBusy}
                        aria-label="Send it to his desk"
                        aria-describedby="lien-waiver-desk-why"
                        style={{ ...choice, border: '1px solid #93c5fd', background: 'var(--surface)', color: 'var(--text-blue-700)' }}
                      >
                        <span style={{ fontSize: '0.95rem', fontWeight: 700 }}>Send it to his desk</span>
                        <span id="lien-waiver-desk-why" style={{ fontSize: '0.75rem', lineHeight: 1.4, color: 'var(--text-700)' }}>
                          He signs later from his Dashboard. It comes back here signed.
                        </span>
                      </button>
                    )}
                  </div>
                )}
                {iAmTheSigner ? null : (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    The record will say: drawn by {leaderName} on {deviceName ? `${deviceName}’s` : 'your'} screen.
                  </div>
                )}
                {rowStatus == null || rowStatus === 'draft' ? (
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
                    <span>Signing on paper instead?</span>
                    <button type="button" onClick={() => void printRelease()} disabled={mintBusy} style={linkBtn}>
                      Print it
                    </button>
                    <span>then</span>
                    <button type="button" onClick={() => void ensureMinted('issued')} disabled={mintBusy} style={linkBtn}>
                      {mintBusy ? 'Recording…' : 'Mark issued'}
                    </button>
                  </div>
                ) : null}
              </div>
              )}
            </LienReleaseStepRow>

            <LienReleaseStepRow step={stepAt(6)} {...lookProps(6)} title={STEP_TITLES[5]!} last waitLabel="Opens once he signs" say={`Email the signed PDF to ${sendToName}. You can also download or print it.`}>
              {rowStatus === 'signed' && releaseRow && !releaseRow.voided_at ? (
                <>
                  <dl style={{ display: 'grid', gridTemplateColumns: '5.5rem minmax(0, 1fr)', rowGap: '0.3rem', columnGap: '0.9rem', margin: 0, fontSize: '0.8125rem' }}>
                    <dt style={{ color: 'var(--text-muted)', margin: 0 }}>To</dt>
                    <dd style={{ margin: 0 }}>
                      {sendToName} · {sendRecipient ?? <span style={{ color: 'var(--text-amber-800)' }}>no email on file — add the GC’s billing email or the job’s customer email</span>}
                    </dd>
                    <dt style={{ color: 'var(--text-muted)', margin: 0 }}>Attached</dt>
                    <dd style={{ margin: 0 }}>The signed PDF</dd>
                    {releaseRow.sent_to_customer_at ? (
                      <>
                        <dt style={{ color: 'var(--text-muted)', margin: 0 }}>Sent</dt>
                        <dd style={{ margin: 0, color: 'var(--text-green-700)', fontWeight: 600 }}>{lienWaiverDate(calendarYmdInAppTzFromIso(releaseRow.sent_to_customer_at ?? ''))}</dd>
                      </>
                    ) : null}
                  </dl>
                  <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => void sendToPayor()}
                      disabled={sendBusy || !sendRecipient}
                      title={sendRecipient ? `Email the signed waiver to ${sendRecipient}` : `No email on file for ${sendToName} — add the GC’s billing email or the job’s customer email`}
                      data-testid="lien-waiver-send"
                      style={{
                        padding: '0.6rem 1.1rem',
                        fontSize: '0.9rem',
                        fontWeight: 700,
                        borderRadius: 8,
                        border: releaseRow.sent_to_customer_at ? '1px solid #2563eb' : 'none',
                        background: !sendRecipient ? 'var(--bg-subtle)' : releaseRow.sent_to_customer_at ? 'var(--surface)' : '#2563eb',
                        color: !sendRecipient ? 'var(--text-muted)' : releaseRow.sent_to_customer_at ? 'var(--text-link)' : '#ffffff',
                        cursor: sendBusy || !sendRecipient ? 'default' : 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      {sendBusy ? 'Sending…' : releaseRow.sent_to_customer_at ? `Send again to ${sendToName}` : `Send to ${sendToName}`}
                    </button>
                    <button type="button" onClick={() => void downloadPdf()} disabled={pdfBusy} style={quietBtn}>
                      {pdfBusy ? 'Building…' : 'Download PDF'}
                    </button>
                    <button type="button" onClick={() => void printRelease()} style={quietBtn}>
                      Print
                    </button>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{lienReleaseSignatureAuditLine(releaseRow, deviceNameFor(releaseRow)) ?? ''}</div>
                </>
              ) : (
                <div>
                  <button type="button" disabled style={{ padding: '0.55rem 1rem', fontSize: '0.875rem', fontWeight: 650, borderRadius: 8, border: 'none', background: 'var(--bg-subtle)', color: 'var(--text-muted)', fontFamily: 'inherit' }}>
                    Send to {sendToName}
                  </button>
                </div>
              )}
            </LienReleaseStepRow>
          </div>

          {/* The page — pinned light like the printed document, kept in view while the steps scroll. */}
          <div className="lienRelease-preview" data-theme="light" data-look-part={lookPart ?? undefined}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.75rem', marginBottom: '0.6rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              <span>
                <strong style={{ color: 'var(--text-base)' }}>The page</strong> · {rowStatus === 'signed' ? 'signed' : 'it changes as you work'}
              </span>
              {rowStatus === 'signed' ? null : (
                <button type="button" onClick={() => void downloadPdf()} disabled={pdfBusy || mintBusy} style={{ ...linkBtn, textDecoration: 'none', fontSize: '0.8125rem' }}>
                  {pdfBusy ? 'Building…' : 'Download PDF'}
                </button>
              )}
            </div>
            <div
              style={{
                background: 'var(--surface)',
                color: 'var(--text-base)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                padding: '1.25rem 1.4rem',
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontSize: '0.8125rem',
                lineHeight: 1.7,
                boxShadow: '0 4px 14px rgba(0,0,0,0.08)',
                opacity: cur?.n === 1 && cur.state === 'warn' ? 0.55 : 1,
              }}
            >
              <p className="lienRelease-pageTitle" style={{ textAlign: 'center', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 0.9em' }}>{lienWaiverTitle(formType)}</p>
              {paragraphs.map((p, i) => (
                <p key={i} style={{ margin: '0 0 0.7em' }}>
                  <MarkedWaiverAmount text={p} amountLabel={lookPart === 'project' ? fields.projectDescription.trim() : lienWaiverMoney(fields.amount)} on={amountHot || lookPart === 'amount' || lookPart === 'project'} />
                </p>
              ))}
              <LienWaiverFootPreview foot={foot} inkUrl={rowStatus === 'signed' ? inkUrl : null} highlight={cur?.n === 5 ? (iAmTheSigner ? '5 · You sign here' : '5 · He signs here') : null} />
            </div>
            {cur?.n === 1 && cur.state === 'warn' ? <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-amber-800)', fontWeight: 600 }}>Greyed until step 1 is settled.</div> : null}
          </div>
        </div>

        <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ display: 'flex', gap: '0.9rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', color: autosaveState === 'error' || autosaveState === 'held' ? 'var(--text-red-700)' : 'var(--text-muted)' }}>
              {!editable
                ? ''
                : autosaveState === 'saving'
                  ? 'Saving…'
                  : autosaveState === 'saved'
                    ? 'All changes saved'
                    : autosaveState === 'error'
                      ? 'Draft not saved — check your connection'
                      : autosaveState === 'held'
                        ? draftHeldByDateMessage(new Date().getFullYear())
                        : ''}
            </span>
            {/* The waiver being worked on is not in "Already on this job": dropping it lives here (two clicks, like the history's Void). */}
            {releaseRow && !releaseRow.voided_at ? (
              voidPendingId === releaseRow.id ? (
                <button type="button" onClick={discardDraft} style={{ ...linkBtn, textDecoration: 'none', color: 'var(--text-red-700)', fontWeight: 700, fontSize: '0.75rem' }}>
                  {rowStatus === 'draft' ? 'Confirm discard' : 'Confirm void'}
                </button>
              ) : (
                <button type="button" onClick={() => setVoidPendingId(releaseRow.id)} style={{ ...linkBtn, textDecoration: 'none', color: 'var(--text-muted)', fontWeight: 500, fontSize: '0.75rem' }}>
                  {rowStatus === 'draft' ? 'Discard this draft' : 'Void this waiver'}
                </button>
              )
            ) : null}
          </span>
          <span style={{ fontSize: '0.8125rem', fontWeight: 650, color: cur?.state === 'warn' ? 'var(--text-amber-800)' : 'var(--text-blue-700)' }} data-testid="lien-release-where">
            {cur ? (cur.state === 'warn' ? `Step ${cur.n} needs you` : `You are on step ${cur.n} of 6 · ${STEP_TITLES[cur.n - 1]}`) : 'All six steps done'}
          </span>
        </div>
      </div>
      <LienReleaseSignModal
        open={signOpen || presentOpen}
        onClose={() => {
          setSignOpen(false)
          setPresentOpen(false)
        }}
        release={releaseRow}
        jobNumber={jobNumber}
        presentSigner={signerOfRecord}
        deviceUserName={(profileName ?? '').trim() || null}
        onSigned={() => {
          void loadHistory()
          onIssued?.()
          // Pull the fresh row (signed stamps) so the strip and footer flip.
          void (async () => {
            if (!releaseRow) return
            const { data } = await supabase.from('job_lien_releases').select('*').eq('id', releaseRow.id).maybeSingle()
            if (data) setReleaseRow(data as JobLienReleaseRow)
          })()
        }}
      />
    </div>
  )
}
