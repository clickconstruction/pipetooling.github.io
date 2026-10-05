/**
 * GC mode — design spike: who at a trade gets what, on the office's side (the owner, 2026-10-05:
 * "build both", on the Portal lane's *who at the company gets what*). The company window's About
 * lists the people the company named and the emails each gets. Follow up's Email goes to whoever
 * gets the kinds it chases: a waiver or a W-9 to the bookkeeper, a quote to the estimator. A text
 * and a call stay with the main contact, the one number we have.
 */
import type { GcState, Partner, PortalMailGroup, PromiseKind } from './gcTypes'
import { partnerReach, type FollowItem } from './gcFollowUpSheet'
import { contactGets, mailRecipients, PORTAL_MAIL_GROUPS } from './gcPortal'
import { pt, type PortalKey, type PortalLang } from './gcPortalI18n'

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

const PROMISE_GROUP: Record<PromiseKind, PortalMailGroup> = {
  insurance: 'pay',
  w9: 'pay',
  payApp: 'pay',
  msa: 'contracts',
  sow: 'contracts',
  start: 'job',
  submittals: 'job',
  delivery: 'job',
  punch: 'job',
  closeout: 'job',
}

/**
 * The kind of email a Follow up item is, by the portal's rule: plans on a job that is ours go to the
 * job's people. Null: not a trade's (the architect's or the customer's).
 */
export function followItemMailGroup(state: GcState, item: FollowItem): PortalMailGroup | null {
  switch (item.kind) {
    case 'quote':
      return 'quotes'
    case 'plans': {
      const id = item.projectId ?? item.ask?.projectId
      const project = id ? state.projects.find((p) => p.id === id) : undefined
      return project && project.stage !== 'pursuing' ? 'job' : 'quotes'
    }
    case 'sow':
      return 'contracts'
    case 'insurance':
    case 'waiver':
    case 'w9':
      return 'pay'
    case 'promise':
      return item.promise ? PROMISE_GROUP[item.promise.kind] : 'job'
    default:
      return null
  }
}

export interface MailTo {
  name: string
  first: string
  email: string
  main: boolean
}

function firstName(name: string): string {
  return name.split(/\s+/)[0] ?? name
}

/**
 * Who Follow up's email goes to: everyone who gets a kind that is ticked, the main contact first.
 * Nothing ticked, or nothing of the trade's: the main contact.
 */
export function followUpMailTo(state: GcState, partner: Partner, items: FollowItem[]): MailTo[] {
  const reach = partnerReach(partner)
  const main: MailTo = { name: reach.name, first: reach.first, email: reach.email, main: true }
  const groups = PORTAL_MAIL_GROUPS.filter((g) => items.some((i) => followItemMailGroup(state, i) === g))
  if (groups.length === 0) return [main]
  const out: MailTo[] = []
  for (const g of groups) {
    for (const r of mailRecipients(partner, g)) {
      if (out.some((o) => o.main === r.main && o.name === r.name)) continue
      out.push(r.main ? main : { name: r.name, first: firstName(r.name), email: r.email ?? '', main: false })
    }
  }
  return out.sort((a, b) => Number(b.main) - Number(a.main))
}

/** "Dana", or "Marcus and Dana": who the email greets, in the company's language. */
export function mailToGreeting(to: MailTo[], lang: PortalLang = 'en'): string {
  const names = to.map((t) => t.first)
  const and = lang === 'es' ? 'y' : 'and'
  return names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} ${and} ${names[names.length - 1]}`
}

/**
 * Why it goes past the main contact, a sentence for each other person: "Pecan Valley Electric sends
 * pay and papers to Dana Whitfield, its bookkeeper." Null: it goes to the main contact alone.
 */
export function mailToWhy(state: GcState, partner: Partner, items: FollowItem[], to: MailTo[]): string | null {
  if (to.every((t) => t.main)) return null
  const ticked = new Set(items.map((i) => followItemMailGroup(state, i)))
  const sentences = (partner.people ?? [])
    .filter((p) => to.some((t) => !t.main && t.name === p.name))
    .map((p) => {
      const kinds = p.gets.filter((g) => ticked.has(g))
      return `${partner.company} sends ${mailGroupList(kinds)} to ${p.name}${p.role ? `, its ${p.role.toLowerCase()}` : ''}.`
    })
  return sentences.join(' ')
}
