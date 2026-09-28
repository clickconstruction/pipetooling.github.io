// A job's card charges by cost-line tag — ⛽ Fuel & gas and any other tag the office
// flags "show as cost line" — for one job and for many. Job Summary has drawn these
// under Parts since v2.2725; the Job window draws them from the same rule (punch
// list #52). Pure.

import { categoryTagForCharge, type CategoryTagColor, type CategoryTagLookups, type CategoryTagRow } from '../banking/categoryTags'
import { tagSliceForOneJob } from '../mercuryTagSplit'
import type { CardChargeExclusions } from './cardChargeAllocationFilter'
import type { JobMercuryAllocLine } from '../../../supabase/functions/_shared/jobMaterialsCostLines'

export type JobCardCostLine = { tagId: string; name: string; icon: string; color: CategoryTagColor; usd: number }

/**
 * The cost lines, in manager order, each clamped so together they never exceed the
 * card charges that count (Job Summary's rule, v2.2725): a line takes what is left of
 * the counted total, and a line of $0 or less is not drawn.
 */
export function clampCostLinesToCounted(
  tags: readonly CategoryTagRow[],
  usdByTagId: ReadonlyMap<string, number> | null | undefined,
  countedCardUsd: number,
): JobCardCostLine[] {
  let left = Math.max(0, countedCardUsd)
  return tags
    .map((t) => {
      const usd = Math.min(left, usdByTagId?.get(t.id) ?? 0)
      left -= usd
      return { tagId: t.id, name: t.name, icon: t.icon, color: t.color, usd }
    })
    .filter((l) => l.usd > 0)
}

/** A bank category as stored (a string, or `{ name }` in older rows) → its name. */
function bankCategoryName(v: unknown): string | null {
  if (typeof v === 'string') return v
  if (v && typeof v === 'object' && typeof (v as { name?: unknown }).name === 'string') return (v as { name: string }).name
  return null
}

/**
 * One job's cost lines from its card lines: the same exclusions as the card total, the
 * same classifier as Job Summary (the accounting label's tag, else the bank category's),
 * clamped to `countedCardUsd`. `tagByTxId` names each transaction's cost-line tag, for a
 * marker on its line.
 */
export function jobCardCostLines(args: {
  lines: readonly JobMercuryAllocLine[]
  exclusions: CardChargeExclusions
  labelIdByTxId: ReadonlyMap<string, string>
  categoryByTxId: ReadonlyMap<string, unknown>
  lookups: CategoryTagLookups
  tags: readonly CategoryTagRow[]
  countedCardUsd: number
}): { costLines: JobCardCostLine[]; tagByTxId: Map<string, CategoryTagRow> } {
  const rows = args.lines
    .filter((l) => l.mercuryTransactionId)
    .map((l) => ({ mercury_transaction_id: l.mercuryTransactionId as string, amount: l.allocationAmount }))
  const slice = tagSliceForOneJob('job', rows, args.exclusions, args.labelIdByTxId, args.categoryByTxId, args.lookups)
  const tagByTxId = new Map<string, CategoryTagRow>()
  for (const r of rows) {
    const tag = categoryTagForCharge(args.lookups, args.labelIdByTxId.get(r.mercury_transaction_id) ?? null, bankCategoryName(args.categoryByTxId.get(r.mercury_transaction_id)))
    if (tag?.show_as_cost_line) tagByTxId.set(r.mercury_transaction_id, tag)
  }
  return { costLines: clampCostLinesToCounted(args.tags, slice, args.countedCardUsd), tagByTxId }
}

/** Σ of the cost lines — what `Card charges` loses when they are drawn as their own rows. */
export function costLinesTotal(lines: readonly JobCardCostLine[]): number {
  return lines.reduce((s, l) => s + l.usd, 0)
}

/** The Card charges row's quiet subtitle when some of it is a cost line: "includes ⛽ Fuel & gas $85.00". */
export function cardCostLinesSubtitle(lines: ReadonlyArray<{ name: string; icon: string; usd: number }> | undefined): string | undefined {
  const shown = (lines ?? []).filter((l) => l.usd > 0)
  if (shown.length === 0) return undefined
  const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })
  return `includes ${shown.map((l) => `${l.icon} ${l.name} ${fmt.format(l.usd)}`).join(' · ')}`
}
