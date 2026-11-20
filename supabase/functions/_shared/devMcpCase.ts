// The dev seat's half of the rows the system numbers (punch list #315, upgrade 2, PR 3; server 0.118.0). The database
// hands out an evidence record's exhibit number and a case item's number (migration 20261113080000), and until now the
// seat read neither: a session learned a record's number from People → HR, and an item was a line of prose in the
// file's Agent notes. Three things live here, all pure, over the tab's own kernel (personCase.ts):
//
//   · plan_case → apply_case's input, shaped into dev_case_write's payload. The door numbers a new item, carries one
//     over with the number it already goes by, refuses a number that is taken and writes a log line for every change.
//     Its dry run performs the write and unwinds it, so the plan names the number an item would take, and the reply
//     holds no clock and no id the run made: a plan and its apply hash alike.
//   · The brief's two blocks: open_items (the open ones whole by number, the newest closed ones) and log (the count
//     and the newest lines).
//   · The words a number is said in: what plan_person_evidence's reply says the record would take, and what the
//     apply's reply says it took.
//
// No app import and nothing that runs at load, so dev-mcp and its tests read one implementation.
import { cutText } from './devMcpReplyFit.ts'
import { CASE_LINE_MAX, CASE_TITLE_MAX, CASE_WHY_MAX, caseItemCounts, caseLogNewestFirst, caseStandingWords, caseWritePayload, exhibitLabel, sortCaseItems, type CaseItemChange, type PersonCaseItem, type PersonCaseLogLine } from './personCase.ts'

type Json = Record<string, unknown>
const obj = (v: unknown): Json | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type CaseVerb = 'plan_case' | 'apply_case'
export function isCaseVerb(verb: string): verb is CaseVerb {
  return verb === 'plan_case' || verb === 'apply_case'
}

/** dev_case_write's own limits (migration 20261113080000), said here so a refusal comes in words before the ask leaves. */
export const CASE_CHANGES_MAX = 50
export const CASE_LOG_LINES_MAX = 50
export const CASE_DETAIL_MAX = 4000
export const CASE_OWNER_MAX = 120
export const CASE_SESSION_MAX = 120
const ITEM_NO_MAX = 999999

/** The shape, as the refusal says it. */
export function caseShape(verb: CaseVerb): string {
  return `${verb} needs case — { person_id (the roster row's people.id, as get_case_brief and get_person_file answer it in person.id; find_person answers a login's users.id, which this door refuses), session? (the name this session goes by, under ${CASE_SESSION_MAX}), items?: [ { add: { title (1 to ${CASE_TITLE_MAX}), detail? (under ${CASE_DETAIL_MAX}), owner? (who has it, under ${CASE_OWNER_MAX}), item_no? (only for an item people already call by a number) } } | { item_no, set: { title?, detail?, owner? } } | { item_no, close: { why (1 to ${CASE_WHY_MAX}), state?: done | dropped (done when left out) } } | { item_no, reopen: true } ], log?: [ "a line" | { line (1 to ${CASE_LINE_MAX}), item_no? } ] }; at least one item change or log line, at most ${CASE_CHANGES_MAX} changes and ${CASE_LOG_LINES_MAX} lines a call. get_case_brief's open_items lists the items by number.`
}

const isItemNo = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= ITEM_NO_MAX
const text = (v: unknown): string | null => (typeof v === 'string' ? v : null)

