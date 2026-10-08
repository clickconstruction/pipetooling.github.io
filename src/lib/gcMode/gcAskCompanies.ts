/**
 * GC mode design spike: asking companies to quote, looked at before anything goes out (the owner,
 * 2026-10-05: "build the confirm window"; mock-up `to-dos/gc-mode/ask-companies-mockup.html`).
 * Trade partners' "Ask the 2 we have not asked" invited them on the press. Here is what the window
 * shows first: who can be asked, what helps choose, and the invitation each would get.
 *
 * Its own file, out of the barrel: it reads the reducer, which reads nearly everything.
 */
import type { GcState } from './gcTypes'
import { gcReducer } from './gcReducer'
import { find } from './gcReducerHelpers'
import { mailRecipients, portalMessages, type PortalMessage } from './gcPortal'
import { travelFor, travelWords } from './gcMap'
import { answerRecord } from './gcReliability'
import { partnerReach } from './gcFollowUpSheet'
// What moved to main (the real build) is re-exported from there, so there is one copy.
import type { AskChoice } from '../gc/askCompanies'
export type { AskChoice } from '../gc/askCompanies'
export { askStanding } from '../gc/askCompanies'

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
