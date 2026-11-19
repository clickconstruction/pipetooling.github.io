// dev-mcp's plan_robot_book_price / apply_robot_book_price (v2.7939 / 0.111.0): the price of an entry that already
// stands in a 🤖 Robot Default price book changed, as the Pricing tab's book panel changes it (BidsPricingTab
// savePricingEntry, the editing branch) — total_price and the three stage prices on the entry's own price_book_entries
// row, as the dev under the table's own RLS. The twin seat can read the book (get_robot_book) and add to it
// (extend_robot_book), and never changes a price that stands: this is the door for that, and it is a dev's.
//
// Why the plan is long: a robot book is never copied into a bid (pricingWriteTarget's `robot` kind), so every count row
// assigned to an entry with no price of its own reads the entry live. A changed price moves the grid of every such bid
// at once, a sent one and a locked robot bid among them. The plan counts those rows and names those bids before
// anything is written; a row with its own unit price is not reached.
//
// The entry keeps its shape. An entry as extend_robot_book makes it (the whole price in rough-in) has its rough-in
// follow the price; one with no stage prices keeps none; one whose stages are split is held until the caller gives
// the three with the price. An entry no name finds is held too, and the rest go on. price_book_entries keeps no
// history, so the reason is required and stands in the seat's own call log, where the apply's line carries each price
// before and after (robotBookLogLine).
// No new RPC and no dry-run wrapper: the dry run is the server's read of the book, its entries, the rows that read them
// and the bids those rows are on, and the plan hash commits to them. Pure: no env, no network; the reads come in
// through one small interface (src/lib/devMcp/devMcpRobotBookPrice.test.ts).

type Json = Record<string, unknown>
const obj = (v: unknown): Json | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const ROBOT_BOOK_PRICE_VERBS = ['plan_robot_book_price', 'apply_robot_book_price'] as const
export type RobotBookPriceVerb = (typeof ROBOT_BOOK_PRICE_VERBS)[number]
export function isRobotBookPriceVerb(verb: string): verb is RobotBookPriceVerb {
  return (ROBOT_BOOK_PRICE_VERBS as readonly string[]).includes(verb)
}

/** How many entries one call changes, as extend_robot_book adds at most. */
export const ROBOT_BOOK_ENTRIES_MAX = 20
export const ROBOT_BOOK_PRICE_MAX = 999_999.99
export const ROBOT_BOOK_REASON_MIN = 10
export const ROBOT_BOOK_REASON_MAX = 500

export type RobotBookStages = { rough_in: number; top_out: number; trim_set: number }
/** One entry as the caller names it: by its fixture name or its id, with the price and, for a split entry, its stages. */
export type RobotBookAsk = { name?: string; entry_id?: string; price: number; stages?: RobotBookStages }
export type RobotBookPricePayload = { version_id?: string; service_type_id?: string; reason: string; entries: RobotBookAsk[] }
export type RobotBookPriceInput = { ok: true; p: RobotBookPricePayload; target: string } | { ok: false; error: string }

