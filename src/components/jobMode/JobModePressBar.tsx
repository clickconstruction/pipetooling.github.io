import { useLayoutEffect, useRef, type CSSProperties } from 'react'
import { useOnScreenKeyboardOpen } from '../../hooks/useOnScreenKeyboardOpen'
import { DISPATCH_MODE_FOOTER_Z_INDEX } from '../dispatchMode/DispatchModeFooter'
import { ON_TAB_BAR_BORDER, ON_TAB_BAR_LAP_PX, onTabBarBottomCss, onTabBarKeyboardSlideCss } from '../../lib/bottomChrome'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
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
import { READING_AGAIN_WORDS } from '../../lib/keptRead'
import { PHONE_DAY_PRESS_COMPACT_MIN_PX, PHONE_DAY_PRESS_ROW_PX } from '../../lib/phoneLayout/phoneBar'

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
 * top border and the bottom one. The bar is not held to it — a label wraps on a narrow phone or with the phone's text made
 * larger, and the bar grows — so Layout pads <main> by the measured height, and this is only the value
 * before a measurement exists (and in a test, which has no layout).
 */
export const JOB_MODE_PRESS_BAR_HEIGHT_PX = PAD + SMALL_ROW + PAD + BIG_ROW + PAD + 1 + ON_TAB_BAR_LAP_PX

const barWrap: CSSProperties = {
  position: 'fixed',
  left: 0,
  right: 0,
  // On the tab bar's measured top edge, lapped over its border (v2.8035), so no strip of the page shows
  // between the two; the bottom border draws the covered line again.
  bottom: onTabBarBottomCss(),
  zIndex: JOB_MODE_PRESS_BAR_Z_INDEX,
  boxSizing: 'border-box',
  padding: `${PAD}px 10px`,
  display: 'grid',
  gap: PAD,
  background: 'var(--surface)',
  borderTop: '1px solid var(--border)',
  borderBottom: ON_TAB_BAR_BORDER,
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
  background: DEAD_PRESS_FILL,
  color: DEAD_PRESS_TEXT,
  cursor: 'not-allowed',
}

/**
 * The new phone layout (`lib/phoneLayout`): the same buttons on one row. The compact ones are as wide as
 * their words, the day's press takes the rest. With all five up on a 375 px phone the two-word labels fold
 * onto two lines (Clock out, Leave report) so the day's press keeps its room. The row never wraps at 350 px
 * or wider; under that the stylesheet lets it (`.jobModePressBarOneRow`), the bar grows by a line and its
 * measured height follows, so nothing is cut off or runs off the side.
 */
export const JOB_MODE_PRESS_BAR_ONE_ROW_CLASS = 'jobModePressBarOneRow'
const ONE_ROW_PAD = 6
const barWrapOneRow: CSSProperties = {
  ...barWrap,
  padding: `${ONE_ROW_PAD}px 8px`,
  display: 'flex',
  alignItems: 'stretch',
  gap: 5,
}

/**
 * A compact press: as wide as its words, never grown. It gives room a thousand times as readily as the day's
 * press, so a two-word label is folded onto two lines before the day's press is asked for a pixel.
 */
const oneRowCompact: CSSProperties = {
  flex: '0 1000 auto',
  minWidth: 'min-content',
  minHeight: PHONE_DAY_PRESS_COMPACT_MIN_PX,
  padding: '0 4px',
}

/**
 * The day's press on the one row: the rest of the row. It asks for 120 px, enough for *On my way* on one line,
 * and gives down to 88 px only once every compact label beside it is folded.
 */
const oneRowDayPress: CSSProperties = {
  flex: '1 1 120px',
  minWidth: 88,
  minHeight: PHONE_DAY_PRESS_ROW_PX,
  padding: '0 6px',
}

/** Leave report as a compact press: its own blue under white words, at the compact size. */
const oneRowLeaveReport: CSSProperties = {
  ...smallBtn,
  border: 'none',
  background: LEAVE_REPORT_BLUE,
  color: 'white',
}

