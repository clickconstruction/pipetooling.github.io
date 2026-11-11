// A bid changed from the dev seat (v2.6945 — the bid train's PR 1, to-dos/mcp-servers.md → The bid train).
// The owner, 2026-11-11, preparing to enter bids for proposals that went out months ago: the seat could make a bid
// (plan_bid) and read one (get_bid), and nothing could change it after — not its value, not its outcome, not the day
// it was sent. plan_bid_update → apply_bid_update changes a bid as Edit Bid and the Bid Board change it: the form's
// columns as one PATCH on bids under RLS as the dev (src/hooks/useBidEditController.ts autosaveBid →
// src/lib/bids/bidFormPayload.ts buildBidSavePayload, pruned to what changed), with the columns that ride together
// written together as the form writes them (bidUpdatePrune.ts FIELD_GROUPS), then the line the form leaves on the
// bid's notes when the outcome moves (src/lib/outcomeChangeBidNote.ts, read from the kernel copy). No RPC exists for
// a bid's update and none is owed: dev_bid_write only makes a bid and files its plans.
//
// Three things the form does not do, and why the seat does them this way:
//   · the decided day. bids.outcome_at is stamped by the database when the outcome moves; its trigger takes an
//     explicit write ("a back-dated decision", migration 20260911235622), and no screen has a field for it. A proposal
//     decided months ago needs its own day, so the seat writes the day at noon in the app's calendar.
//   · the sent date. Edit Bid asks the person's three-line checklist before a new sent date and stamps eight columns
//     with their word. Those lines are a person's own ("I sent the bid via email…", "…lying about this will result in
//     my suspension"), so the seat never gives them: the date lands as the Cover Letter's Mark sent lands it
//     (BidsCoverLetterTab markSentTodaySimple: bid_date_sent alone, the stamps untouched). Clearing the date clears the
//     stamps, as the form's clear does.
//   · a bid with versions. There Sent and Won / Lost live per GC (BidGcSentPanel, setGcPacketOutcome) and the bid's
//     own date and outcome are roll-ups; the form locks them, so the plan refuses them and names the panel.
// Pure: no env reads, no network; the reads come in through one small interface so the tests run over a recording fake
// (src/lib/devMcp/devMcpBidUpdate.test.ts).

import { calendarYmdInAppTzFromIso } from './appTimeZone.ts'
import { noonInAppTz } from './devMcpActivityNote.ts'
import { BID_LOSS_CATEGORIES, LOSS_UNCATEGORIZED_NUDGE, bidLossCategoryLabel, isBidLossCategoryKey } from './gcKernels/lib/bidLossCategories.ts'
import { getSubmissionSectionKey, type SubmissionSectionKey } from './gcKernels/lib/bids/submissionSections.ts'
import { buildOutcomeChangeBidNoteBody } from './gcKernels/lib/outcomeChangeBidNote.ts'

export const BID_UPDATE_VERBS = ['plan_bid_update', 'apply_bid_update'] as const
export type BidUpdateVerb = (typeof BID_UPDATE_VERBS)[number]

export function isBidUpdateVerb(name: string): name is BidUpdateVerb {
  return (BID_UPDATE_VERBS as readonly string[]).includes(name)
}

/** bids.outcome's stored values (bids_outcome_check); null is open. */
export const BID_OUTCOMES = ['won', 'lost', 'started_or_complete'] as const
export type BidOutcome = (typeof BID_OUTCOMES)[number]

/** The Bid Board's section headings (BidsBidBoardTab BID_BOARD_SECTION_CONFIG), by the key getSubmissionSectionKey gives. */
export const BOARD_SECTION_WORDS: Readonly<Record<SubmissionSectionKey, string>> = {
  unsent: 'Unsent / Working Bids',
  pending: 'Not yet won or lost',
  won: 'Won',
  startedOrComplete: 'Started or Complete',
  lost: 'Lost',
}

/** The eight stamps the sent checklist writes (src/lib/bids/bidDateSentAttestation.ts BID_DATE_SENT_ATTESTATION_NULLS). */
export const SENT_STAMP_COLUMNS = [
  'bid_date_sent_attested_at', 'bid_date_sent_attested_by', 'bid_date_sent_ack_email_at', 'bid_date_sent_ack_email_by',
  'bid_date_sent_ack_phone_at', 'bid_date_sent_ack_phone_by', 'bid_date_sent_ack_honesty_at', 'bid_date_sent_ack_honesty_by',
] as const

