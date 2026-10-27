import { useLayoutEffect, useRef, type CSSProperties } from 'react'
import { useOnScreenKeyboardOpen } from '../../hooks/useOnScreenKeyboardOpen'
import { DISPATCH_MODE_FOOTER_Z_INDEX } from '../dispatchMode/DispatchModeFooter'
import {
  DAY_PRESS_COLORS,
  DAY_PRESS_TEXT,
  JOB_MODE_PRESS_BAR_VAR,
  LEAVE_REPORT_BLUE,
  type DayPressTone,
  type PressBarButton,
  type PressBarButtonId,
  type PressBarRows,
} from '../../lib/jobMode/pressBar'

/**
 * The press bar's stacking level: one above the tab bar, so the bar is never covered by it, and
 * under every window, so a sheet opens over it. `check:window-z` holds each window at the dock's
 * 700 or above, and the lowest stands at 710 today; a window at 700 or 701 would open under the bar.
 */
export const JOB_MODE_PRESS_BAR_Z_INDEX = DISPATCH_MODE_FOOTER_Z_INDEX + 1

const PAD = 8
const SMALL_ROW = 44
const BIG_ROW = 56
/**
 * The bar's height with one-line labels: padding, the 44 px row, the gap, the 56 px row, padding, the
 * top border. The bar is not held to it — a label wraps on a narrow phone or with the phone's text made
 * larger, and the bar grows — so Layout pads <main> by the measured height, and this is only the value
 * before a measurement exists (and in a test, which has no layout).
 */
export const JOB_MODE_PRESS_BAR_HEIGHT_PX = PAD + SMALL_ROW + PAD + BIG_ROW + PAD + 1

const barWrap: CSSProperties = {
  position: 'fixed',
  left: 0,
  right: 0,
  bottom: 'var(--app-bottom-chrome, 0px)',
  zIndex: JOB_MODE_PRESS_BAR_Z_INDEX,
  boxSizing: 'border-box',
  padding: `${PAD}px 10px`,
  display: 'grid',
  gap: PAD,
  background: 'var(--surface)',
  borderTop: '1px solid var(--border)',
  // Slides out with the tab bar while the mobile keyboard is up (its rule, DispatchModeFooter):
  // position: fixed anchors to the layout viewport, so it would otherwise float mid-screen.
  transition: 'transform 0.15s ease',
}

const smallRow: CSSProperties = {
  display: 'grid',
  gridAutoFlow: 'column',
  gridAutoColumns: '1fr',
  gap: PAD,
}

const bigRow: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1.6fr',
  gap: PAD,
}

const smallBtn: CSSProperties = {
  minHeight: SMALL_ROW,
  padding: '0 6px',
  borderRadius: 10,
  border: '1px solid var(--border-strong)',
  background: 'var(--surface)',
  color: 'var(--text-strong)',
  fontSize: 13,
  fontWeight: 700,
  lineHeight: 1.15,
  cursor: 'pointer',
}

const turnawaySmallBtn: CSSProperties = {
  ...smallBtn,
  color: 'var(--text-amber-800)',
  borderColor: 'var(--border-amber)',
  background: 'var(--bg-amber-tint)',
}

const smallDisabled: CSSProperties = {
  color: 'var(--text-faint)',
  borderColor: 'var(--border)',
  background: 'var(--surface)',
  cursor: 'not-allowed',
}

const bigBtn: CSSProperties = {
  minHeight: BIG_ROW,
  padding: '0 8px',
  borderRadius: 12,
  border: 'none',
  color: 'white',
  fontSize: 16,
  fontWeight: 700,
  lineHeight: 1.15,
  textAlign: 'center',
  cursor: 'pointer',
}

const bigDisabled: CSSProperties = {
  background: DAY_PRESS_COLORS.grey,
  cursor: 'not-allowed',
}

type Props = {
  rows: PressBarRows
  /** The day's press colour, from the kernel's tone. */
  dayPressTone: DayPressTone
  /** The hover words for a dead Turnaway or Leave report (the card's reason), null when live. */
  noJobReason: string | null
  onPress: (id: PressBarButtonId) => void
}

/**
 * The Job Mode press bar (punch list #189, PR 2): pinned above the tab bar on a phone, drawn from
 * `buildJobModePressBar`'s rows and nothing else. While mounted it sets `--job-mode-press-bar`
 * on the root to its measured height, so Layout's <main> pads by it and nothing scrolls under it.
 */
export function JobModePressBar({ rows, dayPressTone, noJobReason, onPress }: Props) {
  const keyboardOpen = useOnScreenKeyboardOpen()
  const barRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const root = document.documentElement
    const bar = barRef.current
    // offsetHeight is the layout box with its border, untouched by the keyboard's slide (a transform).
    const apply = () => root.style.setProperty(JOB_MODE_PRESS_BAR_VAR, `${bar?.offsetHeight || JOB_MODE_PRESS_BAR_HEIGHT_PX}px`)
    apply()
    const observer = bar && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(apply) : null
    if (bar && observer) observer.observe(bar)
    return () => {
      observer?.disconnect()
      root.style.removeProperty(JOB_MODE_PRESS_BAR_VAR)
    }
  }, [])

  const small = (b: PressBarButton) => (
    <button
      key={b.id}
      type="button"
      disabled={b.disabled}
      title={b.disabled && b.id === 'turnaway' ? (noJobReason ?? undefined) : undefined}
      aria-label={b.id === 'turnaway' ? 'Turnaway — client not home or site not ready' : b.id === 'pct-done' ? 'Update % done' : b.label}
      data-testid={`job-mode-press-${b.id}`}
      style={{ ...(b.id === 'turnaway' ? turnawaySmallBtn : smallBtn), ...(b.disabled ? smallDisabled : null) }}
      onClick={() => onPress(b.id)}
    >
      {b.label}
    </button>
  )

  const big = (b: PressBarButton) => (
    <button
      key={b.id}
      type="button"
      disabled={b.disabled}
      title={b.disabled && b.id === 'leave-report' ? (noJobReason ?? undefined) : undefined}
      aria-label={b.id === 'leave-report' ? 'Leave Report' : b.label}
      data-testid={`job-mode-press-${b.id}`}
      style={{
        ...bigBtn,
        background: b.id === 'leave-report' ? LEAVE_REPORT_BLUE : DAY_PRESS_COLORS[dayPressTone],
        color: b.id === 'leave-report' ? 'white' : DAY_PRESS_TEXT[dayPressTone],
        ...(b.disabled ? bigDisabled : null),
      }}
      onClick={() => onPress(b.id)}
    >
      {b.label}
    </button>
  )

  return (
    <div
      ref={barRef}
      role="group"
      aria-label="The day's presses"
      data-testid="job-mode-press-bar"
      aria-hidden={keyboardOpen || undefined}
      style={{
        ...barWrap,
        transform: keyboardOpen ? 'translateY(calc(100% + var(--app-bottom-chrome, 0px) + 1px))' : undefined,
        pointerEvents: keyboardOpen ? 'none' : undefined,
      }}
    >
      <div style={smallRow}>{rows.top.map(small)}</div>
      <div style={bigRow}>{rows.bottom.map(big)}</div>
    </div>
  )
}
