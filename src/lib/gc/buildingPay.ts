/**
 * GC mode, the real build, the Building lane's U2: a trade's draw: the day to pay it by, and the draws to pay, moved word for word from the GC mode prototype
 * (branch spike/gc-mode, `gcBuildingPay.ts`). The plan: to-dos/gc-mode/BUILDING_REAL_BUILD.md on that branch.
 */
import { addDays, tradeCloseout } from './building'
import { drawClock, type DrawWaitsOn } from './drawPayClock'
import { partnerById } from './lookups'
import { PAY_WITHIN_DAYS } from './portal'
import { daysBetween } from './schedule/schedule'
import type { Draw, GcProject, GcState, TradePackage } from './types'

export interface DrawPayDays {
  approvedOn: string | null
  /** The day it should be paid by. Null: not approved, approved before the day was kept, or the customer has not paid for it yet. */
  payBy: string | null
  /** Why an approved draw has no pay-by day yet: our bill to the customer has not gone, or the customer has not paid it. */
  waitsOn: DrawWaitsOn | null
  paidOn: string | null
  /** Days past the pay-by day: paid that late, or still unpaid that late today. 0: on time. */
  daysLate: number
}

/** A draw's days: approved, pay by, paid, and how late. */
export function drawPayDays(project: GcProject, pkg: TradePackage, draw: Draw, today: string): DrawPayDays {
  const approvedOn = draw.status === 'requested' ? null : (draw.approvedOn ?? null)
  const paidOn = draw.status === 'paid' ? (draw.paidOn ?? null) : null
  if (!approvedOn) return { approvedOn, payBy: null, waitsOn: null, paidOn, daysLate: 0 }
  // A retainage release keeps its own day. Any other draw is due after the customer pays for it (`drawPayClock.ts`).
  const release = draw.final === true && pkg.sow != null
  const clock = release ? null : drawClock(project, draw)
  const payBy = release && pkg.sow ? (tradeCloseout(pkg.sow, project, today).opensOn ?? addDays(approvedOn, PAY_WITHIN_DAYS)) : (clock?.payBy ?? null)
  const waitsOn = paidOn ? null : (clock?.waitsOn ?? null)
  // Late against the day it was paid, or against today while it is still unpaid.
  const until = paidOn ?? (draw.status === 'approved' ? today : null)
  const daysLate = payBy && until ? Math.max(0, daysBetween(payBy, until)) : 0
  return { approvedOn, payBy, waitsOn, paidOn, daysLate }
}

export interface DrawToPay {
  pkg: TradePackage
  company: string
  draw: Draw
  payBy: string | null
  waitsOn: DrawWaitsOn | null
  daysLate: number
}

/** Every approved draw not paid yet on the project, the one to pay first on top: late, then soonest. */
export function drawsToPay(state: GcState, project: GcProject): DrawToPay[] {
  return project.packages
    .flatMap((pkg) => {
      const invite = pkg.invites.find((i) => i.id === pkg.awardedInviteId)
      const company = (invite ? partnerById(state, invite.partnerId)?.company : undefined) ?? pkg.trade
      return (pkg.sow?.draws ?? [])
        .filter((d) => d.status === 'approved')
        .map((draw) => {
          const days = drawPayDays(project, pkg, draw, state.today)
          return { pkg, company, draw, payBy: days.payBy, waitsOn: days.waitsOn, daysLate: days.daysLate }
        })
    })
    .sort((a, b) => b.daysLate - a.daysLate || (a.payBy ?? '9999').localeCompare(b.payBy ?? '9999'))
}
