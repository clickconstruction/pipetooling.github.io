/**
 * The Legal desk's Timeline (v2.5800): one dated line of what has happened on a matter and what
 * is planned next, read by the office on the desk's Timeline tab, by the firm on its portal, and
 * built the same way on both sides. Pure: no React, no supabase.
 *
 * The line is the matter's stream (`legal_matter_entries`, every kind, by `occurred_on`) merged
 * with the office's documents for the firm (by the day each was added). A PLANNED STEP is a
 * `plan` entry: `occurred_on` is the day it is planned for, `body` is what, and `meta` carries
 * `{ notes, done_at, done_by, source }`. A planned step that happened keeps the day it was planned
 * for and sits on the day it was done, so the line can say *planned for the 13th, done the 10th*.
 *
 * The office holds a planned step back from counsel under `held_overrides` key `plan:<id>`, the
 * way it holds a contact or a promise (#85 item 29); `legal-portal` drops held ones before they
 * travel, so the firm's build never sees them.
 */
import type { LegalEntryRow } from './legalMatters'
import { entryRecordedByWords, legalEntryKindWords } from './legalAsks'
import { firmEntryKindWords } from './legalFirmWords'

/** The caps `legal_plan_add` / `legal_plan_update` hold (migration 20261023195135). */
export const PLAN_BODY_MAX = 500
export const PLAN_NOTES_MAX = 4000

export type LegalPlanSource = 'office' | 'firm' | 'mcp'

export type LegalPlanMeta = {
  notes: string
  /** The day it was done, `YYYY-MM-DD`, or null while it is still ahead. */
  doneAt: string | null
  doneBy: string | null
  doneNote: string
  source: LegalPlanSource
}

const YMD = /^\d{4}-\d{2}-\d{2}$/

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === 'object' && !Array.isArray(v)
}

