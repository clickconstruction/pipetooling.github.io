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

/**
 * The publish kernel lives in `_shared/` since v2.5105 (punch list #103), so the sample room in
 * Settings → What customers see is built by the same code that publishes a real revision. Only
 * priced sections reach the room, and a letter with no priced base builds nothing.
 */
export {
  buildBidRoomRevisionPayload,
  roomHeaderBrandForServiceType,
  type SharedRoomAddOnInput as RoomAddOnInput,
  type SharedRoomSectionInput as RoomSectionInput,
} from '../../../supabase/functions/_shared/bidRoomPublish'

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
