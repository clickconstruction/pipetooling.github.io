// A note on a job's Activity or a bid's notes from the dev seat (v2.6822 / 0.54.0). The owner, 2026-11-09, on the
// submittal verbs: an agent that loads submittal entries should be able to "let others know their status". The seat
// reads status back in the conversation (get_submittals); this pair leaves the word where the team reads it in the
// app — a line in a job's Job activity / notes (jobs_ledger_thread_notes, the row the Pipeline's Note press and
// useJobThreadNotes write) or a note on a bid (bids_submission_entries with notes and no contact method, the row the
// Bid Board's Notes popover writes). No RPC exists for either and none is owed: the app writes the rows under RLS, so
// the seat does too, as the dev — the dry run is this server's own read of the job or the bid and the latest lines
// already on it, hashed with the payload; apply reads again and writes only when the hash still matches. It tells
// nobody: no email, text or push goes out; the feed shows the line to whoever opens the job or the bid. Pure: no env
// reads, no network; the reads come in through the Reader so the tests run over a fake
// (src/lib/devMcp/devMcpActivityNote.test.ts).
//
// The hash covers what the caller decided and the thread as the plan read it, never the moment of the dry run
// (v2.6948): a note with no `on` is stamped when the apply writes it, so the plan's row leaves that column out and
// names it under `stamped_at_apply`. Before, a bid note's planned row carried the dry run's own clock in
// `occurred_at`, the apply's second dry run read a later clock, and no undated bid note could ever be applied.

import { findBid, findJob, resolve, type Reader, type Row } from './devMcpComposites.ts'
import type { RowFilter } from './devMcpDoor.ts'
import { formatBidLedgerNumberLabel, formatJobLedgerNumberLabel } from './ledgerDisplayPrefixes.ts'
import { calendarYmdInAppTzFromIso } from './appTimeZone.ts'

export const ACTIVITY_NOTE_VERBS = ['plan_activity_note', 'apply_activity_note'] as const
export type ActivityNoteVerb = (typeof ACTIVITY_NOTE_VERBS)[number]

export function isActivityNoteVerb(name: string): name is ActivityNoteVerb {
  return (ACTIVITY_NOTE_VERBS as readonly string[]).includes(name)
}

/** The longest note the seat writes; the Bid Board's own cap on a note is 8,000 (the twin's add_bid_note). */
export const ACTIVITY_NOTE_MAX = 4000
/** How many of the latest lines the plan shows (and commits to). */
export const ACTIVITY_NOTE_LATEST = 3
/** Bid entries read before the ones with words are kept. */
const ENTRIES_READ = 12

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/
const REF_MAX = 200

export type Json = Record<string, unknown>
const obj = (v: unknown): Json | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null)
const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v))
const strOrNull = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null)

export type ActivityNotePayload = {
  action: 'note'
  /** Where it lands: a job's thread or a bid's notes. */
  on: 'job' | 'bid'
  /** An id, or text that finds exactly one job or bid. */
  ref: string
  text: string
  /** The day it is about, when not today (YYYY-MM-DD, never ahead of today); the row is stamped at noon that day. */
  on_day?: string
  /** A bid note about one GC on the bid (a customers.id); left out, the bid's own note. */
  gc_customer_id?: string
}

export type ActivityNoteInput = { ok: true; p: ActivityNotePayload; target: string; planHash: string | null } | { ok: false; error: string }

const SHAPE = `needs note — { job (an id, or text that finds one job — find_job) OR bid (an id, or text that finds one bid — find_bid), text (the note, under ${ACTIVITY_NOTE_MAX} characters), on? (YYYY-MM-DD, the day it is about when not today, never ahead), gc_customer_id? (a bid note about one GC on the bid, a customers.id; left out, the bid's own note) }.`

