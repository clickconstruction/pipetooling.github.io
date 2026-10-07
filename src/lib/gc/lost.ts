/**
 * GC mode, the real build, the Board's B2: a bid we lost, moved word for word from the GC mode prototype
 * (branch spike/gc-mode, `gcLost.ts`).
 */
import type { GcLostWhy, GcProject } from './types'

export const LOST_WHY: { key: GcLostWhy; label: string }[] = [
  { key: 'price', label: 'Price too high' },
  { key: 'other_builder', label: 'Went with another builder' },
  { key: 'project_died', label: 'Project died or on hold' },
  { key: 'no_bid', label: 'We never finished our bid' },
  { key: 'no_answer', label: 'No answer from the customer' },
]

export function lostWhyLabel(why: GcLostWhy | null | undefined): string | null {
  return LOST_WHY.find((w) => w.key === why)?.label ?? null
}

export function isLost(project: GcProject): boolean {
  return Boolean(project.lostOn)
}

/** "Price too high · Hill Country Builders won it", for the row and the project header. */
export function lostWords(project: GcProject): string {
  const parts = [lostWhyLabel(project.lostWhy) ?? 'Lost']
  if (project.wonBy) parts.push(`${project.wonBy} won it`)
  return parts.join(' · ')
}
