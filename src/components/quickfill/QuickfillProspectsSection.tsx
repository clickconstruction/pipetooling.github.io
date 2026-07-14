import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { loadProspectTeamActivity, type ProspectTeamRow } from '../../lib/prospectTeamActivity'
import { loadProspectWarmthCounts, type ProspectWarmthCounts } from '../../lib/prospectWarmthCounts'
import { useAuth } from '../../hooks/useAuth'
import { useReportQuickfillSectionMetric } from '../../contexts/QuickfillSectionMetricsContext'
import { ProspectTeamActivityLineChart } from './ProspectTeamActivityLineChart'
import { isAssistantLike } from '../../lib/subcontractorLikeRole'

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
      <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-700)', marginBottom: '0.5rem' }}>Active prospects by warmth</div>
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

export function QuickfillProspectsSection() {
  const { user: authUser, role, estimatorProspectsAccess } = useAuth()
  const canAccess =
    authUser != null &&
    role != null &&
    (role === 'dev' || role === 'master_technician' || isAssistantLike(role) || (role === 'estimator' && estimatorProspectsAccess))
  const canAccessTeam = role != null && (role === 'dev' || role === 'master_technician' || isAssistantLike(role))

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
    return <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>You do not have access to Prospects in Quickfill.</p>
  }

  return (
    <div style={{ marginBottom: '1rem' }}>
      <Link
        to="/prospects?tab=prospect-list"
        style={{
          display: 'block',
          textAlign: 'center',
          padding: '0.85rem 1.25rem',
          marginBottom: '1.25rem',
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

      {warmthLoading && !warmth ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
      ) : warmth ? (
        <WarmthBlock counts={warmth} />
      ) : (
        <p style={{ color: 'var(--text-muted)' }}>Could not load warmth counts.</p>
      )}

      {canAccessTeam && (
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-700)', marginBottom: '0.25rem' }}>Team (last 30 days)</div>
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            Daily total = Marked + Updated (unique prospects per day from timers and from comments)
          </p>
          <ProspectTeamActivityLineChart
            teamDataByDate={teamDataByDate}
            teamLoading={teamLoading}
            teamError={teamError}
          />
        </div>
      )}
    </div>
  )
}