/** A real calendar day, YYYY-MM-DD. */
export function realDay(ymd: string): boolean {
  if (!YMD_RE.test(ymd)) return false
  const d = new Date(`${ymd}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === ymd
}

/**
 * plan_activity_note / apply_activity_note's input, shaped: exactly one of job or bid, the text trimmed and capped,
 * the day a real one, the GC an id. apply_ must quote a 64-hex plan_hash.
 */
export function activityNoteInput(verb: ActivityNoteVerb, input: Json): ActivityNoteInput {
  const shape = `${verb} ${SHAPE}`
  const src = obj(input.note)
  if (!src) return { ok: false, error: shape }
  const s = (k: string) => (typeof src[k] === 'string' ? (src[k] as string).trim() : '')
  const job = s('job')
  const bid = s('bid')
  if ((job && bid) || (!job && !bid)) return { ok: false, error: `${verb}: name one of job or bid, not both and not neither. ${SHAPE}` }
  const ref = job || bid
  if (ref.length > REF_MAX) return { ok: false, error: shape }
  const text = s('text').replace(/\r\n/g, '\n')
  if (!text) return { ok: false, error: `${verb}: text is the note itself; it is empty. ${SHAPE}` }
  if (text.length > ACTIVITY_NOTE_MAX) return { ok: false, error: `${verb}: text is ${text.length} characters; the most is ${ACTIVITY_NOTE_MAX}.` }
  const p: ActivityNotePayload = { action: 'note', on: job ? 'job' : 'bid', ref, text }
  const day = s('on')
  if (day) {
    if (!realDay(day)) return { ok: false, error: `${verb}: on is a day, YYYY-MM-DD; "${day}" is not one.` }
    p.on_day = day
  }
  const gc = s('gc_customer_id')
  if (gc) {
    if (!UUID_RE.test(gc)) return { ok: false, error: `${verb}: gc_customer_id is a customers.id (find_customer resolves a name).` }
    if (p.on !== 'bid') return { ok: false, error: `${verb}: gc_customer_id goes with a bid note; a job's thread has no GC lane.` }
    p.gc_customer_id = gc.toLowerCase()
  }
  let planHash: string | null = null
  if (verb === 'apply_activity_note') {
    const h = typeof input.plan_hash === 'string' ? input.plan_hash.trim().toLowerCase() : ''
    if (!/^[0-9a-f]{64}$/.test(h)) return { ok: false, error: `${verb} needs plan_hash — the 64-hex value plan_activity_note replied with.` }
    planHash = h
  }
  return { ok: true, p, target: ref, planHash }
}

// ── the world the plan reads ─────────────────────────────────────────────────────────────────────────────────────

export type LatestLine = { id: string; at: string; by: string | null; text: string }

export type ActivityNoteWorld =
  | {
      on: 'job'
      job: { id: string; label: string; name: string; status: string | null; customer: string | null }
      gc: null
      latest: LatestLine[]
    }
  | {
      on: 'bid'
      bid: { id: string; label: string; projectName: string; outcome: string | null }
      gc: { id: string; name: string | null } | null
      latest: LatestLine[]
    }

const by = (column: string, value: string): RowFilter[] => [{ column, op: 'eq', value }]

/**
 * The job or the bid the note lands on and the latest lines already there, as the dev reads them. `ref` is an id or
 * text that finds exactly one. Throws on a refused read; answers `{ refused }` in words when nothing is found.
 */
