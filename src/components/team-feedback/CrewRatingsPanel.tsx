/**
 * People → Feedback → Ratings (dev, v2.2824): every person with a crew rating, the crew lane
 * beside the office lane per dimension, a chip where the two disagree, and the crew notes.
 * Dev-only content: this is the one place rater names are visible (behind an expander).
 */
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'
import {
  CREW_OFFICE_GAP,
  crewSubjectsInOrder,
  summarizeCrewSubject,
  type SourcedReviewRow,
} from '../../lib/people/crewReview'
import { formatReviewMonthLabel, latestReviewsByReviewer } from '../../lib/prospects/teamMemberReviews'

type UserLite = { id: string; name: string | null; role: string }

export default function CrewRatingsPanel() {
  const { showToast } = useToastContext()
  const [rows, setRows] = useState<SourcedReviewRow[]>([])
  const [users, setUsers] = useState<UserLite[]>([])
  const [loading, setLoading] = useState(true)
  const [openRaters, setOpenRaters] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const [reviews, people] = await Promise.all([
          withSupabaseRetry(async () => supabase.from('team_member_reviews').select('*'), 'fetch team_member_reviews'),
          withSupabaseRetry(async () => supabase.from('users').select('id, name, role'), 'fetch users for ratings'),
        ])
        if (cancelled) return
        setRows(((reviews ?? []) as Array<SourcedReviewRow & { source?: string }>).map((r) => ({ ...r, source: r.source === 'crew' ? 'crew' : 'office' })))
        setUsers((people ?? []) as UserLite[])
      } catch (e) {
        if (!cancelled) showToast(e instanceof Error ? e.message : 'Could not load ratings', 'error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [showToast])

  const nameOf = useMemo(() => {
    const m = new Map(users.map((u) => [u.id, (u.name ?? '').trim() || 'Former teammate']))
    return (id: string) => m.get(id) ?? 'Former teammate'
  }, [users])
  const roleOf = useMemo(() => {
    const m = new Map(users.map((u) => [u.id, u.role]))
    return (id: string) => m.get(id) ?? ''
  }, [users])

  const subjects = useMemo(() => crewSubjectsInOrder(rows, nameOf), [rows, nameOf])

  if (loading) return <p style={{ color: 'var(--text-muted)', margin: '0.75rem 0' }}>Loading…</p>
  if (subjects.length === 0) {
    return (
      <p style={{ color: 'var(--text-muted)', margin: '0.75rem 0', fontSize: '0.9rem' }}>
        No crew ratings yet. With Team feedback on, the deck is dealt at the next clock-out; ratings appear here as they land.
      </p>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.75rem' }}>
      <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
        <span>
          <span style={legendSwatch(1)} /> Crew · average of each rater&rsquo;s latest rating
        </span>
        <span>
          <span style={legendSwatch(0.45)} /> Office · from Team → Review
        </span>
        <span>Orange chip: crew and office differ by {CREW_OFFICE_GAP}+ on a dimension.</span>
      </div>
      {subjects.map((subjectId) => {
        const s = summarizeCrewSubject(rows, subjectId)
        const raters = latestReviewsByReviewer(rows.filter((r) => r.source === 'crew'), subjectId)
        const ratersOpen = openRaters.has(subjectId)
        return (
          <div key={subjectId} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.75rem 0.9rem', background: 'var(--surface)' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, color: 'var(--text-strong)', fontSize: '1rem' }}>{nameOf(subjectId)}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{roleOf(subjectId)}</span>
              <span style={chipStyle('blue')}>
                {s.crewRaterCount} crew · {s.officeReviewerCount} office
              </span>
              {s.crewRaterCount < 2 && <span style={chipStyle('gray')}>office won&rsquo;t see this until 2 raters</span>}
              {s.gapDimensions.length > 0 && <span style={chipStyle('orange')}>crew and office split on {s.gapDimensions.join(', ')}</span>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '84px 1fr 52px', gap: '0.3rem 0.75rem', alignItems: 'center', marginTop: '0.6rem', fontSize: '0.8rem' }}>
              {s.lanes.map((lane) => (
                <LaneRow key={lane.key} short={lane.short} color={lane.color} crew={lane.crew} office={lane.office} />
              ))}
            </div>
            {s.crewNotes.length > 0 && (
              <div style={{ marginTop: '0.6rem', borderLeft: '2px solid var(--border)', paddingLeft: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {s.crewNotes.slice(0, 6).map((n, i) => (
                  <div key={i} style={{ fontSize: '0.8125rem', color: 'var(--text-700)' }}>
                    <span style={{ color: 'var(--text-faint)', fontSize: '0.72rem' }}>
                      {n.short} · {formatReviewMonthLabel(n.month)}
                    </span>{' '}
                    {n.text}
                  </div>
                ))}
                {s.crewNotes.length > 6 && <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>+{s.crewNotes.length - 6} more notes</span>}
              </div>
            )}
            <button
              type="button"
              onClick={() =>
                setOpenRaters((set) => {
                  const next = new Set(set)
                  if (next.has(subjectId)) next.delete(subjectId)
                  else next.add(subjectId)
                  return next
                })
              }
              style={{ marginTop: '0.5rem', background: 'none', border: 'none', padding: 0, color: 'var(--text-link)', fontSize: '0.78rem', cursor: 'pointer' }}
            >
              {ratersOpen ? 'Hide who rated' : 'Who rated (dev only)'}
            </button>
            {ratersOpen && (
              <div style={{ marginTop: '0.35rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                {raters.map((r) => (
                  <div key={r.id} style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                    <span style={{ color: 'var(--text-strong)', fontWeight: 600 }}>{nameOf(r.reviewer_user_id)}</span> · {formatReviewMonthLabel(r.review_month)} ·{' '}
                    {[r.rating_ability, r.rating_drive, r.rating_integrity].map((v) => (v == null ? '—' : v)).join(' · ')}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function LaneRow({ short, color, crew, office }: { short: string; color: string; crew: number | null; office: number | null }) {
  return (
    <>
      <div style={{ color: 'var(--text-700)', fontWeight: 600 }}>
        {short}
        <small style={{ display: 'block', color: 'var(--text-faint)', fontWeight: 400, fontSize: '0.68rem' }}>crew / office</small>
      </div>
      <div>
        <Bar value={crew} color={color} opacity={1} />
        <Bar value={office} color={color} opacity={0.45} />
      </div>
      <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-700)' }}>
        {crew == null ? '—' : Math.round(crew)}
        <small style={{ display: 'block', color: 'var(--text-faint)' }}>{office == null ? '—' : Math.round(office)}</small>
      </div>
    </>
  )
}

function Bar({ value, color, opacity }: { value: number | null; color: string; opacity: number }) {
  return (
    <div aria-hidden style={{ height: 5, borderRadius: 999, background: 'var(--bg-muted)', overflow: 'hidden', marginTop: 3 }}>
      <div style={{ height: '100%', width: `${value ?? 0}%`, background: color, opacity, borderRadius: 999 }} />
    </div>
  )
}

function legendSwatch(opacity: number) {
  return { display: 'inline-block', width: 14, height: 5, borderRadius: 999, background: 'var(--text-muted)', opacity, marginRight: 6, verticalAlign: 'middle' } as const
}

function chipStyle(kind: 'blue' | 'gray' | 'orange') {
  const palette = {
    blue: { background: 'var(--bg-blue-tint)', color: 'var(--text-blue-700)' },
    gray: { background: 'var(--bg-muted)', color: 'var(--text-muted)' },
    orange: { background: 'var(--bg-orange-tint)', color: 'var(--text-orange-700)' },
  }[kind]
  return { ...palette, fontSize: '0.7rem', fontWeight: 700, padding: '1px 8px', borderRadius: 999 } as const
}
