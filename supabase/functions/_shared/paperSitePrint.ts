/**
 * What a paper prints of its site (punch list #439, piece 3, part 3e). A paper's row can name a site, and it keeps
 * the address as written beside the site's key (`site_address`). The address reaches a signer only when the office
 * ticked **Print the site's address on the paper**, which the row keeps as `site_prints_address`. Nothing else of a
 * site ever reaches a signer: not its key, not its development, not that the paper names one.
 *
 * One rule, read in three places, so they never disagree:
 *
 * - `get-contract-for-signer` hands `printedSiteAddress(row)` to the signer's page as `site_address`, an address or
 *   null. The key is in every answer, so a page can tell a function that knows the rule from one that does not.
 * - `accept-contract` takes a signature for a paper that prints an address only from a page that showed that address
 *   (`siteShownAtSigning`). A page that showed none is told the paper changed, and reads it again.
 * - The signed paper's PDF prints the same line above its words (`personPaperSignedCopy.ts`).
 *
 * Dependency-free: the app imports it straight from here, as it does `paperSigner.ts`.
 */

/** The longest address the paper's row keeps (`person_contract_documents_site_address_words`). */
export const SITE_PRINT_ADDRESS_MAX = 500

/** A paper's row as far as the print reads it. */
export interface SitePrintRow {
  site_address?: unknown
  site_prints_address?: unknown
}

function addressWord(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const word = value.replace(/\s+/g, ' ').trim().slice(0, SITE_PRINT_ADDRESS_MAX).trim()
  return word || null
}

/**
 * The address a paper prints, or null when it prints none: the box is off, or the row keeps no address. The box is
 * on only as `true` itself, so a row read without the column prints nothing.
 */
export function printedSiteAddress(row: SitePrintRow | null | undefined): string | null {
  if (!row || row.site_prints_address !== true) return null
  return addressWord(row.site_address)
}

/**
 * True when a signature may be taken: the paper prints no address, or the page that signs says it showed the very
 * address the paper prints. `shown` is what the page sends back, and anything that is not that address is a no.
 */
export function siteShownAtSigning(row: SitePrintRow | null | undefined, shown: unknown): boolean {
  const printed = printedSiteAddress(row)
  return printed === null || addressWord(shown) === printed
}

/**
 * True when a signer function's answer says whether its paper prints an address: the `site_address` key is there,
 * as an address or as null. An older function's answer has no such key.
 */
export function answersSitePrint(body: unknown): boolean {
  return !!body && typeof body === 'object' && !Array.isArray(body) && 'site_address' in body
}

export type SitePrintLang = 'en' | 'es'

/** The label beside the address, on the signer's page and on the signed paper. */
export const SITE_PRINT_LABEL: Record<SitePrintLang, string> = { en: 'Site address', es: 'Dirección de la obra' }

/** The line the signed paper prints above its words: `Site address: 118 Old Quarry Trl, Sampleton, TX`. */
export function sitePrintLine(address: string, lang: SitePrintLang = 'en'): string {
  return `${SITE_PRINT_LABEL[lang]}: ${address}`
}

/**
 * A signed paper's words as its PDF draws them. A paper that prints its site's address opens with that line, as the
 * signer's page showed it above the paper, in the language the paper was signed in (`clause_versions.lang`). Any
 * other paper's words come back as they were, and a paper with no words gets none.
 */
export function withSitePrintLine(words: string[], row: (SitePrintRow & { clause_versions?: unknown }) | null | undefined): string[] {
  const address = printedSiteAddress(row)
  if (!address || words.length === 0) return words
  const kept = row?.clause_versions && typeof row.clause_versions === 'object' ? (row.clause_versions as { lang?: unknown }) : null
  return [sitePrintLine(address, kept?.lang === 'es' ? 'es' : 'en'), ...words]
}
