import { splitPortalAddress } from './portal/portalPayload'
import { getExtraTxLocalityKeywords, TX_JOB_ADDRESS_LOCALITY_KEYWORDS } from './txLocalityAddressSplit'

/**
 * The comma nudge (v2.2323): entry-time help for the job address field.
 * Customer statements split street from city at a comma, so an address pasted
 * without one ("1200 Kenney Fort Blvd Round Rock, TX 78665") renders with the
 * city stuck in the bold street. This kernel powers two things under the
 * address input: a live "how it reads on statements" preview (same splitter
 * as the portal, so they can never disagree) and a one-tap suggestion that
 * inserts the missing comma when the street ends in a known city. Advice,
 * never law — nothing here blocks a save.
 */

export type AddressStatementPreview = {
  /** What the statement bolds as the street line. */
  street: string
  /** The quiet second line (city/state/zip), or null when nothing splits off. */
  quiet: string | null
}

/**
 * How the address will read on the customer statement — the exact same
 * first-comma split the portal uses (splitPortalAddress), just repackaged.
 * Null for a blank field (render nothing).
 */
export function buildAddressStatementPreview(address: string): AddressStatementPreview | null {
  const split = splitPortalAddress(address)
  if (!split) return null
  return { street: split.street, quiet: split.rest }
}

export type AddressCommaSuggestion = {
  /** The full corrected address, ready to write back into the field. */
  fixed: string
  /** The city the tail matched — for the hint copy. */
  city: string
}

/** Trailing "TX 78665" / "Tx." / "Texas 78665-1234" / bare zip — with or without a leading comma. */
const STATE_ZIP_TAIL = /,?\s+(TX|Texas)\b\.?(\s+\d{4,6}(-\d{4})?)?$/i
const BARE_ZIP_TAIL = /,?\s+\d{5}(-\d{4})?$/

/**
 * Offer the missing comma. Returns null whenever there is nothing safe to
 * suggest: the head already has a comma (the split works), the tail isn't a
 * known city, or the "street" left over would be empty. When it fires, the
 * state is normalized to "TX"; the zip is kept exactly as typed (a wrong zip
 * is a human decision, not a silent rewrite).
 *
 * City vocabulary = the SAME list the Pipeline two-line display and lien
 * prefills use: built-in TX_JOB_ADDRESS_LOCALITY_KEYWORDS plus the org's
 * dev-added extras (Settings → Jobs & dispatch → Job address city line
 * breaks), so adding a city there upgrades every surface at once. Matching
 * here is suffix-only (city at the very end of the street text) — stricter
 * than the display's anywhere-match, because this one rewrites the field.
 */
export function suggestAddressComma(
  address: string,
  extraCities: readonly string[] = getExtraTxLocalityKeywords(),
): AddressCommaSuggestion | null {
  const a = address.replace(/\s+/g, ' ').trim().replace(/[,\s]+$/g, '')
  if (!a) return null

  let head = a
  let tail = ''
  const stateMatch = STATE_ZIP_TAIL.exec(head)
  if (stateMatch) {
    const zip = (stateMatch[2] ?? '').trim()
    tail = zip ? `, TX ${zip}` : ', TX'
    head = head.slice(0, stateMatch.index).replace(/[,\s]+$/g, '')
  } else {
    const zipMatch = BARE_ZIP_TAIL.exec(head)
    if (zipMatch) {
      tail = `,${zipMatch[0].replace(/^,/, '')}`
      head = head.slice(0, zipMatch.index).replace(/[,\s]+$/g, '')
    }
  }

  // A comma in the head means street/city already split — nothing to fix.
  if (head.includes(',')) return null

  const headLower = head.toLowerCase()
  const cities = [...extraCities, ...TX_JOB_ADDRESS_LOCALITY_KEYWORDS].sort((x, y) => y.length - x.length)
  for (const city of cities) {
    const c = city.trim()
    if (!c) continue
    const suffix = ` ${c.toLowerCase()}`
    if (!headLower.endsWith(suffix)) continue
    const street = head.slice(0, head.length - c.length).replace(/[,\s]+$/g, '')
    if (!street) return null
    // Keep the city as the user typed it (casing included).
    const typedCity = head.slice(head.length - c.length)
    return { fixed: `${street}, ${typedCity}${tail}`, city: typedCity }
  }
  return null
}