const cents = (n: number): number => Math.round(n * 100) / 100
const money = (n: number): string => `$${cents(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** The ask's shape, refused in words: one book, a reason, and up to twenty entries each named once with a price. */
export function robotBookPriceInput(verb: RobotBookPriceVerb, input: Json): RobotBookPriceInput {
  const src = obj(input.prices)
  const shape = `${verb} needs prices — { one of: service_type_id (the trade whose 🤖 Robot Default price book it is — read_rows on service_types) or version_id (the book's own id, as the twin seat's get_robot_book answers it), reason (where the prices come from, ${ROBOT_BOOK_REASON_MIN} to ${ROBOT_BOOK_REASON_MAX} characters: the book keeps no history, so this line in the seat's call log is the record), entries ([{ name (the fixture's name as the book lists it) or entry_id, price (dollars, above 0), and for an entry whose stages are split all three of rough_in, top_out, trim_set }], ${ROBOT_BOOK_ENTRIES_MAX} at most) }. It changes prices that stand; a new entry is the twin seat's extend_robot_book.`
  if (!src) return { ok: false, error: shape }
  const versionId = typeof src.version_id === 'string' ? src.version_id.trim().toLowerCase() : ''
  const serviceTypeId = typeof src.service_type_id === 'string' ? src.service_type_id.trim().toLowerCase() : ''
  if (Boolean(versionId) === Boolean(serviceTypeId)) return { ok: false, error: shape }
  if (versionId && !UUID_RE.test(versionId)) return { ok: false, error: shape }
  if (serviceTypeId && !UUID_RE.test(serviceTypeId)) return { ok: false, error: shape }
  const reason = typeof src.reason === 'string' ? src.reason.trim() : ''
  if (reason.length < ROBOT_BOOK_REASON_MIN || reason.length > ROBOT_BOOK_REASON_MAX) return { ok: false, error: `${verb}: reason says where the prices come from, in ${ROBOT_BOOK_REASON_MIN} to ${ROBOT_BOOK_REASON_MAX} characters. The book keeps no history: this line is the record.` }
  if (!Array.isArray(src.entries) || src.entries.length === 0) return { ok: false, error: shape }
  if (src.entries.length > ROBOT_BOOK_ENTRIES_MAX) return { ok: false, error: `${verb}: ${ROBOT_BOOK_ENTRIES_MAX} entries a call at most, and this one names ${src.entries.length}.` }
  const entries: RobotBookAsk[] = []
  const seen = new Set<string>()
  for (const [i, raw] of src.entries.entries()) {
    const e = obj(raw)
    const at = `${verb}: entries[${i}]`
    if (!e) return { ok: false, error: `${at} is { name or entry_id, price }.` }
    const name = typeof e.name === 'string' ? e.name.trim() : ''
    const entryId = typeof e.entry_id === 'string' ? e.entry_id.trim().toLowerCase() : ''
    if (Boolean(name) === Boolean(entryId)) return { ok: false, error: `${at} names its entry once: name or entry_id, never both and never neither.` }
    if (entryId && !UUID_RE.test(entryId)) return { ok: false, error: `${at}: entry_id is a price_book_entries.id.` }
    if (name.length > 200) return { ok: false, error: `${at}: name is under 200 characters.` }
    const key = entryId ? `id:${entryId}` : `name:${name.toLowerCase()}`
    if (seen.has(key)) return { ok: false, error: `${at} names ${entryId || JSON.stringify(name)} a second time. One price an entry.` }
    seen.add(key)
    const price = typeof e.price === 'number' ? e.price : NaN
    if (!Number.isFinite(price) || price <= 0 || price > ROBOT_BOOK_PRICE_MAX) return { ok: false, error: `${at}: price is dollars, a number above 0.` }
    const given = (['rough_in', 'top_out', 'trim_set'] as const).filter((k) => e[k] !== undefined && e[k] !== null)
    let stages: RobotBookStages | undefined
    if (given.length) {
      if (given.length !== 3) return { ok: false, error: `${at}: the stages ride together: rough_in, top_out and trim_set, all three or none.` }
      const s = { rough_in: e.rough_in, top_out: e.top_out, trim_set: e.trim_set }
      for (const k of ['rough_in', 'top_out', 'trim_set'] as const) {
        const v = s[k]
        if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > ROBOT_BOOK_PRICE_MAX) return { ok: false, error: `${at}: ${k} is dollars, 0 or more.` }
      }
      stages = { rough_in: cents(s.rough_in as number), top_out: cents(s.top_out as number), trim_set: cents(s.trim_set as number) }
    }
    const extra = Object.keys(e).filter((k) => !['name', 'entry_id', 'price', 'rough_in', 'top_out', 'trim_set'].includes(k))
    if (extra.length) return { ok: false, error: `${at} takes name or entry_id, price and the three stages, not ${extra.join(', ')}.` }
    entries.push({ ...(entryId ? { entry_id: entryId } : { name }), price: cents(price), ...(stages ? { stages } : {}) })
  }
  const extra = Object.keys(src).filter((k) => !['version_id', 'service_type_id', 'reason', 'entries'].includes(k))
  if (extra.length) return { ok: false, error: `${verb}: prices takes the book, reason and entries, not ${extra.join(', ')}.` }
  return { ok: true, p: { ...(versionId ? { version_id: versionId } : { service_type_id: serviceTypeId }), reason, entries }, target: versionId || serviceTypeId }
}

// ── the world the plan reads ─────────────────────────────────────────────────────────────────────────────────────

export type RobotBookReads = {
  /** GET /rest/v1/<table>?<query> as the dev; the rows. Throws on a refused read. */
  rows(table: string, query: string): Promise<Json[]>
}

