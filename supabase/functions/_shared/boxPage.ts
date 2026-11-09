/**
 * The box page (punch list #294, v2.6797): what a scanned cage or box label opens with no sign-in. The label's QR
 * reads `PRTS.CO/B/<eight hex>`, prts.co forwards it to the app's `/b/:code`, and the page asks the `box-read` function
 * for the box by its code: the stencil, the place, the newest photo, the lines with their counts and the day of the last
 * count. Never the job, the customer, a price or a person's name. The pure part lives here, shared with the client
 * through `src/lib/materials/boxPage.ts` and tested from `src/lib/materials/boxPage.test.ts`. Deno-free on purpose.
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

export type BoxPageLine = { partName: string; manufacturer: string | null; onHand: number }

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
    /** The app calendar's day of the last count in this box, or null when never counted. */
    lastCountedOn: string | null
    photo: BoxPagePhoto | null
  }
}

/** The answers that are not a box: the code is not one, no live box carries it, the box was retired, or the source is locked. */
export type BoxPageRefusal = 'bad_code' | 'not_found' | 'retired' | 'locked'

/** The container row as the function reads it. */
export type BoxPageContainerRow = { id: string; job_id: string; label: string; kind: string; where_note: string | null; place_id: string | null; retired_at: string | null; code: string }

/** A line of `on_site_job_summary`'s answer, the part the page needs. */
export type BoxPageServerLine = { container_id: string; part_name: string; manufacturer: string | null; on_hand: number }

export function boxPageKind(kind: string): BoxPageKind {
  return kind === 'box' ? 'box' : kind === 'cage' ? 'cage' : 'pile'
}

/** The noun a person reads: Cage, Box, Pile. */
export function boxPageNoun(kind: BoxPageKind, capital = true): string {
  const w = kind === 'pile' ? 'pile' : kind
  return capital ? w[0]!.toUpperCase() + w.slice(1) : w
}

/** The lines of one container with something on hand, in name order. */
export function boxPageLines(lines: ReadonlyArray<BoxPageServerLine>, containerId: string): BoxPageLine[] {
  return lines
    .filter((l) => l.container_id === containerId && l.on_hand > 0)
    .map((l) => ({ partName: l.part_name, manufacturer: l.manufacturer, onHand: l.on_hand }))
    .sort((a, b) => a.partName.localeCompare(b.partName))
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
}): BoxPagePayload {
  const c = input.container
  return {
    ok: true,
    box: {
      code: c.code,
      stencil: c.label,
      kind: boxPageKind(c.kind),
      place: input.place,
      where: (c.where_note ?? '').trim(),
      lines: boxPageLines(input.lines, c.id),
      lastCountedOn: input.lastCountedOn,
      photo: input.photo,
    },
  }
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
    if (!l || typeof l !== 'object') return null
    const r = l as Record<string, unknown>
    if (typeof r.partName !== 'string' || typeof r.onHand !== 'number') return null
    lines.push({ partName: r.partName, manufacturer: typeof r.manufacturer === 'string' ? r.manufacturer : null, onHand: r.onHand })
  }
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
      lastCountedOn: typeof x.lastCountedOn === 'string' ? x.lastCountedOn : null,
      photo,
    },
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
      const q = (l ?? {}) as Record<string, unknown>
      if (typeof q.partName !== 'string' || typeof q.onHand !== 'number') return null
      lines.push({ partName: q.partName, manufacturer: typeof q.manufacturer === 'string' ? q.manufacturer : null, onHand: q.onHand })
    }
    boxes.push({ code: r.code, stencil: r.stencil, kind: boxPageKind(typeof r.kind === 'string' ? r.kind : ''), place: typeof r.place === 'string' ? r.place : '', where: typeof r.where === 'string' ? r.where : '', lines, thisBox: r.thisBox === true })
  }
  return { ok: true, find: { words: Array.isArray(f.words) ? (f.words as unknown[]).filter((w): w is string => typeof w === 'string') : [], boxes, total: typeof f.total === 'number' ? f.total : boxes.length } }
}
