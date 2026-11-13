/**
 * Engagement history on a person's HR file (punch list #315, upgrade 4a): the pure half of `person_engagements`
 * (migration 20261113090000). A row is one stretch in one capacity, employee or subcontractor, with its first day, its
 * last day (null while it runs) and where the fact comes from. This kernel answers what the People → HR tab and the dev
 * seat both need: the stretches that stand, a person's standing on a given day, the words the fact strip wears, why a
 * new stretch cannot be recorded, and the payloads of the one door (`dev_engagement_write`).
 *
 * No app import, so the tab (`src/lib/people/personEngagements.ts` is its door) and `dev-mcp` draw from one
 * implementation, as they do the links (`personAmendments.ts`).
 */

export type EngagementKind = 'employee' | 'subcontractor'
export type EngagementSource = 'contract' | 'payroll' | 'owner' | 'record' | 'other'

export const ENGAGEMENT_KINDS: readonly EngagementKind[] = ['employee', 'subcontractor']
export const ENGAGEMENT_SOURCES: readonly EngagementSource[] = ['contract', 'payroll', 'owner', 'record', 'other']

/** A `person_engagements` row, as the table hands it over. Days are `YYYY-MM-DD`. */
export type PersonEngagementRow = {
  id: string
  kind: string
  started_on: string
  ended_on: string | null
  source: string
  source_ref: string
  note: string
  withdrawn_at: string | null
}

/** A stretch that stands. */
export type Engagement = { id: string; kind: EngagementKind; startedOn: string; endedOn: string | null; source: EngagementSource; sourceRef: string; note: string }

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/
const isKind = (v: string): v is EngagementKind => v === 'employee' || v === 'subcontractor'
const isSource = (v: string): v is EngagementSource => (ENGAGEMENT_SOURCES as readonly string[]).includes(v)

/**
 * The stretches that stand, oldest first: a withdrawn one is left out, and so is a row of a kind or a source this code
 * does not know (a later migration's), so an old client never draws a stretch it cannot name.
 */
