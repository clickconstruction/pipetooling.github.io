/**
 * Bids and permits (punch list #307, PR 3's leftover): the names that are us on a plumbing permit.
 * A city lists one name on a permit. Until the office says which names are ours, our own
 * plumbing permit on a bid's address reads as another plumber's. The list is short: the company
 * as a city writes it, and a master plumber's own name when he files under it. The company name
 * on paper bills counts without being added, since that is the company's own word for itself.
 *
 * A name is compared by the feed's own key (`builderKeyOf`: the company on the line, else the
 * person, lower case, letters and digits, LLC and Inc dropped), the key `permits.builder_key`
 * holds. A typed name goes through the same reading, so a name typed as a city writes it always
 * meets itself. Exact on that key and nothing fuzzier: a wrong "ours" hides a lost job.
 * No React, no Supabase.
 */
import { builderKeyOf } from '../../../supabase/functions/_shared/permitLookup'

/**
 * The `app_settings` key: JSON `{ "names": string[] }` in `value_text`. The owner or a dev writes it on
 * Settings → Company (a key-scoped policy, migration 20261112003000); everyone signed in reads it. It is
 * held here and not in `appSettingsKeys.ts`, which the edge functions carry a copy of.
 */
export const OUR_NAMES_SETTINGS_KEY = 'permit_our_names_v1' as const

/** What `app_settings.permit_our_names_v1` holds beside the company name on paper bills. */
export type OurNames = {
  /** The names a person added, as typed, in the order added. */
  names: string[]
  /** The company name on paper bills (Settings → Jobs, bills and liens), null when none is set. */
  companyName: string | null
}

export const NO_OUR_NAMES: OurNames = { names: [], companyName: null }

/** The keys of every name that is us. Empty until the list is read, and then every screen reads as it did before. */
export type OurNameKeys = ReadonlySet<string>
export const NO_OUR_KEYS: OurNameKeys = new Set<string>()

/** A list this long is a mistake: the company and a few people file permits, not twenty names. */
export const OUR_NAMES_MAX = 20
export const OUR_NAME_MAX_LENGTH = 120

const tidy = (name: string): string => name.replace(/\s+/g, ' ').trim()

/** The stored JSON read back: `{ "names": [...] }`. Anything else is an empty list. */
export function parseOurNames(valueText: string | null | undefined): string[] {
  if (!valueText) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(valueText)
  } catch {
    return []
  }
  const list = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as { names?: unknown }).names : null
  if (!Array.isArray(list)) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of list) {
    if (typeof item !== 'string') continue
    const name = tidy(item)
    const key = builderKeyOf(name)
    if (name === '' || key == null || seen.has(key)) continue
    seen.add(key)
    out.push(name)
  }
  return out
}

/** The list as it is stored. */
export function storeOurNames(names: readonly string[]): string {
  return JSON.stringify({ names: names.map(tidy).filter((n) => n !== '') })
}

/** The key of every name that is us: the ones added, and the company name on paper bills. */
export function ourNameKeys(ours: OurNames): Set<string> {
  const keys = new Set<string>()
  for (const name of [...ours.names, ours.companyName]) {
    const key = builderKeyOf(name)
    if (key != null) keys.add(key)
  }
  return keys
}

/** Whether the name a city lists on a permit is one of ours. */
export function isOurName(contact: string | null | undefined, keys: OurNameKeys): boolean {
  if (keys.size === 0) return false
  const key = builderKeyOf(contact)
  return key != null && keys.has(key)
}

export type OurNameChange = { ok: true; names: string[] } | { ok: false; reason: string }

/** Add a typed name, or say why not. The reason is the sentence the card shows. */
export function addOurName(ours: OurNames, typed: string): OurNameChange {
  const name = tidy(typed)
  if (name === '') return { ok: false, reason: 'Type the name as the city lists it.' }
  if (name.length > OUR_NAME_MAX_LENGTH) return { ok: false, reason: `A name is at most ${OUR_NAME_MAX_LENGTH} characters.` }
  const key = builderKeyOf(name)
  if (key == null) return { ok: false, reason: 'That name has no letters or digits to match on.' }
  const held = ours.names.find((n) => builderKeyOf(n) === key)
  if (held) return { ok: false, reason: `${held} is on the list, and it reads the same as that name.` }
  if (builderKeyOf(ours.companyName) === key) return { ok: false, reason: `${ours.companyName} is the company name on paper bills, so it counts already.` }
  if (ours.names.length >= OUR_NAMES_MAX) return { ok: false, reason: `The list holds ${OUR_NAMES_MAX} names. Take one back first.` }
  return { ok: true, names: [...ours.names, name] }
}

/** The list with one name taken back, matched by its key so a respelling of it goes too. */
export function removeOurName(names: readonly string[], name: string): string[] {
  const key = builderKeyOf(name)
  return names.filter((n) => (key == null ? n !== name : builderKeyOf(n) !== key))
}

/** The card on Settings → Company: its anchor, its name and one line of what it sets. */
export const OUR_NAMES_CARD = {
  slug: 'our-permit-names',
  anchor: 'settings-company-our-permit-names',
  title: 'Our names on plumbing permits',
  line: 'the names a city lists that are us',
} as const
export const OUR_NAMES_TAB = 'settings-company'

/** The card's words. */
export const OUR_NAMES_INTRO =
  'A city lists one name on a plumbing permit. Add each name that is us, written as the city writes it. A bid then reads that permit as ours, not as another plumber’s. Capitals, punctuation and LLC or Inc make no difference.'
export const OUR_NAMES_ADD_LABEL = 'Add the name'

/** The line that says the company name on paper bills counts by itself, or that none is set. */
export function companyNameLine(companyName: string | null): string {
  const name = companyName ? tidy(companyName) : ''
  return name !== '' && builderKeyOf(name) != null
    ? `${name} counts already. It is the company name on paper bills.`
    : 'No company name is set for paper bills, so only the names added here count.'
}

/** The folded card's live line: "2 names and the company name", "the company name alone", "none yet". */
export function ourNamesValueLine(ours: OurNames): string {
  const company = builderKeyOf(ours.companyName) != null
  const n = ours.names.length
  if (n === 0) return company ? 'the company name on paper bills alone' : 'none yet'
  const names = `${n} name${n === 1 ? '' : 's'}`
  return company ? `${names} and the company name on paper bills` : names
}
