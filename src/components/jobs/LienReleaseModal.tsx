import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Database } from '../../types/database'
import type { JobWithDetails } from '../../types/jobWithDetails'
import {
  LIEN_WAIVER_FORM_SHORT_LABELS,
  LIEN_WAIVER_FORM_TYPES,
  buildLienWaiverParagraphs,
  buildLienWaiverPdfBlob,
  buildLienWaiverPrefill,
  buildLienWaiverPrintHtml,
  buildLienWaiverSignatureLines,
  lienWaiverDate,
  lienWaiverInvoiceOpenRemaining,
  lienWaiverPdfFilename,
  lienWaiverTitle,
  lienWaiverUsesField,
  type LienWaiverFields,
  type LienWaiverFormType,
  type LienWaiverSignature,
} from '../../lib/jobsDocuments/lienWaiverRelease'
import { openHtmlPreviewWindow, openHtmlPrintWindow } from '../../lib/jobsDocuments/printWindow'
import {
  isLienWaiverFormType,
  lienReleaseFieldsFromSnapshot,
  lienReleaseFormLabel,
  liveLienReleases,
  type JobLienReleaseRow,
} from '../../lib/jobs/lienReleaseTracking'
import {
  canRequestLienSignature,
  lienReleaseChips,
  lienReleaseIsEditable,
  lienReleaseIsMinted,
  lienReleaseSignatureAuditLine,
  lienReleaseStatus,
  type LienReleaseChip,
} from '../../lib/jobs/lienReleaseLifecycle'
import { LIEN_RELEASE_DOCUMENTS_BUCKET, lienReleaseMintedPdfPath } from '../../lib/jobs/lienReleaseDocuments'
import LienReleaseSignModal from './LienReleaseSignModal'
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
import { useAuth } from '../../hooks/useAuth'

type JobsLedgerInvoice = Database['public']['Tables']['jobs_ledger_invoices']['Row']

/**
 * Release of lien modal (v2.2579): generate one of the three owner-drafted
 * waiver-and-release forms straight from a Stages row — prefilled from the
 * job's bill lines, owner row, and the physical-invoice issuer; every field
 * editable; output via copy-for-email, print, or PDF download. Document
 * content lives in `src/lib/jobsDocuments/lienWaiverRelease.ts`.
 */

