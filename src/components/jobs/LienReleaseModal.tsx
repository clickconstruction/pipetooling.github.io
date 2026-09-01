import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Database } from '../../types/database'
import type { JobWithDetails } from '../../types/jobWithDetails'
import {
  LIEN_WAIVER_FORM_SHORT_LABELS,
  LIEN_WAIVER_FORM_TYPES,
  buildLienWaiverEmailHtml,
  buildLienWaiverEmailText,
  buildLienWaiverParagraphs,
  buildLienWaiverPdfBlob,
  buildLienWaiverPrefill,
  buildLienWaiverPrintHtml,
  buildLienWaiverSignatureLines,
  lienWaiverInvoiceOpenRemaining,
  lienWaiverPdfFilename,
  lienWaiverTitle,
  lienWaiverUsesField,
  type LienWaiverFields,
  type LienWaiverFormType,
} from '../../lib/jobsDocuments/lienWaiverRelease'
import { openHtmlPrintWindow } from '../../lib/jobsDocuments/printWindow'
import { copyRichHtmlToClipboard } from '../../lib/copyRichHtmlToClipboard'
import { fetchPhysicalInvoiceIssuerFromAppSettings, getPhysicalInvoiceIssuerDraft } from '../../lib/physicalInvoiceIssuer'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import { supabase } from '../../lib/supabase'
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
}: {
  open: boolean
  onClose: () => void
  job: JobWithDetails | null
  /** Row-level hint: preselect this bill line when it is selectable. */
  invoice: JobsLedgerInvoice | null
  /** Job master's People "Full name and title" with session-name fallback (same line the lien prefill uses). */
  signerNameFallback: string
}) {
  const { role: authRole } = useAuth()
  const { showToast } = useToastContext()
  const [formType, setFormType] = useState<LienWaiverFormType>('conditional_progress')
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<ReadonlySet<string>>(() => new Set())
  const [fields, setFields] = useState<LienWaiverFields | null>(null)
  const [ownerName, setOwnerName] = useState<string | null>(null)
  const [issuerGen, setIssuerGen] = useState(0)
  const [pdfBusy, setPdfBusy] = useState(false)

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

  // Owner block: a saved job_property_owners row wins over the job's customer.
  useEffect(() => {
    if (!open || !job) {
      setOwnerName(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const { data } = await supabase
          .from('job_property_owners')
          .select('owner_name, company_name')
          .eq('job_id', job.id)
          .maybeSingle()
        if (cancelled) return
        const name = (data?.owner_name ?? '').trim() || (data?.company_name ?? '').trim()
        setOwnerName(name || null)
      } catch {
        // prefill nicety — the field stays editable either way
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, job?.id])

  const invoices = useMemo(() => (job ? selectableInvoices(job) : []), [job])

  // Open-reset: default the selection to the row's invoice, else billed lines, else everything selectable.
  useEffect(() => {
    if (!open || !job) return
    setFormType('conditional_progress')
    const selectable = selectableInvoices(job)
    if (invoice && selectable.some((i) => i.id === invoice.id)) {
      setSelectedInvoiceIds(new Set([invoice.id]))
      return
    }
    const billed = selectable.filter((i) => i.status === 'billed')
    setSelectedInvoiceIds(new Set((billed.length > 0 ? billed : selectable).map((i) => i.id)))
  }, [open, job?.id, invoice?.id])

  const selectedInvoices = useMemo(
    () => invoices.filter((i) => selectedInvoiceIds.has(i.id)),
    [invoices, selectedInvoiceIds],
  )

  // Rebuild the prefill whenever its inputs change; keep user-typed signer lines.
  useEffect(() => {
    if (!open || !job) {
      setFields(null)
      return
    }
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
    setFields((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  const toggleInvoice = (id: string) => {
    setSelectedInvoiceIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const copyForEmail = useCallback(async () => {
    if (!fields) return
    try {
      await copyRichHtmlToClipboard(
        buildLienWaiverEmailHtml(formType, fields),
        buildLienWaiverEmailText(formType, fields),
      )
      showToast('Release copied — paste into an email.', 'success')
    } catch {
      showToast('Could not copy the release.', 'error')
    }
  }, [fields, formType, showToast])

  const printRelease = useCallback(() => {
    if (!fields) return
    const ok = openHtmlPrintWindow(buildLienWaiverPrintHtml(formType, fields, jobNumber))
    if (!ok) showToast('Popup blocked — allow popups to print.', 'error')
  }, [fields, formType, jobNumber, showToast])

  const downloadPdf = useCallback(async () => {
    if (!fields || pdfBusy) return
    setPdfBusy(true)
    try {
      const blob = await buildLienWaiverPdfBlob(formType, fields)
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
  }, [fields, formType, jobNumber, pdfBusy, showToast])

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
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
          <h2 id="lien-release-title" style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600 }}>
            Release of Lien
          </h2>
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            {(job.job_name ?? '').trim() || 'Job'} · {jobNumber} — prefilled from the job; every field stays editable.
          </p>
        </div>

        <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {LIEN_WAIVER_FORM_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setFormType(t)}
              style={{
                padding: '0.4rem 0.75rem',
                fontSize: '0.8125rem',
                borderRadius: 6,
                border: formType === t ? '2px solid #2563eb' : '1px solid var(--border-strong)',
                background: formType === t ? 'var(--bg-blue-tint)' : 'var(--surface)',
                cursor: 'pointer',
                fontWeight: formType === t ? 600 : 400,
              }}
            >
              {LIEN_WAIVER_FORM_SHORT_LABELS[t]}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', overflowY: 'auto', flex: 1 }}>
          <div style={{ flex: '1 1 18rem', minWidth: '17rem', padding: '1rem 1.25rem' }}>
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
                  onChange={(e) => setField(key, e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '0.45rem 0.5rem',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 4,
                    fontSize: '0.875rem',
                  }}
                />
              </label>
            ))}
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
            justifyContent: 'flex-end',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void copyForEmail()}
            style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', background: 'var(--surface)', border: '1px solid #2563eb', color: 'var(--text-link)', borderRadius: 4, cursor: 'pointer' }}
          >
            Copy for email
          </button>
          <button
            type="button"
            onClick={printRelease}
            style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', background: 'var(--surface)', border: '1px solid #2563eb', color: 'var(--text-link)', borderRadius: 4, cursor: 'pointer' }}
          >
            Print
          </button>
          <button
            type="button"
            onClick={() => void downloadPdf()}
            disabled={pdfBusy}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              background: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: pdfBusy ? 'wait' : 'pointer',
              fontWeight: 500,
            }}
          >
            {pdfBusy ? 'Building…' : 'Download PDF'}
          </button>
        </div>
      </div>
    </div>
  )
}
