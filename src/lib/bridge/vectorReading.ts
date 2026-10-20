/**
 * The day grid's reading (link PR 12): profit is the grid as built (earned at
 * the job's rate, less the wage); revenue is the earned figure; cost is the
 * day's wages. One kernel, a mode switch.
 */
export type VectorReading = 'profit' | 'revenue' | 'cost'

export const VECTOR_READINGS: ReadonlyArray<{ key: VectorReading; word: string; title: string }> = [
  { key: 'revenue', word: 'Revenue', title: 'What each day earned at the job’s rate; a day on a job with no price reads 0' },
  { key: 'profit', word: 'Profit', title: 'Earned at the job’s rate, less the wage: the grid as built' },
  { key: 'cost', word: 'Cost', title: 'What each day cost in wages' },
]

/** The number a cell shows under the revenue or cost reading. */
export function vectorReadingValue(b: { earnedUsd: number; laborUsd: number; officeLaborUsd: number }, reading: VectorReading): number {
  return reading === 'revenue' ? b.earnedUsd : b.laborUsd + b.officeLaborUsd
}
