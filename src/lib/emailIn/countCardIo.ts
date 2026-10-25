/**
 * Quickfill's Email station (punch list #159, v2.5824): the two cards' reads and writes (`countCard.ts` holds the
 * rules). The three settings are `app_settings` rows the owner and a dev may update (`master_or_dev_update_email_count`);
 * the list is `email_box_watch`, which they insert and delete and a person updates their own row of. The tables are not
 * in the generated types until the types pass that follows the migration, so the reads are cast. One interface per
 * card, so each smoke hands it a fake.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { checkSupabaseError, type SupabaseResultError } from '../../utils/errorHandling'
import { APP_SETTINGS_KEY_EMAIL_COUNT_LEAD_V1, APP_SETTINGS_KEY_EMAIL_COUNT_LIMIT_DAYS_V1, APP_SETTINGS_KEY_EMAIL_COUNT_ON_V1 } from '../appSettingsKeys'
import { GC_OFFICE_TEAM } from '../gc/access'
import { supabase } from '../supabase'
import { COUNT_NOT_SAVED, countIsOn, limitDaysFrom, MY_MAIL_NOT_SAVED, type CountPerson, type WatchView } from './countCard'
import { cleanLabels } from './countedBoxes'

const WATCH_SELECT = 'id, user_id, address, labels, is_on, labels_state, last_ok_at, last_error, created_at, added_by'
const OFFICE_ROLES = [...GC_OFFICE_TEAM] as Database['public']['Tables']['users']['Row']['role'][]

type Rows<T> = PromiseLike<{ data: T[] | null; error: SupabaseResultError | null }>
type Row<T> = PromiseLike<{ data: T | null; error: SupabaseResultError | null }>

export interface EmailCountIo {
  load(): Promise<{ on: boolean; leadId: string | null; limitDays: number; rows: WatchView[]; people: CountPerson[] }>
  setOn(on: boolean): Promise<void>
  setLead(userId: string | null): Promise<void>
  setLimit(days: number): Promise<void>
  addShared(address: string): Promise<WatchView>
  addPerson(person: CountPerson): Promise<WatchView>
  remove(watchId: string): Promise<void>
  setRowOn(watchId: string, on: boolean): Promise<void>
  setLabels(watchId: string, labels: readonly string[]): Promise<void>
}

export interface MyMailIo {
  load(userId: string): Promise<{ row: WatchView | null; limitDays: number; leadName: string | null; addedBy: string | null }>
  setOn(watchId: string, on: boolean): Promise<void>
  setLabels(watchId: string, labels: readonly string[]): Promise<void>
}

const KEYS = [APP_SETTINGS_KEY_EMAIL_COUNT_ON_V1, APP_SETTINGS_KEY_EMAIL_COUNT_LEAD_V1, APP_SETTINGS_KEY_EMAIL_COUNT_LIMIT_DAYS_V1]

async function readSettings(client: SupabaseClient<Database>): Promise<{ on: boolean; leadId: string | null; limitDays: number }> {
  const result = await client.from('app_settings').select('key, value_text').in('key', KEYS)
  checkSupabaseError(result, 'read what the app counts')
  const value = (key: string) => result.data.find((r) => r.key === key)?.value_text ?? null
  const lead = (value(APP_SETTINGS_KEY_EMAIL_COUNT_LEAD_V1) ?? '').trim()
  return { on: countIsOn(value(APP_SETTINGS_KEY_EMAIL_COUNT_ON_V1)), leadId: lead || null, limitDays: limitDaysFrom(value(APP_SETTINGS_KEY_EMAIL_COUNT_LIMIT_DAYS_V1)) }
}

async function writeSetting(client: SupabaseClient<Database>, key: string, value: string, what: string, refused: string): Promise<void> {
  const result = await client.from('app_settings').update({ value_text: value }).eq('key', key).select('key')
  checkSupabaseError(result, what)
  if (result.data.length === 0) throw new Error(refused)
}

const watch = (client: SupabaseClient<Database>) => client.from('email_box_watch' as never)

async function updateRow(client: SupabaseClient<Database>, watchId: string, fields: Record<string, unknown>, what: string, refused: string): Promise<void> {
  const result = await (watch(client).update(fields as never).eq('id', watchId).select('id') as unknown as Rows<{ id: string }>)
  checkSupabaseError(result, what)
  if ((result.data ?? []).length === 0) throw new Error(refused)
}

export function supabaseEmailCountIo(client: SupabaseClient<Database> = supabase): EmailCountIo {
  return {
    async load() {
      const [settings, rows, users] = await Promise.all([
        readSettings(client),
        watch(client).select(WATCH_SELECT).order('created_at', { ascending: true }) as unknown as Rows<WatchView>,
        client.from('users').select('id, name, email').in('role', OFFICE_ROLES).is('archived_at', null).eq('is_digital_twin', false).eq('is_sample', false).eq('is_walk_tester', false).order('name'),
      ])
      checkSupabaseError(rows, 'read the boxes the app counts')
      checkSupabaseError(users, 'read the office team')
      return { ...settings, rows: rows.data ?? [], people: users.data.map((u) => ({ id: u.id, name: (u.name ?? '').trim() || u.email, email: u.email })) }
    },
    setOn: (on) => writeSetting(client, APP_SETTINGS_KEY_EMAIL_COUNT_ON_V1, on ? 'true' : 'false', 'turn counting mail on or off', COUNT_NOT_SAVED),
    setLead: (userId) => writeSetting(client, APP_SETTINGS_KEY_EMAIL_COUNT_LEAD_V1, userId ?? '', 'name who sees everyone’s rows', COUNT_NOT_SAVED),
    setLimit: (days) => writeSetting(client, APP_SETTINGS_KEY_EMAIL_COUNT_LIMIT_DAYS_V1, String(days), 'save the limit', COUNT_NOT_SAVED),
    async addShared(address) {
      const me = (await client.auth.getUser()).data.user?.id ?? null
      const result = await (watch(client).insert({ user_id: null, address, added_by: me } as never).select(WATCH_SELECT).single() as unknown as Row<WatchView>)
      checkSupabaseError(result, 'add the box')
      if (!result.data) throw new Error(COUNT_NOT_SAVED)
      return result.data
    },
    async addPerson(person) {
      const me = (await client.auth.getUser()).data.user?.id ?? null
      const address = (person.email ?? '').trim().toLowerCase()
      const result = await (watch(client).insert({ user_id: person.id, address, added_by: me } as never).select(WATCH_SELECT).single() as unknown as Row<WatchView>)
      checkSupabaseError(result, `add ${person.name}`)
      if (!result.data) throw new Error(COUNT_NOT_SAVED)
      return result.data
    },
    async remove(watchId) {
      const result = await (watch(client).delete().eq('id', watchId).select('id') as unknown as Rows<{ id: string }>)
      checkSupabaseError(result, 'stop counting the box')
      if ((result.data ?? []).length === 0) throw new Error(COUNT_NOT_SAVED)
    },
    setRowOn: (watchId, on) => updateRow(client, watchId, { is_on: on }, 'switch the box', COUNT_NOT_SAVED),
    setLabels: (watchId, labels) => updateRow(client, watchId, { labels: cleanLabels(labels) }, 'save the labels', COUNT_NOT_SAVED),
  }
}

export function supabaseMyMailIo(client: SupabaseClient<Database> = supabase): MyMailIo {
  return {
    async load(userId) {
      const [settings, mine] = await Promise.all([readSettings(client), watch(client).select(WATCH_SELECT).eq('user_id', userId).maybeSingle() as unknown as Row<WatchView>])
      checkSupabaseError(mine, 'read whether your mail is counted')
      const row = mine.data ?? null
      const ids = [settings.leadId, row?.added_by].filter((id): id is string => !!id)
      let names = new Map<string, string>()
      if (ids.length) {
        const users = await client.from('users').select('id, name').in('id', ids)
        if (!users.error) names = new Map(users.data.map((u) => [u.id, (u.name ?? '').trim()]))
      }
      return {
        row,
        limitDays: settings.limitDays,
        leadName: settings.leadId ? names.get(settings.leadId) || null : null,
        addedBy: row?.added_by ? names.get(row.added_by) || null : null,
      }
    },
    setOn: (watchId, on) => updateRow(client, watchId, { is_on: on }, 'switch your mail', MY_MAIL_NOT_SAVED),
    setLabels: (watchId, labels) => updateRow(client, watchId, { labels: cleanLabels(labels) }, 'save your labels', MY_MAIL_NOT_SAVED),
  }
}
