import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Database } from '../../../types/database'
import { supabase } from '../../../lib/supabase'
import { withSupabaseRetry } from '../../../utils/errorHandling'
import { loadReportEmailSubscriptions, loadReportEmailTeamLeadOptions, type SubscriptionWithAuthors, type TeamLeadOption } from '../../../lib/reportEmailSubscriptions'
import { buildEmailReportPeople, type DigestRecipientRow, type EmailReportPerson, type RosterUser } from '../../../lib/reports/emailReportPeople'

export type ScheduleRow = Database['public']['Tables']['recurring_job_report_schedules']['Row']

/**
 * Everything the Email reports modal reads, in one load (v2.3595): the roster, the digest
 * schedules and their recipient rows, the every-report subscriptions with their authors and
 * team leads, and the team-lead options. `people` is the one-row-per-person fold.
 */
export function useEmailReportsData(authUserId: string | undefined) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [roster, setRoster] = useState<RosterUser[]>([])
  const [schedules, setSchedules] = useState<ScheduleRow[]>([])
  const [digestRecipients, setDigestRecipients] = useState<DigestRecipientRow[]>([])
  const [subscriptions, setSubscriptions] = useState<SubscriptionWithAuthors[]>([])
  const [teamLeads, setTeamLeads] = useState<TeamLeadOption[]>([])

  const reload = useCallback(async () => {
    if (!authUserId) return
    setLoading(true)
    setError(null)
    try {
      const [rosterRows, schedRes, subs, leads] = await Promise.all([
        withSupabaseRetry(
          async () => supabase.from('users').select('id, name, email').is('archived_at', null).order('name').limit(500),
          'email reports roster',
        ),
        supabase.from('recurring_job_report_schedules').select('*').order('created_at', { ascending: true }),
        loadReportEmailSubscriptions(),
        // Pre-migration RPC (or a non-manager) reads as "no team leads yet" rather than an error.
        loadReportEmailTeamLeadOptions().catch(() => [] as TeamLeadOption[]),
      ])
      if (schedRes.error) throw schedRes.error
      const sched = (schedRes.data ?? []) as ScheduleRow[]
      let recips: DigestRecipientRow[] = []
      if (sched.length > 0) {
        const { data, error: rErr } = await supabase
          .from('recurring_job_report_schedule_recipients')
          .select('id, schedule_id, recipient_user_id, activity_scope, crew_filter, include_costs')
          .in('schedule_id', sched.map((s) => s.id))
          .limit(1000)
        if (rErr) throw rErr
        recips = (data ?? []) as DigestRecipientRow[]
      }
      setRoster((rosterRows ?? []) as RosterUser[])
      setSchedules(sched)
      setDigestRecipients(recips)
      setSubscriptions(subs)
      setTeamLeads(leads)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load report-email settings.')
    } finally {
      setLoading(false)
    }
  }, [authUserId])

  useEffect(() => {
    void reload()
  }, [reload])

  const teamLeadNames = useMemo(() => new Map(teamLeads.map((l) => [l.user_id, l.name])), [teamLeads])
  const people: EmailReportPerson[] = useMemo(
    () => buildEmailReportPeople({ roster, schedules, digestRecipients, subscriptions, teamLeadNames }),
    [roster, schedules, digestRecipients, subscriptions, teamLeadNames],
  )

  return { loading, error, roster, schedules, digestRecipients, subscriptions, teamLeads, people, reload }
}
