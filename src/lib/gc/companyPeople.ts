/**
 * GC mode, the real build, the Board's B3-c: who at a trade gets which emails, on the office's side, moved word for word from the GC mode prototype
 * (branch spike/gc-mode, `gcCompanyPeople.ts`). `followItemMailGroup` stays on the spike until Follow up's items lift (B2b).
 */
import { partnerReach } from './followUpSheet'
import { contactGets } from './portal'
import type { PortalKey, PortalLang } from './portalI18n'
import { pt } from './portalI18n'
import type { Partner, PortalMailGroup } from './types'

const GROUP_NAME: Record<PortalMailGroup, PortalKey> = { quotes: 'grpQuotes', job: 'grpJob', contracts: 'grpContracts', pay: 'grpPay' }

/** "Pay and papers": a kind's name, in the portal's words. */
export function mailGroupName(group: PortalMailGroup, lang: PortalLang = 'en'): string {
  return pt(lang, GROUP_NAME[group])
}

/** "quotes and plans, and pay and papers": the kinds, lowercase, for a sentence. */
export function mailGroupList(groups: PortalMailGroup[]): string {
  const words = groups.map((g) => mailGroupName(g).toLowerCase())
  return words.length <= 1 ? (words[0] ?? '') : `${words.slice(0, -1).join(', ')}, and ${words[words.length - 1]}`
}

export interface CompanyPerson {
  name: string
  /** "Bookkeeper". The main contact: "Main contact". */
  role: string
  email: string
  /** A made-up address stands in: the record has none. */
  madeUp: boolean
  main: boolean
  gets: PortalMailGroup[]
}

/** Everyone the company named, the main contact first, with the emails each gets. */
export function companyPeople(partner: Partner): CompanyPerson[] {
  const reach = partnerReach(partner)
  return [
    { name: reach.name, role: 'Main contact', email: reach.email, madeUp: !partner.email, main: true, gets: contactGets(partner) },
    ...(partner.people ?? []).map((p) => ({ name: p.name, role: p.role, email: p.email, madeUp: false, main: false, gets: p.gets })),
  ]
}