export type RobotBookRow = { id: string; name: string | null; service_type_id: string | null }
export type RobotBookEntryRow = { id: string; fixture_type_id: string | null; name: string; total_price: number; rough_in_price: number; top_out_price: number; trim_set_price: number }
/** A count row's assignment to an entry: the row reads the entry's price unless it carries its own. */
export type RobotBookUseRow = { bid_id: string; price_book_entry_id: string; unit_price_override: number | null }
export type RobotBookBidRow = { id: string; bid_number: string | null; project_name: string | null; bid_date_sent: string | null; outcome: string | null }
export type RobotBookRunRow = { shadow_bid_id: string; status: string }

/** How many assignments, and how many bids, one plan reads; at the limit the plan says at least. */
export const ROBOT_BOOK_USES_LIMIT = 1000
export const ROBOT_BOOK_BIDS_LIMIT = 150

export type RobotBookWorld = {
  /** The robot books the ask finds: one, when the ask is good. */
  books: RobotBookRow[]
  tradeName: string | null
  entries: RobotBookEntryRow[]
  /** The assignments that point at the entries the ask finds; null when the read was refused. */
  uses: RobotBookUseRow[] | null
  bids: RobotBookBidRow[]
  /** The robots' locked or scored runs on those bids. */
  runs: RobotBookRunRow[]
}

const num = (v: unknown): number => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : 0)
const sameName = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase()

/** The entries an ask finds in the book, by its id or by the fixture's name, whatever its case or padding. */
export function robotBookMatches(ask: RobotBookAsk, entries: readonly RobotBookEntryRow[]): RobotBookEntryRow[] {
  return ask.entry_id ? entries.filter((e) => e.id.toLowerCase() === ask.entry_id) : entries.filter((e) => sameName(e.name, ask.name ?? ''))
}

/** The reads the dry run needs, in one place, so the test pins the queries the door will see. */
export async function readRobotBookWorld(reads: RobotBookReads, p: RobotBookPricePayload): Promise<RobotBookWorld> {
  const books = (await reads.rows('price_book_versions', `select=id,name,service_type_id&is_robot=is.true&bid_id=is.null&${p.version_id ? `id=eq.${p.version_id}` : `service_type_id=eq.${p.service_type_id}`}&order=created_at.asc&limit=5`)) as RobotBookRow[]
  const empty: RobotBookWorld = { books, tradeName: null, entries: [], uses: [], bids: [], runs: [] }
  const book = books.length === 1 ? books[0]! : null
  if (!book) return empty
  const [trade, rawEntries] = await Promise.all([
    book.service_type_id ? reads.rows('service_types', `select=id,name&id=eq.${book.service_type_id}&limit=1`) : Promise.resolve([] as Json[]),
    reads.rows('price_book_entries', `select=id,fixture_type_id,total_price,rough_in_price,top_out_price,trim_set_price,fixture_types(name)&version_id=eq.${book.id}&order=sequence_order.asc&limit=1000`),
  ])
  const entries: RobotBookEntryRow[] = rawEntries.map((r) => ({
    id: String(r.id),
    fixture_type_id: typeof r.fixture_type_id === 'string' ? r.fixture_type_id : null,
    name: String(obj(r.fixture_types)?.name ?? '').trim(),
    total_price: num(r.total_price),
    rough_in_price: num(r.rough_in_price),
    top_out_price: num(r.top_out_price),
    trim_set_price: num(r.trim_set_price),
  }))
  const tradeName = typeof trade[0]?.name === 'string' ? (trade[0].name as string) : null
  const found = [...new Set(p.entries.flatMap((ask) => robotBookMatches(ask, entries)).map((e) => e.id))]
  if (!found.length) return { ...empty, tradeName, entries }
  // Who reads these entries. Fail-soft: a refused read leaves the reach unknown and the plan says so, never silent.
  let uses: RobotBookUseRow[] | null
  try {
    uses = (await reads.rows('bid_pricing_assignments', `select=bid_id,price_book_entry_id,unit_price_override&price_book_entry_id=in.(${found.join(',')})&order=bid_id.asc&limit=${ROBOT_BOOK_USES_LIMIT}`)).map((r) => ({ bid_id: String(r.bid_id), price_book_entry_id: String(r.price_book_entry_id), unit_price_override: r.unit_price_override == null ? null : num(r.unit_price_override) }))
  } catch {
    uses = null
  }
  const bidIds = [...new Set((uses ?? []).filter((u) => u.unit_price_override == null).map((u) => u.bid_id))].slice(0, ROBOT_BOOK_BIDS_LIMIT)
  if (!bidIds.length) return { books, tradeName, entries, uses, bids: [], runs: [] }
  const [bids, runs] = await Promise.all([
    reads.rows('bids', `select=id,bid_number,project_name,bid_date_sent,outcome&id=in.(${bidIds.join(',')})&limit=${ROBOT_BOOK_BIDS_LIMIT}`).catch(() => [] as Json[]),
    reads.rows('twin_shadow_runs', `select=shadow_bid_id,status&shadow_bid_id=in.(${bidIds.join(',')})&status=in.(locked,scored)&limit=${ROBOT_BOOK_BIDS_LIMIT}`).catch(() => [] as Json[]),
  ])
  return { books, tradeName, entries, uses, bids: bids as RobotBookBidRow[], runs: runs as RobotBookRunRow[] }
}

