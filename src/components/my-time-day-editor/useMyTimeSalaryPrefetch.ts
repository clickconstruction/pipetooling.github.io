import { useEffect, useRef, useState } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import type { DayEditorSession } from '../../lib/myTimeDayTimeline'
import {
  salaryPrefetchKey,
  salaryPrefetchOutcome,
  shouldPrefetchSalaryDay,
  type MyTimeEmptyDayHint,
} from '../../lib/myTimeSalaryPrefetch'
import { resolveCalendarWorkday, UNPAID_TIME_OFF_LABEL } from '../../lib/resolveCalendarWorkday'
import { syncSalaryClockSessionsForUserDay } from '../../lib/salaryScheduleSync'
import { supabase } from '../../lib/supabase'
import type { Database } from '../../types/database'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'

export type UseMyTimeSalaryPrefetchInput = {
  /** The mount's `prefetchSalarySessionsWhenEmpty` prop. */
  enabled: boolean
  /** The parent owns the sessions (`sessions` prop non-empty). */
  sessionsControlledByParent: boolean
  sessionsLoading: boolean
  /** The editor's own fetch; null before the first answer. */
  fetchedSessions: DayEditorSession[] | null
  /** Sessions on screen, from either source: any session clears the empty-day hint. */
  resolvedSessionCount: number
  inSaveableRange: boolean
  effectiveSubjectUserId: string | null | undefined
  dateStr: string
  /** The salary sessions were made: the editor re-reads the day. */
  onSessionsInvalidated: () => void
}

/**
 * When a salaried person's day comes back empty, ask their schedule once: time off or no shift
 * explains the empty day; a scheduled day has its salary sessions made and the day re-read.
 */
export function useMyTimeSalaryPrefetch({
  enabled,
  sessionsControlledByParent,
  sessionsLoading,
  fetchedSessions,
  resolvedSessionCount,
  inSaveableRange,
  effectiveSubjectUserId,
  dateStr,
  onSessionsInvalidated,
}: UseMyTimeSalaryPrefetchInput) {
  const { showToast } = useToastContext()
  const doneKeyRef = useRef<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [emptyDayHint, setEmptyDayHint] = useState<MyTimeEmptyDayHint>(null)
  const [timeOffLabel, setTimeOffLabel] = useState<string>(UNPAID_TIME_OFF_LABEL)
  // Read through a ref so a parent callback that is new every render cannot restart the effect.
  const onSessionsInvalidatedRef = useRef(onSessionsInvalidated)
  onSessionsInvalidatedRef.current = onSessionsInvalidated

  useEffect(() => {
    doneKeyRef.current = null
    setEmptyDayHint(null)
  }, [dateStr, effectiveSubjectUserId])

  useEffect(() => {
    if (
      !shouldPrefetchSalaryDay({
        enabled,
        sessionsControlledByParent,
        sessionsLoading,
        fetchedCount: fetchedSessions === null ? null : fetchedSessions.length,
        inSaveableRange,
        hasSubjectUser: !!effectiveSubjectUserId,
      })
    ) {
      return
    }
    if (!effectiveSubjectUserId) return

    const key = salaryPrefetchKey(effectiveSubjectUserId, dateStr)
    if (doneKeyRef.current === key) return
    doneKeyRef.current = key

    let cancelled = false
    setBusy(true)
    setEmptyDayHint(null)

    type TemplateRow = Database['public']['Tables']['salary_work_schedule_templates']['Row']
    type OverrideRow = Database['public']['Tables']['salary_work_schedule_day_overrides']['Row']
    type TimeOffRow = Database['public']['Tables']['user_time_off']['Row']

    void (async () => {
      try {
        const templateRes = await withSupabaseRetry(
          async () =>
            supabase.from('salary_work_schedule_templates').select('*').eq('user_id', effectiveSubjectUserId).maybeSingle(),
          'my time strip salary template probe',
        )
        if (cancelled) return
        const tmpl = templateRes as TemplateRow | null
        if (!tmpl) {
          setBusy(false)
          return
        }

        const [overrideRes, timeOffRes] = await Promise.all([
          withSupabaseRetry(
            async () =>
              supabase
                .from('salary_work_schedule_day_overrides')
                .select('*')
                .eq('user_id', effectiveSubjectUserId)
                .eq('work_date', dateStr)
                .maybeSingle(),
            'my time strip salary day override',
          ),
          withSupabaseRetry(
            async () =>
              supabase
                .from('user_time_off')
                .select('*')
                .eq('user_id', effectiveSubjectUserId)
                .lte('start_date', dateStr)
                .gte('end_date', dateStr),
            'my time strip user time off',
          ),
        ])
        if (cancelled) return

        const overrideRow = overrideRes as OverrideRow | null
        const timeOffRows = (timeOffRes ?? []) as TimeOffRow[]
        const outcome = salaryPrefetchOutcome(
          resolveCalendarWorkday({
            workDateYmd: dateStr,
            timeOffRows,
            template: tmpl,
            overrideForDate: overrideRow,
          }),
        )

        if (outcome.action === 'hint') {
          if (outcome.hint === 'time_off') setTimeOffLabel(outcome.timeOffLabel)
          setEmptyDayHint(outcome.hint)
          setBusy(false)
          return
        }

        const { error } = await syncSalaryClockSessionsForUserDay(effectiveSubjectUserId, dateStr)
        if (cancelled) return
        if (error) {
          showToast(error, 'error')
          setBusy(false)
          return
        }
        onSessionsInvalidatedRef.current()
        setBusy(false)
      } catch (e: unknown) {
        if (!cancelled) {
          showToast(formatErrorMessage(e, 'Could not sync salary sessions'), 'error')
          setBusy(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    enabled,
    sessionsControlledByParent,
    sessionsLoading,
    fetchedSessions,
    inSaveableRange,
    effectiveSubjectUserId,
    dateStr,
    showToast,
  ])

  useEffect(() => {
    if (resolvedSessionCount > 0) setEmptyDayHint(null)
  }, [resolvedSessionCount])

  return { busy, emptyDayHint, timeOffLabel }
}
