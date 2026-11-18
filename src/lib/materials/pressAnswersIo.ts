/**
 * Answers to a press (`job_movement_answers`, `20261118170000_on_site_press_answers.sql`): the reads the
 * By person look draws them from, and the two writes a dev makes. The office reads; anyone else gets no
 * row, and the look then draws as it did before. Each call throws the database's own error, for the
 * caller to word.
 */
import { supabase } from '../supabase'
import { movementOf, type MovementRow } from './onSiteStore'
import type { Movement } from './onSite'
import type { PressAnswer } from './sitePersonActs'

export type SiteAnswers = { answers: PressAnswer[]; takenBack: Movement[] }
export type SiteAnswersReader = (jobIds: ReadonlyArray<string>) => Promise<SiteAnswers>

type AnswerRow = { id: string; movement_id: string; answer: 'taken_back' | 'marked'; why: string; by_name: string; at: string }

// The generated types learn the table and the function at the regeneration after the push.
const table = () => supabase.from('job_movement_answers' as never)

/** How many live answers one read takes. Answers are rare: a site with more than this has a different problem. */
export const ANSWERS_READ_LIMIT = 1000

/** The live answers, newest first, and the ledger rows taken back on the jobs asked for. */
export const fetchSiteAnswers: SiteAnswersReader = async (jobIds) => {
  const ids = [...new Set(jobIds)]
  if (ids.length === 0) return { answers: [], takenBack: [] }
  const [live, rows] = await Promise.all([
    table().select('id, movement_id, answer, why, by_name, at').is('withdrawn_at', null).order('at', { ascending: false }).limit(ANSWERS_READ_LIMIT),
    supabase.rpc('on_site_taken_back_rows' as never, { p_job_ids: ids } as never),
  ])
  if (live.error) throw live.error
  if (rows.error) throw rows.error
  return {
    answers: ((live.data ?? []) as unknown as AnswerRow[]).map((r) => ({ id: r.id, movementId: r.movement_id, answer: r.answer, why: r.why, byName: r.by_name ?? '', at: r.at })),
    takenBack: ((rows.data ?? []) as unknown as MovementRow[]).map(movementOf),
  }
}

/** Give one answer to one press. The database stamps who and when. */
export async function giveAnswer(movementId: string, answer: 'taken_back' | 'marked', why: string): Promise<void> {
  const { error } = await table().insert({ movement_id: movementId, answer, why: why.trim() } as never)
  if (error) throw error
}

/** Withdraw an answer, with its reason: a press taken back stands again, a mark comes off. */
export async function withdrawAnswer(answerId: string, why: string): Promise<void> {
  const { data, error } = await table().update({ withdrawn_at: new Date().toISOString(), withdrawn_why: why.trim() } as never).eq('id', answerId).select('id')
  if (error) throw error
  if (((data ?? []) as unknown[]).length === 0) throw new Error('The answer was not changed. Only a dev withdraws one.')
}
