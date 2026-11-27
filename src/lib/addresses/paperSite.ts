/**
 * The site a paper names (punch list #439, piece 3). A paper can be for one place: an address the company has on
 * file, under its cleaned key, or a development, which carries all its jobs. The paper's row keeps it in four
 * columns of `person_contract_documents` (`20261126070436_paper_names_a_site.sql`): a development or an address
 * key, never both, with the address as written beside a key.
 *
 * One rule says two papers are for the same site: the same development, or address keys the answers kept in
 * **Addresses that look alike** make one place (`samePlaceKeys`). A paper that names no site is for no place, and
 * is the same as another only when that one names none either. So one company can hold the same paper once for
 * each site, and once more for no site.
 *
 * Pure: no React, no supabase.
 */
import { normalizeAddressKey } from '../developments/notInIt'
import { val } from '../valuesInPlace'
import { onFileCountWords, type AddressOnFile } from './addressesOnFile'
import { samePlaceKeys, type PlaceAnswer } from './lookAlikes'
import { SITE_PRINT_LABEL } from '../../../supabase/functions/_shared/paperSitePrint'

/** The longest key and the longest address as written the paper's row takes. */
export const SITE_KEY_MAX = 300
export const SITE_ADDRESS_MAX = 500

/** A site as the send holds it. `address` is the spelling on file, for the row's label and for a print. */
export type PaperSite = { kind: 'address'; key: string; address: string } | { kind: 'development'; developmentId: string; name: string }

/** The two columns of a paper's row that say which site it is for. */
export type PaperSiteRow = { site_development_id?: string | null; site_address_key?: string | null }

/** The four columns as a new row writes them. The print is off unless the office ticked its box, and only an address prints. */
export type PaperSiteColumns = { site_development_id: string | null; site_address_key: string | null; site_address: string | null; site_prints_address: boolean }

const oneSpace = (s: string): string => s.trim().replace(/\s+/g, ' ')

/**
 * The site an address on file is, or null when the row could not keep it: a key over the row's length. The address
 * is cut to what the row takes, since it is a label and the key is what matches.
 */
export function paperSiteOfEntry(entry: Pick<AddressOnFile, 'key' | 'address'>): PaperSite | null {
  const key = oneSpace(entry.key)
  const address = oneSpace(entry.address).slice(0, SITE_ADDRESS_MAX).trim()
  if (!key || key.length > SITE_KEY_MAX || !address) return null
  return { kind: 'address', key, address }
}

/**
 * What a new row writes for a site, and for none. `printsAddress` is the box **Print the site's address on the
 * paper**: it is kept only beside an address, since the row refuses a print with no address to print.
 */
export function paperSiteColumns(site: PaperSite | null, printsAddress = false): PaperSiteColumns {
  if (!site) return { site_development_id: null, site_address_key: null, site_address: null, site_prints_address: false }
  if (site.kind === 'development') return { site_development_id: site.developmentId, site_address_key: null, site_address: null, site_prints_address: false }
  return { site_development_id: null, site_address_key: site.key, site_address: site.address, site_prints_address: printsAddress === true }
}

/** True when a paper's row names no site. */
export function rowNamesNoSite(row: PaperSiteRow): boolean {
  return !row.site_development_id && !row.site_address_key
}

/**
 * True when a paper's row is for `site`. No site matches only a row that names none. An address matches a row whose
 * key is the same place by the answers kept. A development matches a row that names it.
 */
export function rowIsForSite(row: PaperSiteRow, site: PaperSite | null, answers: ReadonlyArray<PlaceAnswer> = []): boolean {
  if (!site) return rowNamesNoSite(row)
  if (site.kind === 'development') return row.site_development_id === site.developmentId
  const key = row.site_address_key
  return !!key && !row.site_development_id && samePlaceKeys(site.key, answers).has(key)
}

/** The rows of a list that are for `site`. */
export function rowsForSite<T extends PaperSiteRow>(rows: ReadonlyArray<T>, site: PaperSite | null, answers: ReadonlyArray<PlaceAnswer> = []): T[] {
  return rows.filter((r) => rowIsForSite(r, site, answers))
}

/** A site in a few words, for a line that names it: the address on file, or the development's name. */
export function paperSiteLabel(site: PaperSite): string {
  return site.kind === 'address' ? site.address : site.name
}

/** The cleaned keys that are one place with an address, by the answers kept. Empty for an address with no key. */
export function siteKeysOfAddress(address: string | null | undefined, answers: ReadonlyArray<PlaceAnswer> = []): Set<string> {
  const key = normalizeAddressKey(address ?? '')
  return key ? samePlaceKeys(key, answers) : new Set()
}

