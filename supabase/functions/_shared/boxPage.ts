/**
 * The box page (punch list #294, v2.6797): what a scanned cage or box label opens with no sign-in. The label's QR
 * reads `PRTS.CO/B/<eight hex>`, prts.co forwards it to the app's `/b/:code`, and the page asks the `box-read` function
 * for the box by its code: the stencil, the place, the newest photo, the lines with their counts and the day of the last
 * count; since v2.6874 the lines emptied since that count, a line's Can't find presses and the company's own number.
 * Never the job, the customer, a price or a person's name. The pure part lives here, shared with the client
 * through `src/lib/materials/boxPage.ts` and tested from `src/lib/materials/boxPage.test.ts`. Deno-free on purpose.
 *
 * Since v2.7072 (punch list #329) a code may be a sticker's: a printed code that points at a box, or at nothing yet.
 * The function reads the sticker first (`boxPageStickerAnswer`). One on a box answers that box's page as a label does;
 * a blank one answers its number and nothing else; a lost one says so.
 */

/** A box's code: the container id's first eight hex characters, as `job_containers.code` keeps them (capitals). */
const BOX_CODE_RE = /^[0-9A-F]{8}$/

/** The code as the function reads it: letters and digits only, capitals, the dash a person types dropped; null when it cannot be a code. */
export function boxPageCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const c = raw.replace(/[^0-9a-z]/gi, '').toUpperCase()
  return BOX_CODE_RE.test(c) ? c : null
}

/** The code as a person reads it: `4F2A-9C18`. */
export function boxPageCodeWords(code: string): string {
  const c = code.replace(/[^0-9a-z]/gi, '').toUpperCase()
  return c.length === 8 ? `${c.slice(0, 4)}-${c.slice(4)}` : c
}

export type BoxPageKind = 'cage' | 'box' | 'pile'

export type BoxPageLine = {
  partName: string
  manufacturer: string | null
  onHand: number
  /** The Can't find presses on the line since its last count, carried only when there are any (v2.6874). */
  cannotFind?: number
}

export type BoxPagePhoto = {
  id: string
  /** The app calendar's day the shot was taken, YYYY-MM-DD. */
  takenOn: string
  /** Where the page loads the bytes from: the function itself, which streams them from Drive or the bucket. */
  url: string
}

export type BoxPagePayload = {
  ok: true
  box: {
    code: string
    /** The stencil: A1, B7. */
    stencil: string
    kind: BoxPageKind
    /** The place on site, '' when nobody said. */
    place: string
    where: string
    lines: BoxPageLine[]
    /** The lines emptied since the box's last count (v2.6874): the page reads them *None left*. A count clears them. */
    gone: BoxPageLine[]
    /** The app calendar's day of the last count in this box, or null when never counted. */
    lastCountedOn: string | null
    photo: BoxPagePhoto | null
    /** The number of the sticker that was scanned (v2.7072), when the code was a sticker's and not the box's own label. */
    stickerNumber?: number
  }
  /** The company's own number, for *Text the office* (v2.6874): the team box's line since v2.6910 (`boxPageOfficePhone`). Never a person's. */
  office: { phone: string } | null
}

/**
 * The answers that are not a box: the code is not one, no live box carries it, the box was retired, or the source is locked.
 * Since v2.7072 two more: the code is a sticker that is on no box yet, or a sticker that was marked lost.
 */
export type BoxPageRefusal = 'bad_code' | 'not_found' | 'retired' | 'locked' | 'sticker_blank' | 'sticker_lost'

/** A sticker row as the function reads it (`box_stickers`, punch list #329). */
export type BoxPageStickerRow = { id: string; number: number; code: string; container_id: string | null; lost_at: string | null }

