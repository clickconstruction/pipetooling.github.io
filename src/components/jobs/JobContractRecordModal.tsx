/**
 * The signed-contract record (Contract Desk PR 3): the document exactly as
 * signed, the signature (drawn image from the private bucket or the typed
 * line), and the e-sign audit — who, how, when, from where. Paper records
 * show the uploaded copy instead. Print reuses the same HTML.
 */
import { useEffect, useMemo, useState } from 'react'
import ResponsiveModalShell from '../ResponsiveModalShell'
import IpAddressMapButton from '../estimates/IpAddressMapButton'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import { renderContractBodyToSafeHtml } from '../../lib/renderContractBodyToSafeHtml'
import { openHtmlPrintWindow } from '../../lib/jobsDocuments/printWindow'
import { getPhysicalInvoiceIssuerForDocument } from '../../lib/physicalInvoiceIssuer'
import { buildJobContractDocumentHtml, jobContractHeading, parseJobContractFields } from '../../lib/jobs/jobContractDocument'
import { formatContractStamp, jobContractSignatureAuditLine, type JobContractRow } from '../../lib/jobs/jobContractLifecycle'

export const JOB_CONTRACT_BUCKET = 'job-contract-documents'

export type JobContractRecordModalProps = {
  open: boolean
  onClose: () => void
  row: JobContractRow | null
  job: { hcp_number: string | null; click_number: string | null; job_name: string | null; job_address: string | null; customer_name: string | null } | null
}

const kv: React.CSSProperties = { display: 'grid', gridTemplateColumns: '120px minmax(0, 1fr)', gap: '0.25rem 0.75rem', fontSize: '0.82rem' }
const k: React.CSSProperties = { color: 'var(--text-muted)' }

export default function JobContractRecordModal({ open, onClose, row, job }: JobContractRecordModalProps) {
  const { showToast } = useToastContext()
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null)
  const [paperUrl, setPaperUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !row) {
      setSignatureUrl(null)
      setPaperUrl(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        if (row.signer_signature_storage_path) {
          const { data } = await supabase.storage.from(JOB_CONTRACT_BUCKET).createSignedUrl(row.signer_signature_storage_path, 3600)
          if (!cancelled) setSignatureUrl(data?.signedUrl ?? null)
        }
        if (row.paper_upload_path) {
          const { data } = await supabase.storage.from(JOB_CONTRACT_BUCKET).createSignedUrl(row.paper_upload_path, 3600)
          if (!cancelled) setPaperUrl(data?.signedUrl ?? null)
        }
      } catch {
        /* the record still reads without the images */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, row])

  const html = useMemo(() => {
    if (!row || !job) return ''
    const issuer = getPhysicalInvoiceIssuerForDocument()
    return buildJobContractDocumentHtml({
      heading: jobContractHeading(job),
      jobNumber: effectiveJobLedgerNumber(job.hcp_number, job.click_number) || '—',
      jobAddress: job.job_address ?? '',
      customerName: job.customer_name ?? '',
      recipientName: row.recipient_name ?? '',
      dateLabel: formatContractStamp(row.last_sent_at ?? row.created_at)?.split(',').slice(0, 2).join(',') ?? '',
      revision: row.revision,
      fields: parseJobContractFields(row.fields),
      termsHtml: renderContractBodyToSafeHtml(row.body_html, row.body_format),
      templateName: row.template_name,
      issuer: issuer.companyName ? issuer : null,
      signature: row.signed_at
        ? { printedName: row.signer_printed_name ?? '', auditLine: jobContractSignatureAuditLine(row) ?? '', imageUrl: signatureUrl }
        : null,
    })
  }, [row, job, signatureUrl])

  if (!open || !row || !job) return null
  const isPaper = row.signer_mode === 'paper'
  const audit = jobContractSignatureAuditLine(row)

  return (
    <ResponsiveModalShell
      title={`Signed contract · J${effectiveJobLedgerNumber(job.hcp_number, job.click_number) || '—'}`}
      onRequestClose={onClose}
      maxWidthDesktop={820}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          {!isPaper ? (
            <button
              type="button"
              onClick={() => {
                if (!openHtmlPrintWindow(html)) showToast('Allow pop-ups to print the contract.', 'error')
              }}
              style={{ padding: '0.4rem 0.8rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', font: 'inherit', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
            >
              Print / save as PDF
            </button>
          ) : null}
        </div>
      }
    >
      <div style={{ ...kv, marginBottom: '0.75rem' }}>
        <span style={k}>Signed by</span>
        <span style={{ fontWeight: 600 }}>{row.signer_printed_name || '—'}</span>
        <span style={k}>How</span>
        <span>{isPaper ? 'On paper (uploaded copy)' : row.signer_mode === 'draw' ? 'Drawn signature' : row.signer_mode === 'in_person' ? 'In person, on our device' : 'Typed signature'}</span>
        <span style={k}>When</span>
        <span>{formatContractStamp(row.signed_at) ?? '—'}{isPaper && row.paper_signed_on ? ` · signed on ${row.paper_signed_on}` : ''}</span>
        {!isPaper ? (
          <>
            <span style={k}>Consent</span>
            <span>{row.signer_consented_at ? `Recorded ${formatContractStamp(row.signer_consented_at)}` : '—'}</span>
            <span style={k}>From</span>
            <span style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              {row.signer_ip || '—'}
              <IpAddressMapButton ip={row.signer_ip} />
            </span>
            <span style={k}>Device</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', wordBreak: 'break-all' }}>{row.signer_user_agent || '—'}</span>
          </>
        ) : null}
        <span style={k}>Document</span>
        <span>
          {row.template_name ?? 'Contract'} · rev {row.revision}
          {row.template_version_date ? ` · v. ${row.template_version_date}` : ''}
        </span>
      </div>
      {audit ? <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>{audit}</div> : null}
      {isPaper ? (
        paperUrl ? (
          <a href={paperUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.85rem' }}>
            Open the uploaded signed copy ↗
          </a>
        ) : (
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {row.paper_upload_path ? 'The uploaded copy could not be loaded.' : 'No file was uploaded — recorded from the paper copy on file.'}
          </p>
        )
      ) : (
        <iframe
          title="Signed contract"
          srcDoc={html}
          style={{ width: '100%', height: '60vh', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)' }}
        />
      )}
    </ResponsiveModalShell>
  )
}
