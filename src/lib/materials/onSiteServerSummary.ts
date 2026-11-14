/**
 * Materials on site (punch list #209, v2.6743): the database's summary of a job whose ledger passed
 * the 5,000 rows the store reads (`on_site_job_summary`, migration 20261109010000), read into the
 * kernel's own shapes so every screen that sums lines or count differences reads the same thing
 * whether the device or the database did the arithmetic. Pure: the server's answer in, the kernel's
 * lines, differences and summary out; the price lookup is handed in.
 */
import { countIsDue, missingMoney, type Container, type ContainerLine, type CountDiff } from './onSite'
import type { JobMaterialsSummary } from './onSiteSummary'

export type ServerLine = {
  container_id: string
  part_key: string
  part_id: string | null
  part_name: string
  manufacturer: string | null
  on_hand: number
  cannot_find_since_count: number
  last_touched_at: string | null
  last_touched_by: string | null
  last_count_at: string | null
  last_count_by: string | null
  last_count_diff: number | null
}

export type ServerDiff = {
  movement_id: string
  at: string
  by_name: string
  container_id: string
  part_key: string
  part_id: string | null
  part_name: string
  manufacturer: string | null
  expected: number
  counted: number
}

export type ServerCannotFind = Omit<ServerDiff, 'expected' | 'counted'> & { quantity: number }

export type ServerSummary = {
  rows: number
  lines: ServerLine[]
  last_counts: Array<{ container_id: string; at: string; by_name: string }>
  diffs: ServerDiff[]
  cannot_find: ServerCannotFind[]
  credits: number
}

/** The server's answer as the kernel's lines. */
export function serverLines(s: ServerSummary): ContainerLine[] {
  return s.lines.map((l) => ({
    containerId: l.container_id,
    partKey: l.part_key,
    partId: l.part_id,
    partName: l.part_name,
    manufacturer: l.manufacturer,
    onHand: l.on_hand,
    lastTouchedAt: l.last_touched_at,
    lastTouchedBy: l.last_touched_by,
    lastCountAt: l.last_count_at,
    lastCountBy: l.last_count_by,
    lastCountDiff: l.last_count_diff,
    cannotFindSinceCount: l.cannot_find_since_count,
  }))
}

/** The server's counts in its window as the kernel's differences, newest first. */
export function serverCountDiffs(s: ServerSummary): CountDiff[] {
  return s.diffs.map((d) => ({
    movementId: d.movement_id,
    at: d.at,
    byName: d.by_name,
    containerId: d.container_id,
    partKey: d.part_key,
    partId: d.part_id,
    partName: d.part_name,
    manufacturer: d.manufacturer,
    expected: d.expected,
    counted: d.counted,
    diff: d.counted - d.expected,
  }))
}

/** `lastCountedAt` from the server's last counts. */
export function serverLastCountedAt(s: ServerSummary, containerId: string): { at: string; byName: string } | null {
  const c = s.last_counts.find((x) => x.container_id === containerId)
  return c ? { at: c.at, byName: c.by_name } : null
}

/** `jobMaterialsSummary` over the server's answer: the same facts, the same week, the same price lookup. */
export function jobMaterialsSummaryFromServer(containers: ReadonlyArray<Container>, s: ServerSummary, now: Date, priceOf: (partKey: string) => number | null): JobMaterialsSummary {
  const live = containers.filter((c) => !c.retiredAt)
  const onSite = s.lines.filter((l) => l.on_hand > 0 && live.some((c) => c.id === l.container_id))
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString()
  let missingMoneyWeek = 0
  let missingLines = 0
  let missingUnpricedLines = 0
  const add = (qty: number, key: string) => {
    missingLines += 1
    const money = missingMoney(qty, priceOf(key))
    if (money == null) missingUnpricedLines += 1
    else missingMoneyWeek += money
  }
  for (const d of s.diffs) {
    if (d.at < weekAgo || d.counted - d.expected >= 0) continue
    add(d.counted - d.expected, d.part_key)
  }
  for (const m of s.cannot_find) {
    if (m.at < weekAgo) continue
    add(-m.quantity, m.part_key)
  }
  const stale = live.filter((c) => c.kind !== 'unsorted' && countIsDue(serverLastCountedAt(s, c.id), now))
  return { containers: live.length, onSiteLines: onSite.length, missingLines, missingUnpricedLines, missingMoneyWeek, stale, credits: s.credits }
}