/** The columns the verb changes: Edit Bid's (buildBidSavePayload), and the decided day. */
export const BID_UPDATE_COLUMNS = [
  'project_name', 'address', 'customer_id', 'project_id', 'development_id', 'service_type_id', 'estimator_id', 'account_manager_id',
  'bid_due_date', 'bid_due_time', 'estimated_job_start_date', 'design_drawing_plan_date',
  'bid_value', 'agreed_value', 'profit', 'bid_date_sent', 'submitted_to',
  'outcome', 'outcome_at', 'loss_category', 'loss_reason',
  'gc_contact_name', 'gc_contact_phone', 'gc_contact_email',
  'drive_link', 'plans_link', 'count_tooling_plans_link', 'bid_submission_link', 'itb_links',
  'distance_from_office', 'robot_opt_out', 'notes',
] as const
export type BidUpdateColumn = (typeof BID_UPDATE_COLUMNS)[number]
const COLUMN_SET: ReadonlySet<string> = new Set(BID_UPDATE_COLUMNS)

/** The columns that move only because another did: the form writes each with its driver (bidUpdatePrune FIELD_GROUPS). */
export const RIDE_COLUMNS = ['gc_builder_id', 'accepted_alternate_tags', 'declined_alternate_tags', ...SENT_STAMP_COLUMNS] as const

/** The bids columns the bid's History does NOT record (not in bid_changes_bid_columns(), migration 20261007060000). */
export const UNTRACKED_COLUMNS: ReadonlySet<string> = new Set(['development_id', 'robot_opt_out', ...SENT_STAMP_COLUMNS])

/** The id columns, with the table each names, its name column and the verb that finds one. */
const ID_COLUMNS: Readonly<Record<string, { table: string; name: string; finder: string }>> = {
  customer_id: { table: 'customers', name: 'name', finder: 'find_customer' },
  project_id: { table: 'projects', name: 'name', finder: 'read_rows on projects' },
  development_id: { table: 'developments', name: 'name', finder: 'read_rows on developments' },
  service_type_id: { table: 'service_types', name: 'name', finder: 'read_rows on service_types' },
  estimator_id: { table: 'users', name: 'name', finder: 'find_person' },
  account_manager_id: { table: 'users', name: 'name', finder: 'find_person' },
}
const DATE_COLUMNS: ReadonlySet<string> = new Set(['bid_due_date', 'estimated_job_start_date', 'design_drawing_plan_date', 'bid_date_sent', 'outcome_at'])
/** The days that have happened: never ahead of today. */
const PAST_DATE_COLUMNS: ReadonlySet<string> = new Set(['bid_date_sent', 'outcome_at'])
const MONEY_COLUMNS: ReadonlySet<string> = new Set(['bid_value', 'agreed_value', 'profit'])
const LINK_COLUMNS: ReadonlySet<string> = new Set(['drive_link', 'plans_link', 'count_tooling_plans_link', 'bid_submission_link'])
/** The columns the form will not save blank: Project Name and Service Type (useBidEditForm missingFields). */
const REQUIRED: ReadonlySet<string> = new Set(['project_name', 'service_type_id'])
const TEXT_MAX: Readonly<Record<string, number>> = { project_name: 120, address: 300, submitted_to: 300, loss_reason: 2000, gc_contact_name: 200, gc_contact_phone: 40, gc_contact_email: 200, notes: 8000 }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const LINK_RE = /^https?:\/\//i
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MILES_RE = /^[0-9]+(\.[0-9]+)?$/
const LINK_MAX = 2000
const ITB_LINKS_MAX = 20

export type Json = Record<string, unknown>
const obj = (v: unknown): Json | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null)

export type BidUpdateValue = string | number | boolean | string[] | null
export type BidUpdatePayload = { action: 'update'; bid_id: string; set: Partial<Record<BidUpdateColumn, BidUpdateValue>> }
export type BidUpdateInput = { ok: true; p: BidUpdatePayload; target: string; planHash: string | null } | { ok: false; error: string }

const LOSS_KEYS = BID_LOSS_CATEGORIES.map((c) => c.key)