/**
 * What a sticker's code answers before any box is read (v2.7072):
 *  - `none`: no sticker carries the code, so it is read as a box's own.
 *  - `box`: the sticker is on a box, and the function goes on to that box's page as for a label.
 *  - `blank`: 404 `sticker_blank` with the number and nothing else. A build from before stickers reads the 404 as
 *    *not a box on any job*, which is true of it.
 *  - `lost`: 410 `sticker_lost` with the number and the day. An older build reads the 410 as a label that can come off.
 * A lost sticker says lost even while it keeps the box it was on.
 */
export type BoxPageStickerAnswer =
  | { kind: 'none' }
  | { kind: 'box'; containerId: string; number: number }
  | { kind: 'blank'; status: 404; body: { error: 'sticker_blank'; number: number } }
  | { kind: 'lost'; status: 410; body: { error: 'sticker_lost'; number: number; lostOn: string | null } }

export function boxPageStickerAnswer(row: BoxPageStickerRow | null, lostOn: string | null = null): BoxPageStickerAnswer {
  if (!row) return { kind: 'none' }
  if (row.lost_at) return { kind: 'lost', status: 410, body: { error: 'sticker_lost', number: row.number, lostOn } }
  if (!row.container_id) return { kind: 'blank', status: 404, body: { error: 'sticker_blank', number: row.number } }
  return { kind: 'box', containerId: row.container_id, number: row.number }
}

/** The container row as the function reads it. */
export type BoxPageContainerRow = { id: string; job_id: string; label: string; kind: string; where_note: string | null; place_id: string | null; retired_at: string | null; code: string }

/** A line of `on_site_job_summary`'s answer, the part the page needs. Its `*_by` names are never read. */
export type BoxPageServerLine = {
  container_id: string
  part_name: string
  manufacturer: string | null
  on_hand: number
  /** The Can't find presses on the line since its last count. */
  cannot_find_since_count?: number | null
  /** When the line was last touched by any press, a count included. */
  last_touched_at?: string | null
}

export function boxPageKind(kind: string): BoxPageKind {
  return kind === 'box' ? 'box' : kind === 'cage' ? 'cage' : 'pile'
}

/** The noun a person reads: Cage, Box, Pile. */
export function boxPageNoun(kind: BoxPageKind, capital = true): string {
  const w = kind === 'pile' ? 'pile' : kind
  return capital ? w[0]!.toUpperCase() + w.slice(1) : w
}

function cannotFindOf(l: BoxPageServerLine): number {
  const n = Math.round(Number(l.cannot_find_since_count ?? 0))
  return Number.isFinite(n) && n > 0 ? n : 0
}

function pageLine(l: BoxPageServerLine, onHand: number): BoxPageLine {
  const cannotFind = cannotFindOf(l)
  return { partName: l.part_name, manufacturer: l.manufacturer, onHand, ...(cannotFind > 0 ? { cannotFind } : {}) }
}

/** The lines of one container with something on hand, in name order. */
export function boxPageLines(lines: ReadonlyArray<BoxPageServerLine>, containerId: string): BoxPageLine[] {
  return lines
    .filter((l) => l.container_id === containerId && l.on_hand > 0)
    .map((l) => pageLine(l, l.on_hand))
    .sort((a, b) => a.partName.localeCompare(b.partName))
}

/** With no count ever, a line emptied longer ago than this drops off the page: the window the office calls a count due. */
export const BOX_PAGE_GONE_DAYS = 14

/**
 * The lines of one container with nothing left that a person would still look for (v2.6874): emptied by a press after the
 * box's last count, or carrying a Can't find since their own count. The next count of the box clears them, so an old cage
 * grows no tail; a line counted to zero drops out, as it does on the crew's screen (`linesOf` in onSite.ts). A box never
 * counted keeps a line for `BOX_PAGE_GONE_DAYS` after it emptied. In name order, every one at zero.
 */
