/**
 * Team feedback admin (dev). Standalone on People → Feedback; collapsible on Settings → People &
 * accounts. v2.2824: the crew deck on the three bars — Ratings · Open words · Who's due ·
 * Settings · Retired questions, plus a Try-the-deck preview.
 */
import { useCallback, useEffect, useState, type ChangeEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { fetchLastTeamFeedbackSubmissionCreatedAt, fetchTeamFeedbackSettings, type TeamFeedbackSettingsRow } from '../../lib/teamFeedback'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'
import { useAuth } from '../../hooks/useAuth'
import { pageSubTabStyle } from '../../lib/pageTabStyle'
import CrewRatingsPanel from './CrewRatingsPanel'
import OpenWordsPanel from './OpenWordsPanel'
import TeamFeedbackEligibilityOverview from './TeamFeedbackEligibilityOverview'
import CrewFeedbackSettingsForm from './CrewFeedbackSettingsForm'
import RetiredQuestionsPanel from './RetiredQuestionsPanel'
import CrewReviewDeck from './CrewReviewDeck'

/** Relative phrase for “last collected” (min / hr / days / mo ago). */
function relativeTimeAgo(iso: string): string {
  const sec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
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

type Panel = 'ratings' | 'words' | 'due' | 'settings' | 'retired'
const PANELS: Array<{ id: Panel; label: string }> = [
  { id: 'ratings', label: 'Ratings' },
  { id: 'words', label: 'Open words' },
  { id: 'due', label: "Who's due" },
  { id: 'settings', label: 'Settings' },
  { id: 'retired', label: 'Retired questions' },
]

export type TeamFeedbackDevSettingsBlockProps = {
  /** `settings`: collapsible block for Settings. `standalone`: always expanded (People → Feedback tab). */
  layout?: 'settings' | 'standalone'
}

export default function TeamFeedbackDevSettingsBlock({ layout = 'settings' }: TeamFeedbackDevSettingsBlockProps) {
  const isStandalone = layout === 'standalone'
  const { showToast } = useToastContext()
  const { user: authUser } = useAuth()
  const [sectionOpen, setSectionOpen] = useState(false)
  const visible = isStandalone || sectionOpen
  const [row, setRow] = useState<TeamFeedbackSettingsRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastCreatedAt, setLastCreatedAt] = useState<string | null>(null)
  const [enabledSaving, setEnabledSaving] = useState(false)
  const [panel, setPanel] = useState<Panel>('ratings')
  const [previewOpen, setPreviewOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRow(await fetchTeamFeedbackSettings())
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
    if (!visible) return
    let cancelled = false
    fetchLastTeamFeedbackSubmissionCreatedAt()
      .then((t) => {
        if (!cancelled) setLastCreatedAt(t)
      })
      .catch(() => {
        if (!cancelled) setLastCreatedAt(null)
      })
    return () => {
      cancelled = true
    }
  }, [visible])

  const onEnabledChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const checked = e.target.checked
      if (!row) return
      const previous = row.enabled
      setRow({ ...row, enabled: checked })
      setEnabledSaving(true)
      try {
        await withSupabaseRetry(
          async () => supabase.from('team_feedback_settings').update({ enabled: checked, updated_at: new Date().toISOString() }).eq('id', 1),
          'update team_feedback_settings enabled',
        )
        showToast(checked ? 'Team feedback is on: the deck is dealt at the next eligible clock-out' : 'Team feedback is off', 'success')
      } catch (err) {
        setRow((r) => (r ? { ...r, enabled: previous } : r))
        showToast(err instanceof Error ? err.message : 'Could not save enabled setting', 'error')
      } finally {
        setEnabledSaving(false)
      }
    },
    [row, showToast],
  )

  return (
    <div style={{ marginTop: isStandalone ? 0 : '2rem', marginBottom: isStandalone ? '1.5rem' : '2rem', border: '1px solid var(--border)', borderRadius: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.85rem 1rem', flexWrap: 'wrap' }}>
        {isStandalone ? (
          <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-strong)' }}>Team feedback</span>
        ) : (
          <button
            type="button"
            onClick={() => setSectionOpen((p) => !p)}
            aria-expanded={sectionOpen}
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', margin: 0, padding: 0, background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', fontWeight: 600, color: 'var(--text-strong)' }}
          >
            <span style={{ fontSize: '0.75rem' }}>{sectionOpen ? '▼' : '▶'}</span>
            Team feedback
          </button>
        )}
        {visible && row && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: enabledSaving || loading ? 'wait' : 'pointer', opacity: enabledSaving || loading ? 0.7 : 1 }}>
            <input type="checkbox" checked={row.enabled} disabled={enabledSaving || loading} onChange={(e) => void onEnabledChange(e)} />
            <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Enabled</span>
          </label>
        )}
        {visible && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }} title={lastCreatedAt ?? undefined}>
              {lastCreatedAt ? `Last words: ${relativeTimeAgo(lastCreatedAt)}` : 'Last words: never'}
            </span>
            {authUser?.id && (
              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                title="Deal yourself the deck with your real teammates. Nothing is saved."
                style={{ padding: '0.35rem 0.75rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-700)', cursor: 'pointer' }}
              >
                Try the deck
              </button>
            )}
          </div>
        )}
      </div>
      {visible && (
        <div style={{ padding: '0 1rem 1rem', borderTop: '1px solid var(--border)' }}>
          <p style={{ margin: '0.75rem 0 0.5rem', fontSize: '0.8125rem', color: 'var(--text-muted)', maxWidth: 720 }}>
            At clock-out, people rate the teammates they shared jobs with (and their lead) on Ability, Drive, and Integrity, then write anything else. Crew ratings are anonymous to everyone but dev: the
            office sees averages in Team → Review once two people have rated someone.
          </p>
          <div role="tablist" aria-label="Team feedback views" style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', padding: '0.25rem 0 0.5rem', borderBottom: '1px solid var(--border)' }}>
            {PANELS.map((p) => (
              <button key={p.id} type="button" role="tab" aria-selected={panel === p.id} onClick={() => setPanel(p.id)} style={pageSubTabStyle(panel === p.id)}>
                {p.label}
              </button>
            ))}
          </div>
          {panel === 'ratings' && <CrewRatingsPanel />}
          {panel === 'words' && <OpenWordsPanel settings={row} />}
          {panel === 'due' && <TeamFeedbackEligibilityOverview />}
          {panel === 'settings' && <CrewFeedbackSettingsForm row={row} onSaved={setRow} />}
          {panel === 'retired' && <RetiredQuestionsPanel settings={row} />}
        </div>
      )}
      {authUser?.id && previewOpen && <CrewReviewDeck open onClose={() => setPreviewOpen(false)} userId={authUser.id} source="home_button" skipIntro preview />}
    </div>
  )
}