const SHAPE = `needs update — { bid_id (a bids.id — find_bid), set ({ column: value } over Edit Bid's columns; null clears one that may be blank): project_name, address, customer_id (the GC — find_customer), project_id, development_id, service_type_id, estimator_id, account_manager_id (find_person), bid_due_date, bid_due_time (HH:MM), estimated_job_start_date, design_drawing_plan_date, bid_value, agreed_value, profit (dollars), bid_date_sent (YYYY-MM-DD, never ahead of today), submitted_to (who it went to), outcome (won | lost | started_or_complete, or null for open), outcome_at (YYYY-MM-DD, the day it was decided, never ahead of today; left out, the database stamps now), loss_category (${LOSS_KEYS.join(' | ')}), loss_reason, gc_contact_name, gc_contact_phone, gc_contact_email, drive_link, plans_link, count_tooling_plans_link, bid_submission_link (https://…), itb_links ([https://…]), distance_from_office (miles), robot_opt_out (true | false), notes }.`

/** A real calendar day, written YYYY-MM-DD. */
function isDay(v: string): boolean {
  if (!YMD_RE.test(v)) return false
  const d = new Date(`${v}T12:00:00.000Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v
}

/** One column's value, checked as the form would take it; refused in words. */
function checkColumn(verb: string, column: BidUpdateColumn, raw: unknown, today: string): { ok: true; value: BidUpdateValue } | { ok: false; error: string } {
  if (raw === null || (typeof raw === 'string' && !raw.trim() && column !== 'outcome')) {
    if (REQUIRED.has(column)) return { ok: false, error: `${verb}: ${column} cannot be cleared — the form will not save a bid without it.` }
    if (column === 'robot_opt_out') return { ok: false, error: `${verb}: robot_opt_out is true or false.` }
    return { ok: true, value: column === 'itb_links' ? [] : null }
  }
  if (column === 'robot_opt_out') {
    if (typeof raw !== 'boolean') return { ok: false, error: `${verb}: robot_opt_out is true or false.` }
    return { ok: true, value: raw }
  }
  if (MONEY_COLUMNS.has(column)) {
    const n = typeof raw === 'number' ? raw : typeof raw === 'string' && /^-?\d+(\.\d{1,2})?$/.test(raw.trim()) ? Number(raw.trim()) : NaN
    if (!Number.isFinite(n) || Math.abs(n) > 999_999_999 || (column !== 'profit' && n < 0)) return { ok: false, error: `${verb}: ${column} is dollars, a number${column === 'profit' ? '' : ' of 0 or more'}.` }
    return { ok: true, value: Math.round(n * 100) / 100 }
  }
  if (column === 'itb_links') {
    if (!Array.isArray(raw) || raw.length > ITB_LINKS_MAX) return { ok: false, error: `${verb}: itb_links is a list of links, ${ITB_LINKS_MAX} at most.` }
    const links: string[] = []
    for (const one of raw) {
      const v = typeof one === 'string' ? one.trim() : ''
      if (!v) continue
      if (!LINK_RE.test(v) || v.length > LINK_MAX) return { ok: false, error: `${verb}: every link in itb_links starts with https://.` }
      links.push(v)
    }
    return { ok: true, value: links }
  }
  if (typeof raw !== 'string') return { ok: false, error: `${verb}: ${column} takes text.` }
  const v = raw.trim()
  if (column === 'outcome') {
    const o = v.toLowerCase()
    if (o === '' || o === 'open') return { ok: true, value: null }
    if (!(BID_OUTCOMES as readonly string[]).includes(o)) return { ok: false, error: `${verb}: outcome is ${BID_OUTCOMES.join(', ')}, or null for open.` }
    return { ok: true, value: o }
  }
  if (column === 'loss_category') {
    if (!isBidLossCategoryKey(v)) return { ok: false, error: `${verb}: loss_category is one of ${LOSS_KEYS.join(', ')} (the Lost strip's chips), or null.` }
    return { ok: true, value: v }
  }
  if (ID_COLUMNS[column]) {
    if (!UUID_RE.test(v)) return { ok: false, error: `${verb}: ${column} is a ${ID_COLUMNS[column].table}.id — ${ID_COLUMNS[column].finder}.` }
    return { ok: true, value: v.toLowerCase() }
  }
  if (DATE_COLUMNS.has(column)) {
    if (!isDay(v)) return { ok: false, error: `${verb}: ${column} is a day, YYYY-MM-DD.` }
    if (PAST_DATE_COLUMNS.has(column) && v > today) return { ok: false, error: `${verb}: ${column} ${v} is ahead of today (${today}). ${column === 'bid_date_sent' ? 'A bid is sent on a day that has happened.' : 'A decision is dated the day it was made.'}` }
    return { ok: true, value: v }
  }
  if (column === 'bid_due_time') {
    if (!TIME_RE.test(v)) return { ok: false, error: `${verb}: bid_due_time is HH:MM on the 24-hour clock.` }
    return { ok: true, value: v }
  }
  if (LINK_COLUMNS.has(column)) {
    if (!LINK_RE.test(v) || v.length > LINK_MAX) return { ok: false, error: `${verb}: ${column} starts with https://, or null to clear it.` }
    return { ok: true, value: v }
  }
  if (column === 'gc_contact_email' && !EMAIL_RE.test(v)) return { ok: false, error: `${verb}: gc_contact_email is not an email address.` }
  if (column === 'distance_from_office') {
    if (!MILES_RE.test(v)) return { ok: false, error: `${verb}: distance_from_office is miles, a number like 12 or 12.5.` }
    return { ok: true, value: v }
  }
  const max = TEXT_MAX[column] ?? 300
  if (v.length > max) return { ok: false, error: `${verb}: ${column} is under ${max} characters.` }
  return { ok: true, value: v }
}

