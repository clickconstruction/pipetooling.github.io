import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { APP_SETTINGS_KEY_TEAM_REVIEW_CADENCE_DAYS } from '../lib/appSettingsKeys'
import { orderUsersForRating } from '../lib/prospects/teamMemberReviews'
import { overdueReviewSubjects, parseTeamReviewCadenceDays } from '../lib/prospects/teamReviewDue'
import type { MyReviewStamp } from '../lib/prospects/teamReviewDue'

/**
 * Dashboard / Dispatch Inbox banner (v2.960): teammates the signed-in user owes
 * a team review (Prospects → Team → Review) — overdue after the dev-set
 * cadence (default 30 days). Renders nothing for users without Team access,
 * or when nobody is overdue. Self-contained: one gate query, then three loads.
 */
export default function DashboardTeamReviewsDueBanner({ authUserId }: { authUserId: string | undefined }) {
  const navigate = useNavigate()
  const [overdueNames, setOverdueNames] = useState<string[]>([])
  const [cadenceDays, setCadenceDays] = useState(30)

  const load = useCallback(async () => {
    if (!authUserId) return
    // Gate: the banner only concerns people who can open Prospects → Team.
    const { data: me, error: meError } = await supabase
      .from('users')
      .select('team_prospects_access')
      .eq('id', authUserId)
      .maybeSingle()
    if (meError || !me?.team_prospects_access) {
      setOverdueNames([])
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
    // Additive UI — any load error (e.g. migration not applied) just hides the banner.
    if (rosterRes.error || stampsRes.error) {
      setOverdueNames([])
      return
    }
    const days = parseTeamReviewCadenceDays(cadenceRes.data?.value_num)
    setCadenceDays(days)
    const overdue = overdueReviewSubjects(
      orderUsersForRating(rosterRes.data ?? []),
      (stampsRes.data ?? []) as MyReviewStamp[],
      authUserId,
      days,
      new Date(),
    )
    setOverdueNames(overdue.map((u) => (u.name ?? '').trim() || 'Unnamed'))
  }, [authUserId])

  useEffect(() => {
    void load()
  }, [load])

  const count = overdueNames.length
  if (count === 0) return null

  const preview = overdueNames.slice(0, 3).join(', ')
  const more = count > 3 ? ` +${count - 3} more` : ''
  return (
    <button
      type="button"
      onClick={() => navigate('/prospects?tab=team&stage=review')}
      aria-label={`Open Team Review — ${count} teammate${count === 1 ? '' : 's'} due for your review`}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '1rem',
        width: '100%',
        padding: '1rem 1.25rem',
        border: '1px solid var(--border-strong)',
        borderRadius: 8,
        background: 'var(--bg-blue-tint)',
        marginBottom: '1rem',
        cursor: 'pointer',
        textAlign: 'left',
        font: 'inherit',
        color: 'inherit',
        boxSizing: 'border-box',
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          minWidth: '2.25rem',
          height: '2.25rem',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 999,
          background: '#2563eb',
          color: '#fff',
          fontSize: '0.9375rem',
          fontWeight: 700,
        }}
        aria-hidden
      >
        {count > 99 ? '99+' : count}
      </span>
      <div style={{ flex: '1 1 200px', minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-blue-700)' }}>Team reviews due</div>
        <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: 2 }}>
          {count === 1 ? `${preview} hasn't` : `${preview}${more} haven't`} had your review in {cadenceDays}+ days — open Team → Review to rate them.
        </div>
      </div>
    </button>
  )
}
