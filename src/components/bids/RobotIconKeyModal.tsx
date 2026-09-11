import type { ReferenceGradeLetter } from '../../lib/bids/referenceGrade'
import type { RobotRowState } from '../../lib/bids/robotRowState'
import { GATE_B_PCT, GATE_B_STREAK } from '../../lib/bids/confidenceBoard'
import { RobotGlyph } from './RobotGlyph'
import { GRADE_COLORS } from './RobotReferenceGradeModal'

const LIVE_ROWS: Array<{ state: RobotRowState; title: string; text: string }> = [
  { state: { kind: 'queued', title: '' }, title: 'Robot is on it', text: 'Outline = queued for the next batch. Solid = reading the plans and counting. A lock badge = it sealed its number; nobody sees that number until you send. Click for its status.' },
  { state: { kind: 'needs', badge: '?', title: '', gaps: [], questions: 0 }, title: 'Robot needs something from you', text: 'Plans it can’t open, or a question it asked (the badge counts the questions). Click to see exactly what, with the fix.' },
  { state: { kind: 'scored', title: '', deltaPct: null, twinBidNumber: null }, title: 'Scored', text: 'You sent the bid and the robot’s sealed number was checked against yours. Hover for how far off it was; click to compare counts and pricing.' },
  { state: { kind: 'off', reason: 'opt-out', title: '' }, title: 'Not this bid', text: 'Opted out on the bid form, or a division robots don’t bid yet.' },
]

const GRADE_ROWS: Array<{ grade: ReferenceGradeLetter; text: string }> = [
  { grade: 'A', text: 'Plans, final value, counts, and pricing on record. The robot can check counts, dollars, and the market result.' },
  { grade: 'B', text: 'Plans and a final value. Dollar scorecard only.' },
  { grade: 'C', text: 'Plans and counts, no trustworthy final value. Quantity scorecard only.' },
  { grade: 'D', text: 'Plans only. Census practice, nothing to score against.' },
  { grade: 'X', text: 'No plans link. Robots can’t rebuild this bid at all.' },
]

/**
 * The robot-icon key (opened from the ? beside the Bid # header and from the
 * pinned pill row on phones): every state the icon can show, live and graded.
 */
export function RobotIconKeyModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal
      aria-label="What the robot icon means"
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', borderRadius: 8, padding: '1.25rem 1.5rem', maxWidth: 520, width: '100%', maxHeight: '85vh', overflowY: 'auto' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.05rem' }}>What the robot icon means</h2>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1, color: 'inherit' }}>×</button>
        </div>

        <p style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Every plumbing bid with readable plans gets a robot estimate on its own — nobody has to ask. The icon beside the bid number says how that’s going.
        </p>

        {/* v2.3337: the sealed-envelope explainer, back from the deleted Shadows lens (v2.3222).
            This key is where a new estimator looks when they ask why the number is hidden. */}
        <div
          data-testid="robot-key-envelope"
          style={{ display: 'grid', gridTemplateColumns: '26px 1fr', gap: '0.55rem', padding: '0.6rem 0.7rem', margin: '0 0 0.9rem', borderRadius: 6, background: 'var(--bg-violet-100, var(--bg-muted))', border: '1px solid var(--border-violet)', fontSize: '0.8rem' }}
        >
          <span aria-hidden style={{ fontSize: '1rem', lineHeight: 1.2 }}>🔒</span>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--text-strong)' }}>Why you can’t see the robot’s number yet</div>
            <div style={{ color: 'var(--text-muted)' }}>
              The robot does its own version of the bid <b style={{ color: 'var(--text-violet-700, var(--text-strong))' }}>in secret</b>. It can’t peek at our number, because ours doesn’t exist yet. It seals its price in an envelope. When we send the real bid, the envelope opens and the score is kept on its own. Close enough, often enough — {GATE_B_STREAK} in a row within {GATE_B_PCT}% — earns it first drafts for that kind of job.
            </div>
          </div>
        </div>

        <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-faint)', fontWeight: 600, margin: '0 0 0.5rem' }}>On a live bid</div>
        <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr', gap: '0.55rem 0.7rem', alignItems: 'start', fontSize: '0.85rem', marginBottom: '1rem' }}>
          {LIVE_ROWS.map((r) => (
            <div key={r.title} style={{ display: 'contents' }}>
              <span style={{ display: 'inline-flex', justifyContent: 'center', paddingTop: 2 }}><RobotGlyph state={r.state} size={20} /></span>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-strong)' }}>{r.title}</div>
                <div style={{ color: 'var(--text-muted)' }}>{r.text}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-faint)', fontWeight: 600, margin: '0 0 0.5rem' }}>On a sent or decided bid — how much a robot can learn from the record</div>
        <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr', gap: '0.45rem 0.7rem', alignItems: 'center', fontSize: '0.85rem', marginBottom: '0.9rem' }}>
          {GRADE_ROWS.map((r) => (
            <div key={r.grade} style={{ display: 'contents' }}>
              <span style={{ display: 'inline-grid', placeItems: 'center', width: 24, height: 20, borderRadius: 4, color: 'white', background: GRADE_COLORS[r.grade], fontFamily: 'ui-monospace, monospace', fontWeight: 800, fontSize: '0.72rem', justifySelf: 'center' }}>{r.grade}</span>
              <span style={{ color: 'var(--text-muted)' }}>{r.text}</span>
            </div>
          ))}
        </div>

        <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: '0.6rem' }}>
          Click any grade for what’s missing and an Edit bid link. Today’s bids are tomorrow’s training set — a sent bid with its value, counts, and prices recorded is worth an A.
        </p>
      </div>
    </div>
  )
}
