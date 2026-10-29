/**
 * Materials on site (punch list #209): the facts the desk, the Job window's tab, the ⋯ menu and the
 * Needs you line read about one job, from its containers and movements. Not pure: the money reads
 * the spike's demo prices until the parts book's prices are wired.
 */
import { containerLines, countDiffs, countIsDue, lastCountedAt, missingMoney, partKey, type Container, type Movement } from './onSite'
import { priceOf } from './onSiteStore'

export type JobMaterialsSummary = {
  containers: number
  onSiteLines: number
  missingLines: number
  missingMoneyWeek: number
  stale: Container[]
  credits: number
}

export function jobMaterialsSummary(containers: Container[], movements: Movement[], now: Date): JobMaterialsSummary {
  const live = containers.filter((c) => !c.retiredAt)
  const lines = containerLines(movements)
  const onSite = lines.filter((l) => l.onHand > 0 && live.some((c) => c.id === l.containerId))
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString()
  const diffs = countDiffs(movements).filter((d) => d.at >= weekAgo && d.diff < 0)
  const cannot = movements.filter((m) => m.reason === 'cannot_find' && m.at >= weekAgo)
  let missingMoneyWeek = 0
  let missingLines = 0
  for (const d of diffs) {
    missingLines += 1
    missingMoneyWeek += missingMoney(d.diff, priceOf(d.partKey)) ?? 0
  }
  for (const m of cannot) {
    missingLines += 1
    missingMoneyWeek += missingMoney(-m.quantity, priceOf(partKey(m.partId, m.partName))) ?? 0
  }
  const stale = live.filter((c) => c.kind !== 'unsorted' && countIsDue(lastCountedAt(movements, c.id), now))
  const credits = movements.filter((m) => m.reason === 'returned').length
  return { containers: live.length, onSiteLines: onSite.length, missingLines, missingMoneyWeek, stale, credits }
}

/** "A2, B1 due a count" on a small site; "28 due a count · A1, A7, A8…" on a big one. */
export function staleWords(stale: ReadonlyArray<Pick<Container, 'label'>>): string {
  if (stale.length === 0) return ''
  const labels = stale.map((c) => c.label)
  if (labels.length <= 4) return `${labels.join(', ')} due a count`
  return `${labels.length} due a count · ${labels.slice(0, 3).join(', ')}…`
}
