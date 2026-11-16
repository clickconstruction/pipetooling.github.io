/**
 * The box page (punch list #294, v2.6797): what a scanned cage or box label opens with no sign-in. The label's QR
 * reads `PRTS.CO/B/<eight hex>`, prts.co forwards it to the app's `/b/:code`, and the page asks the `box-read` function
 * for the box by its code. The pure part lives here, shared with the client through `src/lib/materials/boxPage.ts` and
 * tested from `src/lib/materials/boxPage.test.ts`. Deno-free on purpose.
 *
 * **What is inside needs a sign-in (v2.7379, Taunya's call of 2026-11-15).** Until then the answer carried the place,
 * the newest photo, every line with its count, the lines that ran out, the Can't find marks and the day of the last
 * count, and a scanned code opened a search over every box on that site. That is a list of what is worth taking and
 * where, readable from a photo of the label for as long as the box is live, and the counts and the shortages are the
 * company's own business in a pay dispute. The answer is now the name as the label prints it, the kind, the code and
 * the office's number, and nothing else: no place, no line, no count, no photo. A request for the search or a photo
 * is refused with `sign_in` (`boxPageAsksInside`). The crew reads the box in the app, under its own gate.
 * Never the job, the customer, a price or a person's name, as before.
 *
 * Since v2.7072 (punch list #329) a code may be a sticker's: a printed code that points at a box, or at nothing yet.
 * The function reads the sticker first (`boxPageStickerAnswer`). One on a box answers that box's page as a label does;
 * a blank one answers its number and nothing else; a lost one says so. Since v2.7264 the guess lock is read before the
 * sticker (`boxPageEarlyAnswer`): a locked source hears `locked` for every code, a sticker's included.
 */
import { ESTIMATE_LINK_LOCKED_CODE } from './estimateLinkMisses.ts'

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

/** The company's number and its two addresses, as the page's presses use them. `phone` is '' when Settings holds none. */
export type BoxPageOffice = { phone: string; email?: string; bidsEmail?: string }

export type BoxPagePayload = {
  ok: true
  box: {
    code: string
    /** The name as the label prints it (`boxPagePlate`): G81, never the words typed after it. */
    stencil: string
    kind: BoxPageKind
    /** The number of the sticker that was scanned (v2.7072), when the code was a sticker's and not the box's own label. */
    stickerNumber?: number
  }
  /** The company's own number, for *Text the office* (v2.6874): the team box's line since v2.6910 (`boxPageOfficePhone`). Never a person's. */
  /**
   * How to reach the company: its number, and since v2.7405 the company's own email and the address a bid ask goes
   * to. Each is left out when Settings holds none. Null when none of the three is there.
   */
  office: BoxPageOffice | null
}

/**
 * The answers that are not a box: the code is not one, no live box carries it, the box was retired, or the source is locked.
 * Since v2.7072 two more: the code is a sticker that is on no box yet, or a sticker that was marked lost. Since v2.7379
 * one more: the request asked for what is inside, which needs a sign-in.
 */
export type BoxPageRefusal = 'bad_code' | 'not_found' | 'retired' | 'locked' | 'sticker_blank' | 'sticker_lost' | 'sign_in'

/** The 401's `error` when a request asks for what is inside a box (v2.7379). */
export const BOX_PAGE_SIGN_IN_ERROR = 'sign_in'

/**
 * Whether a request asks for what is inside (v2.7379): the search (`?find=`) or a photo's bytes (`?photo=`), the two
 * doors the function had besides the page's own read. Both are refused before anything is read, whatever the code, so
 * the refusal says nothing about whether the code is a box's.
 */
export function boxPageAsksInside(params: { find: string | null; photo: string | null }): boolean {
  return params.find != null || params.photo != null
}

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

/** The container row as the function reads it: its name, its kind and whether it left, and nothing of what it holds. */
export type BoxPageContainerRow = { id: string; label: string; kind: string; retired_at: string | null; code: string }

export function boxPageKind(kind: string): BoxPageKind {
  return kind === 'box' ? 'box' : kind === 'cage' ? 'cage' : 'pile'
}

/** The noun a person reads: Cage, Box, Pile. */
export function boxPageNoun(kind: BoxPageKind, capital = true): string {
  const w = kind === 'pile' ? 'pile' : kind
  return capital ? w[0]!.toUpperCase() + w.slice(1) : w
}

/**
 * The name as its label prints it (v2.7379): the letters and number alone, `G12 COPPER 90` → `G12`. A name from before
 * the name rule can hold what the box holds, and the page says no more than the label on the box does. A name with no
 * letters and number prints whole on its label, so it comes back whole. The same cut as `labelPlate` in
 * `src/lib/materials/labels.ts`; the test holds the two together.
 */
export function boxPagePlate(label: string): string {
  const name = label.trim()
  const m = /^([A-Z]+\d+[A-Z]?)(?=\s|$)/i.exec(name)
  return m ? m[1]!.toUpperCase() : name
}

/** The `app_settings` key of Settings' company block: the company's name, address, Phone and email. */
export const BOX_PAGE_COMPANY_KEY = 'physical_invoice_issuer_v1'

/** One text field of Settings' company block, from the row's stored text. Empty when blank, absent or unreadable. */
function companyBlockField(valueText: string | null | undefined, field: 'phone' | 'email'): string {
  if (!valueText) return ''
  try {
    const o = JSON.parse(valueText) as unknown
    if (!o || typeof o !== 'object') return ''
    const v = (o as Record<string, unknown>)[field]
    return typeof v === 'string' ? v.trim() : ''
  } catch {
    return ''
  }
}

