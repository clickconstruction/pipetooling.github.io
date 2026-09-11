import { useState } from 'react'
import type { Bid } from '../../types/bids'
import { robotGaps } from '../../lib/bids/robotRowState'
import { focusForRobotGap, type BidFormFocus } from '../../lib/bids/bidFormFocus'
import { ROBOT_INTAKE_ACCOUNT } from '../../lib/bids/robotReadinessLine'
import { answerFromChoice, orderedChoices } from '../../lib/bids/twinQuestionChoices'
import { PLANS_ASK_DEFAULT_CHOICES, PLANS_ASK_DEFAULT_RECOMMENDED, answerRequestsRerun, effectiveTwinQuestionKind } from '../../../supabase/functions/_shared/twinQuestionKind'
import { RobotGlyph } from './RobotGlyph'
import { TwinQuestionChoiceButtons } from './TwinQuestionChoiceButtons'

export type RobotOpenQuestion = {
  id: string
  question: string
  topic: string | null
  created_at: string
  /** v2.3210 tap labels + the robot's pick; absent on older rows. */
  choices?: unknown
  recommended?: string | null
  /** v2.3212: 'plans' = the robot needs a different plan set on this bid; absent → the text decides. */
  kind?: string | null
}

type RobotNeedsSheetProps = {
  /** The human bid the robot is stuck on; null = closed. */
  bid: Bid | null
  questions: RobotOpenQuestion[]
  onClose: () => void
  /** v2.3334: opens Edit bid landed on the field that fixes the gap (`focus`), when one exists. */
  onEditBid: (bid: Bid, opts?: { focus?: BidFormFocus }) => void
  /**
   * Answer one question; resolves true when the row was written. `rerunBidId`
   * (v2.3223) rides along when a plans ask was answered "go again": the page
   * stamps that bid robot-requested so the robot picks it up front of the line.
   */
  onAnswer: (questionId: string, text: string, opts?: { rerunBidId?: string }) => Promise<boolean>
}

/**
 * The amber-icon click: what the robot needs from a person before it can go
 * on — plans it can't open (with the intake address to share with), warnings
 * that don't block, and the questions it asked, answerable in place. Replaces
 * the v2.2530 readiness checklist; the kickoff prompt lives on the dev Queue lens.
 *
 * v2.3212: a robot's PLANS ask ("the file on the bid is the electrical set —
 * attach the plumbing sheets?") is a task on this bid, not a ruling. It renders
 * up with the blocking gaps, with Edit bid and Copy intake address beside it,
 * and its taps underneath; Standing rulings only points here.
 */
