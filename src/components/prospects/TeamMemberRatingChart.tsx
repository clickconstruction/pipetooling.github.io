import { useMemo } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { RATING_DEFS } from './ratingDimensions'
import { formatReviewMonthShort, monthlyRatingSeries } from '../../lib/prospects/teamMemberReviews'
import type { TeamMemberReviewRow } from '../../lib/prospects/teamMemberReviews'
import type { MonthlyComposite } from '../../lib/prospects/teamComposite'

const LINE_COLORS: Record<string, string> = {
  rating_ability: '#3b82f6',
  rating_drive: '#f59e0b',
  rating_integrity: '#16a34a',
}

/**
 * Ratings-over-time chart for one team member (Reflect card, v2.951): one line
 * per dimension, each point the cross-reviewer average for that month.
 */
export default function TeamMemberRatingChart({
  reviews,
  subjectUserId,
  compositeSeries,
}: {
  reviews: TeamMemberReviewRow[]
  subjectUserId: string
  /** Optional calibration-adjusted weighted composite per month (v2.953) — rendered as a dashed line. */
  compositeSeries?: MonthlyComposite[]
}) {
  const series = useMemo(() => monthlyRatingSeries(reviews, subjectUserId), [reviews, subjectUserId])

  if (series.length === 0) {
    return <p style={{ margin: '0.5rem 0 0', fontSize: '0.8125rem', color: 'var(--text-faint)' }}>No reviews to chart yet.</p>
  }

  const compositeByMonth = new Map((compositeSeries ?? []).map((p) => [p.month, p.composite]))
  const data = series.map((p) => ({
    label: formatReviewMonthShort(p.month),
    Ability: p.ability,
    Drive: p.drive,
    Integrity: p.integrity,
    Composite: compositeByMonth.get(p.month) ?? null,
  }))

  return (
    <div style={{ width: '100%', height: 220, marginTop: '0.5rem' }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} stroke="var(--border-strong)" />
          <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} stroke="var(--border-strong)" />
          <Tooltip
            contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: '0.8125rem' }}
            labelStyle={{ color: 'var(--text-strong)', fontWeight: 600 }}
          />
          <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
          {RATING_DEFS.map((def) => (
            <Line
              key={def.key}
              type="monotone"
              dataKey={def.short}
              stroke={LINE_COLORS[def.key] ?? 'var(--text-muted)'}
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
          ))}
          {compositeByMonth.size > 0 && (
            <Line type="monotone" dataKey="Composite" stroke="var(--text-strong)" strokeWidth={2} strokeDasharray="6 4" dot={{ r: 3 }} connectNulls />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
