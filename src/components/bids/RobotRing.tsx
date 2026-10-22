import type { CSSProperties } from 'react'
import type { RobotRowState } from '../../lib/bids/robotRowState'
import { ringFillForState, type RobotProgress, type RobotProgressTone } from '../../lib/bids/robotProgress'
import { HEARTBEAT_STEPS } from '../../../supabase/functions/_shared/twinHeartbeat'
import { RobotGlyph, ROBOT_STATE_COLOR } from './RobotGlyph'

/**
 * The ring round the robot icon (Robot rounds PR 2, punch list #142, decision 3b): seven
 * segments, one per step, filled as the robot's own stamps land; the segment it is on fills by
 * the sheets it has read. The fill is a percent of steps, never of minutes. Drawn with two CSS
 * conic gradients and no SVG per row; the glyph the row already had sits inside. States with no
 * run (off, none, a grade) draw the glyph alone. Purely presentational: the caller's button
 * carries the tooltip and the label.
 */
const TONE_COLOR: Record<RobotProgressTone, string> = {
  blue: ROBOT_STATE_COLOR.robot,
  amber: ROBOT_STATE_COLOR.need,
  green: ROBOT_STATE_COLOR.scored,
  gray: 'var(--border-strong)',
}

const GAP_DEG = 2.5
const SEG_DEG = 360 / HEARTBEAT_STEPS.length

export function RobotRing({ state, progress, size = 28 }: { state: RobotRowState; progress?: RobotProgress | null; size?: number }) {
  const fill = progress ? { fraction: progress.fraction, tone: progress.tone } : ringFillForState(state.kind)
  if (!fill) return <RobotGlyph state={state} size={Math.round(size * 0.64)} />
  const pct = Math.round(Math.max(0, Math.min(1, fill.fraction)) * 1000) / 10
  const tone = TONE_COLOR[fill.tone]
  const track = fill.tone === 'amber' && fill.fraction === 0 ? 'var(--border-amber)' : 'var(--border)'
  const band = Math.max(3, Math.round(size * 0.11))
  const pulsing = progress ? !progress.sealed && !progress.void && !progress.quiet : state.kind === 'working'
  const wrap: CSSProperties = {
    position: 'relative',
    width: size,
    height: size,
    borderRadius: '50%',
    display: 'inline-grid',
    placeItems: 'center',
    flex: 'none',
    background: `conic-gradient(${tone} 0 ${pct}%, ${track} ${pct}% 100%)`,
    boxShadow: pulsing ? '0 0 0 3px rgba(37,99,235,0.18)' : undefined,
  }
  const gaps: CSSProperties = {
    position: 'absolute',
    inset: 0,
    borderRadius: '50%',
    background: `repeating-conic-gradient(from ${-GAP_DEG / 2}deg, var(--surface) 0 ${GAP_DEG}deg, transparent ${GAP_DEG}deg ${SEG_DEG}deg)`,
  }
  const inner: CSSProperties = {
    position: 'relative',
    width: size - band * 2,
    height: size - band * 2,
    borderRadius: '50%',
    background: 'var(--surface)',
    display: 'grid',
    placeItems: 'center',
  }
  return (
    <span style={wrap} aria-hidden data-ring-fill={pct} data-ring-tone={fill.tone}>
      <span style={gaps} />
      <span style={inner}>
        <RobotGlyph state={state} size={Math.round((size - band * 2) * 0.78)} />
      </span>
    </span>
  )
}
