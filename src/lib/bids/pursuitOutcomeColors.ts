import type { PursuitOutcome } from './bidPursuit'

/**
 * The pursuit outcome chips on Bids → Bid Costs and the bid list window (punch list #194, v2.6081).
 * The washes keep the pursuit's own hues; the words take the text token of each hue, because the
 * ochre `#b8801f` read 2.65:1 on its wash over the light page, and *Won* and *Lost* sat under AA
 * there. `readablePairs.test.ts` holds each on the page and the surface in both themes. Pure.
 */
export const PURSUIT_OUTCOME_CHIP_COLORS: Record<PursuitOutcome, { fg: string; bg: string }> = {
  open: { fg: 'var(--text-amber-800)', bg: 'rgba(184, 128, 31, 0.14)' },
  won: { fg: 'var(--text-green-800)', bg: 'rgba(30, 138, 87, 0.14)' },
  lost: { fg: 'var(--text-red-700)', bg: 'rgba(198, 75, 58, 0.14)' },
  unsent: { fg: 'var(--text-muted)', bg: 'var(--bg-subtle)' },
}
