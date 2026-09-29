import { normalizePropertyKind, type PropertyKind } from './propertyKind'

/**
 * The property-kind badge at the end of a Pipeline row's address (v2.4160):
 * an orange C for a commercial property, a blue R for a residential one, a red ?
 * when the property's kind has not been set. The kind is the property's
 * (`customer_addresses.property_kind`, the fact the lien clock reads), so a job
 * with no linked property has nothing to show or to set — no badge.
 */
export type PropertyKindBadge = {
  kind: PropertyKind
  letter: 'C' | 'R' | '?'
  /** Literal saturated fills — a white letter sits on each in both themes. */
  fill: string
  /** The hover text; the click's meaning is in it. */
  title: string
  /** The screen-reader name of the control. */
  label: string
}

export const PROPERTY_KIND_BADGE_FILLS = { commercial: '#ea580c', residential: '#2563eb', unknown: '#dc2626' } as const

export function propertyKindBadge(input: { customerAddressId: string | null | undefined; kind: string | null | undefined }, where = 'this property'): PropertyKindBadge | null {
  if (!input.customerAddressId) return null
  const kind = normalizePropertyKind(input.kind)
  if (kind === 'non_residential') {
    return { kind, letter: 'C', fill: PROPERTY_KIND_BADGE_FILLS.commercial, title: `Commercial property — click to change`, label: `Commercial property at ${where} — change the kind` }
  }
  if (kind === 'residential') {
    return { kind, letter: 'R', fill: PROPERTY_KIND_BADGE_FILLS.residential, title: `Residential property — click to change`, label: `Residential property at ${where} — change the kind` }
  }
  return { kind, letter: '?', fill: PROPERTY_KIND_BADGE_FILLS.unknown, title: `Residential or commercial? Not set yet — click to say`, label: `Property kind not set for ${where} — pick residential or commercial` }
}

/** The picker's question: "What kind of property is 8507 Culebra Road?" — the street line only (before the first comma or line break); the job when the address is blank. */
export function propertyKindQuestion(address: string | null | undefined, jobLabel: string): string {
  const a = (address ?? '').trim().split(/[\n,]/)[0]?.trim() ?? ''
  return `What kind of property is ${a || jobLabel}?`
}
