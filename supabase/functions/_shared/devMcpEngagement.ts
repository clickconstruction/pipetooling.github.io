// The dev seat's half of a person's standing over time (punch list #315, upgrade 4c). person_engagements (migration
// 20261113090000) says what a person was by day, employee or subcontractor, a stretch at a time, and People → HR has
// read it since 4b. A session read it through read_rows alone and could not write it. Here, pure, over the tab's own
// kernel (personEngagements.ts):
//
//   · plan_engagement → apply_engagement's input, shaped into dev_engagement_write's payload: exactly one of open,
//     change, close or withdraw. The door's dry run performs the write and unwinds it; its reply carries no clock and
//     no id, so a plan and its apply hash alike, and a second apply is refused by the door (the days overlap, no
//     stretch is running, it was withdrawn already).
//   · The block get_person_file and get_case_brief carry: the standing in words, the stretches that stand with where
//     each fact comes from, and how many were taken off.
//
// Nothing here marks an hour or reads a clock session: which rows are pay placed from payroll is the owner's call.
import { ENGAGEMENT_KINDS, ENGAGEMENT_SOURCES, engagementChangePayload, engagementClosePayload, engagementLineWords, engagementOpenPayload, engagementWithdrawPayload, liveEngagements, standingOn, standingWords, type PersonEngagementRow } from './personEngagements.ts'

type Json = Record<string, unknown>
const obj = (v: unknown): Json | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/
const OPS = ['open', 'change', 'close', 'withdraw'] as const
type Op = (typeof OPS)[number]

export type EngagementVerb = 'plan_engagement' | 'apply_engagement'
export function isEngagementVerb(verb: string): verb is EngagementVerb {
  return verb === 'plan_engagement' || verb === 'apply_engagement'
}

export const ENGAGEMENT_REF_MAX = 300
export const ENGAGEMENT_NOTE_MAX = 1000
export const ENGAGEMENT_WHY_MAX = 200

