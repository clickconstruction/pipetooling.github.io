/**
 * Team feedback admin (dev). v2.2835 "one table, one feed": on People → Feedback the page is a
 * status strip, one people table with a person drawer, and the open-words feed; settings and the
 * retired questions live behind the gear. On Settings → People & accounts the block is just a
 * pointer here, so the feature has one home.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import {
  fetchAllActiveUsersForTeamFeedbackOverview,
  fetchAllTeamFeedbackUserStates,
  fetchTeamFeedbackSettings,
  resetTeamFeedbackUserStateEligibilityForDev,
  type TeamFeedbackSettingsRow,
  type TeamFeedbackUserStateRow,
} from '../../lib/teamFeedback'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'
import { useAuth } from '../../hooks/useAuth'
import { useNarrowViewport640 } from '../../hooks/useNarrowViewport640'
import { currentReviewMonth } from '../../lib/prospects/teamMemberReviews'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'
import type { SourcedReviewRow } from '../../lib/people/crewReview'
import { buildFeedbackRows, feedbackStats, type FeedbackUser, type WordsSubmission } from '../../lib/people/feedbackTabRows'
import FeedbackStatusStrip from './FeedbackStatusStrip'
import FeedbackPeopleTable from './FeedbackPeopleTable'
import FeedbackPersonDrawer from './FeedbackPersonDrawer'
import OpenWordsFeed from './OpenWordsFeed'
import FeedbackSettingsDrawer from './FeedbackSettingsDrawer'
import CrewReviewDeck from './CrewReviewDeck'

export type TeamFeedbackDevSettingsBlockProps = {
  /** `settings`: the one-line pointer on Settings. `standalone`: the full page on People → Feedback. */
  layout?: 'settings' | 'standalone'
}

type RecentJobRow = { user_id: string; last_worked_date: string }

