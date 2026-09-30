/**
 * The with-and-without alternates on the Cover Letter (v2.4195, the alternates train PR 5).
 * A count-row group named in `bids.alternate_group_tags` is a section the customer wants priced
 * with and without: the letter's proposed amount is the BASE (every priced row outside the
 * alternates), and a second block under it prices each offered alternate as an addition —
 * "Alternate 1 — Break room: add $3,220 (with it, $16,800.00)" — distinct from the in-lieu-of block
 * a version alternate prints (coverLetterSamePage.ts). Pure; no React, no DB.
 */
import type { ComputedBidPricingRow } from '../bidPricingRowCalculations'
import type { CoverLetterAlternateItem, CoverLetterAlternatesBlock } from '../bidDocuments/coverLetter'
import { partitionByAlternate } from './alternateScope'
import { normalizeGroupTag } from './countSheet'
import type { CoverLetterAltTexts } from './coverLetterSamePage'

export const COVER_LETTER_ADD_ALTS_HEADING_DEFAULT = 'Alternates — priced in addition to the proposal above:'

export type LetterTotals = { revenueSum: number; fixtureRows: { fixture: string; count: number }[] }

export type AddAlternateGroup = {
  /** `group:<normalized tag>` — the key its wording and offer flag live under in cover_letter_alt_texts. */
  key: string
  /** The group's name as first spelled on a row. */
  label: string
  revenueSum: number
  fixtureRows: { fixture: string; count: number }[]
}

export type LetterTotalsByAlternate = { base: LetterTotals; alternates: AddAlternateGroup[] }

export function addAlternateGroupKey(label: string): string {
  return 'group:' + normalizeGroupTag(label)
}

function totalsOf(rows: readonly ComputedBidPricingRow[]): LetterTotals {
  let revenueSum = 0
  const fixtureRows: { fixture: string; count: number }[] = []
  for (const r of rows) {
    revenueSum += r.revenue
    if (!r.omitFromSubmissionDocuments) fixtureRows.push({ fixture: r.countRow.fixture ?? '', count: r.count })
  }
  return { revenueSum, fixtureRows }
}

/**
 * The letter's totals split by the Count Sheet's scope: the base, then each alternate group that
 * holds a row (alphabetical). null on a bid without one, so callers keep today's one number.
 */
export function splitLetterTotalsByAlternate(
  rows: readonly ComputedBidPricingRow[],
  countRows: ReadonlyArray<{ id: string; group_tag: string | null }>,
  alternateTags: readonly string[],
): LetterTotalsByAlternate | null {
  if (alternateTags.length === 0 || rows.length === 0) return null
  const tagById = new Map(countRows.map((c) => [c.id, c.group_tag] as const))
  const scoped = rows.map((r) => ({ row: r, group_tag: tagById.get(r.countRow.id) ?? null }))
  const parts = partitionByAlternate(scoped, alternateTags)
  if (parts.alternates.length === 0) return null
  return {
    base: totalsOf(parts.base.map((s) => s.row)),
    alternates: parts.alternates.map((a) => ({ key: addAlternateGroupKey(a.label), label: a.label, ...totalsOf(a.rows.map((s) => s.row)) })),
  }
}

/** The alternates the letter offers: every one unless its `groups[key].offered` is false. */
export function offeredAddAlternates(split: LetterTotalsByAlternate | null, texts: CoverLetterAltTexts): AddAlternateGroup[] {
  if (!split) return []
  return split.alternates.filter((g) => texts.groups?.[g.key]?.offered !== false)
}

/** "add $3,220" — whole dollars unless the amount has real cents. */
export function formatAddOnText(amount: number, fmt: (n: number) => string): string {
  return `add $${fmt(Math.max(0, amount)).replace(/\.00$/, '')}`
}

/** "[1] WC · [48.5 ft] 2\" PVC" — what the alternate buys, when the estimator wrote no note. */
export function alternateFixturesNote(g: Pick<AddAlternateGroup, 'fixtureRows'>): string {
  return g.fixtureRows.map((r) => `[${r.count}] ${r.fixture}`).join(' · ')
}

/**
 * The letter block. Each offered alternate is one item: the saved label or "Alternate N — <group>",
 * the add-on as the bold lead, the with-it total in parens, and the fixtures (or the saved note)
 * under it. null when nothing is offered. `editable` adds the preview's click-to-edit keys.
 */
export function buildAddAlternatesBlock(
  offered: readonly AddAlternateGroup[],
  baseRevenue: number,
  texts: CoverLetterAltTexts,
  fmt: (n: number) => string,
  editable = false,
): CoverLetterAlternatesBlock | null {
  if (offered.length === 0) return null
  const items: CoverLetterAlternateItem[] = offered.map((g, i) => {
    const saved = texts.sections?.[g.key]
    return {
      label: saved?.label?.trim() || `Alternate ${i + 1} — ${g.label}`,
      deltaText: formatAddOnText(g.revenueSum, fmt),
      amountFormatted: `with it, $${fmt(baseRevenue + g.revenueSum)}`,
      note: saved?.note?.trim() || alternateFixturesNote(g) || null,
      ...(editable ? { editKey: g.key } : {}),
    }
  })
  return { heading: COVER_LETTER_ADD_ALTS_HEADING_DEFAULT, items }
}

/** The `groups` map after a send: the offered alternates' add-on amounts stamped, the others' cleared. */
export function stampAddAlternateAmounts(
  texts: CoverLetterAltTexts,
  split: LetterTotalsByAlternate | null,
): CoverLetterAltTexts {
  const groups: Record<string, { offered?: boolean; amount?: number }> = { ...(texts.groups ?? {}) }
  for (const g of split?.alternates ?? []) {
    const prev = groups[g.key] ?? {}
    const entry: { offered?: boolean; amount?: number } = {}
    if (prev.offered != null) entry.offered = prev.offered
    if (prev.offered !== false && g.revenueSum > 0) entry.amount = Math.round(g.revenueSum * 100) / 100
    if (entry.offered != null || entry.amount != null) groups[g.key] = entry
    else delete groups[g.key]
  }
  const next: CoverLetterAltTexts = { ...texts }
  if (Object.keys(groups).length > 0) next.groups = groups
  else delete next.groups
  return next
}

/** What the Bid Board's "+$ alt" chip reads: the stamped add-ons of the offered alternates. */
export function boardAlternateAddOn(texts: CoverLetterAltTexts): { total: number; parts: { key: string; amount: number }[] } | null {
  const parts = Object.entries(texts.groups ?? {})
    .filter(([, v]) => v.offered !== false && v.amount != null && v.amount > 0)
    .map(([key, v]) => ({ key, amount: v.amount as number }))
  if (parts.length === 0) return null
  return { total: parts.reduce((s, p) => s + p.amount, 0), parts }
}
