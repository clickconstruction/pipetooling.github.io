/**
 * The clock-out deck (v2.2824): one card per teammate you shared jobs with this cycle, then
 * your lead, then one open-words card. Each card is the same Ability / Drive / Integrity
 * sliders the office uses in Prospects → Team → Review. Crew rows are anonymous to everyone
 * but dev. Replaces the ten-question TeamFeedbackWizard.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { RATING_DEFS, RatingSliders, type RatingKey } from '../prospects/ratingDimensions'
import {
  fetchCrewTeammates,
  fetchMyCrewRatedThisMonth,
  fetchTeamFeedbackSettings,
  markCrewDeckCompleted,
  resolveManagerUserIdForFeedback,
  submitOpenWords,
  upsertCrewReview,
  upsertTeamFeedbackUserState,
  type TeamFeedbackSettingsRow,
  type TeamFeedbackSource,
} from '../../lib/teamFeedback'
import {
  buildCrewDeck,
  crewCardContextLine,
  crewDraftHasContent,
  crewDraftToRow,
  emptyCrewDraft,
  emptyOpenWords,
  openWordsHaveContent,
  parseOpenPrompts,
  type CrewDeckCard,
  type CrewReviewDraft,
  type OpenWords,
} from '../../lib/people/crewReview'
import { currentReviewMonth } from '../../lib/prospects/teamMemberReviews'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'

const INTRO_AUTO_DISMISS_MS = 30_000
const SNOOZE_DAYS = 7

/** Shown when `team_feedback_settings.intro_copy` is null or blank. */
export const DEFAULT_CREW_DECK_INTRO_COPY =
  '100% Anonymous — No names or employee IDs are attached. Your feedback helps us run better, safer jobs.'
const DEFAULT_THANK_YOU_COPY = 'Thanks. That took two minutes and it matters.'

type Step = 'intro' | 'loading' | 'cards' | 'open' | 'thanks'

type Props = {
  open: boolean
  onClose: () => void
  userId: string
  source: TeamFeedbackSource
  /** Dashboard button: no intro or auto-dismiss. */
  skipIntro?: boolean
  /** Dev "Try the deck": real teammates, nothing written. */
  preview?: boolean
}

