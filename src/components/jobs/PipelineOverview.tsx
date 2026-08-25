/**
 * The Pipeline's money layers (v2.1915): the money story strip (four
 * clickable answer cards) and the Today's Money Opportunities queue, rendered above
 * the jump strip + board. Every figure comes from the lean
 * StagesHeaderStats spine plus the AR unallocated count — no extra fetches.
 * Shipped behind Old/New pills; the pills retired in v2.2012 and this is
 * now the Pipeline's only view.
 */
import type { CSSProperties } from 'react'
import {
  buildPipelineFixups,
  buildPipelineMoneyMoves,
  buildPipelineMoneyStory,
  type PipelineFixupKey,
  type PipelineMoveKey,
  type PipelineStoryCard,
} from '../../lib/jobs/pipelineOverview'
import type { StagesHeaderStats } from '../../lib/jobs/stagesHeaderStats'
import type { PaymentChaseSummary } from '../../lib/jobs/paymentChase'
import { PipelineMoneyOpportunities, type PipelineGcRoundCards } from './PipelineMoneyOpportunities'

type SectionKey = 'waiting' | 'working' | 'readyToBill' | 'billed' | 'collections'

type PipelineOverviewProps = {
  stats: StagesHeaderStats | null
  canOpenAr: boolean
  canSeeCharts: boolean
  /** dev/controller only (owner calls, v2.1916 + v2.2299): the collected-cash card. */
  canSeeCollected: boolean
  arUnallocatedCount: number | null
  onOpenCapable: () => void
  /** WAITING ON CUSTOMERS card → the per-customer "who owes what" breakdown (v2.1929). */
  onOpenBilledBreakdown: () => void
  onOpenProfitChart: () => void
  onOpenAr: () => void
  onFocusSection: (key: SectionKey) => void
  onChase90: () => void
  /** "no bill line" money move: filter the Billed section to the shells (v2.1931). */
  onFixDates: () => void
  /** Fix-ups strip (v2.1961): the data-gap alert counts, docked at the card's foot. */
  fixupCounts: { noCustomer: number; noPictures: number; noEmail: number }
  /** Opens the matching StagesAlertJobListModal (same modals the strip-row buttons open). */
  onFixup: (key: PipelineFixupKey) => void
  /** Payment chase card (v2.2025): null/undefined hides it (non-office roles, or nothing anywhere). */
  chase?: PaymentChaseSummary | null
  onStartChase?: () => void
  /**
   * Personal statement rounds (v2.2072). `held` = GCs over the threshold
   * waiting on certification (the certifier's card); `ready` = the current
   * user's certified, unsent queue (the sender's card). Null/zero hides each.
   */
  gcRound?: PipelineGcRoundCards
  onCertifyRound?: () => void
  onStartRound?: () => void
}

const cardBase: CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 10,
  padding: '0.6rem 0.8rem',
  background: 'var(--bg-subtle)',
  textAlign: 'left',
  fontFamily: 'inherit',
  color: 'inherit',
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  minWidth: 0,
}

function StorySparkline({ points }: { points: number[] }) {
  const w = 120
  const h = 22
  const max = Math.max(...points, 1)
  const step = points.length > 1 ? w / (points.length - 1) : w
  const xy = points.map((v, i) => [i * step, h - 3 - (v / max) * (h - 6)] as const)
  const last = xy[xy.length - 1]
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden style={{ marginTop: 3 }}>
      <polyline
        points={xy.map(([x, y]) => `${x},${y.toFixed(1)}`).join(' ')}
        fill="none"
        stroke="var(--text-green-600)"
        strokeWidth={2}
      />
      {last && <circle cx={last[0]} cy={Number(last[1].toFixed(1))} r={2.5} fill="var(--text-green-600)" />}
    </svg>
  )
}

