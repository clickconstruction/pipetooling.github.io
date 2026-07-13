import { useCallback, useEffect, useState, type ChangeEvent } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabase'
import {
  fetchLastTeamFeedbackSubmissionCreatedAt,
  fetchTeamFeedbackSettings,
  type TeamFeedbackSettingsRow,
} from '../../lib/teamFeedback'
import { withSupabaseRetry } from '../../utils/errorHandling'
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

export type TeamFeedbackDevSettingsBlockProps = {
  /** `settings`: collapsible block for Settings. `standalone`: always expanded (e.g. People → Feedback tab). */
  layout?: 'settings' | 'standalone'
}

export default function TeamFeedbackDevSettingsBlock({ layout = 'settings' }: TeamFeedbackDevSettingsBlockProps) {
  const isStandalone = layout === 'standalone'
  const { showToast } = useToastContext()
  const [settingsSectionOpen, setSettingsSectionOpen] = useState(false)
  const sectionVisible = isStandalone || settingsSectionOpen
  const [row, setRow] = useState<TeamFeedbackSettingsRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastCreatedAt, setLastCreatedAt] = useState<string | null>(null)
  const [lastLoading, setLastLoading] = useState(false)
  const [settingsModalOpen, setSettingsModalOpen] = useState(false)
  const [enabledSaving, setEnabledSaving] = useState(false)

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
    if (!sectionVisible) return
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
  }, [sectionVisible])

  useEffect(() => {
    if (!isStandalone || !settingsModalOpen) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setSettingsModalOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isStandalone, settingsModalOpen])

  const onEnabledHeaderChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const checked = e.target.checked
      if (!row) return
      const previous = row.enabled
      setRow({ ...row, enabled: checked })
      setEnabledSaving(true)
      try {
        await withSupabaseRetry(
          async () =>
            supabase
              .from('team_feedback_settings')
              .update({
                enabled: checked,
                updated_at: new Date().toISOString(),
              })
              .eq('id', 1),
          'update team_feedback_settings enabled'
        )
        showToast('Team feedback settings saved', 'success')
      } catch (err) {
        setRow((r) => (r ? { ...r, enabled: previous } : r))
        showToast(err instanceof Error ? err.message : 'Could not save enabled setting', 'error')
      } finally {
        setEnabledSaving(false)
      }
    },
    [row, showToast]
  )

  return (
    <div
      style={{
        marginTop: isStandalone ? 0 : '2rem',
        marginBottom: isStandalone ? '1.5rem' : '2rem',
        border: '1px solid var(--border)',
        borderRadius: 8,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '1rem',
          flexWrap: 'wrap',
        }}
      >
        {isStandalone ? (
          <span
            style={{
              fontSize: '1rem',
              fontWeight: 600,
              color: 'var(--text-strong)',
              flex: '0 0 auto',
            }}
          >
            Team feedback
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setSettingsSectionOpen((prev) => !prev)}
            aria-expanded={settingsSectionOpen}
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
              color: 'var(--text-strong)',
            }}
          >
            <span style={{ fontSize: '0.75rem' }}>{settingsSectionOpen ? '\u25bc' : '\u25b6'}</span>
            Team feedback
          </button>
        )}
        {sectionVisible && row && (
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              cursor: enabledSaving || loading ? 'wait' : 'pointer',
              opacity: enabledSaving || loading ? 0.7 : 1,
            }}
          >
            <input
              type="checkbox"
              checked={row.enabled}
              disabled={enabledSaving || loading}
              onChange={(e) => void onEnabledHeaderChange(e)}
            />
            <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Enabled</span>
          </label>
        )}
        {sectionVisible && (
          <div
            style={{
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              flexWrap: 'wrap',
              gap: '0.75rem',
              flex: '1 1 auto',
              minWidth: 0,
            }}
          >
            <span
              style={{
                fontSize: '0.8125rem',
                color: 'var(--text-muted)',
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
            {isStandalone && (
              <button
                type="button"
                onClick={() => setSettingsModalOpen(true)}
                style={{
                  flexShrink: 0,
                  padding: '0.35rem 0.75rem',
                  borderRadius: 6,
                  border: '1px solid var(--border-strong)',
                  background: 'var(--surface)',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'var(--text-700)',
                  cursor: 'pointer',
                }}
              >
                Settings
              </button>
            )}
          </div>
        )}
      </div>
      {sectionVisible && (
        <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid var(--border)' }}>
          {!isStandalone && (
            <TeamFeedbackSettingsSection
              hideEnabled
              controlled={{
                row,
                setRow,
                loading,
                onReload: load,
              }}
            />
          )}
          <TeamFeedbackDevReports />
          <TeamFeedbackEligibilityOverview />
        </div>
      )}
      {isStandalone &&
        settingsModalOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="presentation"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1000,
              background: 'rgba(15, 23, 42, 0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem',
              boxSizing: 'border-box',
            }}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setSettingsModalOpen(false)
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="team-feedback-settings-modal-title"
              onMouseDown={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: 720,
                maxHeight: 'min(90vh, 900px)',
                display: 'flex',
                flexDirection: 'column',
                background: 'var(--surface)',
                borderRadius: 10,
                border: '1px solid var(--border)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  padding: '0.85rem 1rem',
                  borderBottom: '1px solid var(--border)',
                  background: 'var(--bg-subtle)',
                }}
              >
                <h2
                  id="team-feedback-settings-modal-title"
                  style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-strong)' }}
                >
                  Settings
                </h2>
                <button
                  type="button"
                  onClick={() => setSettingsModalOpen(false)}
                  style={{
                    padding: '0.35rem 0.65rem',
                    borderRadius: 6,
                    border: '1px solid var(--border-strong)',
                    background: 'var(--surface)',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    color: 'var(--text-700)',
                    cursor: 'pointer',
                  }}
                >
                  Close
                </button>
              </div>
              <div style={{ overflow: 'auto', padding: '1rem', flex: '1 1 auto', minHeight: 0 }}>
                <TeamFeedbackSettingsSection
                  hideEnabled
                  controlled={{
                    row,
                    setRow,
                    loading,
                    onReload: load,
                  }}
                />
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
