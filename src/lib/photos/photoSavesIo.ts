/**
 * Messages, cut 10 (photos saved on arrival): the job's tick, read and pressed as the signed-in user. `photo_saves` is the
 * office team's to read; `set_photo_save` turns a job's tick on or off and stamps who and when (migration
 * `20261014070000_photo_saves.sql`). The `photo-save` sweep reads the same rows to copy the photos.
 */
import { supabase } from '../supabase'
import type { Database } from '../../types/database'
import { checkSupabaseError } from '../../utils/errorHandling'
import { photoSaveArgs, photoSaveColumn } from './photoTick'

/**
 * The generated types read each uuid argument as required, but the function takes exactly one job: the other two go
 * as null, which it checks (22023).
 */
type SetPhotoSaveArgs = Database['public']['Functions']['set_photo_save']['Args']

/** The function's own refusals: who may not press (42501) and a press it cannot read (22023). Its words are the toast. */
const REFUSALS = new Set(['42501', '22023'])

/** A job's tick: on since when, or null while it is off. No row is off, as every job starts. */
export async function loadPhotoSave(jobKey: string): Promise<string | null> {
  const at = photoSaveColumn(jobKey)
  if (!at) return null
  const result = await supabase.from('photo_saves').select('on_since').eq(at.column, at.id).maybeSingle()
  checkSupabaseError(result, 'load the job’s photo setting')
  return result.data?.on_since ?? null
}

/** Turn a job's tick on or off. Answers on since when, or null once it is off. */
export async function setPhotoSave(jobKey: string, on: boolean): Promise<string | null> {
  const args = photoSaveArgs(jobKey)
  if (!args) throw new Error('This message is not tied to a job.')
  const result = await supabase.rpc('set_photo_save', { ...args, p_on: on } as unknown as SetPhotoSaveArgs)
  if (result.error && REFUSALS.has(result.error.code ?? '')) throw new Error(result.error.message)
  checkSupabaseError(result, 'change the job’s photo setting')
  return result.data ?? null
}
