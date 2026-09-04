/**
 * The Contract modal (Contract Desk PR 2): one place to send a job's
 * agreement and see where it stands. Lien-release modal rules: the draft
 * autosaves from the first real edit, Send is the gate that mints the link,
 * fields lock once sent, ✕ just closes. Opened from the Pipeline row chip
 * and the ✍ quick action (PR 3 adds the Job window row and the View bill strip).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { Database } from '../../types/database'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { useAuth } from '../../hooks/useAuth'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { useToastContext } from '../../contexts/ToastContext'
import ResponsiveModalShell from '../ResponsiveModalShell'
import { JOB_CONTRACT_BUCKET } from './JobContractRecordModal'
import JobSignedAgreementModal from './JobSignedAgreementModal'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import { normalizeEstimateLineItemsFromJson } from '../../lib/estimateLineItemNormalize'
import { renderContractBodyToSafeHtml } from '../../lib/renderContractBodyToSafeHtml'
import { openHtmlPreviewWindow } from '../../lib/jobsDocuments/printWindow'
import { fetchPhysicalInvoiceIssuerFromAppSettings, getPhysicalInvoiceIssuerForDocument } from '../../lib/physicalInvoiceIssuer'
import {
  buildJobContractDocumentHtml,
  buildJobContractPrefill,
  isGoogleDocsUrl,
  isHttpUrl,
  shortDocumentLabel,
  DEFAULT_JOB_CONTRACT_TERMS_PLAIN,
  EMPTY_JOB_CONTRACT_FIELDS,
  formatContractMoney,
  jobContractHeading,
  parseJobContractFields,
  PAYMENT_TERMS_PRESETS,
  paymentTermsSentence,
  type JobContractFields,
  type PaymentTermsKey,
} from '../../lib/jobs/jobContractDocument'
import {
  formatContractStamp,
  jobContractChipColors,
  jobContractChips,
  jobContractIsEditable,
  jobContractIsLive,
  jobContractSignatureAuditLine,
  jobContractSigningUrl,
  jobContractStatus,
  type JobContractRow,
} from '../../lib/jobs/jobContractLifecycle'

type TemplateRow = Pick<
  Database['public']['Tables']['contract_template_documents']['Row'],
  'id' | 'document_name' | 'book_body_html' | 'book_body_format' | 'book_version_date'
>

const BUILTIN_TEMPLATE_ID = '__builtin__'

export type JobContractModalProps = {
  open: boolean
  onClose: () => void
  job: JobWithDetails | null
  /** Fires after any send / void / record so the board can refresh its chips. */
  onChanged?: () => void
}

const labelStyle: React.CSSProperties = { fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }
const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '0.4rem 0.55rem',
  border: '1px solid var(--border-strong)',
  borderRadius: 6,
  background: 'var(--surface)',
  color: 'inherit',
  font: 'inherit',
  fontSize: '0.85rem',
}
const rowStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '120px minmax(0, 1fr)', gap: '0.4rem 0.75rem', alignItems: 'center', margin: '0.35rem 0' }
const sectionHead: React.CSSProperties = { font: '600 0.68rem/1.2 inherit', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: '1rem 0 0.4rem' }
const btn: React.CSSProperties = {
  padding: '0.4rem 0.8rem',
  borderRadius: 6,
  border: '1px solid var(--border-strong)',
  background: 'var(--surface)',
  color: 'var(--text-700)',
  font: 'inherit',
  fontSize: '0.8rem',
  fontWeight: 600,
  cursor: 'pointer',
}
const btnPrimary: React.CSSProperties = { ...btn, background: 'var(--text-link)', borderColor: 'var(--text-link)', color: 'white' }

function dispatchChanged() {
  try {
    window.dispatchEvent(new Event('job-contract-changed'))
  } catch {
    /* non-browser */
  }
}

