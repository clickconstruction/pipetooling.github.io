import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'
// Short spoken role names ("Master", "Sub") — the long displayLabelForUserRole
// slugs ("Master_technician") overflowed the phone-width person picker.
import { guideLensRoleLabel } from '../../lib/roleGuideLens'
import type { UserRole } from '../../hooks/useAuth'
import { COMMENT_KEY_BY_RATING, RATING_DEFS, RatingSliders, type RatingKey } from './ratingDimensions'
import TeamMemberRatingChart from './TeamMemberRatingChart'
import {
  averageLatestRatings,
  currentReviewMonth,
  formatReviewMonthLabel,
  formatTenure,
  hasMonthReview,
  latestEntriesForDimension,
  latestReviewsByReviewer,
  myLatestReview,
  nextUnratedIndex,
  orderUsersForRating,
  recentJobsByUser,
  subjectReviewHistory,
} from '../../lib/prospects/teamMemberReviews'
import type { RatableUser, RecentJobRow, TeamMemberReviewRow, TenureRow } from '../../lib/prospects/teamMemberReviews'
import {
  CALIBRATION_MIN_SUBJECTS,
  adjustedAverages,
  companyDimensionMeans,
  deviationsFromNorm,
  formatDeviations,
  reviewerBaselines,
} from '../../lib/prospects/reviewerCalibration'
import {
  DEFAULT_COMPOSITE_WEIGHTS,
  compositeScore,
  monthlyCompositeSeries,
  parseCompositeWeights,
  serializeCompositeWeights,
} from '../../lib/prospects/teamComposite'
import { buildRoleLeaderboards, replaceFocusEntries } from '../../lib/prospects/teamLeaderboard'
import type { CompositeWeights } from '../../lib/prospects/teamComposite'
import { APP_SETTINGS_KEY_TEAM_REVIEW_COMPOSITE_WEIGHTS, APP_SETTINGS_KEY_TEAM_REVIEW_CADENCE_DAYS } from '../../lib/appSettingsKeys'
import {
  DEFAULT_TEAM_REVIEW_CADENCE_DAYS,
  nextDueIndexAfter,
  overdueReviewSubjects,
  parseTeamReviewCadenceDays,
  upcomingReviewSchedule,
  type MyReviewStamp,
} from '../../lib/prospects/teamReviewDue'

type ReviewDraft = {
  rating_ability: number | null
  rating_drive: number | null
  rating_integrity: number | null
  comment_ability: string
  comment_drive: string
  comment_integrity: string
}

const EMPTY_DRAFT: ReviewDraft = {
  rating_ability: null, rating_drive: null, rating_integrity: null,
  comment_ability: '', comment_drive: '', comment_integrity: '',
}

function draftFromReview(mine: TeamMemberReviewRow | null): ReviewDraft {
  if (!mine) return EMPTY_DRAFT
  return {
    rating_ability: mine.rating_ability, rating_drive: mine.rating_drive, rating_integrity: mine.rating_integrity,
    comment_ability: mine.comment_ability ?? '', comment_drive: mine.comment_drive ?? '', comment_integrity: mine.comment_integrity ?? '',
  }
}

/** Non-empty per-dimension comments of a review, in RATING_DEFS order. */
function dimensionComments(r: TeamMemberReviewRow): Array<{ short: string; text: string }> {
  return RATING_DEFS.flatMap((def) => {
    const text = r[COMMENT_KEY_BY_RATING[def.key]]
    return text != null && text.trim() !== '' ? [{ short: def.short, text }] : []
  })
}

/**
 * Prospects → Team → Review (v2.948): rate CURRENT team members monthly on the
 * three candidate dimensions. Rate = one card per active user (◀ ▶ deck);
 * Reflect = everyone's latest reviews + cross-reviewer averages + history.
 * Self-contained: loads its own roster, reviews, and recent-jobs context.
 */
