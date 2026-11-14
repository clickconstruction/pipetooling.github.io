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

/** The box beside a print press: *Signed in* `[Travis]` *County*, and a small **?** after it (v2.7209). */
export const LIEN_SIGNING_COUNTY_LABEL = 'Signed in'

/** What the empty box says in grey: with no county typed, the notary writes both county lines by hand. */
export const LIEN_SIGNING_COUNTY_PLACEHOLDER = 'the notary writes it'

/** The name of the **?** after the box, for a screen reader. */
export const LIEN_SIGNING_COUNTY_TIP_LABEL = 'About the county it is signed in'

/**
 * Behind the **?** after the box, and the box's own description: what to do with an empty box (its grey words already
 * say who writes the lines when it is left alone), and with a county in it what the paper will print.
 */
export function signingCountyTip(county: string | null | undefined): string {
  const words = signingCountyWords(county)
  return words
    ? `Both county lines print ${words}. Signing somewhere else? Type that county for this print.`
    : 'Type the county where it is signed to print it on both county lines.'
}
