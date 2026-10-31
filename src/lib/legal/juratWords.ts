/**
 * The jurat's words (punch list #220, v2.6208): the notary's certificate under a sworn paper, in
 * one place, so the § 53.054 lien affidavit (`src/lib/jobsDocuments/lienFilingDocuments.ts`), the
 * demand letter's sworn block and the Legal desk's affidavits (`affidavitPaper.ts`) read one jurat.
 * No imports: both document kernels import this file, and neither may import the other.
 *
 * Tex. Gov't Code § 312.011(1): an affidavit is a statement in writing of a fact or facts signed by
 * the party making it, sworn to before an officer authorized to administer oaths, and officially
 * certified to by the officer under his seal of office. The certificate is the jurat, in the
 * Secretary of State's sample form (Sept 2019): State of Texas · County of ___ · Sworn to and
 * subscribed before me on the ___ day of ___, (year), by (name of signer) · (Personalized Seal) ·
 * Notary Public's Signature. The seal itself carries the notary's name, identifying number and
 * commission expiry (§ 406.013(a)), so the block needs the signature line and room for the seal;
 * a printed-name line and a *My commission expires* line are a courtesy the notary fills.
 */

/** The venue caption's first line. */
export const JURAT_STATE_LINE = 'STATE OF TEXAS'

/** The blank the notary fills by hand when the paper names no county. */
export const JURAT_COUNTY_BLANK = '___________'

/** The venue caption's second line: the county named, upper case, or the blank. */
export function juratCountyLine(county: string): string {
  const c = county.trim().toUpperCase()
  return `COUNTY OF ${c || JURAT_COUNTY_BLANK}`
}

/** The blank for a signer the paper does not yet name. */
export const JURAT_WHO_BLANK = '_______________'

/** The certificate's sentence, the day and the month left for the notary's hand. */
export function juratSentence(who: string): string {
  return `SWORN TO AND SUBSCRIBED BEFORE ME on this _____ day of _____________, ______, by ${who.trim() || JURAT_WHO_BLANK}.`
}

/** Under the notary's signature line. */
export const JURAT_NOTARY_TITLE = 'Notary Public, State of Texas'

/** Where the seal goes; the notary's own seal carries the name, the number and the expiry (§ 406.013(a)). */
export const JURAT_SEAL_WORDS = '(Personalized Seal)'

/** The two courtesy lines a notary fills under the title; the seal already carries both. */
export const JURAT_COURTESY_LINES: ReadonlyArray<string> = ['Printed name: ______________________________', 'My commission expires: ______________________']

/** The signature rule's length in the text renderer, so every paper's jurat draws the same rule. */
export const JURAT_SIGNATURE_RULE = '________________________________'
