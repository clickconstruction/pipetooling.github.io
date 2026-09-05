/**
 * The one follow-through every Won moment shares (Tier-1 #8): "Open the job" → the app-level
 * New Job form prefilled from this bid (`openNewJob({ prefillBidId })` — the same prefill the
 * Import door runs), and, once a job exists, the "J1007 opened from this bid" chip that opens it.
 *
 * Renders in two shapes: the full Job block (Edit Bid Win/Loss row, Waiting-to-hear win strip) and a
 * `compact` inline link beside a GC pill that reads won (board lines, Followup's per-GC panel).
 * Who sees which button is `wonMomentActions` — nothing here reads `bid_versions.outcome`.
 */
import { useAuth } from '../../hooks/useAuth'
import { useJobFormModal } from '../../contexts/JobFormModalContext'
import { useJobsOpenedFromBid } from '../../hooks/useJobsOpenedFromBid'
import type { BidBoardJobLink } from '../../lib/bids/bidBoardJobLinks'
import { bidJobLinkLabel, wonMomentActions, type WonMomentAction } from '../../lib/bids/wonMomentActions'

type Props = {
  bidId: string
  /** The bid reads Won / Started — emphasize the door ("You won it"). */
  won?: boolean
  /**
   * The board already indexes jobs by bid (v2.2741): pass its answer (a link or null) to skip the
   * per-row lookup. Leave undefined to look the link up here.
   */
  knownJob?: BidBoardJobLink | null
  /** Inline beside a won pill: one small link, no chip (the board's Links column carries the J#### chip). */
  compact?: boolean
  /** Fires after a job form was opened — callers close their own popovers / strips. */
  onOpenedForm?: () => void
}

const CHIP_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.3rem',
  padding: '0.12rem 0.55rem',
  borderRadius: 9999,
  border: '1px solid var(--border-green)',
  background: 'var(--bg-green-tint)',
  color: 'var(--text-green-700)',
  fontSize: '0.78rem',
  fontWeight: 600,
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
  lineHeight: 1.35,
}

function buttonStyle(a: WonMomentAction, won: boolean): React.CSSProperties {
  if (a.primary) {
    return {
      padding: '0.45rem 0.85rem',
      fontSize: '0.875rem',
      fontWeight: 600,
      fontFamily: 'inherit',
      background: won ? '#16a34a' : '#3b82f6',
      color: 'white',
      border: 'none',
      borderRadius: 6,
      cursor: 'pointer',
    }
  }
  return {
    padding: '0.4rem 0.7rem',
    fontSize: '0.8125rem',
    fontFamily: 'inherit',
    background: 'var(--surface)',
    color: 'var(--text-700)',
    border: '1px solid var(--border-strong)',
    borderRadius: 6,
    cursor: 'pointer',
  }
}

export function BidWonJobActions({ bidId, won = false, knownJob, compact = false, onOpenedForm }: Props) {
  const { role } = useAuth()
  const jobFormModal = useJobFormModal()
  const lookup = useJobsOpenedFromBid(knownJob === undefined ? bidId : null)
  const jobs: BidBoardJobLink[] = knownJob === undefined ? lookup.jobs : knownJob ? [knownJob] : []
  const newest = jobs[0] ?? null
  const actions = wonMomentActions({ hasJob: newest != null, role })

  // No provider (partial trees, tests) → no door to offer.
  if (!jobFormModal) return null

  const run = (a: WonMomentAction) => {
    if (a.key === 'open_existing' && newest) jobFormModal.openEditJob(newest.jobId)
    else jobFormModal.openNewJob({ prefillBidId: bidId })
    onOpenedForm?.()
  }

  if (compact) {
    // Beside a won pill: only the create door (the row's Links column already shows the J#### chip).
    const create = actions.find((a) => a.key === 'create')
    if (!create) return null
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          run(create)
        }}
        title="You won it — open a job from this bid with the customer, address and links filled in"
        style={{
          fontFamily: 'inherit',
          fontSize: '0.7rem',
          fontWeight: 600,
          color: 'var(--text-green-700)',
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          textDecoration: 'underline dotted',
          textUnderlineOffset: 3,
        }}
      >
        open the job →
      </button>
    )
  }

  if (actions.length === 0 && !newest) return null

  return (
    <div data-testid="bid-won-job-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
      {newest ? (
        <span style={CHIP_STYLE} title={jobs.length > 1 ? `${jobs.length} jobs were opened from this bid — newest shown` : undefined}>
          {bidJobLinkLabel(newest)}
          {jobs.length > 1 ? <span style={{ fontWeight: 500, color: 'var(--text-muted)' }}>+{jobs.length - 1}</span> : null}
        </span>
      ) : null}
      {actions.map((a) => (
        <button key={a.key} type="button" onClick={() => run(a)} style={buttonStyle(a, won)}>
          {a.label}
        </button>
      ))}
      {!newest && won && actions.length > 0 ? (
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
          You won it — the job opens with the customer, address and links filled in, and the bid linked on the job.
        </span>
      ) : null}
    </div>
  )
}
