/**
 * Try-out loop, PR 2 (to-dos/helper-tryout-loop): the leader's verdict card.
 *
 * When a trial helper's day on a job ends, everyone who could run that job that day is asked one
 * thing, by name: take them again? The feed is `trial_helpers_i_led_today()` — the Supervision
 * rule read off the schedule and the clock (`crewSupervisors`), nothing assigned. One answer per
 * card, leader and day (`team_prospect_trial_verdicts`), changeable until the card leaves.
 *
 * Pure: no React, no supabase.
 */
import { supervisedJobLabel } from '../people/supervisedDays'
import type { LedgerPrefixMap } from '../ledgerDisplayPrefixes'
import { trialVerdictQuestion } from '../../../supabase/functions/_shared/trialVerdictPush'

export { TRIAL_VERDICT_DEEP_LINK, trialVerdictPush, trialVerdictQuestion } from '../../../supabase/functions/_shared/trialVerdictPush'

/** What a leader can say. `skipped` is stored so a dismissed card is not dealt again. */
export type TrialVerdict = 'yes' | 'no' | 'unsure' | 'skipped'

export const TRIAL_VERDICT_CHOICES: readonly { verdict: Exclude<TrialVerdict, 'skipped'>; label: string }[] = [
  { verdict: 'yes', label: 'Yes' },
  { verdict: 'no', label: 'No' },
  { verdict: 'unsure', label: 'Not sure' },
]

export const TRIAL_NOTE_MAX = 280

/** One row of `trial_helpers_i_led_today()`. */
export type TrialVerdictFeedRow = {
  prospect_id: string
  helper_user_id: string
  helper_name: string | null
  work_date: string
  job_id: string | null
  hcp_number: string | null
  click_number: string | null
  job_name: string | null
  customer_name: string | null
  trial_day: number | null
  verdict: TrialVerdict | null
  note: string | null
}

export type TrialVerdictCard = {
  /** Stable per card and day — one leader answers each (card, day) once. */
  key: string
  prospectId: string
  helperUserId: string
  helperName: string
  workDate: string
  jobId: string | null
  /** "J258 · Oak St", or null when the day had no job to name. */
  jobLabel: string | null
  isToday: boolean
  /** "Trial helper · day 4 · with you" */
  eyebrow: string
  /** "worked with you today at J258 · Oak St" */
  contextLine: string
  /** "Take Bryan again?" */
  question: string
  verdict: TrialVerdict | null
  note: string
  /** Answered yes / no / not sure. A skip is not an answer, but it does clear the card. */
  answered: boolean
}

export function buildTrialVerdictCards(payload: readonly TrialVerdictFeedRow[] | null | undefined, opts: { todayYmd: string; prefixMap?: LedgerPrefixMap }): TrialVerdictCard[] {
  const rows = Array.isArray(payload) ? payload : []
  return rows
    .filter((r) => r && r.prospect_id && r.work_date)
    .map((r) => {
      const helperName = (r.helper_name ?? '').trim() || 'Your helper'
      const jobLabel = r.job_id ? supervisedJobLabel({ hcp_number: r.hcp_number, click_number: r.click_number, job_name: r.job_name, customer_name: r.customer_name }, opts.prefixMap) : null
      const isToday = r.work_date === opts.todayYmd
      const day = typeof r.trial_day === 'number' && r.trial_day > 0 ? ` · day ${r.trial_day}` : ''
      return {
        key: `${r.prospect_id}:${r.work_date}`,
        prospectId: r.prospect_id,
        helperUserId: r.helper_user_id,
        helperName,
        workDate: r.work_date,
        jobId: r.job_id,
        jobLabel,
        isToday,
        eyebrow: `Trial helper${day} · with you`,
        contextLine: `worked with you ${isToday ? 'today' : 'yesterday'}${jobLabel ? ` at ${jobLabel}` : ''}`,
        question: trialVerdictQuestion(r.helper_name),
        verdict: r.verdict ?? null,
        note: r.note ?? '',
        answered: r.verdict === 'yes' || r.verdict === 'no' || r.verdict === 'unsure',
      }
    })
    .sort((a, b) => (a.workDate === b.workDate ? a.helperName.localeCompare(b.helperName) : b.workDate.localeCompare(a.workDate)))
}

/** Cards still waiting on this leader: no row at all. A skipped or answered card is not dealt again. */
export function pendingTrialCards(cards: readonly TrialVerdictCard[]): TrialVerdictCard[] {
  return cards.filter((c) => c.verdict == null)
}

/** Cards worth showing on the Dashboard: the pending ones, and today's answers (changeable). Skips stay gone. */
export function dashboardTrialCards(cards: readonly TrialVerdictCard[]): TrialVerdictCard[] {
  return cards.filter((c) => c.verdict == null || (c.answered && c.isToday))
}

/** The row to upsert on (prospect_id, leader_user_id, work_date). */
export function trialVerdictRow(card: Pick<TrialVerdictCard, 'prospectId' | 'jobId' | 'workDate'>, leaderUserId: string, verdict: TrialVerdict, note: string) {
  const trimmed = note.trim().slice(0, TRIAL_NOTE_MAX)
  return {
    prospect_id: card.prospectId,
    leader_user_id: leaderUserId,
    job_ledger_id: card.jobId,
    work_date: card.workDate,
    verdict,
    // A skip carries no word: nothing was said.
    note: verdict === 'skipped' ? null : trimmed || null,
  }
}

/** "You said yes · "careful, a bit slow"" — the answered card's one line. */
export function trialAnswerLine(card: Pick<TrialVerdictCard, 'verdict' | 'note'>): string | null {
  const said = card.verdict === 'yes' ? 'yes' : card.verdict === 'no' ? 'no' : card.verdict === 'unsure' ? 'not sure' : null
  if (!said) return null
  const note = card.note.trim()
  return `You said ${said}${note ? ` · “${note}”` : ''}`
}