export function engagementShape(verb: EngagementVerb): string {
  return `${verb} needs engagement — { person_id (the roster row's people.id, as get_case_brief and get_person_file answer it in person.id; find_person answers a login's users.id, which this door refuses), and exactly one of: open: { kind (${ENGAGEMENT_KINDS.join(' | ')}), started_on (YYYY-MM-DD), ended_on? (when the stretch has ended), source (${ENGAGEMENT_SOURCES.join(' | ')}: where the fact comes from), source_ref? (which paper, pay run or record, under ${ENGAGEMENT_REF_MAX}), note? (under ${ENGAGEMENT_NOTE_MAX}) } | change: { kind, on (the day the new kind takes hold; the running stretch ends the day before), source, source_ref?, note? } | close: { ended_on (the running stretch's last day) } | withdraw: { id (a person_engagements.id: get_person_file's engagements), why (1 to ${ENGAGEMENT_WHY_MAX} characters) } }. Two stretches of a person never share a day.`
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
/** A calendar day that exists: `2026-02-30` reads as a day to a parser that rolls it into March, so it is checked there and back. */
const isDay = (v: unknown): v is string => {
  if (typeof v !== 'string' || !YMD_RE.test(v.trim())) return false
  const [y, m, d] = v.trim().split('-').map(Number) as [number, number, number]
  const back = new Date(Date.UTC(y, m - 1, d))
  return back.getUTCFullYear() === y && back.getUTCMonth() === m - 1 && back.getUTCDate() === d
}

/** The source and its two free lines, shared by open and change; a string when one cannot be read. */
function fromWhere(op: Json): { source: string; sourceRef: string; note: string } | string {
  const source = str(op.source)
  if (!(ENGAGEMENT_SOURCES as readonly string[]).includes(source)) return `source is one of ${ENGAGEMENT_SOURCES.join(', ')}: where the fact comes from`
  const sourceRef = op.source_ref === undefined || op.source_ref === null ? '' : typeof op.source_ref === 'string' ? op.source_ref.trim() : null
  const note = op.note === undefined || op.note === null ? '' : typeof op.note === 'string' ? op.note.trim() : null
  if (sourceRef === null || sourceRef.length > ENGAGEMENT_REF_MAX) return `source_ref is words, under ${ENGAGEMENT_REF_MAX} characters`
  if (note === null || note.length > ENGAGEMENT_NOTE_MAX) return `note is words, under ${ENGAGEMENT_NOTE_MAX} characters`
  return { source, sourceRef, note }
}

/** plan_engagement / apply_engagement's input as dev_engagement_write's `p`, through the tab's own payload builders. */
export function engagementInput(verb: EngagementVerb, input: Json): { ok: true; p: Json; target: string; op: Op } | { ok: false; error: string } {
  const shape = engagementShape(verb)
  const e = obj(input.engagement)
  const personId = str(e?.person_id).toLowerCase()
  if (!e || !UUID_RE.test(personId)) return { ok: false, error: shape }
  const refuse = (why: string) => ({ ok: false as const, error: `${verb}: ${why}. ${shape}` })
  const named = OPS.filter((k) => k in e)
  if (named.length !== 1) return refuse(`names ${named.length === 0 ? 'none' : named.join(' and ')} of open, change, close, withdraw: one call is exactly one of them`)
  const op = named[0]!
  const body = obj(e[op])
  if (!body) return refuse(`${op} is an object`)
  if (op === 'open' || op === 'change') {
    const kind = str(body.kind)
    if (!(ENGAGEMENT_KINDS as readonly string[]).includes(kind)) return refuse(`${op}.kind is ${ENGAGEMENT_KINDS.join(' or ')}`)
    const where = fromWhere(body)
    if (typeof where === 'string') return refuse(`${op}.${where}`)
    if (op === 'change') {
      if (!isDay(body.on)) return refuse('change.on is a day, YYYY-MM-DD')
      return { ok: true, p: engagementChangePayload(personId, { kind, on: body.on.trim(), ...where }), target: personId, op }
    }
    if (!isDay(body.started_on)) return refuse('open.started_on is a day, YYYY-MM-DD')
    let ended: string | null = null
    if (body.ended_on !== undefined && body.ended_on !== null) {
      if (!isDay(body.ended_on)) return refuse('open.ended_on is a day, YYYY-MM-DD, or left out while the stretch runs')
      ended = body.ended_on.trim()
    }
    if (ended !== null && ended < body.started_on.trim()) return refuse('open.ended_on is before open.started_on')
    return { ok: true, p: engagementOpenPayload(personId, { kind, startedOn: body.started_on.trim(), endedOn: ended, ...where }), target: personId, op }
  }
  if (op === 'close') {
    if (!isDay(body.ended_on)) return refuse('close.ended_on is a day, YYYY-MM-DD')
    return { ok: true, p: engagementClosePayload(personId, body.ended_on.trim()), target: personId, op }
  }
  const id = str(body.id).toLowerCase()
  const why = str(body.why)
  if (!UUID_RE.test(id)) return refuse('withdraw.id is the stretch\'s id, as get_person_file\'s engagements lists it')
  if (why.length < 1 || why.length > ENGAGEMENT_WHY_MAX) return refuse(`withdraw.why is 1 to ${ENGAGEMENT_WHY_MAX} characters`)
  return { ok: true, p: engagementWithdrawPayload(personId, id, why), target: personId, op }
}

/** A standing call as the call log keeps it: the person, which of the four, the kind and the days. Never a reference, a note or a reason. */
export function engagementArgsForLog(verb: string, args: Json): Json {
  const e = obj(args.engagement)
  const op = e ? OPS.find((k) => k in e) ?? null : null
  const body = op && e ? obj(e[op]) : null
  const day = (k: string) => (typeof body?.[k] === 'string' ? (body[k] as string).slice(0, 10) : undefined)
  return {
    engagement: e ? { person_id: typeof e.person_id === 'string' ? e.person_id : null, op, ...(typeof body?.kind === 'string' ? { kind: body.kind.slice(0, 20) } : {}), ...(day('started_on') ? { started_on: day('started_on') } : {}), ...(day('on') ? { on: day('on') } : {}), ...(day('ended_on') ? { ended_on: day('ended_on') } : {}), ...(typeof body?.id === 'string' ? { id: body.id.slice(0, 36) } : {}) } : null,
    ...(verb === 'apply_engagement' ? { plan_hash: typeof args.plan_hash === 'string' ? args.plan_hash.trim().toLowerCase() : args.plan_hash ?? null } : {}),
  }
}

// ── the block the reads carry ──────────────────────────────────────────────────────────────────────

export const ENGAGEMENT_SELECT = 'id,kind,started_on,ended_on,source,source_ref,note,withdrawn_at'

/**
 * A person's standing as get_person_file and get_case_brief answer it: what they are now in the strip's words, what
 * they were today, and each stretch that stands, oldest first, with where its fact comes from. A stretch taken off is
 * counted and not listed.
 */
export function engagementsBlock(rows: ReadonlyArray<PersonEngagementRow>, todayYmd: string) {
  const live = liveEngagements(rows)
  const today = standingOn(rows, todayYmd)
  return {
    standing: standingWords(rows),
    today: today ? today.kind : null,
    stretches: live.map((e) => ({ id: e.id, kind: e.kind, started_on: e.startedOn, ended_on: e.endedOn, source: e.source, ...(e.sourceRef.trim() ? { source_ref: e.sourceRef.trim() } : {}), ...(e.note.trim() ? { note: e.note.trim() } : {}), words: engagementLineWords(e) })),
    taken_off: rows.filter((r) => r.withdrawn_at).length,
  }
}
