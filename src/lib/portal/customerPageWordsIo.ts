/**
 * Messages, cut 8d: Settings → What customers see → Customer page, its reads and writes. The words
 * (`customer_page_words`) and the three switches per job on `gc_projects` (`portal_photos_on`, `portal_forecast_on`,
 * `portal_spanish_on`) come from migration 20261012130000 and are the office team's. The generated types gain them
 * with the next regen, so they are named `as never` until then.
 */
import { checkSupabaseError, withSupabaseRetry, type SupabaseClientResult } from '../../utils/errorHandling'
import { supabase } from '../supabase'
import type { SavedWord } from './customerPageWordsEdit'

/** One read, retried, its rows as the written-out type. */
async function rows<T>(op: string, run: () => PromiseLike<unknown>): Promise<T[]> {
  const data = await withSupabaseRetry(run as () => PromiseLike<SupabaseClientResult<unknown>>, op)
  return (data ?? []) as T[]
}

type WordRow = { key: string; en: string; es: string; edited_by: string | null; edited_at: string | null }

const WORD_COLUMNS = 'key, en, es, edited_by, edited_at'

/** The names of whoever changed a sentence. A read the viewer may not make leaves the names out rather than failing. */
async function namesOf(ids: readonly (string | null)[]): Promise<Map<string, string>> {
  const want = [...new Set(ids.filter((id): id is string => !!id))]
  if (!want.length) return new Map()
  try {
    const users = await rows<{ id: string; name: string | null }>('load who changed them', () => supabase.from('users').select('id, name').in('id', want))
    return new Map(users.flatMap((u) => (u.name ? [[u.id, u.name] as const] : [])))
  } catch {
    return new Map()
  }
}

const savedOf = (w: WordRow, names: Map<string, string>): SavedWord => ({
  key: w.key,
  en: w.en,
  es: w.es,
  editedAt: w.edited_at,
  editedBy: w.edited_by ? names.get(w.edited_by) ?? null : null,
})

/** Every sentence the table holds, with who changed it. */
export async function loadSavedWords(): Promise<SavedWord[]> {
  const words = await rows<WordRow>('load the customer page words', () => supabase.from('customer_page_words' as never).select(WORD_COLUMNS))
  const names = await namesOf(words.map((w) => w.edited_by))
  return words.map((w) => savedOf(w, names))
}

/** Change one sentence in both languages. The table stamps who and when, and refuses a change that drops a blank. */
export async function saveWord(key: string, en: string, es: string): Promise<SavedWord> {
  const res = await supabase
    .from('customer_page_words' as never)
    .update({ en: en.trim(), es: es.trim() } as never)
    .eq('key', key)
    .select(WORD_COLUMNS)
  checkSupabaseError(res, 'save the sentence')
  const row = ((res.data ?? []) as unknown as WordRow[])[0]
  if (!row) throw new Error('That sentence did not change. Only the office team can change it.')
  return savedOf(row, await namesOf([row.edited_by]))
}

/** A job on a customer's portal, with its three switches. */
export interface PortalSwitchJob {
  projectId: string
  name: string
  stage: string
  photos: boolean
  forecast: boolean
  spanish: boolean
}

export type PortalSwitch = 'photos' | 'forecast' | 'spanish'

const SWITCH_COLUMN: Readonly<Record<PortalSwitch, string>> = { photos: 'portal_photos_on', forecast: 'portal_forecast_on', spanish: 'portal_spanish_on' }

/** The stages of a job we won, which a customer's portal shows (`_shared/gcPortal.ts`). */
const ON_THE_PORTAL = ['buyout', 'building', 'closed']

type SwitchRow = { project_id: string; stage: string; portal_photos_on: boolean; portal_forecast_on: boolean; portal_spanish_on: boolean }

/** Every job on a customer's portal with its switches, by name. */
export async function loadPortalSwitchJobs(): Promise<PortalSwitchJob[]> {
  const gc = await rows<SwitchRow>('load the jobs’ switches', () =>
    supabase.from('gc_projects' as never).select('project_id, stage, portal_photos_on, portal_forecast_on, portal_spanish_on').in('stage', ON_THE_PORTAL),
  )
  const ids = gc.map((g) => g.project_id)
  const names = ids.length ? await rows<{ id: string; name: string | null }>('load the jobs’ names', () => supabase.from('projects').select('id, name').in('id', ids)) : []
  const nameOf = new Map(names.map((p) => [p.id, p.name ?? '']))
  return gc
    .map((g) => ({
      projectId: g.project_id,
      name: nameOf.get(g.project_id) || 'A job with no name',
      stage: g.stage,
      photos: g.portal_photos_on === true,
      forecast: g.portal_forecast_on === true,
      spanish: g.portal_spanish_on === true,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** Turn one switch on one job on or off. */
export async function setPortalSwitch(projectId: string, which: PortalSwitch, on: boolean): Promise<void> {
  const res = await supabase
    .from('gc_projects' as never)
    .update({ [SWITCH_COLUMN[which]]: on } as never)
    .eq('project_id', projectId)
    .select('project_id')
  checkSupabaseError(res, 'change the switch')
  if (!((res.data ?? []) as unknown[]).length) throw new Error('That job did not change. Only the office team can change it.')
}
