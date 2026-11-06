/**
 * Your people on the Dashboard (punch list #273, PR 3c): the reads behind the section. The open one-off cards of
 * everyone the office can see with their assignees, the newest move on each (a progress line, a tick, a reopen, in
 * the last two weeks), the names, and the cards done this week for the headline. The rows are the kernel's
 * (`dashboardYourPeople.ts`); the day rows' percent is younger than the generated types, hence the cast.
 */
import { useCallback, useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { formatErrorMessage } from '../utils/errorHandling'
import { todayYmdInAppTz } from '../utils/dateUtils'
import { localCalendarDayKey } from '../utils/dateUtils'
import { weekStartSunday } from '../lib/checklistHistoryLedger'
import { yourPeopleHeadline, yourPeopleRows, type YourPeopleInstance, type YourPersonRow } from '../lib/dashboardYourPeople'

const db = supabase as unknown as SupabaseClient
const OPEN_CAP = 400
const MOVE_DAYS = 14

type OpenRow = {
  id: string
  scheduled_date: string
  completed_at: string | null
  percent_complete: number | null
  checklist_items: { title: string; repeat_type: string | null } | null
  checklist_instance_assignees: Array<{ user_id: string }> | null
}

export type YourPeopleHost = {
  rows: YourPersonRow[]
  headline: string
  loading: boolean
  error: string | null
  reload: () => Promise<void>
  /** The open cards' titles by person, for the reminder's words. */
  titlesFor: (userId: string) => string[]
}

export function useDashboardYourPeople(authUserId: string | null, enabled: boolean): YourPeopleHost {
  const [rows, setRows] = useState<YourPersonRow[]>([])
  const [headline, setHeadline] = useState('')
  const [titles, setTitles] = useState<Map<string, string[]>>(new Map())
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!enabled) {
      setRows([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const today = todayYmdInAppTz()
      const openRes = await db
        .from('checklist_instances')
        .select('id, scheduled_date, completed_at, percent_complete, checklist_items!inner(title, repeat_type), checklist_instance_assignees(user_id)')
        .is('completed_at', null)
        .eq('checklist_items.repeat_type', 'once')
        .lte('scheduled_date', today)
        .order('scheduled_date', { ascending: true })
        .limit(OPEN_CAP)
      if (openRes.error) throw openRes.error
      const openRows = (openRes.data ?? []) as unknown as OpenRow[]
      const open: YourPeopleInstance[] = openRows.map((r) => ({
        id: r.id,
        title: r.checklist_items?.title ?? 'Untitled',
        scheduledDate: r.scheduled_date,
        completedAt: r.completed_at,
        percentComplete: r.percent_complete,
        assigneeIds: (r.checklist_instance_assignees ?? []).map((a) => a.user_id),
      }))
      const ids = open.map((o) => o.id)
      const userIds = Array.from(new Set(open.flatMap((o) => o.assigneeIds)))
      const sinceIso = new Date(Date.now() - MOVE_DAYS * 86_400_000).toISOString()
      const weekStartIso = `${weekStartSunday(today)}T00:00:00`
      const [movesRes, namesRes, doneRes] = await Promise.all([
        ids.length
          ? db.from('checklist_instance_events').select('instance_id, created_at').in('instance_id', ids).in('event_type', ['progress', 'criterion', 'reopened']).gte('created_at', sinceIso).limit(2000)
          : Promise.resolve({ data: [], error: null }),
        userIds.length ? db.from('users').select('id, name').in('id', userIds) : Promise.resolve({ data: [], error: null }),
        db.from('checklist_instances').select('id, completed_at, checklist_instance_assignees(user_id)').gte('completed_at', weekStartIso).limit(500),
      ])
      const moves = ((movesRes.data ?? []) as Array<{ instance_id: string; created_at: string }>).map((m) => ({ instanceId: m.instance_id, at: m.created_at }))
      const nameById = new Map(((namesRes.data ?? []) as Array<{ id: string; name: string | null }>).map((u) => [u.id, (u.name ?? '').trim() || 'Someone']))
      const doneRows = (doneRes.data ?? []) as Array<{ id: string; checklist_instance_assignees: Array<{ user_id: string }> | null }>
      const doneThisWeek = doneRows.filter((d) => (d.checklist_instance_assignees ?? []).some((a) => a.user_id && a.user_id !== authUserId)).length
      const next = yourPeopleRows({ open, moves, nameById, todayYmd: today, dayOf: (iso) => localCalendarDayKey(new Date(iso)), excludeUserId: authUserId })
      const t = new Map<string, string[]>()
      for (const o of open) for (const uid of o.assigneeIds) t.set(uid, [...(t.get(uid) ?? []), o.title])
      setTitles(t)
      setRows(next)
      setHeadline(yourPeopleHeadline(next, doneThisWeek))
      setError(null)
    } catch (e) {
      setError(formatErrorMessage(e, 'Your people did not load.'))
    } finally {
      setLoading(false)
    }
  }, [authUserId, enabled])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    if (!enabled) return
    const onChange = () => void reload()
    window.addEventListener('checklist-item-saved', onChange)
    window.addEventListener('checklist-instance-completed', onChange)
    return () => {
      window.removeEventListener('checklist-item-saved', onChange)
      window.removeEventListener('checklist-instance-completed', onChange)
    }
  }, [enabled, reload])

  const titlesFor = useCallback((userId: string) => titles.get(userId) ?? [], [titles])

  return { rows, headline, loading, error, reload, titlesFor }
}
