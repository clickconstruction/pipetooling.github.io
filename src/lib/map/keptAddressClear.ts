/**
 * Clearing a kept address nothing is written under (punch list #443, row 9): the take-back of an address typed in
 * the **Job Address** box and left.
 *
 * Leaving the box starts the map's look-up, and `geocode-one` keeps the answer in `address_geocodes` under the
 * address as typed. The row stays when the form is closed with **Discard** and no job is made, so a made-up address
 * a walk typed stood in the map's cache for good. The table has let the map's roles delete since the baseline, and
 * nothing called it. This is the rule for the press that does. Pure: the reads and the delete are
 * `keptAddressClearIo.ts`, the block is `components/settings/KeptMapAddressesBlock.tsx`.
 *
 * - The block is drawn for a dev and for nobody else.
 * - A kept address carries no name, so it cannot be told as a test by a ZZ. The rule is the other half of the
 *   owner's line: an address a record depends on stays. An address is cleared only when **no record anywhere**
 *   holds its street line.
 * - *Anywhere* is every table column that holds a street address (`KEPT_ADDRESS_SOURCES`), not jobs and bids alone,
 *   and the office's own address in Settings. Many screens key into the cache with an address they read from one
 *   of those columns: the Map page's jobs, bids and estimates, the bid board's map, a job's map and materials tabs,
 *   trips and far sites, the legal map, a painted map's home, On my way. `keptAddressClear.test.ts` holds the list
 *   to the generated types, so a new address column fails the test until it is listed or left out by name.
 * - The match is loose on purpose. A screen may key the cache with the address and its city joined, so the test
 *   is the street line alone (the words before the first comma), its words in order with anything between. A loose
 *   match can only keep an address that could have gone. It never clears one that is in use.
 * - A street line too short to tell apart is never checked: the address stays.
 *
 * The cache is only a cache. Clearing a row costs the next screen that asks for the address one more look-up.
 *
 * A miss (punch list #443, row 16) is kept beside the points, in `address_geocode_misses`: an address no map
 * service could place, under the same key. It goes by itself when a point is saved for the address, and it stops
 * counting after 30 days, but nobody could delete one by hand until migration 20261126024719 let a dev. The block
 * lists a miss with the kept addresses, under the same rule: it is cleared only when no record holds its street line.
 */

/** Who is offered the block: a dev. Every other role sees nothing new. */
export function keptAddressClearDrawn(role: string | null | undefined): boolean {
  return role === 'dev'
}

/** One place a street address is written: a table, its column, and the words for one row and several. */
export interface KeptAddressSource {
  table: string
  column: string
  one: string
  many: string
}

/** Every table column that holds a street address. A record in any of them keeps an address in the map's cache. */
export const KEPT_ADDRESS_SOURCES: ReadonlyArray<KeptAddressSource> = [
  { table: 'jobs_ledger', column: 'job_address', one: '1 job', many: '{n} jobs' },
  { table: 'bids', column: 'address', one: '1 bid', many: '{n} bids' },
  { table: 'estimates', column: 'for_address', one: '1 estimate', many: '{n} estimates' },
  { table: 'customers', column: 'address', one: '1 customer', many: '{n} customers' },
  { table: 'customer_addresses', column: 'address', one: '1 customer’s property', many: '{n} customers’ properties' },
  { table: 'customer_addresses', column: 'owner_mailing_address', one: '1 owner’s mailing address', many: '{n} owners’ mailing addresses' },
  { table: 'prospects', column: 'address', one: '1 prospect', many: '{n} prospects' },
  { table: 'prospect_jobs', column: 'address', one: '1 prospect’s job', many: '{n} prospects’ jobs' },
  { table: 'projects', column: 'address', one: '1 project', many: '{n} projects' },
  { table: 'gc_companies', column: 'address', one: '1 GC company', many: '{n} GC companies' },
  { table: 'bids_gc_builders', column: 'address', one: '1 builder', many: '{n} builders' },
  { table: 'gc_draws', column: 'address', one: '1 draw', many: '{n} draws' },
  { table: 'housing_units', column: 'address', one: '1 housing unit', many: '{n} housing units' },
  { table: 'inspections', column: 'address', one: '1 inspection', many: '{n} inspections' },
  { table: 'permits', column: 'address', one: '1 permit', many: '{n} permits' },
  { table: 'people_labor_jobs', column: 'address', one: '1 labor job', many: '{n} labor jobs' },
  { table: 'supply_houses', column: 'address', one: '1 supply house', many: '{n} supply houses' },
  { table: 'lien_owner_record_requests', column: 'property_address', one: '1 owner record request', many: '{n} owner record requests' },
  { table: 'job_property_owners', column: 'mailing_address', one: '1 property owner', many: '{n} property owners' },
  { table: 'legal_matter_people', column: 'mailing_address', one: '1 person on a legal matter', many: '{n} people on legal matters' },
  { table: 'job_demand_letters', column: 'recipient_address', one: '1 demand letter', many: '{n} demand letters' },
  { table: 'mail_pieces', column: 'address1', one: '1 piece of mail', many: '{n} pieces of mail' },
  // The office's own address lives in a setting's text, and the clocked-in map keys the cache with it.
  { table: 'app_settings', column: 'value_text', one: '1 setting', many: '{n} settings' },
]