export default function CrewReviewDeck({ open, onClose, userId, source, skipIntro = false, preview = false }: Props) {
  const { showToast } = useToastContext()
  const [step, setStep] = useState<Step>('intro')
  const [settings, setSettings] = useState<TeamFeedbackSettingsRow | null>(null)
  const [cards, setCards] = useState<CrewDeckCard[]>([])
  const [index, setIndex] = useState(0)
  const [drafts, setDrafts] = useState<Record<string, CrewReviewDraft>>({})
  const [saved, setSaved] = useState<Set<string>>(() => new Set())
  const [words, setWords] = useState<OpenWords>(() => emptyOpenWords())
  const [leadUserId, setLeadUserId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const startedRef = useRef(false)

  const reviewMonth = useMemo(() => currentReviewMonth(APP_CALENDAR_TZ), [])
  const prompts = useMemo(() => parseOpenPrompts(settings?.open_prompts), [settings])

  const reset = useCallback(() => {
    setStep('intro')
    setCards([])
    setIndex(0)
    setDrafts({})
    setSaved(new Set())
    setWords(emptyOpenWords())
    setLeadUserId(null)
    setBusy(false)
    setLoadError(null)
    startedRef.current = false
  }, [])

  useEffect(() => {
    if (!open) reset()
  }, [open, reset])

  /** Load settings, the lead, teammates, and this month's already-rated set; build the deck. */
  const loadDeck = useCallback(async () => {
    setStep('loading')
    setLoadError(null)
    try {
      const s = await fetchTeamFeedbackSettings()
      setSettings(s)
      const lead = await resolveManagerUserIdForFeedback(userId)
      setLeadUserId(lead)
      const [teammates, rated] = await Promise.all([
        fetchCrewTeammates(s?.crew_lookback_days ?? 14, lead && lead !== userId ? [lead] : []),
        preview ? Promise.resolve(new Set<string>()) : fetchMyCrewRatedThisMonth(userId, reviewMonth),
      ])
      const deck = buildCrewDeck({ meUserId: userId, teammates, leadUserId: lead, ratedThisMonth: rated })
      setCards(deck)
      setIndex(0)
      setStep(deck.length > 0 ? 'cards' : 'open')
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load your crew')
      setStep('cards')
    }
  }, [userId, preview, reviewMonth])

  useEffect(() => {
    if (!open || startedRef.current) return
    startedRef.current = true
    if (skipIntro) void loadDeck()
    else void fetchTeamFeedbackSettings().then(setSettings).catch(() => undefined)
  }, [open, skipIntro, loadDeck])

  const dismissAsSkip = useCallback(
    async (reason: 'button' | 'auto') => {
      if (!preview) {
        try {
          await upsertTeamFeedbackUserState(userId, { last_skipped_at: new Date().toISOString() })
        } catch {
          if (reason === 'button') showToast('Could not save skip', 'error')
        }
      }
      onClose()
    },
    [preview, userId, onClose, showToast],
  )

  // The intro closes itself after 30 s of no action, as the old prompt did.
  useEffect(() => {
    if (!open || step !== 'intro' || skipIntro) return
    const t = window.setTimeout(() => void dismissAsSkip('auto'), INTRO_AUTO_DISMISS_MS)
    return () => window.clearTimeout(t)
  }, [open, step, skipIntro, dismissAsSkip])

  async function snooze() {
    if (!preview) {
      const until = new Date()
      until.setDate(until.getDate() + SNOOZE_DAYS)
      try {
        await upsertTeamFeedbackUserState(userId, { snooze_until: until.toISOString(), last_skipped_at: new Date().toISOString() })
        showToast(`Remind me in ${SNOOZE_DAYS} days`, 'info')
      } catch {
        showToast('Could not snooze', 'error')
      }
    }
    onClose()
  }

  const card = cards[index] ?? null
  const draft: CrewReviewDraft = card ? (drafts[card.user_id] ?? emptyCrewDraft()) : emptyCrewDraft()

  function updateDraft(patch: Partial<CrewReviewDraft>) {
    if (!card) return
    setDrafts((d) => ({ ...d, [card.user_id]: { ...(d[card.user_id] ?? emptyCrewDraft()), ...patch } }))
  }

  function advance() {
    if (index + 1 < cards.length) setIndex(index + 1)
    else setStep('open')
  }

  async function saveAndAdvance() {
    if (!card || busy) return
    if (!crewDraftHasContent(draft)) {
      advance()
      return
    }
    if (preview) {
      setSaved((s) => new Set(s).add(card.user_id))
      advance()
      return
    }
    setBusy(true)
    try {
      await upsertCrewReview(crewDraftToRow({ draft, subjectUserId: card.user_id, reviewerUserId: userId, reviewMonth }))
      setSaved((s) => new Set(s).add(card.user_id))
      advance()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not save that rating', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function finish() {
    if (busy) return
    if (preview) {
      showToast('Preview only — nothing was saved', 'info')
      setStep('thanks')
      return
    }
    setBusy(true)
    try {
      if (openWordsHaveContent(words)) {
        await submitOpenWords({
          source,
          cadenceDays: settings?.cadence_days ?? 14,
          managerUserId: leadUserId,
          fixImprove: words.fixImprove,
          safetyTools: words.safetyTools,
          training: words.training,
          anything: words.anything,
        })
      }
      await markCrewDeckCompleted(userId)
      setStep('thanks')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not send', 'error')
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null

  const introCopy = settings?.intro_copy?.trim() || DEFAULT_CREW_DECK_INTRO_COPY
  const thankYou = settings?.thank_you_copy?.trim() || DEFAULT_THANK_YOU_COPY
  const ratingValues = { rating_ability: draft.rating_ability, rating_drive: draft.rating_drive, rating_integrity: draft.rating_integrity }
  const comments: Record<RatingKey, string> = {
    rating_ability: draft.comment_ability,
    rating_drive: draft.comment_drive,
    rating_integrity: draft.comment_integrity,
  }
  const nextName = cards[index + 1]?.name ?? null
  const draftHasContent = crewDraftHasContent(draft)

  return (
    <div role="presentation" style={overlayStyle} onMouseDown={(e) => e.target === e.currentTarget && step === 'intro' ? void dismissAsSkip('button') : undefined}>
      <div role="dialog" aria-modal="true" aria-labelledby="crew-deck-title" style={dialogStyle} onMouseDown={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: '0.75rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
            {preview ? 'Preview · ' : ''}
            {step === 'cards' && card ? `Rate · ${index + 1} of ${cards.length}` : step === 'open' ? 'Anything else · last card' : 'Rate your crew'}
          </span>
          <button type="button" onClick={() => (step === 'thanks' ? onClose() : void dismissAsSkip('button'))} aria-label="Close" style={closeButtonStyle}>
            ×
          </button>
        </div>

        <div style={{ padding: '1rem', overflowY: 'auto', flex: '1 1 auto', minHeight: 0 }}>
          {step === 'intro' && (
            <>
              <h2 id="crew-deck-title" style={{ margin: '0 0 0.5rem', fontSize: '1.25rem', color: 'var(--text-strong)' }}>
                Two minutes on your crew
              </h2>
              <p style={{ fontSize: '0.9375rem', color: 'var(--text-600)', lineHeight: 1.5, margin: '0 0 0.5rem' }}>{introCopy}</p>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: '0 0 0.5rem' }}>
                You will see a card for each person you worked with this cycle: three sliders and an optional note each. Skip anyone.
              </p>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-faint)', textAlign: 'center' }}>This window closes in 30 seconds if you take no action.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => void loadDeck()} style={primaryButtonStyle}>
                  Start
                </button>
                <button type="button" onClick={() => void snooze()} style={secondaryButtonStyle}>
                  Not now · remind me in {SNOOZE_DAYS} days
                </button>
              </div>
            </>
          )}

          {step === 'loading' && <p style={{ color: 'var(--text-muted)', margin: 0 }}>Finding who you worked with…</p>}

          {step === 'cards' && loadError && (
            <div>
              <p style={{ color: 'var(--text-red-600)', margin: '0 0 0.75rem' }}>{loadError}</p>
              <button type="button" onClick={() => void loadDeck()} style={secondaryButtonStyle}>
                Try again
              </button>
            </div>
          )}

          {step === 'cards' && card && !loadError && (
            <>
              <h2 id="crew-deck-title" style={{ margin: 0, fontSize: '1.35rem', color: 'var(--text-strong)' }}>
                {card.name}
              </h2>
              <p style={{ margin: '0.15rem 0 0.25rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                {roleLabel(card.role)} · {crewCardContextLine(card)}
              </p>
              {saved.has(card.user_id) && <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-green-700)' }}>Saved · edits update the same rating</p>}
              <RatingSliders
                values={ratingValues}
                onChange={(key, value) => updateDraft({ [key]: value } as Partial<CrewReviewDraft>)}
                comments={comments}
                onCommentChange={(key, value) => updateDraft({ [commentKeyFor(key)]: value } as Partial<CrewReviewDraft>)}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => void saveAndAdvance()} disabled={busy || !draftHasContent} style={{ ...primaryButtonStyle, opacity: draftHasContent ? 1 : 0.5 }}>
                  {busy ? 'Saving…' : nextName ? `Save ${card.name} · next: ${nextName}` : `Save ${card.name} · one more thing`}
                </button>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="button" onClick={() => setIndex(Math.max(0, index - 1))} disabled={index === 0} style={{ ...secondaryButtonStyle, flex: '0 0 auto', opacity: index === 0 ? 0.4 : 1 }}>
                    ◀ Back
                  </button>
                  <button type="button" onClick={advance} disabled={busy} style={{ ...secondaryButtonStyle, flex: 1 }}>
                    Skip {card.name}
                  </button>
                </div>
              </div>
            </>
          )}

          {step === 'open' && (
            <>
              <h2 id="crew-deck-title" style={{ margin: 0, fontSize: '1.35rem', color: 'var(--text-strong)' }}>
                Your words
              </h2>
              <p style={{ margin: '0.15rem 0 0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                {cards.length === 0 ? 'No one to rate this cycle. ' : ''}Optional. Only the office reads these.
              </p>
              {(
                [
                  ['fixImprove', prompts[0]],
                  ['safetyTools', prompts[1]],
                  ['training', prompts[2]],
                  ['anything', prompts[3]],
                ] as Array<[keyof OpenWords, string]>
              ).map(([key, label]) => (
                <label key={key} style={{ display: 'block', marginBottom: '0.65rem' }}>
                  <span style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-700)', marginBottom: '0.2rem' }}>{label}</span>
                  <textarea
                    value={words[key]}
                    onChange={(e) => setWords((w) => ({ ...w, [key]: e.target.value }))}
                    rows={2}
                    style={textareaStyle}
                  />
                </label>
              ))}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem' }}>
                <button type="button" onClick={() => void finish()} disabled={busy} style={{ ...primaryButtonStyle, background: 'var(--text-green-700)' }}>
                  {busy ? 'Sending…' : openWordsHaveContent(words) ? `Send · done for ${settings?.cadence_days ?? 14} days` : `Done · quiet for ${settings?.cadence_days ?? 14} days`}
                </button>
                {cards.length > 0 && (
                  <button type="button" onClick={() => { setStep('cards'); setIndex(cards.length - 1) }} disabled={busy} style={secondaryButtonStyle}>
                    ◀ Back to {cards[cards.length - 1]?.name}
                  </button>
                )}
              </div>
            </>
          )}

          {step === 'thanks' && (
            <>
              <h2 id="crew-deck-title" style={{ margin: '0 0 0.5rem', fontSize: '1.25rem', color: 'var(--text-strong)' }}>
                Done
              </h2>
              <p style={{ fontSize: '0.9375rem', color: 'var(--text-600)', lineHeight: 1.5, margin: '0 0 1rem' }}>{thankYou}</p>
              <button type="button" onClick={onClose} style={primaryButtonStyle}>
                Close
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function commentKeyFor(key: RatingKey): 'comment_ability' | 'comment_drive' | 'comment_integrity' {
  return key === 'rating_ability' ? 'comment_ability' : key === 'rating_drive' ? 'comment_drive' : 'comment_integrity'
}

function roleLabel(role: string): string {
  switch (role) {
    case 'master_technician':
      return 'Master Technician'
    case 'dev':
      return 'Dev'
    case 'assistant':
      return 'Assistant'
    case 'helpers':
      return 'Helper'
    case 'subcontractor':
      return 'Subcontractor'
    case 'superintendent':
      return 'Superintendent'
    case 'estimator':
      return 'Estimator'
    case 'controller':
      return 'Controller'
    case 'primary':
      return 'Primary'
    default:
      return role
  }
}

// Keep the dimension colors referenced so a future palette change here stays in one place.
void RATING_DEFS

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.7)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1001,
  padding: 'calc(0.75rem + env(safe-area-inset-top, 0px)) 0.75rem calc(0.75rem + env(safe-area-inset-bottom, 0px))',
}

const dialogStyle: CSSProperties = {
  width: '100%',
  maxWidth: 520,
  maxHeight: '100%',
  display: 'flex',
  flexDirection: 'column',
  background: 'var(--surface)',
  color: 'var(--text-base)',
  borderRadius: 12,
  border: '1px solid var(--border)',
  boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)',
  overflow: 'hidden',
}

const closeButtonStyle: CSSProperties = {
  marginLeft: 'auto',
  background: 'none',
  border: 'none',
  color: 'var(--text-muted)',
  fontSize: '1.5rem',
  lineHeight: 1,
  cursor: 'pointer',
  padding: '0 0.25rem',
}

const primaryButtonStyle: CSSProperties = {
  padding: '0.7rem 1rem',
  borderRadius: 8,
  border: 'none',
  background: 'var(--text-link)',
  color: 'white',
  fontWeight: 700,
  fontSize: '0.95rem',
  cursor: 'pointer',
}

const secondaryButtonStyle: CSSProperties = {
  padding: '0.55rem 1rem',
  borderRadius: 8,
  border: '1px solid var(--border-strong)',
  background: 'var(--surface)',
  color: 'var(--text-700)',
  fontWeight: 500,
  fontSize: '0.9rem',
  cursor: 'pointer',
}

const textareaStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '0.5rem 0.6rem',
  fontSize: '0.875rem',
  font: 'inherit',
  background: 'var(--surface)',
  color: 'var(--text-base)',
  border: '1px solid var(--border-strong)',
  borderRadius: 6,
  resize: 'vertical',
}