type Props = {
  rows: PressBarRows
  /** The day's press colour, from the kernel's tone. */
  dayPressTone: DayPressTone
  /** The hover words for a dead Turnaway or Leave report (the card's reason), null when live. */
  noJobReason: string | null
  onPress: (id: PressBarButtonId) => void
  /**
   * The day on screen is a kept read (#183 PR 3): every press waits for the live read, each button
   * disabled and muted (`keptPress` under the card's `data-kept-read`) with the stamp's *reading
   * again…* as its hover words. The bar itself stays solid, so the card never shows through it.
   */
  held?: boolean
  /**
   * The new phone layout (`useNewPhoneLayout`): every button of the two rows on one row, in the same
   * order, the day's press last and widest. The same buttons, labels, colours and presses. Off, the bar
   * is its two rows.
   */
  oneRow?: boolean
}

/**
 * The Job Mode press bar (punch list #189, PR 2): pinned above the tab bar on a phone, drawn from
 * `buildJobModePressBar`'s rows and nothing else. While mounted it sets `--job-mode-press-bar`
 * on the root to its measured height, so Layout's <main> pads by it and nothing scrolls under it.
 */
export function JobModePressBar({ rows, dayPressTone, noJobReason, onPress, held = false, oneRow = false }: Props) {
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
      disabled={b.disabled || held}
      className={held ? 'keptPress' : undefined}
      title={held ? READING_AGAIN_WORDS : b.disabled && b.id === 'turnaway' ? (noJobReason ?? undefined) : undefined}
      aria-label={b.id === 'turnaway' ? 'Turnaway — client not home or site not ready' : b.id === 'pct-done' ? 'Update % done' : b.label}
      data-testid={`job-mode-press-${b.id}`}
      style={{ ...(b.id === 'turnaway' ? turnawaySmallBtn : smallBtn), ...(oneRow ? oneRowCompact : null), ...(b.disabled ? smallDisabled : null) }}
      onClick={() => onPress(b.id)}
    >
      {/* On the one row a label folds at a space when the row is short of room: "% done" stays whole. */}
      {oneRow && b.id === 'pct-done' ? b.label.replace(' ', ' ') : b.label}
    </button>
  )

  const big = (b: PressBarButton) => (
    <button
      key={b.id}
      type="button"
      disabled={b.disabled || held}
      className={held ? 'keptPress' : undefined}
      title={held ? READING_AGAIN_WORDS : b.disabled && b.id === 'leave-report' ? (noJobReason ?? undefined) : undefined}
      aria-label={b.id === 'leave-report' ? 'Leave Report' : b.label}
      data-testid={`job-mode-press-${b.id}`}
      style={
        oneRow && b.id === 'leave-report'
          ? { ...oneRowLeaveReport, ...oneRowCompact, ...(b.disabled ? bigDisabled : null) }
          : {
              ...bigBtn,
              ...(oneRow ? oneRowDayPress : null),
              background: b.id === 'leave-report' ? LEAVE_REPORT_BLUE : DAY_PRESS_COLORS[dayPressTone],
              color: b.id === 'leave-report' ? 'white' : DAY_PRESS_TEXT[dayPressTone],
              ...(b.disabled ? bigDisabled : null),
            }
      }
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
      data-held={held || undefined}
      data-one-row={oneRow || undefined}
      className={oneRow ? JOB_MODE_PRESS_BAR_ONE_ROW_CLASS : undefined}
      aria-hidden={keyboardOpen || undefined}
      style={{
        ...(oneRow ? barWrapOneRow : barWrap),
        transform: keyboardOpen ? onTabBarKeyboardSlideCss() : undefined,
        pointerEvents: keyboardOpen ? 'none' : undefined,
      }}
    >
      {oneRow ? (
        <>
          {rows.top.map(small)}
          {rows.bottom.map(big)}
        </>
      ) : (
        <>
          {/* The small row is drawn only when it holds a button: before the clock it holds none (`turnawayOffered`), and an empty row would leave the bar's gap over Leave report. */}
          {rows.top.length > 0 ? <div style={smallRow}>{rows.top.map(small)}</div> : null}
          <div style={bigRow}>{rows.bottom.map(big)}</div>
        </>
      )}
    </div>
  )
}
