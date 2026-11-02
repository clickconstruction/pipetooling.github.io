/**
 * A checklist per stage (punch list #164): the reads and writes behind the office's editor and the crew's sheet, over
 * `stage_checklist_templates` and `stage_checklist_answers` (migration `20261029210000_stage_checklists.sql`). The
 * rules are `stageChecklist.ts` and `stageChecklistEditor.ts`; the screens take an io so their tests run over a fake.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { checkSupabaseError } from '../../utils/errorHandling'
import { fetchAllRowsChunkedIn } from '../supabasePaging'
import { isStageChecklistKind, type StageChecklistKind, type StageChecklistQuestion } from './stageChecklist'
import { TAKE_OFF_WORDS, cleanItemWords } from './stageChecklistItems'
import { planIsEmpty, planQuestionSave, type QuestionDraft } from './stageChecklistEditor'

// The tables are younger than the generated types; the types PR after the push removes this cast.
const db = supabase as unknown as SupabaseClient

/** A question row as the table keeps it; the job columns (#237, migration 20261102050000) are null on the company's rows. */
export type TemplateRow = {
  id: string
  stage_kind: string
  sort_order: number
  words: string
  asks_photo: boolean
  job_id?: string | null
  fixture_id?: string | null
  created_by?: string | null
  created_by_name?: string | null
  created_at?: string | null
}

const TEMPLATE_COLS = 'id, stage_kind, sort_order, words, asks_photo, job_id, fixture_id, created_by, created_by_name, created_at'

/** The live questions, every kind, as the kernel takes them. */
export function questionsFromRows(rows: readonly TemplateRow[]): StageChecklistQuestion[] {
  return rows.flatMap((r) =>
    isStageChecklistKind(r.stage_kind)
      ? [
          {
            id: r.id,
            kind: r.stage_kind,
            order: Number(r.sort_order) || 0,
            words: r.words,
            asksPhoto: r.asks_photo === true,
            fixtureId: r.fixture_id ?? null,
            addedById: r.created_by ?? null,
            addedBy: r.created_by_name ?? '',
            addedAt: r.created_at ?? null,
          },
        ]
      : [],
  )
}

/** The company's live questions, every kind: the editor's and the board's read. */
export async function loadQuestions(): Promise<StageChecklistQuestion[]> {
  const result = await db.from('stage_checklist_templates').select(TEMPLATE_COLS).is('retired_at', null).is('job_id', null).order('stage_kind').order('sort_order')
  checkSupabaseError(result, 'read the stage checklists')
  return questionsFromRows((result.data ?? []) as TemplateRow[])
}

/** The company's live questions and the items added for one job's stages (#237): the sheet's and the read-out's read. */
export async function loadQuestionsForJob(jobId: string): Promise<StageChecklistQuestion[]> {
  const result = await db.from('stage_checklist_templates').select(TEMPLATE_COLS).is('retired_at', null).or(`job_id.is.null,job_id.eq.${jobId}`).order('stage_kind').order('sort_order').order('created_at')
  checkSupabaseError(result, 'read the stage checklists')
  return questionsFromRows((result.data ?? []) as TemplateRow[])
}

/** The live items added on a set of jobs (the board's read, chunked); none for an empty set. */
export async function loadJobItems(jobIds: readonly string[]): Promise<StageChecklistQuestion[]> {
  if (jobIds.length === 0) return []
  const rows = await fetchAllRowsChunkedIn<TemplateRow, string>(
    [...jobIds],
    (chunk, from, to) => db.from('stage_checklist_templates').select(TEMPLATE_COLS).is('retired_at', null).in('job_id', chunk).order('id').range(from, to),
    'stageChecklistIo.jobItems',
  )
  return questionsFromRows(rows)
}

export interface AddJobItemInput {
  jobId: string
  fixtureId: string
  kind: StageChecklistKind
  words: string
  asksPhoto: boolean
}

/** One check added for a job's stage, by the office or the job's superintendent; the database refuses anyone else with its reason. */
export async function addJobItem(input: AddJobItemInput, who: { userId: string | null; name: string }): Promise<StageChecklistQuestion> {
  const result = await db
    .from('stage_checklist_templates')
    .insert({ stage_kind: input.kind, sort_order: 0, words: cleanItemWords(input.words).slice(0, 200), asks_photo: input.asksPhoto, job_id: input.jobId, fixture_id: input.fixtureId, created_by: who.userId, created_by_name: who.name.slice(0, 120) })
    .select(TEMPLATE_COLS)
    .single()
  checkSupabaseError(result, 'add the check')
  const [q] = questionsFromRows([result.data as TemplateRow])
  if (!q) throw new Error('The check was added with a stage kind the app does not read.')
  return q
}

/** A job item taken off: retired, never deleted, so an answer it already has keeps its words. */
export async function retireJobItem(itemId: string, who: { userId: string | null }): Promise<void> {
  const now = new Date().toISOString()
  const result = await db.from('stage_checklist_templates').update({ retired_at: now, retired_by: who.userId, updated_at: now }).eq('id', itemId).not('job_id', 'is', null).select('id')
  checkSupabaseError(result, 'take the check off')
  // The database's rule filters a write it refuses: no error and no row. That is a refusal, not a save.
  if ((result.data ?? []).length === 0) throw new Error(TAKE_OFF_WORDS.refused)
}

/** The editor's io: the live questions, and a kind's drafts written as the plan says. */
export interface StageChecklistEditorIo {
  load: () => Promise<StageChecklistQuestion[]>
  save: (kind: StageChecklistKind, before: readonly StageChecklistQuestion[], drafts: readonly QuestionDraft[], byUserId: string | null) => Promise<void>
}

export async function saveQuestions(kind: StageChecklistKind, before: readonly StageChecklistQuestion[], drafts: readonly QuestionDraft[], byUserId: string | null): Promise<void> {
  const plan = planQuestionSave(kind, before, drafts)
  if (planIsEmpty(plan)) return
  const now = new Date().toISOString()
  // The rows taken off first, then the changed, then the new: a half-done save leaves the list readable either way.
  if (plan.retires.length) {
    const result = await db.from('stage_checklist_templates').update({ retired_at: now, updated_at: now }).in('id', plan.retires)
    checkSupabaseError(result, 'take the questions off')
  }
  for (const u of plan.updates) {
    const result = await db.from('stage_checklist_templates').update({ sort_order: u.order, words: u.words, asks_photo: u.asksPhoto, updated_at: now }).eq('id', u.id)
    checkSupabaseError(result, 'save the question')
  }
  if (plan.inserts.length) {
    const result = await db
      .from('stage_checklist_templates')
      .insert(plan.inserts.map((i) => ({ stage_kind: i.kind, sort_order: i.order, words: i.words, asks_photo: i.asksPhoto, created_by: byUserId })))
    checkSupabaseError(result, 'add the questions')
  }
}

export function supabaseStageChecklistEditorIo(): StageChecklistEditorIo {
  return { load: loadQuestions, save: saveQuestions }
}
