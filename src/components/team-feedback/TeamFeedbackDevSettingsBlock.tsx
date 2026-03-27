import { useCallback, useEffect, useState } from 'react'
import {
  fetchLastTeamFeedbackSubmissionCreatedAt,
  fetchTeamFeedbackSettings,
  type TeamFeedbackSettingsRow,
} from '../../lib/teamFeedback'
import { useToastContext } from '../../contexts/ToastContext'
import TeamFeedbackDevReports from './TeamFeedbackDevReports'
import TeamFeedbackEligibilityOverview from './TeamFeedbackEligibilityOverview'
import TeamFeedbackSettingsSection from './TeamFeedbackSettingsSection'

/** Relative phrase for Settings-style “last collected” (min / hr / days / mo ago). */
function relativeTimeAgo(iso: string): string {
  const d = new Date(iso).getTime()
  const now = Date.now()
  const sec = Math.max(0, Math.floor((now - d) / 1000))
  if (sec < 60) return 'Just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} min ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} hr ago`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day} day${day === 1 ? '' : 's'} ago`
  const mo = Math.floor(day / 30)
  return `${mo} mo ago`
}

export default function TeamFeedbackDevSettingsBlock() {
  const { showToast } = useToastContext()
  const [teamFeedbackSectionOpen, setTeamFeedbackSectionOpen] = useState(false)
  const [row, setRow] = useState<TeamFeedbackSettingsRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastCreatedAt, setLastCreatedAt] = useState<string | null>(null)
  const [lastLoading, setLastLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const s = await fetchTeamFeedbackSettings()
      setRow(s)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to load team feedback settings', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!teamFeedbackSectionOpen) return
    let cancelled = false
    ;(async () => {
      setLastLoading(true)
      try {
        const t = await fetchLastTeamFeedbackSubmissionCreatedAt()
        if (!cancelled) setLastCreatedAt(t)
      } catch {
        if (!cancelled) setLastCreatedAt(null)
      } finally {
        if (!cancelled) setLastLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [teamFeedbackSectionOpen])

  return (
    <div style={{ marginTop: '2rem', marginBottom: '2rem', border: '1px solid #e5e7eb', borderRadius: 8 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          onClick={() => setTeamFeedbackSectionOpen((prev) => !prev)}
          aria-expanded={teamFeedbackSectionOpen}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            margin: 0,
            padding: 0,
            flex: '0 0 auto',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: 600,
            textAlign: 'left',
            color: '#111827',
          }}
        >
          <span style={{ fontSize: '0.75rem' }}>{teamFeedbackSectionOpen ? '▼' : '▶'}</span>
          Team feedback
        </button>
        {teamFeedbackSectionOpen && row && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={row.enabled}
              onChange={(e) => setRow({ ...row, enabled: e.target.checked })}
            />
            <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Enabled</span>
          </label>
        )}
        {teamFeedbackSectionOpen && (
          <span
            style={{
              marginLeft: 'auto',
              fontSize: '0.8125rem',
              color: '#6b7280',
              flex: '1 1 12rem',
              textAlign: 'right',
            }}
            title={lastCreatedAt ?? undefined}
          >
            {lastLoading
              ? 'Last collected: …'
              : lastCreatedAt
                ? `Last collected: ${new Date(lastCreatedAt).toLocaleString()} (${relativeTimeAgo(lastCreatedAt)})`
                : 'Last collected: Never'}
          </span>
        )}
      </div>
      {teamFeedbackSectionOpen && (
        <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid #e5e7eb' }}>
          <TeamFeedbackSettingsSection
            hideEnabled
            controlled={{
              row,
              setRow,
              loading,
              onReload: load,
            }}
          />
          <TeamFeedbackDevReports />
          <TeamFeedbackEligibilityOverview />
        </div>
      )}
    </div>
  )
}
