/**
 * Quickfill's Email station (punch list #159, v2.5828): the trend's reads. The station's own (`emailStationIo.ts`: the
 * settings, the rows the policies allow, the threads, the names), four weeks of `email_box_days` for those rows (the
 * policies hold the same boxes), and two weeks of the station's marks with who made them. The table is not in the
 * generated types until the types pass that follows the migration, so its read is cast. One interface, so the window's
 * smoke hands it a fake.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { checkSupabaseError, type SupabaseResultError } from '../../utils/errorHandling'
import { todayYmdInAppTz, ymdAddDays } from '../../utils/dateUtils'
import { supabase } from '../supabase'
import { supabaseEmailStationIo, type EmailStationData } from './emailStationIo'
import type { TrendDayRow, TrendMark } from './emailTrend'

export interface EmailTrendData {
  station: EmailStationData
  days: TrendDayRow[]
  marks: TrendMark[]
}

export interface EmailTrendIo {
  load(): Promise<EmailTrendData>
}

type Rows<T> = PromiseLike<{ data: T[] | null; error: SupabaseResultError | null }>

export function supabaseEmailTrendIo(client: SupabaseClient<Database> = supabase): EmailTrendIo {
  const stationIo = supabaseEmailStationIo(client)
  return {
    async load() {
      const station = await stationIo.load()
      const ids = station.rows.map((r) => r.id)
      const from = ymdAddDays(todayYmdInAppTz(), -28)
      const [days, marks] = await Promise.all([
        ids.length
          ? (client.from('email_box_days' as never).select('watch_id, label_name, day, count, oldest_days, new_count, cleared_count').in('watch_id', ids).gte('day', from).order('day', { ascending: true }) as unknown as Rows<TrendDayRow>)
          : Promise.resolve({ data: [] as TrendDayRow[], error: null }),
        client
          .from('quickfill_section_mark_events')
          .select('marked_at, users!quickfill_section_mark_events_marked_by_fkey(name)')
          .eq('section_id', 'email-inbox')
          .gte('marked_at', new Date(Date.now() - 15 * 86_400_000).toISOString())
          .order('marked_at', { ascending: true }),
      ])
      checkSupabaseError(days, 'read the trend of the counted mail')
      checkSupabaseError(marks, 'read who looked')
      const markRows = (marks.data ?? []) as unknown as { marked_at: string; users: { name: string | null } | null }[]
      return {
        station,
        days: days.data ?? [],
        marks: markRows.map((m) => ({ marked_at: m.marked_at, name: (m.users?.name ?? '').trim().split(/\s+/)[0] || null })),
      }
    },
  }
}
