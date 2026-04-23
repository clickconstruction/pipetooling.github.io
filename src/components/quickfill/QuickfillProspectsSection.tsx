import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { loadProspectTeamActivity, type ProspectTeamRow } from '../../lib/prospectTeamActivity'
import { loadProspectWarmthCounts, type ProspectWarmthCounts } from '../../lib/prospectWarmthCounts'
import { useAuth } from '../../hooks/useAuth'
import { useReportQuickfillSectionMetric } from '../../contexts/QuickfillSectionMetricsContext'

const ROW_STYLE: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: '0.9375rem',
  padding: '0.35rem 0',
  borderBottom: '1px solid #f3f4f6',
  fontVariantNumeric: 'tabular-nums',
}

function WarmthBlock({ counts }: { counts: ProspectWarmthCounts }) {
  return (
    <div style={{ marginBottom: '1.25rem' }}>
      <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#374151', marginBottom: '0.5rem' }}>Active prospects by warmth</div>
      <div style={ROW_STYLE}>
        <span>Warmth 3</span>
        <span>({counts.w3})</span>
      </div>
      <div style={ROW_STYLE}>
        <span>Warmth 2</span>
        <span>({counts.w2})</span>
      </div>
      <div style={ROW_STYLE}>
        <span>Warmth 1</span>
        <span>({counts.w1})</span>
      </div>
      <div style={{ ...ROW_STYLE, borderBottom: 'none' }}>
        <span>Warmth 0</span>
        <span>({counts.w0})</span>
      </div>
      {counts.w4plus > 0 && (
        <div style={{ ...ROW_STYLE, borderBottom: 'none', paddingTop: '0.25rem' }}>
          <span>Warmth 4+</span>
          <span>({counts.w4plus})</span>
        </div>
      )}
    </div>
  )
}

function TeamTables({
  teamDataByDate,
  teamLoading,
  teamError,
}: {
  teamDataByDate: Record<string, ProspectTeamRow[]>
  teamLoading: boolean
  teamError: string | null
}) {
  if (teamError) {
    return <p style={{ color: '#b91c1c', fontSize: '0.875rem' }}>{teamError}</p>
  }
  if (teamLoading) {
    return <p style={{ color: '#6b7280' }}>Loading team activity…</p>
  }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dates: string[] = []
  for (let i = 0; i < 30; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    dates.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    )
  }
  const sections = dates
    .map((dk) => {
      const rows = teamDataByDate[dk] ?? []
      const visibleRows = rows.filter((r) => r.cards_marked > 0 || r.cards_updated > 0)
      if (rows.length === 0 || visibleRows.length === 0) return null
      const d = new Date(`${dk}T12:00:00`)
      const dateLabel = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
      return (
        <section key={dk} style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ padding: '0.5rem 1rem', background: '#f9fafb', fontWeight: 600, fontSize: '0.9375rem' }}>{dateLabel}</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 600 }}>User</th>
                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 600 }}>Marked</th>
                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 600 }}>Updated</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((r) => (
                  <tr key={r.user_id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '0.5rem 0.75rem' }}>{r.name}</td>
                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.cards_marked}</td>
                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.cards_updated}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )
    })
    .filter((x) => x != null)
  if (sections.length === 0) {
    return <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>No team activity in the last 30 days (marked or updated prospects).</p>
  }
  return <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>{sections}</div>
}

export function QuickfillProspectsSection() {
  const { user: authUser, role, estimatorProspectsAccess } = useAuth()
  const canAccess =
    authUser != null &&
    role != null &&
    (role === 'dev' || role === 'master_technician' || role === 'assistant' || (role === 'estimator' && estimatorProspectsAccess))
  const canAccessTeam = role != null && (role === 'dev' || role === 'master_technician' || role === 'assistant')

  const [warmth, setWarmth] = useState<ProspectWarmthCounts | null>(null)
  const [warmthLoading, setWarmthLoading] = useState(true)
  const [teamDataByDate, setTeamDataByDate] = useState<Record<string, ProspectTeamRow[]>>({})
  const [teamLoading, setTeamLoading] = useState(false)
  const [teamError, setTeamError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!canAccess) return
    setWarmthLoading(true)
    setTeamError(null)
    try {
      const w = await loadProspectWarmthCounts(supabase)
      setWarmth(w)
    } catch {
      setWarmth(null)
    } finally {
      setWarmthLoading(false)
    }
    if (canAccessTeam) {
      setTeamLoading(true)
      try {
        const t = await loadProspectTeamActivity(supabase)
        setTeamDataByDate(t)
      } catch {
        setTeamDataByDate({})
        setTeamError('Could not load team activity.')
      } finally {
        setTeamLoading(false)
      }
    } else {
      setTeamDataByDate({})
      setTeamLoading(false)
    }
  }, [canAccess, canAccessTeam])

  useEffect(() => {
    void load()
  }, [load])

  const totalForMetric = warmth?.totalActive ?? null
  useReportQuickfillSectionMetric('prospects', totalForMetric, warmthLoading)

  if (!canAccess) {
    return <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>You do not have access to Prospects in Quickfill.</p>
  }

  return (
    <div style={{ marginBottom: '1rem' }}>
      {warmthLoading && !warmth ? (
        <p style={{ color: '#6b7280' }}>Loading…</p>
      ) : warmth ? (
        <WarmthBlock counts={warmth} />
      ) : (
        <p style={{ color: '#6b7280' }}>Could not load warmth counts.</p>
      )}

      {canAccessTeam && (
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#374151', marginBottom: '0.5rem' }}>Team (last 30 days)</div>
          <TeamTables teamDataByDate={teamDataByDate} teamLoading={teamLoading} teamError={teamError} />
        </div>
      )}

      <Link
        to="/prospects?tab=prospect-list"
        style={{
          display: 'block',
          textAlign: 'center',
          padding: '0.85rem 1.25rem',
          background: '#3b82f6',
          color: 'white',
          fontWeight: 600,
          fontSize: '1.0625rem',
          borderRadius: 8,
          textDecoration: 'none',
        }}
      >
        Open Prospects
      </Link>
    </div>
  )
}