const FIELD_LABELS: Record<keyof LienWaiverFields, string> = {
  companyName: 'Contractor / releasing party',
  checkFrom: 'Check from (owner / GC)',
  amount: 'Amount ($)',
  projectDescription: 'Project (name — address)',
  throughDate: 'Progress payments through',
  signedDate: 'Signature date',
  signerName: 'Signed by',
  signerTitle: 'Signer title',
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

/** Bill lines the release can cover — anything already minted for billing. */
function selectableInvoices(job: JobWithDetails): JobsLedgerInvoice[] {
  return (job.invoices ?? [])
    .filter((i) => i.status === 'billed' || i.status === 'ready_to_bill')
    .slice()
    .sort((a, b) => a.sequence_order - b.sequence_order)
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
  const { role: authRole, user: authUser } = useAuth()
  const { showToast } = useToastContext()
  const [formType, setFormType] = useState<LienWaiverFormType>('conditional_progress')
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<ReadonlySet<string>>(() => new Set())
  const [fields, setFields] = useState<LienWaiverFields | null>(null)
  const [issuerGen, setIssuerGen] = useState(0)
  const [pdfBusy, setPdfBusy] = useState(false)
  // The row this modal session works on: an autosaving draft until an output
  // action mints it (v2.2619 — the mint gate), then the locked minted row.
  const [releaseRow, setReleaseRow] = useState<JobLienReleaseRow | null>(null)
  const [autosaveState, setAutosaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [mintBusy, setMintBusy] = useState(false)
  const [signOpen, setSignOpen] = useState(false)
  // True once the user actually edits — mere open/close never mints a draft.
  const userTouchedRef = useRef(false)
  // Resumed drafts keep their saved fields — the prefill rebuild stays off.
  const hydratedDraftRef = useRef(false)
  // Issued-on-this-job history (v2.2588): reachable from every row with the
  // release button — billed rows have no Bill Customer, so the strip alone
  // couldn't view/void there. Fail-soft like the strip.
  const [historyRows, setHistoryRows] = useState<JobLienReleaseRow[]>([])
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
    }
  }, [job?.id])

  useEffect(() => {
    if (!open) {
      setHistoryRows([])
      setVoidPendingId(null)
      return
    }
    void loadHistory()
  }, [open, loadHistory])

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

  const invoices = useMemo(() => (job ? selectableInvoices(job) : []), [job])

  // Open-reset: default the selection to the row's invoice, else billed lines, else everything selectable.
  useEffect(() => {
    if (!open || !job) return
    setFormType(initialFormType ?? 'conditional_progress')
    setReleaseRow(null)
    setAutosaveState('idle')
    setSignOpen(false)
    userTouchedRef.current = false
    hydratedDraftRef.current = false
    const selectable = selectableInvoices(job)
    if (invoice && selectable.some((i) => i.id === invoice.id)) {
      setSelectedInvoiceIds(new Set([invoice.id]))
      return
    }
    const billed = selectable.filter((i) => i.status === 'billed')
    setSelectedInvoiceIds(new Set((billed.length > 0 ? billed : selectable).map((i) => i.id)))
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

  const selectedInvoices = useMemo(
    () => invoices.filter((i) => selectedInvoiceIds.has(i.id)),
    [invoices, selectedInvoiceIds],
  )

  // Rebuild the prefill whenever its inputs change; keep user-typed signer lines.
  // A resumed draft opts out entirely — its saved fields ARE the document.
  useEffect(() => {
    if (!open || !job) {
      setFields(null)
      return
    }
    if (hydratedDraftRef.current) return
    setFields((prev) => {
      const next = buildLienWaiverPrefill(formType, {
        job,
        invoices: selectedInvoices,
        issuer,
        ownerName,
        signerName: signerNameFallback,
      })
      if (!prev) return next
      return {
        ...next,
        signerName: prev.signerName.trim() ? prev.signerName : next.signerName,
        signerTitle: prev.signerTitle.trim() ? prev.signerTitle : next.signerTitle,
      }
    })
  }, [open, job, formType, selectedInvoices, issuer, ownerName, signerNameFallback])

  const jobNumber = job ? effectiveJobLedgerNumber(job.hcp_number, job.click_number) || '—' : '—'

  const setField = (key: keyof LienWaiverFields, value: string) => {
    userTouchedRef.current = true
    setFields((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  const toggleInvoice = (id: string) => {
    userTouchedRef.current = true
    setSelectedInvoiceIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const editable = lienReleaseIsEditable(releaseRow)
  const rowStatus = releaseRow ? lienReleaseStatus(releaseRow) : null

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
  useEffect(() => {
    if (!open || !fields || !job || !editable || !userTouchedRef.current) return
    const t = window.setTimeout(() => {
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
  }, [open, fields, job, editable, formType, selectedInvoiceIds, releaseRow, buildRowPayload, authUser?.id])

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
                signer_user_id: job.master_user_id ?? null,
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
    [fields, job, mintBusy, releaseRow, buildRowPayload, authUser?.id, formType, loadHistory, onIssued, showToast],
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
                signer_user_id: job.master_user_id ?? null,
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
  }, [job, releaseRow, authUser?.id, ensureMinted, loadHistory, onIssued, showToast])

  const cancelSignatureRequest = useCallback(async () => {
    if (!releaseRow || lienReleaseStatus(releaseRow) !== 'awaiting_signature') return
    try {
      const data = await withSupabaseRetry<JobLienReleaseRow>(
        () =>
          supabase
            .from('job_lien_releases')
            .update({ status: 'issued' })
            .eq('id', releaseRow.id)
            .eq('status', 'awaiting_signature')
            .select('*')
            .single(),
        'cancel lien signature request',
      )
      if (data) setReleaseRow(data)
      void loadHistory()
    } catch {
      showToast('Could not cancel the request.', 'error')
    }
  }, [releaseRow, loadHistory, showToast])

  /** Signature for renders of the live row (typed renders inline; drawn falls back to the printed name — the stored signed PDF carries the ink). */
  const renderSignature = useCallback((row: JobLienReleaseRow | null): LienWaiverSignature | null => {
    if (!row || lienReleaseStatus(row) !== 'signed' || !row.signer_printed_name) return null
    return {
      mode: 'type',
      printedName: row.signer_printed_name,
      auditLine:
        lienReleaseSignatureAuditLine({ signed_at: row.signed_at, signer_consented_at: row.signer_consented_at }) ?? '',
    }
  }, [])

  // Every output action mints first (no paper without the record) and renders
  // the signature once one exists.
  const printRelease = useCallback(async () => {
    if (!fields) return
    const row = await ensureMinted('issued')
    if (!row) return
    const ok = openHtmlPrintWindow(buildLienWaiverPrintHtml(formType, fields, jobNumber, renderSignature(row)))
    if (!ok) showToast('Popup blocked — allow popups to print.', 'error')
  }, [fields, formType, jobNumber, ensureMinted, renderSignature, showToast])

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
      const ok = openHtmlPreviewWindow(buildLienWaiverPrintHtml(historyForm, historyFields, jobNumber, renderSignature(r)))
      if (!ok) showToast('Popup blocked — allow popups to view the release.', 'error')
    },
    [jobNumber, renderSignature, showToast],
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
      const blob = await buildLienWaiverPdfBlob(formType, fields, renderSignature(row))
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
  }, [fields, formType, jobNumber, pdfBusy, ensureMinted, renderSignature, showToast])

  if (!open || !job || !fields) return null

  const visibleFields = FIELD_ORDER.filter((k) => lienWaiverUsesField(formType, k))
  const paragraphs = buildLienWaiverParagraphs(formType, fields)
  const signatureLines = buildLienWaiverSignatureLines(fields)

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
          borderRadius: 8,
          maxWidth: 880,
          width: '100%',
          maxHeight: 'min(92vh, 100%)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
          <div>
            <h2 id="lien-release-title" style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600 }}>
              Release of Lien
            </h2>
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              {(job.job_name ?? '').trim() || 'Job'} · {jobNumber} —{' '}
              {editable ? 'prefilled from the job; edits save themselves.' : 'issued — the document is locked as rendered.'}
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

        <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {LIEN_WAIVER_FORM_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              disabled={!editable}
              onClick={() => {
                userTouchedRef.current = true
                setFormType(t)
              }}
              style={{
                padding: '0.4rem 0.75rem',
                fontSize: '0.8125rem',
                borderRadius: 6,
                border: formType === t ? '2px solid #2563eb' : '1px solid var(--border-strong)',
                background: formType === t ? 'var(--bg-blue-tint)' : 'var(--surface)',
                cursor: editable ? 'pointer' : 'default',
                opacity: editable || formType === t ? 1 : 0.5,
                fontWeight: formType === t ? 600 : 400,
              }}
            >
              {LIEN_WAIVER_FORM_SHORT_LABELS[t]}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', overflowY: 'auto', flex: 1 }}>
          <div style={{ flex: '1 1 18rem', minWidth: '17rem', padding: '1rem 1.25rem' }}>
            {liveLienReleases(historyRows).length > 0 && (
              <div
                style={{
                  marginBottom: '0.9rem',
                  padding: '0.5rem 0.6rem',
                  borderRadius: 8,
                  background: 'var(--bg-blue-tint)',
                  border: '1px solid var(--border-strong)',
                }}
              >
                <div style={{ fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.35rem' }}>Issued on this job</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  {liveLienReleases(historyRows).map((r) => (
                    <div
                      key={r.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '0.4rem',
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: 6,
                        padding: '0.3rem 0.45rem',
                        fontSize: '0.72rem',
                      }}
                    >
                      <span style={{ fontWeight: 700 }}>{lienReleaseFormLabel(r.form_type)}</span>
                      <span style={{ fontWeight: 700 }}>
                        {Number(r.amount ?? 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                      </span>
                      <span style={{ color: 'var(--text-muted)' }}>{lienWaiverDate((r.created_at ?? '').slice(0, 10))}</span>
                      {lienReleaseChips(r).map((c) => (
                        <span key={c.label} style={lienChipStyle(c)}>
                          {c.label}
                        </span>
                      ))}
                      <span style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
                        <button
                          type="button"
                          onClick={() => viewHistoryRelease(r)}
                          style={{ background: 'none', border: 'none', color: 'var(--text-link)', fontWeight: 600, cursor: 'pointer', padding: 0, fontSize: '0.72rem' }}
                        >
                          View
                        </button>
                        {voidPendingId === r.id ? (
                          <button
                            type="button"
                            onClick={() => void voidHistoryRelease(r)}
                            style={{ background: 'none', border: 'none', color: 'var(--text-red-700)', fontWeight: 700, cursor: 'pointer', padding: 0, fontSize: '0.72rem' }}
                          >
                            Confirm void
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setVoidPendingId(r.id)}
                            title="Void this release record (the document itself is unaffected)"
                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, fontSize: '0.72rem' }}
                          >
                            Void
                          </button>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Property record (v2.2614): the job's link into the customer's
                address book — county / legal description / owner of record. */}
            {linkedAddress ? (
              <div style={{ marginBottom: '0.9rem', padding: '0.45rem 0.55rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-subtle)', fontSize: '0.75rem' }}>
                <span style={{ fontWeight: 700 }}>Property record:</span> {linkedAddress.address}
                {customerAddressLienReady(linkedAddress) ? (
                  <span style={{ marginLeft: '0.4rem', fontWeight: 700, color: 'var(--text-green-700)' }}>✓ lien-ready</span>
                ) : (
                  <span style={{ marginLeft: '0.4rem', color: 'var(--text-amber-700)', fontWeight: 600 }}>
                    missing {customerAddressLienGaps(linkedAddress).join(', ')} — add on the customer's addresses
                  </span>
                )}
              </div>
            ) : candidateAddresses.length > 0 ? (
              <div style={{ marginBottom: '0.9rem', padding: '0.45rem 0.55rem', borderRadius: 8, border: '1px dashed var(--border-strong)', fontSize: '0.75rem', display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
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
            {invoices.length > 0 && (
              <div style={{ marginBottom: '0.9rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                  Release covers bill line(s)
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {invoices.map((i, idx) => {
                    const on = selectedInvoiceIds.has(i.id)
                    const openRem = lienWaiverInvoiceOpenRemaining(job, i)
                    return (
                      <button
                        key={i.id}
                        type="button"
                        disabled={!editable}
                        onClick={() => toggleInvoice(i.id)}
                        title={`${i.status === 'billed' ? 'Billed' : 'Ready to bill'} — $${Number(i.amount ?? 0).toLocaleString('en-US')} (open $${openRem.toLocaleString('en-US')})`}
                        style={{
                          padding: '0.3rem 0.6rem',
                          fontSize: '0.8125rem',
                          borderRadius: 6,
                          border: on ? '2px solid #16a34a' : '1px solid var(--border-strong)',
                          background: on ? 'var(--bg-green-tint)' : 'var(--surface)',
                          cursor: 'pointer',
                          fontWeight: on ? 600 : 400,
                        }}
                      >
                        #{idx + 1} · ${Number(i.amount ?? 0).toLocaleString('en-US')}
                      </button>
                    )
                  })}
                </div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Selection drives the amount and through-date; both stay editable below.
                </div>
              </div>
            )}
            {visibleFields.map((key) => (
              <label key={key} style={{ display: 'block', marginBottom: '0.65rem', fontSize: '0.875rem' }}>
                <span style={{ display: 'block', fontWeight: 500, marginBottom: '0.2rem' }}>{FIELD_LABELS[key]}</span>
                <input
                  type={key === 'throughDate' || key === 'signedDate' ? 'date' : 'text'}
                  value={fields[key]}
                  disabled={!editable}
                  onChange={(e) => setField(key, e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '0.45rem 0.5rem',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 4,
                    fontSize: '0.875rem',
                    opacity: editable ? 1 : 0.7,
                  }}
                />
              </label>
            ))}
            {rowStatus === 'awaiting_signature' && releaseRow ? (
              <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.6rem', borderRadius: 8, background: 'var(--bg-amber-100)', border: '1px solid var(--border-strong)', fontSize: '0.75rem' }}>
                <div style={{ fontWeight: 700, color: 'var(--text-amber-800)' }}>
                  ✍ Awaiting {fields.signerName.trim() || 'the signer'}
                </div>
                <div style={{ color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Requested {lienWaiverDate((releaseRow.signature_requested_at ?? '').slice(0, 10))} — until it's signed, the release stays locked.
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.35rem' }}>
                  {authUser?.id && releaseRow.signer_user_id === authUser.id ? (
                    <button
                      type="button"
                      onClick={() => setSignOpen(true)}
                      style={{ padding: '0.3rem 0.75rem', fontSize: '0.75rem', fontWeight: 700, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                    >
                      Sign now
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void cancelSignatureRequest()}
                    style={{ background: 'none', border: 'none', color: 'var(--text-link)', fontSize: '0.75rem', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                  >
                    Cancel request
                  </button>
                </div>
              </div>
            ) : rowStatus === 'signed' && releaseRow ? (
              <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.6rem', borderRadius: 8, background: 'var(--bg-green-tint)', border: '1px solid var(--border-strong)', fontSize: '0.75rem' }}>
                <div style={{ fontWeight: 700, color: 'var(--text-green-700)' }}>
                  ✓ Signed by {releaseRow.signer_printed_name ?? fields.signerName}
                </div>
                <div style={{ color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  {lienReleaseSignatureAuditLine(releaseRow) ?? ''}
                </div>
              </div>
            ) : null}
          </div>

          {/* Live preview — pinned light like the printed document. */}
          <div
            data-theme="light"
            style={{
              flex: '1 1 20rem',
              minWidth: '18rem',
              padding: '1.25rem',
              background: 'var(--bg-subtle)',
              borderLeft: '1px solid var(--border)',
            }}
          >
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
              }}
            >
              <p style={{ textAlign: 'center', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 0.9em' }}>
                {lienWaiverTitle(formType)}
              </p>
              {paragraphs.map((p, i) => (
                <p key={i} style={{ margin: '0 0 0.7em' }}>
                  {p}
                </p>
              ))}
              {signatureLines.map((l) => (
                <p key={l.label} style={{ margin: '1.1em 0 0' }}>
                  {l.label}: {l.value ? <strong>{l.value}</strong> : '______________________'}
                </p>
              ))}
            </div>
          </div>
        </div>

        <div
          style={{
            padding: '0.9rem 1.25rem',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: '0.75rem', color: autosaveState === 'error' ? 'var(--text-red-700)' : 'var(--text-muted)' }}>
            {!editable
              ? ''
              : autosaveState === 'saving'
                ? 'Saving…'
                : autosaveState === 'saved'
                  ? 'All changes saved'
                  : autosaveState === 'error'
                    ? 'Draft not saved — check your connection'
                    : ''}
          </span>
          <span style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => void printRelease()}
              disabled={mintBusy}
              style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', background: 'var(--surface)', border: '1px solid #2563eb', color: 'var(--text-link)', borderRadius: 4, cursor: mintBusy ? 'wait' : 'pointer' }}
            >
              {rowStatus === 'signed' ? 'Print' : 'Print for signature'}
            </button>
            <button
              type="button"
              onClick={() => void downloadPdf()}
              disabled={pdfBusy || mintBusy}
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.875rem',
                background: 'var(--surface)',
                border: '1px solid #2563eb',
                color: 'var(--text-link)',
                borderRadius: 4,
                cursor: pdfBusy || mintBusy ? 'wait' : 'pointer',
              }}
            >
              {pdfBusy ? 'Building…' : 'Download PDF'}
            </button>
            {rowStatus === 'awaiting_signature' ? (
              <button
                type="button"
                disabled
                style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', background: 'var(--bg-subtle)', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: 4, cursor: 'default' }}
              >
                ✍ Signature requested ✓
              </button>
            ) : canRequestLienSignature(releaseRow) ? (
              <button
                type="button"
                onClick={() => void requestSignature()}
                disabled={mintBusy}
                style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', background: 'var(--surface)', border: '1px solid #2563eb', color: 'var(--text-link)', borderRadius: 4, cursor: mintBusy ? 'wait' : 'pointer', fontWeight: 600 }}
              >
                ✍ Request signature
              </button>
            ) : null}
            {rowStatus == null || rowStatus === 'draft' ? (
              <button
                type="button"
                onClick={() => void ensureMinted('issued')}
                disabled={mintBusy}
                style={{
                  padding: '0.5rem 1rem',
                  fontSize: '0.875rem',
                  background: '#2563eb',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: mintBusy ? 'wait' : 'pointer',
                  fontWeight: 500,
                }}
              >
                {mintBusy ? 'Recording…' : 'Mark issued'}
              </button>
            ) : (
              <button
                type="button"
                disabled
                style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', background: '#16a34a', color: 'white', border: 'none', borderRadius: 4, cursor: 'default', fontWeight: 500 }}
              >
                Issued ✓
              </button>
            )}
          </span>
        </div>
      </div>
      <LienReleaseSignModal
        open={signOpen}
        onClose={() => setSignOpen(false)}
        release={releaseRow}
        jobNumber={jobNumber}
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
