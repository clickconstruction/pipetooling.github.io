import { LIEN_RELEASE_DOCUMENTS_BUCKET } from './lienReleaseDocuments'
import { trimSignatureInk } from '../signatureInkTrim'
import { supabase } from '../supabase'

/**
 * A drawn lien-notice signature's ink, read back (v2.5082): the PNG stored at signing
 * (`signer_signature_storage_path`) as a data URL, trimmed to the strokes, cached per path — the
 * release's `lienReleaseInk.ts` for the desk item. A pressed signature has no file and reads null.
 */
type InkRow = { signer_signature_mode?: string | null; signer_signature_storage_path?: string | null }

const inkCache = new Map<string, Promise<string | null>>()

async function blobToDataUrl(blob: Blob, fallbackType: string): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer())
  let bin = ''
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000))
  return `data:${blob.type || fallbackType};base64,${btoa(bin)}`
}

/** The drawn signature as a data URL; null for a pressed signature, a missing file, or a failed read. */
export function loadLienDeskSignatureInk(row: InkRow): Promise<string | null> {
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

/** Tests only: forget the cached ink. */
export function __resetLienDeskSignatureInkCache(): void {
  inkCache.clear()
}