export function RobotNeedsSheet({ bid, questions, onClose, onEditBid, onAnswer }: RobotNeedsSheetProps) {
  const [copied, setCopied] = useState(false)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [freeText, setFreeText] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState<string | null>(null)
  if (!bid) return null
  const gaps = robotGaps(bid)
  const blocking = gaps.filter((g) => g.required)
  const soft = gaps.filter((g) => !g.required)
  const plansAsks = questions.filter((q) => effectiveTwinQuestionKind(q) === 'plans')
  const otherQuestions = questions.filter((q) => effectiveTwinQuestionKind(q) !== 'plans')
  const stops = blocking.length > 0 || plansAsks.length > 0
  const label = `b${bid.bid_number ?? '?'} · ${bid.project_name ?? 'bid'}`
  // The footer's Edit bid lands on the first blocking fix; a plans ask alone is a plans-link fix.
  const firstFix: BidFormFocus | null =
    blocking.map((g) => focusForRobotGap(g.key)).find((f): f is BidFormFocus => f != null) ?? (plansAsks.length > 0 ? 'plansLink' : null)

  async function copyIntake() {
    try {
      await navigator.clipboard.writeText(ROBOT_INTAKE_ACCOUNT)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  async function answer(q: RobotOpenQuestion, override?: string) {
    const text = (override ?? drafts[q.id] ?? '').trim()
    if (!text || !bid) return
    setBusy(q.id)
    try {
      const rerun = effectiveTwinQuestionKind(q) === 'plans' && answerRequestsRerun(text)
      const ok = await onAnswer(q.id, text, rerun ? { rerunBidId: bid.id } : undefined)
      if (ok) {
        setDrafts((p) => ({ ...p, [q.id]: '' }))
        setFreeText((p) => ({ ...p, [q.id]: false }))
      }
    } finally {
      setBusy(null)
    }
  }

  const answerRow = (q: RobotOpenQuestion, placeholder: string) => {
    // A plans ask filed before the door (v2.3210) carries no taps; offer the
    // standard three the edge function would have given it.
    const choices =
      orderedChoices(q) ??
      (effectiveTwinQuestionKind(q) === 'plans' ? orderedChoices({ choices: [...PLANS_ASK_DEFAULT_CHOICES], recommended: PLANS_ASK_DEFAULT_RECOMMENDED }) : null)
    if (choices && !freeText[q.id]) {
      return (
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <TwinQuestionChoiceButtons
            choices={choices}
            disabled={busy === q.id}
            onPick={(c) => void answer(q, answerFromChoice(c))}
            onSomethingElse={() => setFreeText((p) => ({ ...p, [q.id]: true }))}
          />
        </div>
      )
    }
    return (
      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'flex-start' }}>
        <textarea
          value={drafts[q.id] ?? ''}
          onChange={(e) => setDrafts((p) => ({ ...p, [q.id]: e.target.value }))}
          placeholder={placeholder}
          rows={2}
          autoFocus={!!choices}
          style={{ flex: 1, font: 'inherit', fontSize: '0.85rem', padding: '0.4rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'inherit', resize: 'vertical' }}
        />
        <button type="button" onClick={() => void answer(q)} disabled={busy === q.id || !(drafts[q.id] ?? '').trim()} style={{ ...smallBtn, background: '#3b82f6', color: 'white', border: 'none', fontWeight: 600, opacity: busy === q.id || !(drafts[q.id] ?? '').trim() ? 0.6 : 1 }}>
          {busy === q.id ? 'Saving…' : 'Answer'}
        </button>
      </div>
    )
  }

  return (
    <div
      role="dialog"
      aria-modal
      aria-labelledby="robot-needs-title"
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1005, padding: '1rem' }}
    >
      <div
        role="document"
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', borderRadius: 8, maxWidth: 560, width: '100%', padding: '1.1rem 1.25rem', boxShadow: '0 10px 40px rgba(0,0,0,0.15)', maxHeight: '85vh', overflowY: 'auto' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.9rem' }}>
          <RobotGlyph state={{ kind: 'needs', badge: questions.length > 0 ? String(questions.length) : '?', title: '', gaps, questions: questions.length }} size={22} />
          <div style={{ minWidth: 0 }}>
            <h2 id="robot-needs-title" style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>What the robot needs on {label}</h2>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{stops ? 'It stops here until these are fixed.' : 'It can keep going once these are answered.'}</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1, color: 'var(--text-muted)' }}>×</button>
        </div>

        {gaps.length > 0 || plansAsks.length > 0 ? (
          <ul style={{ listStyle: 'none', margin: '0 0 1rem', padding: 0, display: 'grid', gap: '0.6rem' }}>
            {blocking.map((g) => gapItem(g))}
            {plansAsks.map((q) => (
              <li key={q.id} data-testid="robot-plans-ask" style={{ display: 'grid', gridTemplateColumns: '18px 1fr', gap: '0.5rem', alignItems: 'start', fontSize: '0.875rem' }}>
                <span aria-hidden style={{ fontWeight: 700, color: 'var(--text-red-600)' }}>✗</span>
                <div style={{ display: 'grid', gap: '0.4rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'start', flexWrap: 'wrap' }}>
                    <span style={{ flex: 1, minWidth: 200 }}>
                      <span style={{ fontWeight: 600 }}>Robot needs a different plan set</span>
                      <span style={{ display: 'block', fontSize: '0.8rem', marginTop: '0.1rem' }}>🤖 {q.question}</span>
                      <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                        Fix the plans link under Job Plans on the Edit form, or share the right file with the robots’ intake address — then tap Attached — rerun and the robot goes again, front of the line next batch.
                      </span>
                    </span>
                    <span style={{ display: 'inline-flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                      <button type="button" onClick={() => void copyIntake()} style={smallBtn}>{copied ? 'Copied ✓' : 'Copy intake address'}</button>
                      <button type="button" onClick={() => { onClose(); onEditBid(bid, { focus: 'plansLink' }) }} style={smallBtn}>Edit bid</button>
                    </span>
                  </div>
                  {answerRow(q, 'Tell the robot what changed — it reads it on its next run')}
                </div>
              </li>
            ))}
            {soft.map((g) => gapItem(g))}
          </ul>
        ) : null}

        {otherQuestions.length > 0 ? (
          <>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-faint)', fontWeight: 600 }}>Robot’s questions</h3>
            <ul style={{ listStyle: 'none', margin: '0 0 1rem', padding: 0, display: 'grid', gap: '0.75rem' }}>
              {otherQuestions.map((q) => (
                <li key={q.id} style={{ display: 'grid', gap: '0.35rem', fontSize: '0.875rem' }}>
                  <div>
                    <span style={{ fontWeight: 700, color: 'var(--text-link)', marginRight: '0.4rem' }} aria-hidden>?</span>
                    {q.question}
                    {q.topic ? <span style={{ marginLeft: '0.4rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>· {q.topic}</span> : null}
                  </div>
                  {answerRow(q, 'Your answer — the robot reads it on its next run')}
                </li>
              ))}
            </ul>
          </>
        ) : null}

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
          <button type="button" onClick={() => { onClose(); onEditBid(bid, firstFix ? { focus: firstFix } : undefined) }} style={{ padding: '0.45rem 0.85rem', border: 'none', borderRadius: 4, background: '#3b82f6', color: 'white', fontWeight: 600, cursor: 'pointer', font: 'inherit', fontSize: '0.85rem' }}>
            Edit bid
          </button>
          <button type="button" onClick={onClose} style={{ padding: '0.45rem 0.85rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--bg-subtle)', color: 'inherit', cursor: 'pointer', font: 'inherit', fontSize: '0.85rem' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  )

  function gapItem(g: ReturnType<typeof robotGaps>[number]) {
    const gapFocus = focusForRobotGap(g.key)
    return (
      <li key={g.key} style={{ display: 'grid', gridTemplateColumns: '18px 1fr auto', gap: '0.5rem', alignItems: 'start', fontSize: '0.875rem' }}>
        <span aria-hidden style={{ fontWeight: 700, color: g.required ? 'var(--text-red-600)' : 'var(--text-muted)' }}>✗</span>
        <span>
          <span style={{ fontWeight: g.required ? 600 : 400 }}>{g.label}</span>
          <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)' }}>{g.required ? g.fix : `Not blocking — ${g.fix}`}</span>
        </span>
        {g.copyIntake ? (
          <button type="button" onClick={() => void copyIntake()} style={smallBtn}>{copied ? 'Copied ✓' : 'Copy intake address'}</button>
        ) : (
          <button type="button" onClick={() => { onClose(); if (bid) onEditBid(bid, gapFocus ? { focus: gapFocus } : undefined) }} style={smallBtn}>Edit bid</button>
        )}
      </li>
    )
  }
}

const smallBtn: React.CSSProperties = {
  padding: '0.3rem 0.6rem',
  border: '1px solid var(--border-strong)',
  borderRadius: 4,
  background: 'var(--bg-subtle)',
  color: 'inherit',
  cursor: 'pointer',
  font: 'inherit',
  fontSize: '0.78rem',
  whiteSpace: 'nowrap',
}
