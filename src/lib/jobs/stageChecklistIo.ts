/**
 * A checklist per stage (punch list #164): the reads and writes behind the office's editor and the crew's sheet, over
 * `stage_checklist_templates` and `stage_checklist_answers` (migration `20261029210000_stage_checklists.sql`). The
 * rules are `stageChecklist.ts` and `stageChecklistEditor.ts`; the screens take an io so their tests run over a fake.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { checkSupabaseError } from '../../utils/errorHandling'
import { fetchAllRowsChunkedIn } from '../supabasePaging'
import { isStageChecklistKind, withSkips, type StageChecklistKind, type StageChecklistQuestion, type StageChecklistSkip } from './stageChecklist'
import { ITEM_WHY_MAX_CHARS, PLAN_SHEET_MAX_CHARS, PUT_BACK_REFUSED, SKIP_WHY_MAX_CHARS, TAKE_OFF_WORDS, cleanItemWords, cleanShortLine } from './stageChecklistItems'
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
  /** The plan sheet and the why (#237 PR 1b, migration 20261102084500). */
  plan_sheet?: string | null
  why?: string | null
  /** Whoever answers signs (#237 PR 2, migration 20261106040000). */
  needs_signature?: boolean | null
}

const TEMPLATE_COLS = 'id, stage_kind, sort_order, words, asks_photo, needs_signature, job_id, fixture_id, created_by, created_by_name, created_at, plan_sheet, why'

/** A skip row as the table keeps it (#237 PR 1b). */
export type SkipRow = {
  id: string
  fixture_id: string
  question_id: string
  why: string
  skipped_by?: string | null
  skipped_by_name?: string | null
  skipped_at?: string | null
}

const SKIP_COLS = 'id, fixture_id, question_id, why, skipped_by, skipped_by_name, skipped_at'

/** A live skip with the question it leaves off. */
export type QuestionSkip = StageChecklistSkip & { questionId: string }

export function skipsFromRows(rows: readonly SkipRow[]): QuestionSkip[] {
  return rows.map((r) => ({ id: r.id, fixtureId: r.fixture_id, questionId: r.question_id, why: r.why, by: r.skipped_by_name ?? '', byId: r.skipped_by ?? null, at: r.skipped_at ?? null }))
}

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
            needsSignature: r.needs_signature === true,
            fixtureId: r.fixture_id ?? null,
            addedById: r.created_by ?? null,
            addedBy: r.created_by_name ?? '',
            addedAt: r.created_at ?? null,
            sheet: r.plan_sheet ?? null,
            why: r.why ?? null,
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

/**
 * The company's live questions and the items added for one job's stages (#237), each company question carrying where
 * it is skipped on this job (PR 1b): the sheet's, the read-out's and the field report's chips' read.
 */
