import type { SalesLegendEntry } from './salesDesk'

/**
 * The Sales desk's bar (punch list #192; its dark check, v2.6133): each segment's fill and the ink of the dollars
 * drawn on it. The dollars were the surface token, which turns #1f2937 in dark and read 2.93:1 on the green and
 * 2.70:1 on the red. White reads 5.02:1 and 5.44:1 on them in both themes. On the amber white reads 3.19:1, so its
 * dollars take the dark ink, 5.57:1. The dead share draws no dollars. `readablePairs.test.ts` holds each pair in
 * both themes. Pure.
 */
export const SALES_BAR_INKS: Record<Exclude<SalesLegendEntry['key'], 'dead'>, { fill: string; words: string }> = {
  protected: { fill: '#15803d', words: '#ffffff' },
  risk: { fill: '#d97706', words: 'var(--text-on-bright-solid)' },
  evaporating: { fill: '#c0392b', words: '#ffffff' },
}
