/**
 * Compare quotes' Take the award back press (v2.8434): the way back from an award made on the wrong company, or on
 * a test trade. The press shows beside **Awarded** for a reader who can award. It is dead once the statement of work
 * was sent or signed, with the reason on it. The server function `gc_take_award_back` holds the whole rule and
 * refuses in words: a statement of work that left draft, and every record that can stand on one or on the award (a
 * pay application, a back charge, a change, a paper, a submittal, the company's RFI or its promise). So a stale
 * screen never deletes a statement of work that went out a minute ago. Pure; the write is `takeGcAwardBack` in gcIo.
 */
import type { TradePackage } from './types'
import { money } from './words'

export const AWARD_BACK_PRESS = 'Take the award back…'
export const AWARD_BACK_CONFIRM = 'Take the award back'
export const AWARD_BACK_PRESS_TITLE = 'The statement of work is still a draft. Press to take the award back.'

/**
 * Why the press is dead: the statement of work left draft. Null: it is a draft, or there is none, and the press is
 * live. What else may be in the way is the server's to find and say.
 */
export function awardBackHold(pkg: Pick<TradePackage, 'sow'>): string | null {
  if (pkg.sow?.status === 'signed') return 'They signed the statement of work. A signed one changes through Change orders.'
  if (pkg.sow?.status === 'sent') return 'The statement of work went to them to sign. Nothing takes a sent one back yet.'
  return null
}

/** The press shows on an awarded trade, for a reader who can award. Dead or live is `awardBackHold`'s. */
export function showsAwardBack(pkg: Pick<TradePackage, 'awardedInviteId'>, canAward: boolean): boolean {
  return canAward && pkg.awardedInviteId !== null
}

/** The confirm window's words: what goes, what stays, and what the company may have seen. */
export function awardBackConfirmWords(trade: string, company: string, pkg: Pick<TradePackage, 'sow'>): { title: string; message: string; confirmLabel: string } {
  const sow = pkg.sow
  const goes = sow ? `The award comes off, and the drafted statement of work for ${money(sow.price)} is deleted.` : 'The award comes off.'
  return {
    title: `Take the ${trade} award back from ${company}?`,
    message: `${goes} Their quote and the ask stay, and ${trade} can be awarded again. If ${company} opened their portal since the award, it told them they got the job.`,
    confirmLabel: AWARD_BACK_CONFIRM,
  }
}

/** The fallback when the write fails with no reason of its own. */
export const AWARD_BACK_FAILED = 'The award did not come back.'
