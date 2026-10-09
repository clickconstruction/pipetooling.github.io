/**
 * GC mode, the real build: the back-charges waiting on the office, for the dashboard's Needs you line (the Board's B2b),
 * moved word for word from the GC mode prototype (branch spike/gc-mode, `gcBackChargesWaiting.ts`) by the Portal lane's
 * P4b-iii.
 */
import { partnerById } from './lookups'
import { backChargeDraws, backChargeState, backChargesToAct } from './portal'
import type { BackCharge, GcProject, GcState, TradePackage } from './types'
import { daysUntil, money } from './words'

/** A charge waits on us this many days before it reads late. */
export const BACK_CHARGE_LATE_DAYS = 7

export interface WaitingBackCharge {
  project: GcProject
  pkg: TradePackage
  charge: BackCharge
  company: string
  /** disputed: keep it or drop it. noAnswer: their day went by. take: it can come off draw `drawNumber`. */
  why: 'disputed' | 'noAnswer' | 'take'
  drawNumber: number | null
  /** Days since it became our move. */
  waited: number
}

/** The day a charge became our move: their answer, our answer to a dispute, or their answer day passing. */
function ourMoveSince(charge: BackCharge): string {
  return charge.settled?.on ?? charge.answer?.on ?? charge.answerBy
}

/** Every back-charge the office has to act on, oldest first, on jobs still open. */
export function backChargesWaiting(state: GcState): WaitingBackCharge[] {
  return state.projects
    .filter((p) => !p.closedOn && !p.lostOn)
    .flatMap((project) =>
      project.packages.flatMap((pkg) => {
        const sow = pkg.sow
        if (!sow) return []
        const partnerId = pkg.invites.find((i) => i.id === pkg.awardedInviteId)?.partnerId
        const company = (partnerId && partnerById(state, partnerId)?.company) || pkg.trade
        return backChargesToAct(sow, state.today).flatMap((charge): WaitingBackCharge[] => {
          const st = backChargeState(charge, state.today)
          const draw = backChargeDraws(sow, charge)[0]
          const why = st === 'disputed' ? 'disputed' : st === 'noAnswer' ? 'noAnswer' : 'take'
          // Agreed or kept with no approved draw to come off: nothing to do until a draw is approved.
          if (why === 'take' && !draw) return []
          // Ready to take: our move from the later of their answer and the draw's approval.
          const answered = ourMoveSince(charge)
          const since = why === 'take' && draw?.approvedOn && draw.approvedOn > answered ? draw.approvedOn : answered
          const waited = Math.max(0, -daysUntil(since, state.today))
          return [{ project, pkg, charge, company, why, drawNumber: draw?.number ?? null, waited }]
        })
      }),
    )
    .sort((a, b) => b.waited - a.waited)
}

/** "Iron Horse Fabrication disputed $1,250 on Fair Oaks Shops, Building D". Short, for the dashboard. */
export function backChargeShort(w: WaitingBackCharge): string {
  const amount = money(w.charge.amount)
  if (w.why === 'disputed') return `${w.company} disputed ${amount} on ${w.project.name}`
  if (w.why === 'noAnswer') return `${w.company} never answered ${amount} on ${w.project.name}`
  return `${amount} from ${w.company} can come off draw ${w.drawNumber} on ${w.project.name}`
}

export interface GcBackChargesNeedsYou {
  count: number
  late: boolean
  title: string
  detail: string
  /** The job the oldest is on: Settle opens it on Draws, at that charge (Building's `&charge=`). */
  projectId: string
  chargeId: string
}

/** The dashboard's line, or null when no back-charge waits on us. */
export function gcBackChargesNeedsYou(state: GcState): GcBackChargesNeedsYou | null {
  const waiting = backChargesWaiting(state)
  const first = waiting[0]
  if (!first) return null
  const n = waiting.length
  const shown = waiting.slice(0, 2).map(backChargeShort)
  const decide = waiting.some((w) => w.why !== 'take')
  const take = waiting.some((w) => w.why === 'take')
  const next = [
    ...(decide ? ['Keep it or drop it with a reason.'] : []),
    ...(take ? ['Take it off the draw before the draw is paid.'] : []),
  ]
  return {
    count: n,
    late: waiting.some((w) => w.waited > BACK_CHARGE_LATE_DAYS),
    title: `${n} ${n === 1 ? 'back-charge' : 'back-charges'} to settle in GC mode`,
    detail: `${shown.join(' · ')}${n > 2 ? ` · and ${n - 2} more` : ''}. ${next.join(' ')}`,
    projectId: first.project.id,
    chargeId: first.charge.id,
  }
}
