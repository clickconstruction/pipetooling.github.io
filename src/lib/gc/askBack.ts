/**
 * An ask's Take the ask back press (v2.8440, v2.8490): the way back from an ask made on the wrong company, or on a
 * test trade. It shows beside **Will not do it** and **Cannot do it** on every ask still open: no quote, not awarded,
 * not closed. What it does turns on what the company heard, and the confirm window says which before the press:
 *
 * - they heard nothing (not opened, no contact logged): the ask is deleted, and the company reads as never asked,
 *   which is true;
 * - they opened it or heard from us (v2.8490): the ask is kept and closes as *we took it back*. That is our answer,
 *   never theirs, so their record counts no pass and their portal says we took it back.
 *
 * The server function `gc_take_ask_back` holds the same rule over the rows the screen does not carry (an email that
 * went, a statement of work), so a stale row never deletes an ask the company opened a minute ago: it closes it
 * instead. Pure; the write is `takeGcAskBack` in gcIo.
 */
import type { Invite, TradePackage } from './types'

/** Why the ask shows no press: what stands on it, or that it is closed already, in words. Null: nothing, the press shows. */
export function askBackHold(invite: Invite, pkg: Pick<TradePackage, 'awardedInviteId'>): string | null {
  if (pkg.awardedInviteId === invite.id) return 'The trade is awarded to them.'
  if (invite.bid !== null || invite.status === 'bid') return 'They sent a quote.'
  if (invite.status === 'declined') return invite.declinedWhy === 'withdrawn' ? 'We already took it back.' : 'They already passed on it.'
  return null
}

/**
 * What the company heard about the ask, as the end of a sentence about them. Null: nothing the screen knows of, and
 * the ask is deleted. The server also reads the emails that went.
 */
export function askHeard(invite: Invite): string | null {
  if (invite.status === 'opened' || invite.seenRev !== null) return 'opened this ask in their portal'
  if ((invite.contacts?.length ?? 0) > 0) return 'heard from us about this ask'
  return null
}

/** The press shows on an ask still open with nothing standing on it. */
export function canTakeAskBack(invite: Invite, pkg: Pick<TradePackage, 'awardedInviteId'>): boolean {
  return askBackHold(invite, pkg) === null
}

export const ASK_BACK_PRESS = 'Take the ask back…'
export const ASK_BACK_CONFIRM = 'Take the ask back'
export const ASK_BACK_PRESS_TITLE = 'They have not opened it, quoted or heard from us about it. Press to take the ask back.'
export const ASK_BACK_HEARD_TITLE = 'They heard about this ask and have not quoted. Press to close it as we took it back.'

/** The press's hover: which of the two the press does. */
export function askBackPressTitle(invite: Invite): string {
  return askHeard(invite) ? ASK_BACK_HEARD_TITLE : ASK_BACK_PRESS_TITLE
}

/**
 * The confirm window's words. With nothing heard: why it may go, what goes, and that they can be asked again. With
 * `heard` (from `askHeard`): what they heard, that the ask is kept and closes as ours, what their portal says, that no
 * email goes, and that a closed ask stays closed.
 */
export function askBackConfirmWords(company: string, trade: string, heard: string | null = null): { title: string; message: string; confirmLabel: string } {
  const message = heard
    ? `${company} ${heard}. So the ask is kept, and it closes as we took it back. Their portal says we took it back, and no email goes to them. A closed ask does not open again.`
    : `${company} has not opened this ask, sent a quote or heard from us about it. The ask is deleted, and they read as never asked on ${trade}. You can ask them again.`
  return { title: `Take the ${trade} ask back from ${company}?`, message, confirmLabel: ASK_BACK_CONFIRM }
}

/** The fallback when the write fails with no reason of its own. */
export const ASK_BACK_FAILED = 'The ask did not come back.'