/** The words a paper's line adds when its signer reads the site's address: the box's own words, in the past. */
export const SITE_PRINTED_WORDS = 'printed on the paper'

/**
 * What a paper's line says of its site: `for the site at 118 Old Quarry Trl, Sampleton, TX`, or nothing. When the
 * office ticked **Print the site's address on the paper** the line says so after the address: `, printed on the
 * paper`. Only `true` itself says it, so a row read without the column says nothing about a print.
 */
export function paperSiteNote(row: { site_address?: string | null; site_prints_address?: boolean | null }): string {
  const address = oneSpace(row.site_address ?? '')
  if (!address) return ''
  return `for the site at ${val('address', address)}${row.site_prints_address === true ? `, ${SITE_PRINTED_WORDS}` : ''}`
}

/** The words of the site's line in the email window, and of the window that finds a site. */
export const PAPER_SITE_WORDS = {
  none: 'This paper names no site.',
  name: 'Name a site…',
  change: 'Change the site…',
  off: 'Take the site off',
  title: 'Which site is it for?',
  lead: 'Pick the address the paper is for. Every job and bid at that place is the site.',
  find: 'Find an address on file',
  notForASite: 'It is not for a site',
  notForASiteHint: 'The paper names no place.',
  typeMore: 'Type three letters or more of the address.',
  onFileOnly: 'A site is an address a job or a bid already has.',
  /** In place of the presses once the paper's row is written: the site and the box are the row's from then on. */
  kept: 'Kept with the paper when Send email was pressed.',
} as const

/** The line once a site is named: `For the site at 118 Old Quarry Trl, Sampleton, TX.` */
export function paperSiteSentence(site: PaperSite): string {
  return site.kind === 'address' ? `For the site at ${val('address', site.address)}.` : `For the site ${val('development', site.name)}.`
}

/**
 * Whether the signer's page can show an address yet (part 3e). The page reads through `get-contract-for-signer`, and
 * the box is live only once that function's answer says whether its paper prints one. `checking` is the look under
 * way, `no` an answer from a function that does not know the rule, `unread` a look that failed.
 */
export type SitePrintReady = 'checking' | 'yes' | 'no' | 'unread'

/** The box's name. It says what the tick does to the paper. */
export const SITE_PRINT_BOX_LABEL = 'Print the site’s address on the paper'

/** The words under the box for each state it can be in. Each says exactly what the signer reads. */
export const SITE_PRINT_HINTS = {
  off: 'The signer reads nothing about the site.',
  checking: 'Checking the signer’s page…',
  no: 'The signer’s page cannot show an address yet. This stays off until it can.',
  unread: 'The signer’s page did not answer, so this stays off. Close this window and try again.',
} as const

/** The box as the email window draws it: ticked or not, dead or live, and the words under it. */
export type SitePrintBox = { label: string; checked: boolean; dead: boolean; hint: string }

/**
 * The box **Print the site's address on the paper** for a paper's site, or null when there is no box: the paper names
 * no site, or its site is a development, which has no address. The box is dead until the signer's page can show an
 * address, and a dead box is never ticked. Ticked, its words say the line the signer reads, with the address itself.
 */
export function sitePrintBox(site: PaperSite | null, on: boolean, ready: SitePrintReady): SitePrintBox | null {
  if (!site || site.kind !== 'address') return null
  if (ready !== 'yes') return { label: SITE_PRINT_BOX_LABEL, checked: false, dead: true, hint: SITE_PRINT_HINTS[ready] }
  return { label: SITE_PRINT_BOX_LABEL, checked: on, dead: false, hint: on ? `Above the paper the signer reads ${SITE_PRINT_LABEL.en}: ${val('address', site.address)}.` : SITE_PRINT_HINTS.off }
}

/** True when a send writes the print as on: a live box, ticked, on a site that is an address. */
export function sitePrintsAtSend(site: PaperSite | null, on: boolean, ready: SitePrintReady): boolean {
  return sitePrintBox(site, on, ready)?.checked === true
}

/** What is at an address on file, for its row in the window: `25 jobs · Old Quarry Ranch`. */
export function paperSiteRowNote(entry: Pick<AddressOnFile, 'jobs' | 'bids' | 'developmentName'>): string {
  return [onFileCountWords(entry), entry.developmentName ?? ''].filter(Boolean).join(' · ')
}

/** Why a company is not sent a paper again for a site it has signed for: `Tallgrass Supply Co. signed Vendor NDA for this site on Nov 12. One signature covers a site.` */
export function signedForSiteWords(partyName: string, documentName: string, day: string): string {
  const who = partyName.trim() || 'They'
  return `${who} signed ${documentName} for this site${day ? ` on ${day}` : ''}. One signature covers a site.`
}
