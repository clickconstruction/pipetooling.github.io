/**
 * The Bid Room publish kernel (v2.5105, punch list #103): a revision payload from the GC's letter
 * sections. It moved here from src/lib/bids/bidRoomPayload.ts, which re-exports it for the Cover
 * Letter tab, so the What customers see sample room (`sampleBidRoomResponse`) is built by the code
 * that publishes a real revision and can never say what a published room cannot. It sits beside
 * the parse twin rather than inside it so the functions that only read a payload (sign-bid-room,
 * send-bid-room-link) keep their bundle. Types only from the parse twin; no runtime imports.
 */
import type { SharedBidRoomPayload, SharedRoomAddOn, SharedRoomFixtureRow, SharedRoomOption } from './bidRoomPayload.ts'

export type SharedRoomSectionInput = {
  name: string
  isAlternate: boolean
  revenueSum: number
  fixtureRows: SharedRoomFixtureRow[]
  /** v2.4728: the section's bid version, carried onto its option so a signature can record the option taken. */
  bidVersionId?: string | null
}

export type SharedRoomAddOnInput = { tag: string; label: string; revenueSum: number; fixtureRows: SharedRoomFixtureRow[] }

function centsFromDollars(n: number): number {
  return Math.round((Number.isFinite(n) ? n : 0) * 100)
}

/** Service type → acceptance-page brand family (the estimate brands: 'plum' | 'elec'). */
export function roomHeaderBrandForServiceType(serviceTypeName: string | null | undefined): string | null {
  const t = (serviceTypeName ?? '').trim().toLowerCase()
  if (t.includes('plumb')) return 'plum'
  if (t.includes('elec')) return 'elec'
  return null
}

/**
 * Build a revision payload from a GC's letter sections. Only priced sections participate —
 * an unpriced alternate is left off the letter today, and off the room for the same reason.
 * Null when there is no priced base (nothing to propose — the letter can't send either).
 */
export function buildBidRoomRevisionPayload(input: {
  projectName: string
  projectAddress: string
  gcName: string
  serviceTypeName: string
  sections: SharedRoomSectionInput[]
  inclusions: string
  exclusions: string
  terms: string
  /** v2.4197: the offered with-and-without alternates (unpriced ones are left off, like sections). */
  addOns?: SharedRoomAddOnInput[]
}): SharedBidRoomPayload | null {
  const priced = input.sections.filter((s) => s.revenueSum > 0)
  const base = priced.filter((s) => !s.isAlternate)
  if (base.length === 0) return null
  const alts = priced.filter((s) => s.isAlternate)
  const baseName = base.length === 1 ? (base[0]!.name.trim() || 'Base bid') : 'Base bid'
  const baseOption: SharedRoomOption = {
    key: 'base',
    name: baseName,
    is_base: true,
    total_cents: base.reduce((sum, s) => sum + centsFromDollars(s.revenueSum), 0),
    // v2.4728: one base carries its version; a merged base is nobody's option.
    ...(base.length === 1 && base[0]!.bidVersionId ? { bid_version_id: base[0]!.bidVersionId } : {}),
    fixture_rows: base.flatMap((s) => s.fixtureRows),
  }
  const options: SharedRoomOption[] = [
    baseOption,
    ...alts.map((s, i) => ({
      key: `alt-${i + 1}`,
      name: s.name.trim() || `Alternate ${i + 1}`,
      is_base: false,
      total_cents: centsFromDollars(s.revenueSum),
      ...(s.bidVersionId ? { bid_version_id: s.bidVersionId } : {}),
      fixture_rows: s.fixtureRows,
    })),
  ]
  const add_ons: SharedRoomAddOn[] = (input.addOns ?? [])
    .filter((a) => a.revenueSum > 0 && a.tag.trim())
    .map((a) => ({
      key: 'group:' + a.tag.trim().toLowerCase(),
      name: a.label.trim() || a.tag.trim(),
      tag: a.tag.trim(),
      total_cents: centsFromDollars(a.revenueSum),
      fixture_rows: a.fixtureRows,
    }))
  return {
    v: 1,
    project_name: input.projectName.trim(),
    project_address: input.projectAddress.trim(),
    gc_name: input.gcName.trim(),
    service_type_name: input.serviceTypeName.trim(),
    options,
    add_ons,
    inclusions: input.inclusions.trim(),
    exclusions: input.exclusions.trim(),
    terms: input.terms.trim(),
    header_brand: roomHeaderBrandForServiceType(input.serviceTypeName),
  }
}
