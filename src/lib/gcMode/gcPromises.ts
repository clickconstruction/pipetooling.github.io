/**
 * GC mode — design spike: promises other than a quote date (the owner, 2026-10-04, question 8: "yes
 * to all, especially insurance, which will have a renewal date"). One record for every kind. A
 * promise is kept when the thing happens: `promisesKeptBy` names, for each move, what it keeps.
 * Each lane adds its own kinds' moves there (Board: insurance, W-9, statement of work; Building:
 * start, submittals, delivery, a pay application sent again, punch, closeout papers).
 */
import type { GcAction, GcState, Partner, PromiseKind, TradePromise } from './gcTypes'
import type { PromiseState } from './gcFollowUp'
import { daysUntil, shortDate, weekdayDate } from './gcWords'
import { partnerById } from './gcLookups'

/** What each kind is, in a few words, when the office does not say. */
export const PROMISE_WHAT: Record<PromiseKind, string> = {
  insurance: 'the renewed insurance certificate',
  w9: 'a signed W-9',
  sow: 'the signed statement of work',
  start: 'their start day',
  submittals: 'their submittals',
  delivery: 'the material delivery',
  payApp: 'the fixed pay application',
  punch: 'the punch items fixed',
  closeout: 'their closeout papers',
}

/** Ask for the renewed certificate this many days before the policy runs out. */
export const INSURANCE_ASK_DAYS = 30

export function tradePromisesOf(state: GcState): TradePromise[] {
  return state.tradePromises ?? []
}

/** Where a promise stands, the way a quote date does (gcFollowUp's `PromiseState`). */
export function tradePromiseState(p: TradePromise, today: string): { state: PromiseState; days: number } {
  if (p.keptOn) {
    const late = daysUntil(p.keptOn, p.by)
    return { state: late <= 0 ? 'kept' : 'late', days: Math.max(0, late) }
  }
  const until = daysUntil(p.by, today)
  return { state: until > 0 ? 'pending' : until === 0 ? 'today' : 'passed', days: Math.abs(until) }
}

/** "Promised the renewed insurance certificate by Fri Oct 9. That was 2 days ago." */
export function tradePromiseWords(p: TradePromise, today: string): string {
  const { state, days } = tradePromiseState(p, today)
  const day = weekdayDate(p.by)
  const n = `${days} ${days === 1 ? 'day' : 'days'}`
  if (state === 'kept') return `Kept their word: ${p.what} came by ${day}.`
  if (state === 'late') return `${capital(p.what)} came ${n} after their ${day}.`
  if (state === 'pending') return `Promised ${p.what} by ${day}, in ${n}.`
  if (state === 'today') return `Promised ${p.what} today.`
  return `Promised ${p.what} by ${day}. That was ${n} ago.`
}

function capital(words: string): string {
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** The open promise for the same thing: same company, kind, job and trade. */
export function openPromiseFor(
  state: GcState,
  match: { partnerId: string; kind: PromiseKind; projectId?: string; packageId?: string },
): TradePromise | undefined {
  return tradePromisesOf(state).find(
    (p) =>
      !p.keptOn &&
      p.partnerId === match.partnerId &&
      p.kind === match.kind &&
      (p.projectId ?? null) === (match.projectId ?? null) &&
      (p.packageId ?? null) === (match.packageId ?? null),
  )
}

/**
 * How often a company's other promises held, for its word record: one kept by its day counts made
 * and kept; one that came late, or whose day passed, counts made only. A day they moved before it
 * came does not count.
 */
export function tradePromiseRecord(state: GcState, partner: Partner): { made: number; kept: number } {
  let made = 0
  let kept = 0
  for (const p of tradePromisesOf(state)) {
    if (p.partnerId !== partner.id) continue
    for (const old of p.moved ?? []) if (daysUntil(old.on, old.by) > 0) made += 1
    const { state: s } = tradePromiseState(p, state.today)
    if (s === 'kept') {
      made += 1
      kept += 1
    } else if (s === 'late' || s === 'passed') made += 1
  }
  return { made, kept }
}

/** A company whose insurance runs out within `INSURANCE_ASK_DAYS` (or ran out), and the days left. */
export interface InsuranceRenewal {
  partner: Partner
  expires: string
  /** Negative: it ran out that many days ago. */
  days: number
  /** The date they gave for the new certificate, if they gave one. */
  promise: TradePromise | undefined
}

/** Every renewal to chase, the soonest (or longest gone) first. A declined company is left out. */
export function insuranceRenewals(state: GcState): InsuranceRenewal[] {
  const out: InsuranceRenewal[] = []
  for (const partner of state.partners) {
    if (!partner.coiExpires || partner.vetting?.status === 'declined') continue
    const days = daysUntil(partner.coiExpires, state.today)
    if (days > INSURANCE_ASK_DAYS) continue
    out.push({ partner, expires: partner.coiExpires, days, promise: openPromiseFor(state, { partnerId: partner.id, kind: 'insurance' }) })
  }
  return out.sort((a, b) => a.days - b.days)
}

/** "Their insurance runs out Tue Oct 20, in 16 days." · "Their insurance ran out Sep 30." */
export function insuranceRenewalWords(r: InsuranceRenewal): string {
  if (r.days < 0) return `Their insurance ran out ${shortDate(r.expires)}. Nothing they do for us is covered.`
  if (r.days === 0) return 'Their insurance runs out today.'
  return `Their insurance runs out ${weekdayDate(r.expires)}, in ${r.days} ${r.days === 1 ? 'day' : 'days'}.`
}

/** What a move keeps: the open promises it settles. Each lane adds its own moves here. */
export function promisesKeptBy(state: GcState, action: GcAction): { partnerId: string; kind: PromiseKind; projectId?: string; packageId?: string }[] {
  switch (action.type) {
    // Board's kinds.
    case 'tradeUploadCoi':
      return [{ partnerId: action.partnerId, kind: 'insurance' }]
    case 'tradeSignW9':
      return [{ partnerId: action.partnerId, kind: 'w9' }]
    case 'tradeSignSow': {
      const pkg = state.projects.find((p) => p.id === action.projectId)?.packages.find((k) => k.id === action.packageId)
      const partnerId = pkg?.invites.find((i) => i.id === pkg.awardedInviteId)?.partnerId
      return partnerId ? [{ partnerId, kind: 'sow', projectId: action.projectId, packageId: action.packageId }] : []
    }
    default:
      return []
  }
}

/** Marks kept, today, every open promise a move settled. The same state back when none did. */
export function keepPromisesOn(state: GcState, matches: ReturnType<typeof promisesKeptBy>): GcState {
  if (matches.length === 0 || !state.tradePromises) return state
  const ids = new Set(matches.map((m) => openPromiseFor(state, m)?.id).filter((id): id is string => Boolean(id)))
  if (ids.size === 0) return state
  return { ...state, tradePromises: state.tradePromises.map((p) => (ids.has(p.id) ? { ...p, keptOn: state.today } : p)) }
}

/** The partner a promise is with, for the words around it. */
export function promisePartner(state: GcState, p: TradePromise): Partner | undefined {
  return partnerById(state, p.partnerId)
}
