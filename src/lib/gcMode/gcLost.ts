/**
 * GC mode — design spike. A bid we lost (the owner, 2026-10-03: a way out of Bidding for a job the
 * owner gave to someone else). The project keeps its stage ('pursuing') and leaves Bidding for the
 * board's Lost section once `lostOn` is set; nobody is chased on it. The reasons are Trades mode's
 * loss reasons (`bidLossCategories.ts`) in the words that fit us bidding to an owner.
 */
import type { GcLostWhy, GcProject } from './gcTypes'

export const LOST_WHY: { key: GcLostWhy; label: string }[] = [
  { key: 'price', label: 'Price too high' },
  { key: 'other_builder', label: 'Went with another builder' },
  { key: 'project_died', label: 'Project died or on hold' },
  { key: 'no_bid', label: 'We never finished our bid' },
  { key: 'no_answer', label: 'No answer from the owner' },
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
