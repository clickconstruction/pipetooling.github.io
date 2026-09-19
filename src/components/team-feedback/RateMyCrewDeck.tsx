/**
 * Rate my crew (Supervision, PR 4 — to-dos/supervision).
 *
 * A supervisor's monthly deck: one card per person they supervised on two or more
 * job-days this month (`get_supervisor_review_deck`), the three sliders with their
 * comment boxes, Save · next / Skip / Back, then done. Each save is a
 * `team_member_reviews` row with `source = 'supervisor'` — by name, one per subject and
 * month, beside the office's rows on the Review stage. The write is gated in the
 * database on the schedule and the clock (`supervised_days_with`), never on a list.
 * Shaped after the clock-out crew deck, without its anonymity or its cadence.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'
import { RatingSliders, type RatingKey } from '../prospects/ratingDimensions'
import { currentReviewMonth, formatReviewMonthLabel } from '../../lib/prospects/teamMemberReviews'
import {
  EMPTY_SUPERVISOR_DRAFT,
  SUPERVISOR_COMMENT_KEY,
  buildSupervisorDeck,
  nextUnratedCard,
  supervisorCardContextLine,
  supervisorDraftHasContent,
  supervisorReviewRow,
  type SupervisorDeckCard,
  type SupervisorDeckPayload,
  type SupervisorReviewDraft,
} from '../../lib/people/supervisorReviews'

type Props = {
  open: boolean
  onClose: () => void
  userId: string
  /** First-of-month ISO date on the company calendar; defaults to this month. */
  reviewMonth?: string
  /** Called after any save so the host can refresh its count. */
  onSaved?: () => void
}

type Step = 'loading' | 'cards' | 'done' | 'empty'

function roleLabel(role: string | null): string {
  switch (role) {
    case 'master_technician':
      return 'master'
    case 'subcontractor':
      return 'sub'
    case 'helpers':
      return 'helper'
    default:
      return role ?? ''
  }
}

