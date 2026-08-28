/**
 * The Bid Room (Signable Bids, v2.2468): one durable link per GC packet serving the latest
 * PUBLISHED letter revision. This kernel builds and parses the revision payload — the frozen,
 * letter-faithful content a revision pins: base + offered alternates as pickable options
 * (fixture/count lists + one lump total each, exactly the cover letter's document model — the
 * letter never prices per line), the inclusions/exclusions/terms text, and the Google Docs
 * letter link riding along.
 *
 * Option semantics mirror the letter's: ALL base sections merge into one "base" option (the
 * letter's proposed amount is the base sum); each alternate section is its own option, offered
 * in lieu of the base. Signing (Phase 2) freezes the chosen option onto the estimate rails.
 */

export type RoomFixtureRow = { fixture: string; count: number | string }

export type RoomOption = {
  /** Stable within the revision; `accepted_option_key` on the signed record. */
  key: string
  name: string
  /** True for the merged base option — pre-selected, badged "Proposed" on the room page. */
  is_base: boolean
  total_cents: number
  fixture_rows: RoomFixtureRow[]
}

export type BidRoomRevisionPayloadV1 = {
  v: 1
  project_name: string
  project_address: string
  gc_name: string
  service_type_name: string
  options: RoomOption[]
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
    fixture_rows: base.flatMap((s) => s.fixtureRows),
  }
  const options: RoomOption[] = [
    baseOption,
    ...alts.map((s, i) => ({
      key: `alt-${i + 1}`,
      name: s.name.trim() || `Alternate ${i + 1}`,
      is_base: false,
      total_cents: centsFromDollars(s.revenueSum),
      fixture_rows: s.fixtureRows,
    })),
  ]
  return {
    v: 1,
    project_name: input.projectName.trim(),
    project_address: input.projectAddress.trim(),
    gc_name: input.gcName.trim(),
    service_type_name: input.serviceTypeName.trim(),
    options,
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
  const str = (k: string) => (typeof o[k] === 'string' ? (o[k] as string) : '')
  return {
    v: 1,
    project_name: str('project_name'),
    project_address: str('project_address'),
    gc_name: str('gc_name'),
    service_type_name: str('service_type_name'),
    options,
    inclusions: str('inclusions'),
    exclusions: str('exclusions'),
    terms: str('terms'),
    header_brand: o.header_brand === 'plum' || o.header_brand === 'elec' ? (o.header_brand as string) : null,
  }
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