/** plan_bid_update / apply_bid_update's input, shaped: the bid, each column checked, the hash on apply. */
export function bidUpdateInput(verb: BidUpdateVerb, input: Json, today: string): BidUpdateInput {
  const shape = `${verb} ${SHAPE}`
  const src = obj(input.update)
  if (!src) return { ok: false, error: shape }
  const bidId = typeof src.bid_id === 'string' ? src.bid_id.trim().toLowerCase() : ''
  if (!UUID_RE.test(bidId)) return { ok: false, error: shape }
  const set = obj(src.set)
  if (!set) return { ok: false, error: shape }
  const p: BidUpdatePayload = { action: 'update', bid_id: bidId, set: {} }
  for (const [column, raw] of Object.entries(set)) {
    if (!COLUMN_SET.has(column)) {
      const why = column === 'bid_number' ? ' The bid number is the database\'s to give.' : column === 'last_contact' ? ' Last contact follows the contact log.' : column === 'accepted_alternate_tags' || column === 'declined_alternate_tags' ? ' Which alternates they took is the Won section\'s question on Edit Bid.' : ''
      return { ok: false, error: `${verb}: ${column} is not a column this verb changes.${why} The columns: ${BID_UPDATE_COLUMNS.join(', ')}.` }
    }
    if (raw === undefined) continue
    const checked = checkColumn(verb, column as BidUpdateColumn, raw, today)
    if (!checked.ok) return checked
    p.set[column as BidUpdateColumn] = checked.value
  }
  if (!Object.keys(p.set).length) return { ok: false, error: `${verb}: nothing to change — set names no column. ${SHAPE}` }
  let planHash: string | null = null
  if (verb === 'apply_bid_update') {
    const h = typeof input.plan_hash === 'string' ? input.plan_hash.trim().toLowerCase() : ''
    if (!/^[0-9a-f]{64}$/.test(h)) return { ok: false, error: `${verb} needs plan_hash — the 64-hex value plan_bid_update replied with.` }
    planHash = h
  }
  return { ok: true, p, target: bidId, planHash }
}

// ── the world the plan reads ─────────────────────────────────────────────────────────────────────────────────────

export type BidReads = {
  /** GET /rest/v1/<table>?<query> as the dev; the rows. Throws on a refused read. */
  rows(table: string, query: string): Promise<Json[]>
}

export type BidRow = Json & { id: string; bid_number: string | null; updated_at: string | null }
export type LinkedJob = { id: string; click_number: string | null; hcp_number: string | null; job_name: string | null; status: string | null }
export type BidUpdateWorld = {
  me: { userId: string; name: string | null; email: string | null }
  bid: BidRow | null
  /** True when the bid has versions: Sent and Won / Lost live per GC there. */
  hasVersions: boolean
  /** The jobs that point at this bid. */
  jobs: LinkedJob[]
  /** The rows the new ids name, by column: null when not visible. */
  named: Partial<Record<BidUpdateColumn, { id: string; name: string | null } | null>>
}

/** Every bids column the dry run reads. */
export const BID_READ_COLUMNS = ['id', 'bid_number', 'updated_at', 'working_board_archived_at', ...BID_UPDATE_COLUMNS, ...RIDE_COLUMNS] as const

