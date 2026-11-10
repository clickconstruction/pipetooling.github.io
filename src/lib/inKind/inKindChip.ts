/**
 * The chip beside a customer's name (punch list #301, mock-up 2): where a customer stands on paying in kind, in a
 * few words. One chip says one of three things: a month's credit is due, so much is still to come on the bills, or
 * more was given than is billed and we owe work. It is quiet unless a month is waiting on a person.
 *
 * A customer's open balance splits in two with it: the part an open deal pays, which nobody chases, and the money.
 */
import { money2, monthName } from './inKindLedger'
import type { InKindListRow } from './inKindList'
import { usd } from './inKindWords'

const CENT = 0.005

export interface InKindStanding {
  customerId: string
  /** The customer's open deals, the one with a month due first. */
  arrangementIds: string[]
  /** Still open on the deals' bills. */
  left: number
  /** Given beyond what is billed: work we owe. */
  ahead: number
  paidInKind: number
  /** The oldest month with no credit entered, YYYY-MM-01. */
  dueMonth: string | null
  dueCount: number
}

/** Each customer with an open deal. An ended deal gives no standing. */
export function inKindStandings(rows: readonly InKindListRow[]): Map<string, InKindStanding> {
  const out = new Map<string, InKindStanding>()
  for (const r of rows) {
    if (r.ended || !r.customerId) continue
    const s = out.get(r.customerId) ?? { customerId: r.customerId, arrangementIds: [], left: 0, ahead: 0, paidInKind: 0, dueMonth: null, dueCount: 0 }
    if (r.dueMonth) s.arrangementIds.unshift(r.id)
    else s.arrangementIds.push(r.id)
    s.left = money2(s.left + r.left)
    s.ahead = money2(s.ahead + r.ahead)
    s.paidInKind = money2(s.paidInKind + r.paidInKind)
    s.dueCount += r.dueCount
    if (r.dueMonth && (!s.dueMonth || r.dueMonth < s.dueMonth)) s.dueMonth = r.dueMonth
    out.set(r.customerId, s)
  }
  return out
}

export type InKindChipTone = 'quiet' | 'due'
export type InKindChipForm = 'full' | 'short'

/** The chip's words. The short form is for a phone and for a job, where the amount is not the subject. */
export function inKindChipWords(s: InKindStanding, form: InKindChipForm = 'full'): { text: string; tone: InKindChipTone } {
  const tone: InKindChipTone = s.dueCount > 0 ? 'due' : 'quiet'
  if (form === 'short') return { text: 'In kind', tone }
  if (s.dueCount > 1) return { text: `In kind · ${s.dueCount} months due`, tone }
  if (s.dueMonth) return { text: `In kind · ${monthName(s.dueMonth)} due`, tone }
  if (s.left > CENT) return { text: `In kind · ${usd(s.left)} to come`, tone }
  if (s.ahead > CENT) return { text: `In kind · we owe ${usd(s.ahead)} of work`, tone }
  return { text: 'In kind', tone }
}

/** What the chip says to a screen reader and on hover. */
export function inKindChipTitle(s: InKindStanding): string {
  const parts = ['Pays in kind.']
  if (s.dueCount > 1) parts.push(`${s.dueCount} months have no credit entered.`)
  else if (s.dueMonth) parts.push(`${monthName(s.dueMonth)}’s credit is not entered.`)
  if (s.left > CENT) parts.push(`${usd(s.left)} is still to come on its bills.`)
  if (s.ahead > CENT) parts.push(`We owe ${usd(s.ahead)} of work.`)
  parts.push('Opens the ledger.')
  return parts.join(' ')
}

/** The ledger of the deal that needs a person first. */
export const inKindChipHref = (s: InKindStanding): string => `/customers/${s.customerId}?inKind=${s.arrangementIds[0] ?? ''}`

/** An open balance split in two: what an open deal pays in kind, and the money still owed. */
export function moneyApart(openBalance: number, s: InKindStanding | null | undefined): { money: number; inKind: number } {
  const open = Math.max(0, openBalance)
  const inKind = s ? money2(Math.min(open, Math.max(0, s.left))) : 0
  return { money: money2(open - inKind), inKind }
}

/** The line under a total that leaves the in kind part out. Null when nothing is scheduled in kind. */
export const scheduledInKindWords = (inKind: number): string | null => (inKind > CENT ? `${usd(inKind)} more is scheduled in kind` : null)
