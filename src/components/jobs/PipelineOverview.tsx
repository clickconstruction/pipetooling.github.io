/**
 * Pipeline "New" view money layers (v2.1910): the money story strip (four
 * clickable answer cards) and the Today's money moves queue, rendered above
 * the classic jump strip + board. Every figure comes from the lean
 * StagesHeaderStats spine plus the AR unallocated count — no extra fetches.
 * Old view renders none of this; the board below is identical in both views.
 */
import type { CSSProperties } from 'react'
import { buildPipelineMoneyMoves, buildPipelineMoneyStory, type PipelineMoveKey, type PipelineStoryCard } from '../../lib/jobs/pipelineOverview'
import type { StagesHeaderStats } from '../../lib/jobs/stagesHeaderStats'

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
            <span style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', fontSize: '0.64rem', color: 'var(--text-faint)' }}>
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
    'fix-dates': () => onFocusSection('billed'),
  }
  return (
    <div style={{ marginBottom: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(215px, 1fr))', gap: '0.55rem' }}>
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
            borderBottom: moves.length > 0 ? '1px solid var(--border)' : 'none',
          }}
        >
          <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
            Today&#8217;s money moves
          </span>
          {moves.length === 0 && (
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>nothing needs a move right now — the pipeline is clean ✅</span>
          )}
        </div>
        {moves.map((m, i) => (
          <div
            key={m.key}
            style={{
              display: 'flex',
              gap: '0.6rem',
              alignItems: 'center',
              padding: '0.5rem 0.85rem',
              borderBottom: i < moves.length - 1 ? '1px solid var(--border)' : 'none',
              background: m.key === 'chase-90' ? 'var(--bg-red-tint)' : 'transparent',
            }}
          >
            <span aria-hidden style={{ fontSize: '0.95rem' }}>{m.icon}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: '0.83rem', fontWeight: 600 }}>{m.claim}</span>
              <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)' }}>{m.why}</span>
            </span>
            <button
              type="button"
              onClick={moveAction[m.key]}
              style={{
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
      </div>
    </div>
  )
}
