/**
 * The Cover Letter's document, planned from what the bid holds — the letter the Cover Letter tab
 * previews, prints and copies, and the one the Approval PDF's last page prints (v2.4373). Pure: the
 * callers load the rows.
 *
 * - Sections (`letterSectionPlans` → `priceLetterSections`): on a split bid, every version flagged
 *   in-letter (base bids first) at its ★ scenario, plus each offered non-★ scenario as an alternate
 *   (v2.2117 / G1); on a version-less bid, its ★ and each offered scenario, or nothing when none is
 *   offered (v2.2392). Each prices on its own version's count rows, prices only, and a
 *   with-and-without alternate the letter offers leaves the section's amount (v2.4195).
 * - The document (`letterDocument`): a $0 section never reaches the letter (v2.2213); the rest group
 *   by GC and the letter is the active version's packet (v2.1762); on the same-page layout a packet
 *   with alternates is one letter whose amount is its base bids, each alternate a line under it
 *   (v2.2370). No packet means the single letter, from the active version's price.
 */
import { coverLetterTotalsFromPricingRows, type BidCountRowCalc, type ComputedBidPricingRow } from '../bidPricingRowCalculations'
import type { BidCountRowSubmissionHide } from './bidPricingEngineTypes'
import { offeredAddAlternates, splitLetterTotalsByAlternate, type LetterTotals, type LetterTotalsByAlternate } from './coverLetterAddAlternates'
import { defaultGcPacketForActiveVersion, groupSectionsByEffectiveGc, type GcPacket, type GcPacketCustomer } from './coverLetterGcPackets'
import { planSamePageLetter, type CoverLetterAltTexts, type CoverLetterAltsLayout, type SamePagePlan } from './coverLetterSamePage'
import { planLetterSections, planUnsplitLetterSections, type BundlePricing, type BundleVersion } from './coverLetterVersionBundle'
import { scenarioPricingRows, type ScenarioAssignmentRow, type ScenarioCustomPriceRow, type ScenarioPriceBookEntry } from './scenarioPricingRows'

/** A section before it is priced: which scenario it shows and on which version's counts. */
export type LetterSectionPlan = {
  name: string
  bidVersionId: string | null
  /** null = the version has no prices yet (the section is still listed, at $0). */
  pricingId: string | null
  isAlternate: boolean
  offeredPricingId?: string
}

/** A priced section: its amount and fixture list as the letter prints them. */
export type LetterSection = {
  name: string
  bidVersionId: string | null
  revenueSum: number
  fixtureRows: { fixture: string; count: number }[]
  isAlternate: boolean
  offeredPricingId?: string
}

/** A count row as the sections price it: the pricing kernel's fields, its version and its Count Sheet scope. */
export type LetterCountRow = BidCountRowCalc & { bid_version_id?: string | null; group_tag: string | null }

/** What goes in the letter: a split bid's in-letter versions, else a version-less bid's offered prices (empty = the single letter). */
export function letterSectionPlans(versions: BundleVersion[], pricings: BundlePricing[], savedStarId: string | null): LetterSectionPlan[] {
  if (versions.length > 0) {
    return planLetterSections(versions, pricings).map((p) => ({ name: p.name, bidVersionId: p.versionId, pricingId: p.pricingId, isAlternate: p.isAlternate, offeredPricingId: p.offeredPricingId }))
  }
  return planUnsplitLetterSections(pricings, savedStarId).map((p) => ({ name: p.name, bidVersionId: null, pricingId: p.pricingId, isAlternate: p.isAlternate, offeredPricingId: p.offeredPricingId }))
}

/**
 * A section's count rows: its version's own, else (a version with none) the unsplit rows, else the
 * active version's — the bundle's rule since counts went per version (v2.2132).
 */
export function letterRowsFor<R extends { bid_version_id?: string | null }>(
  allRows: readonly R[],
  activeRows: readonly R[],
): (bidVersionId: string | null) => readonly R[] {
  const byVersion = new Map<string | null, R[]>()
  for (const r of allRows) {
    const key = r.bid_version_id ?? null
    byVersion.set(key, [...(byVersion.get(key) ?? []), r])
  }
  return (bidVersionId) => byVersion.get(bidVersionId) ?? (bidVersionId == null ? activeRows : byVersion.get(null) ?? activeRows)
}

