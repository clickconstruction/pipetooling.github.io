/**
 * Quickfill's Email station (punch list #159, v2.5827): the station's reads, and Read again. The rows are what the
 * policies let the viewer see (`email_box_can_see`): the shared boxes, their own, and everyone's for the lead. The
 * threads are read a page at a time (PostgREST stops at 1,000 rows), the open ones and the ones gone in the last two
 * weeks, which is what "since the last look" needs. Read again asks `gmail-count` to sweep each box now; the function
 * keeps a one-minute floor. The tables are not in the generated types until the types pass that follows the migration,
 * so the reads are cast. One interface, so the station's smoke hands it a fake.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { checkSupabaseError, type SupabaseResultError } from '../../utils/errorHandling'
import { APP_SETTINGS_KEY_EMAIL_COUNT_LEAD_V1, APP_SETTINGS_KEY_EMAIL_COUNT_LIMIT_DAYS_V1, APP_SETTINGS_KEY_EMAIL_COUNT_ON_V1 } from '../appSettingsKeys'
import { countIsOn, limitDaysFrom, type WatchView } from '../emailIn/countCard'
import { supabase } from '../supabase'
import type { StationThreadRow } from './emailStation'

const WATCH_SELECT = 'id, user_id, address, labels, is_on, labels_state, last_ok_at, last_error, created_at, added_by'
const THREAD_SELECT = 'watch_id, gmail_thread_id, label_name, arrived_at, last_at, from_name, from_address, subject, first_seen_at, gone_at'
const PAGE = 1000
const GONE_WINDOW_MS = 14 * 86_400_000

export interface EmailStationData {
  on: boolean
  limitDays: number
  leadId: string | null
  rows: WatchView[]
  threads: StationThreadRow[]
  names: Record<string, string>
}

export interface EmailStationIo {
  load(): Promise<EmailStationData>
  readAgain(watchIds: readonly string[]): Promise<void>
}

type Rows<T> = PromiseLike<{ data: T[] | null; error: SupabaseResultError | null }>

const firstName = (name: string | null | undefined): string => (name ?? '').trim().split(/\s+/)[0] ?? ''

export function supabaseEmailStationIo(client: SupabaseClient<Database> = supabase): EmailStationIo {
  return {
    async load() {
      const [settings, watch] = await Promise.all([
        client.from('app_settings').select('key, value_text').in('key', [APP_SETTINGS_KEY_EMAIL_COUNT_ON_V1, APP_SETTINGS_KEY_EMAIL_COUNT_LEAD_V1, APP_SETTINGS_KEY_EMAIL_COUNT_LIMIT_DAYS_V1]),
        client.from('email_box_watch' as never).select(WATCH_SELECT).order('created_at', { ascending: true }) as unknown as Rows<WatchView>,
      ])
      checkSupabaseError(settings, 'read whether the app counts mail')
      checkSupabaseError(watch, 'read the boxes the app counts')
      const value = (key: string) => settings.data.find((r) => r.key === key)?.value_text ?? null
      const leadId = (value(APP_SETTINGS_KEY_EMAIL_COUNT_LEAD_V1) ?? '').trim() || null
      const rows = watch.data ?? []

      const threads: StationThreadRow[] = []
      const ids = rows.map((r) => r.id)
      if (ids.length) {
        const goneSince = new Date(Date.now() - GONE_WINDOW_MS).toISOString()
        for (let from = 0; ; from += PAGE) {
          const page = await (client
            .from('email_box_threads' as never)
            .select(THREAD_SELECT)
            .in('watch_id', ids)
            .or(`gone_at.is.null,gone_at.gte.${goneSince}`)
            .order('gmail_thread_id', { ascending: true })
            .range(from, from + PAGE - 1) as unknown as Rows<StationThreadRow>)
          checkSupabaseError(page, 'read the threads the app counted')
          threads.push(...(page.data ?? []))
          if ((page.data ?? []).length < PAGE) break
        }
      }

      const people = [...new Set([...rows.map((r) => r.user_id), leadId].filter((id): id is string => !!id))]
      const names: Record<string, string> = {}
      if (people.length) {
        const users = await client.from('users').select('id, name').in('id', people)
        if (!users.error) for (const u of users.data) names[u.id] = firstName(u.name) || 'Someone'
      }
      return { on: countIsOn(value(APP_SETTINGS_KEY_EMAIL_COUNT_ON_V1)), limitDays: limitDaysFrom(value(APP_SETTINGS_KEY_EMAIL_COUNT_LIMIT_DAYS_V1)), leadId, rows, threads, names }
    },
    async readAgain(watchIds) {
      for (const id of watchIds) {
        const { error } = await client.functions.invoke('gmail-count', { body: { watch_id: id } })
        if (error) throw new Error(`The app could not read the box again: ${error.message}`)
      }
    },
  }
}
