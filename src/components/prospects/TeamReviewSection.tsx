import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'
import { displayLabelForUserRole } from '../../lib/userRoleDisplay'
import type { UserRole } from '../../hooks/useAuth'
import { COMMENT_KEY_BY_RATING, RATING_DEFS, RatingSliders, type RatingKey } from './ratingDimensions'
import TeamMemberRatingChart from './TeamMemberRatingChart'
import {
  averageLatestRatings,
  currentReviewMonth,
  formatReviewMonthLabel,
  formatTenure,
  hasMonthReview,
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
} from '../../lib/prospects/teamComposite'
import type { CompositeWeights } from '../../lib/prospects/teamComposite'
import { APP_SETTINGS_KEY_TEAM_REVIEW_COMPOSITE_WEIGHTS } from '../../lib/appSettingsKeys'

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
export default function TeamReviewSection({ authUserId }: { authUserId: string }) {
  const [subTab, setSubTab] = useState<'rate' | 'reflect'>('rate')
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
  const [openCharts, setOpenCharts] = useState<Set<string>>(() => new Set())
  const [startedOnByUser, setStartedOnByUser] = useState<Map<string, string>>(() => new Map())
  const [tendenciesOpen, setTendenciesOpen] = useState(false)
  const [weights, setWeights] = useState<CompositeWeights>(DEFAULT_COMPOSITE_WEIGHTS)

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
    const firstError = usersRes.error ?? reviewsRes.error ?? jobsRes.error
    if (firstError) {
      setError(firstError.message)
      setLoading(false)
      return
    }
    const ordered = orderUsersForRating(usersRes.data ?? [])
    setRoster(ordered)
    setReviews((reviewsRes.data ?? []) as TeamMemberReviewRow[])
    setJobsByUser(recentJobsByUser((jobsRes.data ?? []) as RecentJobRow[]))
    setLoading(false)
    const first = ordered[0]
    if (first) setDraft(draftFromReview(myLatestReview((reviewsRes.data ?? []) as TeamMemberReviewRow[], first.id, authUserId)))
  }, [authUserId])

  useEffect(() => {
    void load()
  }, [load])

  const subject = roster[index] ?? null

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

  /** Save, then advance to the next person you haven't rated this month (the button flips to "All rated!" when none remain). */
  async function saveAndAdvance() {
    if (!subject) return
    const updated = await saveCurrent()
    if (!updated) return
    const month = currentReviewMonth(APP_CALENDAR_TZ)
    const next = nextUnratedIndex(roster, updated, authUserId, month, index)
    if (next != null) goTo(next, updated)
  }

  /** Everyone's rated: save any last tweaks on this card, then switch to Reflect. */
  async function finishToReflect() {
    const updated = await saveCurrent()
    if (!updated) return
    setSubTab('reflect')
  }

  const cardStyle = { border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', padding: '0.9rem 1rem' } as const

  if (loading) return <p style={{ color: 'var(--text-muted)' }}>Loading team…</p>

  return (
    <div>
      {/* Rate | Reflect sub-tabs */}
      <div role="tablist" aria-label="Review modes" style={{ display: 'flex', justifyContent: 'center', gap: '0.4rem', marginBottom: '1rem' }}>
        {(['rate', 'reflect'] as const).map((key) => {
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
              {key === 'rate' ? 'Rate' : 'Reflect'}
            </button>
          )
        })}
      </div>

      {error && <p style={{ color: 'var(--text-red-600)', marginTop: 0 }}>{error}</p>}

      {subTab === 'rate' && (() => {
        const myBaseline = baselines.get(authUserId)
        return myBaseline && myBaseline.overallMean != null ? (
          <p style={{ textAlign: 'center', margin: '0 0 0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }} title="Knowing your own center of gravity keeps ratings calibrated across reviewers">
            Your average: <strong style={{ color: 'var(--text-strong)' }}>{myBaseline.overallMean}</strong> across {myBaseline.subjectCount}{' '}
            {myBaseline.subjectCount === 1 ? 'person' : 'people'}
          </p>
        ) : null
      })()}

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
                    {u.name ?? 'Unnamed'} — {displayLabelForUserRole(u.role as UserRole)}
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
                  {displayLabelForUserRole(subject.role as UserRole)}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {(() => {
                    const mine = myLatestReview(reviews, subject.id, authUserId)
                    return mine ? `You last rated: ${formatReviewMonthLabel(mine.review_month)}` : 'You haven’t rated them yet'
                  })()}
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
                  return (
                    <button
                      type="button"
                      onClick={allRated ? finishToReflect : saveAndAdvance}
                      disabled={busy}
                      style={{ padding: '0.5rem 1rem', background: allRated ? '#16a34a' : '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: busy ? 'not-allowed' : 'pointer', fontWeight: 600 }}
                    >
                      {busy ? 'Saving…' : allRated ? 'All rated! Go to Reflect' : `Save ${formatReviewMonthLabel(month)} review, go to next`}
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
                    {displayLabelForUserRole(u.role as UserRole)}
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
                {latest.length > 0 && (
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
    </div>
  )
}