export default function JobContractModal({ open, onClose, job, onChanged }: JobContractModalProps) {
  const { user: authUser } = useAuth()
  const { showToast } = useToastContext()

  const [rows, setRows] = useState<JobContractRow[]>([])
  const [liveRow, setLiveRow] = useState<JobContractRow | null>(null)
  const [fields, setFields] = useState<JobContractFields>(EMPTY_JOB_CONTRACT_FIELDS)
  const [recipientName, setRecipientName] = useState('')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [recipientPhone, setRecipientPhone] = useState('')
  const [ccText, setCcText] = useState('')
  const [message, setMessage] = useState('')
  const [remindersEnabled, setRemindersEnabled] = useState(true)
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [templateId, setTemplateId] = useState<string>(BUILTIN_TEMPLATE_ID)
  const [scopeText, setScopeText] = useState('')
  const [amountText, setAmountText] = useState('')
  const [autosaveState, setAutosaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [busy, setBusy] = useState<null | 'send' | 'link' | 'void' | 'preview'>(null)
  const [voidArmed, setVoidArmed] = useState(false)
  const [lastLink, setLastLink] = useState<string | null>(null)
  const [paperOpen, setPaperOpen] = useState(false)
  const [paperSignedOn, setPaperSignedOn] = useState('')
  const [paperSignerName, setPaperSignerName] = useState('')
  const [paperFile, setPaperFile] = useState<File | null>(null)
  const [paperLink, setPaperLink] = useState('')
  /** The green "linked" line only after a paste / Enter / blur — typing keeps the input mounted (v2.2744). */
  const [paperLinkCommitted, setPaperLinkCommitted] = useState(false)
  const [paperAttachOpen, setPaperAttachOpen] = useState(false)
  const [paperBusy, setPaperBusy] = useState(false)
  const [recordRow, setRecordRow] = useState<JobContractRow | null>(null)
  /** Channel of the live row's latest send event: 'email' = the customer was emailed, 'link' = only minted/copied. */
  const [lastSendChannel, setLastSendChannel] = useState<'email' | 'link' | null>(null)
  const userTouchedRef = useRef(false)
  const hydratedRef = useRef(false)
  const prefillDoneRef = useRef(false)

  const jobNumber = job ? effectiveJobLedgerNumber(job.hcp_number, job.click_number) || '—' : '—'

  const loadRows = useCallback(async () => {
    if (!job) return
    try {
      const { data } = await supabase.from('job_contracts').select('*').eq('job_id', job.id).order('created_at', { ascending: false })
      const list = (data ?? []) as JobContractRow[]
      setRows(list)
      const live = list.find((r) => jobContractIsLive(r)) ?? null
      setLiveRow(live)
      if (live) {
        const { data: ev } = await supabase
          .from('job_contract_events')
          .select('metadata')
          .eq('contract_id', live.id)
          .eq('event_type', 'sent')
          .order('occurred_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        const channel = (ev as { metadata?: { channel?: unknown } } | null)?.metadata?.channel
        setLastSendChannel(channel === 'email' ? 'email' : channel === 'link' ? 'link' : null)
      } else {
        setLastSendChannel(null)
      }
    } catch {
      setRows([])
    }
  }, [job])

  // Open-reset.
  useEffect(() => {
    if (!open || !job) return
    userTouchedRef.current = false
    hydratedRef.current = false
    prefillDoneRef.current = false
    setLiveRow(null)
    setRows([])
    setAutosaveState('idle')
    setVoidArmed(false)
    setLastLink(null)
    setMessage('')
    setPaperOpen(false)
    setPaperSignedOn(todayYmdInAppTz())
    setPaperFile(null)
    setPaperLink('')
    setPaperLinkCommitted(false)
    setPaperAttachOpen(false)
    setRecordRow(null)
    setRecipientName((job.customer_name ?? '').trim())
    setRecipientEmail((job.customer_email ?? '').trim())
    setRecipientPhone((job.customer_phone ?? '').trim())
    setCcText('')
    setRemindersEnabled(true)
    setTemplateId(BUILTIN_TEMPLATE_ID)
    void loadRows()
    void (async () => {
      try {
        const { data } = await supabase
          .from('contract_template_documents')
          .select('id, document_name, book_body_html, book_body_format, book_version_date')
          .eq('audience', 'customer')
          .order('document_name')
        const list = (data ?? []) as TemplateRow[]
        setTemplates(list)
        if (list[0] && !hydratedRef.current) setTemplateId(list[0].id)
      } catch {
        setTemplates([])
      }
    })()
    void fetchPhysicalInvoiceIssuerFromAppSettings().catch(() => undefined)
  }, [open, job, loadRows])

  // Resume the live row (draft or sent) — its saved fields ARE the document.
  useEffect(() => {
    if (!open || !liveRow || hydratedRef.current) return
    hydratedRef.current = true
    prefillDoneRef.current = true
    const f = parseJobContractFields(liveRow.fields)
    setFields(f)
    setScopeText(f.scope_lines.join('\n'))
    setAmountText(f.amount_cents != null ? (f.amount_cents / 100).toFixed(2) : '')
    setRecipientName(liveRow.recipient_name ?? '')
    setRecipientEmail(liveRow.recipient_email ?? '')
    setRecipientPhone(liveRow.recipient_phone ?? '')
    setCcText((liveRow.cc_emails ?? []).join(', '))
    setRemindersEnabled(liveRow.reminders_enabled)
    setTemplateId(liveRow.template_document_id ?? BUILTIN_TEMPLATE_ID)
    setAutosaveState('saved')
  }, [open, liveRow])

  // First-open prefill from the job (+ its accepted estimate) when there is no live row.
  useEffect(() => {
    if (!open || !job || prefillDoneRef.current) return
    let cancelled = false
    void (async () => {
      let estimateLines: { line_item: string; description: string; quantity: number }[] = []
      let acceptedTotal: number | null = null
      try {
        const { data } = await supabase
          .from('estimates')
          .select('line_items_snapshot, total_cents, status')
          .eq('job_ledger_id', job.id)
          .eq('status', 'customer_accepted')
          .limit(1)
          .maybeSingle()
        if (data) {
          estimateLines = normalizeEstimateLineItemsFromJson((data as { line_items_snapshot: unknown }).line_items_snapshot).map((l) => ({
            line_item: l.line_item,
            description: l.description,
            quantity: l.quantity,
          }))
          acceptedTotal = (data as { total_cents: number }).total_cents
        }
      } catch {
        /* fall through to fixtures */
      }
      if (cancelled || hydratedRef.current || prefillDoneRef.current) return
      prefillDoneRef.current = true
      const f = buildJobContractPrefill({ job, estimateLines, acceptedTotalCents: acceptedTotal })
      setFields(f)
      setScopeText(f.scope_lines.join('\n'))
      setAmountText(f.amount_cents != null ? (f.amount_cents / 100).toFixed(2) : '')
    })()
    return () => {
      cancelled = true
    }
  }, [open, job])

  const editable = jobContractIsEditable(liveRow)
  const status = liveRow ? jobContractStatus(liveRow) : null
  const selectedTemplate = templates.find((t) => t.id === templateId) ?? null
  const bodyHtml = selectedTemplate ? selectedTemplate.book_body_html ?? '' : DEFAULT_JOB_CONTRACT_TERMS_PLAIN
  const bodyFormat = selectedTemplate ? selectedTemplate.book_body_format : 'plain'
  const templateName = selectedTemplate ? selectedTemplate.document_name : 'Built-in service agreement terms'

  const touch = () => {
    userTouchedRef.current = true
  }
  const setField = <K extends keyof JobContractFields>(key: K, value: JobContractFields[K]) => {
    touch()
    setFields((prev) => ({ ...prev, [key]: value }))
  }

  const ccList = useMemo(
    () =>
      ccText
        .split(/[,\s]+/)
        .map((s) => s.trim())
        .filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))
        .slice(0, 10),
    [ccText],
  )

  const buildRowPayload = useCallback(() => {
    if (!job) return null
    return {
      job_id: job.id,
      fields: { ...fields } as unknown as Database['public']['Tables']['job_contracts']['Insert']['fields'],
      body_html: bodyHtml,
      body_format: bodyFormat,
      template_document_id: selectedTemplate?.id ?? null,
      template_name: templateName,
      template_version_date: selectedTemplate?.book_version_date ?? null,
      recipient_name: recipientName.trim() || null,
      recipient_email: recipientEmail.trim() || null,
      recipient_phone: recipientPhone.trim() || null,
      cc_emails: ccList,
      reminders_enabled: remindersEnabled,
    }
  }, [job, fields, bodyHtml, bodyFormat, selectedTemplate, templateName, recipientName, recipientEmail, recipientPhone, ccList, remindersEnabled])

  /** Writes the draft now (insert or update) and returns the row — the send gate uses it too. */
  const flushDraft = useCallback(async (): Promise<JobContractRow | null> => {
    const payload = buildRowPayload()
    if (!payload) return null
    if (liveRow && jobContractStatus(liveRow) !== 'draft') return liveRow
    setAutosaveState('saving')
    try {
      if (liveRow) {
        const data = await withSupabaseRetry<JobContractRow>(
          () => supabase.from('job_contracts').update(payload).eq('id', liveRow.id).eq('status', 'draft').select('*').single(),
          'autosave job contract draft',
        )
        if (data) setLiveRow(data)
        setAutosaveState('saved')
        return data ?? liveRow
      }
      const data = await withSupabaseRetry<JobContractRow>(
        () =>
          supabase
            .from('job_contracts')
            .insert({ ...payload, status: 'draft', created_by: authUser?.id ?? null })
            .select('*')
            .single(),
        'create job contract draft',
      )
      if (data) {
        hydratedRef.current = true
        setLiveRow(data)
        setRows((prev) => [data, ...prev])
      }
      setAutosaveState('saved')
      return data ?? null
    } catch {
      setAutosaveState('error')
      return null
    }
  }, [buildRowPayload, liveRow, authUser?.id])

  // Autosave — debounced from the first real edit; stops once sent.
  useEffect(() => {
    if (!open || !job || !editable || !userTouchedRef.current) return
    const t = window.setTimeout(() => void flushDraft(), 800)
    return () => window.clearTimeout(t)
  }, [open, job, editable, fields, recipientName, recipientEmail, recipientPhone, ccText, remindersEnabled, templateId, flushDraft])

  const applyScopeText = (text: string) => {
    setScopeText(text)
    setField(
      'scope_lines',
      text.split('\n').map((l) => l.trim()).filter(Boolean),
    )
  }
  const applyAmountText = (text: string) => {
    setAmountText(text)
    const n = Number(text.replace(/[$,\s]/g, ''))
    setField('amount_cents', text.trim() && Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null)
  }

  const invokeSend = useCallback(
    async (mode: 'email' | 'link'): Promise<string | null> => {
      if (!job) return null
      const row = editable ? await flushDraft() : liveRow
      if (!row) {
        showToast('Could not save the contract draft.', 'error')
        return null
      }
      if (mode === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail.trim())) {
        showToast('Enter a valid email for the signer, or use Copy link.', 'error')
        return null
      }
      setBusy(mode === 'email' ? 'send' : 'link')
      try {
        const { data, error } = await supabase.functions.invoke('send-job-contract', {
          body: {
            contract_id: row.id,
            mode,
            recipient_email: recipientEmail.trim(),
            recipient_name: recipientName.trim(),
            cc_emails: ccList,
            public_origin: window.location.origin,
            message: message.trim() || undefined,
          },
        })
        const res = (data ?? {}) as { ok?: boolean; emailed?: boolean; sign_url?: string; error?: string; email_error?: string }
        if (error || !res.ok) {
          showToast(res.error || error?.message || 'Could not send the contract.', 'error')
          return null
        }
        setLastLink(res.sign_url ?? null)
        if (mode === 'email') {
          showToast(res.emailed ? `Contract sent to ${recipientEmail.trim()}.` : `Link ready — email did not send${res.email_error ? ` (${res.email_error})` : ''}. Copy the link instead.`, res.emailed ? 'success' : 'error')
        }
        await loadRows()
        dispatchChanged()
        onChanged?.()
        return res.sign_url ?? null
      } finally {
        setBusy(null)
      }
    },
    [job, editable, flushDraft, liveRow, recipientEmail, recipientName, ccList, message, showToast, loadRows, onChanged],
  )

  const copyLink = async () => {
    const url = lastLink ?? (await invokeSend('link'))
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      showToast('Signing link copied.', 'success')
    } catch {
      window.prompt('Copy the signing link:', url)
    }
  }

  const textLink = async () => {
    const url = lastLink ?? (await invokeSend('link'))
    if (!url) return
    const phone = recipientPhone.replace(/[^\d+]/g, '')
    const body = `Here is your service agreement for ${job?.job_address || 'your project'} — review and sign here: ${url}`
    window.location.href = `sms:${phone}?&body=${encodeURIComponent(body)}`
  }

  const signInPerson = async () => {
    const url = lastLink ?? (await invokeSend('link'))
    if (!url) return
    window.open(`${url}&inperson=1`, '_blank', 'noopener')
  }

  const preview = () => {
    if (!job) return
    setBusy('preview')
    try {
      const issuer = getPhysicalInvoiceIssuerForDocument()
      const html = buildJobContractDocumentHtml({
        heading: jobContractHeading(job),
        jobNumber,
        jobAddress: job.job_address ?? '',
        customerName: job.customer_name ?? '',
        recipientName,
        dateLabel: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
        revision: liveRow?.revision ?? 1,
        fields,
        termsHtml: renderContractBodyToSafeHtml(liveRow && !editable ? liveRow.body_html : bodyHtml, liveRow && !editable ? liveRow.body_format : bodyFormat),
        templateName: liveRow && !editable ? liveRow.template_name : templateName,
        issuer: issuer.companyName ? issuer : null,
        signature:
          liveRow && liveRow.signed_at
            ? { printedName: liveRow.signer_printed_name ?? '', auditLine: jobContractSignatureAuditLine(liveRow) ?? '' }
            : null,
      })
      if (!openHtmlPreviewWindow(html)) showToast('Allow pop-ups to preview the contract.', 'error')
    } finally {
      setBusy(null)
    }
  }

  const viewHistoryRow = (row: JobContractRow) => {
    if (!job) return
    const issuer = getPhysicalInvoiceIssuerForDocument()
    const html = buildJobContractDocumentHtml({
      heading: jobContractHeading(job),
      jobNumber,
      jobAddress: job.job_address ?? '',
      customerName: job.customer_name ?? '',
      recipientName: row.recipient_name ?? '',
      dateLabel: formatContractStamp(row.last_sent_at ?? row.created_at) ?? '',
      revision: row.revision,
      fields: parseJobContractFields(row.fields),
      termsHtml: renderContractBodyToSafeHtml(row.body_html, row.body_format),
      templateName: row.template_name,
      issuer: issuer.companyName ? issuer : null,
      signature: row.signed_at ? { printedName: row.signer_printed_name ?? '', auditLine: jobContractSignatureAuditLine(row) ?? '' } : null,
    })
    if (!openHtmlPreviewWindow(html)) showToast('Allow pop-ups to view the contract.', 'error')
  }

  /** Void & redo: the sent row is voided, its token moves to a fresh draft (revision + 1) — the customer's link keeps working. */
  const voidAndRedo = async () => {
    if (!liveRow || !job) return
    if (!voidArmed) {
      setVoidArmed(true)
      return
    }
    setBusy('void')
    try {
      const token = liveRow.public_token
      await withSupabaseRetry(
        () =>
          supabase
            .from('job_contracts')
            .update({ status: 'voided', voided_at: new Date().toISOString(), voided_by: authUser?.id ?? null, void_reason: 'Revised by the office', public_token: null })
            .eq('id', liveRow.id),
        'void job contract',
      )
      const payload = buildRowPayload()
      const created = await withSupabaseRetry<JobContractRow>(
        () =>
          supabase
            .from('job_contracts')
            .insert({ ...(payload ?? { job_id: job.id }), status: 'draft', revision: liveRow.revision + 1, public_token: token, created_by: authUser?.id ?? null })
            .select('*')
            .single(),
        'create replacement contract draft',
      )
      if (created) {
        await withSupabaseRetry(() => supabase.from('job_contracts').update({ superseded_by: created.id }).eq('id', liveRow.id), 'link superseded contract')
        hydratedRef.current = false
        setLiveRow(null)
        setRows([])
        await loadRows()
      }
      setVoidArmed(false)
      setLastLink(null)
      showToast('Contract voided — edit the new draft and send again on the same link.', 'success')
      dispatchChanged()
      onChanged?.()
    } catch {
      showToast('Could not void the contract.', 'error')
    } finally {
      setBusy(null)
    }
  }

  /** Upload signed copy / record a paper signature: a signed row with signer_mode 'paper' (no token, no email). */
  const recordPaper = async () => {
    if (!job || paperBusy) return
    const name = paperSignerName.trim() || recipientName.trim() || (job.customer_name ?? '').trim()
    if (!name) {
      showToast('Enter who signed the contract.', 'error')
      return
    }
    const link = paperLink.trim()
    if (!isHttpUrl(link) && !paperFile) {
      showToast('Paste the Google Doc link, or attach a scan.', 'error')
      return
    }
    setPaperBusy(true)
    try {
      const nowIso = new Date().toISOString()
      const base = {
        ...(buildRowPayload() ?? { job_id: job.id }),
        status: 'signed',
        signed_at: paperSignedOn ? `${paperSignedOn}T12:00:00Z` : nowIso,
        signer_printed_name: name,
        signer_mode: 'paper',
        signer_consented_at: null,
        paper_signed_on: paperSignedOn || null,
        signed_document_url: isHttpUrl(link) ? link : null,
        recorded_by: authUser?.id ?? null,
        public_token: null,
        next_reminder_at: null,
      }
      let row: JobContractRow | null = null
      if (liveRow && jobContractStatus(liveRow) === 'draft') {
        row = await withSupabaseRetry<JobContractRow>(
          () => supabase.from('job_contracts').update(base).eq('id', liveRow.id).eq('status', 'draft').select('*').single(),
          'record paper contract (draft)',
        )
      } else {
        row = await withSupabaseRetry<JobContractRow>(
          () => supabase.from('job_contracts').insert({ ...base, created_by: authUser?.id ?? null }).select('*').single(),
          'record paper contract',
        )
      }
      if (row && paperFile) {
        const ext = (paperFile.name.split('.').pop() || 'pdf').toLowerCase().replace(/[^a-z0-9]/g, '') || 'pdf'
        const path = `${row.id}/paper.${ext}`
        const { error: upErr } = await supabase.storage.from(JOB_CONTRACT_BUCKET).upload(path, paperFile, { contentType: paperFile.type || undefined, upsert: true })
        if (upErr) {
          showToast('Recorded the paper signature, but the file did not upload (storage bucket not ready).', 'error')
        } else {
          await withSupabaseRetry(() => supabase.from('job_contracts').update({ paper_upload_path: path }).eq('id', row!.id), 'attach paper upload')
        }
      }
      if (row) {
        await supabase.from('job_contract_events').insert({ contract_id: row.id, event_type: 'recorded', metadata: { paper_signed_on: paperSignedOn || null, file: !!paperFile }, actor_user_id: authUser?.id ?? null })
      }
      setPaperOpen(false)
      setPaperFile(null)
      hydratedRef.current = false
      setLiveRow(null)
      await loadRows()
      showToast('Signed contract filed — the job now reads signed.', 'success')
      dispatchChanged()
      onChanged?.()
    } catch {
      showToast('Could not record the paper contract.', 'error')
    } finally {
      setPaperBusy(false)
    }
  }

  const paperReady = isHttpUrl(paperLink) || paperFile != null

  if (!open || !job) return null

  const historyRows = rows.filter((r) => !liveRow || r.id !== liveRow.id)
  const sentStrip =
    liveRow && status === 'sent' ? (
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', padding: '0.55rem 0.75rem', borderRadius: 8, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', fontSize: '0.8rem', margin: '0.6rem 0' }}>
        <span style={{ flex: 1, minWidth: 200 }}>
          {lastSendChannel === 'link' ? '🔗 Link copied ' : '✉ Sent '}
          {formatContractStamp(liveRow.last_sent_at ?? liveRow.sent_at) ?? ''}
          {liveRow.recipient_email ? (lastSendChannel === 'link' ? ` — nothing emailed yet to ${liveRow.recipient_email}` : ` to ${liveRow.recipient_email}`) : lastSendChannel === 'link' ? ' — nothing emailed yet' : ''}
          {liveRow.send_count > 1 ? ` · ${liveRow.send_count} sends` : ''}
          {liveRow.view_count > 0 ? ` · opened ${liveRow.view_count}×` : ' · not opened yet'}
          {liveRow.public_token_expires_at ? ` · link good until ${formatContractStamp(liveRow.public_token_expires_at)?.split(',')[0] ?? ''}` : ''}
        </span>
        <button type="button" style={lastSendChannel === 'link' ? btnPrimary : btn} disabled={busy != null} onClick={() => void invokeSend('email')}>
          {busy === 'send' ? 'Sending…' : lastSendChannel === 'link' ? 'Send by email' : 'Resend email'}
        </button>
        <button type="button" style={btn} disabled={busy != null} onClick={() => void copyLink()}>
          Copy link
        </button>
        {recipientPhone.trim() ? (
          <button type="button" style={btn} disabled={busy != null} onClick={() => void textLink()}>
            Text link
          </button>
        ) : null}
        <button type="button" style={btn} disabled={busy != null} onClick={() => void signInPerson()}>
          Sign in person
        </button>
        <button type="button" style={{ ...btn, color: voidArmed ? 'var(--text-red-700)' : undefined }} disabled={busy != null} onClick={() => void voidAndRedo()}>
          {busy === 'void' ? 'Voiding…' : voidArmed ? 'Confirm void & redo' : 'Void & redo'}
        </button>
      </div>
    ) : null

  const footer = (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" style={btn} disabled={busy != null} onClick={preview}>
          Preview as customer
        </button>
        <span style={{ fontSize: '0.75rem', color: autosaveState === 'error' ? 'var(--text-red-700)' : 'var(--text-muted)' }}>
          {!editable ? 'Locked — sent' : autosaveState === 'saving' ? 'Saving…' : autosaveState === 'saved' ? 'Draft saved' : autosaveState === 'error' ? 'Save failed' : ''}
        </span>
      </div>
      {editable ? (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" style={btn} disabled={busy != null} onClick={() => void signInPerson()}>
            Sign in person
          </button>
          <button type="button" style={btn} disabled={busy != null} onClick={() => void copyLink()}>
            {busy === 'link' ? 'Minting…' : 'Copy link'}
          </button>
          <button type="button" style={btnPrimary} disabled={busy != null} onClick={() => void invokeSend('email')}>
            {busy === 'send' ? 'Sending…' : 'Send by email'}
          </button>
        </div>
      ) : null}
    </div>
  )

  return (
    <ResponsiveModalShell
      title={`Contract · J${jobNumber}`}
      onRequestClose={onClose}
      footer={footer}
      maxWidthDesktop={760}
      headerAction={
        <button type="button" style={btn} disabled={busy != null} onClick={() => setPaperOpen(true)} title="Already signed outside the app? File the Google Doc (or a scan) without sending anything">
          <span aria-hidden>📄</span> File a signed contract
        </button>
      }
    >
      <div style={{ fontSize: '0.85rem' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          {jobContractHeading(job)} · {job.customer_name || '—'}
          {job.job_address ? ` · ${job.job_address}` : ''}
        </div>
        {sentStrip}
        {status === null && rows.some((r) => jobContractStatus(r) === 'signed') ? (
          <div style={{ padding: '0.5rem 0.75rem', borderRadius: 8, background: 'var(--bg-green-tint)', color: 'var(--text-green-700)', margin: '0.6rem 0', fontSize: '0.8rem' }}>
            ✍ A signed contract is already on file for this job (see history below). Starting a new one supersedes it only if the customer signs again.
          </div>
        ) : null}

        <div style={sectionHead}>Who signs</div>
        <div style={rowStyle}>
          <span style={labelStyle}>Name</span>
          <input style={inputStyle} value={recipientName} disabled={!editable} onChange={(e) => { touch(); setRecipientName(e.target.value) }} placeholder="Customer's full name" />
          <span style={labelStyle}>Email</span>
          <input style={inputStyle} type="email" value={recipientEmail} disabled={!editable} onChange={(e) => { touch(); setRecipientEmail(e.target.value) }} placeholder="Where the signing link goes" />
          <span style={labelStyle}>Mobile</span>
          <input style={inputStyle} value={recipientPhone} disabled={!editable} onChange={(e) => { touch(); setRecipientPhone(e.target.value) }} placeholder="For texting the link (optional)" />
          <span style={labelStyle}>Also send to</span>
          <input style={inputStyle} value={ccText} disabled={!editable} onChange={(e) => { touch(); setCcText(e.target.value) }} placeholder="GC, spouse, property manager — comma separated (optional)" />
        </div>

        <div style={sectionHead}>What they&apos;re signing</div>
        <div style={rowStyle}>
          <span style={labelStyle}>Terms</span>
          <select style={inputStyle} value={templateId} disabled={!editable} onChange={(e) => { touch(); setTemplateId(e.target.value) }}>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.document_name}
                {t.book_version_date ? ` · v. ${t.book_version_date}` : ''}
              </option>
            ))}
            <option value={BUILTIN_TEMPLATE_ID}>Built-in service agreement terms</option>
          </select>
          {templates.length === 0 && editable ? (
            <>
              <span />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                No customer templates in the Contract Book yet — the built-in terms are used. Add one under People → Contracts → Contract library (audience: customer).
              </span>
            </>
          ) : null}
          <span style={labelStyle}>Scope</span>
          <textarea style={{ ...inputStyle, minHeight: 84, resize: 'vertical' }} value={scopeText} disabled={!editable} onChange={(e) => applyScopeText(e.target.value)} placeholder="One line per item — what you'll do, in the customer's words" />
          <span style={labelStyle}>Not included</span>
          <input style={inputStyle} value={fields.exclusions} disabled={!editable} onChange={(e) => setField('exclusions', e.target.value)} placeholder="Drywall repair, painting, permits by others (optional)" />
          <span style={labelStyle}>Amount</span>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input style={{ ...inputStyle, maxWidth: 160 }} inputMode="decimal" value={amountText} disabled={!editable} onChange={(e) => applyAmountText(e.target.value)} placeholder="Blank = billed at completion" />
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{fields.amount_cents != null ? formatContractMoney(fields.amount_cents) : 'time & materials'}</span>
          </div>
          <span style={labelStyle}>Payment</span>
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            {PAYMENT_TERMS_PRESETS.map((p) => {
              const on = fields.payment_terms_key === p.key
              return (
                <button
                  key={p.key}
                  type="button"
                  disabled={!editable}
                  onClick={() => setField('payment_terms_key', p.key as PaymentTermsKey)}
                  style={{ ...btn, padding: '0.25rem 0.6rem', fontSize: '0.75rem', borderRadius: 999, background: on ? 'var(--bg-blue-tint)' : 'var(--surface)', color: on ? 'var(--text-blue-700)' : 'var(--text-700)', borderColor: on ? 'var(--text-link)' : 'var(--border-strong)' }}
                >
                  {p.label}
                </button>
              )
            })}
          </div>
          {fields.payment_terms_key === 'custom' ? (
            <>
              <span />
              <input style={inputStyle} value={fields.payment_terms_text} disabled={!editable} onChange={(e) => setField('payment_terms_text', e.target.value)} placeholder="Describe the payment terms" />
            </>
          ) : (
            <>
              <span />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{paymentTermsSentence(fields)}</span>
            </>
          )}
          <span style={labelStyle}>Dates</span>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <input style={{ ...inputStyle, maxWidth: 160 }} type="date" value={fields.start_date ?? ''} disabled={!editable} onChange={(e) => setField('start_date', e.target.value || null)} aria-label="Start date" />
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>to</span>
            <input style={{ ...inputStyle, maxWidth: 160 }} type="date" value={fields.completion_date ?? ''} disabled={!editable} onChange={(e) => setField('completion_date', e.target.value || null)} aria-label="Estimated completion date" />
          </div>
          <span style={labelStyle}>Note</span>
          <input style={inputStyle} value={fields.note} disabled={!editable} onChange={(e) => setField('note', e.target.value)} placeholder="A line the customer reads above the terms (optional)" />
        </div>

        <div style={sectionHead}>Sending</div>
        <div style={rowStyle}>
          <span style={labelStyle}>Message</span>
          <textarea style={{ ...inputStyle, minHeight: 56, resize: 'vertical' }} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Optional note for the email (default: a one-line intro)" />
          <span style={labelStyle}>Reminders</span>
          <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', fontSize: '0.8rem' }}>
            <input type="checkbox" checked={remindersEnabled} disabled={!editable} onChange={(e) => { touch(); setRemindersEnabled(e.target.checked) }} />
            Remind by email every 3 days until signed, up to 3 times
          </label>
        </div>

        {historyRows.length > 0 ? (
          <>
            <div style={sectionHead}>History</div>
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              {historyRows.map((r) => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.6rem', borderBottom: '1px solid var(--border)', fontSize: '0.78rem' }}>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    rev {r.revision} · {r.template_name ?? 'Contract'}
                    {r.signed_at ? ` · ${jobContractSignatureAuditLine(r) ?? ''}` : r.last_sent_at ? ` · sent ${formatContractStamp(r.last_sent_at) ?? ''}` : ` · ${formatContractStamp(r.created_at) ?? ''}`}
                  </span>
                  {jobContractChips(r).map((chip) => (
                    <span key={chip.label} style={{ ...jobContractChipColors(chip.tone), padding: '0.05rem 0.45rem', borderRadius: 999, fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {chip.label}
                    </span>
                  ))}
                  <button type="button" style={{ ...btn, padding: '0.2rem 0.5rem', fontSize: '0.72rem' }} onClick={() => (r.signed_at ? setRecordRow(r) : viewHistoryRow(r))}>
                    View
                  </button>
                </div>
              ))}
            </div>
          </>
        ) : null}
        {lastLink ? (
          <div style={{ marginTop: '0.6rem', fontSize: '0.72rem', color: 'var(--text-muted)', wordBreak: 'break-all' }}>
            Signing link: <a href={lastLink} target="_blank" rel="noopener noreferrer">{jobContractSigningUrl(window.location.origin, '…')}</a>
          </div>
        ) : null}
      </div>
      {paperOpen ? (
        <ResponsiveModalShell
          title="File a signed contract"
          onRequestClose={() => setPaperOpen(false)}
          maxWidthDesktop={540}
          zIndex={1300}
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button type="button" style={btn} disabled={paperBusy} onClick={() => setPaperOpen(false)}>
                Cancel
              </button>
              <button type="button" style={{ ...btnPrimary, opacity: paperReady ? 1 : 0.55 }} disabled={paperBusy || !paperReady} onClick={() => void recordPaper()} title={paperReady ? undefined : 'Paste the Google Doc link, or attach a scan'}>
                {paperBusy ? 'Recording…' : 'Record as signed'}
              </button>
            </div>
          }
        >
          <div style={{ fontSize: '0.85rem', display: 'grid', gap: '0.7rem' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Already signed outside the app? Paste the Google Doc and the job reads signed. Nothing is sent to the customer.</div>
            {paperLinkCommitted && isHttpUrl(paperLink) ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', padding: '0.5rem 0.7rem', borderRadius: 8, background: 'var(--bg-green-tint)', border: '1px solid var(--border)', color: 'var(--text-green-800)', fontSize: '0.8rem' }}>
                <span aria-hidden style={{ width: 16, height: 20, borderRadius: 3, background: 'var(--text-link)', flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <b>{isGoogleDocsUrl(paperLink) ? 'Google Doc linked' : 'Link filed'}</b> · {shortDocumentLabel(paperLink)}
                </span>
                <button type="button" onClick={() => { setPaperLink(''); setPaperLinkCommitted(false) }} style={{ ...btn, padding: '0.15rem 0.5rem', fontSize: '0.72rem', borderColor: 'transparent', background: 'transparent', color: 'var(--text-muted)' }}>
                  change
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', padding: '0.7rem 0.85rem', borderRadius: 10, border: '1.5px dashed var(--text-link)', background: 'var(--bg-blue-tint)' }}>
                <span aria-hidden style={{ width: 30, height: 38, borderRadius: 4, background: 'var(--text-link)', flexShrink: 0, marginTop: 2 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: 'var(--text-strong)', fontSize: '0.88rem' }}>Paste the Google Doc link</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Share → Copy link in Google Docs, then paste it here.</div>
                  <input
                    style={{ ...inputStyle, marginTop: '0.4rem' }}
                    value={paperLink}
                    onChange={(e) => setPaperLink(e.target.value)}
                    onBlur={() => { if (isHttpUrl(paperLink)) setPaperLinkCommitted(true) }}
                    onKeyDown={(e) => { if (e.key === 'Enter' && isHttpUrl(paperLink)) { e.preventDefault(); setPaperLinkCommitted(true) } }}
                    onPaste={(e) => {
                      const t = e.clipboardData.getData('text')
                      if (t) {
                        e.preventDefault()
                        setPaperLink(t.trim())
                        setPaperLinkCommitted(isHttpUrl(t))
                      }
                    }}
                    placeholder="https://docs.google.com/document/d/…"
                    inputMode="url"
                    aria-label="Google Doc link"
                    autoFocus
                  />
                  {paperLink.trim() && !isHttpUrl(paperLink) ? (
                    <div style={{ marginTop: '0.35rem', fontSize: '0.74rem', color: 'var(--text-orange-800)', background: 'var(--bg-orange-tint)', borderRadius: 6, padding: '0.3rem 0.5rem' }}>
                      That isn&apos;t a link yet — paste the doc&apos;s Share link, or attach a file below.
                    </div>
                  ) : null}
                </div>
              </div>
            )}
            {paperLinkCommitted && isHttpUrl(paperLink) && !isGoogleDocsUrl(paperLink) ? (
              <div style={{ fontSize: '0.74rem', color: 'var(--text-orange-800)', background: 'var(--bg-orange-tint)', borderRadius: 6, padding: '0.3rem 0.5rem' }}>
                That isn&apos;t a Google link. It will be filed as-is — paste the doc&apos;s Share link if you have one.
              </div>
            ) : null}
            <div style={rowStyle}>
              <span style={labelStyle}>Signed by</span>
              <input style={inputStyle} value={paperSignerName} onChange={(e) => setPaperSignerName(e.target.value)} placeholder={recipientName.trim() || job.customer_name || 'Customer name'} />
              <span style={labelStyle}>Signed on</span>
              <input style={{ ...inputStyle, maxWidth: 180 }} type="date" value={paperSignedOn} onChange={(e) => setPaperSignedOn(e.target.value)} aria-label="Date the contract was signed" />
            </div>
            {paperAttachOpen ? (
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.7rem', background: 'var(--bg-subtle)', display: 'grid', gap: '0.35rem', fontSize: '0.8rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <b>Scan or photo</b>
                  <button type="button" onClick={() => { setPaperAttachOpen(false); setPaperFile(null) }} style={{ ...btn, padding: '0.1rem 0.4rem', fontSize: '0.7rem', borderColor: 'transparent', background: 'transparent', color: 'var(--text-muted)' }}>
                    optional · hide
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <input type="file" accept="image/png,image/jpeg,application/pdf" onChange={(e) => setPaperFile(e.target.files?.[0] ?? null)} style={{ fontSize: '0.78rem' }} />
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>PNG, JPG or PDF · kept with the job</span>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'right' }}>
                <button type="button" onClick={() => setPaperAttachOpen(true)} style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', fontSize: '0.72rem', color: 'var(--text-faint)', textDecoration: 'underline dotted', cursor: 'pointer' }}>
                  Have a scan or photo instead?
                </button>
              </div>
            )}
          </div>
        </ResponsiveModalShell>
      ) : null}
      <JobSignedAgreementModal
        open={recordRow != null}
        onClose={() => setRecordRow(null)}
        job={job}
        coverage={
          recordRow
            ? { kind: 'signed', source: recordRow.signer_mode === 'paper' ? 'paper' : 'contract', signedAt: recordRow.signed_at, signerName: recordRow.signer_printed_name, contractId: recordRow.id, estimateNumber: null, estimateId: null }
            : null
        }
        contractRow={recordRow}
      />
    </ResponsiveModalShell>
  )
}
