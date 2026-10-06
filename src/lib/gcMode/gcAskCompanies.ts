/**
 * GC mode design spike: asking companies to quote, looked at before anything goes out (the owner,
 * 2026-10-05: "build the confirm window"; mock-up `to-dos/gc-mode/ask-companies-mockup.html`).
 * Trade partners' "Ask the 2 we have not asked" invited them on the press. Here is what the window
 * shows first: who can be asked, what helps choose, and the invitation each would get.
 *
 * Its own file, out of the barrel: it reads the reducer, which reads nearly everything.
 */
import type { GcState, Partner } from './gcTypes'
import { gcReducer } from './gcReducer'
import { find } from './gcReducerHelpers'
import { mailRecipients, portalMessages, type PortalMessage } from './gcPortal'
import { travelFor, travelWords } from './gcMap'
import { answerRecord, type AnswerRecord } from './gcReliability'
import { bidsIn } from './gcBids'
import { partnerReach } from './gcFollowUpSheet'

/** The quotes we want on every trade (the bench's rule). */
const QUOTES_WANTED = 2

/** One company that could be asked to quote a trade on a job. */
export interface AskChoice {
  partner: Partner
  /** Inside the distance they said they go. A company past it is offered, not ticked. */
  inZone: boolean
  /** "35 mi", or "82 mi, past their 60". Empty when the coverage is not set. */
  travel: string
  record: AnswerRecord
  /** New to us and not approved yet: it can quote, and no award until we approve it. */
  notVetted: boolean
  /** We declined to work with them. Offered last, never ticked. */
  declined: boolean
  /** Who at the company gets an invitation, the main contact first. */
  to: { name: string; email: string | null }[]
}

/**
 * Every company in the trade we have not asked on this job: those in range first, a company we
 * declined last, each group in the bench's order.
 */
export function askChoices(state: GcState, projectId: string, packageId: string): AskChoice[] {
  const { project, pkg } = find(state, projectId, packageId)
  if (!project || !pkg) return []
  const asked = new Set(pkg.invites.map((i) => i.partnerId))
  const rank = (c: AskChoice) => (c.declined ? 2 : c.inZone ? 0 : 1)
  return state.partners
    .filter((p) => p.trades.includes(pkg.trade) && !asked.has(p.id))
    .map((partner): AskChoice => {
      const travel = travelFor(state, partner, project)
      return {
        partner,
        inZone: travel.inZone,
        travel: travelWords(travel, partner),
        record: answerRecord(partner),
        notVetted: partner.vetting?.status === 'new',
        declined: partner.vetting?.status === 'declined',
        // The main contact's address is made up until the record has one, as on the Follow up sheet (`partnerReach`).
        to: mailRecipients(partner, 'quotes').map((t) => ({ name: t.name, email: t.email ?? (t.main ? partnerReach(partner).email : null) })),
      }
    })
    .map((choice, at) => ({ choice, at }))
    .sort((a, b) => rank(a.choice) - rank(b.choice) || a.at - b.at)
    .map((x) => x.choice)
}

/**
 * The invitation one company would get if we asked it now, in its own language: the email the
 * portal lane writes once it is asked, read from the state as it would be after the press.
 */
export function askDraft(state: GcState, projectId: string, packageId: string, partnerId: string): PortalMessage | null {
  const { pkg } = find(state, projectId, packageId)
  if (!pkg || pkg.invites.some((i) => i.partnerId === partnerId)) return null
  const after = gcReducer(state, { type: 'invite', projectId, packageId, partnerId })
  return portalMessages(after, partnerId).find((m) => m.key === `${pkg.id}-${partnerId}:invite`) ?? null
}

/** Where the trade stands on quotes, and where asking this many would leave it. */
export function askStanding(state: GcState, projectId: string, packageId: string, asking: number): { quotes: number; wanted: number; out: number; words: string } {
  const { pkg } = find(state, projectId, packageId)
  const quotes = pkg ? bidsIn(pkg).length : 0
  // Companies already asked that have not quoted or said no.
  const out = pkg ? pkg.invites.filter((i) => i.bid === null && i.status !== 'declined').length : 0
  const reach = quotes + out + asking
  const emails = asking === 1 ? '1 email goes out' : `${asking} emails go out`
  const words =
    asking === 0
      ? 'Tick a company to ask.'
      : reach >= QUOTES_WANTED
        ? `${emails}, each with the company's own portal link. If they answer, ${pkg?.trade ?? 'the trade'} has the ${QUOTES_WANTED} quotes we want.`
        : `${emails}, each with the company's own portal link. That still leaves ${pkg?.trade ?? 'the trade'} short of ${QUOTES_WANTED} quotes.`
  return { quotes, wanted: QUOTES_WANTED, out, words }
}