/** The reads the dry run needs, in one place, so the test pins the queries the door will see. */
export async function readBidUpdateWorld(reads: BidReads, p: BidUpdatePayload, me: BidUpdateWorld['me']): Promise<BidUpdateWorld> {
  const one = async <T>(table: string, query: string): Promise<T | null> => ((await reads.rows(table, query))[0] as T | undefined) ?? null
  const [bid, versions, jobs] = await Promise.all([
    one<BidRow>('bids', `select=${BID_READ_COLUMNS.join(',')}&id=eq.${p.bid_id}`),
    reads.rows('bid_versions', `select=id&bid_id=eq.${p.bid_id}&limit=1`),
    reads.rows('jobs_ledger', `select=id,click_number,hcp_number,job_name,status&bid_id=eq.${p.bid_id}&order=created_at.asc&limit=5`) as Promise<LinkedJob[]>,
  ])
  const named: BidUpdateWorld['named'] = {}
  await Promise.all(
    Object.entries(p.set).map(async ([column, value]) => {
      const spec = ID_COLUMNS[column]
      if (!spec || typeof value !== 'string') return
      const row = await one<Json>(spec.table, `select=id,${spec.name}&id=eq.${value}`)
      named[column as BidUpdateColumn] = row ? { id: String(row.id), name: typeof row[spec.name] === 'string' ? (row[spec.name] as string) : null } : null
    }),
  )
  return { me, bid, hasVersions: versions.length > 0, jobs, named }
}

// ── the dry run ──────────────────────────────────────────────────────────────────────────────────────────────────

export type DryRun = { ok: true; reply: Json } | { ok: false; refused: string }
export type BidChange = { column: string; before: unknown; after: unknown; named?: string | null; rides_with?: string; why?: string }

/** The bid as the app names it: its number, then its project. */
export function bidLabel(bid: { bid_number?: unknown; project_name?: unknown }): string {
  const n = typeof bid.bid_number === 'string' ? bid.bid_number.trim() : ''
  const name = typeof bid.project_name === 'string' ? bid.project_name.trim() : ''
  return [n ? `b${n}` : '', name].filter(Boolean).join(' ') || 'this bid'
}

/** A job as a short label (devMcpJobs jobShortLabel's rule). */
function jobLabel(job: LinkedJob): string {
  const n = (job.click_number ?? '').trim() || (job.hcp_number ?? '').trim()
  if (n) return /^\d+$/.test(n) ? `JP${n}` : n
  return (job.job_name ?? '').trim() || 'a job'
}

const tags = (v: unknown): string[] => (Array.isArray(v) ? v.filter((t): t is string => typeof t === 'string') : [])
const sameList = (a: string[], b: string[]): boolean => a.length === b.length && a.every((v, i) => v === b[i])
/** A timestamp as its day in the app's calendar; a plain day stays as it is. */
const dayOf = (v: unknown): string | null => (typeof v !== 'string' || !v ? null : YMD_RE.test(v) ? v : calendarYmdInAppTzFromIso(v) || null)

/** Whether a column already holds the value: numbers by value, a time to the minute, the decided day by its day, lists in order. */
export function holdsValue(column: string, before: unknown, after: unknown): boolean {
  if (column === 'itb_links' || column === 'accepted_alternate_tags' || column === 'declined_alternate_tags') return sameList(tags(before), tags(after))
  if (column === 'outcome_at') return dayOf(before) === dayOf(after)
  if (column === 'bid_due_time') return (typeof before === 'string' ? before.slice(0, 5) : null) === (typeof after === 'string' ? after.slice(0, 5) : null)
  if (MONEY_COLUMNS.has(column)) return (before == null ? null : Number(before)) === (after == null ? null : Number(after))
  if (column === 'robot_opt_out') return (before === true) === (after === true)
  const blank = (v: unknown) => (v == null || v === '' ? null : v)
  return blank(before) === blank(after)
}

const section = (outcome: unknown, sent: unknown): string => {
  const key = getSubmissionSectionKey({ outcome: typeof outcome === 'string' ? outcome : null, bid_date_sent: typeof sent === 'string' && sent ? sent : null })
  return key ? BOARD_SECTION_WORDS[key] : BOARD_SECTION_WORDS.unsent
}

/**
 * What the plan says and what the hash commits to: the bid as it stands (its label, its Board section, updated_at),
 * every column before → after with the no-ops dropped and the columns that ride named as riding, the line the form
 * leaves when the outcome moves, what the database does after the write, and what the verb does not do. Refuses a bid
 * not visible, an id whose row is not visible, a per-GC bid's own Sent and Won / Lost, a loss reason on a bid that is
 * not lost, a decided day with no decision, a due time with no due date, and a plan that changes nothing.
 */