// ── the dry run ──────────────────────────────────────────────────────────────────────────────────────────────────

export type RobotBookPrices = { total_price: number; rough_in_price: number; top_out_price: number; trim_set_price: number }
export type RobotBookChange = { entry_id: string; name: string; before: RobotBookPrices; after: RobotBookPrices; reads_it: { rows: number; bids: number; own_price_rows: number } | null }
export type RobotBookHeld = { asked: string; why: string }
export type RobotBookDryRun = { ok: true; reply: Json; book: RobotBookRow; changes: RobotBookChange[] } | { ok: false; refused: string }

const pricesOf = (e: RobotBookEntryRow): RobotBookPrices => ({ total_price: cents(e.total_price), rough_in_price: cents(e.rough_in_price), top_out_price: cents(e.top_out_price), trim_set_price: cents(e.trim_set_price) })
const samePrices = (a: RobotBookPrices, b: RobotBookPrices): boolean => a.total_price === b.total_price && a.rough_in_price === b.rough_in_price && a.top_out_price === b.top_out_price && a.trim_set_price === b.trim_set_price

/**
 * What an entry would read after: the price as its total, and its stages by the shape it has. Null when the stages
 * are split and the ask gives none: a split is a person's, and the door will not guess how a new price divides.
 */
export function robotBookAfter(before: RobotBookPrices, ask: RobotBookAsk): RobotBookPrices | null {
  if (ask.stages) return { total_price: ask.price, rough_in_price: ask.stages.rough_in, top_out_price: ask.stages.top_out, trim_set_price: ask.stages.trim_set }
  const noStages = before.rough_in_price === 0 && before.top_out_price === 0 && before.trim_set_price === 0
  if (noStages) return { ...before, total_price: ask.price }
  const wholeInRoughIn = before.rough_in_price === before.total_price && before.top_out_price === 0 && before.trim_set_price === 0
  if (wholeInRoughIn) return { total_price: ask.price, rough_in_price: ask.price, top_out_price: 0, trim_set_price: 0 }
  return null
}

const bidWords = (b: RobotBookBidRow): string => {
  const n = (b.bid_number ?? '').toString().trim()
  return [n ? `b${n}` : '', (b.project_name ?? '').trim()].filter(Boolean).join(' ') || b.id
}

/** How many bids a plan names of each kind; the counts beside them are whole. */
export const ROBOT_BOOK_BIDS_NAMED = 8

/**
 * The dry run: each entry before → after, the rows and bids that read it, the sent bids and the robots' locked bids
 * among them, what is held and why. No such book, two books for one trade, and a plan that changes nothing are each
 * refused in words.
 */
