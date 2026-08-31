import type { Bid } from '../../types/bids'
import { referenceGrade, referenceQualityFlags, type ReferenceGradeLetter } from '../../lib/bids/referenceGrade'

export const GRADE_COLORS: Record<ReferenceGradeLetter, string> = {
  A: '#16a34a',
  B: '#d97706',
  C: '#d97706',
  D: '#d97706',
  X: '#9ca3af',
}

const GRADE_MEANING: Record<ReferenceGradeLetter, string> = {
  A: 'Full training reference — robots can check counts, dollars, and the market result against this.',
  B: 'Dollar scorecard only — robots can check their total against this, but not their counts.',
  C: 'Quantity scorecard only — counts exist, but no trustworthy final number.',
  D: 'Census practice only — plans exist, but nothing recorded to score against.',
  X: 'Not backtestable — no plans on file.',
}

type RobotReferenceGradeModalProps = {
  /** Decided bid whose grade is shown; null = closed. */
  bid: Bid | null
  presence: { hasCounts: boolean; hasPricing: boolean } | null
  onClose: () => void
  onEditBid: (bid: Bid) => void
}

/**
 * Reference-grade modal (v2.2547): the decided-row robot icon's click. Same
 * chrome as the readiness checklist, reframed for learning — what this record
 * can teach the robots, what's missing, and the one-tap fixes.
 */
export function RobotReferenceGradeModal({ bid, presence, onClose, onEditBid }: RobotReferenceGradeModalProps) {
  if (!bid) return null
  const grade = referenceGrade({
    hasPlans: !!bid.plans_link?.trim(),
    hasValue: bid.bid_value != null && Number(bid.bid_value) > 0,
    hasCounts: presence?.hasCounts ?? false,
    hasPricing: presence?.hasPricing ?? false,
  })
  const flags = referenceQualityFlags(
    {
      bid_value: bid.bid_value,
      outcome: bid.outcome,
      loss_category: bid.loss_category,
      when: bid.bid_date_sent ?? bid.created_at,
    },
    new Date().toISOString().slice(0, 10),
  )

  const rows: Array<{ ok: boolean; warn?: boolean; label: string; fix?: string }> = [
    { ok: !!bid.plans_link?.trim(), label: 'Plans on file', fix: 'Find the plan set (Drive folder, GC portal) and paste the link on the Edit form.' },
    {
      ok: bid.bid_value != null && Number(bid.bid_value) > 0,
      label: bid.bid_value != null && Number(bid.bid_value) > 0 ? `Final value recorded — $${Math.round(Number(bid.bid_value)).toLocaleString()}` : 'Final value recorded',
      fix: 'The number we actually sent was never written down — add it if anyone remembers or the PDF exists.',
    },
    { ok: presence?.hasCounts ?? false, label: 'Takeoff rows entered', fix: 'Counts were never entered — a robot can’t compare quantities. (Big lift; only worth it on bids we want to learn from.)' },
    { ok: presence?.hasPricing ?? false, label: 'Pricing assignments attached', fix: 'Rows exist but were never priced against a book.' },
  ]
  const warns: Array<{ label: string; fix: string }> = []
  if (flags.roundValue) warns.push({ label: 'Round-number value', fix: 'The value ends in 00 — hand-entered from memory? Robots treat it with caution.' })
  if (flags.weakLoss) warns.push({ label: 'Loss never really competed', fix: `Loss category "${bid.loss_category}" — this number is a weak calibration target.` })
  if (flags.lossUncategorized) warns.push({ label: 'Loss has no category', fix: 'One tap on the loss pill tells robots whether this number really competed.' })
  if (flags.stale) warns.push({ label: 'Over 6 months old', fix: 'Prices and practices have drifted — counts still teach, dollars less so.' })

  return (
    <div
      role="dialog"
      aria-modal
      aria-labelledby="robot-reference-grade-title"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1005, padding: '1rem' }}
      onClick={onClose}
    >
      <div
        role="document"
        style={{ background: 'var(--surface)', borderRadius: 8, maxWidth: 560, width: '100%', padding: '1.25rem', boxShadow: '0 10px 40px rgba(0,0,0,0.15)', maxHeight: '85vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="robot-reference-grade-title" style={{ margin: '0 0 0.75rem', fontSize: '1.125rem', fontWeight: 600 }}>
          {'\u{1F916} '}Reference grade — b{bid.bid_number ?? '?'} {bid.project_name ?? ''}
        </h2>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', marginBottom: '0.85rem' }}>
          <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 800, fontSize: '1.15rem', padding: '0.2rem 0.8rem', borderRadius: 8, color: 'white', background: GRADE_COLORS[grade] }}>
            {grade}
          </span>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{GRADE_MEANING[grade]}</span>
        </div>

        <ul style={{ listStyle: 'none', margin: '0 0 1rem', padding: 0, display: 'grid', gap: '0.55rem' }}>
          {rows.map((r) => (
            <li key={r.label} style={{ display: 'flex', gap: '0.6rem', alignItems: 'baseline', fontSize: '0.875rem' }}>
              <span aria-hidden style={{ fontWeight: 700, color: r.ok ? 'var(--text-emerald-800)' : 'var(--text-red-600)' }}>{r.ok ? '✓' : '✗'}</span>
              <span>
                <span style={{ fontWeight: r.ok ? 400 : 600 }}>{r.label}</span>
                {!r.ok && r.fix ? <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)' }}>{r.fix}</span> : null}
              </span>
            </li>
          ))}
          {warns.map((w) => (
            <li key={w.label} style={{ display: 'flex', gap: '0.6rem', alignItems: 'baseline', fontSize: '0.875rem' }}>
              <span aria-hidden style={{ fontWeight: 700, color: 'var(--text-amber-800)' }}>⚠</span>
              <span>
                <span style={{ fontWeight: 600 }}>{w.label}</span>
                <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)' }}>{w.fix}</span>
              </span>
            </li>
          ))}
        </ul>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => { onClose(); onEditBid(bid) }}
            style={{ padding: '0.5rem 0.85rem', border: 'none', borderRadius: 4, background: '#3b82f6', color: 'white', fontWeight: 600, cursor: 'pointer' }}
          >
            Edit bid to fix
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '0.5rem 0.85rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--bg-subtle)', cursor: 'pointer' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
