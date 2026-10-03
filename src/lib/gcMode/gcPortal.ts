/**
 * GC mode — design spike: the trade partner's portal. What one company reads about its own asks:
 * the plans, the day it promised, its paperwork, the lines of its bid we could not read. Pure reads
 * of the state; the GcPortal*.tsx screens draw them.
 *
 * The words follow the plain-words rules at the top of `gcTour.ts`.
 */
import type { GcProject, Invite, Partner, PlanSet, ScopeItem, TradePackage } from './gcTypes'
import { daysUntil, shortDate, weekdayDate } from './gcWords'
import { currentRev } from './gcLookups'
import { askPromise } from './gcFollowUp'

/** What the plans block tells one company on one ask. */
export interface PortalPlanNews {
  /** The newest set on the project. */
  latest: PlanSet | undefined
  /** They have not opened any set on this ask yet. */
  neverOpened: boolean
  /** A set came out after the one they last opened. */
  behind: boolean
  /** The sets since they last looked that change this trade, oldest first. Empty: nothing new for them. */
  forTrade: PlanSet[]
}

/**
 * A new set only matters to a company when it changes their trade. One that does not still asks
 * them to open it, so everyone prices on the same drawings, but it does not warn them.
 */
export function portalPlanNews(project: GcProject, pkg: TradePackage, invite: Invite): PortalPlanNews {
  const rev = currentRev(project)
  const seen = invite.seenRev
  return {
    latest: project.planSets.find((s) => s.rev === rev),
    neverOpened: seen === null,
    behind: seen === null || seen < rev,
    forTrade: seen === null ? [] : project.planSets.filter((s) => s.rev > seen && s.touches.includes(pkg.id)).sort((a, b) => a.rev - b.rev),
  }
}

/** The day a company said its number will come, in its own portal's words. Late: the day passed with no number. */
export function portalPromiseLine(invite: Invite, today: string, gc: string): { text: string; late: boolean } | null {
  const p = askPromise(invite, today)
  if (!p || invite.bid) return null
  const day = weekdayDate(p.by)
  if (p.state === 'pending') return { text: `You told ${gc} your number will come by ${day}.`, late: false }
  if (p.state === 'today') return { text: `You told ${gc} your number will come today.`, late: false }
  const ago = p.days === 1 ? 'yesterday' : `${p.days} days ago`
  return { text: `You told ${gc} your number would come by ${day}. That day passed ${ago}. Send your number or give a new day.`, late: true }
}

/** One line of a company's paperwork: is it done, and what the chip beside it says. */
export interface PortalPaperLine {
  done: boolean
  words: string
}

export function portalInsurance(partner: Partner, today: string): PortalPaperLine & { ranOut: boolean } {
  if (partner.coiExpires === null) return { done: false, ranOut: false, words: 'none on file' }
  const left = daysUntil(partner.coiExpires, today)
  if (left < 0) return { done: false, ranOut: true, words: `ran out ${shortDate(partner.coiExpires)}` }
  return { done: true, ranOut: false, words: `good to ${shortDate(partner.coiExpires)}` }
}

/** The scope lines of a bid the office marked "not clear": the company has to say in or out. */
export function unclearLines(pkg: TradePackage, invite: Invite): ScopeItem[] {
  const bid = invite.bid
  if (!bid) return []
  return pkg.scope.filter((item) => bid.includes[item.id] === 'unclear')
}

/** A year from a day: the date a new certificate is good to, until they change it. */
export function aYearFrom(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${Number(y) + 1}-${m}-${m === '02' && d === '29' ? '28' : d}`
}