export default function RateMyCrewDeck({ open, onClose, userId, reviewMonth, onSaved }: Props) {
  const month = reviewMonth ?? currentReviewMonth(APP_CALENDAR_TZ)
  const [step, setStep] = useState<Step>('loading')
  const [cards, setCards] = useState<SupervisorDeckCard[]>([])
  const [index, setIndex] = useState(0)
  const [drafts, setDrafts] = useState<Record<string, SupervisorReviewDraft>>({})
  const [saved, setSaved] = useState<Set<string>>(() => new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setStep('loading')
    setError(null)
    try {
      const data = await withSupabaseRetry(() => supabase.rpc('get_supervisor_review_deck' as never, { p_month: month } as never), 'get_supervisor_review_deck')
      const deck = buildSupervisorDeck((data as unknown as SupervisorDeckPayload | null) ?? null)
      setCards(deck)
      const first = deck.findIndex((c) => !c.reviewed)
      setIndex(first >= 0 ? first : 0)
      setStep(deck.length === 0 ? 'empty' : 'cards')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setStep('empty')
    }
  }, [month])

  useEffect(() => {
    if (!open) return
    setSaved(new Set())
    setDrafts({})
    void load()
  }, [open, load])

  const card = cards[index] ?? null
  const draft = useMemo(() => (card ? (drafts[card.userId] ?? EMPTY_SUPERVISOR_DRAFT) : EMPTY_SUPERVISOR_DRAFT), [card, drafts])
  const updateDraft = (patch: Partial<SupervisorReviewDraft>) => {
    if (!card) return
    setDrafts((d) => ({ ...d, [card.userId]: { ...(d[card.userId] ?? EMPTY_SUPERVISOR_DRAFT), ...patch } }))
  }
  const nextIndex = card ? nextUnratedCard(cards, saved, index) : null
  const nextName = nextIndex != null ? (cards[nextIndex]?.name ?? null) : null

  const advance = () => {
    if (nextIndex == null) setStep('done')
    else setIndex(nextIndex)
  }

  async function saveAndAdvance() {
    if (!card || busy) return
    setBusy(true)
    setError(null)
    try {
      await withSupabaseRetry(
        async () =>
          supabase.from('team_member_reviews').upsert(supervisorReviewRow(draft, card.userId, userId, month), { onConflict: 'subject_user_id,reviewer_user_id,review_month,source' }).select('id'),
        'upsert supervisor review',
      )
      setSaved((s) => new Set(s).add(card.userId))
      onSaved?.()
      advance()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null
  const ratedCount = cards.filter((c) => c.reviewed || saved.has(c.userId)).length
  return (
    <div style={overlayStyle} role="dialog" aria-modal="true" aria-labelledby="rate-my-crew-title" onClick={onClose}>
      <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            Rate my crew · {formatReviewMonthLabel(month)}
          </span>
          {cards.length > 0 && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>
              {ratedCount} of {cards.length} rated
            </span>
          )}
          <button type="button" onClick={onClose} aria-label="Close" style={closeButtonStyle}>
            ×
          </button>
        </div>
        <div style={{ padding: '1rem', overflowY: 'auto' }}>
          {step === 'loading' && <p style={{ margin: 0, color: 'var(--text-muted)' }}>Loading your crew…</p>}
          {step === 'empty' && (
            <p style={{ margin: 0, color: 'var(--text-muted)' }}>
              {error ? `Could not load your crew — ${error}` : 'Nobody you supervised on two or more days this month yet.'}
            </p>
          )}
          {step === 'cards' && card && (
            <>
              <h2 id="rate-my-crew-title" style={{ margin: 0, fontSize: '1.35rem', color: 'var(--text-strong)' }}>
                {card.name}
              </h2>
              <p style={{ margin: '0.15rem 0 0.25rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                {roleLabel(card.role)} · {supervisorCardContextLine(card)}
              </p>
              {(card.reviewed || saved.has(card.userId)) && <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-green-700)' }}>Rated this month · saving again updates it</p>}
              <RatingSliders
                values={{ rating_ability: draft.rating_ability, rating_drive: draft.rating_drive, rating_integrity: draft.rating_integrity }}
                onChange={(key, value) => updateDraft({ [key]: value } as Partial<SupervisorReviewDraft>)}
                comments={{ rating_ability: draft.comment_ability, rating_drive: draft.comment_drive, rating_integrity: draft.comment_integrity }}
                onCommentChange={(key: RatingKey, value: string) => updateDraft({ [SUPERVISOR_COMMENT_KEY[key]]: value } as Partial<SupervisorReviewDraft>)}
              />
              {error && <p style={{ margin: '0.5rem 0 0', fontSize: '0.8125rem', color: 'var(--text-red-600)' }}>{error}</p>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => void saveAndAdvance()} disabled={busy || !supervisorDraftHasContent(draft)} style={{ ...primaryButtonStyle, opacity: supervisorDraftHasContent(draft) ? 1 : 0.5 }}>
                  {busy ? 'Saving…' : nextName ? `Save ${card.name} · next: ${nextName}` : `Save ${card.name} · done`}
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
              <p style={{ margin: '0.75rem 0 0', fontSize: '0.72rem', color: 'var(--text-faint)' }}>
                By name, beside the office's ratings on Hiring → Review. One per person per month; come back to change it.
              </p>
            </>
          )}
          {step === 'done' && (
            <>
              <h2 id="rate-my-crew-done" style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-strong)' }}>
                That's your crew for {formatReviewMonthLabel(month)}.
              </h2>
              <p style={{ margin: '0.5rem 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                {ratedCount} of {cards.length} rated. Open it again any time this month to change a rating.
              </p>
              <button type="button" onClick={onClose} style={primaryButtonStyle}>
                Done
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

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
const closeButtonStyle: CSSProperties = { marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', lineHeight: 1, cursor: 'pointer', padding: '0 0.25rem' }
const primaryButtonStyle: CSSProperties = { padding: '0.7rem 1rem', borderRadius: 8, border: 'none', background: 'var(--text-link)', color: 'white', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' }
const secondaryButtonStyle: CSSProperties = { padding: '0.55rem 1rem', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', fontWeight: 500, fontSize: '0.9rem', cursor: 'pointer' }
