// The dev seat's read of a person's correction links (punch list #315, upgrade 1, PR 3; server 0.81.0).
//
// `person_file_amendments` (migration 20261112050000) says which entry or evidence record corrects or completes which.
// People → HR draws the links on the Timeline; this file hands the same links to get_person_file, get_case_brief and
// search_case, through the one kernel (personAmendments.ts), so a line reads as corrected in a session exactly where it
// does on the tab. The links are a source of their own and are read fail-soft: a read that fails is named and takes
// only the links out, never an entry.
//
// Nothing here widens a read. The rows come as the dev under RLS, so the seat is handed a link that touches a
// counsel-only record only while `counsel_only_held_from_seat()` stands open (v2.6986); an end this reader does not
// hold has no day, and its words say so.
import { readAllRows, readRowsByIds, type Reader, type Row } from './devMcpComposites.ts'
import {
  amendmentEnds,
  amendmentIndex,
  amendmentKey,
  amendmentStanding,
  amendmentTable,
  latestWord,
  liveAmendments,
  parseAmendmentKey,
  type AmendmentHow,
  type AmendmentIndex,
  type AmendmentKind,
  type AmendmentStanding,
  type PersonAmendmentRow,
} from './personAmendments.ts'

const SELECT = 'id,from_kind,from_id,to_kind,to_id,how,created_at,withdrawn_at'

/** One end of a link as a seat reply carries it: how, the other thing as `table:id`, its day, and the words the tab's line wears. */
export type SeatAmendmentEnd = { link_id: string; how: AmendmentHow; row: string; day: string | null; words: string }

/** What a line, a record or a search hit gains when a link touches it. Every key is absent when it has nothing to say. */
export type SeatAmendmentBits = {
  /** `corrected` when a later thing corrects this one, `completed` when one only adds to it. */
  standing?: Exclude<AmendmentStanding, null>
  /** The later things that correct or complete this one, oldest first. */
  amended_by?: SeatAmendmentEnd[]
  /** The older things this one corrects or completes. */
  amends?: SeatAmendmentEnd[]
  /** On a corrected thing: the newest correction along the chain, as `table:id`. Read that one before relying on this. */
  latest_word?: string
}

export type PersonAmendmentsRead = {
  rows: PersonAmendmentRow[]
  index: AmendmentIndex
  /** Why the links could not be read, in the database's words; null when they were. */
  heldWhy: string | null
  /** True when the read stopped at readAllRows' own cap. */
  capped: boolean
}

const EMPTY: PersonAmendmentsRead = { rows: [], index: amendmentIndex([]), heldWhy: null, capped: false }

/** Every link on a person's file, a page at a time. Fail-soft: a refused read answers no links and its reason. */
export async function readPersonAmendments(reader: Reader, personId: string): Promise<PersonAmendmentsRead> {
  try {
    const r = await readAllRows(reader, 'person_file_amendments', { select: SELECT, filters: [{ column: 'person_id', op: 'eq', value: personId }] })
    const rows = r.rows as unknown as PersonAmendmentRow[]
    return { rows, index: amendmentIndex(rows), heldWhy: null, capped: r.capped }
  } catch (e) {
    return { ...EMPTY, heldWhy: e instanceof Error ? e.message : String(e) }
  }
}

/** The key a row goes by, from `table:id`'s two halves; null for a table that cannot be amended. */
export function amendmentKeyOfRow(table: string, id: string): string | null {
  if (table === 'person_file_entries') return amendmentKey('hr_entry', id)
  if (table === 'person_file_evidence') return amendmentKey('hr_evidence', id)
  return null
}

/** `kind:id` → `table:id`, the form read_rows answers. */
export function amendmentRowOfKey(key: string): string {
  const p = parseAmendmentKey(key)
  return p ? `${amendmentTable(p.kind)}:${p.id}` : key
}

