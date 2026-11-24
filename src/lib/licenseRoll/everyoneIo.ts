/**
 * State roll, the Everyone view and the person's sheet (punch list #411, step three): the reads and the writes.
 * Everyone is read a page at a time, scoped to our counties and the chips, never the whole roll at once. The sheet
 * reads one row, its changes and the notes on its number or its name and ZIP. The writes are a note, a note taken
 * back, Leave off (`license_roll_leave_off`) and Put back on the list (a delete of the left-off row).
 *
 * `license_roll_notes` and the press are newer than the generated types, so this reads through an untyped client.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { formatErrorMessage } from '../../utils/errorHandling'
import {
  classesAskedFor,
  EVERYONE_CLASSES,
  EVERYONE_COLUMNS,
  searchWordFilter,
  searchWords,
  statusAskedFor,
  type ChangeRow,
  type EveryoneFilter,
  type EveryoneRow,
  type LeftOffRow,
  type NoteRow,
} from './everyone'

const db = supabase as unknown as SupabaseClient

/** Rows a page. A phone reads fifty at a time, and Show more reads the next fifty. */
export const EVERYONE_PAGE = 50

const NOTE_COLUMNS = 'id, source, license_class, license_number, name_key, body, noted_by, noted_by_name, noted_at'

function failed(error: unknown, what: string): never {
  throw new Error(`Could not ${what}: ${formatErrorMessage(error)}`)
}

/** What the view reads once, before any page: the counties kept, our notes' keys, and the counts on the chips. */
export type EveryoneFrame = {
  counties: string[]
  /** Every note's source and number, to count a row's notes and to find the rows that have one. */
  notes: Pick<NoteRow, 'source' | 'license_number'>[]
  current: number
  lapsed: number
  /** Rows on the roll whose number carries a note. */
  withNotes: number
  leftOff: LeftOffRow[]
}

/** The query every read of Everyone starts from: our counties, the classes it shows. */
function scoped(counties: readonly string[], head = false) {
  return db
    .from('license_roll')
    .select(head ? 'id' : EVERYONE_COLUMNS, head ? { count: 'exact', head: true } : { count: 'exact' })
    .eq('trade', 'plumbing')
    .in('county', [...counties])
    .in('license_class', [...EVERYONE_CLASSES])
}

export async function readEveryoneFrame(): Promise<EveryoneFrame> {
  const [counties, notes, leftOff] = await Promise.all([
    db.from('license_roll_counties').select('county').order('county'),
    db.from('license_roll_notes').select('source, license_number').limit(5000),
    db.from('license_roll_left_off').select('id, license_number, shown_as, note, noted_by_name, noted_at').order('noted_at', { ascending: false }).limit(200),
  ])
  if (counties.error) failed(counties.error, 'read the counties')
  if (notes.error) failed(notes.error, 'read our notes')
  if (leftOff.error) failed(leftOff.error, 'read who is left off')
  const countyList = ((counties.data ?? []) as { county: string }[]).map((c) => c.county)
  const noteRows = (notes.data ?? []) as Pick<NoteRow, 'source' | 'license_number'>[]
  const numbers = [...new Set(noteRows.map((n) => n.license_number))]
  const [current, lapsed, withNotes] = await Promise.all([
    scoped(countyList, true).eq('status', 'current'),
    scoped(countyList, true).eq('status', 'expired'),
    numbers.length > 0 ? scoped(countyList, true).in('license_number', numbers) : Promise.resolve({ count: 0, error: null }),
  ])
  if (current.error) failed(current.error, 'count the roll')
  if (lapsed.error) failed(lapsed.error, 'count the roll')
  if (withNotes.error) failed(withNotes.error, 'count the roll')
  return {
    counties: countyList,
    notes: noteRows,
    current: current.count ?? 0,
    lapsed: lapsed.count ?? 0,
    withNotes: withNotes.count ?? 0,
    leftOff: (leftOff.data ?? []) as LeftOffRow[],
  }
}

/** One page of Everyone under the chips and the search, with how many match in all. */
export async function readEveryonePage(input: {
  counties: readonly string[]
  filter: EveryoneFilter
  search: string
  notedNumbers: readonly string[]
  page: number
}): Promise<{ rows: EveryoneRow[]; total: number }> {
  const { counties, filter, search, notedNumbers, page } = input
  if (counties.length === 0) return { rows: [], total: 0 }
  if (filter.hasNotes && notedNumbers.length === 0) return { rows: [], total: 0 }
  let q = scoped(counties).in('license_class', classesAskedFor(filter))
  const status = statusAskedFor(filter)
  if (status) q = q.eq('status', status)
  if (filter.medicalGas) q = q.contains('endorsements', ['medical_gas'])
  if (filter.hasNotes) q = q.in('license_number', [...notedNumbers])
  for (const word of searchWords(search)) q = q.or(searchWordFilter(word))
  const from = page * EVERYONE_PAGE
  const { data, count, error } = await q
    .order('last_name')
    .order('first_name')
    .order('license_number')
    .range(from, from + EVERYONE_PAGE - 1)
  if (error) failed(error, 'read the roll')
  return { rows: (data ?? []) as unknown as EveryoneRow[], total: count ?? 0 }
}

