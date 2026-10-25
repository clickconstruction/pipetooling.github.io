/**
 * The phone's Customer summary sheet (v2.5831, `CustomerSummaryModal`): which properties it
 * draws, in what order, with what words beside each, and who gets its Edit door.
 *
 * Taunya, from her phone (2026-10-24): "I can't edit customers on my phone or see additional
 * notes on addresses like door codes." The door codes live in `customer_addresses.note`, one
 * per property, typed in Edit customer's Properties. The sheet read only `customers.address`
 * until now, and had no door to the editor.
 */
import type { UserRole } from '../../hooks/useAuth'
import { isAssistantLike, isSubcontractorLikeRole } from '../subcontractorLikeRole'

/** The `customer_addresses` columns the sheet reads. */
export type CustomerSummaryAddressRow = {
  id: string
  address: string | null
  note: string | null
  is_primary: boolean | null
  sequence_order: number | null
}

export type CustomerSummaryProperty = {
  id: string
  address: string
  /** The property's note, trimmed, or null when none was typed. */
  note: string | null
  isPrimary: boolean
  mapsHref: string
}

/** The id of the one row the sheet makes up when it has no `customer_addresses` to draw. */
export const CUSTOMER_ADDRESS_FALLBACK_ID = 'customer-address'

export function mapsHrefFor(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
}

function cleanNote(note: string | null | undefined): string | null {
  const t = (note ?? '').trim()
  return t ? t : null
}

function sameAddress(a: string, b: string): boolean {
  return a.replace(/\s+/g, ' ').trim().toLowerCase() === b.replace(/\s+/g, ' ').trim().toLowerCase()
}

/**
 * The properties to draw, primary first, then by `sequence_order` (a missing order sorts last),
 * ties in the order given. Blank addresses are dropped. With no rows at all — none typed, or
 * the viewer's role cannot read `customer_addresses` (a primary or a sub on Job Mode's
 * Customers tab) — the customer's own address stands in as the one property, with no note.
 * When rows exist but none carries the customer's address, that address leads the list the
 * same way, so the sheet never loses the address it showed before.
 */
export function customerSummaryProperties(
  customerAddress: string | null | undefined,
  rows: readonly CustomerSummaryAddressRow[] | null | undefined,
): CustomerSummaryProperty[] {
  const own = (customerAddress ?? '').trim()
  const kept = (rows ?? [])
    .map((r, idx) => ({ r, idx, address: (r.address ?? '').trim() }))
    .filter((x) => x.address)
  kept.sort((x, y) => {
    const p = Number(Boolean(y.r.is_primary)) - Number(Boolean(x.r.is_primary))
    if (p !== 0) return p
    const xo = x.r.sequence_order ?? Number.POSITIVE_INFINITY
    const yo = y.r.sequence_order ?? Number.POSITIVE_INFINITY
    if (xo !== yo) return xo < yo ? -1 : 1
    return x.idx - y.idx
  })
  const out: CustomerSummaryProperty[] = kept.map((x) => ({
    id: x.r.id,
    address: x.address,
    note: cleanNote(x.r.note),
    isPrimary: Boolean(x.r.is_primary),
    mapsHref: mapsHrefFor(x.address),
  }))
  if (own && !out.some((p) => sameAddress(p.address, own))) {
    out.unshift({ id: CUSTOMER_ADDRESS_FALLBACK_ID, address: own, note: null, isPrimary: true, mapsHref: mapsHrefFor(own) })
  }
  return out
}

/** The words beside a property: its note in full, or *No note* when none was typed. */
export function customerSummaryPropertyNoteWords(note: string | null): { kind: 'note' | 'none'; text: string } {
  const t = cleanNote(note)
  return t ? { kind: 'note', text: t } : { kind: 'none', text: 'No note' }
}

/**
 * Who gets **Edit customer** on the sheet: the roles whose RLS lets them update `customers`
 * (dev, master, assistant-like, and estimators for the everyday columns —
 * `docs/ACCESS_CONTROL.md` → Estimator Customers). Never a sub, a helper, a primary or a
 * superintendent, and never before the role is known.
 */
export function canEditCustomerFromSummary(role: UserRole | string | null | undefined): boolean {
  if (role == null) return false
  if (isSubcontractorLikeRole(role as UserRole)) return false
  return role === 'dev' || role === 'master_technician' || role === 'estimator' || isAssistantLike(role)
}
