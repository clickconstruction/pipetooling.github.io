/**
 * The Bid Room (Signable Bids, v2.2468): one durable link per GC packet serving the latest
 * PUBLISHED letter revision. This kernel builds and parses the revision payload — the frozen,
 * letter-faithful content a revision pins: base + offered alternates as pickable options
 * (fixture/count lists + one lump total each, exactly the cover letter's document model — the
 * letter never prices per line), the inclusions/exclusions/terms text, and the Google Docs
 * letter link riding along.
 *
 * Option semantics mirror the letter's: the base sections it is handed merge into one "base"
 * option; each alternate section is its own option, offered in lieu of the base. A letter with
 * two or more base bids never reaches here as two bases: they are options the GC picks between
 * (v2.4723), and the Cover Letter tab hands them over as Option 1 plus the others in lieu of it,
 * each with its own total and version (`roomSectionsForPacket`, v2.4892). Signing (Phase 2)
 * freezes the chosen option onto the estimate rails.
 */

export type RoomFixtureRow = { fixture: string; count: number | string }

export type RoomOption = {
  /** Stable within the revision; `accepted_option_key` on the signed record. */
  key: string
  name: string
  /** True for the merged base option — pre-selected, badged "Proposed" on the room page. */
  is_base: boolean
  total_cents: number
  /** v2.4728: the bid version this option is (a letter with options); absent on older revisions and on a merged base. */
  bid_version_id?: string | null
  fixture_rows: RoomFixtureRow[]
}

/**
 * A with-and-without alternate offered as an ADD-ON (v2.4197): a count-row group the customer can
 * tick beside whichever option they choose — never instead of it. `tag` is the group's name on
 * the bid (`bids.alternate_group_tags`); a signature writes the taken tags to
 * `bids.accepted_alternate_tags`.
 */
export type RoomAddOn = {
  /** `group:<normalized tag>` — the letter's key for the alternate. */
  key: string
  /** Customer-facing name, the letter's label ("Alternate 1 — Break room"). */
  name: string
  tag: string
  total_cents: number
  fixture_rows: RoomFixtureRow[]
}

export type RoomAddOnInput = { tag: string; label: string; revenueSum: number; fixtureRows: RoomFixtureRow[] }

export type BidRoomRevisionPayloadV1 = {
  v: 1
  project_name: string
  project_address: string
  gc_name: string
  service_type_name: string
  options: RoomOption[]
  /** v2.4197: the with-and-without alternates, tickable beside any option; absent on older revisions. */
  add_ons: RoomAddOn[]
  /** Inclusions / exclusions / terms, as the letter carries them (plain text blocks). */
  inclusions: string
  exclusions: string
  terms: string
  /** 'plum' | 'elec' | null — the acceptance-page brand family. */
  header_brand: string | null
}

