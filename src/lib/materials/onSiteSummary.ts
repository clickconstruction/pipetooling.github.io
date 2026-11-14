/**
 * Materials on site (punch list #209): the facts the desk, the Job window's tab, the ⋯ menu and the
 * Needs you line read about one job, from its containers and movements. Not pure: the money reads
 * the store's `priceOf` (the parts book's price, the invoice's past 90 days — `bookPrice.ts`).
 */
import { containerLines, countDiffs, countIsDue, lastCountedAt, missingMoney, partKey, type Container, type Movement } from './onSite'
import { listContainers, listMovements, priceOf as storePriceOf, priceOfJob, serverSummary } from './onSiteStore'
import { jobMaterialsSummaryFromServer } from './onSiteServerSummary'

export type JobMaterialsSummary = {
  containers: number
  onSiteLines: number
  missingLines: number
  /** Of `missingLines`, how many have no price (v2.7246): the money leaves them out, so it is a floor when this is above zero. */
  missingUnpricedLines: number
  missingMoneyWeek: number
  stale: Container[]
  credits: number
}

export function jobMaterialsSummary(containers: Container[], movements: Movement[], now: Date, priceOf: (partKey: string) => number | null = storePriceOf): JobMaterialsSummary {
  const live = containers.filter((c) => !c.retiredAt)
  const lines = containerLines(movements)
  const onSite = lines.filter((l) => l.onHand > 0 && live.some((c) => c.id === l.containerId))
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString()
  const diffs = countDiffs(movements).filter((d) => d.at >= weekAgo && d.diff < 0)
  const cannot = movements.filter((m) => m.reason === 'cannot_find' && m.at >= weekAgo)
  let missingMoneyWeek = 0
  let missingLines = 0
  let missingUnpricedLines = 0
  const add = (qty: number, key: string) => {
    missingLines += 1
    const money = missingMoney(qty, priceOf(key))
    if (money == null) missingUnpricedLines += 1
    else missingMoneyWeek += money
  }
  for (const d of diffs) add(d.diff, d.partKey)
  for (const m of cannot) add(-m.quantity, partKey(m.partId, m.partName))
  const stale = live.filter((c) => c.kind !== 'unsorted' && countIsDue(lastCountedAt(movements, c.id), now))
  const credits = movements.filter((m) => m.reason === 'returned').length
  return { containers: live.length, onSiteLines: onSite.length, missingLines, missingUnpricedLines, missingMoneyWeek, stale, credits }
}

/**
 * The job's summary from the store (v2.6743): the device's sums over the ledger it read, or the database's
 * (`on_site_job_summary`) when the read came back capped at 5,000 rows. Every reader of the summary calls this.
 */
export function jobMaterialsSummaryFor(jobId: string, now: Date): JobMaterialsSummary {
  const s = serverSummary(jobId)
  // The job's own prices (punch list #342): its site's answers and ties are in the rule.
  const priceOf = (key: string) => priceOfJob(jobId, key)
  if (s) return jobMaterialsSummaryFromServer(listContainers(jobId), s, now, priceOf)
  return jobMaterialsSummary(listContainers(jobId), listMovements(jobId), now, priceOf)
}

/** "A2, B1 due a count" on a small site; "28 due a count · A1, A7, A8…" on a big one. */
export function staleWords(stale: ReadonlyArray<Pick<Container, 'label'>>): string {
  if (stale.length === 0) return ''
  const labels = stale.map((c) => c.label)
  if (labels.length <= 4) return `${labels.join(', ')} due a count`
  return `${labels.length} due a count · ${labels.slice(0, 3).join(', ')}…`
}
