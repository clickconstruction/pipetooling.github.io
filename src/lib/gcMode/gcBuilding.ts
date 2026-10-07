/**
 * GC mode — design spike: Building and Closeout. The pay application a trade sends with each draw:
 * the AIA G702 (the summary page) and G703 (the continuation sheet, one row per line of the
 * statement of work). The app knows almost all of it: the contract, the lines, what was billed
 * before, the retainage, what the trade reported. The trade says only the period, its address once,
 * who signs, and the percent on any line that moved.
 *
 * The real build fills the same AIA template the Jobs Stages tab fills (`aiaG702G703Template.ts`).
 */
import type { Draw, GcProject, Partner, Sow } from './gcTypes'
import { GC_COMPANY } from './gcFixture'
import type { PayAppParties } from './gcPayAppFile'
import { stageReached } from './gcTheirSov'
// What moved to main (the real build) is re-exported from there, so there is one copy.
import type { PayApplication } from '../gc/building'
import { changeOrderLines, payAppClaimedToDate, payApplicationForDraw } from '../gc/building'
export type { CloseoutKey, CloseoutRow, CloseoutStep, OwnCrewWork, PayAppInput, PayAppLine, PayAppStep, PayAppStepKey, PayAppSummary, PayApplication, TradeChange, TradeChangeState, TradeCloseout } from '../gc/building'
export { GC_COMPANY_NAME, TRADE_RETAINAGE_WAIT_DAYS, changeOrderLines, changeOrderTradePct, crewPctFromStages, drawApprovedLess, drawLinesOf, drawMoney, finalPayApplication, jobCloseout, newPayAppDraft, ownCrewWork, ownerRetainagePaidOn, payAppClaimedToDate, payAppDraftPcts, payAppKnown, payAppSteps, payApplication, payApplicationForDraw, projectCloseout, resendPayAppDraft, retainageHeldNow, sowContractSum, storedBefore, storedOf, timesSentBack, tradeChangesFor, tradeCloseout, tradeRetainageOpensOn, workAllBilled } from '../gc/building'

export { CREW_STAGE_WEIGHTS, addDays, crewStages, sentBackOpen } from '../gc/building'
/** "Their schedule: through Rough-in, 40% into Top out." Where a draw lands on theirs. Null: they gave none. */
export function drawOnTheirSov(sow: Sow, draw: Draw): string | null {
  const theirs = sow.theirSov ?? []
  if (theirs.length === 0 || draw.final) return null
  const r = stageReached(theirs, payAppClaimedToDate(sow, payApplicationForDraw(sow, draw)))
  const live = theirs.filter((l) => l.amount > 0)
  if (r.through.length === live.length && live.length > 0) return 'Their schedule: every line.'
  const parts = [r.through.length > 0 ? `through ${r.through.join(', ')}` : '', r.into ? `${r.into.pct}% into ${r.into.label}` : ''].filter(Boolean)
  return parts.length === 0 ? 'Their schedule: nothing reached yet.' : `Their schedule: ${parts.join(', ')}.`
}
/**
 * Who and what a trade's pay application is for, beside its numbers (question 12): the trade to us,
 * its dates, and the change orders on it, each with whether the trade signed it since its last
 * application. For the Owner Billing lane's shared Excel and PDF builder (`gcPayAppFile.ts`).
 * `typed.signedOn` null: a draft not sent yet.
 */
export function tradePayAppParties(
  project: GcProject,
  sow: Sow,
  partner: Partner,
  app: PayApplication,
  typed: { periodTo: string; address: string; license: string; signedOn: string | null },
): PayAppParties {
  const before = sow.draws
    .filter((d) => d.number < app.number)
    .reduce((last, d) => {
      const day = d.payApp?.periodTo ?? d.requestedOn
      return day > last ? day : last
    }, '')
  const signedOn = new Map((project.changeOrders ?? []).map((co) => [co.id, co.tradeChange?.signedOn ?? null]))
  const changeOrders = changeOrderLines(sow).map((l) => {
    const on = l.changeOrderId ? (signedOn.get(l.changeOrderId) ?? null) : null
    return { amount: l.amount, thisPeriod: on !== null && on > before && (!typed.periodTo || on <= typed.periodTo) }
  })
  return {
    project: project.name,
    applicationNo: app.final ? `${app.number}, final` : String(app.number),
    periodTo: typed.periodTo,
    sentOn: typed.signedOn,
    contractDate: sow.signedOn,
    to: { name: GC_COMPANY.name, address: GC_COMPANY.address },
    from: { name: partner.company, address: typed.address, ...(typed.license ? { license: typed.license } : {}) },
    architect: project.architect || null,
    changeOrders,
  }
}
