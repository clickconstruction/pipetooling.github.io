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
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import type { StagesHeaderStats } from '../../lib/jobs/stagesHeaderStats'
import type { PaymentChaseSummary } from '../../lib/jobs/paymentChase'

type SectionKey = 'waiting' | 'working' | 'readyToBill' | 'billed' | 'collections'

type PipelineOverviewProps = {
  stats: StagesHeaderStats | null
  canOpenAr: boolean
  canSeeCharts: boolean
  /** dev/master only (owner call, v2.1916): the collected-cash card. */
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
    collected: canSeeCharts ? 'Open the paid profit chart' : 'Payments recorded in the last 8 weeks',
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
      <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: '0.5rem',
            padding: '0.45rem 0.85rem',
            background: 'var(--bg-subtle)',
            borderBottom: moves.length > 0 || fixups.length > 0 || chase ? '1px solid var(--border)' : 'none',
          }}
        >
          <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
            Today&#8217;s Money Opportunities:
          </span>
          {moves.length === 0 && fixups.length === 0 && !chase && (
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>nothing needs a move right now — the pipeline is clean ✅</span>
          )}
        </div>
        {/* Card grid (v2.1966): moves tile across the width on big screens
            (the story cards' auto-fit pattern) and stack one-per-row on
            phones — full-width rows left a desert of empty space between
            claim and button on desktop. min(300px, 100%) guards ultra-narrow
            containers from horizontal overflow. */}
        {(moves.length > 0 || fixups.length > 0 || chase != null) && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))',
              gap: '0.55rem',
              padding: '0.6rem 0.85rem',
            }}
          >
            {moves.map((m) => (
              <div
                key={m.key}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.3rem',
                  minWidth: 0,
                  padding: '0.55rem 0.7rem',
                  border: '1px solid var(--border)',
                  borderLeft: m.key === 'chase-90' ? '3px solid var(--text-red-600)' : '1px solid var(--border)',
                  borderRadius: 8,
                  background: m.key === 'chase-90' ? 'var(--bg-red-tint)' : 'var(--surface)',
                }}
              >
                <span style={{ display: 'flex', gap: '0.45rem', alignItems: 'baseline', minWidth: 0 }}>
                  <span aria-hidden style={{ fontSize: '0.95rem' }}>{m.icon}</span>
                  <span style={{ fontSize: '0.83rem', fontWeight: 600, minWidth: 0, color: m.idle ? 'var(--text-muted)' : 'inherit' }}>{m.claim}</span>
                  {m.badgeCount ? (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: 16,
                        height: 16,
                        padding: '0 4px',
                        borderRadius: 9999,
                        background: '#f59e0b',
                        color: '#1c1917',
                        fontSize: '0.62rem',
                        fontWeight: 700,
                      }}
                    >
                      {m.badgeCount}
                    </span>
                  ) : null}
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', flex: 1 }}>{m.why}</span>
                <button
                  type="button"
                  onClick={moveAction[m.key]}
                  style={{
                    alignSelf: 'flex-end',
                    height: 26,
                    padding: '0 0.65rem',
                    border: '1px solid var(--border-400)',
                    borderRadius: 9999,
                    background: 'var(--surface)',
                    color: 'var(--text-blue-700)',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {m.actionLabel}
                </button>
              </div>
            ))}
            {/* Payment chase card (v2.2025): who owes us a phone call about
                money. Office-only (the parent passes null otherwise); hidden
                when nobody owes a call and nothing is waiting. */}
            {chase && onStartChase ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.3rem',
                  minWidth: 0,
                  padding: '0.55rem 0.7rem',
                  border: '1px solid var(--border)',
                  borderLeft: chase.dueCustomers > 0 ? '3px solid var(--text-red-600)' : '1px solid var(--border)',
                  borderRadius: 8,
                  background: 'var(--surface)',
                }}
              >
                <span style={{ display: 'flex', gap: '0.45rem', alignItems: 'baseline', minWidth: 0 }}>
                  <span aria-hidden style={{ fontSize: '0.95rem' }}>📞</span>
                  <span style={{ fontSize: '0.83rem', fontWeight: 600, minWidth: 0, color: chase.dueCustomers > 0 ? 'inherit' : 'var(--text-muted)' }}>
                    {chase.dueCustomers > 0
                      ? `Ask ${chase.dueCustomers} customer${chase.dueCustomers === 1 ? '' : 's'} when they'll pay — ${formatUsdNoCents(chase.dueDollars)}`
                      : 'Payment follow-up · everyone asked'}
                  </span>
                  {chase.dueCustomers > 0 ? (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: 16,
                        height: 16,
                        padding: '0 4px',
                        borderRadius: 9999,
                        background: '#f59e0b',
                        color: '#1c1917',
                        fontSize: '0.62rem',
                        fontWeight: 700,
                      }}
                    >
                      {chase.dueCustomers}
                    </span>
                  ) : null}
                </span>
                <span style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.68rem', fontWeight: 600 }}>
                  {chase.askCount > 0 ? (
                    <span style={{ padding: '0.1rem 0.5rem', borderRadius: 6, background: 'var(--bg-red-tint)', color: 'var(--text-red-700)' }}>
                      Never asked · {chase.askCount}
                    </span>
                  ) : null}
                  {chase.brokenCount > 0 ? (
                    <span style={{ padding: '0.1rem 0.5rem', borderRadius: 6, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)' }}>
                      Broken promise · {chase.brokenCount}
                    </span>
                  ) : null}
                  {chase.waitingCount > 0 ? (
                    <span style={{ padding: '0.1rem 0.5rem', borderRadius: 6, background: 'var(--bg-subtle)', color: 'var(--text-muted)', border: '1px dashed var(--border-strong)' }}>
                      Waiting · {chase.waitingCount}
                    </span>
                  ) : null}
                  {chase.disputeCount > 0 ? (
                    <span style={{ padding: '0.1rem 0.5rem', borderRadius: 6, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)' }}>
                      Dispute · {chase.disputeCount}
                    </span>
                  ) : null}
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', flex: 1 }}>
                  bills past their expected date with no promise — plus broken promises to chase
                </span>
                <button
                  type="button"
                  onClick={onStartChase}
                  style={{
                    alignSelf: 'flex-end',
                    height: 26,
                    padding: '0 0.65rem',
                    border: '1px solid var(--border-400)',
                    borderRadius: 9999,
                    background: 'var(--surface)',
                    color: 'var(--text-blue-700)',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Start call mode →
                </button>
              </div>
            ) : null}
            {/* Fix-ups joined the grid as a card (v2.1977; was a footer strip,
                v2.1961) — amber-edged, chips inside, gone when the data is
                clean. Each chip keeps its own action, so no card button. */}
            {fixups.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem',
                  minWidth: 0,
                  padding: '0.55rem 0.7rem',
                  border: '1px solid var(--border)',
                  borderLeft: '3px solid #d97706',
                  borderRadius: 8,
                  background: 'var(--surface)',
                }}
              >
                <span style={{ display: 'flex', gap: '0.45rem', alignItems: 'baseline', minWidth: 0 }}>
                  <span aria-hidden style={{ fontSize: '0.95rem' }}>🔎</span>
                  <span style={{ fontSize: '0.83rem', fontWeight: 600, minWidth: 0 }}>Fix-ups — missing data blocks billing</span>
                </span>
                <span style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center', flex: 1 }}>
                  {fixups.map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => onFixup(f.key)}
                      title={f.title}
                      style={{
                        padding: '0.15rem 0.65rem',
                        borderRadius: 9999,
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        fontFamily: 'inherit',
                        cursor: 'pointer',
                        background: f.tone === 'red' ? 'var(--bg-red-tint)' : 'var(--bg-amber-tint)',
                        color: f.tone === 'red' ? 'var(--text-red-700)' : 'var(--text-amber-700)',
                        border: `1px solid ${f.tone === 'red' ? '#fecaca' : '#fcd34d'}`,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  each chip opens its fix-it list — this card disappears when the data is clean
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
