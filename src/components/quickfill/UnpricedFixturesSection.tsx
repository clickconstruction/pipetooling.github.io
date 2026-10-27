import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { isAssistantLike } from '../../lib/subcontractorLikeRole'
import { ageChipStyle } from '../../lib/ageState'
import { summarizeUnpricedFixtures, unpricedFixturesChipLabel, type UnpricedFixturesSummary } from '../../lib/quickfill/unpricedFixtures'
import { loadUnpricedFixtureRows } from '../../lib/quickfill/unpricedFixturesIo'

/**
 * Quickfill → Unpriced fixtures: a count of the jobs with a fixture nothing prices, the door to
 * Jobs → Parts, and since punch list #184 sweep B the oldest fixture's age on the
 * UNPRICED_PART_AGE scale. The read pages the unpriced fixtures only, oldest first.
 */
export function UnpricedFixturesSection() {
  const { user: authUser, role } = useAuth()
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<UnpricedFixturesSummary | null>(null)

  useEffect(() => {
    if (!authUser?.id) return
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const rows = await loadUnpricedFixtureRows()
        if (!cancelled) setSummary(summarizeUnpricedFixtures(rows))
      } catch {
        // Fail-soft, as before: a failed read shows nothing.
      }
      if (!cancelled) setLoading(false)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [authUser?.id])

  const canAccess = role === 'dev' || role === 'master_technician' || isAssistantLike(role)
  if (!canAccess) return null

  if (loading) return null

  const count = summary?.jobCount ?? 0
  if (count === 0) return null
  const oldestAge = summary?.oldestAge ?? null

  return (
    <div
      style={{
        marginBottom: '1.5rem',
        padding: '1rem 1.25rem',
        background: 'var(--bg-red-tint)',
        border: '1px solid #fecaca',
        borderRadius: 8,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '0.75rem',
      }}
    >
      <span style={{ fontSize: '0.9375rem', fontWeight: 500, color: 'var(--text-red-800)' }}>
        {count} job{count !== 1 ? 's' : ''} with unpriced fixtures
      </span>
      {oldestAge ? (
        <span
          data-unpriced-age={oldestAge.state}
          title={summary?.oldestCreatedAt ? `The oldest unpriced fixture was tallied ${new Date(summary.oldestCreatedAt).toLocaleDateString()}` : undefined}
          style={{ fontSize: '0.72rem', fontWeight: 600, padding: '0.08rem 0.5rem', borderRadius: 7, whiteSpace: 'nowrap', ...ageChipStyle(oldestAge.state) }}
        >
          {unpricedFixturesChipLabel(oldestAge)}
        </span>
      ) : null}
      <Link
        to="/jobs?tab=parts"
        style={{
          padding: '0.35rem 0.75rem',
          background: '#dc2626',
          color: 'white',
          borderRadius: 6,
          textDecoration: 'none',
          fontWeight: 600,
          fontSize: '0.875rem',
        }}
      >
        Price fixtures in Jobs Parts
      </Link>
    </div>
  )
}