export async function readActivityNoteWorld(reader: Reader, p: ActivityNotePayload): Promise<ActivityNoteWorld | { refused: string }> {
  const prefixRows = await reader.rows('service_types', { select: 'id,ledger_job_prefix,ledger_bid_prefix', limit: 200 })
  const prefixOf = (serviceTypeId: unknown) => prefixRows.find((r) => str(r.id) === str(serviceTypeId))
  if (p.on === 'job') {
    const resolved = await resolve(p.ref, () => findJob(reader, p.ref) as Promise<{ matches: Row[] }>, 'job')
    if ('refused' in resolved) return resolved
    const id = resolved.id
    const [jobRows, noteRows] = await Promise.all([
      reader.rows('jobs_ledger', { select: 'id,hcp_number,click_number,job_name,status,customer_name,service_type_id', filters: by('id', id), limit: 1 }),
      reader.rows('jobs_ledger_thread_notes', { select: 'id,body,created_at,author_user_id,author:users!jobs_ledger_thread_notes_author_user_id_fkey(name)', filters: by('job_id', id), order: [{ column: 'created_at', ascending: false }], limit: ACTIVITY_NOTE_LATEST }),
    ])
    const job = jobRows[0]
    if (!job) return { refused: `No job ${id} — it does not exist, or RLS hides it from you.` }
    return {
      on: 'job',
      job: {
        id,
        label: formatJobLedgerNumberLabel(strOrNull(prefixOf(job.service_type_id)?.ledger_job_prefix), str(job.hcp_number).trim() || str(job.click_number).trim()),
        name: str(job.job_name),
        status: strOrNull(job.status),
        customer: strOrNull(job.customer_name),
      },
      gc: null,
      latest: noteRows.map((r) => ({ id: str(r.id), at: str(r.created_at), by: strOrNull(obj(r.author)?.name), text: str(r.body) })),
    }
  }
  const resolved = await resolve(p.ref, () => findBid(reader, p.ref) as Promise<{ matches: Row[] }>, 'bid')
  if ('refused' in resolved) return resolved
  const id = resolved.id
  const [bidRows, entryRows, gcRows] = await Promise.all([
    // A bid has no status column: its standing is `outcome` (won, lost, …, null while open).
    reader.rows('bids', { select: 'id,bid_number,project_name,outcome,service_type_id', filters: by('id', id), limit: 1 }),
    // The door has no "is not null", so the newest few come whole and the ones with words are kept (a Log contact
    // row with no note is a date, not a line).
    reader.rows('bids_submission_entries', {
      select: 'id,notes,occurred_at,contact_method,gc_customer_id,creator:users!bids_submission_entries_created_by_fkey(name)',
      filters: by('bid_id', id),
      order: [{ column: 'occurred_at', ascending: false }],
      limit: ENTRIES_READ,
    }),
    p.gc_customer_id ? reader.rows('customers', { select: 'id,name', filters: by('id', p.gc_customer_id), limit: 1 }) : Promise.resolve([] as Row[]),
  ])
  const bid = bidRows[0]
  if (!bid) return { refused: `No bid ${id} — it does not exist, or RLS hides it from you.` }
  if (p.gc_customer_id && !gcRows[0]) return { refused: `No customer ${p.gc_customer_id} is visible to you — find_customer resolves a GC's name.` }
  return {
    on: 'bid',
    bid: { id, label: formatBidLedgerNumberLabel(strOrNull(prefixOf(bid.service_type_id)?.ledger_bid_prefix), str(bid.bid_number)), projectName: str(bid.project_name), outcome: strOrNull(bid.outcome) },
    gc: gcRows[0] ? { id: str(gcRows[0].id), name: strOrNull(gcRows[0].name) } : null,
    latest: entryRows
      .filter((r) => strOrNull(r.notes))
      .slice(0, ACTIVITY_NOTE_LATEST)
      .map((r) => ({ id: str(r.id), at: str(r.occurred_at), by: strOrNull(obj(r.creator)?.name), text: `${strOrNull(r.contact_method) ? `${str(r.contact_method)} · ` : ''}${str(r.notes)}` })),
  }
}

// ── the stamp and the row ────────────────────────────────────────────────────────────────────────────────────────

/**
 * Noon of a day in the app's calendar, as an ISO instant: 18:00Z reads as that day in America/Chicago on both sides of
 * the clock change (12:00 CST, 13:00 CDT). `null` when the day is not given, and the table stamps now.
 */
export function noonInAppTz(day: string | undefined): string | null {
  if (!day) return null
  const iso = `${day}T18:00:00.000Z`
  return calendarYmdInAppTzFromIso(iso) === day ? iso : `${day}T19:00:00.000Z`
}

export type ActivityNoteWrite =
  | { table: 'jobs_ledger_thread_notes'; select: 'id,created_at'; row: { job_id: string; author_user_id: string; body: string; created_at?: string } }
  | { table: 'bids_submission_entries'; select: 'id,occurred_at'; row: { bid_id: string; gc_customer_id: string | null; notes: string; contact_method: null; occurred_at: string; created_by: string } }

/**
 * The row the insert sends — the app's own payload, column for column (useJobThreadNotes / BidGcNotesPopover). `now`
 * is the clock of the write itself: the apply calls this after the hash matched, never the dry run.
 */
export function activityNoteRow(p: ActivityNotePayload, world: ActivityNoteWorld, me: { userId: string }, now: string): ActivityNoteWrite {
  const at = noonInAppTz(p.on_day)
  if (world.on === 'job') {
    const row: { job_id: string; author_user_id: string; body: string; created_at?: string } = { job_id: world.job.id, author_user_id: me.userId, body: p.text }
    if (at) row.created_at = at
    return { table: 'jobs_ledger_thread_notes', select: 'id,created_at', row }
  }
  return {
    table: 'bids_submission_entries',
    select: 'id,occurred_at',
    row: { bid_id: world.bid.id, gc_customer_id: world.gc?.id ?? null, notes: p.text, contact_method: null, occurred_at: at ?? now, created_by: me.userId },
  }
}

/** Which column the write stamps, and who stamps it, when the note names no day. */
const STAMPED_AT_APPLY = {
  jobs_ledger_thread_notes: 'created_at: the table stamps it when the row lands',
  bids_submission_entries: 'occurred_at: the server stamps it when the apply writes the row',
} as const

