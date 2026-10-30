/**
 * The ink for the words on a map pin (punch list #194, v2.6130): a place's count, the clocked-in
 * map's head count, a cluster's count. Both canvases drew them white on every fill, and white read
 * 2.15:1 on the waiting jobs' amber. Now each fill takes the ink that reads better on it: white on
 * the deep fills, the dark ink (`--text-on-bright-solid`) on the bright ones. Pure.
 */
import { contrastRatio } from '../lens/lensAudit'
import { hexOf, hexToRgba } from '../lens/lensTokens'

export const PIN_LABEL_WHITE = '#ffffff'
export const PIN_LABEL_DARK_INK = 'var(--text-on-bright-solid)'
/** The dark ink as src/index.css draws it in both themes; `readablePairs.test.ts` holds the two in step. */
export const PIN_LABEL_DARK_INK_DRAWN = '#111827'

/** White, or the dark ink when it reads better on the fill; white for a fill that is not a hex. */
export function pinLabelInk(fill: string): string {
  const hex = hexOf(fill)
  if (!hex) return PIN_LABEL_WHITE
  const bg = hexToRgba(hex)
  const dark = contrastRatio(hexToRgba(PIN_LABEL_DARK_INK_DRAWN), bg)
  return dark > contrastRatio(hexToRgba(PIN_LABEL_WHITE), bg) ? PIN_LABEL_DARK_INK : PIN_LABEL_WHITE
}

/** The same choice as a hex, for Google's canvas, which may paint a label where a CSS variable does not reach. */
export function pinLabelInkHex(fill: string): string {
  return pinLabelInk(fill) === PIN_LABEL_DARK_INK ? PIN_LABEL_DARK_INK_DRAWN : PIN_LABEL_WHITE
}
