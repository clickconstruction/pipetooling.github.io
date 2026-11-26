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
import { val } from '../valuesInPlace'
import { onFileCountWords, type AddressOnFile } from './addressesOnFile'
import { samePlaceKeys, type PlaceAnswer } from './lookAlikes'

/** The longest key and the longest address as written the paper's row takes. */
export const SITE_KEY_MAX = 300
export const SITE_ADDRESS_MAX = 500

/** A site as the send holds it. `address` is the spelling on file, for the row's label and for a print. */
export type PaperSite = { kind: 'address'; key: string; address: string } | { kind: 'development'; developmentId: string; name: string }

/** The two columns of a paper's row that say which site it is for. */
export type PaperSiteRow = { site_development_id?: string | null; site_address_key?: string | null }

/** The four columns as a new row writes them. The print starts off: the box that turns it on ships with the signer's page. */
export type PaperSiteColumns = { site_development_id: string | null; site_address_key: string | null; site_address: string | null; site_prints_address: false }

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

/** What a new row writes for a site, and for none. */
export function paperSiteColumns(site: PaperSite | null): PaperSiteColumns {
  if (!site) return { site_development_id: null, site_address_key: null, site_address: null, site_prints_address: false }
  if (site.kind === 'development') return { site_development_id: site.developmentId, site_address_key: null, site_address: null, site_prints_address: false }
  return { site_development_id: null, site_address_key: site.key, site_address: site.address, site_prints_address: false }
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
} as const

/** The line once a site is named: `For the site at 118 Old Quarry Trl, Sampleton, TX.` */
export function paperSiteSentence(site: PaperSite): string {
  return site.kind === 'address' ? `For the site at ${val('address', site.address)}.` : `For the site ${val('development', site.name)}.`
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
