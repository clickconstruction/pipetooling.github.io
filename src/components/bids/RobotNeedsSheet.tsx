import { useState } from 'react'
import type { Bid } from '../../types/bids'
import { robotGaps } from '../../lib/bids/robotRowState'
import { ROBOT_INTAKE_ACCOUNT } from '../../lib/bids/robotReadinessLine'
import { RobotGlyph } from './RobotGlyph'

export type RobotOpenQuestion = {
  id: string
  question: string
  topic: string | null
  created_at: string
}

type RobotNeedsSheetProps = {
  /** The human bid the robot is stuck on; null = closed. */
  bid: Bid | null
  questions: RobotOpenQuestion[]
  onClose: () => void
  onEditBid: (bid: Bid) => void
  /** Answer one question; resolves true when the row was written. */
  onAnswer: (questionId: string, text: string) => Promise<boolean>
}

/**
 * The amber-icon click: what the robot needs from a person before it can go
 * on — plans it can't open (with the intake address to share with), warnings
 * that don't block, and the questions it asked, answerable in place. Replaces
 * the v2.2530 readiness checklist; the kickoff prompt lives on the dev Queue lens.
 */
export function RobotNeedsSheet({ bid, questions, onClose, onEditBid, onAnswer }: RobotNeedsSheetProps) {
  const [copied, setCopied] = useState(false)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  if (!bid) return null
  const gaps = robotGaps(bid)
  const blocking = gaps.filter((g) => g.required)
  const soft = gaps.filter((g) => !g.required)
  const label = `b${bid.bid_number ?? '?'} · ${bid.project_name ?? 'bid'}`

  async function copyIntake() {
    try {
      await navigator.clipboard.writeText(ROBOT_INTAKE_ACCOUNT)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  async function answer(q: RobotOpenQuestion) {
    const text = (drafts[q.id] ?? '').trim()
    if (!text || !bid) return
    setBusy(q.id)
    try {
      const ok = await onAnswer(q.id, text)
      if (ok) setDrafts((p) => ({ ...p, [q.id]: '' }))
    } finally {
      setBusy(null)
    }
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
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{blocking.length > 0 ? 'It stops here until these are fixed.' : 'It can keep going once these are answered.'}</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1, color: 'var(--text-muted)' }}>×</button>
        </div>

        {gaps.length > 0 ? (
          <ul style={{ listStyle: 'none', margin: '0 0 1rem', padding: 0, display: 'grid', gap: '0.6rem' }}>
            {[...blocking, ...soft].map((g) => (
              <li key={g.key} style={{ display: 'grid', gridTemplateColumns: '18px 1fr auto', gap: '0.5rem', alignItems: 'start', fontSize: '0.875rem' }}>
                <span aria-hidden style={{ fontWeight: 700, color: g.required ? 'var(--text-red-600)' : 'var(--text-muted)' }}>✗</span>
                <span>
                  <span style={{ fontWeight: g.required ? 600 : 400 }}>{g.label}</span>
                  <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)' }}>{g.required ? g.fix : `Not blocking — ${g.fix}`}</span>
                </span>
                {g.copyIntake ? (
                  <button type="button" onClick={() => void copyIntake()} style={smallBtn}>{copied ? 'Copied ✓' : 'Copy intake address'}</button>
                ) : (
                  <button type="button" onClick={() => { onClose(); onEditBid(bid) }} style={smallBtn}>Edit bid</button>
                )}
              </li>
            ))}
          </ul>
        ) : null}

        {questions.length > 0 ? (
          <>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-faint)', fontWeight: 600 }}>Robot’s questions</h3>
            <ul style={{ listStyle: 'none', margin: '0 0 1rem', padding: 0, display: 'grid', gap: '0.75rem' }}>
              {questions.map((q) => (
                <li key={q.id} style={{ display: 'grid', gap: '0.35rem', fontSize: '0.875rem' }}>
                  <div>
                    <span style={{ fontWeight: 700, color: 'var(--text-link)', marginRight: '0.4rem' }} aria-hidden>?</span>
                    {q.question}
                    {q.topic ? <span style={{ marginLeft: '0.4rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>· {q.topic}</span> : null}
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'flex-start' }}>
                    <textarea
                      value={drafts[q.id] ?? ''}
                      onChange={(e) => setDrafts((p) => ({ ...p, [q.id]: e.target.value }))}
                      placeholder="Your answer — the robot reads it on its next run"
                      rows={2}
                      style={{ flex: 1, font: 'inherit', fontSize: '0.85rem', padding: '0.4rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'inherit', resize: 'vertical' }}
                    />
                    <button type="button" onClick={() => void answer(q)} disabled={busy === q.id || !(drafts[q.id] ?? '').trim()} style={{ ...smallBtn, background: '#3b82f6', color: 'white', border: 'none', fontWeight: 600, opacity: busy === q.id || !(drafts[q.id] ?? '').trim() ? 0.6 : 1 }}>
                      {busy === q.id ? 'Saving…' : 'Answer'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
          <button type="button" onClick={() => { onClose(); onEditBid(bid) }} style={{ padding: '0.45rem 0.85rem', border: 'none', borderRadius: 4, background: '#3b82f6', color: 'white', fontWeight: 600, cursor: 'pointer', font: 'inherit', fontSize: '0.85rem' }}>
            Edit bid
          </button>
          <button type="button" onClick={onClose} style={{ padding: '0.45rem 0.85rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--bg-subtle)', color: 'inherit', cursor: 'pointer', font: 'inherit', fontSize: '0.85rem' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
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
