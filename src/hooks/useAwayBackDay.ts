import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { awayBackDayNeed, type AwayBackDayNeed, type AwayBackDayRow } from '../lib/people/awayBackDay'
import { calendarYmdInAppTzFromIso, todayYmdInAppTz } from '../utils/dateUtils'

/**
 * The day back (punch list #256 PR 9, v2.6590): the Away notes whose office switched on *Tell me when the countdown
 * ends* and whose day has come, for the Needs you card. Reads `away_notes` under RLS (the people who may archive read
 * it; anyone else reads nothing and the line stays off), the account's name and archived stamp, and the roster row's
 * end date for the sub line. Null while off, loading, or when nobody's day has come; refetches on window focus like the
 * neighbouring nudges. `away_notes` is cast until the types regenerate (the `crew_day_email_requests` precedent).
 */

type NoteRow = { user_id: string; countdown_ymd: string; users: { name: string | null; archived_at: string | null } | null }
type PersonRow = { account_user_id: string | null; end_date: string | null }

export async function loadAwayBackDayRows(todayYmd: string): Promise<AwayBackDayRow[]> {
  const { data, error } = await supabase
    .from('away_notes' as never)
    .select('user_id, countdown_ymd, users!away_notes_user_id_fkey(name, archived_at)')
    .eq('alert_on_day', true)
    .lte('countdown_ymd', todayYmd)
  if (error) throw error
  const notes = ((data ?? []) as unknown as NoteRow[]).filter((n) => n.countdown_ymd)
  if (notes.length === 0) return []
  const { data: people } = await supabase.from('people').select('account_user_id, end_date').in('account_user_id', notes.map((n) => n.user_id))
  const leftBy = new Map<string, string>()
  for (const p of (people ?? []) as PersonRow[]) {
    if (p.account_user_id && p.end_date && (leftBy.get(p.account_user_id) ?? '') < p.end_date) leftBy.set(p.account_user_id, p.end_date)
  }
  return notes.map((n) => ({
    userId: n.user_id,
    displayName: n.users?.name?.trim() || 'A teammate',
    countdownYmd: n.countdown_ymd.slice(0, 10),
    leftYmd: leftBy.get(n.user_id) ?? (n.users?.archived_at ? calendarYmdInAppTzFromIso(n.users.archived_at) : null),
    archived: n.users?.archived_at != null,
  }))
}

export function useAwayBackDay(enabled: boolean): { need: AwayBackDayNeed | null; reload: () => void } {
  const [need, setNeed] = useState<AwayBackDayNeed | null>(null)
  const load = useCallback(async () => {
    if (!enabled) {
      setNeed(null)
      return
    }
    try {
      const today = todayYmdInAppTz()
      setNeed(awayBackDayNeed(await loadAwayBackDayRows(today), today))
    } catch {
      setNeed(null)
    }
  }, [enabled])
  useEffect(() => {
    void load()
  }, [load])
  useEffect(() => {
    const onFocus = () => void load()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [load])
  return { need, reload: () => void load() }
}