export function bidUpdateDryRun(p: BidUpdatePayload, world: BidUpdateWorld): DryRun {
  const bid = world.bid
  if (!bid) return { ok: false, refused: `No bid ${p.bid_id} is visible to you — find_bid resolves a number or a name.` }
  const label = bidLabel(bid)
  const set = p.set
  for (const [column, value] of Object.entries(set)) {
    const spec = ID_COLUMNS[column]
    if (spec && typeof value === 'string' && !world.named[column as BidUpdateColumn]) return { ok: false, refused: `${column}: no ${spec.table} row ${value} is visible to you — ${spec.finder}.` }
  }
  const before = (column: string): unknown => bid[column] ?? null
  const has = (column: BidUpdateColumn): boolean => Object.prototype.hasOwnProperty.call(set, column)
  const moves = (column: BidUpdateColumn): boolean => has(column) && !holdsValue(column, before(column), set[column])
  const after = (column: BidUpdateColumn): unknown => (has(column) ? set[column] : before(column))

  const outcomeBefore = (before('outcome') as string | null) ?? null
  const outcomeAfter = (after('outcome') as string | null) ?? null
  const sentBefore = dayOf(before('bid_date_sent'))
  const sentAfter = dayOf(after('bid_date_sent'))

  // A bid with versions: Sent and Won / Lost are per GC and the bid's own are roll-ups (BidFormModal perGcLocked, BidGcSentPanel).
  if (world.hasVersions && moves('outcome') && (outcomeAfter === 'won' || outcomeAfter === 'lost')) {
    return { ok: false, refused: `${label} has versions, so Won and Lost are set per GC and the bid rolls up from them: Edit Bid locks the two here too. Set the GC's line on the Bid Board, or in Edit Bid's Sent panel. Open and Started or Complete can still be set here.` }
  }
  if (world.hasVersions && moves('bid_date_sent')) {
    return { ok: false, refused: `${label} has versions, so Sent is recorded per GC and the bid's date is the first send, kept by the database. Record the send in Edit Bid's Sent panel or the Cover Letter's Mark sent; a date written here would be overwritten at the next send.` }
  }
  if (outcomeAfter !== 'lost') {
    for (const column of ['loss_category', 'loss_reason'] as const) {
      if (has(column) && set[column] != null) return { ok: false, refused: `${column} is the reason a bid was lost, and ${label} would read ${outcomeAfter ? section(outcomeAfter, sentAfter) : 'open'}. Set outcome: "lost" with it, or leave it out.` }
    }
  }
  if (has('outcome_at') && set.outcome_at != null && !outcomeAfter) return { ok: false, refused: `outcome_at is the day a bid was decided, and ${label} would have no outcome. Set outcome with it, or leave it out.` }
  if (has('outcome_at') && set.outcome_at == null && outcomeAfter && outcomeBefore === outcomeAfter) return { ok: false, refused: `${label} is decided, and a decided bid keeps its day. Give outcome_at a day, or leave it out.` }
  if (has('bid_due_time') && set.bid_due_time != null && !after('bid_due_date')) return { ok: false, refused: 'bid_due_time needs a due date: set bid_due_date with it.' }
  const sentDay = sentAfter
  const decidedDay = has('outcome_at') ? dayOf(set.outcome_at) : null
  if (decidedDay && sentDay && decidedDay < sentDay) return { ok: false, refused: `${label} would be decided on ${decidedDay}, before it was sent on ${sentDay}. Check the two days.` }

  const changes: BidChange[] = []
  const patch: Json = {}
  const change = (c: BidChange, value: unknown) => {
    changes.push(c)
    patch[c.column] = value
  }
  for (const column of BID_UPDATE_COLUMNS) {
    if (!has(column) || !moves(column)) continue
    // A cleared decided day on a bid that stops being decided is the trigger's own work: nothing to send.
    if (column === 'outcome_at' && set.outcome_at == null) continue
    const row = world.named[column]
    const value = set[column]
    change({ column, before: column === 'outcome_at' ? dayOf(before(column)) : before(column), after: value, ...(row ? { named: row.name } : {}) }, column === 'outcome_at' ? noonInAppTz(value as string) : value)
  }
  // The columns that ride, as the form's payload derives them (buildBidSavePayload) and its prune groups them.
  const ride = (column: string, value: unknown, ridesWith: string, why: string) => {
    if (Object.prototype.hasOwnProperty.call(patch, column) || holdsValue(column, before(column), value)) return
    change({ column, before: before(column), after: value, rides_with: ridesWith, why }, value)
  }
  if (moves('customer_id')) ride('gc_builder_id', null, 'customer_id', 'the form saves the GC as the customer and clears the old builder link with it')
  if (moves('bid_due_date') && !after('bid_due_date')) ride('bid_due_time', null, 'bid_due_date', 'a due time needs a due date')
  if (moves('outcome')) {
    if (outcomeAfter !== 'lost') {
      ride('loss_category', null, 'outcome', 'only a lost bid carries why it was lost')
      ride('loss_reason', null, 'outcome', 'only a lost bid carries why it was lost')
    }
    if (outcomeAfter !== 'won' && outcomeAfter !== 'started_or_complete') {
      ride('accepted_alternate_tags', [], 'outcome', 'only a won bid carries the alternates they took')
      ride('declined_alternate_tags', [], 'outcome', 'only a won bid carries the alternates they declined')
    }
  }
  const stamped = SENT_STAMP_COLUMNS.some((c) => before(c) != null)
  if (moves('bid_date_sent') && !sentAfter) for (const c of SENT_STAMP_COLUMNS) ride(c, null, 'bid_date_sent', 'clearing the sent date clears the checklist that confirmed it, as Edit Bid does')

  if (!changes.length) return { ok: false, refused: `${label} already reads that way: every column in set already holds its value. Nothing to apply.` }

  // ── what follows the write ──
  const outcomeMoves = moves('outcome')
  const noteLine = outcomeMoves
    ? buildOutcomeChangeBidNoteBody({ previousOutcome: outcomeBefore, nextOutcome: outcomeAfter, actorDisplayName: world.me.name?.trim() || world.me.email?.trim() || '', lossReason: (after('loss_reason') as string | null) ?? null })
    : null
  const after_write: string[] = []
  const warnings: string[] = []
  const sectionBefore = section(outcomeBefore, sentBefore)
  const sectionAfter = section(outcomeAfter, sentAfter)
  if (sectionBefore !== sectionAfter) after_write.push(`The Bid Board moves it from ${sectionBefore} to ${sectionAfter}.`)
  if (outcomeMoves) {
    const decided = (o: string | null) => o === 'won' || o === 'lost' || o === 'started_or_complete'
    if (decided(outcomeAfter)) {
      if (decidedDay) after_write.push(`The decided day (outcome_at) is ${decidedDay}, as you gave it: the database's trigger keeps an explicit day.`)
      else if (decided(outcomeBefore) && before('outcome_at')) after_write.push(`The decided day stays ${dayOf(before('outcome_at'))}: the database keeps the first decision's day across a decided bid's change.`)
      else after_write.push('The database stamps the decided day (outcome_at) as now. For a bid decided earlier, give outcome_at the day.')
    } else after_write.push('The database clears the decided day (outcome_at): an open bid has none.')
    after_write.push(`A line lands on the bid's notes, as Edit Bid leaves it: "${noteLine}"`)
    if (outcomeAfter === 'won') {
      after_write.push(world.jobs.length
        ? `A win opens no job, and ${world.jobs.map(jobLabel).join(', ')} already points at this bid.`
        : 'A win opens no job and tells nobody: the job is its own press (Edit Bid\'s Job block, or plan_job with bid_id). Once a job points at the bid, the database reads it Started or Complete.')
    }
    if (outcomeAfter === 'lost' && !after('loss_category')) warnings.push(`${LOSS_UNCATEGORIZED_NUDGE} Set loss_category: ${LOSS_KEYS.join(' | ')}.`)
    if (world.jobs.length && outcomeAfter !== 'started_or_complete' && outcomeAfter !== 'won') warnings.push(`${world.jobs.map(jobLabel).join(', ')} points at this bid, and the database set it to Started or Complete when the job was linked. ${outcomeAfter ? 'Lost' : 'Open'} would stand against a job that exists.`)
  } else if (decidedDay) {
    after_write.push(`The decided day (outcome_at) becomes ${decidedDay}: the database's trigger keeps an explicit day.`)
  }
  if (moves('bid_date_sent')) {
    if (sentAfter && !sentBefore) {
      after_write.push('A first sent date makes the database mint the bid\'s labor rows from its counts with the labor book\'s hours (bids_mint_labor_on_send). It never overwrites a row a person touched, so enter the labor first when the paper carries it.')
      if (before('working_board_archived_at')) after_write.push('The database takes it out of the Board\'s archive: a sent bid is not parked.')
    }
    if (sentAfter) after_write.push('The date lands as the Cover Letter\'s Mark sent lands it, with no checklist. Edit Bid\'s three lines are a person\'s own word and the seat does not give it.')
    if (sentAfter && stamped) warnings.push(`A person confirmed the sent checklist for ${sentBefore ?? 'an earlier date'}. Their stamps stay on the bid, given for that date and not for ${sentAfter}.`)
  }
  if (sentAfter && after('bid_value') != null && (moves('bid_date_sent') || moves('bid_value'))) after_write.push('With a sent date and a value on the bid, the database scores any locked robot shadow of it against the value (bids_score_shadow_on_send).')
  const tracked = changes.filter((c) => !UNTRACKED_COLUMNS.has(c.column)).map((c) => c.column)
  const untracked = changes.filter((c) => UNTRACKED_COLUMNS.has(c.column)).map((c) => c.column)
  if (tracked.length) after_write.push(`The bid's History records ${tracked.join(', ')} under your name (bid_changes, by the database's trigger).${untracked.length ? ` It does not record ${untracked.join(', ')}.` : ''}`)
  else if (untracked.length) after_write.push(`The bid's History does not record ${untracked.join(', ')}.`)

  return {
    ok: true,
    reply: {
      action: 'update',
      bid: { id: bid.id, label, board_section: sectionBefore, updated_at: bid.updated_at, has_versions: world.hasVersions, jobs: world.jobs.map((j) => ({ id: j.id, label: jobLabel(j), status: j.status })) },
      changes,
      patch,
      note_line: noteLine,
      after_write,
      warnings,
      not_done: [
        'the sent checklist — a person\'s own word, given on Edit Bid',
        'which alternates they took and which option of the letter won (Edit Bid\'s Won section)',
        'a job, a hand-off to Dispatch, or any notice to anyone',
        'per-GC sends and outcomes on a bid with versions (Edit Bid\'s Sent panel, the Board\'s GC lines)',
        'the robot\'s envelope and its revision note on a bid a robot shadowed',
        'the bid number, last contact, counts, takeoff, labor and prices',
      ],
    },
  }
}

