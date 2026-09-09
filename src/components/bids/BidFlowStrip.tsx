import type { CSSProperties } from 'react'
import { bidFlowSegments, bidFlowSummary, type BidFlow, type BidFlowDoor, type BidFlowPhase, type BidFlowStep } from '../../lib/bids/bidFlow'

/**
 * The estimating poster drawn on a bid (v2.3200). Two sizes:
 * - `full` — under the selected-bid title on the workflow tabs.
 * - `compact` — twelve dots on the Bid Board row where the jump icons sit.
 * Both read one `BidFlow` from `deriveBidFlow`, so they cannot disagree.
 * Colour is never the only channel: every node carries its number or a ✓,
 * a dashed ring means untracked, and the tooltip names the proxy.
 */

type Props = {
  flow: BidFlow
  variant: 'full' | 'compact' | 'hairline'
  /** Open a step's door. Return false (or omit) to render the step without a button. */
  onOpenDoor?: (door: BidFlowDoor, step: BidFlowStep) => void
  canOpenDoor?: (door: BidFlowDoor) => boolean
  bidLabel?: string
  /** The Review step's stamp, once there is one: caption under the node and the tooltip's text. */
  reviewStamp?: { label: string | null; tooltip: string | null } | null
}

const DONE = 'var(--text-green-700, #15803d)'
const NEXT = 'var(--text-blue-500, #3b82f6)'
const TODO = 'var(--border-strong)'

function nodeColors(step: BidFlowStep, decided: boolean): { border: string; bg: string; fg: string; dash: boolean; ring: boolean } {
  switch (step.state) {
    case 'done':
      return { border: DONE, bg: DONE, fg: '#fff', dash: false, ring: false }
    case 'next':
      return { border: NEXT, bg: 'var(--surface)', fg: NEXT, dash: false, ring: !decided }
    case 'untracked':
      return { border: 'var(--border)', bg: 'var(--bg-subtle)', fg: 'var(--text-faint)', dash: true, ring: false }
    case 'loading':
      return { border: 'var(--border)', bg: 'var(--bg-muted)', fg: 'transparent', dash: false, ring: false }
    default:
      return { border: TODO, bg: 'var(--surface)', fg: 'var(--text-muted)', dash: false, ring: false }
  }
}

function stateWord(step: BidFlowStep): string {
  switch (step.state) {
    case 'done':
      return 'done'
    case 'next':
      return 'next up'
    case 'untracked':
      return 'not tracked in the app'
    case 'loading':
      return 'reading…'
    default:
      return 'not yet'
  }
}

function tooltip(step: BidFlowStep): string {
  return `${step.n}. ${step.poster} — ${stateWord(step)}. Reads: ${step.proxy}.`
}

/** Phase gaps on the compact strip follow the poster's own order (Intake appears twice). */
function phaseBreakAfter(steps: BidFlowStep[], i: number): boolean {
  const cur = steps[i]
  const nxt = steps[i + 1]
  return !!cur && !!nxt && cur.phase !== nxt.phase
}

