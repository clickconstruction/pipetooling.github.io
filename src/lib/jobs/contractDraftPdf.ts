/**
 * Download the UNSIGNED agreement as a PDF (Signing it on paper PR 1, v2.3527):
 * `share-job-contract` in `draft_pdf` mode renders the same document the
 * customer would sign, with blank Sign / Date rules instead of a signature
 * block, and hands back bytes. Nothing is written — no row, no storage, no
 * link — so the office can print or attach it for a customer who signs on paper.
 */
import { supabase } from '../supabase'

export type ContractDraftPdfSource =
  | { contractId: string }
  | {
      jobId: string
      draft: { fields: unknown; body_html: string | null; body_format: string | null; template_name: string | null; recipient_name: string | null; revision?: number | null }
    }

export type ContractDraftPdfResult = { filename: string; bytes: Uint8Array }

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export async function fetchContractDraftPdf(source: ContractDraftPdfSource): Promise<ContractDraftPdfResult> {
  const body = 'contractId' in source ? { mode: 'draft_pdf', contract_id: source.contractId } : { mode: 'draft_pdf', job_id: source.jobId, draft: source.draft }
  const { data, error } = await supabase.functions.invoke('share-job-contract', { body })
  const res = (data ?? {}) as { ok?: boolean; filename?: string; pdf_base64?: string; error?: string }
  if (error || !res.ok || !res.pdf_base64) {
    // An older function build reads an unknown mode as "email" and answers with its own words; say what is really missing.
    const msg = res.error ?? error?.message ?? 'Could not build the PDF.'
    throw new Error(/valid email/i.test(msg) ? 'The PDF download is not live on the server yet - the function still has to be deployed.' : msg)
  }
  return { filename: res.filename ?? 'Agreement-to-sign.pdf', bytes: base64ToBytes(res.pdf_base64) }
}

/** Hand the bytes to the browser as a file save. */
export function saveBytesAsFile(bytes: Uint8Array, filename: string, contentType = 'application/pdf'): void {
  const blob = new Blob([bytes as BlobPart], { type: contentType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
