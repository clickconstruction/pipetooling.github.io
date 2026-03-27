import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  computeCyclePeriodStart,
  fetchPeerCandidates,
  fetchTeamFeedbackSettings,
  peerCandidateKey,
  resolveManagerUserIdForFeedback,
  submitTeamFeedback,
  upsertTeamFeedbackUserState,
  type PeerCandidate,
  type SubmitTeamFeedbackPayload,
  type TeamFeedbackSettingsRow,
  type TeamFeedbackSource,
} from '../../lib/teamFeedback'
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
import { useToastContext } from '../../contexts/ToastContext'
import PeerTeammatePicker from './PeerTeammatePicker'

const INTRO_AUTO_DISMISS_MS = 30_000

/** Shown when `team_feedback_settings.intro_copy` is null or blank. */
const DEFAULT_TEAM_FEEDBACK_INTRO_COPY =
  '100% Anonymous — No names or employee IDs are attached. Your feedback helps us run better, safer jobs.'

const SNOOZE_DAYS = 7

type Step = 'intro' | 'mode' | 'manager' | 'open' | 'peers' | 'thanks'

/** Settings live preview: jump to a focused step with optional DB write suppression. */
export type TeamFeedbackPreviewTarget = 'manager' | 'peer' | 'home_flow' | 'comment_only'

type Props = {
  open: boolean
  onClose: () => void
  userId: string
  source: TeamFeedbackSource
  /** When true (e.g. dashboard entry), skip intro and cadence prompt copy. */
  skipIntro?: boolean
  /** Dev Settings: open wizard on a specific step; implies dry-run unless `previewDryRun` is false. */
  previewTarget?: TeamFeedbackPreviewTarget
  /** When false with `previewTarget`, allow real submits (rare). Default: dry-run when `previewTarget` is set. */
  previewDryRun?: boolean
  /** Escape, backdrop, and header × dismiss without extra steps. Defaults to same as dry-run preview when omitted. */
  quickDismiss?: boolean
}

