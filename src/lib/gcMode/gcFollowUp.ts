/**
 * GC mode — design spike. Follow up: promised quote days, a company's word record, who to call first.
 * Split out of gcModel.ts verbatim; import from `./gcModel`, which re-exports every file.
 */
import type { GcProject, GcState, Invite, Partner, TradePackage } from './gcTypes'
import { daysUntil, weekdayDate } from './gcWords'
import { partnerById } from './gcLookups'
import { tradePromiseRecord } from './gcPromises'

/**
 * Where a company's word stands on one ask. kept: the quote came by the day. late: it came after.
 * pending: the day has not come. today: it is due today. passed: the day went by with no quote.
 */
export type PromiseState = 'kept' | 'late' | 'pending' | 'today' | 'passed'

export interface AskPromise {
  by: string
  madeOn: string
  state: PromiseState
  /** Days until the day (pending), or since it (passed, late). */
  days: number
}

/** The promise that counts on an ask: the newest date they gave. Null when they gave none. */
export function askPromise(invite: Invite, today: string): AskPromise | null {
  const line = (invite.contacts ?? []).find((c) => c.promisedBy)
  if (!line?.promisedBy) return null
  const by = line.promisedBy
  const until = daysUntil(by, today)
  if (invite.bid) {
    const late = daysUntil(invite.bid.submittedOn, by)
    return { by, madeOn: line.on, state: late <= 0 ? 'kept' : 'late', days: Math.max(0, late) }
  }
  return { by, madeOn: line.on, state: until > 0 ? 'pending' : until === 0 ? 'today' : 'passed', days: Math.abs(until) }
}

export function promiseWords(p: AskPromise): string {
  const day = weekdayDate(p.by)
  if (p.state === 'kept') return `kept their word: quote by ${day}`
  if (p.state === 'late') return `quote came ${p.days} ${p.days === 1 ? 'day' : 'days'} after their ${day}`
  if (p.state === 'pending') return `promised by ${day}`
  if (p.state === 'today') return `promised today, ${day}`
  return `promised ${day}, ${p.days} ${p.days === 1 ? 'day' : 'days'} past`
}

/**
 * How often a company's date held: the promises before today plus the ones settled on live asks.
 * A day that passed with no quote counts against them even after they give a new day. A day they
 * moved before it came does not.
 */
export function wordRecord(state: GcState, partner: Partner): { made: number; kept: number } {
  let made = partner.promisesMade
  let kept = partner.promisesKept
  for (const project of state.projects) {
    for (const pkg of project.packages) {
      const invite = pkg.invites.find((i) => i.partnerId === partner.id)
      const lines = (invite?.contacts ?? []).filter((c) => c.promisedBy)
      lines.forEach((line, i) => {
        const by = line.promisedBy
        if (!by || !invite) return
        const quotedOn = invite.bid?.submittedOn ?? null
        const keptIt = quotedOn !== null && daysUntil(quotedOn, by) <= 0
        const newer = lines[i - 1]
        const movedInTime = newer !== undefined && daysUntil(newer.on, by) <= 0
        if (keptIt) {
          // One quote keeps one promise: the newest day they gave.
          if (i === 0) {
            made += 1
            kept += 1
          }
        } else if (daysUntil(by, state.today) < 0 && !movedInTime) {
          made += 1
        }
      })
    }
  }
  // Promises other than a quote date count the same way (question 8).
  const other = tradePromiseRecord(state, partner)
  return { made: made + other.made, kept: kept + other.kept }
}

export type FollowUpWhy = 'passed' | 'today' | 'silent' | 'nodate' | 'waiting'

/** One company to chase on one ask, with the reason said as a sentence. */
export interface FollowUp {
  project: GcProject
  pkg: TradePackage
  invite: Invite
  partner: Partner
  why: FollowUpWhy
  words: string
  /** Lower sorts first. */
  order: number
}

/**
 * Everyone we are waiting on, the ones to call first. A promise that passed leads, then a promise
 * due today, then a company that never opened the ask, then one that has the plans and gave no
 * date. A promise not due yet is listed last, as waiting: nothing to do but know it.
 */
export function followUps(state: GcState): FollowUp[] {
  const out: FollowUp[] = []
  for (const project of state.projects) {
    for (const pkg of project.packages) {
      if (!packageIsOpen(project, pkg)) continue
      for (const invite of pkg.invites) {
        if (invite.status !== 'invited' && invite.status !== 'opened') continue
        const partner = partnerById(state, invite.partnerId)
        if (!partner) continue
        const promise = askPromise(invite, state.today)
        const asked = daysUntil(state.today, invite.invitedOn)
        const due = project.bidDue ? ` Our bid is due ${weekdayDate(project.bidDue)}.` : ''
        const base = { project, pkg, invite, partner }
        if (promise?.state === 'passed') {
          out.push({ ...base, why: 'passed', order: -promise.days, words: `Promised a quote by ${weekdayDate(promise.by)}. That was ${promise.days} ${promise.days === 1 ? 'day' : 'days'} ago.${due}` })
        } else if (promise?.state === 'today') {
          out.push({ ...base, why: 'today', order: 100, words: `Promised a quote today.${due}` })
        } else if (promise?.state === 'pending') {
          out.push({ ...base, why: 'waiting', order: 400 + promise.days, words: `Promised a quote by ${weekdayDate(promise.by)}, in ${promise.days} ${promise.days === 1 ? 'day' : 'days'}.` })
        } else if (invite.status === 'invited' && asked > OPEN_WITHIN_DAYS) {
          out.push({ ...base, why: 'silent', order: 200 - asked, words: `Asked ${asked} days ago and has not opened it.${due}` })
        } else if (invite.status === 'opened') {
          out.push({ ...base, why: 'nodate', order: 300 - asked, words: `Has the plans and has not said when the quote will come.${due}` })
        }
      }
    }
  }
  return out.sort((a, b) => a.order - b.order)
}

/** A trade is still open on a project until it is awarded. A trade we do ourselves never is. */
export function packageIsOpen(project: GcProject, pkg: TradePackage): boolean {
  // A lost bid (owner, 2026-10-03) is chased no more: nothing on it is open.
  return !pkg.selfPerform && pkg.awardedInviteId === null && project.stage !== 'building' && !project.lostOn
}

/** A company we ask should open the plans within this many days. */
export const OPEN_WITHIN_DAYS = 3
