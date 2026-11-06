import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { APP_SETTINGS_KEY_FIELD_DISPATCH_PHONE, APP_SETTINGS_KEY_OFFICE_ADDRESS_V1 } from '../appSettingsKeys'
import { formatErrorMessage } from '../../utils/errorHandling'
import { awayDraftFromRow, awayOfficeFromSettings, parseMyAwayNote, type AwayNoteDraft, type AwayNoteRow, type AwayOffice, type MyAwayNote } from './awayNote'

/**
 * The reads and writes behind the Away note (punch list #256 PR 8, v2.6587). The office reads the row under RLS and
 * writes it through the `away-note` edge function, since a note on an archived login opens the sign-in and taking it
 * down closes it again. The person reads theirs through `my_away_note()`, the one RPC the seal lets an archived caller
 * reach. `away_notes` and the RPC are not in the generated types until the push and the types PR, so the names are
 * cast here (the `crew_day_email_requests` precedent).
 */

async function fnError(e: unknown): Promise<string> {
  if (e instanceof FunctionsHttpError && e.context) {
    try {
      const b = (await e.context.json()) as { error?: string } | null
      if (b?.error) return b.error
    } catch {
      /* fall through */
    }
  }
  return formatErrorMessage(e, 'That did not save')
}

/** The office's view of one person's note, or null for none. */
export async function loadAwayNote(userId: string): Promise<{ draft: AwayNoteDraft; row: AwayNoteRow | null }> {
  const { data, error } = await supabase
    .from('away_notes' as never)
    .select('user_id, words, countdown_ymd, show_where, show_call, alert_on_day, updated_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw new Error(formatErrorMessage(error, 'Could not read the note'))
  const row = (data as unknown as AwayNoteRow | null) ?? null
  return { draft: awayDraftFromRow(row), row }
}

/** The screen's office for the preview: Settings → Office address and the dispatch phone, read as the office. */
export async function loadAwayOffice(): Promise<AwayOffice> {
  const { data, error } = await supabase.from('app_settings').select('key, value_text').in('key', [APP_SETTINGS_KEY_OFFICE_ADDRESS_V1, APP_SETTINGS_KEY_FIELD_DISPATCH_PHONE])
  if (error) throw new Error(formatErrorMessage(error, 'Could not read the office settings'))
  const rows = (data ?? []) as Array<{ key: string; value_text: string | null }>
  const address = rows.find((r) => r.key === APP_SETTINGS_KEY_OFFICE_ADDRESS_V1)?.value_text ?? null
  const phone = rows.find((r) => r.key === APP_SETTINGS_KEY_FIELD_DISPATCH_PHONE)?.value_text ?? null
  return awayOfficeFromSettings(address, phone)
}

export type AwayNoteSaved = { sealed: boolean }

/** Save the note through the function; `sealed` says their sign-in now opens to it. */
export async function saveAwayNote(userId: string, draft: AwayNoteDraft): Promise<AwayNoteSaved> {
  try {
    const { data, error } = await supabase.functions.invoke('away-note', {
      body: { action: 'save', user_id: userId, note: { words: draft.words, countdown_ymd: draft.countdownYmd, show_where: draft.showWhere, show_call: draft.showCall, alert_on_day: draft.alertOnDay } },
    })
    if (error) throw error
    const answer = data as { error?: string; sealed?: boolean } | null
    if (answer?.error) throw new Error(answer.error)
    return { sealed: answer?.sealed === true }
  } catch (e) {
    throw new Error(await fnError(e))
  }
}

/** Take the note down; an archived login is banned again. */
export async function clearAwayNote(userId: string): Promise<void> {
  try {
    const { data, error } = await supabase.functions.invoke('away-note', { body: { action: 'clear', user_id: userId } })
    if (error) throw error
    const answer = data as { error?: string } | null
    if (answer?.error) throw new Error(answer.error)
  } catch (e) {
    throw new Error(await fnError(e))
  }
}

/** The signed-in archived person's own note, or null when there is none for them. Throws on a failed read. */
export async function loadMyAwayNote(): Promise<MyAwayNote | null> {
  const { data, error } = await supabase.rpc('my_away_note' as never)
  if (error) throw error
  return parseMyAwayNote(data)
}