export async function loadQuestionsForJob(jobId: string): Promise<StageChecklistQuestion[]> {
  const [result, skips] = await Promise.all([
    db.from('stage_checklist_templates').select(TEMPLATE_COLS).is('retired_at', null).or(`job_id.is.null,job_id.eq.${jobId}`).order('stage_kind').order('sort_order').order('created_at'),
    db.from('stage_checklist_skips').select(SKIP_COLS).eq('job_id', jobId).is('put_back_at', null),
  ])
  checkSupabaseError(result, 'read the stage checklists')
  checkSupabaseError(skips, 'read skip list')
  return withSkips(questionsFromRows((result.data ?? []) as TemplateRow[]), skipsFromRows((skips.data ?? []) as SkipRow[]))
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

/** The live skips on a set of jobs (the board's read, chunked); none for an empty set. */
export async function loadJobSkips(jobIds: readonly string[]): Promise<QuestionSkip[]> {
  if (jobIds.length === 0) return []
  const rows = await fetchAllRowsChunkedIn<SkipRow, string>(
    [...jobIds],
    (chunk, from, to) => db.from('stage_checklist_skips').select(SKIP_COLS).is('put_back_at', null).in('job_id', chunk).order('id').range(from, to),
    'stageChecklistIo.jobSkips',
  )
  return skipsFromRows(rows)
}

export interface AddJobItemInput {
  jobId: string
  fixtureId: string
  kind: StageChecklistKind
  words: string
  asksPhoto: boolean
  /** Whoever answers signs (#237 PR 2). */
  needsSignature?: boolean
  /** Its place among the stage's own checks (`nextItemOrder`). */
  order?: number
  /** The plan sheet it comes from, as typed. */
  sheet?: string | null
  /** Why it is here, as typed. */
  why?: string | null
}

/** One check added for a job's stage, by whoever authors on the job; the database refuses anyone else with its reason. */
export async function addJobItem(input: AddJobItemInput, who: { userId: string | null; name: string }): Promise<StageChecklistQuestion> {
  const result = await db
    .from('stage_checklist_templates')
    .insert({
      stage_kind: input.kind,
      sort_order: input.order ?? 0,
      words: cleanItemWords(input.words).slice(0, 200),
      asks_photo: input.asksPhoto,
      needs_signature: input.needsSignature === true,
      plan_sheet: cleanShortLine(input.sheet, PLAN_SHEET_MAX_CHARS),
      why: cleanShortLine(input.why, ITEM_WHY_MAX_CHARS),
      job_id: input.jobId,
      fixture_id: input.fixtureId,
      created_by: who.userId,
      created_by_name: who.name.slice(0, 120),
    })
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

/** The database's answer to who authors on this job (`stage_checklist_may_author`); a failed read draws no press, never a refusal. */
export async function mayAuthorOnJob(jobId: string): Promise<boolean> {
  const result = await db.rpc('stage_checklist_may_author', { p_job_id: jobId })
  return !result.error && result.data === true
}

export interface SkipQuestionInput {
  jobId: string
  fixtureId: string
  questionId: string
  why: string
}

/** A company question left off one job's stage, with who and why. Another press that skipped it first reads as this one. */
export async function skipQuestion(input: SkipQuestionInput, who: { userId: string | null; name: string }): Promise<QuestionSkip> {
  const result = await db
    .from('stage_checklist_skips')
    .insert({ job_id: input.jobId, fixture_id: input.fixtureId, question_id: input.questionId, why: cleanShortLine(input.why, SKIP_WHY_MAX_CHARS) ?? '', skipped_by: who.userId, skipped_by_name: who.name.slice(0, 120) })
    .select(SKIP_COLS)
    .single()
  if (result.error?.code === '23505') {
    const again = await db.from('stage_checklist_skips').select(SKIP_COLS).eq('fixture_id', input.fixtureId).eq('question_id', input.questionId).is('put_back_at', null).single()
    checkSupabaseError(again, 'read skip list')
    return skipsFromRows([again.data as SkipRow])[0]!
  }
  checkSupabaseError(result, 'skip the question')
  return skipsFromRows([result.data as SkipRow])[0]!
}

/** A skipped question put back: the row closes and stays, so the record of the skip stands. */
export async function putBackQuestion(skipId: string, who: { userId: string | null }): Promise<void> {
  const result = await db.from('stage_checklist_skips').update({ put_back_at: new Date().toISOString(), put_back_by: who.userId }).eq('id', skipId).is('put_back_at', null).select('id')
  checkSupabaseError(result, 'put the question back')
  // The database's rule filters a write it refuses: no error and no row. That is a refusal, not a save.
  if ((result.data ?? []).length === 0) throw new Error(PUT_BACK_REFUSED)
}

/** A stage's own checks in the order given, in one transaction; the database refuses anyone who may not author on the job. */
export async function reorderJobItems(fixtureId: string, ids: readonly string[]): Promise<void> {
  const result = await db.rpc('reorder_stage_checklist_items', { p_fixture_id: fixtureId, p_item_ids: [...ids] })
  checkSupabaseError(result, 'move the check')
}

/**
 * One job item added to the company's list, the office alone, in one transaction: a company row with its words and its
 * photo ask, the job's row retired, the job's answer moved to the company's row. Returns the company's row.
 */
export async function promoteJobItem(itemId: string): Promise<StageChecklistQuestion> {
  const result = await db.rpc('promote_stage_checklist_item', { p_item_id: itemId })
  checkSupabaseError(result, "add the check to the company's list")
  const [q] = questionsFromRows([result.data as TemplateRow])
  if (!q) throw new Error('The check was added with a stage kind the app does not read.')
  return q
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
    const result = await db.from('stage_checklist_templates').update({ sort_order: u.order, words: u.words, asks_photo: u.asksPhoto, needs_signature: u.needsSignature, updated_at: now }).eq('id', u.id)
    checkSupabaseError(result, 'save the question')
  }
  if (plan.inserts.length) {
    const result = await db
      .from('stage_checklist_templates')
      .insert(plan.inserts.map((i) => ({ stage_kind: i.kind, sort_order: i.order, words: i.words, asks_photo: i.asksPhoto, needs_signature: i.needsSignature, created_by: byUserId })))
    checkSupabaseError(result, 'add the questions')
  }
}

export function supabaseStageChecklistEditorIo(): StageChecklistEditorIo {
  return { load: loadQuestions, save: saveQuestions }
}