export function robotBookPriceDryRun(p: RobotBookPricePayload, world: RobotBookWorld): RobotBookDryRun {
  const asked = p.version_id ? `version ${p.version_id}` : `service type ${p.service_type_id}`
  if (world.books.length === 0) return { ok: false, refused: `No 🤖 robot price book reads as ${asked}. A robot book is a price_book_versions row with is_robot true and no bid: read_rows lists them, and the twin seat's get_robot_book answers each with its version_id.` }
  if (world.books.length > 1) return { ok: false, refused: `${world.books.length} robot price books read as ${asked}: ${world.books.map((b) => `${b.name ?? 'unnamed'} (${b.id})`).join(', ')}. Name one by version_id.` }
  const book = world.books[0]!
  const changes: RobotBookChange[] = []
  const unchanged: string[] = []
  const held: RobotBookHeld[] = []
  const taken = new Set<string>()
  for (const ask of p.entries) {
    const label = ask.entry_id ?? JSON.stringify(ask.name ?? '')
    const matches = robotBookMatches(ask, world.entries)
    if (matches.length === 0) {
      held.push({ asked: label, why: ask.entry_id ? 'no entry of this book has that id' : 'no entry of this book has that name: the twin seat\'s extend_robot_book adds one, and its get_robot_book lists the names that stand' })
      continue
    }
    if (matches.length > 1) {
      held.push({ asked: label, why: `${matches.length} entries of this book carry that name: name one by entry_id (${matches.map((m) => m.id).join(', ')})` })
      continue
    }
    const entry = matches[0]!
    if (taken.has(entry.id)) {
      held.push({ asked: label, why: `${JSON.stringify(entry.name)} is named twice in this plan, once by its name and once by its id` })
      continue
    }
    taken.add(entry.id)
    const before = pricesOf(entry)
    const after = robotBookAfter(before, ask)
    if (!after) {
      held.push({ asked: label, why: `its stages are split (rough-in ${money(before.rough_in_price)}, top-out ${money(before.top_out_price)}, trim ${money(before.trim_set_price)}): give rough_in, top_out and trim_set with the price` })
      continue
    }
    if (samePrices(before, after)) {
      unchanged.push(entry.name || entry.id)
      continue
    }
    const mine = world.uses ? world.uses.filter((u) => u.price_book_entry_id === entry.id) : null
    const live = mine ? mine.filter((u) => u.unit_price_override == null) : null
    changes.push({ entry_id: entry.id, name: entry.name, before, after, reads_it: mine && live ? { rows: live.length, bids: new Set(live.map((u) => u.bid_id)).size, own_price_rows: mine.length - live.length } : null })
  }
  const heldWords = held.length ? ` Held: ${held.map((h) => `${h.asked} (${h.why})`).join('; ')}.` : ''
  if (!changes.length) return { ok: false, refused: `Nothing to apply on ${book.name ?? 'the robot book'}${world.tradeName ? ` (${world.tradeName})` : ''}: ${unchanged.length ? `${unchanged.map((n) => JSON.stringify(n)).join(', ')} already ${unchanged.length === 1 ? 'reads' : 'read'} that way.` : 'no entry would change.'}${heldWords}` }

  // ── who reads the changed entries ──
  const changedIds = new Set(changes.map((c) => c.entry_id))
  const liveUses = world.uses ? world.uses.filter((u) => changedIds.has(u.price_book_entry_id) && u.unit_price_override == null) : null
  const atLimit = !!world.uses && world.uses.length >= ROBOT_BOOK_USES_LIMIT
  const reachedBidIds = liveUses ? [...new Set(liveUses.map((u) => u.bid_id))] : []
  const bidById = new Map(world.bids.map((b) => [b.id, b]))
  const known = reachedBidIds.map((id) => bidById.get(id)).filter((b): b is RobotBookBidRow => !!b)
  const sent = known.filter((b) => !!b.bid_date_sent)
  const lockedIds = new Set(world.runs.map((r) => r.shadow_bid_id))
  const locked = known.filter((b) => lockedIds.has(b.id))
  const named = (list: RobotBookBidRow[]): string => `${list.slice(0, ROBOT_BOOK_BIDS_NAMED).map(bidWords).join(', ')}${list.length > ROBOT_BOOK_BIDS_NAMED ? `, and ${list.length - ROBOT_BOOK_BIDS_NAMED} more` : ''}`
  const warnings: string[] = []
  if (!liveUses) warnings.push('The rows that read these entries could not be read, so which bids move is not known. Read them before you apply: bid_pricing_assignments by price_book_entry_id.')
  else {
    if (atLimit) warnings.push(`The read of the rows stopped at ${ROBOT_BOOK_USES_LIMIT}, so every count here is at least that many.`)
    if (reachedBidIds.length > known.length) warnings.push(`${reachedBidIds.length - known.length} of the ${reachedBidIds.length} bids could not be read by name, so the sent and locked counts cover the ${known.length} that could.`)
    if (sent.length) warnings.push(`${sent.length} sent bid${sent.length === 1 ? '' : 's'} read${sent.length === 1 ? 's' : ''} these entries live and would show a new number on the grid, where the paper that went out keeps the old one: ${named(sent)}.`)
    if (locked.length) warnings.push(`${locked.length} robot bid${locked.length === 1 ? '' : 's'} with a locked or scored run read${locked.length === 1 ? 's' : ''} these entries. The locked total on the run stays as it was locked; the bid's own grid would read the new price, so the two part: ${named(locked)}.`)
  }
  if (held.length) warnings.push(`${held.length} of ${p.entries.length} asked ${held.length === 1 ? 'is' : 'are'} held and not in this plan.${heldWords}`)
  const reachWords = !liveUses
    ? 'How many rows read them is not known.'
    : liveUses.length === 0
      ? 'No count row reads them today, so no bid moves: the price waits for the next row assigned to it.'
      : `${atLimit ? 'At least ' : ''}${liveUses.length} count row${liveUses.length === 1 ? '' : 's'} on ${reachedBidIds.length} bid${reachedBidIds.length === 1 ? '' : 's'} read${liveUses.length === 1 ? 's' : ''} them with no price of ${liveUses.length === 1 ? 'its' : 'their'} own and would read the new price at once. A row with its own unit price is not reached.`
  const n = changes.length
  return {
    ok: true,
    book,
    changes,
    reply: {
      dry_run: true,
      book: { version_id: book.id, name: book.name, service_type_id: book.service_type_id, trade: world.tradeName, entries: world.entries.length },
      reason: p.reason,
      changes,
      unchanged,
      held,
      reach: liveUses ? { rows: liveUses.length, bids: reachedBidIds.length, sent_bids: sent.length, locked_robot_bids: locked.length, at_least: atLimit } : null,
      warnings,
      then: `apply writes ${n === 1 ? 'that price' : `those ${n} prices`} on ${n === 1 ? 'the entry\'s own row' : 'each entry\'s own row'} as you, as saving the entry on the Pricing tab's book panel does, one entry a write, each reported done or held. A robot book is never copied into a bid, so a row assigned to an entry reads it live. ${reachWords} The book keeps no history: the reason and each price before and after stand on the apply's line in this seat's call log alone, so the way back is this pair with the before prices.`,
    },
  }
}

