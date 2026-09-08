/**
 * What kind of vendor a `supply_houses` row is (to-dos/supply-house-directory,
 * PR 5). The roster is also the accounts-payable vendor ledger, so it holds
 * insurers, a rental yard, the sub-invoice bucket and a few payee-only
 * accounts beside the real counters. Only `supply_house` rows are quoted
 * from, listed for estimators, or offered by the RFQ pickers.
 *
 * Until the `vendor_kind` column is pushed the row carries only the legacy
 * `is_insurer` flag; `vendorKindOf` reads whichever is present.
 */

export const VENDOR_KINDS = ['supply_house', 'insurer', 'rental_yard', 'sub_ledger', 'other'] as const

export type VendorKind = (typeof VENDOR_KINDS)[number]

export const VENDOR_KIND_LABELS: Record<VendorKind, string> = {
  supply_house: 'Supply house',
  insurer: 'Insurer',
  rental_yard: 'Rental yard',
  sub_ledger: 'Sub ledger',
  other: 'Other',
}

/** One-line meaning for the form's Kind chips. */
export const VENDOR_KIND_HINTS: Record<VendorKind, string> = {
  supply_house: 'A counter we buy parts from and ask for quotes. Listed for estimators.',
  insurer: 'Premiums and claims. Ledger only.',
  rental_yard: 'Equipment rental. Ledger only.',
  sub_ledger: 'The bucket sub invoices post to. Ledger only.',
  other: 'Fuel, online orders, price sources — anything else the office pays. Ledger only.',
}

export function isVendorKind(value: unknown): value is VendorKind {
  return typeof value === 'string' && (VENDOR_KINDS as readonly string[]).includes(value)
}

/** The kind of a row, reading `vendor_kind` when present and the legacy flag otherwise. */
export function vendorKindOf(row: { vendor_kind?: string | null; is_insurer?: boolean | null }): VendorKind {
  if (isVendorKind(row.vendor_kind)) return row.vendor_kind
  return row.is_insurer ? 'insurer' : 'supply_house'
}

export function vendorKindLabel(kind: VendorKind): string {
  return VENDOR_KIND_LABELS[kind]
}

/** Only supply houses are quoted from and shown to estimators. */
export function isQuotableVendorKind(kind: VendorKind): boolean {
  return kind === 'supply_house'
}

/** The legacy flag, derived — the DB trigger keeps the column in step; the client writes the same value. */
export function isInsurerFor(kind: VendorKind): boolean {
  return kind !== 'supply_house'
}
