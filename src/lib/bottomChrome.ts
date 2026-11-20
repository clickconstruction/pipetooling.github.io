/**
 * The phone's bottom chrome: how far up the tab bar reaches, in one place (v2.8035).
 *
 * `--app-bottom-chrome` is what every piece of fixed chrome sits on: the Job Mode press bar, the
 * section dock, the Person desk, the windows that stop above the tab bar, and the page's own bottom
 * padding. It used to be written as the tab bar's 60 px plus the home indicator's inset. The tab bar
 * is not that tall: its 60 px is a minimum over a border box, so the inset is counted inside it, and
 * on a phone with a home indicator the bar stands at its content's height plus the inset (about 84 px
 * where the sum said 94). Everything above it floated 10 px too high, and the page showed through
 * the strip between.
 *
 * So the tab bar measures itself and publishes its height as `--app-tab-bar`, and the chrome reads
 * that. The old sum stays as the value before a measurement exists (the first paint of a test, which
 * has no layout): it can only be too tall, never short, so nothing is drawn under the tab bar.
 */
import { JOB_MODE_PRESS_BAR_VAR } from './jobMode/pressBar'

/** The CSS variable the tab bar sets on the root while mounted: its measured height. */
export const APP_TAB_BAR_VAR = '--app-tab-bar'

/** The CSS variable Layout sets on its wrapper: how far up the bottom chrome reaches, 0px with no tab bar. */
export const APP_BOTTOM_CHROME_VAR = '--app-bottom-chrome'

/** A float's dust: a box of 84 px can measure 83.99999, and that is 84, not 83. */
const MEASURE_SLACK_PX = 0.01

/**
 * The height to publish from the tab bar's measured box, or null when there is nothing to publish
 * (no layout yet, a hidden bar). Rounded DOWN to a whole pixel: the bar's labels are sized in rem, so
 * the box is 83.78 px tall on an iPhone, and the published height is how far above the foot of the
 * screen the next bar's bottom edge sits. Rounded up, that edge would stand 0.22 px above the tab
 * bar's top and the page would show through a hairline on a 3x screen; rounded down, the two overlap
 * by less than a pixel and nothing shows.
 */
export function tabBarHeightPx(measuredPx: number | null | undefined): number | null {
  if (measuredPx == null || !Number.isFinite(measuredPx) || measuredPx <= 0) return null
  const whole = Math.floor(measuredPx + MEASURE_SLACK_PX)
  return whole > 0 ? whole : null
}

/**
 * `--app-bottom-chrome`'s value: the tab bar's measured height while one is up, the old sum until
 * it is measured, and 0px with no tab bar. `minHeightPx` is the tab bar's own minimum.
 */
export function bottomChromeCss(tabBarUp: boolean, minHeightPx: number): string {
  if (!tabBarUp) return '0px'
  return `var(${APP_TAB_BAR_VAR}, calc(${minHeightPx}px + env(safe-area-inset-bottom, 0px)))`
}

/**
 * The page's bottom padding while a tab bar is up: the chrome, the press bar's height (0px when no
 * press bar is mounted) and one pixel, so the last card scrolls clear of both. The pixel pays back
 * the part pixel `tabBarHeightPx` rounds away: without it the foot of the page could end 0.78 px
 * under the tab bar.
 */
export function pageBottomPaddingCss(): string {
  return `calc(var(${APP_BOTTOM_CHROME_VAR}, 0px) + var(${JOB_MODE_PRESS_BAR_VAR}, 0px) + 1px)`
}

/**
 * How far a bar pinned on the tab bar laps over it: the tab bar's 1 px top border. The pinned bar
 * covers that line and draws it again as its own bottom border (`ON_TAB_BAR_BORDER`), so the seam is
 * one crisp line whether the tab bar's height is whole or not, and never a strip of the page.
 */
export const ON_TAB_BAR_LAP_PX = 1

/** The pinned bar's bottom border: the tab bar's own top border, which the lap covers. */
export const ON_TAB_BAR_BORDER = `${ON_TAB_BAR_LAP_PX}px solid var(--chrome-border)`

/** Where a bar pinned on the tab bar puts its bottom edge: on the chrome, lapped over the tab bar's top border. */
export function onTabBarBottomCss(): string {
  return `calc(var(${APP_BOTTOM_CHROME_VAR}, 0px) - ${ON_TAB_BAR_LAP_PX}px)`
}

/**
 * The slide that takes a bar pinned on the tab bar out of view while the keyboard is up: its own
 * height, the chrome under it, and one pixel for its top border. The lap only takes it further.
 */
export function onTabBarKeyboardSlideCss(): string {
  return `translateY(calc(100% + var(${APP_BOTTOM_CHROME_VAR}, 0px) + 1px))`
}

/**
 * What a sheet or a bar at the foot of the screen stands clear of: the tab bar while one is up, whose
 * height already holds the home indicator's inset, and the inset alone with no tab bar. The larger of
 * the two, never their sum: the sum is the old mistake, 10 px too much on a phone with a home
 * indicator and 60 px too much on a screen with no tab bar at all.
 */
export function footClearanceCss(): string {
  return `max(var(${APP_BOTTOM_CHROME_VAR}, 0px), env(safe-area-inset-bottom, 0px))`
}