export default function TeamFeedbackDevSettingsBlock({ layout = 'settings' }: TeamFeedbackDevSettingsBlockProps) {
  if (layout === 'settings') {
    return (
      <div style={{ marginTop: '2rem', marginBottom: '2rem', border: '1px solid var(--border)', borderRadius: 8, padding: '0.85rem 1rem', display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-strong)' }}>Team feedback</span>
        <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          lives on{' '}
          <Link to="/people?tab=feedback" style={{ color: 'var(--text-link)', fontWeight: 600 }}>
            People → Feedback
          </Link>
          : on/off, who&rsquo;s due, ratings, open words, and settings in one place.
        </span>
      </div>
    )
  }
  return <FeedbackTab />
}

function FeedbackTab() {
  const { showToast } = useToastContext()
  const { user: authUser } = useAuth()
  const narrow = useNarrowViewport640()
  const [settings, setSettings] = useState<TeamFeedbackSettingsRow | null>(null)
  const [users, setUsers] = useState<FeedbackUser[]>([])
  const [states, setStates] = useState<Map<string, TeamFeedbackUserStateRow>>(() => new Map())
  const [reviews, setReviews] = useState<SourcedReviewRow[]>([])
  const [submissions, setSubmissions] = useState<WordsSubmission[]>([])
  const [recentJobs, setRecentJobs] = useState<RecentJobRow[]>([])
  const [loading, setLoading] = useState(true)
  const [enabledSaving, setEnabledSaving] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [resettingUserId, setResettingUserId] = useState<string | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [s, u, st, rv, sb, rj] = await Promise.all([
        fetchTeamFeedbackSettings(),
        fetchAllActiveUsersForTeamFeedbackOverview(),
        fetchAllTeamFeedbackUserStates(),
        withSupabaseRetry(async () => supabase.from('team_member_reviews').select('*'), 'fetch team_member_reviews'),
        withSupabaseRetry(
          async () =>
            supabase
              .from('team_feedback_submissions')
              .select('id, created_at, reviewer_user_id, open_fix_improve, open_safety_tools, open_training, open_anything')
              .order('created_at', { ascending: false })
              .limit(500),
          'fetch team_feedback_submissions',
        ),
        // Additive: who clocks out. A failing RPC just empties the "Clocks out" filter.
        supabase.rpc('list_team_member_recent_jobs').then((r) => (r.error ? [] : ((r.data ?? []) as RecentJobRow[]))),
      ])
      setSettings(s)
      setUsers(u.map((x) => ({ id: x.id, name: x.name, role: x.role })))
      setStates(st)
      setReviews(((rv ?? []) as Array<SourcedReviewRow & { source?: string }>).map((r) => ({ ...r, source: r.source === 'crew' ? 'crew' : 'office' })))
      setSubmissions((sb ?? []) as WordsSubmission[])
      setRecentJobs(rj)
      setNowMs(Date.now())
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not load team feedback', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    void load()
  }, [load])

  const enabled = settings?.enabled ?? false
  const reviewMonth = useMemo(() => currentReviewMonth(APP_CALENDAR_TZ), [])
  const rows = useMemo(() => buildFeedbackRows({ users, states, settings, reviews, submissions, recentJobs, nowMs }), [users, states, settings, reviews, submissions, recentJobs, nowMs])
  const stats = useMemo(() => feedbackStats(rows, reviews, submissions, reviewMonth, enabled), [rows, reviews, submissions, reviewMonth, enabled])
  const nameOf = useMemo(() => {
    const m = new Map(users.map((u) => [u.id, (u.name ?? '').trim() || 'Former teammate']))
    return (id: string) => m.get(id) ?? 'Former teammate'
  }, [users])
  const lastDeckAt = useMemo(() => {
    let best: string | null = null
    for (const s of states.values()) {
      const t = s.last_completed_at
      if (t && (!best || t > best)) best = t
    }
    return best
  }, [states])
  const selectedRow = selectedUserId ? rows.find((r) => r.userId === selectedUserId) ?? null : null

  async function toggleEnabled(next: boolean) {
    if (!settings) return
    const previous = settings.enabled
    setSettings({ ...settings, enabled: next })
    setEnabledSaving(true)
    try {
      await withSupabaseRetry(
        async () => supabase.from('team_feedback_settings').update({ enabled: next, updated_at: new Date().toISOString() }).eq('id', 1),
        'update team_feedback_settings enabled',
      )
      showToast(next ? 'Team feedback is on. The deck is dealt at the next eligible clock-out.' : 'Team feedback is off.', 'success')
    } catch (err) {
      setSettings((s) => (s ? { ...s, enabled: previous } : s))
      showToast(err instanceof Error ? err.message : 'Could not save', 'error')
    } finally {
      setEnabledSaving(false)
    }
  }

  async function resetCycle(userId: string) {
    setResettingUserId(userId)
    try {
      const result = await resetTeamFeedbackUserStateEligibilityForDev(userId)
      showToast(result === 'updated' ? `${nameOf(userId)} is due at their next clock-out.` : `${nameOf(userId)} had no cycle to reset.`, 'success')
      const st = await fetchAllTeamFeedbackUserStates()
      setStates(st)
      setNowMs(Date.now())
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Reset failed', 'error')
    } finally {
      setResettingUserId(null)
    }
  }

  if (loading && !settings) return <p style={{ color: 'var(--text-muted)' }}>Loading…</p>

  return (
    <div>
      <FeedbackStatusStrip
        enabled={enabled}
        saving={enabledSaving}
        cadenceDays={settings?.cadence_days ?? 14}
        lastDeckAt={lastDeckAt}
        stats={stats}
        onToggle={(next) => void toggleEnabled(next)}
        onTryDeck={() => setPreviewOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        narrow={narrow}
      />
      <FeedbackPeopleTable rows={rows} nowMs={nowMs} enabled={enabled} selectedUserId={selectedUserId} onSelect={setSelectedUserId} narrow={narrow} />
      <OpenWordsFeed submissions={submissions} openPrompts={settings?.open_prompts} nameOf={nameOf} onOpenPerson={setSelectedUserId} />

      {selectedRow && (
        <FeedbackPersonDrawer
          row={selectedRow}
          reviews={reviews}
          submissions={submissions}
          openPrompts={settings?.open_prompts}
          nameOf={nameOf}
          nowMs={nowMs}
          enabled={enabled}
          resetting={resettingUserId === selectedRow.userId}
          onReset={(id) => void resetCycle(id)}
          onClose={() => setSelectedUserId(null)}
          narrow={narrow}
        />
      )}
      {settingsOpen && <FeedbackSettingsDrawer row={settings} onSaved={setSettings} onClose={() => setSettingsOpen(false)} narrow={narrow} />}
      {authUser?.id && previewOpen && <CrewReviewDeck open onClose={() => setPreviewOpen(false)} userId={authUser.id} source="home_button" skipIntro preview />}
    </div>
  )
}