export function boxPageGoneLines(lines: ReadonlyArray<BoxPageServerLine>, containerId: string, lastCountAt: string | null, nowIso: string): BoxPageLine[] {
  const counted = lastCountAt ? Date.parse(lastCountAt) : Number.NaN
  const floor = Date.parse(nowIso) - BOX_PAGE_GONE_DAYS * 86_400_000
  return lines
    .filter((l) => l.container_id === containerId && l.on_hand <= 0)
    .filter((l) => {
      if (cannotFindOf(l) > 0) return true
      const touched = l.last_touched_at ? Date.parse(l.last_touched_at) : Number.NaN
      if (!Number.isFinite(touched)) return false
      return Number.isFinite(counted) ? touched > counted : Number.isFinite(floor) && touched >= floor
    })
    .map((l) => pageLine(l, 0))
    .sort((a, b) => a.partName.localeCompare(b.partName))
}

/**
 * The number *Text the office* and *Call the office* go to (v2.6910): the first of these that is there. The function
 * hands them in order: the team box's number from Settings → Phone and texts (`messages_boxes_v1`), the line the Messages
 * page sees, so a text about a cage lands where the office reads it; then that box's fallback secret; then the
 * letterhead's number, which rings but whose texts reach nobody in the app. Empty when none is there.
 */
export function boxPageOfficePhone(candidates: ReadonlyArray<string | null | undefined>): string {
  for (const c of candidates) {
    const phone = (c ?? '').trim()
    if (phone) return phone
  }
  return ''
}

/** The function's address for a photo's bytes. */
export function boxPagePhotoUrl(supabaseUrl: string, code: string, photoId: string): string {
  return `${supabaseUrl.replace(/\/+$/, '')}/functions/v1/box-read?code=${encodeURIComponent(code)}&photo=${encodeURIComponent(photoId)}`
}

export function buildBoxPagePayload(input: {
  container: BoxPageContainerRow
  place: string
  lines: ReadonlyArray<BoxPageServerLine>
  lastCountedOn: string | null
  photo: BoxPagePhoto | null
  /** The instant of the box's last count, which clears its lines at zero; null when never counted. */
  lastCountAt?: string | null
  /** Now, as the function reads it. Without it no line at zero is kept by its age. */
  now?: string
  /** The company's own number, as `boxPageOfficePhone` picked it. */
  officePhone?: string | null
  /** The code that was scanned, when it was a sticker's (v2.7072): the page keeps the code in the person's hand. */
  scannedCode?: string | null
  /** That sticker's number. */
  stickerNumber?: number | null
}): BoxPagePayload {
  const c = input.container
  const phone = (input.officePhone ?? '').trim()
  const stickerNumber = typeof input.stickerNumber === 'number' && input.stickerNumber > 0 ? input.stickerNumber : null
  return {
    ok: true,
    box: {
      code: input.scannedCode || c.code,
      stencil: c.label,
      kind: boxPageKind(c.kind),
      place: input.place,
      where: (c.where_note ?? '').trim(),
      lines: boxPageLines(input.lines, c.id),
      gone: boxPageGoneLines(input.lines, c.id, input.lastCountAt ?? null, input.now ?? ''),
      lastCountedOn: input.lastCountedOn,
      photo: input.photo,
      ...(stickerNumber ? { stickerNumber } : {}),
    },
    office: phone ? { phone } : null,
  }
}

/** One line of the answer read back; null when it is not a line. */
function readLine(l: unknown): BoxPageLine | null {
  if (!l || typeof l !== 'object') return null
  const r = l as Record<string, unknown>
  if (typeof r.partName !== 'string' || typeof r.onHand !== 'number') return null
  const cannotFind = typeof r.cannotFind === 'number' && r.cannotFind > 0 ? r.cannotFind : 0
  return { partName: r.partName, manufacturer: typeof r.manufacturer === 'string' ? r.manufacturer : null, onHand: r.onHand, ...(cannotFind > 0 ? { cannotFind } : {}) }
}

