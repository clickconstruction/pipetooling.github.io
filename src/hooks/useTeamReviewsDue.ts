import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { APP_SETTINGS_KEY_TEAM_REVIEW_CADENCE_DAYS } from '../lib/appSettingsKeys'
import { orderUsersForRating } from '../lib/prospects/teamMemberReviews'
import { overdueReviewSubjects, parseTeamReviewCadenceDays } from '../lib/prospects/teamReviewDue'
import type { MyReviewStamp } from '../lib/prospects/teamReviewDue'

/**
 * Teammates the signed-in user owes a team review (Prospects → Team → Review),
 * overdue after the dev-set cadence (default 30 days). Extracted verbatim from
 * DashboardTeamReviewsDueBanner (v2.960) for the Needs You card (v2.2488).
 * Self-gating: empty for users without Team access, and on any load error
 * (e.g. migration not applied) — the item simply doesn't appear.
 */
export function useTeamReviewsDue(authUserId: string | undefined): {
  overdue: Array<{ id: string; name: string }>
  cadenceDays: number
} {
  const [overdue, setOverdue] = useState<Array<{ id: string; name: string }>>([])
  const [cadenceDays, setCadenceDays] = useState(30)

  const load = useCallback(async () => {
    if (!authUserId) return
    // Gate: only people who can open Prospects → Team owe reviews.
    const { data: me, error: meError } = await supabase
      .from('users')
      .select('team_prospects_access')
      .eq('id', authUserId)
      .maybeSingle()
    if (meError || !me?.team_prospects_access) {
      setOverdue([])
      return
    }
    const [rosterRes, stampsRes, cadenceRes] = await Promise.all([
      supabase.from('users').select('id, name, role').is('archived_at', null),
      supabase
        .from('team_member_reviews')
        .select('subject_user_id, review_month, updated_at')
        .eq('reviewer_user_id', authUserId),
      supabase.from('app_settings').select('value_num').eq('key', APP_SETTINGS_KEY_TEAM_REVIEW_CADENCE_DAYS).maybeSingle(),
    ])
    if (rosterRes.error || stampsRes.error) {
      setOverdue([])
      return
    }
    const days = parseTeamReviewCadenceDays(cadenceRes.data?.value_num)
    setCadenceDays(days)
    const overdueUsers = overdueReviewSubjects(
      orderUsersForRating(rosterRes.data ?? []),
      (stampsRes.data ?? []) as MyReviewStamp[],
      authUserId,
      days,
      new Date(),
    )
    setOverdue(overdueUsers.map((u) => ({ id: u.id, name: (u.name ?? '').trim() || 'Unnamed' })))
  }, [authUserId])

  useEffect(() => {
    void load()
  }, [load])

  return { overdue, cadenceDays }
}
