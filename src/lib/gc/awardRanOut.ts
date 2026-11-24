/**
 * Compare quotes' award on a number that ran out. The table marks it in *Their number holds*, some rows above the
 * press, and the press itself said nothing: the 2026-11-24 walk awarded a quote seventeen days past its day with no
 * word about it. So the press says it where it is pressed, and asks first. It does not stop the award. The office
 * may have the trade's word that the number still holds, and **Take the award back…** undoes a draft. Pure.
 */
import { bidGoodUntil, bidRanOut } from './portal'
import type { SubBid } from './types'
import { shortDate } from './words'

export const AWARD_RAN_OUT_CONFIRM = 'Award on this number'

/** The line under the award press: the day the number ran out. Null while it holds, or when they gave no day. */
export function awardRanOutLine(bid: SubBid | null, today: string): string | null {
  if (!bid || !bidRanOut(bid, today)) return null
  const until = bidGoodUntil(bid)
  return until ? `Their number ran out ${shortDate(until)}. Ask them whether it still holds.` : null
}

/** The window that asks before an award on a number that ran out. Null: the number holds, and the press awards. */
export function awardRanOutConfirmWords(trade: string, company: string, bid: SubBid | null, today: string): { title: string; message: string; confirmLabel: string } | null {
  if (!bid || !bidRanOut(bid, today)) return null
  const until = bidGoodUntil(bid)
  if (!until) return null
  return {
    title: `Award ${trade} to ${company} on a number that ran out?`,
    message: `${company} held this number until ${shortDate(until)}. They may not do the work for it now. Ask them whether it still holds. The award drafts the statement of work at this number.`,
    confirmLabel: AWARD_RAN_OUT_CONFIRM,
  }
}
