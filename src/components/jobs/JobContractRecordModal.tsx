/**
 * The signed-contract record's two shared pieces (Contract Desk PR 3; body/shell split v2.2709):
 * signed URLs for the drawn marks, the stored PDF and the paper upload, and the record's printable
 * HTML. The standalone modal and its facts body were mounted nowhere; they went in punch list
 * #64's tidy (2026-10-07). The Contract window and its signed rail draw the record now.
 */
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import { renderContractBodyToSafeHtml } from '../../lib/renderContractBodyToSafeHtml'
import { getPhysicalInvoiceIssuerForDocument } from '../../lib/physicalInvoiceIssuer'
import { buildJobContractDocumentHtml, jobContractHeading, parseJobContractFields } from '../../lib/jobs/jobContractDocument'
import { formatContractStamp, jobContractSignatureBlocks, type JobContractRow } from '../../lib/jobs/jobContractLifecycle'
import { JOB_CONTRACT_BUCKET } from '../../lib/jobs/jobContractFileWrite'

export type JobContractRecordJob = {
  hcp_number: string | null
  click_number: string | null
  job_name: string | null
  job_address: string | null
  customer_name: string | null
}

/** Signed URLs for the drawn signature, the stored PDF, and the paper upload. */
export function useJobContractRecordUrls(row: JobContractRow | null, open: boolean): { signatureUrl: string | null; pdfUrl: string | null; paperUrl: string | null; coSignatureUrl: string | null } {
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null)
  /** v2.4186: the second frame's drawn mark. */
  const [coSignatureUrl, setCoSignatureUrl] = useState<string | null>(null)
  const [paperUrl, setPaperUrl] = useState<string | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!open || !row) {
      setSignatureUrl(null)
      setCoSignatureUrl(null)
      setPaperUrl(null)
      setPdfUrl(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        if (row.signer_signature_storage_path) {
          const { data } = await supabase.storage.from(JOB_CONTRACT_BUCKET).createSignedUrl(row.signer_signature_storage_path, 3600)
          if (!cancelled) setSignatureUrl(data?.signedUrl ?? null)
        }
        if (row.co_signer_signature_storage_path) {
          const { data } = await supabase.storage.from(JOB_CONTRACT_BUCKET).createSignedUrl(row.co_signer_signature_storage_path, 3600)
          if (!cancelled) setCoSignatureUrl(data?.signedUrl ?? null)
        }
        if (row.paper_upload_path) {
          const { data } = await supabase.storage.from(JOB_CONTRACT_BUCKET).createSignedUrl(row.paper_upload_path, 3600)
          if (!cancelled) setPaperUrl(data?.signedUrl ?? null)
        }
        if (row.signed_pdf_path) {
          const { data } = await supabase.storage.from(JOB_CONTRACT_BUCKET).createSignedUrl(row.signed_pdf_path, 3600)
          if (!cancelled) setPdfUrl(data?.signedUrl ?? null)
        }
      } catch {
        /* the record still reads without the images */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, row])
  return { signatureUrl, pdfUrl, paperUrl, coSignatureUrl }
}

export function buildJobContractRecordHtml(row: JobContractRow, job: JobContractRecordJob, signatureUrl: string | null, coSignatureUrl: string | null = null): string {
  const issuer = getPhysicalInvoiceIssuerForDocument()
  // v2.4590: a second signer prints a second block, as the stored PDF does.
  const blocks = jobContractSignatureBlocks(row, { signatureUrl, coSignatureUrl, record: { jobNumber: effectiveJobLedgerNumber(job.hcp_number, job.click_number) || '0' } })
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
    signature: blocks.signature,
    coSignerName: blocks.coSignerName,
    coSignature: blocks.coSignature,
  })
}