/** A real day: `2026-02-30` rolls over in a Date, so the round trip has to land on the same text. */
function ymdValid(ymd: string): boolean {
  if (!YMD.test(ymd)) return false
  const d = new Date(`${ymd}T12:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === ymd
}

export function isPlanEntry(e: Pick<LegalEntryRow, 'kind'>): boolean {
  return e.kind === 'plan'
}

/** The `held_overrides` key that holds a planned step back from counsel. */
export function planHoldKey(entryId: string): string {
  return `plan:${entryId}`
}

// ---------- events: what happened, recorded by the office (punch list #167, v2.5836) ----------

/** An EVENT is an `event` entry: `occurred_on` is the day it happened, `body` what, `meta` `{ notes, document_ids, source }`. */
export function isEventEntry(e: Pick<LegalEntryRow, 'kind'>): boolean {
  return e.kind === 'event'
}

/** The `held_overrides` key that holds an event back from counsel. */
export function eventHoldKey(entryId: string): string {
  return `event:${entryId}`
}

/** The hold key of an item that can be held: a planned step's or an event's; '' for anything else. */
export function timelineHoldKey(item: Pick<LegalTimelineItem, 'kind' | 'entryId'>): string {
  if (!item.entryId) return ''
  return item.kind === 'event' ? eventHoldKey(item.entryId) : item.kind === 'plan' ? planHoldKey(item.entryId) : ''
}

export type LegalEventMeta = {
  notes: string
  /** The matter's Evidence documents that prove it, by id. */
  documentIds: string[]
  source: LegalPlanSource
}

/** An event's meta, read defensively. */
export function eventMetaOf(meta: unknown): LegalEventMeta {
  const m = isRecord(meta) ? meta : {}
  const ids = Array.isArray(m.document_ids) ? m.document_ids.filter((x): x is string => typeof x === 'string' && x.length > 0) : []
  return {
    notes: typeof m.notes === 'string' ? m.notes : '',
    documentIds: ids,
    source: m.source === 'mcp' ? 'mcp' : 'office',
  }
}

export type LegalEventDraft = { on: string; body: string; notes: string; documentIds: string[] }

/** Why an event cannot be saved as typed; null when it can. The RPC (`legal_event_add`) holds the same rules. */
export function eventDraftProblem(draft: LegalEventDraft, todayYmd: string): string | null {
  if (!ymdValid(draft.on)) return 'Pick the day it happened.'
  if (draft.on > todayYmd) return 'The day it happened cannot be ahead of today. Plan a step instead.'
  if (!draft.body.trim()) return 'Say what happened.'
  if (draft.body.trim().length > PLAN_BODY_MAX) return `Keep what happened under ${PLAN_BODY_MAX} characters. The notes take the rest.`
  if (draft.notes.trim().length > PLAN_NOTES_MAX) return `Keep the notes under ${PLAN_NOTES_MAX.toLocaleString('en-US')} characters.`
  return null
}

/** A plan entry's meta, read defensively: a firm's entry with no `source` is the firm's. */
export function planMetaOf(meta: unknown, viaPortal = false): LegalPlanMeta {
  const m = isRecord(meta) ? meta : {}
  const doneAt = typeof m.done_at === 'string' && YMD.test(m.done_at) ? m.done_at : null
  const source: LegalPlanSource = m.source === 'mcp' ? 'mcp' : m.source === 'firm' ? 'firm' : m.source === 'office' ? 'office' : viaPortal ? 'firm' : 'office'
  return {
    notes: typeof m.notes === 'string' ? m.notes : '',
    doneAt,
    doneBy: typeof m.done_by === 'string' && m.done_by ? m.done_by : null,
    doneNote: typeof m.done_note === 'string' ? m.done_note : '',
    source,
  }
}

export type LegalPlanDraft = { on: string; body: string; notes: string }

/** Why a planned step cannot be saved as typed; null when it can. The RPC holds the same caps. */
export function planDraftProblem(draft: LegalPlanDraft): string | null {
  if (!ymdValid(draft.on)) return 'Pick the day it is planned for.'
  if (!draft.body.trim()) return 'Say what is planned.'
  if (draft.body.trim().length > PLAN_BODY_MAX) return `Keep what is planned under ${PLAN_BODY_MAX} characters. The notes take the rest.`
  if (draft.notes.trim().length > PLAN_NOTES_MAX) return `Keep the notes under ${PLAN_NOTES_MAX.toLocaleString('en-US')} characters.`
  return null
}

/** A document on the line: the desk's row and the portal's payload both reduce to this. */
export type LegalTimelineDocument = {
  id: string
  title: string
  shows: string
  /** The day it was added, `YYYY-MM-DD`. */
  addedOn: string
  /** An instant for ordering within the day; '' when unknown. */
  addedAt: string
  addedByName: string
  held: boolean
  heldReason: string
}

/** The desk's document rows (`legal_matter_documents`, live ones) as timeline documents. */
export function timelineDocumentsFromRows(
  rows: ReadonlyArray<{ id: string; title: string; shows: string; added_at: string; added_by: string | null; held_reason: string }>,
  dayOf: (iso: string) => string,
  userNameOf: (id: string | null) => string | null = () => null,
): LegalTimelineDocument[] {
  return rows.map((d) => ({ id: d.id, title: d.title, shows: d.shows, addedOn: dayOf(d.added_at), addedAt: d.added_at, addedByName: userNameOf(d.added_by) ?? '', held: d.held_reason.trim().length > 0, heldReason: d.held_reason.trim() }))
}

/** The portal's documents (`LegalPortalDocument`: a held one never arrives) as timeline documents. */
export function timelineDocumentsFromPortal(docs: ReadonlyArray<{ id: string; title: string; shows: string; addedOn: string; addedByName: string }>): LegalTimelineDocument[] {
  return docs.map((d) => ({ id: d.id, title: d.title, shows: d.shows, addedOn: d.addedOn, addedAt: '', addedByName: d.addedByName, held: false, heldReason: '' }))
}

export type LegalTimelineState = 'planned' | 'due_today' | 'overdue' | 'done' | 'happened' | 'undone'

/** A document an event names, as the line draws it: the title (or a stand-in when the row is gone) and whether the office holds it. */
export type LegalTimelineItemDocument = { id: string; title: string; held: boolean }

export type LegalTimelineItem = {
  key: string
  /** The day the item sits on: a planned step's day, a done step's done day, an entry's or an event's `occurred_on`, a document's added day. */
  ymd: string
  kind: 'plan' | 'event' | 'entry' | 'document'
  entryKind: string | null
  entryId: string | null
  documentId: string | null
  /** What: a planned step's body, an entry's body, a document's title. */
  what: string
  /** The kind as the reader's side words it; '' for a planned step and a document. */
  kindWords: string
  notes: string
  amount: number | null
  /** Who, in the reader's words (`entryRecordedByWords`): *Grace*, *the office*, *Dana Reyes · firm*, *your firm*. */
  byName: string
  source: LegalPlanSource
  viaPortal: boolean
  state: LegalTimelineState
  /** The state in plain words: *Planned. In 5 days.* · *Due today.* · *Overdue by 3 days.* · *Done Nov 10. Planned for Nov 13.* · *Undone: entered twice.* */
  stateWords: string
  plannedYmd: string | null
  doneYmd: string | null
  held: boolean
  heldReason: string
  voided: boolean
  voidReason: string
  /** Who can act on it from the desk: a live planned step the office wrote (or any live one, for Edit and Mark done). */
  isLivePlan: boolean
  /** The Evidence documents an event names (v2.5836); empty on every other kind. */
  documents: LegalTimelineItemDocument[]
}

export type LegalTimeline = {
  past: LegalTimelineItem[]
  today: LegalTimelineItem[]
  upcoming: LegalTimelineItem[]
  counts: { planned: number; overdue: number; dueToday: number; done: number; held: number }
}

export type LegalTimelineInput = {
  entries: ReadonlyArray<LegalEntryRow>
  documents?: ReadonlyArray<LegalTimelineDocument>
  todayYmd: string
  /** The desk passes the matter's holds and reasons; the portal passes nothing (held items never arrive). */
  holds?: Record<string, boolean>
  holdReasons?: Record<string, string>
  userNameOf?: (id: string | null) => string | null
  reader: 'office' | 'firm'
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function utcOf(ymd: string): number {
  return Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1, Number(ymd.slice(8, 10)))
}

/** Whole days from `fromYmd` to `toYmd` (negative when `toYmd` is earlier). */
export function timelineDaysBetween(fromYmd: string, toYmd: string): number {
  return Math.round((utcOf(toYmd) - utcOf(fromYmd)) / 86_400_000)
}

/** A day as the line prints it: *Mon, Oct 27*, with the year when it is not today's. */
export function timelineDayWords(ymd: string, todayYmd: string): string {
  if (!YMD.test(ymd)) return ymd
  const d = new Date(utcOf(ymd))
  const base = `${WEEKDAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`
  return ymd.slice(0, 4) === todayYmd.slice(0, 4) ? base : `${base}, ${ymd.slice(0, 4)}`
}

/** *Oct 27* — the short form inside a sentence. */
function shortDay(ymd: string): string {
  if (!YMD.test(ymd)) return ymd
  return `${MONTHS[Number(ymd.slice(5, 7)) - 1]} ${Number(ymd.slice(8, 10))}`
}

/** *in 5 days* · *tomorrow* · *today* · *yesterday* · *3 days ago*. */
export function timelineRelativeWords(ymd: string, todayYmd: string): string {
  const n = timelineDaysBetween(todayYmd, ymd)
  if (n === 0) return 'today'
  if (n === 1) return 'tomorrow'
  if (n === -1) return 'yesterday'
  return n > 0 ? `in ${n} days` : `${-n} days ago`
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** The plain words under a planned step for its state on `todayYmd`. */
export function planStateWords(args: { plannedYmd: string; doneYmd: string | null; doneNote: string; voided: boolean; voidReason: string }, todayYmd: string): { state: LegalTimelineState; words: string } {
  if (args.voided) return { state: 'undone', words: `Undone${args.voidReason ? `: ${args.voidReason}` : '.'}` }
  if (args.doneYmd) {
    const planned = args.doneYmd === args.plannedYmd ? '' : ` Planned for ${shortDay(args.plannedYmd)}.`
    const note = args.doneNote ? ` ${args.doneNote}` : ''
    return { state: 'done', words: `Done ${shortDay(args.doneYmd)}.${planned}${note}` }
  }
  const n = timelineDaysBetween(todayYmd, args.plannedYmd)
  if (n === 0) return { state: 'due_today', words: 'Due today.' }
  if (n < 0) return { state: 'overdue', words: `Overdue by ${-n} day${n === -1 ? '' : 's'}. Not marked done.` }
  return { state: 'planned', words: `Planned. ${cap(timelineRelativeWords(args.plannedYmd, todayYmd))}.` }
}

function bucketOf(ymd: string, todayYmd: string): 'past' | 'today' | 'upcoming' {
  return ymd < todayYmd ? 'past' : ymd === todayYmd ? 'today' : 'upcoming'
}

/** The whole line, split around today. Each bucket runs oldest first. */
export function buildLegalTimeline(input: LegalTimelineInput): LegalTimeline {
  const { entries, documents = [], todayYmd, holds = {}, holdReasons = {}, reader } = input
  const userNameOf = input.userNameOf ?? (() => null)
  const items: Array<LegalTimelineItem & { sortKey: string }> = []
  const docById = new Map(documents.map((d) => [d.id, d] as const))

  for (const e of entries) {
    const voided = Boolean(e.voided_at)
    const voidReason = (e.void_reason ?? '').trim()
    const byName = entryRecordedByWords(e, reader, userNameOf)
    if (isPlanEntry(e)) {
      const meta = planMetaOf(e.meta, e.via_portal)
      const holdKey = planHoldKey(e.id)
      const held = holds[holdKey] === true
      const { state, words } = planStateWords({ plannedYmd: e.occurred_on, doneYmd: meta.doneAt, doneNote: meta.doneNote, voided, voidReason }, todayYmd)
      const ymd = meta.doneAt ?? e.occurred_on
      items.push({
        key: `entry:${e.id}`, ymd, kind: 'plan', entryKind: 'plan', entryId: e.id, documentId: null,
        what: e.body, kindWords: '', notes: meta.notes, amount: null,
        byName: meta.source === 'mcp' && reader === 'office' ? `${byName} · dev MCP` : byName, source: meta.source, viaPortal: e.via_portal,
        state, stateWords: words, plannedYmd: e.occurred_on, doneYmd: meta.doneAt,
        held, heldReason: held ? (holdReasons[holdKey] ?? '') : '', voided, voidReason,
        isLivePlan: !voided && !meta.doneAt,
        documents: [],
        sortKey: `${ymd}|${e.created_at}`,
      })
      continue
    }
    if (isEventEntry(e)) {
      // v2.5836: what happened, on the day it happened; held like a planned step; its documents by title.
      const meta = eventMetaOf(e.meta)
      const holdKey = eventHoldKey(e.id)
      const held = holds[holdKey] === true
      items.push({
        key: `entry:${e.id}`, ymd: e.occurred_on, kind: 'event', entryKind: 'event', entryId: e.id, documentId: null,
        what: e.body, kindWords: reader === 'office' ? 'happened' : firmEntryKindWords(e), notes: meta.notes, amount: null,
        byName: meta.source === 'mcp' && reader === 'office' ? `${byName} · dev MCP` : byName, source: meta.source, viaPortal: e.via_portal,
        state: voided ? 'undone' : 'happened', stateWords: voided ? `Undone${voidReason ? `: ${voidReason}` : '.'}` : '',
        plannedYmd: null, doneYmd: null, held, heldReason: held ? (holdReasons[holdKey] ?? '') : '', voided, voidReason, isLivePlan: false,
        documents: meta.documentIds.map((id) => { const d = docById.get(id); return { id, title: d?.title ?? 'a document no longer on Evidence', held: d?.held ?? false } }),
        sortKey: `${e.occurred_on}|${e.created_at}`,
      })
      continue
    }
    const kindWords = reader === 'office' ? legalEntryKindWords(e) : firmEntryKindWords(e)
    items.push({
      key: `entry:${e.id}`, ymd: e.occurred_on, kind: 'entry', entryKind: e.kind, entryId: e.id, documentId: null,
      what: e.body, kindWords, notes: '', amount: e.amount == null ? null : Number(e.amount),
      byName, source: e.via_portal ? 'firm' : 'office', viaPortal: e.via_portal,
      state: voided ? 'undone' : 'happened', stateWords: voided ? `Undone${voidReason ? `: ${voidReason}` : '.'}` : '',
      plannedYmd: null, doneYmd: null, held: false, heldReason: '', voided, voidReason, isLivePlan: false, documents: [],
      sortKey: `${e.occurred_on}|${e.created_at}`,
    })
  }

  for (const d of documents) {
    items.push({
      key: `doc:${d.id}`, ymd: d.addedOn, kind: 'document', entryKind: null, entryId: null, documentId: d.id,
      what: d.title, kindWords: '', notes: d.shows, amount: null,
      byName: d.addedByName || 'the office', source: 'office', viaPortal: false,
      state: 'happened', stateWords: 'Added to Evidence.', plannedYmd: null, doneYmd: null,
      held: d.held, heldReason: d.heldReason, voided: false, voidReason: '', isLivePlan: false, documents: [],
      sortKey: `${d.addedOn}|${d.addedAt}`,
    })
  }

  items.sort((a, b) => a.sortKey.localeCompare(b.sortKey))
  const past: LegalTimelineItem[] = []
  const today: LegalTimelineItem[] = []
  const upcoming: LegalTimelineItem[] = []
  const counts = { planned: 0, overdue: 0, dueToday: 0, done: 0, held: 0 }
  for (const it of items) {
    const { sortKey: _s, ...item } = it
    void _s
    const b = bucketOf(item.ymd, todayYmd)
    ;(b === 'past' ? past : b === 'today' ? today : upcoming).push(item)
    if (item.kind === 'plan' && !item.voided) {
      if (item.state === 'done') counts.done++
      else counts.planned++
      if (item.state === 'overdue') counts.overdue++
      if (item.state === 'due_today') counts.dueToday++
    }
    if (item.held) counts.held++
  }
  return { past, today, upcoming, counts }
}

/** The line one section title reads over the whole timeline: *3 planned · 1 overdue · 2 done*. */
export function timelineCountsWords(c: LegalTimeline['counts']): string {
  const parts: string[] = []
  if (c.planned) parts.push(`${c.planned} planned`)
  if (c.overdue) parts.push(`${c.overdue} overdue`)
  if (c.dueToday) parts.push(`${c.dueToday} due today`)
  if (c.done) parts.push(`${c.done} done`)
  return parts.join(' · ')
}

// ---------- the events as a list for the narrative (punch list #167, step 3) ----------

/** The heading the narrative's outline gives the story; *Insert the events* lands under it. */
export const NARRATIVE_EVENTS_HEADING = /^#{1,6}\s+what happened\b.*$/im

/**
 * Every live event on the line as a dated Markdown list, oldest first: `- **Oct 22** — The GC's notice arrived. Notes.`
 * '' when there is none. The year is written when it is not today's.
 */
export function eventsNarrativeMarkdown(timeline: LegalTimeline, todayYmd: string): string {
  const events = [...timeline.past, ...timeline.today].filter((i) => i.kind === 'event' && !i.voided)
  if (events.length === 0) return ''
  return events.map((i) => `- **${timelineDayWords(i.ymd, todayYmd).replace(/^\w{3}, /, '')}** — ${i.what}${i.notes ? ` ${i.notes}` : ''}${i.documents.length ? ` (${i.documents.map((d) => d.title).join(', ')})` : ''}`).join('\n')
}

/**
 * Paste the events list into the narrative: under the *What happened* heading when the text has one
 * (after the heading and any lines already there), else at the end under its own heading. Idempotent
 * in spirit: a line already present word for word is not added twice.
 */
export function insertEventsIntoNarrative(markdown: string, eventsMarkdown: string): string {
  if (!eventsMarkdown.trim()) return markdown
  const have = new Set(markdown.split('\n').map((l) => l.trim()))
  const fresh = eventsMarkdown.split('\n').filter((l) => !have.has(l.trim()))
  if (fresh.length === 0) return markdown
  const block = fresh.join('\n')
  const lines = markdown.split('\n')
  const at = lines.findIndex((l) => NARRATIVE_EVENTS_HEADING.test(l))
  if (at === -1) return `${markdown.trimEnd()}${markdown.trim() ? '\n\n' : ''}## What happened\n\n${block}\n`
  // The section runs to the next heading; the list goes at its end.
  let end = at + 1
  while (end < lines.length && !/^#{1,6}\s/.test(lines[end]!)) end++
  while (end > at + 1 && lines[end - 1]!.trim() === '') end--
  const before = lines.slice(0, end)
  const after = lines.slice(end)
  const gap = before[before.length - 1]!.trim() === '' || before.length === at + 1 ? [''] : ['']
  return [...before, ...gap, block, '', ...after].join('\n').replace(/\n{3,}/g, '\n\n')
}
