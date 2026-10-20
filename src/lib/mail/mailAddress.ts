import { runAddressLines } from '../jobs/lienRunPaper'
import { splitCityStateZip } from '../jobs/lienRunLabels'

/**
 * A mail piece's party (the Docsmit train, PR 1 — `docs/DOCSMIT_LIEN_RUN_PLAN.md`): what a certified
 * mail provider needs for one recipient, from the one-line name and address the run already holds.
 * Docsmit takes `firstName` + `lastName` or `organization`, `address1`, `address2`, `city`, a two-letter
 * `state` and a ZIP or ZIP+4. The split reuses the label CSV's rules (v2.4977), so the same typed
 * address reads the same in both. Pure; the address check (CASS) runs on the server with this in.
 */
export type MailParty = {
  firstName: string
  lastName: string
  organization: string
  address1: string
  address2: string
  city: string
  state: string
  postalCode: string
}

/** Words that say a name is a company, not a person: the party goes as an organization. */
const ORG_WORDS = /\b(llc|l\.l\.c\.|inc\.?|incorporated|corp\.?|corporation|co\.|company|ltd\.?|limited|lp|l\.p\.|llp|pllc|pc|p\.c\.|trust|partners|partnership|holdings|properties|group|enterprises|associates|construction|contracting|builders|dental|medical|church|school|district|city of|county of|state of|bank|hoa|association|ministries|investments|realty|development|management|services|&)\b/i

/** A person's name splits on the last space; anything with a company word, a digit, or more than four words goes whole as the organization. */
export function mailPartyName(name: string): Pick<MailParty, 'firstName' | 'lastName' | 'organization'> {
  const n = name.replace(/\s+/g, ' ').trim()
  if (!n) return { firstName: '', lastName: '', organization: '' }
  const words = n.split(' ')
  if (ORG_WORDS.test(n) || /\d/.test(n) || words.length > 4 || words.length === 1) return { firstName: '', lastName: '', organization: n }
  // "Rizvi Syed Zulfiqar & Kizilbash Quratulain Fatima" has the & and goes whole; "John A. Backham" splits on the last space.
  return { firstName: words.slice(0, -1).join(' '), lastName: words[words.length - 1]!, organization: '' }
}

/** The one-line address as the provider's lines: street on line 1, a suite or floor on line 2, then city, state and ZIP. */
export function mailPartyAddress(address: string): Pick<MailParty, 'address1' | 'address2' | 'city' | 'state' | 'postalCode'> {
  const lines = runAddressLines(address)
  const last = lines.length > 1 ? lines[lines.length - 1]! : ''
  let street = lines.length > 1 ? lines.slice(0, -1) : lines
  let { city, state, zip } = splitCityStateZip(last)
  // "311 E Illinois Ave. Palatine, Il 60067": no comma before the city, so the last part is state + ZIP and the city is the last word before it (the label CSV's rule).
  const stateZip = last.trim().match(/^([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/)
  if (stateZip && street.length > 0) {
    const prev = street[street.length - 1]!.trim()
    const cut = prev.lastIndexOf(' ')
    if (cut > 0) {
      city = prev.slice(cut + 1)
      state = stateZip[1]!.toUpperCase()
      zip = stateZip[2]!
      street = [...street.slice(0, -1), prev.slice(0, cut)]
    }
  }
  // A suite, floor or unit on the street line goes to line 2 so the window shows the street alone.
  const first = street[0] ?? ''
  const unit = first.match(/^(.*?)[,\s]+((?:suite|ste\.?|floor|fl\.?|unit|apt\.?|#)\s*[A-Za-z0-9-]+)$/i)
  const address1 = (unit ? unit[1]! : first).trim()
  const address2 = [unit ? unit[2]! : '', ...street.slice(1)].filter(Boolean).join(', ').trim()
  return { address1, address2, city: city.trim(), state: state.trim().toUpperCase(), postalCode: zip.trim() }
}

export function mailParty(name: string, address: string): MailParty {
  return { ...mailPartyName(name), ...mailPartyAddress(address) }
}

/** What stops a party from mailing, in the provider's own terms; empty when it can go. */
export function mailPartyProblems(p: MailParty): string[] {
  const out: string[] = []
  if (!p.organization && !(p.firstName && p.lastName)) out.push('a name: a company, or a first and last name')
  if (!p.address1) out.push('a street line')
  if (!p.city) out.push('a city')
  if (!/^[A-Z]{2}$/.test(p.state)) out.push('a two-letter state')
  if (!/^\d{5}(-\d{4})?$/.test(p.postalCode)) out.push('a ZIP or ZIP+4')
  return out
}