/** The Phone of Settings' company block, from the row's stored text. Empty when the row is blank, absent or unreadable. */
export function boxPageCompanyPhone(valueText: string | null | undefined): string {
  return companyBlockField(valueText, 'phone')
}

/** The Email of Settings' company block (v2.7405), read the same way; empty when it is not an address a mail link can take. */
export function boxPageCompanyEmail(valueText: string | null | undefined): string {
  return boxPageEmail(companyBlockField(valueText, 'email'))
}

/**
 * An address as a `mailto:` link takes it, or '' (v2.7405): one `@`, a dot after it, and none of the characters that
 * would start a second field of the link. The function and the page both read an address through this, so a setting
 * typed wrong draws no press at all.
 */
export function boxPageEmail(value: string | null | undefined): string {
  const v = (value ?? '').trim()
  return /^[^\s@?&#%<>"',;:]+@[^\s@?&#%<>"',;:]+\.[^\s@?&#%<>"',;:]+$/.test(v) ? v : ''
}

/**
 * The number the page shows and its presses text and call: the first of these that is there. The function hands them
 * in order. First the company's number, the Phone of Settings' company block (`boxPageCompanyPhone`), since v2.7390 at
 * Taunya's word of 2026-11-15: the page is the company's card and shows the number the company gives out, whatever
 * Settings holds. Then, when that Phone is blank, the team box's number from Settings → Phone and texts
 * (`messages_boxes_v1`, the page's number from v2.6910 to v2.7390), that box's fallback secret, and the letterhead's
 * constant. Empty when none is there.
 */
export function boxPageOfficePhone(candidates: ReadonlyArray<string | null | undefined>): string {
  for (const c of candidates) {
    const phone = (c ?? '').trim()
    if (phone) return phone
  }
  return ''
}

export function buildBoxPagePayload(input: {
  container: Pick<BoxPageContainerRow, 'label' | 'kind' | 'code'>
  /** The company's own number, as `boxPageOfficePhone` picked it. */
  officePhone?: string | null
  /** The company's own email, the Email of Settings' company block (v2.7405). */
  officeEmail?: string | null
  /** Where a bid ask goes: the bids box's address from Settings → Phone and texts, which the app reads (v2.7405). */
  bidsEmail?: string | null
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
      stencil: boxPagePlate(c.label),
      kind: boxPageKind(c.kind),
      ...(stickerNumber ? { stickerNumber } : {}),
    },
    office: boxPageOfficeOf(phone, input.officeEmail, input.bidsEmail),
  }
}

/** The office as the answer carries it: the number, each address that reads as one, or null when there is nothing. */
function boxPageOfficeOf(phone: string, email: string | null | undefined, bidsEmail: string | null | undefined): BoxPageOffice | null {
  const e = boxPageEmail(email)
  const b = boxPageEmail(bidsEmail)
  if (!phone && !e && !b) return null
  return { phone, ...(e ? { email: e } : {}), ...(b ? { bidsEmail: b } : {}) }
}

/**
 * The function's answer read back on the client; null when it is not the shape. It reads the name, the kind, the code,
 * the sticker's number, the office's number and its two addresses and nothing else, so the page draws the same from a function deployed
 * before v2.7379, whose answer still carries the lines, the place and the photo: they are dropped here, unread.
 */
export function parseBoxPageResponse(body: unknown): BoxPagePayload | null {
  if (!body || typeof body !== 'object') return null
  const b = body as { ok?: unknown; box?: unknown }
  if (b.ok !== true || !b.box || typeof b.box !== 'object') return null
  const x = b.box as Record<string, unknown>
  if (typeof x.code !== 'string' || typeof x.stencil !== 'string') return null
  const o = (body as { office?: unknown }).office
  const office = o && typeof o === 'object' ? (o as { phone?: unknown; email?: unknown; bidsEmail?: unknown }) : {}
  const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  return {
    ok: true,
    box: {
      code: x.code,
      stencil: boxPagePlate(x.stencil),
      kind: boxPageKind(typeof x.kind === 'string' ? x.kind : ''),
      ...(typeof x.stickerNumber === 'number' && x.stickerNumber > 0 ? { stickerNumber: x.stickerNumber } : {}),
    },
    office: boxPageOfficeOf(text(office.phone), text(office.email), text(office.bidsEmail)),
  }
}

/** The 429's words when a source has guessed too often. The page shows them as they are. */
export const BOX_PAGE_LOCKED_WORDS = 'Too many wrong codes from this connection in the last hour. Wait an hour and scan the label again.'

/** An answer the function gives before any box is read: its status, its body and the state its log line carries. */
export type BoxPageEarlyAnswer = { status: number; body: Record<string, unknown>; state: string }

/**
 * What a code is answered before its box is read (v2.7264). The guess lock comes first: a source past the hour's limit
 * hears 429 `locked` whatever the code is — a hit (v2.7240), a miss, a blank sticker or a lost one — so a locked source
 * learns nothing, not even which sticker numbers exist. Then a blank or a lost sticker's own answer. Null: the box is
 * read next, as a label's own code or the box the sticker is on.
 */
export function boxPageEarlyAnswer(locked: boolean, sticker: BoxPageStickerAnswer): BoxPageEarlyAnswer | null {
  if (locked) return { status: 429, body: { error: BOX_PAGE_LOCKED_WORDS, code: ESTIMATE_LINK_LOCKED_CODE }, state: 'locked' }
  if (sticker.kind === 'blank' || sticker.kind === 'lost') return { status: sticker.status, body: sticker.body, state: sticker.body.error }
  return null
}
