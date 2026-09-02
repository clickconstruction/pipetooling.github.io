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
  demandMoney,
  type DemandLetterFields,
  type DemandPriorNotice,
} from '../../lib/jobsDocuments/demandLetter'
import { liveDemandLetters, type JobDemandLetterRow } from '../../lib/jobs/demandLetterTracking'
import { computeJobLienClock, type JobLienFilingRow } from '../../lib/jobs/lienDeadlines'
import { type CustomerAddressRow, type JobPropertyOwnerLike } from '../../lib/jobs/lienProperty'
import LienFilingTabs from './LienFilingTabs'
import { openHtmlPreviewWindow, openHtmlPrintWindow } from '../../lib/jobsDocuments/printWindow'
import { fetchPhysicalInvoiceIssuerFromAppSettings, getPhysicalInvoiceIssuerDraft } from '../../lib/physicalInvoiceIssuer'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'
import { useAuth } from '../../hooks/useAuth'

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
  return new Date().toISOString().slice(0, 10)
}

/** Billed lines with money still open — what a demand letter is about. */
function demandableInvoices(job: JobWithDetails): JobsLedgerInvoice[] {
  const applied = new Map<string, number>()
  for (const p of job.payments ?? []) {
    if (p.invoice_id) applied.set(p.invoice_id, (applied.get(p.invoice_id) ?? 0) + Number(p.amount ?? 0))
  }
  return (job.invoices ?? [])
    .filter((i) => i.status === 'billed' && Number(i.amount ?? 0) - (applied.get(i.id) ?? 0) > 0.005)
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
    setActiveTab('demand')
    setRecordMethod('certified_mail')
    setRecordTracking('')
    setRecordSentOn(todayYmdLocal())
    void loadHistory()
    void loadFilings()
    let cancelled = false
    void (async () => {
      try {
        if (job.customer_id) {
          const { data } = await supabase.from('customers').select('address').eq('id', job.customer_id).maybeSingle()
          if (!cancelled) setCustomerAddress((data?.address ?? '').trim())
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

  const demandable = useMemo(() => (job ? demandableInvoices(job) : []), [job])
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

  // Prefill rebuild — keeps user-typed recipient/deadline/paymentMethod edits.
  useEffect(() => {
    if (!open || !job) return
    const single = selectedInvoices.length === 1 ? selectedInvoices[0] : null
    const recipient =
      single?.bill_to_name?.trim()
        ? { name: single.bill_to_name.trim(), email: (single.bill_to_email ?? '').trim(), address: '' }
        : {
            name: (job.customer_name ?? '').trim(),
            email: (job.customer_email ?? '').trim(),
            address: customerAddress,
          }
    setFields((prev) => {
      const next = buildDemandLetterPrefill({
        job,
        invoices: selectedInvoices,
        issuer,
        senderName: signerNameFallback,
        senderEmailFallback: authEmail,
        recipient,
        priorNotices,
        propertyKind,
        todayYmd: todayYmdLocal(),
      })
      if (!prev) return next
      return {
        ...next,
        recipientName: prev.recipientName.trim() ? prev.recipientName : next.recipientName,
        recipientEmail: prev.recipientEmail.trim() ? prev.recipientEmail : next.recipientEmail,
        recipientAddress: prev.recipientAddress.trim() ? prev.recipientAddress : next.recipientAddress,
        deadlineDate: prev.deadlineDate || next.deadlineDate,
        paymentMethod: prev.paymentMethod,
        includeSmallClaims: prev.includeSmallClaims,
        includeLien: prev.includeLien,
        includeTheftOfServices: prev.includeTheftOfServices,
        includeLateFees: prev.includeLateFees,
        includeNotarial: prev.includeNotarial,
      }
    })
  }, [open, job, selectedInvoices, issuer, priorNotices, customerAddress, propertyKind, signerNameFallback, authEmail])

  // Clamp: § 31.04 can never ride a letter for a job with payments (owner rule).
  useEffect(() => {
    if (!fields) return
    const hasPayments = Number((fields.paymentsReceived ?? '').replace(/[$,\s]/g, '')) > 0
    if (hasPayments && fields.includeTheftOfServices) {
      setFields((prev) => (prev ? { ...prev, includeTheftOfServices: false } : prev))
    }
  }, [fields])

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

  const printLetter = useCallback(() => {
    if (!fields) return
    const ok = openHtmlPrintWindow(buildDemandLetterPrintHtml(fields, todayYmdLocal(), jobNumber))
    if (!ok) showToast('Popup blocked — allow popups to print.', 'error')
  }, [fields, jobNumber, showToast])

  const downloadPdf = useCallback(async () => {
    if (!fields || pdfBusy) return
    setPdfBusy(true)
    try {
      const blob = await buildDemandLetterPdfBlob(fields, todayYmdLocal())
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
  }, [fields, jobNumber, pdfBusy, showToast])

  const recordSend = useCallback(async () => {
    if (!fields || !job || recordBusy) return
    setRecordBusy(true)
    try {
      const amountNum = Number((fields.outstanding ?? '').replace(/[$,\s]/g, ''))
      const fieldsSnapshot = JSON.parse(JSON.stringify(fields)) as { [key: string]: never }
      await withSupabaseRetry<{ id: string }>(
        () =>
          supabase
            .from('job_demand_letters')
            .insert({
              job_id: job.id,
              invoice_ids: [...selectedInvoiceIds],
              amount: Number.isFinite(amountNum) ? Math.max(0, Math.round(amountNum * 100) / 100) : 0,
              deadline_date: fields.deadlineDate || null,
              fields: fieldsSnapshot,
              recipient_name: fields.recipientName.trim(),
              recipient_email: fields.recipientEmail.trim(),
              recipient_address: fields.recipientAddress.trim(),
              sent_method: recordMethod,
              tracking_number: recordTracking.trim(),
              sent_at: recordSentOn || null,
              created_by: authUser?.id ?? null,
            })
            .select('id')
            .single(),
        'record demand letter send',
      )
      showToast('Demand letter recorded — the deadline watch is armed.', 'success')
      setRecordOpen(false)
      void loadHistory()
      onRecorded?.()
    } catch {
      showToast('Could not record the send.', 'error')
    } finally {
      setRecordBusy(false)
    }
  }, [fields, job, selectedInvoiceIds, recordMethod, recordTracking, recordSentOn, authUser?.id, recordBusy, showToast, loadHistory, onRecorded])

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
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Demand covers bill line(s)</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {demandable.map((i, idx) => {
                    const on = selectedInvoiceIds.has(i.id)
                    return (
                      <button
                        key={i.id}
                        type="button"
                        onClick={() =>
                          setSelectedInvoiceIds((prev) => {
                            const next = new Set(prev)
                            if (next.has(i.id)) next.delete(i.id)
                            else next.add(i.id)
                            return next
                          })
                        }
                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.8125rem', borderRadius: 6, border: on ? '2px solid #16a34a' : '1px solid var(--border-strong)', background: on ? 'var(--bg-green-tint)' : 'var(--surface)', cursor: 'pointer', fontWeight: on ? 600 : 400 }}
                      >
                        #{idx + 1} · ${Number(i.amount ?? 0).toLocaleString('en-US')}
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

            <label style={{ display: 'block', marginBottom: '0.65rem', fontSize: '0.875rem' }}>
              <span style={{ display: 'block', fontWeight: 500, marginBottom: '0.2rem' }}>To (the debtor)</span>
              <input type="text" value={fields.recipientName} onChange={(e) => setField('recipientName', e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '0.45rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem' }} />
            </label>
            <label style={{ display: 'block', marginBottom: '0.65rem', fontSize: '0.875rem' }}>
              <span style={{ display: 'block', fontWeight: 500, marginBottom: '0.2rem' }}>Recipient mailing address</span>
              <input type="text" value={fields.recipientAddress} onChange={(e) => setField('recipientAddress', e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '0.45rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem' }} />
            </label>
            <label style={{ display: 'block', marginBottom: '0.65rem', fontSize: '0.875rem' }}>
              <span style={{ display: 'block', fontWeight: 500, marginBottom: '0.2rem' }}>
                Payment deadline{' '}
                <button type="button" onClick={() => setField('deadlineDate', addBusinessDays(todayYmdLocal(), 10))} style={{ background: 'none', border: 'none', color: 'var(--text-link)', fontSize: '0.6875rem', fontWeight: 700, cursor: 'pointer', padding: 0 }}>
                  +10 business days
                </button>
              </span>
              <input type="date" value={fields.deadlineDate} onChange={(e) => setField('deadlineDate', e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '0.45rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem' }} />
            </label>
            <label style={{ display: 'block', marginBottom: '0.65rem', fontSize: '0.875rem' }}>
              <span style={{ display: 'block', fontWeight: 500, marginBottom: '0.2rem' }}>Payment method line (optional)</span>
              <input type="text" value={fields.paymentMethod} onChange={(e) => setField('paymentMethod', e.target.value)} placeholder="e.g. Checks payable to Click Plumbing and Electrical." style={{ width: '100%', boxSizing: 'border-box', padding: '0.45rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem' }} />
            </label>

            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', margin: '0.8rem 0 0.3rem' }}>Notice history the letter cites</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 6, padding: '0.4rem 0.55rem', marginBottom: '0.8rem', background: 'var(--bg-subtle)' }}>
              {priorNotices.length === 0 ? 'Just the invoice date — no re-sends or collection calls recorded yet.' : priorNotices.map((n) => `${demandDate(n.date)} — ${n.label}`).join(' · ')}
            </div>

            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Escalation lines</div>
            {toggle('includeSmallClaims', 'Small-claims lawsuit')}
            {toggle('includeLien', fields.lienFilingDeadline ? `Mechanic's lien under Chapter 53 (window through ${demandDate(fields.lienFilingDeadline)})` : "Mechanic's lien under Chapter 53")}
            {(() => {
              // Owner rule (2026-09-02): § 31.04 only applies when the client
              // has made NO payments on the job — a partial payment defeats it.
              const hasPayments = Number((fields.paymentsReceived ?? '').replace(/[$,\s]/g, '')) > 0
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
            {toggle('includeLateFees', 'Late-fees / interest note')}
            {toggle('includeNotarial', 'Notarial block (certified mail only)')}
          </div>

          {/* Live preview — pinned light like the printed letter. */}
          <div data-theme="light" style={{ flex: '1 1 22rem', minWidth: '19rem', padding: '1.25rem', background: 'var(--bg-subtle)', borderLeft: '1px solid var(--border)' }}>
            <div style={{ background: 'var(--surface)', color: 'var(--text-base)', border: '1px solid var(--border)', borderRadius: 4, padding: '1.2rem 1.35rem', fontFamily: "Georgia, 'Times New Roman', serif", fontSize: '0.78rem', lineHeight: 1.65, boxShadow: '0 4px 14px rgba(0,0,0,0.08)' }}>
              {model.map((b, i) => {
                switch (b.kind) {
                  case 'senderBlock':
                    return (
                      <p key={i} style={{ textAlign: 'right', margin: '0 0 0.9em' }}>
                        {b.lines.map((l, j) => (
                          <span key={j}>
                            {l}
                            <br />
                          </span>
                        ))}
                      </p>
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
          </div>
        </div>

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
            <button type="button" onClick={printLetter} style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', background: 'var(--surface)', border: '1px solid #2563eb', color: 'var(--text-link)', borderRadius: 4, cursor: 'pointer' }}>
              Print
            </button>
            <button type="button" onClick={() => void downloadPdf()} disabled={pdfBusy} style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', background: 'var(--surface)', border: '1px solid #2563eb', color: 'var(--text-link)', borderRadius: 4, cursor: pdfBusy ? 'wait' : 'pointer' }}>
              {pdfBusy ? 'Building…' : 'Download PDF'}
            </button>
            <button type="button" onClick={() => setRecordOpen(true)} style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', background: '#b45309', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>
              Save &amp; record send…
            </button>
          </div>
        )}
          </>
        ) : (
          <LienFilingTabs
            job={job}
            jobNumber={jobNumber}
            activeTab={activeTab}
            issuer={issuer}
            signerNameFallback={signerNameFallback}
            linkedAddress={linkedAddress}
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