/** The function's answer read back on the client; null when it is not the shape. */
export function parseBoxPageResponse(body: unknown): BoxPagePayload | null {
  if (!body || typeof body !== 'object') return null
  const b = body as { ok?: unknown; box?: unknown }
  if (b.ok !== true || !b.box || typeof b.box !== 'object') return null
  const x = b.box as Record<string, unknown>
  if (typeof x.code !== 'string' || typeof x.stencil !== 'string' || !Array.isArray(x.lines)) return null
  const lines: BoxPageLine[] = []
  for (const l of x.lines as unknown[]) {
    const line = readLine(l)
    if (!line) return null
    lines.push(line)
  }
  // An answer from before v2.6874 carries no `gone` and no `office`: read as none, so an old function still draws.
  const gone: BoxPageLine[] = []
  if (Array.isArray(x.gone)) {
    for (const l of x.gone as unknown[]) {
      const line = readLine(l)
      if (line) gone.push(line)
    }
  }
  const o = (body as { office?: unknown }).office
  const officePhone = o && typeof o === 'object' && typeof (o as { phone?: unknown }).phone === 'string' ? ((o as { phone: string }).phone).trim() : ''
  let photo: BoxPagePhoto | null = null
  if (x.photo && typeof x.photo === 'object') {
    const p = x.photo as Record<string, unknown>
    if (typeof p.id === 'string' && typeof p.url === 'string') photo = { id: p.id, takenOn: typeof p.takenOn === 'string' ? p.takenOn : '', url: p.url }
  }
  return {
    ok: true,
    box: {
      code: x.code,
      stencil: x.stencil,
      kind: boxPageKind(typeof x.kind === 'string' ? x.kind : ''),
      place: typeof x.place === 'string' ? x.place : '',
      where: typeof x.where === 'string' ? x.where : '',
      lines,
      gone,
      lastCountedOn: typeof x.lastCountedOn === 'string' ? x.lastCountedOn : null,
      photo,
      ...(typeof x.stickerNumber === 'number' && x.stickerNumber > 0 ? { stickerNumber: x.stickerNumber } : {}),
    },
    office: officePhone ? { phone: officePhone } : null,
  }
}

/** The 429's words when a source has guessed too often. The page shows them as they are. */
export const BOX_PAGE_LOCKED_WORDS = 'Too many wrong codes from this connection in the last hour. Wait an hour and scan the label again.'

// ---------------------------------------------------------------------------
// Find a part on this site (PR 3, v2.6799): the search a scanned code opens, over that box's job and no other.
// ---------------------------------------------------------------------------

/** At most this many boxes come back; a site with more matches is told to type one more word. */
export const BOX_PAGE_FIND_MAX = 30

/** The words typed, folded: lower-cased, split on spaces, empty ones dropped, at most six. */
export function boxPageFindWords(raw: unknown): string[] {
  if (typeof raw !== 'string') return []
  return raw.toLowerCase().split(/\s+/).map((w) => w.trim()).filter(Boolean).slice(0, 6)
}

export type BoxPageFindBox = {
  code: string
  stencil: string
  kind: BoxPageKind
  place: string
  where: string
  /** The lines that matched a word; every line on hand when the box matched by its stencil or place alone. */
  lines: BoxPageLine[]
  /** True for the box the code named, so the page can mark it. */
  thisBox: boolean
}

export type BoxPageFindPayload = {
  ok: true
  find: {
    words: string[]
    boxes: BoxPageFindBox[]
    /** How many boxes matched before the cap. */
    total: number
  }
}

export type BoxPageFindInput = {
  /** The code the scan opened: its box lists first and is marked. */
  thisCode: string
  words: string[]
  containers: ReadonlyArray<BoxPageContainerRow>
  places: ReadonlyArray<{ id: string; name: string }>
  lines: ReadonlyArray<BoxPageServerLine>
}

function fold(s: string | null | undefined): string {
  return (s ?? '').toLowerCase()
}

/**
 * The boxes of the job whose stencil, place, where-note or lines hold every word typed: the scanned box first, then
 * stencil order. A box that matched on a line carries the matching lines; one that matched on its name alone carries
 * every line on hand, so a person who typed a stencil sees what is in it. Retired boxes and the Unsorted row never match.
 */