/**
 * Columns with *address* in their name that hold no street address the map could key on, by `table.column`: an email
 * address, a second address line, a made key. Named here so the test that reads the generated types knows they were
 * looked at and left out, not missed.
 */
export const KEPT_ADDRESS_NOT_SOURCES: ReadonlyArray<string> = [
  'company_bank_transfer_details.beneficiary_address',
  'company_bank_transfer_details.check_mailing_address',
  'email_box_threads.from_address',
  'email_box_watch.address',
  'email_set_aside.from_address',
  'mail_pieces.address2',
  'permits.address_key',
]

/** The fewest characters a street line needs before it can be told apart from any other. */
export const KEPT_ADDRESS_MIN_LINE = 6

/** The street line of a kept address: the words before its first comma, one space between words. */
export function keptAddressStreetLine(key: string): string {
  return (key.split(',')[0] ?? '').replace(/\s+/g, ' ').trim()
}

/**
 * The pattern that finds a street line inside any address, whatever its capitals and spacing: each word in order
 * with anything between, anything before and anything after. A `%`, a `_` or a backslash typed in an address is
 * matched as itself. Null for a line too short to check, or one with no letter or no digit.
 */
export function keptAddressLikePattern(key: string): string | null {
  const line = keptAddressStreetLine(key)
  if (line.length < KEPT_ADDRESS_MIN_LINE || !/[a-z]/i.test(line) || !/\d/.test(line)) return null
  const words = line.split(' ').map((w) => w.replace(/[\\%_]/g, (c) => `\\${c}`))
  return `%${words.join('%')}%`
}

/**
 * Why a street line cannot be checked, in the words that hold (punch list #443): one sentence used to say *too short*
 * for all three reasons, over a line of 39 characters that had no number in it. The rule is `keptAddressLikePattern`'s
 * and does not change here: a line with no number, or no name, matches loosely, and a loose match must never clear an
 * address in use.
 */
export function keptAddressUncheckedWhy(key: string): string {
  const line = keptAddressStreetLine(key)
  if (line.length < KEPT_ADDRESS_MIN_LINE) return 'This address is too short to tell apart from the others. It stays.'
  if (!/\d/.test(line)) return 'This address has no street number, so it cannot be told apart from the others. It stays.'
  if (!/[a-z]/i.test(line)) return 'This address has no street name, so it cannot be told apart from the others. It stays.'
  return ''
}

/** How many records hold the street line, for each source that has any. */
export type KeptAddressHits = ReadonlyArray<{ source: KeptAddressSource; count: number }>

/**
 * Why a kept address stays; '' when nothing is written under it. `hits` is null when the records could not be read:
 * an address is never cleared on no answer.
 */
export function keptAddressClearProblem(key: string, hits: KeptAddressHits | null | undefined): string {
  if (!keptAddressLikePattern(key)) return keptAddressUncheckedWhy(key)
  if (!hits) return 'The records could not be read, so nobody knows what is written under this address. Nothing was cleared.'
  const found = hits.filter((h) => h.count > 0)
  if (found.length === 0) return ''
  const words = found.map((h) => (h.count === 1 ? h.source.one : h.source.many.replace('{n}', String(h.count))))
  const list = words.length <= 1 ? words.join('') : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`
  return `Its street line is written on ${list}. It stays.`
}

/** The fewest characters the search box needs before it reads the cache. */
export const KEPT_ADDRESS_MIN_SEARCH = 3

/** The most kept addresses one search lists. */
export const KEPT_ADDRESS_SEARCH_LIMIT = 20

/** Why the search cannot run; '' when it can. */
export function keptAddressSearchProblem(typed: string): string {
  return typed.trim().length < KEPT_ADDRESS_MIN_SEARCH ? `Type ${KEPT_ADDRESS_MIN_SEARCH} letters or more of the address.` : ''
}

/** The pattern the search reads the cache with: the typed words in order, anything between. */
export function keptAddressSearchPattern(typed: string): string {
  const words = typed
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((w) => w.replace(/[\\%_]/g, (c) => `\\${c}`))
  return `%${words.join('%')}%`
}

/** What the cache keeps under a key: a point the map placed, or a miss, an address no service could place (#443, row 16). */
export type KeptAddressKind = 'kept' | 'miss'

/** The confirm window's words. The button names the act. A miss (row 16) is said as one. */
export function keptAddressClearConfirm(key: string, kind: KeptAddressKind = 'kept'): { title: string; message: string; confirmLabel: string } {
  if (kind === 'miss') {
    return {
      title: 'Clear this kept miss?',
      message: `${key}. No map service could place it, and no record holds its street line. The map asks the services again the next time anyone types it.`,
      confirmLabel: 'Clear the miss',
    }
  }
  return {
    title: 'Clear this kept address?',
    message: `${key}. No record holds its street line. The map looks it up again the next time anyone types it.`,
    confirmLabel: 'Clear the address',
  }
}

/** What the toast says once it is gone. */
export const KEPT_ADDRESS_CLEARED = 'The kept address was cleared.'
export const KEPT_MISS_CLEARED = 'The kept miss was cleared.'

/** The toast for what was cleared. */
export function keptAddressClearedWords(kind: KeptAddressKind): string {
  return kind === 'miss' ? KEPT_MISS_CLEARED : KEPT_ADDRESS_CLEARED
}