/**
 * A letter's amount and fixture list from its priced rows: every row, except that a
 * with-and-without alternate the letter offers leaves them — it prints as an add-on under the
 * amount (v2.4195). One the estimator unticked stays priced in.
 */
export function letterTotalsWithoutOffered(all: LetterTotals, split: LetterTotalsByAlternate | null, altTexts: CoverLetterAltTexts): LetterTotals {
  const offered = offeredAddAlternates(split, altTexts)
  if (!split || offered.length === 0) return all
  const kept = split.alternates.filter((g) => !offered.includes(g))
  return {
    revenueSum: split.base.revenueSum + kept.reduce((sum, g) => sum + g.revenueSum, 0),
    fixtureRows: [...split.base.fixtureRows, ...kept.flatMap((g) => g.fixtureRows)],
  }
}

/** One scenario's letter totals on the given rows (the active price on the single letter, or a section's). */
export function letterTotalsFromRows(
  rows: ComputedBidPricingRow[],
  countRows: ReadonlyArray<{ id: string; group_tag: string | null }>,
  alternateGroupTags: readonly string[],
  altTexts: CoverLetterAltTexts,
): LetterTotals {
  return letterTotalsWithoutOffered(coverLetterTotalsFromPricingRows(rows), splitLetterTotalsByAlternate(rows, countRows, alternateGroupTags), altTexts)
}

/** Each section priced on its own version's count rows (prices only, through the one scenario adapter). */
export function priceLetterSections(input: {
  plans: readonly LetterSectionPlan[]
  rowsFor: (bidVersionId: string | null) => readonly LetterCountRow[]
  entries: readonly ScenarioPriceBookEntry[]
  assignments: readonly ScenarioAssignmentRow[]
  customPrices: readonly ScenarioCustomPriceRow[]
  hides: readonly BidCountRowSubmissionHide[]
  alternateGroupTags: readonly string[]
  altTexts: CoverLetterAltTexts
}): LetterSection[] {
  return input.plans.map((p) => {
    const section = { name: p.name, bidVersionId: p.bidVersionId, isAlternate: p.isAlternate, offeredPricingId: p.offeredPricingId }
    if (!p.pricingId) return { ...section, revenueSum: 0, fixtureRows: [] }
    const countRows = input.rowsFor(p.bidVersionId)
    const { rows } = scenarioPricingRows({
      scenarioId: p.pricingId,
      countRows,
      entries: input.entries,
      assignments: input.assignments,
      customPrices: input.customPrices,
      hides: input.hides,
    })
    return { ...section, ...letterTotalsFromRows(rows, countRows, input.alternateGroupTags, input.altTexts) }
  })
}

export type LetterDocument<S extends LetterSection = LetterSection> = {
  /** The sections that reach a letter; a $0 one never does. */
  priced: S[]
  /** One packet per GC (v2.1159) — no letter mixes two GCs' prices. */
  packets: Array<GcPacket<S>>
  /** The packet the letter shows: the one picked, else the active version's. null = the single letter. */
  packet: GcPacket<S> | null
  /** The same-page plan when the layout is same-page and the packet holds alternates. */
  samePage: SamePagePlan | null
}

export function letterDocument<S extends LetterSection>(input: {
  sections: readonly S[]
  versionGcById: Record<string, GcPacketCustomer | null | undefined>
  bidGc: GcPacketCustomer
  activeBidVersionId: string | null
  /** The studio's GC tab; omitted = the active version's packet. */
  pickedPacketKey?: string | null
  layout: CoverLetterAltsLayout
}): LetterDocument<S> {
  const priced = input.sections.filter((s) => s.revenueSum > 0)
  const packets = priced.length > 0 ? groupSectionsByEffectiveGc(priced, input.versionGcById, input.bidGc) : []
  const packet = packets.length > 0
    ? packets.find((pk) => pk.key === input.pickedPacketKey) ?? defaultGcPacketForActiveVersion(packets, input.activeBidVersionId)
    : null
  const samePage = input.layout === 'same-page' && packet ? planSamePageLetter(packet.sections) : null
  return { priced, packets, packet, samePage }
}