/** One change as the door takes it, or why it cannot be read. Exactly one of add, set, close, reopen. */
function caseChange(raw: unknown, at: number): { ok: true; change: CaseItemChange } | { ok: false; why: string } {
  const x = obj(raw)
  const where = `items[${at}]`
  if (!x) return { ok: false, why: `${where} is not an object` }
  const ops = (['add', 'set', 'close', 'reopen'] as const).filter((k) => k in x)
  if (ops.length !== 1) return { ok: false, why: `${where} names ${ops.length === 0 ? 'none' : ops.join(' and ')} of add, set, close, reopen: one change is exactly one of them` }
  const op = ops[0]!
  if (op === 'add') {
    const add = obj(x.add)
    const title = (text(add?.title) ?? '').trim()
    if (!add || title.length < 1 || title.length > CASE_TITLE_MAX) return { ok: false, why: `${where}.add needs a title of 1 to ${CASE_TITLE_MAX} characters` }
    if ('item_no' in x) return { ok: false, why: `${where}: a new item's number goes inside add (add.item_no), and only for an item people already call by one` }
    const out: { title: string; detail?: string; owner?: string; item_no?: number } = { title }
    if (add.detail !== undefined && add.detail !== null) {
      const detail = text(add.detail)
      if (detail === null || detail.length > CASE_DETAIL_MAX) return { ok: false, why: `${where}.add.detail is words, under ${CASE_DETAIL_MAX} characters` }
      if (detail.trim()) out.detail = detail
    }
    if (add.owner !== undefined && add.owner !== null) {
      const owner = text(add.owner)?.trim() ?? null
      if (owner === null || owner.length > CASE_OWNER_MAX) return { ok: false, why: `${where}.add.owner is a name, under ${CASE_OWNER_MAX} characters` }
      if (owner) out.owner = owner
    }
    if (add.item_no !== undefined && add.item_no !== null) {
      if (!isItemNo(add.item_no)) return { ok: false, why: `${where}.add.item_no is a whole number from 1` }
      out.item_no = add.item_no
    }
    return { ok: true, change: { add: out } }
  }
  if (!isItemNo(x.item_no)) return { ok: false, why: `${where} names its item by item_no, a whole number from 1` }
  const itemNo = x.item_no
  if (op === 'set') {
    const set = obj(x.set)
    if (!set || !('title' in set || 'detail' in set || 'owner' in set)) return { ok: false, why: `${where}.set names a title, a detail or an owner` }
    const out: { title?: string; detail?: string; owner?: string } = {}
    if ('title' in set) {
      const title = (text(set.title) ?? '').trim()
      if (title.length < 1 || title.length > CASE_TITLE_MAX) return { ok: false, why: `${where}.set.title is 1 to ${CASE_TITLE_MAX} characters` }
      out.title = title
    }
    if ('detail' in set) {
      // An empty detail clears it, so '' is a value here and not a missing key.
      const detail = text(set.detail)
      if (detail === null || detail.length > CASE_DETAIL_MAX) return { ok: false, why: `${where}.set.detail is words, under ${CASE_DETAIL_MAX} characters ('' clears it)` }
      out.detail = detail
    }
    if ('owner' in set) {
      const owner = text(set.owner)?.trim() ?? null
      if (owner === null || owner.length > CASE_OWNER_MAX) return { ok: false, why: `${where}.set.owner is a name, under ${CASE_OWNER_MAX} characters ('' for nobody)` }
      out.owner = owner
    }
    return { ok: true, change: { item_no: itemNo, set: out } }
  }
  if (op === 'close') {
    const close = obj(x.close)
    const why = (text(close?.why) ?? '').trim()
    if (!close || why.length < 1 || why.length > CASE_WHY_MAX) return { ok: false, why: `${where}.close needs why, 1 to ${CASE_WHY_MAX} characters` }
    const state = close.state === undefined || close.state === null ? 'done' : close.state
    if (state !== 'done' && state !== 'dropped') return { ok: false, why: `${where}.close.state is done or dropped` }
    return { ok: true, change: { item_no: itemNo, close: { why, state } } }
  }
  if (x.reopen !== true) return { ok: false, why: `${where}.reopen is true` }
  return { ok: true, change: { item_no: itemNo, reopen: true } }
}

function caseLogLine(raw: unknown, at: number): { ok: true; line: string | { line: string; item_no: number } } | { ok: false; why: string } {
  const where = `log[${at}]`
  const lineOf = (v: unknown): string | null => {
    const line = (text(v) ?? '').trim()
    return line.length >= 1 && line.length <= CASE_LINE_MAX ? line : null
  }
  if (typeof raw === 'string') {
    const line = lineOf(raw)
    return line ? { ok: true, line } : { ok: false, why: `${where} is 1 to ${CASE_LINE_MAX} characters` }
  }
  const x = obj(raw)
  if (!x) return { ok: false, why: `${where} is words, or { line, item_no? }` }
  const line = lineOf(x.line)
  if (!line) return { ok: false, why: `${where}.line is 1 to ${CASE_LINE_MAX} characters` }
  if (x.item_no === undefined || x.item_no === null) return { ok: true, line }
  if (!isItemNo(x.item_no)) return { ok: false, why: `${where}.item_no is a whole number from 1` }
  return { ok: true, line: { line, item_no: x.item_no } }
}

/**
 * plan_case / apply_case's input as dev_case_write's `p`. Every string is trimmed the way the door trims it, so the
 * payload that is hashed is the payload that is written, and a value the door would cut short (an owner or a session
 * past 120 characters) is refused here in words instead.
 */
