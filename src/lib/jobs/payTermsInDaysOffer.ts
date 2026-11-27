/**
 * Whether the pay calendar window offers terms in days to someone setting a calendar (punch list #341, call 4).
 *
 * PR 5 of that card built terms that are a number of days after the bill, before the owner's call on whether
 * any contract pays that way. The answer of 2026-11-25: none does, and the choice can be hidden until a
 * contract needs it. Hidden, not taken out: everything PR 5 built still reads, shows and saves such terms.
 *
 * This lives apart from `payCalendar.ts` on purpose. That kernel is copied to the edge
 * (`supabase/functions/_shared/gcKernels`), so a change to it makes every function that reads the copy read
 * as behind until it is deployed. The offer is a choice about two windows and three lines of words, and no
 * edge function reads it.
 */

/** Off since v2.8714. Turn this on to bring the choice back; nothing else has to change. */
export const PAY_CALENDAR_DAYS_AFTER_OFFERED = false

/**
 * True when the fields draw the *How they pay* choice: it is offered, or the terms on the form are in days
 * or were while the fields were open. So terms already in days are never stuck out of sight, and a switch
 * to a set day can be switched back.
 */
export function showsHowTheyPay({ days, hadDays, offered = PAY_CALENDAR_DAYS_AFTER_OFFERED }: { days: boolean; hadDays: boolean; offered?: boolean }): boolean {
  return offered || days || hadDays
}

/** The kinds of terms a pay calendar holds, as the lines that introduce it say them: the second kind is named only where it can be picked. */
export function payTermsKindsWords(offered: boolean = PAY_CALENDAR_DAYS_AFTER_OFFERED): string {
  return offered ? 'a set day of the month, or a number of days after the bill' : 'a set day of the month'
}

/** The words the edge-copied kernel ends its hover lines with when it names the second kind. */
const DAYS_AFTER_TAIL = ', or a number of days after the bill'

/**
 * A hover line the kernel wrote (`jobPayCalendarWords`), as it reads while the choice is hidden: the second
 * kind is taken off its end. The kernel keeps its own words, since it is copied to the edge.
 */
export function payTermsTitleAsOffered(title: string, offered: boolean = PAY_CALENDAR_DAYS_AFTER_OFFERED): string {
  return offered ? title : title.replace(DAYS_AFTER_TAIL, '')
}
