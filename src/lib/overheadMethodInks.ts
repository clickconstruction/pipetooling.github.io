import type { OverheadLensKey } from './overheadLensSeries'

/**
 * The words of People → Overhead's three methods (punch list #194, v2.6082): the text token of each
 * method's hue, beside the chart colour the swatches, bars and lines keep. As chart colours the
 * names read 3.28:1, 2.03:1 and 1.91:1 on the light page; these read 5.98:1, 6.36:1 and 6.32:1
 * there and 9.8:1 or better in dark. `readablePairs.test.ts` holds them on the page and the
 * surface in both themes. Pure.
 */
export const OVERHEAD_METHOD_INKS: Record<OverheadLensKey, string> = {
  A: 'var(--text-blue-700)',
  B: 'var(--text-green-800)',
  C: 'var(--text-amber-800)',
}
