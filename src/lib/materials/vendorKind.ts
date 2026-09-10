/**
 * What kind of vendor a `supply_houses` row is (to-dos/supply-house-directory,
 * PR 5). The roster is also the accounts-payable vendor ledger, so it holds
 * insurers, a rental yard, the sub-invoice bucket and a few payee-only
 * accounts beside the real counters. Only `supply_house` rows are quoted
 * from, listed for estimators, or offered by the RFQ pickers.
 *
 * `vendor_kind` is the only signal since v2.3244 (the legacy `is_insurer`
 * flag is dropped); a row with an unknown or missing kind reads as a supply house.
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

/** The kind of a row; an unknown or missing `vendor_kind` reads as a supply house. */
export function vendorKindOf(row: { vendor_kind?: string | null }): VendorKind {
  return isVendorKind(row.vendor_kind) ? row.vendor_kind : 'supply_house'
}

export function vendorKindLabel(kind: VendorKind): string {
  return VENDOR_KIND_LABELS[kind]
}

/** Only supply houses are quoted from and shown to estimators. */
export function isQuotableVendorKind(kind: VendorKind): boolean {
  return kind === 'supply_house'
}