export function liveEngagements(rows: ReadonlyArray<PersonEngagementRow>): Engagement[] {
  const out: Engagement[] = []
  for (const r of rows) {
    if (r.withdrawn_at) continue
    if (!isKind(r.kind) || !isSource(r.source) || !YMD_RE.test(r.started_on)) continue
    out.push({ id: r.id, kind: r.kind, startedOn: r.started_on, endedOn: r.ended_on, source: r.source, sourceRef: r.source_ref, note: r.note })
  }
  return out.sort((a, b) => (a.startedOn < b.startedOn ? -1 : a.startedOn > b.startedOn ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

/** Whether a stretch covers a day; both ends count. */
export function engagementCovers(e: Pick<Engagement, 'startedOn' | 'endedOn'>, ymd: string): boolean {
  return e.startedOn <= ymd && (e.endedOn === null || e.endedOn >= ymd)
}

/** What a person was on a day: the stretch that covers it, or null when none on file does. */
export function standingOn(rows: ReadonlyArray<PersonEngagementRow>, ymd: string): Engagement | null {
  return liveEngagements(rows).find((e) => engagementCovers(e, ymd)) ?? null
}

/** The stretch that is still running, or null. The table's guard allows one at most. */
export function runningEngagement(rows: ReadonlyArray<PersonEngagementRow>): Engagement | null {
  const open = liveEngagements(rows).filter((e) => e.endedOn === null)
  return open[open.length - 1] ?? null
}

/** The newest stretch on file, running or closed: what the fact strip speaks of when nobody is engaged today. */
export function latestEngagement(rows: ReadonlyArray<PersonEngagementRow>): Engagement | null {
  const live = liveEngagements(rows)
  return live[live.length - 1] ?? null
}

/** *Employee* · *Subcontractor*. */
export function engagementKindWords(kind: EngagementKind): string {
  return kind === 'employee' ? 'Employee' : 'Subcontractor'
}

/** Where the fact comes from, in words for a line: *by a signed paper* · *by how they were paid* … */
export function engagementSourceWords(source: EngagementSource): string {
  switch (source) {
    case 'contract':
      return 'by a signed paper'
    case 'payroll':
      return 'by how they were paid'
    case 'owner':
      return "by the owner's statement"
    case 'record':
      return 'by a record on file'
    default:
      return 'by another source'
  }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

/** `2025-03-03` → `Mar 3, 2025`; anything else comes back as it was given. */
export function engagementDayLabel(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  const month = m ? MONTHS[Number(m[2]) - 1] : undefined
  return m && month ? `${month} ${Number(m[3])}, ${m[1]}` : ymd
}

/**
 * What the fact strip wears: *Subcontractor · since Mar 3, 2025 · still engaged* while a stretch runs, *Employee ·
 * Mar 3, 2025 to Aug 29, 2025* for the newest closed one, and null when nothing is on file.
 */
export function standingWords(rows: ReadonlyArray<PersonEngagementRow>): string | null {
  const running = runningEngagement(rows)
  if (running) return `${engagementKindWords(running.kind)} · since ${engagementDayLabel(running.startedOn)} · still engaged`
  const last = latestEngagement(rows)
  if (!last || last.endedOn === null) return null
  return `${engagementKindWords(last.kind)} · ${engagementDayLabel(last.startedOn)} to ${engagementDayLabel(last.endedOn)}`
}

/** One stretch as a line: *Employee from Mar 3, 2025 to Aug 29, 2025, by a signed paper*. */
export function engagementLineWords(e: Engagement): string {
  const days = e.endedOn === null ? `since ${engagementDayLabel(e.startedOn)}` : `from ${engagementDayLabel(e.startedOn)} to ${engagementDayLabel(e.endedOn)}`
  return `${engagementKindWords(e.kind)} ${days}, ${engagementSourceWords(e.source)}`
}

/** A stretch to record, as a form or an agent holds it. */
export type EngagementDraft = { kind: string; startedOn: string; endedOn?: string | null; source: string; sourceRef?: string; note?: string }

/**
 * Why a new stretch cannot be recorded, in words, or null when it can. Mirrors the table's checks for what a reader
 * can see before the write: the kind, the source, the days in order, and a day shared with a stretch that stands.
 */
export function engagementDraftProblem(draft: EngagementDraft, rows: ReadonlyArray<PersonEngagementRow>): string | null {
  if (!isKind(draft.kind)) return 'Pick employee or subcontractor.'
  if (!isSource(draft.source)) return 'Say where the fact comes from.'
  if (!YMD_RE.test(draft.startedOn)) return 'Set the first day.'
  const end = draft.endedOn ?? null
  if (end !== null && !YMD_RE.test(end)) return 'The last day is not a day.'
  if (end !== null && end < draft.startedOn) return 'The last day is before the first day.'
  if ((draft.sourceRef ?? '').length > 300) return 'The reference is longer than 300 characters.'
  if ((draft.note ?? '').length > 1000) return 'The note is longer than 1,000 characters.'
  const clash = liveEngagements(rows).find((e) => e.startedOn <= (end ?? '9999-12-31') && (e.endedOn ?? '9999-12-31') >= draft.startedOn)
  if (clash) return `These days overlap a stretch already on file: ${engagementLineWords(clash)}. A person is in one capacity a day.`
  return null
}

/** `dev_engagement_write`'s payload for a stretch that is not on file yet. */
export function engagementOpenPayload(personId: string, draft: EngagementDraft): Record<string, unknown> {
  return {
    person_id: personId,
    open: { kind: draft.kind, started_on: draft.startedOn, ...(draft.endedOn ? { ended_on: draft.endedOn } : {}), source: draft.source, ...(draft.sourceRef?.trim() ? { source_ref: draft.sourceRef.trim() } : {}), ...(draft.note?.trim() ? { note: draft.note.trim() } : {}) },
  }
}

/** The payload for a change of capacity: the running stretch ends the day before `on`, the new kind starts on it. */
export function engagementChangePayload(personId: string, change: { kind: string; on: string; source: string; sourceRef?: string; note?: string }): Record<string, unknown> {
  return { person_id: personId, change: { kind: change.kind, on: change.on, source: change.source, ...(change.sourceRef?.trim() ? { source_ref: change.sourceRef.trim() } : {}), ...(change.note?.trim() ? { note: change.note.trim() } : {}) } }
}

/** The payload that ends the running stretch on a day. */
export function engagementClosePayload(personId: string, endedOn: string): Record<string, unknown> {
  return { person_id: personId, close: { ended_on: endedOn } }
}

/** The payload that takes a stretch made by mistake off, with its reason. */
export function engagementWithdrawPayload(personId: string, id: string, why: string): Record<string, unknown> {
  return { person_id: personId, withdraw: { id, why: why.trim() } }
}
