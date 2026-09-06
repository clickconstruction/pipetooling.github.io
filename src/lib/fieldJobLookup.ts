import type { UserRole } from '../hooks/useAuth'
import { isAssistantLike, isSubcontractorLikeRole } from './subcontractorLikeRole'

/**
 * Field job lookup (journey map Tier 5 X1 / J28-F2, C18).
 *
 * Helpers and subcontractors had no way to answer "what's job 878's address?" except
 * opening Clock In, searching, reading the picker row and cancelling — a punch button
 * they must not press. The header search already reaches `search_jobs_ledger`
 * (SECURITY DEFINER, the same RPC the Clock In picker uses), so the door is the only
 * missing piece: field roles get the search icon, jobs only, and a read-only card
 * instead of the office's Job Detail window. No money evidence is ever fetched in
 * this mode (`fetchJobSearchEvidence(…, 'money')` stays office-only).
 */

/** Office roles that get the full search (jobs, bids, estimates, customers + Job Detail). */
export function officeHeaderSearchEligible(role: UserRole | null | undefined, farmModeActive: boolean): boolean {
  if (farmModeActive) return false
  return role === 'dev' || role === 'master_technician' || isAssistantLike(role)
}

/** Field roles that get the read-only job lookup: helpers + subcontractor (not superintendent / primary / estimator). */
export function fieldJobLookupEligible(role: UserRole | null | undefined, farmModeActive: boolean): boolean {
  if (farmModeActive) return false
  return isSubcontractorLikeRole(role)
}

/** Union used by Layout to mount the header search entry points at all. */
export function headerSearchEligibleForRole(role: UserRole | null | undefined, farmModeActive: boolean): boolean {
  return officeHeaderSearchEligible(role, farmModeActive) || fieldJobLookupEligible(role, farmModeActive)
}

/** Google Maps directions link for an address; null when there is nothing to route to. */
export function directionsUrlForAddress(address: string | null | undefined): string | null {
  const a = (address ?? '').trim()
  if (!a) return null
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(a)}`
}

/** `tel:` href for the office phone constant ("(512) 360-0599" → "tel:+15123600599"); null when blank. */
export function officeTelHref(phone: string | null | undefined): string | null {
  const digits = (phone ?? '').replace(/\D+/g, '')
  if (!digits) return null
  const e164 = digits.length === 10 ? `+1${digits}` : digits.length === 11 && digits.startsWith('1') ? `+${digits}` : digits
  return `tel:${e164}`
}

export type FieldJobLookupCard = {
  /** "J878" / "C12" — the ledger number as the field sees it, or "—". */
  number: string
  name: string
  address: string | null
  serviceType: string | null
  directionsUrl: string | null
}

/** Shape the read-only card from a `search_jobs_ledger` row + the display number the caller resolved. */
export function buildFieldJobLookupCard(
  row: { job_name?: string | null; job_address?: string | null; service_type_name?: string | null },
  displayNumber: string | null | undefined,
): FieldJobLookupCard {
  const address = (row.job_address ?? '').trim() || null
  return {
    number: (displayNumber ?? '').trim() || '—',
    name: (row.job_name ?? '').trim() || 'Job',
    address,
    serviceType: (row.service_type_name ?? '').trim() || null,
    directionsUrl: directionsUrlForAddress(address),
  }
}