export function caseInput(verb: CaseVerb, input: Json): { ok: true; p: Json; target: string; changes: number; lines: number } | { ok: false; error: string } {
  const shape = caseShape(verb)
  const c = obj(input.case)
  const personId = (text(c?.person_id) ?? '').trim().toLowerCase()
  if (!c || !UUID_RE.test(personId)) return { ok: false, error: shape }
  const refuse = (why: string) => ({ ok: false as const, error: `${verb}: ${why}. ${shape}` })
  let session: string | null = null
  if (c.session !== undefined && c.session !== null) {
    const s = text(c.session)?.trim() ?? null
    if (s === null || s.length > CASE_SESSION_MAX) return refuse(`session is a name, under ${CASE_SESSION_MAX} characters`)
    session = s || null
  }
  const itemsIn = c.items === undefined || c.items === null ? [] : c.items
  const logIn = c.log === undefined || c.log === null ? [] : c.log
  if (!Array.isArray(itemsIn) || !Array.isArray(logIn)) return refuse('items and log are lists')
  if (itemsIn.length === 0 && logIn.length === 0) return refuse('nothing to write: name an item change or a log line')
  if (itemsIn.length > CASE_CHANGES_MAX || logIn.length > CASE_LOG_LINES_MAX) return refuse(`at most ${CASE_CHANGES_MAX} item changes and ${CASE_LOG_LINES_MAX} log lines a call`)
  const items: CaseItemChange[] = []
  for (let i = 0; i < itemsIn.length; i++) {
    const built = caseChange(itemsIn[i], i)
    if (!built.ok) return refuse(built.why)
    items.push(built.change)
  }
  // Two new items given one number, in one call: the door would refuse the second, here it is said before the ask leaves.
  const given = items.flatMap((ch) => ('add' in ch && ch.add.item_no !== undefined ? [ch.add.item_no] : []))
  const twice = given.find((n, at) => given.indexOf(n) !== at)
  if (twice !== undefined) return refuse(`two new items are given the number ${twice}`)
  const log: Array<string | { line: string; item_no: number }> = []
  for (let i = 0; i < logIn.length; i++) {
    const built = caseLogLine(logIn[i], i)
    if (!built.ok) return refuse(built.why)
    log.push(built.line)
  }
  return { ok: true, p: caseWritePayload({ personId, session, items, log }), target: personId, changes: items.length, lines: log.length }
}

/**
 * A case call as the call log keeps it: the person, the session, each change by its kind and its number, and how many
 * log lines, never a title, a detail, a reason or a line. An item's words belong on the case, not in a second table,
 * and a call of fifty changes would pass the log's 4,000 characters and lose the plan_hash the one-apply rule reads.
 */
export function caseArgsForLog(verb: string, args: Json): Json {
  const c = obj(args.case)
  const items = Array.isArray(c?.items) ? c.items : []
  const log = Array.isArray(c?.log) ? c.log : []
  const brief = (raw: unknown): Json => {
    const x = obj(raw)
    const op = x ? (['add', 'set', 'close', 'reopen'] as const).find((k) => k in x) ?? null : null
    const add = op === 'add' ? obj(x?.add) : null
    const no = op === 'add' ? add?.item_no : x?.item_no
    return { op, ...(isItemNo(no) ? { item_no: no } : {}) }
  }
  return {
    case: c ? { person_id: typeof c.person_id === 'string' ? c.person_id : null, session: typeof c.session === 'string' ? c.session.slice(0, CASE_SESSION_MAX) : null, items: items.slice(0, CASE_CHANGES_MAX).map(brief), log_lines: log.length } : null,
    ...(verb === 'apply_case' ? { plan_hash: typeof args.plan_hash === 'string' ? args.plan_hash.trim().toLowerCase() : args.plan_hash ?? null } : {}),
  }
}

// ── the brief's two blocks ─────────────────────────────────────────────────────────────────────────

/** The columns the brief reads of an item and of a log line. */
export const CASE_ITEM_SELECT = 'id,item_no,title,detail,owner_label,state,opened_at,closed_at,closed_why,author_label,session_label'
export const CASE_LOG_SELECT = 'id,logged_at,line,item_no,author_label,session_label'
export type CaseItemRead = Pick<PersonCaseItem, 'item_no' | 'title' | 'detail' | 'owner_label' | 'state' | 'opened_at' | 'closed_at' | 'closed_why' | 'author_label' | 'session_label'>
export type CaseLogRead = Pick<PersonCaseLogLine, 'logged_at' | 'line' | 'item_no' | 'author_label' | 'session_label'>

/** How much of an open item's detail the brief carries, how many closed items and how many log lines. */
export const BRIEF_CASE_DETAIL_CHARS = 200
export const BRIEF_CASE_CLOSED = 5
export const BRIEF_CASE_LOG_LINES = 10

