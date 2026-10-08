/**
 * GC mode, the real build: a trade's own schedule of values beside ours, moved word for word from the GC mode prototype (branch
 * spike/gc-mode, `gcTheirSov.ts`). The Portal lane's P2b-ii brought the lines a quote form starts with and the add-up check; the
 * Board's B6 brings where the money claimed stands on their lines.
 */
import type { TheirSovLine } from './types'

/** The lines a trade's form starts with. They can rename, add or take any out. */
export const SOV_STAGES = ['Rough-in', 'Top out', 'Trim']

export function theirSovSum(lines: TheirSovLine[]): number {
  return lines.reduce((t, l) => t + l.amount, 0)
}

/** Their lines' total less the number it should match. 0: it adds up. */
export function theirSovGap(lines: TheirSovLine[], amount: number): number {
  return Math.round((theirSovSum(lines) - amount) * 100) / 100
}