export function boxPageFind(input: BoxPageFindInput): BoxPageFindPayload['find'] {
  const words = input.words.filter(Boolean)
  const placeName = new Map(input.places.map((p) => [p.id, p.name] as const))
  const out: BoxPageFindBox[] = []
  if (words.length > 0) {
    for (const c of input.containers) {
      if (c.retired_at || c.kind === 'unsorted') continue
      const place = (c.place_id && placeName.get(c.place_id)) || ''
      const own = `${fold(c.label)} ${fold(place)} ${fold(c.where_note)}`
      const all = boxPageLines(input.lines, c.id)
      const byLine = all.filter((l) => words.every((w) => `${fold(l.partName)} ${fold(l.manufacturer)}`.includes(w)))
      const byName = words.every((w) => own.includes(w))
      // A word on the box and the rest on a line counts too: "b3 copper".
      const mixed = !byName && byLine.length === 0 ? all.filter((l) => words.every((w) => own.includes(w) || `${fold(l.partName)} ${fold(l.manufacturer)}`.includes(w))) : []
      if (!byName && byLine.length === 0 && mixed.length === 0) continue
      out.push({
        code: c.code,
        stencil: c.label,
        kind: boxPageKind(c.kind),
        place,
        where: (c.where_note ?? '').trim(),
        lines: byLine.length > 0 ? byLine : mixed.length > 0 ? mixed : all,
        thisBox: c.code === input.thisCode,
      })
    }
  }
  out.sort((a, b) => (a.thisBox === b.thisBox ? compareStencils(a.stencil, b.stencil) : a.thisBox ? -1 : 1))
  return { words, boxes: out.slice(0, BOX_PAGE_FIND_MAX), total: out.length }
}

/** A1 before A2 before A10, then B1: the letters, then the number. */
export function compareStencils(a: string, b: string): number {
  const ra = /^([A-Za-z]*)(\d*)(.*)$/.exec(a.trim()) ?? []
  const rb = /^([A-Za-z]*)(\d*)(.*)$/.exec(b.trim()) ?? []
  const la = (ra[1] ?? '').toUpperCase()
  const lb = (rb[1] ?? '').toUpperCase()
  if (la !== lb) return la < lb ? -1 : 1
  const na = ra[2] ? Number(ra[2]) : Number.POSITIVE_INFINITY
  const nb = rb[2] ? Number(rb[2]) : Number.POSITIVE_INFINITY
  if (na !== nb) return na < nb ? -1 : 1
  return a.localeCompare(b)
}

/** The search's answer read back on the client; null when it is not the shape. */
export function parseBoxPageFindResponse(body: unknown): BoxPageFindPayload | null {
  if (!body || typeof body !== 'object') return null
  const b = body as { ok?: unknown; find?: unknown }
  if (b.ok !== true || !b.find || typeof b.find !== 'object') return null
  const f = b.find as Record<string, unknown>
  if (!Array.isArray(f.boxes)) return null
  const boxes: BoxPageFindBox[] = []
  for (const x of f.boxes as unknown[]) {
    if (!x || typeof x !== 'object') return null
    const r = x as Record<string, unknown>
    if (typeof r.code !== 'string' || typeof r.stencil !== 'string' || !Array.isArray(r.lines)) return null
    const lines: BoxPageLine[] = []
    for (const l of r.lines as unknown[]) {
      const line = readLine(l)
      if (!line) return null
      lines.push(line)
    }
    boxes.push({ code: r.code, stencil: r.stencil, kind: boxPageKind(typeof r.kind === 'string' ? r.kind : ''), place: typeof r.place === 'string' ? r.place : '', where: typeof r.where === 'string' ? r.where : '', lines, thisBox: r.thisBox === true })
  }
  return { ok: true, find: { words: Array.isArray(f.words) ? (f.words as unknown[]).filter((w): w is string => typeof w === 'string') : [], boxes, total: typeof f.total === 'number' ? f.total : boxes.length } }
}