/** What the sheet draws for one person. `row` is null when the row is no longer on the roll. */
export type SheetRead = { row: EveryoneRow | null; changes: ChangeRow[]; notes: NoteRow[]; firstPullDay: string | null }

export async function readPersonSheet(rollId: string): Promise<SheetRead> {
  const [rowRes, changes, firstPull] = await Promise.all([
    db.from('license_roll').select(EVERYONE_COLUMNS).eq('id', rollId).maybeSingle(),
    db.from('license_roll_changes').select('id, seen_on, kind, was, now_is').eq('roll_id', rollId).order('seen_on', { ascending: false }).limit(200),
    db.from('license_roll_pulls').select('started_at').order('started_at', { ascending: true }).limit(1),
  ])
  if (rowRes.error) failed(rowRes.error, 'read the person')
  if (changes.error) failed(changes.error, 'read what changed')
  if (firstPull.error) failed(firstPull.error, 'read the first pull')
  const row = (rowRes.data ?? null) as unknown as EveryoneRow | null
  const firstStarted = ((firstPull.data ?? []) as { started_at: string }[])[0]?.started_at ?? null
  const firstPullDay = firstStarted ? firstStarted.slice(0, 10) : null
  if (!row) return { row: null, changes: [], notes: [], firstPullDay }
  return { row, changes: (changes.data ?? []) as ChangeRow[], notes: await readNotesFor(row), firstPullDay }
}

/** The notes on a row's number, and on any number under the same name and ZIP. Two reads, merged by the kernel. */
export async function readNotesFor(row: Pick<EveryoneRow, 'source' | 'license_number' | 'name_key'>): Promise<NoteRow[]> {
  const [byNumber, byName] = await Promise.all([
    db.from('license_roll_notes').select(NOTE_COLUMNS).eq('source', row.source).eq('license_number', row.license_number).order('noted_at', { ascending: false }).limit(200),
    row.name_key ? db.from('license_roll_notes').select(NOTE_COLUMNS).eq('name_key', row.name_key).order('noted_at', { ascending: false }).limit(200) : Promise.resolve({ data: [], error: null }),
  ])
  if (byNumber.error) failed(byNumber.error, 'read our notes')
  if (byName.error) failed(byName.error, 'read our notes')
  return [...((byNumber.data ?? []) as NoteRow[]), ...((byName.data ?? []) as NoteRow[])]
}

/** A note written on a row. Who and when are the server's. */
export async function addRollNote(row: Pick<EveryoneRow, 'source' | 'license_class' | 'license_number' | 'name_key'>, body: string): Promise<void> {
  const { error } = await db.from('license_roll_notes').insert({ source: row.source, license_class: row.license_class, license_number: row.license_number, name_key: row.name_key, body })
  if (error) failed(error, 'keep the note')
}

/** A note taken back by the person who wrote it. Row security lets only the author's delete land. */
export async function deleteRollNote(noteId: string): Promise<void> {
  const { data, error } = await db.from('license_roll_notes').delete().eq('id', noteId).select('id')
  if (error) failed(error, 'delete the note')
  if (!data || data.length === 0) throw new Error('Could not delete the note: only the person who wrote it can.')
}

export type LeaveOffOutcome = { leftOffId: string; takenOff: number; shownAs: string }

/** Leave off: the person's left-off row, and their rows off the roll at once. */
export async function leaveOffRoll(rollId: string, note: string): Promise<LeaveOffOutcome> {
  const { data, error } = await db.rpc('license_roll_leave_off', { p_roll_id: rollId, p_note: note })
  if (error) failed(error, 'leave them off')
  const out = (data ?? {}) as { left_off_id?: string; taken_off?: number; shown_as?: string }
  return { leftOffId: out.left_off_id ?? '', takenOff: out.taken_off ?? 0, shownAs: out.shown_as ?? '' }
}

/** Put back on the list: the left-off row goes, and the next pull keeps the person again. */
export async function putBackOnRoll(leftOffId: string): Promise<void> {
  const { data, error } = await db.from('license_roll_left_off').delete().eq('id', leftOffId).select('id')
  if (error) failed(error, 'put them back')
  if (!data || data.length === 0) throw new Error('Could not put them back: the row was not removed.')
}