/** The write: the panel's own columns, the fixture left as it is. */
export function robotBookPricePatch(after: RobotBookPrices): Json {
  return { total_price: after.total_price, rough_in_price: after.rough_in_price, top_out_price: after.top_out_price, trim_set_price: after.trim_set_price }
}

/** The filter the write is held to: this entry, still in this book. */
export function robotBookPricePatchQuery(book: Pick<RobotBookRow, 'id'>, change: Pick<RobotBookChange, 'entry_id'>): string {
  return `id=eq.${change.entry_id}&version_id=eq.${book.id}`
}

export type RobotBookStep = { entry_id: string; name: string; ok: boolean; words: string }

/** The line after the write: what was priced, what was held and why, and how to put a price back. */
export function robotBookAppliedWords(steps: readonly RobotBookStep[], book: RobotBookRow): string {
  const done = steps.filter((s) => s.ok)
  const held = steps.filter((s) => !s.ok)
  const where = book.name ?? 'the robot book'
  const doneWords = done.length ? `Priced ${done.length} entr${done.length === 1 ? 'y' : 'ies'} on ${where}: ${done.map((s) => `${JSON.stringify(s.name)} ${s.words}`).join('; ')}.` : `Nothing priced on ${where}.`
  const heldWords = held.length ? ` Held: ${held.map((s) => `${JSON.stringify(s.name)} (${s.words})`).join('; ')}. Plan again for an entry still to change.` : ''
  return `${doneWords}${heldWords} Every row that reads an entry with no price of its own reads the new one now. The twin seat's get_robot_book lists the book as it stands.`
}

/** How long the apply's line in the call log may run. */
export const ROBOT_BOOK_LOG_LINE_MAX = 900

/**
 * The apply's line in the seat's call log (dev_mcp_calls.target): the book, then each entry that landed with its
 * price before and after. It is the only record of a price that stood, so it is cut by whole entries, never mid-number.
 */
export function robotBookLogLine(book: RobotBookRow, landed: readonly RobotBookChange[]): string {
  const head = `${book.id} ${book.name ?? 'robot book'}`
  const parts: string[] = []
  for (const c of landed) {
    const part = `${JSON.stringify(c.name)} ${c.before.total_price} → ${c.after.total_price}`
    if ([head, ...parts, part].join(' · ').length > ROBOT_BOOK_LOG_LINE_MAX - 20) {
      parts.push(`and ${landed.length - parts.length} more`)
      break
    }
    parts.push(part)
  }
  return [head, ...parts].join(' · ')
}

/** What a done step says: the price it left and the price it set. */
export function robotBookStepWords(change: RobotBookChange): string {
  return `${money(change.before.total_price)} → ${money(change.after.total_price)}`
}
