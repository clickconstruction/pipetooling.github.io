import { normalizePropertyKind, type PropertyKind } from './propertyKind'

/**
 * The property-kind badge at the end of a Pipeline row's address (v2.4160):
 * an orange C for a commercial property, a blue R for a residential one, a red ?
 * when the property's kind has not been set. The kind is the property's
 * (`customer_addresses.property_kind`, the fact the lien clock reads). A job
 * with no linked property but a customer gets the ? as well (v2.4212): the
 * pick saves its address as a property on the customer — or reuses the one it
 * matches — and links the job, so there IS somewhere to keep the answer. No
 * customer at all: nothing to hang a property on, no badge.
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
  /** The job has no linked property yet: the pick creates or reuses one on the customer and links the job (v2.4212). */
  unlinked: boolean
}

export const PROPERTY_KIND_BADGE_FILLS = { commercial: '#ea580c', residential: '#2563eb', unknown: '#dc2626' } as const

export function propertyKindBadge(input: { customerAddressId: string | null | undefined; kind: string | null | undefined; customerId?: string | null | undefined }, where = 'this property'): PropertyKindBadge | null {
  if (!input.customerAddressId) {
    if (!input.customerId) return null
    return {
      kind: '',
      letter: '?',
      fill: PROPERTY_KIND_BADGE_FILLS.unknown,
      title: `Residential or commercial? Not set yet — click to say; the address is saved as a property on the customer`,
      label: `Property kind not set for ${where} — pick residential or commercial (saves the address as a property on the customer)`,
      unlinked: true,
    }
  }
  const kind = normalizePropertyKind(input.kind)
  if (kind === 'non_residential') {
    return { kind, letter: 'C', fill: PROPERTY_KIND_BADGE_FILLS.commercial, title: `Commercial property — click to change`, label: `Commercial property at ${where} — change the kind`, unlinked: false }
  }
  if (kind === 'residential') {
    return { kind, letter: 'R', fill: PROPERTY_KIND_BADGE_FILLS.residential, title: `Residential property — click to change`, label: `Residential property at ${where} — change the kind`, unlinked: false }
  }
  return { kind, letter: '?', fill: PROPERTY_KIND_BADGE_FILLS.unknown, title: `Residential or commercial? Not set yet — click to say`, label: `Property kind not set for ${where} — pick residential or commercial`, unlinked: false }
}

/** The picker's question: "What kind of property is 8507 Culebra Road?" — the street line only (before the first comma or line break); the job when the address is blank. */
export function propertyKindQuestion(address: string | null | undefined, jobLabel: string): string {
  const a = (address ?? '').trim().split(/[\n,]/)[0]?.trim() ?? ''
  return `What kind of property is ${a || jobLabel}?`
}
