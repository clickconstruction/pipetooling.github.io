/**
 * GC mode — design spike: whether a company's portal is working, for the company window's
 * *Their portal* tab (the owner, 2026-10-04: "a view that allows us to see the customer's portal
 * and if it is active or not yet"). Readers only, except the customer's on and off switch, which
 * is the reducer's `setCustomerPortal`.
 */
import type { GcCustomer, GcProject, GcState, Partner } from './gcTypes'
import { daysUntil, shortDate } from './gcWords'
import { linkNeverOpened, portalFirstVisit, portalLink } from './gcPortal'

/** off: the customer's portal is not on. none: a trade has no link yet. waiting: sent, never opened. active: they use it. */
export type PortalState = 'off' | 'none' | 'waiting' | 'active'

export interface CompanyPortalStatus {
  state: PortalState
  /** The tab's short word: "active", "not opened yet", "off". */
  word: string
  /** One or two sentences under the chip. */
  words: string
  link: string | null
  /** A trade's link waited past the days we give it. */
  late?: boolean
}

function ago(iso: string, today: string): string {
  const days = -daysUntil(iso, today)
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`
}

/** The newest thing a trade did in its portal, with what it was. Null when we cannot tell. */
export function tradeLastSeen(state: GcState, partner: Partner): { on: string; what: string } | null {
  const seen: { on: string; what: string }[] = []
  if (partner.portalOpenedOn) seen.push({ on: partner.portalOpenedOn, what: 'opened it for the first time' })
  if (partner.vetting?.form) seen.push({ on: partner.vetting.form.sentOn, what: 'sent their company form' })
  if (partner.msa === 'signed' && partner.msaSignedOn) seen.push({ on: partner.msaSignedOn, what: 'signed the master agreement' })
  for (const project of state.projects) {
    for (const pkg of project.packages) {
      const invite = pkg.invites.find((i) => i.partnerId === partner.id)
      if (invite?.bid) seen.push({ on: invite.bid.submittedOn, what: `sent a quote on ${project.name}` })
      for (const c of invite?.contacts ?? []) if (c.how === 'portal') seen.push({ on: c.on, what: `wrote to us about ${project.name}` })
      const awarded = pkg.invites.find((i) => i.id === pkg.awardedInviteId)
      if (awarded?.partnerId !== partner.id || !pkg.sow) continue
      if (pkg.sow.signedOn) seen.push({ on: pkg.sow.signedOn, what: `signed the statement of work on ${project.name}` })
      for (const d of pkg.sow.draws) seen.push({ on: d.requestedOn, what: `asked for draw ${d.number} on ${project.name}` })
    }
  }
  return seen.sort((a, b) => b.on.localeCompare(a.on))[0] ?? null
}

/** A trade's portal: no link until its first ask, then waiting until it opens, then active. */
export function tradePortalStatus(state: GcState, partner: Partner): CompanyPortalStatus {
  const asked = state.projects.flatMap((p) => p.packages.flatMap((k) => k.invites.filter((i) => i.partnerId === partner.id).map((i) => ({ project: p, on: i.invitedOn }))))
  if (asked.length === 0) {
    return { state: 'none', word: 'no link yet', words: 'Their link goes out with the first ask to quote.', link: null }
  }
  const link = portalLink(partner.id)
  const never = linkNeverOpened(state, partner.id)
  if (never) {
    const first = [...asked].sort((a, b) => a.on.localeCompare(b.on))[0]
    return {
      state: 'waiting',
      word: 'not opened yet',
      words: `The link went out ${shortDate(never.since)}${first ? ` with the ask on ${first.project.name}` : ''}, ${ago(never.since, state.today)}. They have not opened it.`,
      link,
      late: never.late,
    }
  }
  if (portalFirstVisit(state, partner.id)) {
    return { state: 'waiting', word: 'not opened yet', words: 'They have not opened their link yet.', link }
  }
  const last = tradeLastSeen(state, partner)
  return {
    state: 'active',
    word: 'active',
    words: last ? `Last seen ${shortDate(last.on)}, ${ago(last.on, state.today)}, when they ${last.what}.` : 'They have opened it. The day was not kept.',
    link,
  }
}

/** The link a customer's portal lives at. Made up from the id, like a trade's. */
export function customerPortalLink(customerId: string): string {
  let h = 2166136261
  for (const c of customerId) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0
  return `clicktooling.com/c/${h.toString(36).toUpperCase().padStart(7, '0').slice(0, 7)}`
}

/** The jobs a customer's portal shows: ours, buying out or building. A job still bidding has nothing to bill on. */
export function customerPortalJobs(state: GcState, customer: GcCustomer): GcProject[] {
  return state.projects.filter((p) => p.customerId === customer.id && !p.lostOn && (p.stage === 'buyout' || p.stage === 'building'))
}

/** A customer's portal: off until we turn it on, then waiting until they open it, then active. */
export function customerPortalStatus(state: GcState, customer: GcCustomer): CompanyPortalStatus {
  const jobs = customerPortalJobs(state, customer)
  if (!customer.portalOn) {
    return {
      state: 'off',
      word: 'off',
      words: jobs.length === 0 ? 'It opens once we win a job for them.' : 'It is not on yet. Turn it on to send them the link.',
      link: null,
    }
  }
  const link = customerPortalLink(customer.id)
  if (!customer.portalLastOpened) {
    return { state: 'waiting', word: 'not opened yet', words: 'We sent them the link. They have not opened it yet.', link }
  }
  return {
    state: 'active',
    word: 'active',
    words: `Last opened ${shortDate(customer.portalLastOpened)}, ${ago(customer.portalLastOpened, state.today)}.`,
    link,
  }
}
