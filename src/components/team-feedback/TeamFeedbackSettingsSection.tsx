import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react'
import { supabase } from '../../lib/supabase'
import { fetchTeamFeedbackSettings, type TeamFeedbackSettingsRow } from '../../lib/teamFeedback'
import {
  DEFAULT_INCLUSION_LABEL_MANAGER,
  DEFAULT_INCLUSION_LABEL_OPEN,
  DEFAULT_INCLUSION_LABEL_PEER,
  DEFAULT_INCLUSION_SUBTITLE,
  DEFAULT_INCLUSION_TITLE,
  DEFAULT_MANAGER_LIKERT_PROMPTS,
  DEFAULT_MANAGER_OVERALL_PROMPT,
  DEFAULT_MANAGER_STEP_HEADING,
  DEFAULT_PEER_LIKERT_PROMPTS,
  DEFAULT_PEER_STEP_HEADING,
  normalizeLikertPrompts,
} from '../../lib/teamFeedbackCopy'
import type { Json } from '../../types/database'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'
import { useAuth } from '../../hooks/useAuth'
import TeamFeedbackWizard, { type TeamFeedbackPreviewTarget } from './TeamFeedbackWizard'

type TestFeedbackMode = 'quick' | 'clock_out_intro'

export type TeamFeedbackSettingsControlled = {
  row: TeamFeedbackSettingsRow | null
  setRow: Dispatch<SetStateAction<TeamFeedbackSettingsRow | null>>
  loading: boolean
  onReload: () => Promise<void>
}

export type TeamFeedbackSettingsSectionProps = {
  hideEnabled?: boolean
  controlled?: TeamFeedbackSettingsControlled
}

const previewRowGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) 12.5rem',
  gap: '0.75rem',
  alignItems: 'center',
  marginBottom: '0.75rem',
}

function TeamFeedbackPreviewRow({
  label,
  previewTitle,
  scopeLine,
  disabled,
  onPreview,
  rowStyle,
}: {
  label: ReactNode
  previewTitle: string
  scopeLine: string
  disabled: boolean
  onPreview: () => void
  rowStyle?: CSSProperties
}) {
  return (
    <div style={{ ...previewRowGridStyle, ...rowStyle }}>
      {label}
      <button
        type="button"
        className="tf-team-feedback-preview-btn"
        disabled={disabled}
        title={previewTitle}
        onClick={onPreview}
      >
        <span className="tf-team-feedback-preview-btn-line1">Preview</span>
        <span className="tf-team-feedback-preview-btn-line2">{scopeLine}</span>
      </button>
    </div>
  )
}

