import type { CSSProperties } from 'react'
import type { RobotRowState } from '../../lib/bids/robotRowState'
import { GRADE_COLORS } from './RobotReferenceGradeModal'

/** The Bid Board's robot glyph (shared with the key and the sheets). */
export const ROBOT_ICON_PATH =
  'M320 64c13 0 24 11 24 24v40h120c40 0 72 32 72 72v192c0 40-32 72-72 72H176c-40 0-72-32-72-72V200c0-40 32-72 72-72h120V88c0-13 11-24 24-24zM48 296c0-18 14-32 32-32v160c-18 0-32-14-32-32v-96zm544-32c18 0 32 14 32 32v96c0 18-14 32-32 32V264zM224 232a40 40 0 100 80 40 40 0 000-80zm192 0a40 40 0 100 80 40 40 0 000-80zM232 400h176c13 0 24 11 24 24s-11 24-24 24H232c-13 0-24-11-24-24s11-24 24-24z'

/** Robot states draw in the app's blue; needs in amber; grades keep the grade colors. */
export const ROBOT_STATE_COLOR = {
  robot: '#2563eb',
  need: '#d97706',
  scored: '#16a34a',
} as const

export function robotGlyphColor(state: RobotRowState): string {
  switch (state.kind) {
    case 'queued':
    case 'working':
    case 'sealed':
    case 'scored':
      return ROBOT_STATE_COLOR.robot
    case 'needs':
      return ROBOT_STATE_COLOR.need
    case 'grade':
      return GRADE_COLORS[state.grade]
    case 'off':
    case 'none':
      return 'var(--text-faint)'
  }
}

/** The little corner badge, if the state carries one. */
export function robotGlyphBadge(state: RobotRowState): { text: string; background: string } | null {
  switch (state.kind) {
    case 'sealed':
      return { text: '🔒', background: ROBOT_STATE_COLOR.robot }
    case 'scored':
      return { text: '✓', background: ROBOT_STATE_COLOR.scored }
    case 'needs':
      return { text: state.badge, background: ROBOT_STATE_COLOR.need }
    case 'grade':
      return { text: state.grade, background: GRADE_COLORS[state.grade] }
    default:
      return null
  }
}

/**
 * Draws one robot-icon state: outline while queued, solid while working (with
 * a pulsing dot), a badge for sealed / scored / needs / grade, muted when off.
 * Purely presentational — the caller wraps it in the button and tooltip.
 */
export function RobotGlyph({ state, size = 18 }: { state: RobotRowState; size?: number }) {
  const color = robotGlyphColor(state)
  const badge = robotGlyphBadge(state)
  const outline = state.kind === 'queued'
  const wrap: CSSProperties = { position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color, opacity: state.kind === 'off' ? 0.45 : 1, lineHeight: 0 }
  return (
    <span style={wrap} aria-hidden>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={size} height={size} fill={outline ? 'none' : 'currentColor'} stroke={outline ? 'currentColor' : 'none'} strokeWidth={outline ? 34 : 0}>
        <path d={ROBOT_ICON_PATH} />
      </svg>
      {state.kind === 'working' ? (
        <span
          className="robot-glyph-pulse"
          style={{ position: 'absolute', right: -2, top: 0, width: 7, height: 7, borderRadius: '50%', background: color, boxShadow: '0 0 0 2px var(--surface)' }}
        />
      ) : null}
      {badge ? (
        <span
          style={{
            position: 'absolute',
            right: -3,
            bottom: -3,
            fontSize: badge.text === '🔒' ? '0.5rem' : '0.5625rem',
            fontWeight: 800,
            lineHeight: 1,
            padding: '1px 3px',
            borderRadius: 3,
            color: 'white',
            background: badge.background,
            fontFamily: 'ui-monospace, monospace',
            boxShadow: '0 0 0 1.5px var(--surface)',
          }}
        >
          {badge.text}
        </span>
      ) : null}
    </span>
  )
}
