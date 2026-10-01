import { buildLienWaiverPdfBlob, type LienWaiverFields, type LienWaiverFormType, type LienWaiverSignature } from '../jobsDocuments/lienWaiverRelease'
import { lienReleaseRowSignature } from './lienReleaseLifecycle'
import { LIEN_RELEASE_DOCUMENTS_BUCKET } from './lienReleaseDocuments'
import type { JobLienReleaseRow } from './lienReleaseTracking'
import { trimSignatureInk } from '../signatureInkTrim'
import { supabase } from '../supabase'

/**
 * A signed waiver's ink, read back (v2.4335). Signing stores the drawn signature as a PNG
 * (`signer_signature_storage_path`) and the whole signed page as a PDF (`signed_pdf_path`), but
 * every later copy was rebuilt from the row alone — and the row has no picture — so the window's
 * Download PDF, Print and View, the Documents page, the signature inbox and the cleared-releases
 * queue all showed the name in italic type over the line (job 650, Oct 1: a 5.9 KB download beside
 * a 198 KB signed PDF holding the ink). Only the GC's email and portal read the stored PDF.
 *
 * - `loadLienReleaseInk`: the stored PNG as a data URL, trimmed to the strokes, cached per path.
 * - `lienReleaseRowSignatureWithInk`: the row's signature (`lienReleaseRowSignature`) with that ink.
 * - `lienReleaseSignedPdfBlob`: the stored signed PDF as signed — the same file the GC gets — and,
 *   when it is missing, the page rebuilt with the ink.
 */

type InkRow = Pick<JobLienReleaseRow, 'signer_signature_mode' | 'signer_signature_storage_path'>

const inkCache = new Map<string, Promise<string | null>>()

async function blobToDataUrl(blob: Blob, fallbackType: string): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer())
  let bin = ''
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000))
  return `data:${blob.type || fallbackType};base64,${btoa(bin)}`
}

/** The drawn signature stored at signing, trimmed to its ink; null for a typed signature, a missing file, or a failed read. */
export function loadLienReleaseInk(row: InkRow): Promise<string | null> {
  const path = (row.signer_signature_storage_path ?? '').trim()
  if (row.signer_signature_mode !== 'draw' || !path) return Promise.resolve(null)
  const hit = inkCache.get(path)
  if (hit) return hit
  const p = (async () => {
    try {
      const { data, error } = await supabase.storage.from(LIEN_RELEASE_DOCUMENTS_BUCKET).download(path)
      if (error || !data) return null
      return await trimSignatureInk(await blobToDataUrl(data, 'image/png'))
    } catch {
      return null
    }
  })()
  inkCache.set(path, p)
  // A failed read is not remembered — the next copy tries again.
  void p.then((v) => {
    if (v == null) inkCache.delete(path)
  })
  return p
}

/** The row's signature for a rebuilt page, with the stored ink when it was drawn. */
export async function lienReleaseRowSignatureWithInk(
  row: Parameters<typeof lienReleaseRowSignature>[0] & InkRow,
  onDeviceOf?: string | null,
): Promise<LienWaiverSignature | null> {
  const base = lienReleaseRowSignature(row, onDeviceOf)
  if (!base || base.mode !== 'draw') return base
  return { ...base, pngDataUrl: await loadLienReleaseInk(row) }
}

/**
 * The signed waiver as a PDF: the stored file exactly as it was signed when there is one, else the
 * page rebuilt with the stored ink (and, failing that, the name in type, as before).
 */
export async function lienReleaseSignedPdfBlob(
  row: Parameters<typeof lienReleaseRowSignature>[0] & InkRow & Pick<JobLienReleaseRow, 'signed_pdf_path'>,
  formType: LienWaiverFormType,
  fields: LienWaiverFields,
  onDeviceOf?: string | null,
): Promise<Blob> {
  const stored = (row.signed_pdf_path ?? '').trim()
  if (stored) {
    try {
      const { data, error } = await supabase.storage.from(LIEN_RELEASE_DOCUMENTS_BUCKET).download(stored)
      if (!error && data && data.size > 0) return data.type ? data : new Blob([data], { type: 'application/pdf' })
    } catch {
      /* rebuilt below */
    }
  }
  return buildLienWaiverPdfBlob(formType, fields, await lienReleaseRowSignatureWithInk(row, onDeviceOf))
}

/** Tests only: forget the cached ink. */
export function __resetLienReleaseInkCache(): void {
  inkCache.clear()
}
