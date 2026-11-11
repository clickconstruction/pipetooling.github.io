import type { PhysicalInvoiceIssuer } from '../physicalInvoiceIssuer'

/**
 * The county a lien paper is signed in, for one print (punch list #314). Pure.
 *
 * Settings hold the county where the company usually signs (`signingCounty` on the issuer). A paper signed somewhere
 * else needs that county on it instead, so each print press carries a box that opens on the setting and can be typed
 * over for that print alone. The paper is filled from the issuer, so the override is the issuer with that one field
 * changed: every draw of the paper (the desk's, the Lien window's) reads it the same way, and nothing is saved.
 */
export function withSigningCounty(issuer: PhysicalInvoiceIssuer | null, county: string | null | undefined): PhysicalInvoiceIssuer | null {
  if (county == null) return issuer
  const typed = county.trim()
  if (!issuer) return typed ? { companyName: '', addressText: '', phone: '', email: '', tagline: '', licenseLine: '', signingCounty: typed } : null
  return { ...issuer, signingCounty: typed }
}

/** The county as a help sheet says it: `Travis County`, whether Settings hold `Travis` or `Travis County`; '' when none. */
export function signingCountyWords(county: string | null | undefined): string {
  const c = (county ?? '').trim().replace(/\s+county$/i, '')
  return c ? `${c} County` : ''
}

/** The box beside a print press: *Signed in* `[Travis]` *County*. */
export const LIEN_SIGNING_COUNTY_LABEL = 'Signed in'

/** Under the box: what the paper will print, and what to do when it is signed somewhere else. */
export function signingCountyHint(county: string | null | undefined): string {
  const words = signingCountyWords(county)
  return words
    ? `Both county lines print ${words}. Signing somewhere else? Type that county for this print.`
    : 'Left blank, the notary writes both county lines by hand. Type the county where it is signed to print it.'
}
