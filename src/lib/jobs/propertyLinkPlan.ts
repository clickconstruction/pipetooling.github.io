import { emptyPropertyDraft, payloadFromDraft, type PropertyDraftPayload } from '../customers/propertyDraft'
import { propertyKindPatch, type PropertyKind } from './propertyKind'
import { normalizeAddressForMatch, type CustomerAddressRow } from './lienProperty'

/**
 * What a property-kind pick on an UNLINKED job does to the customer's
 * properties (v2.4212). The kind lives on a saved property, so a job whose
 * address was typed on the job first needs one: reuse the customer's property
 * the address already matches — the whole address, else the street line, the
 * text before the first line break or comma (Edit Job's Property record row
 * suggests by the comma alone, which a "street\ncity, TX" job address never
 * has on its first line) — else save the job's address as a new property
 * with the kind on it. Pure — the writer runs the plan.
 */
export type PropertyLinkPlan =
  | { action: 'link'; customerAddressId: string; patch: ReturnType<typeof propertyKindPatch> }
  | { action: 'create'; row: PropertyDraftPayload & { customer_id: string; sequence_order: number } }

export function planPropertyLink(
  input: { customerId: string; jobAddress: string; kind: Exclude<PropertyKind, ''> },
  existing: ReadonlyArray<CustomerAddressRow>,
  now: Date = new Date(),
): PropertyLinkPlan {
  const mine = existing.filter((r) => r.customer_id === input.customerId)
  const match = matchProperty(input.jobAddress, mine)
  if (match) return { action: 'link', customerAddressId: match.id, patch: propertyKindPatch(input.kind) }
  const draft = { ...emptyPropertyDraft(input.jobAddress.trim()), property_kind: input.kind }
  // Never is_primary: the primary row mirrors customers.address by trigger, and a job site is not the customer's address.
  return { action: 'create', row: { ...payloadFromDraft(draft, now), customer_id: input.customerId, sequence_order: mine.length } }
}

/** The street line: everything before the first line break or comma, normalized. */
function streetKey(address: string): string {
  return normalizeAddressForMatch(address.split(/[\n,]/)[0] ?? '')
}

function matchProperty(jobAddress: string, rows: ReadonlyArray<CustomerAddressRow>): CustomerAddressRow | null {
  const whole = normalizeAddressForMatch(jobAddress)
  if (!whole) return null
  const exact = rows.find((r) => normalizeAddressForMatch(r.address) === whole)
  if (exact) return exact
  const street = streetKey(jobAddress)
  if (!street) return null
  return rows.find((r) => streetKey(r.address) === street) ?? null
}