export default function TeamReviewSection({
  authUserId,
  isDev,
  onOpenScreenBoard,
  initialRateUserId,
}: {
  authUserId: string
  isDev: boolean
  /** Jump to the hiring board's Screen stage (the pipeline for roles the leaderboard flags). */
  onOpenScreenBoard?: () => void
  /** Deep link (v2.1564): open the Rate deck ON this person — the "Team reviews due" banner passes its first overdue subject. */
  initialRateUserId?: string | null
}) {
  const [subTab, setSubTab] = useState<'rate' | 'reflect' | 'leaderboard'>('rate')
  const [roster, setRoster] = useState<RatableUser[]>([])
  const [reviews, setReviews] = useState<TeamMemberReviewRow[]>([])
  const [jobsByUser, setJobsByUser] = useState<Map<string, RecentJobRow[]>>(() => new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [index, setIndex] = useState(0)
  const [draft, setDraft] = useState<ReviewDraft>(EMPTY_DRAFT)
  const [busy, setBusy] = useState(false)
  const [savedFor, setSavedFor] = useState<string | null>(null)
  const [openHistories, setOpenHistories] = useState<Set<string>>(() => new Set())
  const [reflectView, setReflectView] = useState<'reviewer' | 'dimension'>('reviewer')
  const [openCharts, setOpenCharts] = useState<Set<string>>(() => new Set())
  const [startedOnByUser, setStartedOnByUser] = useState<Map<string, string>>(() => new Map())
  const [tendenciesOpen, setTendenciesOpen] = useState(false)
  const [weights, setWeights] = useState<CompositeWeights>(DEFAULT_COMPOSITE_WEIGHTS)
  const [weightsEditorOpen, setWeightsEditorOpen] = useState(false)
  const [weightsDraft, setWeightsDraft] = useState<{ ability: string; drive: string; integrity: string }>({ ability: '', drive: '', integrity: '' })
  const [weightsSaving, setWeightsSaving] = useState(false)
  const [cadenceDays, setCadenceDays] = useState(DEFAULT_TEAM_REVIEW_CADENCE_DAYS)
  /** The due pill's "Upcoming reviews" schedule modal (who's due when). */
  const [scheduleOpen, setScheduleOpen] = useState(false)

  const baselines = useMemo(() => reviewerBaselines(reviews), [reviews])
  const company = useMemo(() => companyDimensionMeans(reviews), [reviews])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [usersRes, reviewsRes, jobsRes, tenureRes] = await Promise.all([
      supabase.from('users').select('id, name, role').is('archived_at', null),
      supabase.from('team_member_reviews').select('*'),
      supabase.rpc('list_team_member_recent_jobs'),
      supabase.rpc('list_team_member_start_dates'),
    ])
    // Tenure is additive UI — a load error (e.g. migration not applied yet) just hides it.
    const tenureRows = (tenureRes.error ? [] : (tenureRes.data ?? [])) as TenureRow[]
    setStartedOnByUser(new Map(tenureRows.map((t) => [t.user_id, t.started_on])))
    // Composite weights are additive too — missing/invalid setting falls back to equal thirds.
    const { data: weightsRow } = await supabase
      .from('app_settings')
      .select('value_text')
      .eq('key', APP_SETTINGS_KEY_TEAM_REVIEW_COMPOSITE_WEIGHTS)
      .maybeSingle()
    setWeights(parseCompositeWeights(weightsRow?.value_text) ?? DEFAULT_COMPOSITE_WEIGHTS)
    // Cadence powers the due markers + next-due hop; same setting the banner reads.
    const { data: cadenceRow } = await supabase
      .from('app_settings')
      .select('value_num')
      .eq('key', APP_SETTINGS_KEY_TEAM_REVIEW_CADENCE_DAYS)
      .maybeSingle()
    setCadenceDays(parseTeamReviewCadenceDays(cadenceRow?.value_num))
    const firstError = usersRes.error ?? reviewsRes.error ?? jobsRes.error
    if (firstError) {
      setError(firstError.message)
      setLoading(false)
      return
    }
    const ordered = orderUsersForRating(usersRes.data ?? [])
    const reviewRows = (reviewsRes.data ?? []) as TeamMemberReviewRow[]
    setRoster(ordered)
    setReviews(reviewRows)
    setJobsByUser(recentJobsByUser((jobsRes.data ?? []) as RecentJobRow[]))
    setLoading(false)
    // Deep link from the "Team reviews due" banner: open ON that person.
    const deepLinkIdx = initialRateUserId ? ordered.findIndex((u) => u.id === initialRateUserId) : -1
    const startIdx = deepLinkIdx >= 0 ? deepLinkIdx : 0
    if (deepLinkIdx >= 0) setIndex(deepLinkIdx)
    const start = ordered[startIdx]
    if (start) setDraft(draftFromReview(myLatestReview(reviewRows, start.id, authUserId)))
  }, [authUserId, initialRateUserId])

  useEffect(() => {
    void load()
  }, [load])

  const subject = roster[index] ?? null

  /** My newest-save stamps, shaped for the cadence kernel the banner uses. */
  const stampsFrom = useCallback(
    (rows: TeamMemberReviewRow[]): MyReviewStamp[] =>
      rows
        .filter((r) => r.reviewer_user_id === authUserId)
        .map((r) => ({ subject_user_id: r.subject_user_id, review_month: r.review_month, updated_at: r.updated_at ?? null })),
    [authUserId],
  )
  // People I owe a review by the cadence — same math as the dashboard banner,
  // so the deck's due markers and the banner's count always agree.
  const dueIds = useMemo(
    () =>
      new Set(
        overdueReviewSubjects(roster, stampsFrom(reviews), authUserId, cadenceDays, new Date()).map((u) => u.id),
      ),
    [roster, reviews, stampsFrom, authUserId, cadenceDays],
  )
  // Full schedule for the due pill + its modal: due-now first, then soonest.
  const schedule = useMemo(
    () => upcomingReviewSchedule(roster, stampsFrom(reviews), authUserId, cadenceDays, new Date()),
    [roster, reviews, stampsFrom, authUserId, cadenceDays],
  )

  function goTo(nextIndex: number, reviewsList: TeamMemberReviewRow[] = reviews) {
    if (roster.length === 0) return
    const wrapped = (nextIndex + roster.length) % roster.length
    setIndex(wrapped)
    const next = roster[wrapped]
    if (next) setDraft(draftFromReview(myLatestReview(reviewsList, next.id, authUserId)))
    setSavedFor(null)
  }

  // ◀ ▶ with the keyboard on the Rate deck, but never while typing in a field.
  useEffect(() => {
    if (subTab !== 'rate') return
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key === 'ArrowRight') goTo(index + 1)
      if (e.key === 'ArrowLeft') goTo(index - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subTab, index, roster, reviews])

  /** Upserts the current card's review; returns the updated reviews list, or null on failure. */
  async function saveCurrent(): Promise<TeamMemberReviewRow[] | null> {
    if (!subject || busy) return null
    setBusy(true)
    setError(null)
    const reviewMonth = currentReviewMonth(APP_CALENDAR_TZ)
    const { data, error: saveError } = await supabase
      .from('team_member_reviews')
      .upsert(
        {
          subject_user_id: subject.id,
          reviewer_user_id: authUserId,
          review_month: reviewMonth,
          rating_ability: draft.rating_ability,
          rating_drive: draft.rating_drive,
          rating_integrity: draft.rating_integrity,
          comment_ability: draft.comment_ability.trim() || null,
          comment_drive: draft.comment_drive.trim() || null,
          comment_integrity: draft.comment_integrity.trim() || null,
        },
        { onConflict: 'subject_user_id,reviewer_user_id,review_month' },
      )
      .select()
      .single()
    setBusy(false)
    if (saveError) {
      setError(saveError.message)
      return null
    }
    const saved = data as TeamMemberReviewRow
    const updated = [
      ...reviews.filter((r) => r.id !== saved.id && !(r.subject_user_id === saved.subject_user_id && r.reviewer_user_id === saved.reviewer_user_id && r.review_month === saved.review_month)),
      saved,
    ]
    setReviews(updated)
    setSavedFor(subject.id)
    return updated
  }

  /**
   * Save, then advance — cadence-due people first (burns down the "Team
   * reviews due" banner's list), else the next person unrated this month
   * (the button flips to "All rated!" when none remain).
   */
  async function saveAndAdvance() {
    if (!subject) return
    const updated = await saveCurrent()
    if (!updated) return
    const dueAfterSave = new Set(
      overdueReviewSubjects(roster, stampsFrom(updated), authUserId, cadenceDays, new Date()).map((u) => u.id),
    )
    const nextDue = nextDueIndexAfter(roster, dueAfterSave, index)
    const month = currentReviewMonth(APP_CALENDAR_TZ)
    const next = nextDue ?? nextUnratedIndex(roster, updated, authUserId, month, index)
    if (next != null) goTo(next, updated)
  }

  /** Everyone's rated: save any last tweaks on this card, then switch to Reflect. */
  async function finishToReflect() {
    const updated = await saveCurrent()
    if (!updated) return
    setSubTab('reflect')
  }

  function openWeightsEditor() {
    setWeightsDraft({
      ability: String(Math.round(weights.ability * 100)),
      drive: String(Math.round(weights.drive * 100)),
      integrity: String(Math.round(weights.integrity * 100)),
    })
    setWeightsEditorOpen(true)
  }

  /** Dev-only: persist relative dimension weights to app_settings (normalized on read). */
  async function saveWeights() {
    if (weightsSaving) return
    const raw = { ability: Number(weightsDraft.ability), drive: Number(weightsDraft.drive), integrity: Number(weightsDraft.integrity) }
    const parsed = parseCompositeWeights(JSON.stringify(raw))
    if (!parsed) {
      setError('Weights must be non-negative numbers with a positive total.')
      return
    }
    setWeightsSaving(true)
    setError(null)
    const { error: saveError } = await supabase
      .from('app_settings')
      .upsert({ key: APP_SETTINGS_KEY_TEAM_REVIEW_COMPOSITE_WEIGHTS, value_text: serializeCompositeWeights(parsed) }, { onConflict: 'key' })
    setWeightsSaving(false)
    if (saveError) {
      setError(saveError.message)
      return
    }
    setWeights(parsed)
    setWeightsEditorOpen(false)
  }

  const cardStyle = { border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', padding: '0.9rem 1rem' } as const

  if (loading) return <p style={{ color: 'var(--text-muted)' }}>Loading team…</p>

  return (
    <div>
      {/* Rate | Reflect sub-tabs */}
      <div role="tablist" aria-label="Review modes" style={{ display: 'flex', justifyContent: 'center', gap: '0.4rem', marginBottom: '1rem' }}>
        {(['rate', 'reflect', 'leaderboard'] as const).map((key) => {
          const active = subTab === key
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSubTab(key)}
              style={{
                padding: '0.35rem 1rem',
                border: active ? '2px solid #2563eb' : '1px solid var(--border-strong)',
                borderRadius: 999,
                background: active ? 'var(--bg-blue-tint)' : 'var(--bg-subtle)',
                color: active ? 'var(--text-blue-700)' : 'var(--text-muted)',
                fontWeight: 600,
                fontSize: '0.8125rem',
                cursor: 'pointer',
              }}
            >
              {key === 'rate' ? 'Rate' : key === 'reflect' ? 'Reflect' : 'Leaderboard'}
            </button>
          )
        })}
      </div>

      {error && <p style={{ color: 'var(--text-red-600)', marginTop: 0 }}>{error}</p>}

      {subTab === 'rate' && (() => {
        const myBaseline = baselines.get(authUserId)
        // The due pill lives up front, left of the average (v2.NNNN): orange
        // when reviews are owed, calm green with the next due date otherwise.
        // Either way it opens the Upcoming reviews schedule.
        const nextUp = schedule.find((e) => e.dueInDays > 0)
        const pillBase = {
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.3rem',
          padding: '0.18rem 0.65rem',
          borderRadius: 999,
          fontSize: '0.8125rem',
          whiteSpace: 'nowrap' as const,
          cursor: 'pointer',
        }
        const duePill =
          dueIds.size > 0 ? (
            <button
              type="button"
              onClick={() => setScheduleOpen(true)}
              title={`${dueIds.size} teammate${dueIds.size === 1 ? '' : 's'} due for your review (no review in ${cadenceDays}+ days) — see who's next`}
              style={{ ...pillBase, fontWeight: 700, background: 'var(--bg-orange-100)', color: 'var(--text-orange-800)', border: '1px solid var(--text-orange-700)' }}
            >
              <span aria-hidden="true" style={{ fontSize: '0.55rem' }}>●</span>
              {dueIds.size} due
              <span aria-hidden="true" style={{ fontWeight: 400, opacity: 0.7 }}>›</span>
            </button>
          ) : nextUp ? (
            <button
              type="button"
              onClick={() => setScheduleOpen(true)}
              title="Nobody is due right now — see when each next review comes due"
              style={{ ...pillBase, fontWeight: 600, background: 'var(--bg-green-tint)', color: 'var(--text-green-700)', border: '1px solid var(--border-green)' }}
            >
              ✓ Caught up · next in {nextUp.dueInDays}d
              <span aria-hidden="true" style={{ fontWeight: 400, opacity: 0.7 }}>›</span>
            </button>
          ) : null
        const avg =
          myBaseline && myBaseline.overallMean != null ? (
            <span title="Knowing your own center of gravity keeps ratings calibrated across reviewers">
              Your average: <strong style={{ color: 'var(--text-strong)' }}>{myBaseline.overallMean}</strong> across {myBaseline.subjectCount}{' '}
              {myBaseline.subjectCount === 1 ? 'person' : 'people'}
            </span>
          ) : null
        if (!duePill && !avg) return null
        return (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', flexWrap: 'wrap', margin: '0 0 0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            {duePill}
            {avg}
          </div>
        )
      })()}

      {subTab === 'rate' && scheduleOpen ? (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: '1rem' }}
          onClick={() => setScheduleOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Upcoming reviews"
            onClick={(e) => e.stopPropagation()}
            style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', width: 'min(420px, 100%)', maxHeight: '82vh', overflowY: 'auto', padding: '1rem 1rem 0.75rem' }}
          >
            <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-strong)' }}>Upcoming reviews</h3>
            <p style={{ margin: '0.2rem 0 0.5rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Your cadence: every person, every {cadenceDays} days.
            </p>
            {(() => {
              const shortMd = (ms: number) => new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              const nowMs = Date.now()
              const personRow = (entry: (typeof schedule)[number]) => {
                const isDue = entry.dueInDays <= 0
                const agoDays = entry.lastReviewedMs != null ? Math.max(0, Math.floor((nowMs - entry.lastReviewedMs) / 86400000)) : null
                return (
                  <button
                    key={entry.user.id}
                    type="button"
                    onClick={() => {
                      const i = roster.findIndex((u) => u.id === entry.user.id)
                      if (i >= 0) goTo(i)
                      setScheduleOpen(false)
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', width: '100%', padding: '0.45rem 0.35rem', border: 'none', borderTop: '1px solid var(--border)', background: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text-base)' }}
                  >
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-strong)' }}>{entry.user.name ?? 'Unnamed'}</span>
                      <span style={{ fontSize: '0.72rem', padding: '0.05rem 0.5rem', borderRadius: 999, background: 'var(--bg-subtle)', border: '1px solid var(--border)', color: 'var(--text-muted)', marginLeft: '0.4rem' }}>
                        {guideLensRoleLabel(entry.user.role as UserRole)}
                      </span>
                      <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                        {entry.neverReviewed || entry.lastReviewedMs == null
                          ? 'Never reviewed'
                          : `Last review ${agoDays}d ago · ${shortMd(entry.lastReviewedMs)}`}
                      </span>
                    </span>
                    <span
                      style={{
                        whiteSpace: 'nowrap',
                        fontVariantNumeric: 'tabular-nums',
                        fontSize: '0.8125rem',
                        ...(isDue ? { color: 'var(--text-orange-700)', fontWeight: 700 } : { color: 'var(--text-muted)' }),
                      }}
                    >
                      {isDue || entry.dueAtMs == null ? 'due' : `in ${entry.dueInDays}d · ${shortMd(entry.dueAtMs)}`}
                    </span>
                  </button>
                )
              }
              const dueNow = schedule.filter((e) => e.dueInDays <= 0)
              const comingUp = schedule.filter((e) => e.dueInDays > 0)
              return (
                <>
                  {dueNow.length > 0 ? (
                    <>
                      <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-orange-700)', margin: '0.6rem 0 0.2rem' }}>
                        Due now · {dueNow.length}
                      </div>
                      {dueNow.map(personRow)}
                    </>
                  ) : null}
                  {comingUp.length > 0 ? (
                    <>
                      <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-faint)', margin: '0.7rem 0 0.2rem' }}>
                        Coming up
                      </div>
                      {comingUp.map(personRow)}
                    </>
                  ) : null}
                  {schedule.length === 0 ? (
                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Nobody else to review yet.</p>
                  ) : null}
                </>
              )
            })()}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem', marginTop: '0.7rem', paddingTop: '0.6rem', borderTop: '1px solid var(--border)' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-faint)' }}>Tap a person to open their review card.</span>
              <button
                type="button"
                onClick={() => setScheduleOpen(false)}
                style={{ padding: '0.4rem 1rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--bg-subtle)', color: 'var(--text-base)', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {subTab === 'rate' && (
        roster.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No active team members found.</p>
        ) : subject ? (
          <div style={{ maxWidth: 560, margin: '0 auto' }}>
            {/* Deck navigation */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <button type="button" onClick={() => goTo(index - 1)} aria-label="Previous person" style={{ padding: '0.35rem 0.7rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--bg-subtle)', cursor: 'pointer', fontWeight: 700 }}>
                ◀
              </button>
              <select
                value={subject.id}
                onChange={(e) => goTo(roster.findIndex((u) => u.id === e.target.value))}
                aria-label="Jump to person"
                style={{ flex: 1, padding: '0.35rem 0.5rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-base)' }}
              >
                {roster.map((u) => (
                  <option key={u.id} value={u.id}>
                    {dueIds.has(u.id) ? '● ' : ''}
                    {u.name ?? 'Unnamed'} — {guideLensRoleLabel(u.role as UserRole)}
                    {dueIds.has(u.id) ? ' · due' : ''}
                  </option>
                ))}
              </select>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                {index + 1} of {roster.length}
              </span>
              <button type="button" onClick={() => goTo(index + 1)} aria-label="Next person" style={{ padding: '0.35rem 0.7rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--bg-subtle)', cursor: 'pointer', fontWeight: 700 }}>
                ▶
              </button>
            </div>

            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>{subject.name ?? 'Unnamed'}</span>
                <span style={{ fontSize: '0.75rem', padding: '0.05rem 0.5rem', borderRadius: 999, background: 'var(--bg-subtle)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                  {guideLensRoleLabel(subject.role as UserRole)}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {(() => {
                    const mine = myLatestReview(reviews, subject.id, authUserId)
                    return mine ? `You last rated: ${formatReviewMonthLabel(mine.review_month)}` : 'You haven’t rated them yet'
                  })()}
                  {dueIds.has(subject.id) ? (
                    <span style={{ color: 'var(--text-orange-700)', fontWeight: 600 }}> · due</span>
                  ) : null}
                </span>
              </div>

              {(() => {
                const jobs = jobsByUser.get(subject.id) ?? []
                return jobs.length > 0 ? (
                  <div style={{ marginTop: '0.5rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.15rem' }}>Recent jobs</div>
                    <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                      {jobs.map((j) => (
                        <li key={j.job_ledger_id}>
                          {j.job_display || 'Unnamed job'} <span style={{ color: 'var(--text-faint)' }}>· {j.last_worked_date}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p style={{ margin: '0.5rem 0 0', fontSize: '0.8125rem', color: 'var(--text-faint)' }}>No approved job time on record.</p>
                )
              })()}

              <RatingSliders
                values={draft}
                onChange={(k: RatingKey, v) => setDraft({ ...draft, [k]: v })}
                comments={{ rating_ability: draft.comment_ability, rating_drive: draft.comment_drive, rating_integrity: draft.comment_integrity }}
                onCommentChange={(k, v) => setDraft({ ...draft, [COMMENT_KEY_BY_RATING[k]]: v })}
              />

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1rem' }}>
                {(() => {
                  const month = currentReviewMonth(APP_CALENDAR_TZ)
                  const allRated = roster.every((u) => hasMonthReview(reviews, u.id, authUserId, month))
                  const otherDueCount = subject ? [...dueIds].filter((id) => id !== subject.id).length : dueIds.size
                  return (
                    <button
                      type="button"
                      onClick={allRated ? finishToReflect : saveAndAdvance}
                      disabled={busy}
                      style={{ padding: '0.5rem 1rem', background: allRated ? '#16a34a' : '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: busy ? 'not-allowed' : 'pointer', fontWeight: 600 }}
                    >
                      {busy
                        ? 'Saving…'
                        : allRated
                          ? 'All rated! Go to Reflect'
                          : `Save ${formatReviewMonthLabel(month)} review, go to next${otherDueCount > 0 ? ' due' : ''}`}
                    </button>
                  )
                })()}
                {savedFor === subject.id && <span style={{ fontSize: '0.8125rem', color: 'var(--text-green-600)', fontWeight: 600 }}>Saved ✓</span>}
              </div>
            </div>
          </div>
        ) : null
      )}

      {subTab === 'reflect' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: 720, margin: '0 auto' }}>
          {/* Group latest feedback by who said it, or by dimension (all Ability notes together, etc.). */}
          <div role="group" aria-label="Group feedback by" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Group by</span>
            {(['reviewer', 'dimension'] as const).map((key) => {
              const active = reflectView === key
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setReflectView(key)}
                  style={{
                    padding: '0.2rem 0.7rem',
                    border: active ? '2px solid #2563eb' : '1px solid var(--border-strong)',
                    borderRadius: 999,
                    background: active ? 'var(--bg-blue-tint)' : 'var(--bg-subtle)',
                    color: active ? 'var(--text-blue-700)' : 'var(--text-muted)',
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                  }}
                >
                  {key === 'reviewer' ? 'Reviewer' : 'Dimension'}
                </button>
              )
            })}
          </div>
          {baselines.size > 0 && (
            <div style={cardStyle}>
              <button
                type="button"
                onClick={() => setTendenciesOpen((v) => !v)}
                aria-expanded={tendenciesOpen}
                style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', font: 'inherit', color: 'inherit' }}
              >
                <span style={{ fontWeight: 700 }}>Reviewer tendencies</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>some reviewers rate high, some low — read scores against each reviewer&rsquo;s own average</span>
                <span aria-hidden style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-faint)' }}>{tendenciesOpen ? '▾' : '▸'}</span>
              </button>
              {tendenciesOpen && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.5rem' }}>
                  {[...baselines.values()]
                    .sort((a, b) => (b.overallMean ?? -1) - (a.overallMean ?? -1))
                    .map((b) => (
                      <div key={b.reviewer_user_id} style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-strong)' }}>
                          {roster.find((r) => r.id === b.reviewer_user_id)?.name ?? 'Former teammate'}
                        </span>
                        {' — avg '}
                        <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{b.overallMean ?? '—'}</span>
                        {` across ${b.subjectCount} ${b.subjectCount === 1 ? 'person' : 'people'}`}
                        {b.overallMin != null && b.overallMax != null && ` (range ${b.overallMin}–${b.overallMax})`}
                        {!b.calibrated && (
                          <span style={{ color: 'var(--text-amber-700)' }}> · uncalibrated — fewer than {CALIBRATION_MIN_SUBJECTS} rated</span>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
          {roster.map((u) => {
            const latest = latestReviewsByReviewer(reviews, u.id)
            const averages = averageLatestRatings(latest)
            const history = subjectReviewHistory(reviews, u.id)
            const historyOpen = openHistories.has(u.id)
            const reviewerName = (id: string) => roster.find((r) => r.id === id)?.name ?? 'Former teammate'
            const chartOpen = openCharts.has(u.id)
            const tenure = formatTenure(startedOnByUser.get(u.id), new Date())
            return (
              <div key={u.id} style={cardStyle}>
                <button
                  type="button"
                  onClick={() => setOpenCharts((prev) => {
                    const next = new Set(prev)
                    if (next.has(u.id)) next.delete(u.id)
                    else next.add(u.id)
                    return next
                  })}
                  aria-expanded={chartOpen}
                  title={chartOpen ? 'Hide ratings over time' : 'Show ratings over time'}
                  style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap', width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', font: 'inherit', color: 'inherit' }}
                >
                  <span style={{ fontWeight: 700 }}>{u.name ?? 'Unnamed'}</span>
                  <span style={{ fontSize: '0.75rem', padding: '0.05rem 0.5rem', borderRadius: 999, background: 'var(--bg-subtle)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                    {guideLensRoleLabel(u.role as UserRole)}
                  </span>
                  {tenure && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }} title={`At the company since ${startedOnByUser.get(u.id) ?? ''}`}>
                      {tenure} at company
                    </span>
                  )}
                  <span style={{ marginLeft: 'auto', fontSize: '0.8125rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }} title="Team average of each reviewer's latest ratings: Ability · Drive · Integrity">
                    {averages.reviewerCount === 0
                      ? 'No reviews yet'
                      : `Avg ${[averages.ability, averages.drive, averages.integrity].map((v) => (v == null ? '—' : v)).join(' · ')} (${averages.reviewerCount} reviewer${averages.reviewerCount === 1 ? '' : 's'})`}
                  </span>
                  {(() => {
                    if (latest.length === 0) return null
                    const adjusted = adjustedAverages(latest, baselines, company)
                    if (adjusted.calibratedCount === 0) return null
                    return (
                      <span
                        style={{ fontSize: '0.8125rem', color: 'var(--text-blue-700)', fontVariantNumeric: 'tabular-nums' }}
                        title={`Corrected for each reviewer's own rating tendency (mean-centering; ${adjusted.calibratedCount} calibrated, ${adjusted.uncalibratedCount} raw)`}
                      >
                        {`adj ${[adjusted.ability, adjusted.drive, adjusted.integrity].map((v) => (v == null ? '—' : v)).join(' · ')}`}
                      </span>
                    )
                  })()}
                  {(() => {
                    const composite = compositeScore(reviews, u.id, baselines, company, weights, currentReviewMonth(APP_CALENDAR_TZ))
                    if (composite.score == null) return null
                    return composite.confident ? (
                      <span
                        style={{ fontSize: '0.8125rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--text-strong)', border: '1px solid var(--border-strong)', borderRadius: 999, padding: '0 0.5rem' }}
                        title={`Weighted composite: calibration-adjusted ratings, recency-decayed over ${composite.monthsCovered} month${composite.monthsCovered === 1 ? '' : 's'}, ${composite.reviewerCount} reviewers`}
                      >
                        {composite.score}
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }} title="Needs at least 2 reviewers before the composite is rankable">
                        insufficient data ({composite.reviewerCount} reviewer{composite.reviewerCount === 1 ? '' : 's'})
                      </span>
                    )
                  })()}
                  <span aria-hidden style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>{chartOpen ? '▾' : '📈'}</span>
                </button>
                {chartOpen && (
                  <TeamMemberRatingChart
                    reviews={reviews}
                    subjectUserId={u.id}
                    compositeSeries={monthlyCompositeSeries(reviews, u.id, baselines, company, weights)}
                  />
                )}
                {latest.length > 0 && reflectView === 'dimension' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginTop: '0.45rem' }}>
                    {RATING_DEFS.map((def) => {
                      const dimension = def.key.replace('rating_', '') as 'ability' | 'drive' | 'integrity'
                      const entries = latestEntriesForDimension(latest, dimension)
                      if (entries.length === 0) return null
                      const dimensionAverage = averages[dimension]
                      return (
                        <div key={def.key}>
                          <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: def.color }}>
                            {def.short}
                            {dimensionAverage != null && (
                              <span style={{ fontWeight: 600, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}> · avg {dimensionAverage}</span>
                            )}
                          </div>
                          {entries.map((e) => (
                            <div key={e.reviewer_user_id} style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginLeft: '1rem' }}>
                              <span style={{ fontWeight: 600, color: 'var(--text-strong)' }}>{reviewerName(e.reviewer_user_id)}</span>
                              <span style={{ color: 'var(--text-faint)' }}> ({formatReviewMonthLabel(e.review_month)})</span>
                              {': '}
                              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{e.rating == null ? '—' : e.rating}</span>
                              {e.comment != null && <> — {e.comment}</>}
                            </div>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                )}
                {latest.length > 0 && reflectView === 'reviewer' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.45rem' }}>
                    {latest.map((r) => (
                      <div key={r.id} style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-strong)' }}>{reviewerName(r.reviewer_user_id)}</span>
                        <span style={{ color: 'var(--text-faint)' }}> ({formatReviewMonthLabel(r.review_month)})</span>
                        {': '}
                        <span style={{ fontVariantNumeric: 'tabular-nums' }} title="Ability · Drive · Integrity">
                          {[r.rating_ability, r.rating_drive, r.rating_integrity].map((v) => (v == null ? '—' : v)).join(' · ')}
                        </span>
                        {(() => {
                          const anchored = formatDeviations(deviationsFromNorm(r, baselines.get(r.reviewer_user_id)))
                          return anchored ? (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)', fontVariantNumeric: 'tabular-nums' }}> ({anchored})</span>
                          ) : null
                        })()}
                        {dimensionComments(r).map((d) => (
                          <div key={d.short} style={{ margin: '0.1rem 0 0 1rem' }}>
                            <span style={{ fontWeight: 600 }}>{d.short}</span> — {d.text}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
                {history.length > latest.length && (
                  <button
                    type="button"
                    onClick={() => setOpenHistories((prev) => {
                      const next = new Set(prev)
                      if (next.has(u.id)) next.delete(u.id)
                      else next.add(u.id)
                      return next
                    })}
                    style={{ marginTop: '0.4rem', padding: 0, background: 'none', border: 'none', color: 'var(--text-blue-500)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
                  >
                    {historyOpen ? 'Hide history' : `History (${history.length})`}
                  </button>
                )}
                {historyOpen && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', marginTop: '0.3rem', paddingLeft: '0.5rem', borderLeft: '2px solid var(--border)' }}>
                    {history.map((r) => (
                      <div key={r.id} style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        <span style={{ fontWeight: 600 }}>{formatReviewMonthLabel(r.review_month)}</span>
                        {' · '}
                        {reviewerName(r.reviewer_user_id)}
                        {': '}
                        <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {[r.rating_ability, r.rating_drive, r.rating_integrity].map((v) => (v == null ? '—' : v)).join(' · ')}
                        </span>
                        {dimensionComments(r).map((d) => (
                          <span key={d.short}> · {d.short}: {d.text}</span>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {subTab === 'leaderboard' && (() => {
        const boards = buildRoleLeaderboards(roster, reviews, baselines, company, weights, currentReviewMonth(APP_CALENDAR_TZ))
        const focus = replaceFocusEntries(boards, 3)
        const compositePill = (score: number) => (
          <span style={{ fontSize: '0.8125rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--text-strong)', border: '1px solid var(--border-strong)', borderRadius: 999, padding: '0 0.5rem' }}>
            {score}
          </span>
        )
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: 720, margin: '0 auto' }}>
            {isDev && (
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                {weightsEditorOpen ? (
                  <div style={{ ...cardStyle, display: 'flex', alignItems: 'flex-end', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {(['ability', 'drive', 'integrity'] as const).map((dim) => (
                      <label key={dim} style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        <span style={{ display: 'block', marginBottom: '0.15rem', textTransform: 'capitalize' }}>{dim}</span>
                        <input
                          type="number"
                          min={0}
                          value={weightsDraft[dim]}
                          onChange={(e) => setWeightsDraft({ ...weightsDraft, [dim]: e.target.value })}
                          style={{ width: '4.5rem', padding: '0.3rem 0.4rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-base)' }}
                        />
                      </label>
                    ))}
                    <button type="button" onClick={saveWeights} disabled={weightsSaving} style={{ padding: '0.35rem 0.8rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: weightsSaving ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.8125rem' }}>
                      {weightsSaving ? 'Saving…' : 'Save weights'}
                    </button>
                    <button type="button" onClick={() => setWeightsEditorOpen(false)} disabled={weightsSaving} style={{ padding: '0.35rem 0.8rem', background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', fontSize: '0.8125rem' }}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={openWeightsEditor}
                    title={`Dimension weights: Ability ${Math.round(weights.ability * 100)} · Drive ${Math.round(weights.drive * 100)} · Integrity ${Math.round(weights.integrity * 100)}`}
                    style={{ background: 'none', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', fontSize: '0.9375rem', padding: 0 }}
                    aria-label="Edit composite weights"
                  >
                    ⚙
                  </button>
                )}
              </div>
            )}

            {focus.length > 0 && (
              <div style={{ ...cardStyle, borderColor: 'var(--border-strong)' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700 }}>Replace-priority focus</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>lowest confident composites company-wide</span>
                  {onOpenScreenBoard && (
                    <button type="button" onClick={onOpenScreenBoard} style={{ marginLeft: 'auto', padding: '0.25rem 0.6rem', background: 'var(--bg-subtle)', color: 'var(--text-700)', border: '1px solid var(--border-strong)', borderRadius: 6, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>
                      Open hiring board →
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.45rem' }}>
                  {focus.map((e, i) => (
                    <div key={e.user.id} style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', fontSize: '0.8125rem' }}>
                      <span style={{ color: 'var(--text-faint)', fontVariantNumeric: 'tabular-nums' }}>{i + 1}.</span>
                      <span style={{ fontWeight: 600 }}>{e.user.name ?? 'Unnamed'}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{e.roleLabel}</span>
                      {(() => {
                        const tenure = formatTenure(startedOnByUser.get(e.user.id), new Date())
                        return tenure ? <span style={{ color: 'var(--text-faint)', fontSize: '0.75rem' }}>{tenure}</span> : null
                      })()}
                      <span style={{ marginLeft: 'auto' }}>{e.composite.score != null && compositePill(e.composite.score)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {boards.map((board) => (
              <div key={board.sectionKey} style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700 }}>{board.label}</span>
                  <span style={{ marginLeft: 'auto', fontSize: '0.8125rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                    {board.roleAverage == null ? 'no rankable members' : `role avg ${board.roleAverage}`}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.45rem' }}>
                  {board.entries.map((e, i) => {
                    const rankable = e.composite.confident && e.composite.score != null
                    const weakest = board.weakestUserId === e.user.id
                    const tenure = formatTenure(startedOnByUser.get(e.user.id), new Date())
                    return (
                      <div key={e.user.id} style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', fontSize: '0.8125rem' }}>
                        <span style={{ color: 'var(--text-faint)', fontVariantNumeric: 'tabular-nums', minWidth: '1.2rem' }}>{rankable ? `${i + 1}.` : '—'}</span>
                        <span style={{ fontWeight: 600 }}>{e.user.name ?? 'Unnamed'}</span>
                        {tenure && <span style={{ color: 'var(--text-faint)', fontSize: '0.75rem' }}>{tenure}</span>}
                        {weakest && (
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-red-600)', border: '1px solid var(--text-red-600)', borderRadius: 999, padding: '0 0.4rem' }}>
                            weakest
                          </span>
                        )}
                        <span style={{ marginLeft: 'auto' }}>
                          {rankable && e.composite.score != null ? (
                            compositePill(e.composite.score)
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }} title="Needs at least 2 reviewers before the composite is rankable">
                              insufficient data ({e.composite.reviewerCount} reviewer{e.composite.reviewerCount === 1 ? '' : 's'})
                            </span>
                          )}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )
      })()}
    </div>
  )
}
