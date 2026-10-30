/**
 * A checklist per stage (punch list #164): the reads and writes behind the office's editor and the crew's sheet, over
 * `stage_checklist_templates` and `stage_checklist_answers` (migration `20261029210000_stage_checklists.sql`). The
 * rules are `stageChecklist.ts` and `stageChecklistEditor.ts`; the screens take an io so their tests run over a fake.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { checkSupabaseError } from '../../utils/errorHandling'
import { isStageChecklistKind, type StageChecklistKind, type StageChecklistQuestion } from './stageChecklist'
import { planIsEmpty, planQuestionSave, type QuestionDraft } from './stageChecklistEditor'

// The tables are younger than the generated types; the types PR after the push removes this cast.
const db = supabase as unknown as SupabaseClient

type TemplateRow = { id: string; stage_kind: string; sort_order: number; words: string; asks_photo: boolean }

/** The live questions, every kind, as the kernel takes them. */
export function questionsFromRows(rows: readonly TemplateRow[]): StageChecklistQuestion[] {
  return rows.flatMap((r) => (isStageChecklistKind(r.stage_kind) ? [{ id: r.id, kind: r.stage_kind, order: Number(r.sort_order) || 0, words: r.words, asksPhoto: r.asks_photo === true }] : []))
}

export async function loadQuestions(): Promise<StageChecklistQuestion[]> {
  const result = await db.from('stage_checklist_templates').select('id, stage_kind, sort_order, words, asks_photo').is('retired_at', null).order('stage_kind').order('sort_order')
  checkSupabaseError(result, 'read the stage checklists')
  return questionsFromRows((result.data ?? []) as TemplateRow[])
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