export function BidFlowStrip({ flow, variant, onOpenDoor, canOpenDoor, bidLabel, reviewStamp }: Props) {
  const ariaLabel = `Bid flow${bidLabel ? ` for ${bidLabel}` : ''}: ${bidFlowSummary(flow)}`
  const openable = (door: BidFlowDoor) => door != null && !!onOpenDoor && (canOpenDoor ? canOpenDoor(door) : true)

  if (variant === 'hairline') {
    const segBg: Record<string, string> = { done: DONE, next: NEXT, todo: TODO, loading: 'var(--bg-muted)', untracked: 'transparent' }
    return (
      <span
        role="img"
        aria-label={ariaLabel}
        title={ariaLabel}
        style={{ display: 'flex', gap: 2, height: 3, marginTop: 1, width: '100%' }}
      >
        {bidFlowSegments(flow).map((seg) => (
          <span
            key={`${seg.phase}-${seg.steps[0]?.n ?? 0}`}
            style={{
              flex: seg.steps.length,
              borderRadius: 2,
              background: segBg[seg.state],
              border: seg.state === 'untracked' ? '1px dashed var(--border)' : undefined,
              boxSizing: 'border-box',
            }}
          />
        ))}
      </span>
    )
  }

  if (variant === 'compact') {
    return (
      <span
        role="img"
        aria-label={ariaLabel}
        title={ariaLabel}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 3, verticalAlign: 'middle' }}
      >
        {flow.steps.map((step, i) => {
          const c = nodeColors(step, flow.decided)
          const dotStyle: CSSProperties = {
            width: 11,
            height: 11,
            borderRadius: '50%',
            boxSizing: 'border-box',
            border: `2px ${c.dash ? 'dashed' : 'solid'} ${c.border}`,
            background: c.bg,
            boxShadow: c.ring ? `0 0 0 2px color-mix(in srgb, ${NEXT} 25%, transparent)` : undefined,
            padding: 0,
            display: 'inline-block',
            cursor: openable(step.door) ? 'pointer' : 'default',
            marginRight: phaseBreakAfter(flow.steps, i) ? 4 : 0,
          }
          const t = tooltip(step)
          return openable(step.door) ? (
            <button
              key={step.key}
              type="button"
              title={t}
              aria-label={t}
              onClick={(e) => {
                e.stopPropagation()
                onOpenDoor?.(step.door, step)
              }}
              style={dotStyle}
            />
          ) : (
            <span key={step.key} title={t} style={dotStyle} />
          )
        })}
      </span>
    )
  }

  // ---- full ----
  const phases: Array<{ phase: BidFlowPhase; from: number; to: number }> = []
  flow.steps.forEach((s, i) => {
    const last = phases[phases.length - 1]
    if (last && last.phase === s.phase && last.to === i - 1) last.to = i
    else phases.push({ phase: s.phase, from: i, to: i })
  })
  const currentPhase = flow.next?.phase ?? null

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      style={{
        border: '1px solid var(--border)',
        borderRadius: 8,
        background: 'var(--surface)',
        padding: '0.6rem 0.9rem 0.75rem',
        marginBottom: '1rem',
        overflowX: 'auto',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-strong)' }}>
          Where this bid is <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>· {bidFlowSummary(flow)}</span>
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.72rem', color: 'var(--text-faint)' }}>
          {flow.untrackedCount > 0 ? <span>{flow.untrackedCount} step not tracked in the app</span> : null}
          {(() => {
            const review = flow.steps.find((s) => s.key === 'review')
            if (!review || review.state === 'untracked' || !openable('review')) return null
            const stamped = review.state === 'done'
            return (
              <button
                type="button"
                onClick={() => onOpenDoor?.('review', review)}
                title={stamped ? (reviewStamp?.tooltip ?? 'Reviewed. Click to review again.') : 'Mark this bid reviewed — who, when, and your notes'}
                style={{
                  font: 'inherit',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  padding: '0.25rem 0.65rem',
                  borderRadius: 6,
                  cursor: 'pointer',
                  border: stamped ? '1px solid var(--border)' : `1px solid ${NEXT}`,
                  background: stamped ? 'var(--surface)' : NEXT,
                  color: stamped ? 'var(--text-muted)' : '#fff',
                }}
              >
                {stamped ? `Reviewed ${reviewStamp?.label ?? ''} · Review again`.replace('  ', ' ') : 'Mark reviewed'}
              </button>
            )
          })()}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(58px, 1fr))', minWidth: 720 }}>
        {phases.map((p) => (
          <div
            key={`${p.phase}-${p.from}`}
            style={{
              gridColumn: `${p.from + 1} / ${p.to + 2}`,
              gridRow: 1,
              margin: '0 3px',
              padding: '0 0.3rem 0.1rem',
              borderBottom: `1px solid ${currentPhase === p.phase && !flow.decided ? NEXT : 'var(--border)'}`,
              fontSize: '0.62rem',
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              fontWeight: 600,
              textAlign: 'center',
              color: currentPhase === p.phase && !flow.decided ? NEXT : 'var(--text-faint)',
            }}
          >
            {p.phase}
          </div>
        ))}
        {flow.steps.map((step, i) => {
          const c = nodeColors(step, flow.decided)
          const prevDone = i > 0 && flow.steps[i - 1]?.state === 'done'
          const lineLeft = i === 0 ? 'transparent' : prevDone && (step.state === 'done' || step.state === 'next') ? DONE : TODO
          const lineRight = i === flow.steps.length - 1 ? 'transparent' : step.state === 'done' ? DONE : TODO
          const isReview = step.key === 'review'
          // An untracked Review (no columns on the row yet) has no door: nothing to write to.
          const stepOpenable = openable(step.door) && !(isReview && step.state === 'untracked')
          const t = isReview && step.state === 'done' && reviewStamp?.tooltip ? `${step.n}. ${reviewStamp.tooltip}` : isReview && stepOpenable ? `${tooltip(step)} Click to mark reviewed.` : tooltip(step)
          const caption = isReview && step.state === 'done' ? reviewStamp?.label ?? null : null
          const inner = (
            <>
              <span style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', height: 24 }}>
                <span style={{ position: 'absolute', left: 0, right: '50%', top: 11, height: 2, background: lineLeft }} />
                <span style={{ position: 'absolute', left: '50%', right: 0, top: 11, height: 2, background: lineRight }} />
                <span
                  style={{
                    position: 'relative',
                    zIndex: 1,
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    boxSizing: 'border-box',
                    border: `2px ${c.dash ? 'dashed' : 'solid'} ${c.border}`,
                    background: c.bg,
                    color: c.fg,
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    display: 'grid',
                    placeItems: 'center',
                    fontVariantNumeric: 'tabular-nums',
                    boxShadow: c.ring ? `0 0 0 4px color-mix(in srgb, ${NEXT} 18%, transparent)` : undefined,
                  }}
                >
                  {step.state === 'done' ? '✓' : step.n}
                </span>
              </span>
              <span
                style={{
                  fontSize: '0.7rem',
                  lineHeight: 1.15,
                  textAlign: 'center',
                  color: step.state === 'next' ? 'var(--text-strong)' : step.state === 'untracked' ? 'var(--text-faint)' : 'var(--text-muted)',
                  fontWeight: step.state === 'next' ? 600 : 400,
                  textWrap: 'balance',
                }}
              >
                {step.label}
              </span>
              {caption ? (
                <span style={{ fontSize: '0.62rem', lineHeight: 1.1, textAlign: 'center', color: 'var(--text-faint)', maxWidth: '9ch', textWrap: 'balance' }}>{caption}</span>
              ) : null}
            </>
          )
          const cell: CSSProperties = {
            gridColumn: i + 1,
            gridRow: 2,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
            padding: '0.35rem 0.1rem 0.2rem',
            border: 0,
            background: 'transparent',
            font: 'inherit',
            color: 'inherit',
            borderRadius: 6,
            cursor: stepOpenable ? 'pointer' : 'default',
          }
          return stepOpenable ? (
            <button key={step.key} type="button" title={t} aria-label={t} onClick={() => onOpenDoor?.(step.door, step)} style={cell}>
              {inner}
            </button>
          ) : (
            <div key={step.key} title={t} style={cell}>
              {inner}
            </div>
          )
        })}
      </div>
    </div>
  )
}