export type RoomSectionInput = {
  name: string
  isAlternate: boolean
  revenueSum: number
  fixtureRows: RoomFixtureRow[]
  /** v2.4728: the section's bid version, carried onto its option so a signature can record the option taken. */
  bidVersionId?: string | null
}

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
  sections: RoomSectionInput[]
  inclusions: string
  exclusions: string
  terms: string
  /** v2.4197: the offered with-and-without alternates (unpriced ones are left off, like sections). */
  addOns?: RoomAddOnInput[]
}): BidRoomRevisionPayloadV1 | null {
  const priced = input.sections.filter((s) => s.revenueSum > 0)
  const base = priced.filter((s) => !s.isAlternate)
  if (base.length === 0) return null
  const alts = priced.filter((s) => s.isAlternate)
  const baseName = base.length === 1 ? (base[0]!.name.trim() || 'Base bid') : 'Base bid'
  const baseOption: RoomOption = {
    key: 'base',
    name: baseName,
    is_base: true,
    total_cents: base.reduce((sum, s) => sum + centsFromDollars(s.revenueSum), 0),
    // v2.4728: one base carries its version; a merged base is nobody's option.
    ...(base.length === 1 && base[0]!.bidVersionId ? { bid_version_id: base[0]!.bidVersionId } : {}),
    fixture_rows: base.flatMap((s) => s.fixtureRows),
  }
  const options: RoomOption[] = [
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
  const add_ons: RoomAddOn[] = (input.addOns ?? [])
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

/** Tolerant parse for the public room page and the sign function. Null = unusable revision. */
export function parseBidRoomRevisionPayload(raw: unknown): BidRoomRevisionPayloadV1 | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  if (o.v !== 1 || !Array.isArray(o.options)) return null
  const options: RoomOption[] = []
  for (const x of o.options) {
    if (!x || typeof x !== 'object') continue
    const opt = x as Record<string, unknown>
    const key = typeof opt.key === 'string' ? opt.key.trim() : ''
    if (!key || options.some((p) => p.key === key)) continue
    const total = Number(opt.total_cents)
    options.push({
      key,
      name: typeof opt.name === 'string' ? opt.name : '',
      is_base: opt.is_base === true,
      total_cents: Number.isFinite(total) ? Math.round(total) : 0,
      ...(typeof opt.bid_version_id === 'string' && opt.bid_version_id.trim() ? { bid_version_id: opt.bid_version_id.trim() } : {}),
      fixture_rows: Array.isArray(opt.fixture_rows)
        ? opt.fixture_rows
            .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
            .map((r) => ({
              fixture: typeof r.fixture === 'string' ? r.fixture : '',
              count: typeof r.count === 'number' || typeof r.count === 'string' ? r.count : '',
            }))
        : [],
    })
  }
  if (options.length === 0 || !options.some((opt) => opt.is_base)) return null
  const add_ons: RoomAddOn[] = []
  if (Array.isArray(o.add_ons)) {
    for (const x of o.add_ons) {
      if (!x || typeof x !== 'object') continue
      const a = x as Record<string, unknown>
      const key = typeof a.key === 'string' ? a.key.trim() : ''
      if (!key || add_ons.some((p) => p.key === key)) continue
      const total = Number(a.total_cents)
      add_ons.push({
        key,
        name: typeof a.name === 'string' ? a.name : '',
        tag: typeof a.tag === 'string' ? a.tag : '',
        total_cents: Number.isFinite(total) ? Math.round(total) : 0,
        fixture_rows: Array.isArray(a.fixture_rows)
          ? a.fixture_rows
              .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
              .map((r) => ({
                fixture: typeof r.fixture === 'string' ? r.fixture : '',
                count: typeof r.count === 'number' || typeof r.count === 'string' ? r.count : '',
              }))
          : [],
      })
    }
  }
  const str = (k: string) => (typeof o[k] === 'string' ? (o[k] as string) : '')
  return {
    v: 1,
    project_name: str('project_name'),
    project_address: str('project_address'),
    gc_name: str('gc_name'),
    service_type_name: str('service_type_name'),
    options,
    add_ons,
    inclusions: str('inclusions'),
    exclusions: str('exclusions'),
    terms: str('terms'),
    header_brand: o.header_brand === 'plum' || o.header_brand === 'elec' ? (o.header_brand as string) : null,
  }
}

/** What the customer signs for: the chosen option plus every add-on they ticked (v2.4197). */
export function roomGrandTotalCents(option: Pick<RoomOption, 'total_cents'>, addOns: ReadonlyArray<Pick<RoomAddOn, 'total_cents'>>): number {
  return option.total_cents + addOns.reduce((s, a) => s + a.total_cents, 0)
}

/** The option the room pre-selects. */
export function roomBaseOption(payload: BidRoomRevisionPayloadV1): RoomOption {
  return payload.options.find((o) => o.is_base) ?? payload.options[0]!
}

/** Portal-style room token: long random slug, stored plaintext (the portal-links precedent). */
export function newBidRoomToken(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}
