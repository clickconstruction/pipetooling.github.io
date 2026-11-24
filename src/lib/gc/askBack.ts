/**
 * An ask's Take the ask back press (v2.8440): the way back from an ask made on the wrong company, or on a test trade.
 * It shows beside **Will not do it** and **Cannot do it** only on an ask the company has not heard about: not opened,
 * no quote, no contact logged, not awarded. That ask is deleted, and the company reads as never asked, which is true.
 * An ask they did hear about shows no press and closes with its own two, in the company's words, as the bench's
 * Remove leaves a company with history to them. The server function `gc_take_ask_back` holds the same rule over the
 * rows the screen does not carry (an email that went, a statement of work) and refuses in words, so a stale row
 * never deletes an ask the company opened a minute ago. Pure; the write is `takeGcAskBack` in gcIo.
 */
import type { Invite, TradePackage } from './types'

/** Why the ask shows no press: the first thing that stands on it or that the company heard, in words. Null: nothing, the press shows. */
export function askBackHold(invite: Invite, pkg: Pick<TradePackage, 'awardedInviteId'>): string | null {
  if (pkg.awardedInviteId === invite.id) return 'The trade is awarded to them.'
  if (invite.bid !== null || invite.status === 'bid') return 'They sent a quote.'
  if (invite.status === 'declined') return 'They already passed on it.'
  if (invite.status === 'opened' || invite.seenRev !== null) return 'They opened it in their portal.'
  if ((invite.contacts?.length ?? 0) > 0) return 'A contact with them is logged on it.'
  return null
}

/** The press shows on an ask the company has not heard about. */
export function canTakeAskBack(invite: Invite, pkg: Pick<TradePackage, 'awardedInviteId'>): boolean {
  return askBackHold(invite, pkg) === null
}

export const ASK_BACK_PRESS = 'Take the ask back…'
export const ASK_BACK_CONFIRM = 'Take the ask back'
export const ASK_BACK_PRESS_TITLE = 'They have not opened it, quoted or heard from us about it. Press to take the ask back.'

/** The confirm window's words: why it may go, what goes, and that they can be asked again. */
export function askBackConfirmWords(company: string, trade: string): { title: string; message: string; confirmLabel: string } {
  return {
    title: `Take the ${trade} ask back from ${company}?`,
    message: `${company} has not opened this ask, sent a quote or heard from us about it. The ask is deleted, and they read as never asked on ${trade}. You can ask them again.`,
    confirmLabel: ASK_BACK_CONFIRM,
  }
}

/** The fallback when the write fails with no reason of its own. */
export const ASK_BACK_FAILED = 'The ask did not come back.'
