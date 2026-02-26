import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

export function UnpricedFixturesSection() {
  const { user: authUser, role } = useAuth()
  const [loading, setLoading] = useState(true)
  const [count, setCount] = useState<number>(0)

  useEffect(() => {
    if (!authUser?.id) return
    let cancelled = false

    async function load() {
      setLoading(true)
      const { data, error } = await supabase.rpc('list_tally_parts_with_po')
      if (error || cancelled) {
        setLoading(false)
        return
      }
      const rows = (data ?? []) as Array<{ job_id: string; part_id: string | null; fixture_cost: number | null }>
      const unpricedJobIds = new Set<string>()
      for (const r of rows) {
        if (r.part_id == null && (r.fixture_cost == null || Number(r.fixture_cost) === 0)) {
          unpricedJobIds.add(r.job_id)
        }
      }
      if (!cancelled) {
        setCount(unpricedJobIds.size)
      }
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [authUser?.id])

  const canAccess = role === 'dev' || role === 'master_technician' || role === 'assistant'
  if (!canAccess) return null

  if (loading) return null

  if (count === 0) return null

  return (
    <div
      style={{
        marginBottom: '1.5rem',
        padding: '1rem 1.25rem',
        background: '#fef2f2',
        border: '1px solid #fecaca',
        borderRadius: 8,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '0.75rem',
      }}
    >
      <span style={{ fontSize: '0.9375rem', fontWeight: 500, color: '#991b1b' }}>
        {count} job{count !== 1 ? 's' : ''} with unpriced fixtures
      </span>
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
