import type { ThemeName } from '../themeSchedule'

/**
 * The Bid Board's "that's you" name highlight (v2.1710): when a bid's
 * Estimator or Account Man is the viewer, their name gets a colored box.
 * Each user picks their own box + text color PER THEME via the color wheel on
 * the board's Health line; the choice is stored in
 * `users.bid_board_self_highlight` (jsonb) and resolved here.
 *
 * Defaults are theme-aware: the historical dark box (#111827 / white) on
 * light, the same pair inverted on dark — where the hardcoded box used to
 * disappear entirely.
 */

/** One theme's preference. `text: 'auto'` picks black/white by bg luminance. */
export type BidBoardSelfHighlightThemePref = {
  bg: string
  text: 'auto' | string
}

export type BidBoardSelfHighlightPref = {
  light?: BidBoardSelfHighlightThemePref
  dark?: BidBoardSelfHighlightThemePref
}

export const BID_BOARD_SELF_HIGHLIGHT_DEFAULTS: Record<ThemeName, { bg: string; text: string }> = {
  light: { bg: '#111827', text: '#ffffff' },
  dark: { bg: '#f9fafb', text: '#111827' },
}

/** Swatches offered by the picker (free custom colors are also allowed). */
export const BID_BOARD_SELF_HIGHLIGHT_SWATCHES = [
  '#111827',
  '#2563eb',
  '#15803d',
  '#b45309',
  '#7c3aed',
  '#db2777',
  '#fde047',
  '#a7f3d0',
] as const

const HEX_RE = /^#[0-9a-fA-F]{6}$/

export function isValidHexColor(v: unknown): v is string {
  return typeof v === 'string' && HEX_RE.test(v)
}

/**
 * Black or white text by perceived brightness of the box color — the picker's
 * "Auto" mode, so a yellow box never gets white-on-yellow text.
 */
export function autoContrastText(bgHex: string): '#111827' | '#ffffff' {
  if (!isValidHexColor(bgHex)) return '#ffffff'
  const n = parseInt(bgHex.slice(1), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#111827' : '#ffffff'
}

function parseThemePref(v: unknown): BidBoardSelfHighlightThemePref | undefined {
  if (v == null || typeof v !== 'object') return undefined
  const o = v as Record<string, unknown>
  if (!isValidHexColor(o.bg)) return undefined
  const text = o.text === 'auto' ? 'auto' : isValidHexColor(o.text) ? o.text : 'auto'
  return { bg: o.bg, text }
}

/**
 * Defensive parse of the jsonb column — a malformed value (hand-edited, old
 * shape, wrong type) degrades to defaults rather than a broken board.
 */
export function parseBidBoardSelfHighlightPref(json: unknown): BidBoardSelfHighlightPref {
  if (json == null || typeof json !== 'object') return {}
  const o = json as Record<string, unknown>
  const light = parseThemePref(o.light)
  const dark = parseThemePref(o.dark)
  return {
    ...(light ? { light } : {}),
    ...(dark ? { dark } : {}),
  }
}

/**
 * The style pair the board applies to the viewer's own name for `theme`:
 * the user's pick when present (with 'auto' text resolved), else the
 * theme-aware default.
 */
export function resolveBidBoardSelfHighlight(
  pref: BidBoardSelfHighlightPref,
  theme: ThemeName,
): { backgroundColor: string; color: string } {
  const chosen = pref[theme]
  if (!chosen) {
    const d = BID_BOARD_SELF_HIGHLIGHT_DEFAULTS[theme]
    return { backgroundColor: d.bg, color: d.text }
  }
  return {
    backgroundColor: chosen.bg,
    color: chosen.text === 'auto' ? autoContrastText(chosen.bg) : chosen.text,
  }
}

/** Immutable per-theme update, keeping the other theme's pick intact. */
export function withThemePref(
  pref: BidBoardSelfHighlightPref,
  theme: ThemeName,
  next: BidBoardSelfHighlightThemePref | null,
): BidBoardSelfHighlightPref {
  const out: BidBoardSelfHighlightPref = { ...pref }
  if (next === null) delete out[theme]
  else out[theme] = next
  return out
}