export default function TeamFeedbackSettingsSection({
  hideEnabled = false,
  controlled,
}: TeamFeedbackSettingsSectionProps = {}) {
  const { user: authUser } = useAuth()
  const { showToast } = useToastContext()
  const [internalLoading, setInternalLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [internalRow, setInternalRow] = useState<TeamFeedbackSettingsRow | null>(null)

  const row = controlled ? controlled.row : internalRow
  const setRow = controlled ? controlled.setRow : setInternalRow
  const loading = controlled ? controlled.loading : internalLoading
  const [mgrLikertDraft, setMgrLikertDraft] = useState<string[] | null>(null)
  const [peerLikertDraft, setPeerLikertDraft] = useState<string[] | null>(null)
  const [inclusionCopyOpen, setInclusionCopyOpen] = useState(false)
  const [managerCopyOpen, setManagerCopyOpen] = useState(false)
  const [peerCopyOpen, setPeerCopyOpen] = useState(false)
  const wasLoadingRef = useRef(false)
  const [testWizardOpen, setTestWizardOpen] = useState(false)
  const [testMode, setTestMode] = useState<TestFeedbackMode>('quick')
  const [featurePreviewOpen, setFeaturePreviewOpen] = useState(false)
  const [featurePreviewTarget, setFeaturePreviewTarget] = useState<TeamFeedbackPreviewTarget | null>(null)

  const loadInternal = useCallback(async () => {
    setInternalLoading(true)
    try {
      const s = await fetchTeamFeedbackSettings()
      setInternalRow(s)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to load team feedback settings', 'error')
    } finally {
      setInternalLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    if (!controlled) void loadInternal()
  }, [controlled, loadInternal])

  useEffect(() => {
    if (wasLoadingRef.current && !loading && row) {
      setMgrLikertDraft(null)
      setPeerLikertDraft(null)
    }
    wasLoadingRef.current = loading
  }, [loading, row])

  async function save() {
    if (!row) return
    const mgrLines =
      mgrLikertDraft ?? normalizeLikertPrompts(row.manager_likert_prompts, DEFAULT_MANAGER_LIKERT_PROMPTS)
    const peerLines =
      peerLikertDraft ?? normalizeLikertPrompts(row.peer_likert_prompts, DEFAULT_PEER_LIKERT_PROMPTS)

    let manager_likert_prompts: Json | null = null
    if (mgrLines.every((s, i) => s.trim() === DEFAULT_MANAGER_LIKERT_PROMPTS[i])) {
      manager_likert_prompts = null
    } else if (mgrLines.some((s) => !s.trim())) {
      showToast('Fill all 5 manager rating prompts, or match defaults to use built-in copy', 'error')
      return
    } else {
      manager_likert_prompts = mgrLines.map((s) => s.trim()) as unknown as Json
    }

    let peer_likert_prompts: Json | null = null
    if (peerLines.every((s, i) => s.trim() === DEFAULT_PEER_LIKERT_PROMPTS[i])) {
      peer_likert_prompts = null
    } else if (peerLines.some((s) => !s.trim())) {
      showToast('Fill all 5 peer rating prompts, or match defaults to use built-in copy', 'error')
      return
    } else {
      peer_likert_prompts = peerLines.map((s) => s.trim()) as unknown as Json
    }

    setSaving(true)
    try {
      await withSupabaseRetry(
        async () =>
          supabase
            .from('team_feedback_settings')
            .update({
              enabled: row.enabled,
              cadence_days: row.cadence_days,
              intro_copy: row.intro_copy,
              thank_you_copy: row.thank_you_copy,
              manager_section_enabled: row.manager_section_enabled,
              peer_section_enabled: row.peer_section_enabled,
              home_entry_enabled: row.home_entry_enabled,
              comment_only_enabled: row.comment_only_enabled,
              inclusion_title: row.inclusion_title?.trim() || null,
              inclusion_subtitle: row.inclusion_subtitle?.trim() || null,
              inclusion_label_manager: row.inclusion_label_manager?.trim() || null,
              inclusion_label_peer: row.inclusion_label_peer?.trim() || null,
              inclusion_label_open: row.inclusion_label_open?.trim() || null,
              manager_likert_prompts,
              peer_likert_prompts,
              manager_overall_prompt: row.manager_overall_prompt?.trim() || null,
              manager_step_heading: row.manager_step_heading?.trim() || null,
              peer_step_heading: row.peer_step_heading?.trim() || null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', 1),
        'update team_feedback_settings'
      )
      showToast('Team feedback settings saved', 'success')
      if (controlled) await controlled.onReload()
      else void loadInternal()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading || !row) {
    return <p style={{ color: 'var(--text-muted)' }}>Loading team feedback settings…</p>
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <style>{`
        .tf-team-feedback-preview-btn {
          box-sizing: border-box;
          width: 100%;
          padding: 0.45rem 0.65rem;
          border-radius: 6px;
          border: 1px solid #d1d5db;
          background: white;
          text-align: center;
          transition: border-color 0.15s ease, background-color 0.15s ease;
          cursor: pointer;
        }
        .tf-team-feedback-preview-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .tf-team-feedback-preview-btn:not(:disabled):hover {
          border-color: #fdba74;
          background: #fff7ed;
        }
        .tf-team-feedback-preview-btn:not(:disabled):focus-visible {
          outline: 2px solid #ea580c;
          outline-offset: 2px;
        }
        .tf-team-feedback-preview-btn-line1 {
          display: block;
          font-weight: 600;
          font-size: 0.8125rem;
          color: #374151;
        }
        .tf-team-feedback-preview-btn-line2 {
          display: block;
          font-size: 0.75rem;
          font-weight: 500;
          color: #6b7280;
          margin-top: 0.15rem;
          line-height: 1.25;
        }
      `}</style>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>
        Controls the post clock-out prompt and dashboard entry.
      </p>
      {!hideEnabled && (
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <input
            type="checkbox"
            checked={row.enabled}
            onChange={(e) => setRow({ ...row, enabled: e.target.checked })}
          />
          <span>Enabled</span>
        </label>
      )}
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '0.75rem',
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontWeight: 500 }}>Cadence (days):</span>
        <input
          type="number"
          min={1}
          max={365}
          value={row.cadence_days}
          onChange={(e) => setRow({ ...row, cadence_days: Math.max(1, Math.min(365, Number(e.target.value) || 28)) })}
          style={{ width: 120, padding: '0.35rem 0.5rem', borderRadius: 6, border: '1px solid var(--border-strong)' }}
        />
      </label>
      <TeamFeedbackPreviewRow
        label={
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
            <input
              type="checkbox"
              checked={row.manager_section_enabled}
              onChange={(e) => setRow({ ...row, manager_section_enabled: e.target.checked })}
            />
            <span>Manager / lead survey section</span>
          </label>
        }
        previewTitle="Dry-run preview: jump to the manager / lead Likert step."
        scopeLine="Manager / lead"
        disabled={!authUser?.id}
        onPreview={() => {
          setTestWizardOpen(false)
          setFeaturePreviewTarget('manager')
          setFeaturePreviewOpen(true)
        }}
      />
      <TeamFeedbackPreviewRow
        label={
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
            <input
              type="checkbox"
              checked={row.peer_section_enabled}
              onChange={(e) => setRow({ ...row, peer_section_enabled: e.target.checked })}
            />
            <span>Peer feedback section</span>
          </label>
        }
        previewTitle="Dry-run preview: jump to the peer teammate rating step."
        scopeLine="Peer"
        disabled={!authUser?.id}
        onPreview={() => {
          setTestWizardOpen(false)
          setFeaturePreviewTarget('peer')
          setFeaturePreviewOpen(true)
        }}
      />
      <TeamFeedbackPreviewRow
        rowStyle={{ marginBottom: '0.25rem' }}
        label={
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
            <input
              type="checkbox"
              checked={row.home_entry_enabled}
              onChange={(e) => setRow({ ...row, home_entry_enabled: e.target.checked })}
            />
            <span>Dashboard “Quick feedback” button</span>
          </label>
        }
        previewTitle='Dry-run preview: same flow as after tapping Dashboard "Quick feedback" (intro skipped).'
        scopeLine="Dashboard"
        disabled={!authUser?.id}
        onPreview={() => {
          setTestWizardOpen(false)
          setFeaturePreviewTarget('home_flow')
          setFeaturePreviewOpen(true)
        }}
      />
      <TeamFeedbackPreviewRow
        label={
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
            <input
              type="checkbox"
              checked={row.comment_only_enabled}
              onChange={(e) => setRow({ ...row, comment_only_enabled: e.target.checked })}
            />
            <span>Allow comments-only path</span>
          </label>
        }
        previewTitle="Dry-run preview: jump to the comments-only path (no Likert ratings)."
        scopeLine="Comments-only"
        disabled={!authUser?.id}
        onPreview={() => {
          setTestWizardOpen(false)
          setFeaturePreviewTarget('comment_only')
          setFeaturePreviewOpen(true)
        }}
      />
      <label style={{ display: 'block', marginBottom: '0.75rem' }}>
        <span style={{ display: 'block', fontWeight: 500, marginBottom: '0.25rem' }}>Intro copy (optional)</span>
        <textarea
          value={row.intro_copy ?? ''}
          onChange={(e) => setRow({ ...row, intro_copy: e.target.value || null })}
          rows={3}
          style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border-strong)' }}
        />
      </label>
      <label style={{ display: 'block', marginBottom: '1rem' }}>
        <span style={{ display: 'block', fontWeight: 500, marginBottom: '0.25rem' }}>Thank you copy (optional)</span>
        <textarea
          value={row.thank_you_copy ?? ''}
          onChange={(e) => setRow({ ...row, thank_you_copy: e.target.value || null })}
          rows={2}
          style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border-strong)' }}
        />
      </label>
      <div
        style={{
          marginBottom: '1rem',
          padding: '0.75rem',
          borderRadius: 8,
          border: '1px solid var(--border)',
          background: 'var(--bg-subtle)',
        }}
      >
        <button
          type="button"
          onClick={() => setInclusionCopyOpen((v) => !v)}
          aria-expanded={inclusionCopyOpen}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            width: '100%',
            margin: 0,
            marginBottom: inclusionCopyOpen ? '0.35rem' : 0,
            padding: 0,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '0.875rem',
            color: 'var(--text-strong)',
            textAlign: 'left',
          }}
        >
          <span style={{ fontSize: '0.75rem' }}>{inclusionCopyOpen ? '▼' : '▶'}</span>
          Inclusion step (optional)
        </button>
        {inclusionCopyOpen && (
          <>
        <p style={{ margin: '0 0 0.65rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          Leave blank to use the default title, subtitle, and toggle labels on the “what to include” step.
        </p>
        <label style={{ display: 'block', marginBottom: '0.5rem' }}>
          <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, marginBottom: '0.2rem' }}>Title</span>
          <input
            type="text"
            value={row.inclusion_title ?? ''}
            onChange={(e) => setRow({ ...row, inclusion_title: e.target.value || null })}
            placeholder={DEFAULT_INCLUSION_TITLE}
            style={{ width: '100%', padding: '0.45rem 0.5rem', borderRadius: 6, border: '1px solid var(--border-strong)' }}
          />
        </label>
        <label style={{ display: 'block', marginBottom: '0.5rem' }}>
          <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, marginBottom: '0.2rem' }}>Subtitle</span>
          <textarea
            value={row.inclusion_subtitle ?? ''}
            onChange={(e) => setRow({ ...row, inclusion_subtitle: e.target.value || null })}
            placeholder={DEFAULT_INCLUSION_SUBTITLE}
            rows={2}
            style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border-strong)' }}
          />
        </label>
        <label style={{ display: 'block', marginBottom: '0.5rem' }}>
          <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, marginBottom: '0.2rem' }}>
            Manager toggle label
          </span>
          <input
            type="text"
            value={row.inclusion_label_manager ?? ''}
            onChange={(e) => setRow({ ...row, inclusion_label_manager: e.target.value || null })}
            placeholder={DEFAULT_INCLUSION_LABEL_MANAGER}
            style={{ width: '100%', padding: '0.45rem 0.5rem', borderRadius: 6, border: '1px solid var(--border-strong)' }}
          />
        </label>
        <label style={{ display: 'block', marginBottom: '0.5rem' }}>
          <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, marginBottom: '0.2rem' }}>Peer toggle label</span>
          <input
            type="text"
            value={row.inclusion_label_peer ?? ''}
            onChange={(e) => setRow({ ...row, inclusion_label_peer: e.target.value || null })}
            placeholder={DEFAULT_INCLUSION_LABEL_PEER}
            style={{ width: '100%', padding: '0.45rem 0.5rem', borderRadius: 6, border: '1px solid var(--border-strong)' }}
          />
        </label>
        <label style={{ display: 'block', marginBottom: 0 }}>
          <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, marginBottom: '0.2rem' }}>
            Open comments toggle label
          </span>
          <input
            type="text"
            value={row.inclusion_label_open ?? ''}
            onChange={(e) => setRow({ ...row, inclusion_label_open: e.target.value || null })}
            placeholder={DEFAULT_INCLUSION_LABEL_OPEN}
            style={{ width: '100%', padding: '0.45rem 0.5rem', borderRadius: 6, border: '1px solid var(--border-strong)' }}
          />
        </label>
          </>
        )}
      </div>
      <div
        style={{
          marginBottom: '1rem',
          padding: '0.75rem',
          borderRadius: 8,
          border: '1px solid var(--border)',
          background: 'var(--bg-subtle)',
        }}
      >
        <button
          type="button"
          onClick={() => setManagerCopyOpen((v) => !v)}
          aria-expanded={managerCopyOpen}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            width: '100%',
            margin: 0,
            marginBottom: managerCopyOpen ? '0.35rem' : 0,
            padding: 0,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '0.875rem',
            color: 'var(--text-strong)',
            textAlign: 'left',
          }}
        >
          <span style={{ fontSize: '0.75rem' }}>{managerCopyOpen ? '▼' : '▶'}</span>
          Manager ratings copy (optional)
        </button>
        {managerCopyOpen && (
          <>
        <p style={{ margin: '0 0 0.65rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          Five Likert prompts, step heading, and overall 1–10 question. Leave blank or match defaults for built-in copy.
        </p>
        <label style={{ display: 'block', marginBottom: '0.5rem' }}>
          <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, marginBottom: '0.2rem' }}>Step heading</span>
          <input
            type="text"
            value={row.manager_step_heading ?? ''}
            onChange={(e) => setRow({ ...row, manager_step_heading: e.target.value || null })}
            placeholder={DEFAULT_MANAGER_STEP_HEADING}
            style={{ width: '100%', padding: '0.45rem 0.5rem', borderRadius: 6, border: '1px solid var(--border-strong)' }}
          />
        </label>
        {Array.from({ length: 5 }, (_, i) => (
          <label key={`mgr-likert-${i}`} style={{ display: 'block', marginBottom: '0.5rem' }}>
            <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
              Likert {i + 1}
            </span>
            <textarea
              value={
                (mgrLikertDraft ??
                  normalizeLikertPrompts(row.manager_likert_prompts, DEFAULT_MANAGER_LIKERT_PROMPTS))[i]
              }
              placeholder={DEFAULT_MANAGER_LIKERT_PROMPTS[i]}
              onChange={(e) => {
                const base =
                  mgrLikertDraft ??
                  normalizeLikertPrompts(row.manager_likert_prompts, DEFAULT_MANAGER_LIKERT_PROMPTS)
                const next = [...base]
                next[i] = e.target.value
                setMgrLikertDraft(next)
              }}
              rows={2}
              style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border-strong)' }}
            />
          </label>
        ))}
        <label style={{ display: 'block', marginBottom: 0 }}>
          <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, marginBottom: '0.2rem' }}>
            Overall satisfaction prompt (1–10)
          </span>
          <input
            type="text"
            value={row.manager_overall_prompt ?? ''}
            onChange={(e) => setRow({ ...row, manager_overall_prompt: e.target.value || null })}
            placeholder={DEFAULT_MANAGER_OVERALL_PROMPT}
            style={{ width: '100%', padding: '0.45rem 0.5rem', borderRadius: 6, border: '1px solid var(--border-strong)' }}
          />
        </label>
          </>
        )}
      </div>
      <div
        style={{
          marginBottom: '1rem',
          padding: '0.75rem',
          borderRadius: 8,
          border: '1px solid var(--border)',
          background: 'var(--bg-subtle)',
        }}
      >
        <button
          type="button"
          onClick={() => setPeerCopyOpen((v) => !v)}
          aria-expanded={peerCopyOpen}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            width: '100%',
            margin: 0,
            marginBottom: peerCopyOpen ? '0.35rem' : 0,
            padding: 0,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '0.875rem',
            color: 'var(--text-strong)',
            textAlign: 'left',
          }}
        >
          <span style={{ fontSize: '0.75rem' }}>{peerCopyOpen ? '▼' : '▶'}</span>
          Peer ratings copy (optional)
        </button>
        {peerCopyOpen && (
          <>
        <p style={{ margin: '0 0 0.65rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          Five Likert prompts and step heading. Leave blank or match defaults for built-in copy.
        </p>
        <label style={{ display: 'block', marginBottom: '0.5rem' }}>
          <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, marginBottom: '0.2rem' }}>Step heading</span>
          <input
            type="text"
            value={row.peer_step_heading ?? ''}
            onChange={(e) => setRow({ ...row, peer_step_heading: e.target.value || null })}
            placeholder={DEFAULT_PEER_STEP_HEADING}
            style={{ width: '100%', padding: '0.45rem 0.5rem', borderRadius: 6, border: '1px solid var(--border-strong)' }}
          />
        </label>
        {Array.from({ length: 5 }, (_, i) => (
          <label key={`peer-likert-${i}`} style={{ display: 'block', marginBottom: i === 4 ? 0 : '0.5rem' }}>
            <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
              Likert {i + 1}
            </span>
            <textarea
              value={
                (peerLikertDraft ??
                  normalizeLikertPrompts(row.peer_likert_prompts, DEFAULT_PEER_LIKERT_PROMPTS))[i]
              }
              placeholder={DEFAULT_PEER_LIKERT_PROMPTS[i]}
              onChange={(e) => {
                const base =
                  peerLikertDraft ??
                  normalizeLikertPrompts(row.peer_likert_prompts, DEFAULT_PEER_LIKERT_PROMPTS)
                const next = [...base]
                next[i] = e.target.value
                setPeerLikertDraft(next)
              }}
              rows={2}
              style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border-strong)' }}
            />
          </label>
        ))}
          </>
        )}
      </div>
      <div
        style={{
          marginBottom: '1rem',
          padding: '0.75rem',
          borderRadius: 8,
          border: '1px dashed var(--border-strong)',
          background: 'var(--bg-page)',
        }}
      >
        <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.35rem' }}>Try the flow</div>
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          Quick preview skips the post–clock-out intro. Full intro matches the prompt after clock-out (30s auto-dismiss,
          Start / Snooze / Not now).
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          <button
            type="button"
            disabled={!authUser?.id}
            onClick={() => {
              setFeaturePreviewOpen(false)
              setFeaturePreviewTarget(null)
              setTestMode('quick')
              setTestWizardOpen(true)
            }}
            style={{
              padding: '0.4rem 0.75rem',
              borderRadius: 6,
              border: '1px solid #ea580c',
              background: 'var(--surface)',
              color: '#c2410c',
              fontWeight: 600,
              fontSize: '0.875rem',
              cursor: authUser?.id ? 'pointer' : 'not-allowed',
              opacity: authUser?.id ? 1 : 0.6,
            }}
          >
            Quick preview
          </button>
          <button
            type="button"
            disabled={!authUser?.id}
            onClick={() => {
              setFeaturePreviewOpen(false)
              setFeaturePreviewTarget(null)
              setTestMode('clock_out_intro')
              setTestWizardOpen(true)
            }}
            style={{
              padding: '0.4rem 0.75rem',
              borderRadius: 6,
              border: '1px solid #64748b',
              background: 'var(--surface)',
              color: '#334155',
              fontWeight: 600,
              fontSize: '0.875rem',
              cursor: authUser?.id ? 'pointer' : 'not-allowed',
              opacity: authUser?.id ? 1 : 0.6,
            }}
          >
            Test clock-out intro
          </button>
        </div>
        {!authUser?.id && (
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: 'var(--text-faint)' }}>Sign in to test the wizard.</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => void save()}
        disabled={saving}
        style={{
          padding: '0.5rem 1rem',
          borderRadius: 6,
          border: 'none',
          background: saving ? '#9ca3af' : '#ea580c',
          color: 'white',
          fontWeight: 600,
          cursor: saving ? 'not-allowed' : 'pointer',
        }}
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
      {testWizardOpen && authUser?.id && (
        <TeamFeedbackWizard
          open={testWizardOpen}
          onClose={() => setTestWizardOpen(false)}
          userId={authUser.id}
          source={testMode === 'quick' ? 'home_button' : 'clock_out_prompt'}
          skipIntro={testMode === 'quick'}
          quickDismiss
        />
      )}
      {featurePreviewOpen && authUser?.id && featurePreviewTarget && (
        <TeamFeedbackWizard
          open={featurePreviewOpen}
          onClose={() => {
            setFeaturePreviewOpen(false)
            setFeaturePreviewTarget(null)
          }}
          userId={authUser.id}
          source="home_button"
          skipIntro
          previewTarget={featurePreviewTarget}
          previewDryRun
        />
      )}
    </div>
  )
}
