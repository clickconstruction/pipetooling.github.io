/**
 * Permits, the second look (punch list #302): the pure rules behind a second pair of eyes on what
 * someone else passed. Which passed permits wait on one, the deck they make, the line that says
 * who passed and why, the verdict each answer writes, and the words of the caught-up state.
 * A second look is one look: a permit two people passed leaves every second look. No React, no Supabase.
 */
import { rowsAboveFloor, type PermitVerdict, type ResearchPermitRow, type ValueFloor } from './permitResearch'
import { placeOf } from './permitBuilders'
import { PASS_REASONS, bestFirst, daysBetween, skimScore, type PassReasonCode, type SkimAnswer, type SkimCard, type SkimContext } from './permitSkim'

/** The reason code a second pass is written with: `sl_` and the reason, `sl_none` with none picked. */
export const SECOND_LOOK_CODE_PREFIX = 'sl_'

export function isSecondLookCode(code: string | null | undefined): boolean {
  return (code ?? '').startsWith(SECOND_LOOK_CODE_PREFIX)
}

/**
 * Does this permit wait on a second look by `me`? It was passed on the skim or from the ledger, by
 * someone else, nobody has looked a second time, and the feed has not paired it with a plumbing
 * permit. A permit dropped after a closer look (Not pursuing) already had its closer look.
 */
export function waitsOnSecondLook(row: ResearchPermitRow, me: string): boolean {
  const p = placeOf(row)
  return p.place === 'closed' && p.why === 'passed' && row.verdict_by !== me && !isSecondLookCode(row.verdict_reason_code)
}

/** The second-look deck: what someone else passed, above the value floor, in the skim's own order. */
export function secondLookDeck(rows: readonly ResearchPermitRow[], ctx: SkimContext, floor: ValueFloor, me: string): SkimCard[] {
  return rowsAboveFloor(rows, floor)
    .filter((r) => waitsOnSecondLook(r, me))
    .map((r) => skimScore(r, ctx))
    .sort(bestFirst)
}

export function secondLookCount(rows: readonly ResearchPermitRow[], floor: ValueFloor, me: string): number {
  return rowsAboveFloor(rows, floor).filter((r) => waitsOnSecondLook(r, me)).length
}

/** The words every pass from the skim is kept with when no reason was tapped. They say nothing a reader needs twice. */
const PLAIN_PASS_WORDS = /^passed on the skim\.?$/i

/** Why the first person passed, short: the one-tap reason, else what they typed, else null. */
export function firstPassReason(row: Pick<ResearchPermitRow, 'verdict_reason' | 'verdict_reason_code'>): string | null {
  const tapped = PASS_REASONS.find((r) => r.code === row.verdict_reason_code)
  if (tapped) return tapped.words.toLowerCase()
  const typed = (row.verdict_reason ?? '').replace(/\s+/g, ' ').trim()
  return typed === '' || PLAIN_PASS_WORDS.test(typed) ? null : typed
}

/** The line over a second-look card: "Passed by Sam, yesterday: too far". */
export function passedByWords(row: Pick<ResearchPermitRow, 'verdict_by_name' | 'verdict_at' | 'verdict_reason' | 'verdict_reason_code'>, todayYmd: string): string {
  const days = daysBetween(row.verdict_at ? row.verdict_at.slice(0, 10) : null, todayYmd)
  const when = days == null ? '' : days <= 0 ? ', today' : days === 1 ? ', yesterday' : `, ${days} days ago`
  const why = firstPassReason(row)
  return `Passed by ${row.verdict_by_name ?? 'someone'}${when}${why ? `: ${why}` : ''}`
}

/**
 * The verdict a second look writes. Keep is the ledger's `look`, so the permit goes to Kept under
 * the second person's name. Pass stays `not_for_us` with an `sl_` code, which is what takes the
 * permit off every second look.
 */
export function secondLookVerdict(answer: SkimAnswer, reasonCode: PassReasonCode | null, firstBy: string | null): { verdict: PermitVerdict; reason: string; reasonCode: string | null } {
  if (answer === 'keep') return { verdict: 'look', reason: `Kept on a second look, after ${firstBy ?? 'someone'} passed.`, reasonCode: null }
  const reason = PASS_REASONS.find((r) => r.code === reasonCode)
  return {
    verdict: 'not_for_us',
    reason: reason ? `Passed on a second look: ${reason.words.toLowerCase()}.` : 'Passed on a second look.',
    reasonCode: `${SECOND_LOOK_CODE_PREFIX}${reasonCode ?? 'none'}`,
  }
}

/** What the bar under the next card says after an answer. */
export function secondLookAnsweredWords(answer: SkimAnswer): string {
  return answer === 'keep' ? 'Kept for a closer look.' : 'Passed again. Why?'
}

/** The caught-up state's second line. */
export function secondLookCaughtUpWords(kept: number, passed: number): string {
  const n = kept + passed
  return n === 0 ? 'Every permit someone else passed has had a second look.' : `You answered ${n} just now: ${kept} kept, ${passed} passed again.`
}