/** The row that carries the outcome line: Edit Bid's own insert (useBidEditController, contact_method null so last_contact does not move). */
export function outcomeNoteRow(bidId: string, noteLine: string, me: { userId: string }, now: string): { bid_id: string; notes: string; contact_method: null; occurred_at: string; created_by: string } {
  return { bid_id: bidId, notes: noteLine, contact_method: null, occurred_at: now, created_by: me.userId }
}

/** Which planned changes the row now holds, and which RLS kept: return=minimal says nothing, so the apply reads back. */
export function bidUpdateLanded(planned: BidChange[], row: Json | null): { changes: BidChange[]; held: string | null } {
  if (!row) return { changes: [], held: 'This account could not change this bid: the write let no row through (RLS).' }
  const stuck = planned.filter((c) => !holdsValue(c.column, row[c.column] ?? null, c.after))
  return { changes: planned.filter((c) => !stuck.includes(c)), held: stuck.length ? `These did not land: ${stuck.map((c) => c.column).join(', ')}. The row let the write through but reads otherwise now.` : null }
}

/** The apply's reply: what landed, whether the outcome line landed, where the bid stands on the Board. */
export function bidUpdateAppliedWords(bid: { id: string; bid_number?: unknown; project_name?: unknown }, landed: { changes: BidChange[]; held: string | null }, note: { asked: boolean; saved: boolean; why?: string | null }, row: Json | null): Json {
  const label = bidLabel(row ?? bid)
  const where = row ? section(row.outcome, row.bid_date_sent) : null
  return {
    bid_id: bid.id,
    label,
    changed: landed.changes,
    held: landed.held,
    note_line: note.asked ? (note.saved ? 'on the bid\'s notes' : `not saved: ${note.why ?? 'the notes refused the line'}. The bid itself changed.`) : null,
    board_section: where,
    loss_category: row && row.outcome === 'lost' ? bidLossCategoryLabel(typeof row.loss_category === 'string' ? row.loss_category : null) : undefined,
    next: landed.held && !landed.changes.length ? `${label} did not change. get_bid reads it as it stands.` : `${label} reads as planned${where ? `, under ${where} on the Bid Board` : ''}; get_bid shows it. A further change needs a new plan from the fresh row.`,
  }
}
