/**
 * GC mode, the schedule builder's Templates page (punch list #204, PR 3): the page's reads and writes on
 * `gc_schedule_templates`, apart from one job's schedule (`scheduleIo.ts` reads the templates with it for the
 * Templates card and the pick). A save goes through `gc_schedule_template_save` (migration 20261028180000), one
 * press that writes a new row or a new version and marks the one it replaced.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { TemplatesIo } from '../../components/gc/GcTemplatesPage'
import { supabase } from '../supabase'
import { checkSupabaseError, type SupabaseResultError } from '../../utils/errorHandling'
import { templateDraftOf, templateSaveBody, type TemplateSaveBody } from './schedule/templateEditor'
import { templateShape, templateSaveProblem, cleanTemplateName, templateNameProblem, TEMPLATE_NAME_TAKEN } from './schedule/templates'
import { templatesFromRows } from './schedule/rows'
import type { ScheduleTemplate } from './schedule/types'
import type { GcState } from './types'

const GONE = 'That template is gone. Reload to see the templates kept.'

/** What a read or write came back with, or its problem thrown in plain words (as `scheduleIo.ts` reads a job's). */
function taken<T>(result: { data: T | null; error: SupabaseResultError | null; status?: number }, operation: string): T {
  checkSupabaseError(result, operation)
  return result.data
}

/** Every row of a table whose key is in `ids`, read a hundred ids at a time. None: no read. */
async function rowsIn<T>(ids: string[], read: (chunk: string[]) => PromiseLike<{ data: T[] | null; error: SupabaseResultError | null; status?: number }>, operation: string): Promise<T[]> {
  const out: T[] = []
  for (let i = 0; i < ids.length; i += 100) out.push(...taken(await read(ids.slice(i, i + 100)), operation))
  return out
}

/** A write that changes one row by its key: refused in plain words when the row is gone. */
function changedOne(result: { data: { id?: string }[] | null; error: SupabaseResultError | null; status?: number }, operation: string, gone = GONE): void {
  checkSupabaseError(result, operation)
  if (result.data.length === 0) throw new Error(gone)
}

/** A template's name the table refused: a second person saved the same name at the same moment. */
function nameTaken(error: SupabaseResultError | null): boolean {
  return error?.code === '23505' && error.message.includes('gc_schedule_templates_name_once')
}

/** Every template the signed-in person may read, oldest first, with who saved each. */
export async function loadScheduleTemplates(): Promise<ScheduleTemplate[]> {
  const rows = taken(await supabase.from('gc_schedule_templates').select('*'), 'load the templates')
  const people = [...new Set(rows.flatMap((t) => (t.saved_by ? [t.saved_by] : [])))]
  const named = await rowsIn(people, (c) => supabase.from('users').select('id, name').in('id', c), 'load the names')
  return templatesFromRows(rows, new Map(named.map((u) => [u.id, u.name ?? ''])))
}

/** A template saved as a new row, or a new version of `versionOf` (call 2). Returns the new id. */
export async function saveTemplateBody(body: TemplateSaveBody, versionOf: string | null): Promise<string> {
  // Untyped until the types are regenerated after the migration's push (the types PR that follows #204 PR 2).
  const client = supabase as unknown as SupabaseClient
  const result = await client.rpc('gc_schedule_template_save', { p_template: body, p_version_of: versionOf })
  if (nameTaken(result.error)) throw new Error(TEMPLATE_NAME_TAKEN)
  const id: unknown = taken(result, 'save the template')
  if (typeof id !== 'string') throw new Error('The template did not save.')
  return id
}

/** A job's schedule saved as a template with its rows (From a job's schedule, and the job's Templates card): `templateSaveProblem` first. Returns the new id. */
export async function saveTemplateFromJob(state: GcState, projectId: string, name: string): Promise<string> {
  const project = state.projects.find((p) => p.id === projectId)
  if (!project) throw new Error('No project with that id.')
  const problem = templateSaveProblem(state, project, name)
  const shape = templateShape(state, project)
  if (problem || !shape) throw new Error(problem ?? 'Draw the schedule first.')
  const draft = templateDraftOf({ name: cleanTemplateName(name), lines: shape.lines, phases: shape.phases, rows: shape.rows, workingDays: shape.workingDays })
  return saveTemplateBody(templateSaveBody(draft, state.today, shape), null)
}

/** A template's new name. The jobs drawn from it keep the name they were drawn with. */
export async function renameTemplate(state: GcState, templateId: string, name: string): Promise<void> {
  const problem = templateNameProblem(state, name, templateId)
  if (problem) throw new Error(problem)
  const result = await supabase.from('gc_schedule_templates').update({ name: cleanTemplateName(name) }).eq('id', templateId).select('id')
  if (nameTaken(result.error)) throw new Error(TEMPLATE_NAME_TAKEN)
  changedOne(result, 'rename the template')
}

/** A template set aside, so it is not offered, or brought back. */
export async function setTemplateAside(state: GcState, templateId: string, aside: boolean): Promise<void> {
  changedOne(
    await supabase.from('gc_schedule_templates').update({ aside_on: aside ? state.today : null }).eq('id', templateId).select('id'),
    aside ? 'set the template aside' : 'bring the template back',
    GONE,
  )
}

/** The page's io on the live tables. */
export function templatesIo(state: GcState): TemplatesIo {
  return {
    load: loadScheduleTemplates,
    save: saveTemplateBody,
    saveFromJob: saveTemplateFromJob,
    rename: (templateId, name) => renameTemplate(state, templateId, name),
    setAside: (templateId, aside) => setTemplateAside(state, templateId, aside),
  }
}