function LikertRow({
  label,
  value,
  onChange,
  disabled,
  centered,
}: {
  label: string
  value: number | null
  onChange: (n: number) => void
  disabled?: boolean
  /** When true, rating buttons are centered; question text stays left-aligned (manager step). */
  centered?: boolean
}) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <div
        style={{
          fontSize: '0.875rem',
          fontWeight: 600,
          marginBottom: '0.35rem',
          color: '#374151',
          textAlign: 'left',
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.35rem',
          justifyContent: centered ? 'center' : undefined,
        }}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => onChange(n)}
            style={{
              minWidth: 40,
              padding: '0.35rem 0.5rem',
              borderRadius: 6,
              border: value === n ? '2px solid #ea580c' : '1px solid #d1d5db',
              background: value === n ? '#fff7ed' : 'white',
              cursor: disabled ? 'not-allowed' : 'pointer',
              fontWeight: value === n ? 700 : 500,
            }}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function TeamFeedbackWizard({
  open,
  onClose,
  userId,
  source,
  skipIntro = false,
  previewTarget,
  previewDryRun,
  quickDismiss,
}: Props) {
  const { showToast } = useToastContext()
  const isDryRun = Boolean(previewTarget) && previewDryRun !== false
  const allowQuickDismiss = quickDismiss ?? isDryRun
  const [step, setStep] = useState<Step>('intro')
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const [cadenceDays, setCadenceDays] = useState(28)
  const [introCopy, setIntroCopy] = useState<string | null>(null)
  const [thankYouCopy, setThankYouCopy] = useState<string | null>(null)
  const [managerEnabled, setManagerEnabled] = useState(true)
  const [peerEnabled, setPeerEnabled] = useState(false)
  const [commentOnlyEnabled, setCommentOnlyEnabled] = useState(true)

  const [includeManagerRatings, setIncludeManagerRatings] = useState(true)
  const [includePeerRatings, setIncludePeerRatings] = useState(true)
  const [includeOpenComments, setIncludeOpenComments] = useState(true)
  const [likert, setLikert] = useState<[number | null, number | null, number | null, number | null, number | null]>([
    null,
    null,
    null,
    null,
    null,
  ])
  const [overall, setOverall] = useState<number | null>(null)
  const [openFix, setOpenFix] = useState('')
  const [openSafety, setOpenSafety] = useState('')
  const [openTraining, setOpenTraining] = useState('')
  const [candidates, setCandidates] = useState<PeerCandidate[]>([])
  const [selectedPeerKeys, setSelectedPeerKeys] = useState<string[]>([])
  const [peerFilter, setPeerFilter] = useState('')
  const [peerScores, setPeerScores] = useState<
    Record<string, { likert: [number, number, number, number, number] }>
  >({})
  const [submitting, setSubmitting] = useState(false)
  const [teamFeedbackSettings, setTeamFeedbackSettings] = useState<TeamFeedbackSettingsRow | null>(null)

  /** Inclusion step: pick manager / peer / open when user can choose among 2+ meaningful options. */
  const shouldShowInclusionStep = commentOnlyEnabled && (managerEnabled || peerEnabled)

  const effectiveManagerLikert = useMemo(
    () =>
      normalizeLikertPrompts(teamFeedbackSettings?.manager_likert_prompts, DEFAULT_MANAGER_LIKERT_PROMPTS),
    [teamFeedbackSettings?.manager_likert_prompts]
  )
  const effectivePeerLikert = useMemo(
    () => normalizeLikertPrompts(teamFeedbackSettings?.peer_likert_prompts, DEFAULT_PEER_LIKERT_PROMPTS),
    [teamFeedbackSettings?.peer_likert_prompts]
  )

  const inclusionTitle =
    teamFeedbackSettings?.inclusion_title?.trim() || DEFAULT_INCLUSION_TITLE
  const inclusionSubtitle =
    teamFeedbackSettings?.inclusion_subtitle?.trim() || DEFAULT_INCLUSION_SUBTITLE
  const inclusionLabelManager =
    teamFeedbackSettings?.inclusion_label_manager?.trim() || DEFAULT_INCLUSION_LABEL_MANAGER
  const inclusionLabelPeer =
    teamFeedbackSettings?.inclusion_label_peer?.trim() || DEFAULT_INCLUSION_LABEL_PEER
  const inclusionLabelOpen =
    teamFeedbackSettings?.inclusion_label_open?.trim() || DEFAULT_INCLUSION_LABEL_OPEN
  const managerStepHeading =
    teamFeedbackSettings?.manager_step_heading?.trim() || DEFAULT_MANAGER_STEP_HEADING
  const managerOverallPrompt =
    teamFeedbackSettings?.manager_overall_prompt?.trim() || DEFAULT_MANAGER_OVERALL_PROMPT
  const peerStepHeading =
    teamFeedbackSettings?.peer_step_heading?.trim() || DEFAULT_PEER_STEP_HEADING

  const resetForm = useCallback(() => {
    setIncludeManagerRatings(true)
    setIncludePeerRatings(true)
    setIncludeOpenComments(true)
    setLikert([null, null, null, null, null])
    setOverall(null)
    setOpenFix('')
    setOpenSafety('')
    setOpenTraining('')
    setSelectedPeerKeys([])
    setPeerFilter('')
    setPeerScores({})
  }, [])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    ;(async () => {
      try {
        const s = await fetchTeamFeedbackSettings()
        if (cancelled || !s) return
        setTeamFeedbackSettings(s)
        setCadenceDays(s.cadence_days)
        setIntroCopy(s.intro_copy)
        setThankYouCopy(s.thank_you_copy)
        let mgr = s.manager_section_enabled
        let peer = s.peer_section_enabled
        let comment = s.comment_only_enabled
        if (previewTarget === 'manager') mgr = true
        if (previewTarget === 'peer') {
          peer = true
          mgr = true
        }
        if (previewTarget === 'comment_only') comment = true
        setManagerEnabled(mgr)
        setPeerEnabled(peer)
        setCommentOnlyEnabled(comment)
        if (!isDryRun) {
          await upsertTeamFeedbackUserState(userId, { last_prompt_at: new Date().toISOString() })
        }
        if (peer) {
          try {
            const c = await fetchPeerCandidates()
            if (!cancelled) setCandidates(c)
          } catch {
            if (!cancelled) setCandidates([])
          }
        }
      } catch {
        if (!cancelled) showToast('Could not load feedback settings', 'error')
      } finally {
        if (!cancelled) setSettingsLoaded(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, userId, showToast, previewTarget, isDryRun])

  const handleSkip = useCallback(
    async (reason: 'button' | 'auto') => {
      if (isDryRun) {
        onClose()
        return
      }
      try {
        await upsertTeamFeedbackUserState(userId, {
          last_skipped_at: new Date().toISOString(),
        })
      } catch {
        if (reason === 'button') showToast('Could not save skip', 'error')
      }
      onClose()
    },
    [userId, onClose, showToast, isDryRun]
  )

  useEffect(() => {
    if (!open) {
      setStep('intro')
      setSettingsLoaded(false)
      setTeamFeedbackSettings(null)
      resetForm()
      return
    }
  }, [open, resetForm])

  useEffect(() => {
    if (!open || !settingsLoaded) return
    resetForm()
    if (previewTarget === 'manager') {
      setIncludeManagerRatings(true)
      setIncludePeerRatings(peerEnabled)
      setIncludeOpenComments(true)
      setStep('manager')
      return
    }
    if (previewTarget === 'peer') {
      setIncludeManagerRatings(true)
      setIncludePeerRatings(true)
      setIncludeOpenComments(true)
      setStep('peers')
      return
    }
    if (previewTarget === 'comment_only') {
      setIncludeManagerRatings(false)
      setIncludePeerRatings(false)
      setIncludeOpenComments(true)
      setStep('open')
      return
    }
    if (previewTarget === 'home_flow') {
      if (skipIntro) {
        if (shouldShowInclusionStep) {
          setIncludeManagerRatings(managerEnabled)
          setIncludePeerRatings(peerEnabled)
          setIncludeOpenComments(true)
          setStep('mode')
        } else if (managerEnabled) {
          setIncludeManagerRatings(true)
          setIncludePeerRatings(true)
          setIncludeOpenComments(true)
          setStep('manager')
        } else if (peerEnabled) {
          setIncludeManagerRatings(false)
          setIncludePeerRatings(true)
          setIncludeOpenComments(true)
          setStep('peers')
        } else if (commentOnlyEnabled) {
          setIncludeManagerRatings(false)
          setIncludePeerRatings(false)
          setIncludeOpenComments(true)
          setStep('open')
        } else {
          setIncludeManagerRatings(true)
          setIncludePeerRatings(false)
          setIncludeOpenComments(true)
          setStep('manager')
        }
      } else {
        setStep('intro')
      }
      return
    }
    if (skipIntro) {
      if (shouldShowInclusionStep) {
        setIncludeManagerRatings(managerEnabled)
        setIncludePeerRatings(peerEnabled)
        setIncludeOpenComments(true)
        setStep('mode')
      } else if (managerEnabled) {
        setIncludeManagerRatings(true)
        setIncludePeerRatings(true)
        setIncludeOpenComments(true)
        setStep('manager')
      } else if (peerEnabled) {
        setIncludeManagerRatings(false)
        setIncludePeerRatings(true)
        setIncludeOpenComments(true)
        setStep('peers')
      } else if (commentOnlyEnabled) {
        setIncludeManagerRatings(false)
        setIncludePeerRatings(false)
        setIncludeOpenComments(true)
        setStep('open')
      } else {
        setIncludeManagerRatings(true)
        setIncludePeerRatings(false)
        setIncludeOpenComments(true)
        setStep('manager')
      }
    } else {
      setStep('intro')
    }
  }, [
    open,
    settingsLoaded,
    skipIntro,
    managerEnabled,
    commentOnlyEnabled,
    peerEnabled,
    resetForm,
    previewTarget,
    shouldShowInclusionStep,
  ])

  const introTimerFired = useRef(false)
  useEffect(() => {
    introTimerFired.current = false
  }, [open])

  useEffect(() => {
    if (step !== 'intro' || !open || !settingsLoaded || isDryRun) return
    const t = window.setTimeout(() => {
      if (introTimerFired.current) return
      introTimerFired.current = true
      void handleSkip('auto')
    }, INTRO_AUTO_DISMISS_MS)
    return () => window.clearTimeout(t)
  }, [step, open, settingsLoaded, handleSkip, isDryRun])

  useEffect(() => {
    if (!open || !allowQuickDismiss) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, allowQuickDismiss, onClose])

  async function handleSnooze() {
    if (isDryRun) {
      showToast('Preview only — no changes saved', 'info')
      onClose()
      return
    }
    const until = new Date()
    until.setDate(until.getDate() + SNOOZE_DAYS)
    try {
      await upsertTeamFeedbackUserState(userId, {
        snooze_until: until.toISOString(),
        last_skipped_at: new Date().toISOString(),
      })
      showToast(`Remind me in ${SNOOZE_DAYS} days`, 'info')
      onClose()
    } catch {
      showToast('Could not snooze', 'error')
    }
  }

  function managerStepValid(): boolean {
    return likert.every((x) => x != null) && overall != null
  }

  function peerStepValid(): boolean {
    if (!peerEnabled || !includePeerRatings) return true
    if (selectedPeerKeys.length === 0) return true
    for (const key of selectedPeerKeys) {
      const row = peerScores[key]
      if (!row) return false
      if (row.likert.some((n) => n < 1 || n > 5)) return false
    }
    return true
  }

  function commentOnlyValid(): boolean {
    const t = [openFix.trim(), openSafety.trim(), openTraining.trim()].some(Boolean)
    return t
  }

  async function handleSubmit() {
    if (isDryRun) {
      showToast('Preview only — nothing was saved', 'info')
      return
    }
    const openCommentsOnlyPath =
      !includeManagerRatings && !includePeerRatings && includeOpenComments
    if (openCommentsOnlyPath) {
      if (!commentOnlyValid()) {
        showToast('Add at least one comment', 'error')
        return
      }
    } else {
      if (includeManagerRatings && managerEnabled && !managerStepValid()) {
        showToast('Answer all rating questions before submitting', 'error')
        return
      }
      if (
        includePeerRatings &&
        peerEnabled &&
        selectedPeerKeys.length > 0 &&
        !peerStepValid()
      ) {
        showToast('Complete peer ratings', 'error')
        return
      }
    }

    const noRatingsSubmitted = !includeManagerRatings && !includePeerRatings
    const submissionMode: 'full' | 'comment_only' = noRatingsSubmitted ? 'comment_only' : 'full'
    const submissionSource: TeamFeedbackSource =
      noRatingsSubmitted ? 'comment_only' : source

    setSubmitting(true)
    try {
      const managerId = await resolveManagerUserIdForFeedback(userId)
      const peerRows: SubmitTeamFeedbackPayload['peerRows'] = []
      if (includePeerRatings && peerEnabled) {
        for (const key of selectedPeerKeys) {
          const row = peerScores[key]
          if (!row) continue
          if (key.startsWith('p:')) {
            peerRows.push({
              peer_person_id: key.slice(2),
              peer_user_id: null,
              likert: row.likert,
              trust: row.likert[4],
            })
          } else if (key.startsWith('u:')) {
            peerRows.push({
              peer_person_id: null,
              peer_user_id: key.slice(2),
              likert: row.likert,
              trust: row.likert[4],
            })
          }
        }
      }

      await submitTeamFeedback({
        userId,
        source: submissionSource,
        cadenceDays,
        managerUserId: managerId,
        mode: submissionMode,
        managerLikert:
          includeManagerRatings && managerEnabled
            ? (likert.map((x) => x ?? 1) as [number, number, number, number, number])
            : null,
        managerOverall1_10: includeManagerRatings && managerEnabled ? overall : null,
        openFixImprove: openFix || null,
        openSafetyTools: openSafety || null,
        openTraining: openTraining || null,
        peerRows,
      })
      setStep('thanks')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not submit feedback', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  function togglePeer(peerKey: string) {
    setSelectedPeerKeys((prev) => {
      if (prev.includes(peerKey)) {
        const next = prev.filter((x) => x !== peerKey)
        setPeerScores((s) => {
          const copy = { ...s }
          delete copy[peerKey]
          return copy
        })
        return next
      }
      if (prev.length >= 3) {
        showToast('Choose up to 3 peers', 'info')
        return prev
      }
      setPeerScores((s) => ({
        ...s,
        [peerKey]: { likert: [3, 3, 3, 3, 3] },
      }))
      return [...prev, peerKey]
    })
  }

  if (!open) return null

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1001,
    padding: '1rem',
  }

  const cardStyle: React.CSSProperties = {
    background: '#fefcfb',
    padding: '1.5rem',
    borderRadius: 12,
    maxWidth: 520,
    width: '100%',
    maxHeight: '90vh',
    overflow: 'auto',
    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
    borderTop: '4px solid #ea580c',
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="team-feedback-title"
      style={overlayStyle}
      onClick={() => {
        if (allowQuickDismiss) onClose()
        else if (step === 'thanks') onClose()
      }}
    >
      <div style={cardStyle} onClick={(e) => e.stopPropagation()}>
        <style>{`#team-feedback-card button:focus-visible,#team-feedback-card textarea:focus{outline:2px solid #ea580c;outline-offset:2px}`}</style>
        <div id="team-feedback-card">
          {settingsLoaded && allowQuickDismiss && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: isDryRun ? '0.75rem' : '0.5rem' }}>
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                style={{
                  minWidth: 36,
                  padding: '0.35rem 0.5rem',
                  borderRadius: 6,
                  border: '1px solid #d1d5db',
                  background: 'white',
                  color: '#374151',
                  fontSize: '1.25rem',
                  lineHeight: 1,
                  cursor: 'pointer',
                }}
              >
                ×
              </button>
            </div>
          )}
          {settingsLoaded && isDryRun && (
            <p
              style={{
                margin: '0 0 0.75rem',
                padding: '0.5rem 0.65rem',
                fontSize: '0.8125rem',
                background: '#fff7ed',
                border: '1px solid #fed7aa',
                borderRadius: 6,
                color: '#9a3412',
              }}
            >
              Preview — submissions disabled.
            </p>
          )}
          {!settingsLoaded && (
            <p style={{ margin: 0, color: '#6b7280' }}>Loading…</p>
          )}

          {settingsLoaded && step === 'intro' && (
            <>
              <h2 id="team-feedback-title" style={{ marginTop: 0, textAlign: 'center', color: '#1f2937' }}>
                30sec Team Feedback
              </h2>
              <p style={{ fontSize: '0.9375rem', color: '#4b5563', lineHeight: 1.5 }}>
                {introCopy?.trim() || DEFAULT_TEAM_FEEDBACK_INTRO_COPY}
              </p>
              <p style={{ fontSize: '0.8125rem', color: '#9ca3af', textAlign: 'center' }}>
                This window closes in 30 seconds if you take no action.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    if (shouldShowInclusionStep) {
                      setIncludeManagerRatings(managerEnabled)
                      setIncludePeerRatings(peerEnabled)
                      setIncludeOpenComments(true)
                      setStep('mode')
                    } else if (managerEnabled) {
                      setIncludeManagerRatings(true)
                      setIncludePeerRatings(true)
                      setIncludeOpenComments(true)
                      setStep('manager')
                    } else if (peerEnabled) {
                      setIncludeManagerRatings(false)
                      setIncludePeerRatings(true)
                      setIncludeOpenComments(true)
                      setStep('peers')
                    } else if (commentOnlyEnabled) {
                      setIncludeManagerRatings(false)
                      setIncludePeerRatings(false)
                      setIncludeOpenComments(true)
                      setStep('open')
                    } else {
                      setIncludeManagerRatings(true)
                      setIncludePeerRatings(false)
                      setIncludeOpenComments(true)
                      setStep('manager')
                    }
                  }}
                  style={{
                    padding: '0.65rem 1rem',
                    borderRadius: 8,
                    border: 'none',
                    background: '#ea580c',
                    color: 'white',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Start
                </button>
                <button
                  type="button"
                  onClick={() => void handleSnooze()}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: 8,
                    border: '1px solid #d1d5db',
                    background: 'white',
                    cursor: 'pointer',
                  }}
                >
                  Remind me in {SNOOZE_DAYS} days
                </button>
                <button type="button" onClick={() => void handleSkip('button')} style={{ padding: '0.5rem', border: 'none', background: 'transparent', color: '#6b7280', cursor: 'pointer' }}>
                  Not now
                </button>
              </div>
            </>
          )}

          {settingsLoaded && step === 'mode' && (
            <>
              <h2 id="team-feedback-title" style={{ marginTop: 0 }}>
                {inclusionTitle}
              </h2>
              <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: '#6b7280', lineHeight: 1.45 }}>
                {inclusionSubtitle}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {managerEnabled && (
                  <button
                    type="button"
                    aria-pressed={includeManagerRatings}
                    onClick={() => setIncludeManagerRatings((v) => !v)}
                    style={{
                      padding: '0.65rem 0.75rem',
                      borderRadius: 8,
                      border: includeManagerRatings ? '2px solid #ea580c' : '1px solid #d1d5db',
                      background: includeManagerRatings ? '#fff7ed' : 'white',
                      fontWeight: 600,
                      fontSize: '0.875rem',
                      color: '#374151',
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    {inclusionLabelManager}
                  </button>
                )}
                {peerEnabled && (
                  <button
                    type="button"
                    aria-pressed={includePeerRatings}
                    onClick={() => setIncludePeerRatings((v) => !v)}
                    style={{
                      padding: '0.65rem 0.75rem',
                      borderRadius: 8,
                      border: includePeerRatings ? '2px solid #ea580c' : '1px solid #d1d5db',
                      background: includePeerRatings ? '#fff7ed' : 'white',
                      fontWeight: 600,
                      fontSize: '0.875rem',
                      color: '#374151',
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    {inclusionLabelPeer}
                  </button>
                )}
                <button
                  type="button"
                  aria-pressed={includeOpenComments}
                  onClick={() => setIncludeOpenComments((v) => !v)}
                  style={{
                    padding: '0.65rem 0.75rem',
                    borderRadius: 8,
                    border: includeOpenComments ? '2px solid #ea580c' : '1px solid #d1d5db',
                    background: includeOpenComments ? '#fff7ed' : 'white',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    color: '#374151',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  {inclusionLabelOpen}
                </button>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={onClose} style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', borderRadius: 6, background: 'white' }}>
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={
                    !(
                      (managerEnabled && includeManagerRatings) ||
                      (peerEnabled && includePeerRatings) ||
                      includeOpenComments
                    )
                  }
                  onClick={() => {
                    if (includeManagerRatings && managerEnabled) setStep('manager')
                    else if (includePeerRatings && peerEnabled) setStep('peers')
                    else if (includeOpenComments) setStep('open')
                  }}
                  style={{
                    padding: '0.5rem 1rem',
                    border: 'none',
                    borderRadius: 6,
                    background: '#ea580c',
                    color: 'white',
                    fontWeight: 600,
                    opacity:
                      (managerEnabled && includeManagerRatings) ||
                      (peerEnabled && includePeerRatings) ||
                      includeOpenComments
                        ? 1
                        : 0.5,
                  }}
                >
                  Continue
                </button>
              </div>
            </>
          )}

          {settingsLoaded && step === 'manager' && includeManagerRatings && managerEnabled && (
            <div>
              <h2 style={{ marginTop: 0, textAlign: 'center' }}>{managerStepHeading}</h2>
              <p style={{ fontSize: '0.875rem', color: '#6b7280', textAlign: 'center' }}>
                Cycle: {computeCyclePeriodStart(cadenceDays)} · 1 = low, 5 = high
              </p>
              {effectiveManagerLikert.map((label, i) => (
                <LikertRow
                  key={`mgr-${i}`}
                  label={label}
                  value={likert[i]!}
                  centered
                  onChange={(n) => {
                    setLikert((prev) => {
                      const next = [...prev] as [number | null, number | null, number | null, number | null, number | null]
                      next[i] = n
                      return next
                    })
                  }}
                  disabled={submitting}
                />
              ))}
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.35rem', textAlign: 'left' }}>
                  {managerOverallPrompt}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', justifyContent: 'center' }}>
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      type="button"
                      disabled={submitting}
                      onClick={() => setOverall(n)}
                      style={{
                        minWidth: 36,
                        padding: '0.35rem',
                        borderRadius: 6,
                        border: overall === n ? '2px solid #ea580c' : '1px solid #d1d5db',
                        background: overall === n ? '#fff7ed' : 'white',
                        cursor: submitting ? 'not-allowed' : 'pointer',
                        fontWeight: overall === n ? 700 : 500,
                      }}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1rem' }}>
                {!skipIntro && shouldShowInclusionStep && (
                  <button type="button" onClick={() => setStep('mode')} style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', borderRadius: 6, background: 'white' }}>
                    Back
                  </button>
                )}
                <button
                  type="button"
                  disabled={!managerStepValid() || submitting}
                  onClick={() => {
                    if (includePeerRatings && peerEnabled) setStep('peers')
                    else if (includeOpenComments) setStep('open')
                    else void handleSubmit()
                  }}
                  style={{
                    padding: '0.5rem 1rem',
                    border: 'none',
                    borderRadius: 6,
                    background: managerStepValid() ? '#ea580c' : '#d1d5db',
                    color: 'white',
                    fontWeight: 600,
                    cursor: managerStepValid() ? 'pointer' : 'not-allowed',
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {settingsLoaded && step === 'open' && includeOpenComments && (
            <>
              <h2 style={{ marginTop: 0, textAlign: 'center' }}>
                {!includeManagerRatings && !includePeerRatings && includeOpenComments
                  ? 'Your comments'
                  : 'Anything else?'}
              </h2>
              <label style={{ display: 'block', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>What should we fix or improve?</span>
                <textarea
                  value={openFix}
                  onChange={(e) => setOpenFix(e.target.value)}
                  rows={3}
                  disabled={submitting}
                  style={{ width: '100%', marginTop: '0.25rem', padding: '0.5rem', borderRadius: 6, border: '1px solid #d1d5db' }}
                />
              </label>
              <label style={{ display: 'block', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Safety, tools, or equipment</span>
                <textarea
                  value={openSafety}
                  onChange={(e) => setOpenSafety(e.target.value)}
                  rows={2}
                  disabled={submitting}
                  style={{ width: '100%', marginTop: '0.25rem', padding: '0.5rem', borderRadius: 6, border: '1px solid #d1d5db' }}
                />
              </label>
              <label style={{ display: 'block', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Training you wish you had</span>
                <textarea
                  value={openTraining}
                  onChange={(e) => setOpenTraining(e.target.value)}
                  rows={2}
                  disabled={submitting}
                  style={{ width: '100%', marginTop: '0.25rem', padding: '0.5rem', borderRadius: 6, border: '1px solid #d1d5db' }}
                />
              </label>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
                {((includePeerRatings && peerEnabled) ||
                  (includeManagerRatings && managerEnabled) ||
                  shouldShowInclusionStep) && (
                  <button
                    type="button"
                    onClick={() => {
                      if (includePeerRatings && peerEnabled) setStep('peers')
                      else if (includeManagerRatings && managerEnabled) setStep('manager')
                      else if (shouldShowInclusionStep) setStep('mode')
                    }}
                    style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', borderRadius: 6, background: 'white' }}
                  >
                    Back
                  </button>
                )}
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void handleSubmit()}
                  style={{
                    marginLeft: 'auto',
                    padding: '0.5rem 1rem',
                    border: 'none',
                    borderRadius: 6,
                    background: '#ea580c',
                    color: 'white',
                    fontWeight: 600,
                  }}
                >
                  {submitting ? 'Submitting…' : 'Submit'}
                </button>
              </div>
            </>
          )}

          {settingsLoaded && step === 'peers' && peerEnabled && includePeerRatings && (
            <>
              <h2 id="team-feedback-title" style={{ marginTop: 0, textAlign: 'center' }}>
                {peerStepHeading}
              </h2>
              <p style={{ fontSize: '0.875rem', color: '#6b7280', lineHeight: 1.45, textAlign: 'center' }}>
                Select 1–3 teammates you worked with recently
                <br />
                <span style={{ fontSize: '0.8125rem', color: '#9ca3af' }}>(optional but very helpful)</span>
              </p>
              <p style={{ fontSize: '0.8125rem', color: '#9ca3af', marginTop: '-0.25rem', textAlign: 'center' }}>
                1 = low, 5 = high
              </p>
              <PeerTeammatePicker
                candidates={candidates}
                selectedPeerKeys={selectedPeerKeys}
                peerFilter={peerFilter}
                onFilterChange={setPeerFilter}
                onTogglePeer={togglePeer}
                disabled={submitting}
              />
              {selectedPeerKeys.map((peerKey) => {
                const c = candidates.find((x) => peerCandidateKey(x) === peerKey)
                const row = peerScores[peerKey]
                if (!row) return null
                return (
                  <div key={peerKey} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '0.75rem', marginBottom: '0.75rem' }}>
                    <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>{c?.peer_name ?? 'Peer'}</div>
                    {effectivePeerLikert.map((pl, i) => (
                      <LikertRow
                        key={`${peerKey}-likert-${i}`}
                        label={pl}
                        value={row.likert[i] ?? null}
                        onChange={(n) => {
                          setPeerScores((s) => {
                            const cur = s[peerKey]!
                            const L = [...cur.likert] as [number, number, number, number, number]
                            L[i] = n
                            return { ...s, [peerKey]: { likert: L } }
                          })
                        }}
                        disabled={submitting}
                      />
                    ))}
                  </div>
                )
              })}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                {(includeManagerRatings && managerEnabled) || shouldShowInclusionStep || !skipIntro ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (includeManagerRatings && managerEnabled) setStep('manager')
                      else if (shouldShowInclusionStep) setStep('mode')
                      else if (!skipIntro) setStep('intro')
                    }}
                    style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', borderRadius: 6, background: 'white' }}
                  >
                    Back
                  </button>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  disabled={submitting || !peerStepValid()}
                  onClick={() => {
                    if (includeOpenComments) setStep('open')
                    else void handleSubmit()
                  }}
                  style={{
                    marginLeft: 'auto',
                    padding: '0.5rem 1rem',
                    border: 'none',
                    borderRadius: 6,
                    background: peerStepValid() ? '#ea580c' : '#d1d5db',
                    color: 'white',
                    fontWeight: 600,
                  }}
                >
                  Next
                </button>
              </div>
            </>
          )}

          {settingsLoaded && step === 'thanks' && (
            <>
              <h2 style={{ marginTop: 0, textAlign: 'center' }}>Thank you</h2>
              <p style={{ textAlign: 'center', color: '#4b5563', lineHeight: 1.5 }}>
                {thankYouCopy?.trim() || 'Your feedback was submitted. It helps the team improve.'}
              </p>
              <button
                type="button"
                onClick={onClose}
                style={{
                  display: 'block',
                  margin: '1rem auto 0',
                  padding: '0.5rem 1.25rem',
                  borderRadius: 8,
                  border: 'none',
                  background: '#ea580c',
                  color: 'white',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
