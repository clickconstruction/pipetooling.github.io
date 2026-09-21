/**
 * Try-out loop, PR 2 (to-dos/helper-tryout-loop): the leader's verdict card.
 *
 * One card per trial helper per day, for whoever could run the job that day: "Take Bryan
 * again?" — Yes · No · Not sure, an optional word for the office, Skip. Each save is the
 * leader's own `team_prospect_trial_verdicts` row (one per card, leader and day; the database
 * gates the write on the schedule and the clock). By name, never anonymous: the office reads
 * *Mike yes, Jake no* on the Try-out card. Two hosts deal the same cards — the Dashboard
 * (`DashboardTrialVerdictSection`) and a leader's own clock-out (`TrialVerdictPrompt`).
 */
import { useState } from 'react'
import type { CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { TRIAL_NOTE_MAX, TRIAL_VERDICT_CHOICES, trialAnswerLine, trialVerdictRow, type TrialVerdict, type TrialVerdictCard } from '../../lib/hiring/trialVerdicts'

type Props = {
  cards: readonly TrialVerdictCard[]
  userId: string
  /** After a row is written (an answer or a skip), so the host can re-read its feed. */
  onSaved: (card: TrialVerdictCard, verdict: TrialVerdict) => void
}

type Draft = { verdict: Exclude<TrialVerdict, 'skipped'> | null; note: string }

const CHOICE_TINT: Record<Exclude<TrialVerdict, 'skipped'>, string> = { yes: 'var(--text-green-800)', no: 'var(--text-red-600)', unsure: 'var(--text-amber-700)' }

export default function TrialVerdictCards({ cards, userId, onSaved }: Props) {
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [editing, setEditing] = useState<Set<string>>(() => new Set())
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const draftOf = (card: TrialVerdictCard): Draft => drafts[card.key] ?? { verdict: card.answered ? (card.verdict as Draft['verdict']) : null, note: card.note }
  const patch = (card: TrialVerdictCard, change: Partial<Draft>) => setDrafts((d) => ({ ...d, [card.key]: { ...draftOf(card), ...change } }))

  async function write(card: TrialVerdictCard, verdict: TrialVerdict, note: string) {
    if (busyKey) return
    setBusyKey(card.key)
    setErrors((e) => ({ ...e, [card.key]: '' }))
    try {
      await withSupabaseRetry(
        async () =>
          supabase
            .from('team_prospect_trial_verdicts' as never)
            .upsert(trialVerdictRow(card, userId, verdict, note) as never, { onConflict: 'prospect_id,leader_user_id,work_date' })
            .select('id'),
        'save trial verdict',
      )
      setEditing((s) => {
        const next = new Set(s)
        next.delete(card.key)
        return next
      })
      onSaved(card, verdict)
    } catch (e) {
      setErrors((prev) => ({ ...prev, [card.key]: e instanceof Error ? e.message : String(e) }))
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <div style={{ display: 'grid', gap: '0.7rem' }}>
      {cards.map((card) => {
        const draft = draftOf(card)
        const busy = busyKey === card.key
        const showAnswer = card.answered && !editing.has(card.key)
        return (
          <div key={card.key} style={cardStyle} aria-label={`Trial verdict for ${card.helperName}`}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{card.eyebrow}</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, marginTop: 2 }}>{card.helperName}</div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{card.contextLine}</div>
            {showAnswer ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: '0.6rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{trialAnswerLine(card)}</span>
                <button type="button" style={{ ...quietButtonStyle, marginLeft: 'auto' }} onClick={() => setEditing((s) => new Set(s).add(card.key))}>
                  Change
                </button>
              </div>
            ) : (
              <>
                <div style={{ fontSize: '0.95rem', fontWeight: 600, margin: '0.7rem 0 0.4rem' }}>{card.question}</div>
                <div role="group" aria-label={card.question} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem' }}>
                  {TRIAL_VERDICT_CHOICES.map((choice) => {
                    const on = draft.verdict === choice.verdict
                    return (
                      <button
                        key={choice.verdict}
                        type="button"
                        aria-pressed={on}
                        disabled={busy}
                        onClick={() => patch(card, { verdict: choice.verdict })}
                        style={{ ...choiceButtonStyle, borderColor: on ? CHOICE_TINT[choice.verdict] : 'var(--border-strong)', color: on ? CHOICE_TINT[choice.verdict] : 'var(--text-700)', boxShadow: on ? `inset 0 0 0 1px ${CHOICE_TINT[choice.verdict]}` : 'none' }}
                      >
                        {choice.label}
                      </button>
                    )
                  })}
                </div>
                <input
                  type="text"
                  value={draft.note}
                  maxLength={TRIAL_NOTE_MAX}
                  disabled={busy}
                  onChange={(e) => patch(card, { note: e.target.value })}
                  placeholder="A word for the office (optional)"
                  aria-label={`A word for the office about ${card.helperName} (optional)`}
                  style={noteInputStyle}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginTop: '0.55rem' }}>
                  {errors[card.key] ? <span style={{ marginRight: 'auto', fontSize: '0.75rem', color: 'var(--text-red-600)' }}>Could not save — {errors[card.key]}</span> : null}
                  {card.answered ? (
                    <button type="button" style={quietButtonStyle} disabled={busy} onClick={() => setEditing((s) => { const next = new Set(s); next.delete(card.key); return next })}>
                      Cancel
                    </button>
                  ) : (
                    <button type="button" style={quietButtonStyle} disabled={busy} onClick={() => void write(card, 'skipped', '')}>
                      Skip
                    </button>
                  )}
                  <button type="button" style={{ ...saveButtonStyle, opacity: draft.verdict && !busy ? 1 : 0.5 }} disabled={!draft.verdict || busy} onClick={() => draft.verdict && void write(card, draft.verdict, draft.note)}>
                    {busy ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}

const cardStyle: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.75rem 0.9rem' }
const choiceButtonStyle: CSSProperties = { font: 'inherit', fontSize: '0.95rem', fontWeight: 700, padding: '0.7rem 0.5rem', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', cursor: 'pointer' }
const noteInputStyle: CSSProperties = { font: 'inherit', fontSize: '0.875rem', width: '100%', boxSizing: 'border-box', marginTop: '0.5rem', padding: '0.5rem 0.6rem', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'inherit' }
const quietButtonStyle: CSSProperties = { font: 'inherit', fontSize: '0.8125rem', padding: '0.4rem 0.7rem', borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }
const saveButtonStyle: CSSProperties = { font: 'inherit', fontSize: '0.875rem', fontWeight: 700, padding: '0.5rem 1.1rem', borderRadius: 8, border: 'none', background: 'var(--text-link)', color: 'white', cursor: 'pointer' }