/**
 * What the brief's manifest says of the two blocks, on its case_items part: how to cite an item, how to read the rest,
 * and the pair that writes both. Said once there, so the blocks themselves carry no note and a large file's brief
 * grows by the rows alone.
 */
export const CASE_BLOCKS_OPEN =
  'open_items and log here: the open items by number (cite one as Item N; detail_more counts the detail left out) and the log\'s newest lines; read_rows on person_case_items and person_case_log, person_id eq, reads the rest; plan_case → apply_case changes them, and the file numbers a new item'

/** The dials a fit step turns on the items block: how much detail each open item keeps, and how many open items. */
export type CaseItemsDial = { detailChars: number; openMax: number | null }
export const CASE_ITEMS_WHOLE: CaseItemsDial = { detailChars: BRIEF_CASE_DETAIL_CHARS, openMax: null }

export function briefOpenItems(rows: ReadonlyArray<CaseItemRead>, dial: CaseItemsDial = CASE_ITEMS_WHOLE) {
  const { open, closed } = sortCaseItems(rows)
  const counts = caseItemCounts(rows)
  return {
    counts,
    standing: caseStandingWords(counts),
    items: (dial.openMax == null ? open : open.slice(0, dial.openMax)).map((i) => {
      const detail = i.detail ?? ''
      const cut = dial.detailChars > 0 ? cutText(detail, dial.detailChars) : { text: '', more: detail.length }
      return {
        item_no: i.item_no,
        title: i.title,
        with: (i.owner_label ?? '').trim() || null,
        opened_at: i.opened_at,
        ...(cut.text ? { detail: cut.text } : {}),
        ...(cut.more > 0 ? { detail_more: cut.more } : {}),
        by: i.author_label ?? '',
        ...(i.session_label ? { session: i.session_label } : {}),
      }
    }),
    closed_newest: closed.slice(0, BRIEF_CASE_CLOSED).map((i) => ({ item_no: i.item_no, title: i.title, state: i.state, closed_at: i.closed_at, why: i.closed_why ?? '' })),
  }
}

export function briefCaseLog(newest: ReadonlyArray<CaseLogRead>, count: number | null, max: number = BRIEF_CASE_LOG_LINES) {
  return {
    count,
    newest: caseLogNewestFirst(newest)
      .slice(0, max)
      .map((l) => ({ at: l.logged_at, line: l.line, ...(l.item_no != null ? { item_no: l.item_no } : {}), by: l.author_label ?? '', ...(l.session_label ? { session: l.session_label } : {}) })),
  }
}

// ── an exhibit number, in words ────────────────────────────────────────────────────────────────────

/** What an evidence record's Timeline line gains: the record's number, when the file has given it one. */
export type SeatExhibitBits = { exhibit_no?: number }

/** An evidence record's number on the file, off its row; null before the file has given it one. */
export function exhibitNoOf(row: { exhibit_no?: unknown } | null | undefined): number | null {
  const n = row?.exhibit_no
  return typeof n === 'number' && Number.isInteger(n) && n >= 1 ? n : null
}

/**
 * The key an evidence record carries wherever the seat reads one, once the file has numbered it. A record with no
 * number carries no key: a large file's index stays as short as it was, and the manifest counts how many are numbered.
 */
export function exhibitBits(row: { exhibit_no?: unknown } | null | undefined): SeatExhibitBits {
  const n = exhibitNoOf(row)
  return n === null ? {} : { exhibit_no: n }
}

export const EXHIBIT_NOTE =
  'exhibit_no is the number the file gave an evidence record, never reused: cite the record as Ev #N. A record without the key was kept before the file numbered them (2026-11-13), and its title wears its number as typed; numbering those is the owner\'s press, a person at a time.'

/** What plan_person_evidence's reply says of the number: read, never taken. Outside the plan hash. */
export function exhibitPlanWords(next: number | null): Json {
  if (next === null) return { would_take: null, note: 'The file numbers the record at the write; the number it would take could not be read just now. The apply\'s reply names the number it took.' }
  return {
    would_take: next,
    label: exhibitLabel(next),
    note: `The file numbers the record at the write: it would take ${exhibitLabel(next)}. Leave the number out of the title, where it would only be said twice. A record kept on this person before your apply takes this number first, and refuses the apply: plan again and read the number again.`,
  }
}

/** What apply_person_evidence's reply says of the number the record took. */
export function exhibitAppliedWords(no: number | null): Json {
  if (no === null) return { exhibit_no: null, exhibit_note: 'The record is kept; its number could not be read back just now. get_person_file lists the record with its exhibit_no.' }
  return { exhibit_no: no, exhibit: exhibitLabel(no) }
}
