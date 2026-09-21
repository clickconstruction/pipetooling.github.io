/**
 * Property kind — residential or not — as the lien screens ask for it (v2.3667).
 *
 * The kind lives on the customer's property (`customer_addresses.property_kind`),
 * not on the job: § 53.056 gives a residential property's notice a month less,
 * so every job at the address shares the answer. These are the words and the
 * grouping the one-click switch needs; the write is `propertyKindWrite`.
 */
export type PropertyKind = '' | 'residential' | 'non_residential'

export function normalizePropertyKind(raw: string | null | undefined): PropertyKind {
  return raw === 'residential' || raw === 'non_residential' ? raw : ''
}

/** The lien screens say "commercial"; the customer's property sheet says "Non-residential". */
export function propertyKindWords(kind: PropertyKind, voice: 'lien' | 'sheet' = 'lien'): string {
  if (kind === 'residential') return voice === 'lien' ? 'residential' : 'Residential'
  if (kind === 'non_residential') return voice === 'lien' ? 'commercial' : 'Non-residential'
  return voice === 'lien' ? 'kind unknown' : 'kind not set'
}

export const PROPERTY_KIND_OPTIONS: ReadonlyArray<{ kind: Exclude<PropertyKind, ''>; lien: string; sheet: string }> = [
  { kind: 'residential', lien: 'Residential', sheet: 'Residential' },
  { kind: 'non_residential', lien: 'Commercial', sheet: 'Non-residential' },
]

/** What a pick writes: a non-residential property cannot be a homestead. */
export function propertyKindPatch(kind: PropertyKind): { property_kind: string; homestead?: false } {
  return kind === 'residential' ? { property_kind: kind } : { property_kind: kind, homestead: false }
}

/**
 * The other jobs in `jobIds` that sit at the same saved property as `jobId` —
 * they change with it, and the row says so. A job with no linked property shares nothing.
 */
export function jobsSharingProperty(jobId: string, jobIds: ReadonlyArray<string>, addressIdOf: (jobId: string) => string | null | undefined): string[] {
  const mine = addressIdOf(jobId)
  if (!mine) return []
  return jobIds.filter((id) => id !== jobId && addressIdOf(id) === mine)
}

/** "same property as 273" / "same property as 273 and 881". */
export function sharedPropertyWords(labels: ReadonlyArray<string>): string {
  if (labels.length === 0) return ''
  const list = labels.length === 1 ? labels[0]! : `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`
  return `same property as ${list}`
}