function StoryCardBody({ card }: { card: PipelineStoryCard }) {
  const barTotal = card.ageBar ? card.ageBar.fresh + card.ageBar.mid + card.ageBar.old : 0
  return (
    <>
      <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {card.label}
      </span>
      <span
        style={{
          fontSize: '1.25rem',
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1.15,
          color: card.tone === 'green' ? 'var(--text-green-600)' : 'var(--text)',
        }}
      >
        {card.value}
      </span>
      {card.ageBar && barTotal > 0 ? (
        <>
          <span aria-hidden style={{ display: 'flex', height: 7, borderRadius: 4, overflow: 'hidden', marginTop: 4, gap: 2 }}>
            {card.ageBar.fresh > 0 && (
              <span style={{ width: `${(card.ageBar.fresh / barTotal) * 100}%`, background: 'var(--bg-blue-200)', borderRadius: 2 }} />
            )}
            {card.ageBar.mid > 0 && (
              <span style={{ width: `${(card.ageBar.mid / barTotal) * 100}%`, background: 'var(--bg-amber-200)', borderRadius: 2 }} />
            )}
            {card.ageBar.old > 0 && (
              <span style={{ width: `${(card.ageBar.old / barTotal) * 100}%`, background: 'var(--text-red-600)', borderRadius: 2 }} />
            )}
          </span>
          {card.ageBarLabels && (
            <span style={{ display: 'flex', justifyContent: 'space-between', gap: '0.15rem 0.5rem', flexWrap: 'wrap', fontSize: '0.64rem', color: 'var(--text-faint)' }}>
              <span>{card.ageBarLabels.left}</span>
              <span style={{ color: 'var(--text-red-600)' }}>{card.ageBarLabels.right}</span>
            </span>
          )}
        </>
      ) : null}
      {card.spark ? <StorySparkline points={card.spark} /> : null}
      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{card.sub}</span>
    </>
  )
}

export function PipelineOverview({
  stats,
  canOpenAr,
  canSeeCharts,
  canSeeCollected,
  arUnallocatedCount,
  onOpenCapable,
  onOpenBilledBreakdown,
  onOpenProfitChart,
  onOpenAr,
  onFocusSection,
  onChase90,
  onFixDates,
  fixupCounts,
  onFixup,
  chase,
  onStartChase,
  gcRound,
  onCertifyRound,
  onStartRound,
}: PipelineOverviewProps) {
  if (!stats) {
    return (
      <div style={{ marginBottom: '0.85rem', fontSize: '0.85rem', color: 'var(--text-muted)' }} aria-busy>
        Loading the money story…
      </div>
    )
  }
  const cards = buildPipelineMoneyStory(stats, { includeCollected: canSeeCollected })
  const moves = buildPipelineMoneyMoves({ stats, arUnallocatedCount, canOpenAr })
  const fixups = buildPipelineFixups(fixupCounts)
  const cardAction: Record<PipelineStoryCard['key'], (() => void) | undefined> = {
    'ready-to-ask': onOpenCapable,
    'waiting-on-customers': onOpenBilledBreakdown,
    'in-collections': () => onFocusSection('collections'),
    collected: canSeeCharts ? onOpenProfitChart : undefined,
  }
  const cardTitle: Record<PipelineStoryCard['key'], string> = {
    'ready-to-ask': 'Finished work not yet billed — open the Capable of Being Billed list',
    'waiting-on-customers': 'See who owes what — open the per-customer breakdown',
    'in-collections': 'Jump to Collections',
    collected: canSeeCharts ? 'Open the paid profit chart' : 'Payments recorded in the last 30 days',
  }
  const moveAction: Record<PipelineMoveKey, () => void> = {
    'bill-capable': onOpenCapable,
    'chase-90': onChase90,
    'allocate-deposits': onOpenAr,
    'fix-dates': onFixDates,
  }
  return (
    <div style={{ marginBottom: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      {/* min 160px (v2.1971): lets phones show the story 2×2 instead of a
          full-width stack; auto-fit still caps at 4-across on wide screens. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(160px, 100%), 1fr))', gap: '0.55rem' }}>
        {cards.map((card) => {
          const action = cardAction[card.key]
          const redEdge = card.tone === 'red-edge' ? { borderLeft: '3px solid var(--text-red-600)' } : undefined
          return action ? (
            <button key={card.key} type="button" onClick={action} title={cardTitle[card.key]} style={{ ...cardBase, ...redEdge, cursor: 'pointer' }}>
              <StoryCardBody card={card} />
            </button>
          ) : (
            <div key={card.key} title={cardTitle[card.key]} style={{ ...cardBase, ...redEdge }}>
              <StoryCardBody card={card} />
            </div>
          )
        })}
      </div>
      <PipelineMoneyOpportunities
        moves={moves}
        moveAction={moveAction}
        fixups={fixups}
        onFixup={onFixup}
        chase={chase}
        onStartChase={onStartChase}
        gcRound={gcRound}
        onCertifyRound={onCertifyRound}
        onStartRound={onStartRound}
      />
    </div>
  )
}
