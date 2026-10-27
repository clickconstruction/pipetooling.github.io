/** Pay config is keyed by `person_name`; this is the one normalization every lookup uses (v2.5881: in its own file, so the overhead scan takes it on the edge without the bid board). */
export function payConfigLookupKey(personName: string): string {
  return personName.trim().toLowerCase()
}
