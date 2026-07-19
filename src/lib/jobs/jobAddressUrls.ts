import type { JobWithDetails } from '../../types/jobWithDetails'
import { normalizeUrl } from '../projectsForecastStageLineItems'
import { findEarliestTxLocalityIndex } from '../txLocalityAddressSplit'

export function resolvedLaborInvoiceLink(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const normalized = normalizeUrl(trimmed)
  return normalized || null
}

/** Google Maps search link for a job address (same URL the Stages map-pin used). */
export function googleMapsSearchUrl(addr: string | null | undefined): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((addr ?? '').trim())}`
}

export function buildClickToolingUrl(job: JobWithDetails): string {
  const params = new URLSearchParams()
  params.set('name', (job.customer_name ?? '').trim())
  params.set('email', (job.customer_email ?? '').trim())
  params.set('phone', (job.customer_phone ?? '').trim())
  params.set('location', (job.job_address ?? '').trim())
  return `https://clicktooling.com/?${params.toString()}`
}

const ADDRESS_STREET_SUFFIX_RE =
  /\b(Way|Circle|Dr\.?|Drive|Ln\.?|Lane|St\.?|Street|Rd\.?|Road|Ave\.?|Avenue|Blvd\.?|Boulevard|Ct\.?|Court|Pl\.?|Place|Ter\.?|Terrace|Trl\.?|Trail|Pkwy\.?|Parkway|Hwy\.?|Highway)\b/gi

export function formatAddressTwoLines(addr: string | null): { line1: string; line2?: string } | null {
  const a = (addr ?? '').trim()
  if (!a) return null
  const bestIdx = findEarliestTxLocalityIndex(a)
  if (bestIdx !== -1 && bestIdx > 0) {
    const line1 = a.slice(0, bestIdx).trim()
    const line2 = a.slice(bestIdx).trim()
    return { line1, line2: line2 || undefined }
  }
  const commaIdx = a.indexOf(',')
  if (commaIdx !== -1) {
    const line1 = a.slice(0, commaIdx).trim()
    const line2 = a.slice(commaIdx + 1).trim()
    return { line1, line2: line2 || undefined }
  }
  let suffixEndIdx = -1
  let m: RegExpExecArray | null
  ADDRESS_STREET_SUFFIX_RE.lastIndex = 0
  while ((m = ADDRESS_STREET_SUFFIX_RE.exec(a)) !== null) {
    if (m[0].toLowerCase() === 'st' || m[0].toLowerCase() === 'st.') {
      if (m.index === 0) continue
    }
    const end = m.index + m[0].length
    if (end > suffixEndIdx) suffixEndIdx = end
  }
  if (suffixEndIdx > 0) {
    const line1 = a.slice(0, suffixEndIdx).trim()
    const line2 = a.slice(suffixEndIdx).trim()
    if (line2) return { line1, line2 }
  }
  return { line1: a }
}