/** The bits one thing wears. An empty object when no live link touches it, so a reply with no links is what it was. */
export function seatAmendmentBits(key: string | null, index: AmendmentIndex, dayOf: (key: string) => string | null): SeatAmendmentBits {
  if (!key) return {}
  const ends = amendmentEnds(key, index, dayOf)
  if (ends.amendedBy.length === 0 && ends.amends.length === 0) return {}
  const standing = amendmentStanding(key, index)
  const short = (e: (typeof ends.amendedBy)[number]): SeatAmendmentEnd => ({ link_id: e.link_id, how: e.how, row: e.row, day: e.day, words: e.words })
  const latest = standing === 'corrected' ? latestWord(key, index) : key
  return {
    ...(standing ? { standing } : {}),
    ...(ends.amendedBy.length > 0 ? { amended_by: ends.amendedBy.map(short) } : {}),
    ...(ends.amends.length > 0 ? { amends: ends.amends.map(short) } : {}),
    ...(latest !== key ? { latest_word: amendmentRowOfKey(latest) } : {}),
  }
}

/** How many links stand, how many things read as corrected or completed, and how many links were withdrawn. */
export function amendmentCounts(read: PersonAmendmentsRead): { live: number; corrected: number; completed: number; withdrawn: number } {
  let corrected = 0
  let completed = 0
  for (const key of read.index.amendedBy.keys()) {
    const s = amendmentStanding(key, read.index)
    if (s === 'corrected') corrected += 1
    else if (s === 'completed') completed += 1
  }
  return { live: liveAmendments(read.rows).length, corrected, completed, withdrawn: read.rows.filter((r) => r.withdrawn_at).length }
}

/** The note every reply that carries links says once, so a session knows how to read them and how to write one. */
export const AMENDMENTS_NOTE =
  'Correction links (person_file_amendments, punch list #315). A line, record or hit with standing: corrected was corrected by a later one: amended_by names it (row is table:id, day the day it is about) and latest_word is the newest correction along the chain, the one to rely on. standing: completed means a later one adds to it and it still stands. amends is the same link read from the newer thing. Write a link with plan_hr_entry: corrects or completes on a new entry, or amendments: [{ from_id, to_id, how }] between two things already on the file; withdraw_amendments: [{ id, why }] takes a wrong one off. A withdrawn link is not drawn.'

/** The newest links, newest first, each end named by its row and day: what the brief lists. */
export function newestAmendments(read: PersonAmendmentsRead, dayOf: (key: string) => string | null, max: number): Array<{ id: string; how: AmendmentHow; made_at: string; from: { row: string; day: string | null }; to: { row: string; day: string | null } }> {
  const live = liveAmendments(read.rows)
  return live
    .slice(-max)
    .reverse()
    .map((l) => ({ id: l.id, how: l.how, made_at: l.createdAt, from: { row: amendmentRowOfKey(l.from), day: dayOf(l.from) }, to: { row: amendmentRowOfKey(l.to), day: dayOf(l.to) } }))
}

/**
 * The day each end of the links is about, for a reader that does not already hold the entries and records (the
 * search): one read of each table by id. Fail-soft: an end that cannot be read has no day.
 */
export async function amendmentDays(reader: Reader, read: PersonAmendmentsRead, known: ReadonlyMap<string, string | null> = new Map()): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>(known)
  const want: Record<AmendmentKind, Set<string>> = { hr_entry: new Set(), hr_evidence: new Set() }
  for (const l of liveAmendments(read.rows)) {
    for (const key of [l.from, l.to]) {
      if (out.has(key)) continue
      const p = parseAmendmentKey(key)
      if (p) want[p.kind].add(p.id)
    }
  }
  const quiet = async (run: () => Promise<Row[]>): Promise<Row[]> => {
    try {
      return await run()
    } catch {
      return []
    }
  }
  const [entries, records] = await Promise.all([
    want.hr_entry.size > 0 ? quiet(() => readRowsByIds(reader, 'person_file_entries', 'id,entry_date', [...want.hr_entry])) : Promise.resolve([] as Row[]),
    want.hr_evidence.size > 0 ? quiet(() => readRowsByIds(reader, 'person_file_evidence', 'id,dated_on', [...want.hr_evidence])) : Promise.resolve([] as Row[]),
  ])
  for (const e of entries) out.set(amendmentKey('hr_entry', String(e.id)), typeof e.entry_date === 'string' ? e.entry_date : null)
  for (const r of records) out.set(amendmentKey('hr_evidence', String(r.id)), typeof r.dated_on === 'string' ? r.dated_on : null)
  return out
}