export type ActivityNotePlannedWrite = { table: ActivityNoteWrite['table']; row: Json; stamped_at_apply?: string }

/**
 * The row as the plan shows it and the hash commits to it: the insert's row without the column the clock fills. A
 * dated note's row is whole (noon of its day comes from the payload); an undated one leaves the stamp out and says
 * which column the apply stamps. No clock comes in, so the same note planned twice reads the same.
 */
export function activityNotePlannedWrite(p: ActivityNotePayload, world: ActivityNoteWorld, me: { userId: string }): ActivityNotePlannedWrite {
  const write = activityNoteRow(p, world, me, '')
  if (noonInAppTz(p.on_day)) return { table: write.table, row: write.row }
  if (write.table === 'bids_submission_entries') {
    const { occurred_at: _stampedAtApply, ...row } = write.row
    return { table: write.table, row, stamped_at_apply: STAMPED_AT_APPLY[write.table] }
  }
  return { table: write.table, row: write.row, stamped_at_apply: STAMPED_AT_APPLY[write.table] }
}

// ── the dry run ──────────────────────────────────────────────────────────────────────────────────────────────────

export type DryRun = { ok: true; reply: Json } | { ok: false; refused: string }

/** Where the line shows in the app, in the words of the screen. */
export function activityNoteLands(world: ActivityNoteWorld): string {
  if (world.on === 'job') return `Jobs → Pipeline → ${world.job.label}'s Job activity / notes (the row's thread, the job window's Activity), as a note by you; the customer's Hub and Timeline list it too`
  return world.gc ? `Bids → Bid Board → ${world.bid.label}'s notes for ${world.gc.name ?? 'that GC'} (the GC line's Notes popover), tagged with their name in the bid's feed` : `Bids → Bid Board → ${world.bid.label}'s Notes (the bid's own), the Bid tab's notes`
}

/**
 * What the plan says and what the hash commits to: the job or the bid as it reads, the latest lines already there,
 * the row as it will land and where it shows. Refuses in words before anything is hashed when the day is ahead of
 * today. `today` only refuses; nothing of the clock reaches the reply, so the apply's second dry run hashes the same.
 */
export function activityNoteDryRun(p: ActivityNotePayload, world: ActivityNoteWorld, me: { userId: string; name: string | null }, today: string): DryRun {
  if (p.on_day && p.on_day > today) return { ok: false, refused: `on is ${p.on_day}, ahead of today (${today}): a note is about a day that has come. Leave it out for now, or name a day that has.` }
  const write = activityNotePlannedWrite(p, world, me)
  const at = noonInAppTz(p.on_day)
  const reply: Json = {
    action: 'note',
    on: world.on,
    ...(world.on === 'job'
      ? { job: { id: world.job.id, label: world.job.label, name: world.job.name, status: world.job.status, customer: world.job.customer } }
      : { bid: { id: world.bid.id, label: world.bid.label, project_name: world.bid.projectName, outcome: world.bid.outcome }, gc: world.gc }),
    reads: p.text,
    by: me.name ?? 'you',
    at: at ? `${p.on_day} (noon, the app's calendar)` : 'the time of the apply',
    lands: activityNoteLands(world),
    latest: world.latest.map((l) => ({ id: l.id, at: l.at, by: l.by, text: l.text.length > 160 ? `${l.text.slice(0, 160)}…` : l.text })),
    writes: write,
    not_done: [
      'tells nobody: no email, text or push goes out; the line waits in the app for whoever opens the job or the bid',
      world.on === 'job' ? "the customer's own thread, a text or an email to them: the job window's Note · Text · Email" : 'a call or an email logged against the GC (contact_method): the Bid Board\'s Log contact',
      'a line on a development: plan_history_entry',
    ],
  }
  return { ok: true, reply }
}

/** The apply's reply: the row, where it shows, and the read that shows it. */
export function activityNoteAppliedWords(world: ActivityNoteWorld, landed: { id: string; at: string | null }): Json {
  const label = world.on === 'job' ? world.job.label : world.bid.label
  return {
    note_id: landed.id,
    on: world.on,
    label,
    at: landed.at,
    lands: activityNoteLands(world),
    next: world.on === 'job' ? `get_job { job: "${label}" } reads the job; read_rows on jobs_ledger_thread_notes by job_id lists the thread, this line newest.` : `get_bid { bid: "${label}" } reads the bid; read_rows on bids_submission_entries by bid_id lists its notes, this one newest.`,
  }
}
