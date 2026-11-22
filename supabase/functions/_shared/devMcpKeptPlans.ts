// The dev seat's half of the one approvals list (punch list #315, upgrade 3a). A plan the seat makes on a person's HR
// file lived only in the session that made it: with many sessions on one file the owner said "Apply it" in each, and a
// plan was lost when its session ended. dev_seat_kept_plans (migration 20261113120000) holds a plan for that yes, and
// this is how the seat reaches it:
//
//   · keep: true on plan_hr_entry, plan_person_doc or plan_person_report, with one paragraph of words, stores the
//     plan after its dry run through dev_kept_plan_keep and answers kept_id. The stored arguments are the verb's own,
//     whole; the hash is the plan's own. Nothing about plan then apply changes.
//   · list_kept_plans reads the plans that wait, as words, and one plan whole by id: its arguments and its hash, so a
//     session that did not make the plan can apply it on the owner's yes.
//   · An apply that lands marks the kept plan applied, and an apply of the kept arguments whose dry run no longer
//     matches marks it stale with the mismatch in words. So the list on People → HR is true without a second press.
//   · drop_kept_plan takes a waiting plan off with a reason.
//
// The door decides what may be kept: never a file's bytes, never counsel-only material, never a plan that writes to
// another person's file. This kernel says the first two in words before the ask leaves (keptPlans.ts → keepRefusal).
//
// Pure: no env, no network, nothing that runs at load. The reads are query strings the seat sends as the dev, since a
// plan's hash is a column the door's generic reads redact by its name, and a kept plan is no use without it.
import { KEEPABLE_PLAN_VERBS, isKeepablePlanVerb, keepPayload, keepRefusal, keptByWords, keptPlanAgeWords, keptPlanApplyVerb, keptPlanArgKey, keptPlanSubject, keptPlansToShow, type KeepablePlanVerb } from './keptPlans.ts'

type Json = Record<string, unknown>
const obj = (v: unknown): Json | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const HASH_RE = /^[0-9a-f]{64}$/

export const KEPT_WORDS_MAX = 1200
export const KEPT_SESSION_MAX = 120
export const KEPT_WHY_MAX = 500
/** The table refuses arguments past 400,000 bytes and a reply past 60,000; the seat stops short of both. */
export const KEPT_ARGS_MAX_BYTES = 380_000
export const KEPT_REPLY_MAX_BYTES = 48_000
const KEPT_REPLY_PREVIEW_CHARS = 30_000

/** The keys a plan verb takes for the seat itself, beside its own arguments: never stored, never hashed. */
const SEAT_KEYS = ['keep', 'words', 'session', 'plan_hash'] as const

const bytesOf = (v: unknown): number => new TextEncoder().encode(JSON.stringify(v ?? null)).length

/** JSON with object keys sorted at every depth: two argument sets that mean the same thing read alike. */
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  const o = obj(value)
  if (o) return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${stableJson(o[k])}`).join(',')}}`
  return value === undefined ? 'null' : JSON.stringify(value)
}

/** A plan verb's arguments as a kept plan stores them: the verb's own, without the seat's keys. */
export function keptPlanStoredArgs(args: Json): Json {
  const out: Json = {}
  for (const [k, v] of Object.entries(args)) if (!(SEAT_KEYS as readonly string[]).includes(k)) out[k] = v
  return out
}

/** Whether the arguments an apply sent are the arguments a kept plan holds. */
export function sameKeptArgs(stored: unknown, sent: Json): boolean {
  return stableJson(stored) === stableJson(keptPlanStoredArgs(sent))
}

export type KeepAsk = { ok: true; verb: KeepablePlanVerb; words: string; session: string | null; stored: Json } | { ok: false; error: string }

/**
 * What a plan call asks of the approvals list: null when it asks nothing (no `keep`, or `keep: false`), the ask when
 * it may be kept, or why not, in words, before any dry run runs. `keep: true` on an apply, or on a verb the list does
 * not take, is refused here and never passes unseen.
 *
 * `keep` is this list's key only as a boolean. Another verb may own a key of that name with another meaning:
 * plan_theme_review's `keep` is the list of marks to keep, and it is left to that verb untouched.
 */
export function keepAsk(verb: string, args: Json): KeepAsk | null {
  if (args.keep === undefined || args.keep === null || args.keep === false) return null
  const ofTheList = isKeepablePlanVerb(verb) || keptPlanVerbOfApply(verb) !== null
  if (args.keep !== true) return ofTheList ? { ok: false, error: `${verb}: keep is true, or left out.` } : null
  if (verb.startsWith('apply_')) return { ok: false, error: `${verb}: keep goes on the plan, not the apply. Plan with keep: true and words, and the plan waits for a yes.` }
  const stored = keptPlanStoredArgs(args)
  const refusal = keepRefusal(verb, stored)
  if (refusal) return { ok: false, error: `${verb}: ${refusal}` }
  const words = typeof args.words === 'string' ? args.words.trim() : ''
  if (words.length < 1 || words.length > KEPT_WORDS_MAX) {
    return { ok: false, error: `${verb}: a kept plan needs words — one paragraph, 1 to ${KEPT_WORDS_MAX} characters, that tells the person who says yes what the plan does and why. It is what People → HR shows under Waiting on you.` }
  }
  let session: string | null = null
  if (args.session !== undefined && args.session !== null) {
    const s = typeof args.session === 'string' ? args.session.trim() : null
    if (s === null || s.length > KEPT_SESSION_MAX) return { ok: false, error: `${verb}: session is the name this session goes by, under ${KEPT_SESSION_MAX} characters.` }
    session = s || null
  }
  if (bytesOf(stored) > KEPT_ARGS_MAX_BYTES) return { ok: false, error: `${verb}: a plan this large is not kept (its arguments pass ${KEPT_ARGS_MAX_BYTES.toLocaleString('en-US')} bytes). Apply it in its session, or plan it a section at a time.` }
  return { ok: true, verb: verb as KeepablePlanVerb, words, session, stored }
}

/** The person a keepable plan's own arguments name; a field report's plan names none, so its caller reads the report. */
export function keptPlanPersonOfArgs(verb: KeepablePlanVerb, stored: Json): string | null {
  if (verb === 'plan_person_report') return null
  const inner = obj(stored[keptPlanArgKey(verb)])
  const id = typeof inner?.person_id === 'string' ? inner.person_id.trim().toLowerCase() : ''
  return UUID_RE.test(id) ? id : null
}

/** The dry run's reply as a kept plan stores it: whole when it fits, else its hash and the first of its words. */
export function keptReplyForStore(planned: unknown): Json {
  const whole = obj(planned) ?? { result: planned ?? null }
  if (bytesOf(whole) <= KEPT_REPLY_MAX_BYTES) return whole
  const text = JSON.stringify(whole)
  let preview = text.slice(0, KEPT_REPLY_PREVIEW_CHARS)
  while (bytesOf(preview) > KEPT_REPLY_MAX_BYTES - 2000) preview = preview.slice(0, Math.floor(preview.length * 0.8))
  return {
    shortened: true,
    plan_hash: typeof whole.plan_hash === 'string' ? whole.plan_hash : null,
    why: `The dry run answered ${text.length.toLocaleString('en-US')} characters; a kept plan holds the first ${preview.length.toLocaleString('en-US')}. Plan again with the kept arguments to read it whole.`,
    preview,
  }
}

/** dev_kept_plan_keep's body, from an ask that may be kept. */
export function keepBody(ask: Extract<KeepAsk, { ok: true }>, personId: string, planHash: string, planned: unknown): Json {
  return { p: keepPayload({ personId, verb: ask.verb, args: ask.stored, planHash, reply: keptReplyForStore(planned), words: ask.words, session: ask.session }) }
}

/** What a plan's reply says once it is kept. */
export function keptWords(verb: KeepablePlanVerb, door: unknown): Json {
  const d = obj(door) ?? {}
  const id = typeof d.kept_id === 'string' ? d.kept_id : null
  const waiting = typeof d.waiting === 'number' ? d.waiting : null
  return {
    kept_id: id,
    kept: {
      state: 'waiting',
      waiting_on_this_file: waiting,
      next: `Kept for a yes: it shows on People → HR under Waiting on you, and list_kept_plans reads it from any session. On the owner's yes for this plan, call ${keptPlanApplyVerb(verb)} with the same arguments and plan_hash; that marks it applied. drop_kept_plan { id, why } takes it off. A plan whose dry run no longer matches turns stale: plan again and keep the new plan.`,
    },
  }
}

/** What a plan's reply says when the door would not keep it: the plan itself still stands in this session. */
export function notKeptWords(why: string): Json {
  return { kept_id: null, not_kept: { why, next: 'The plan above still stands in this session: apply it here on the owner\'s yes, as before.' } }
}

// ── the reads ──────────────────────────────────────────────────────────────────────────────────────

/** The columns the list reads: the words, never the arguments. One plan whole adds `args` and `reply`. */
export const KEPT_PLAN_LIST_COLUMNS = 'id,person_id,verb,plan_hash,words,author_label,session_label,kept_at,state,decided_label,decided_at,decided_why'
export const KEPT_PLAN_WHOLE_COLUMNS = `${KEPT_PLAN_LIST_COLUMNS},args,reply`
export const KEPT_PLAN_LIST_MAX = 200

export type KeptPlanRead = {
  id: string
  person_id: string
  verb: string
  plan_hash: string
  words: string
  author_label: string | null
  session_label: string | null
  kept_at: string
  state: string
  decided_label: string | null
  decided_at: string | null
  decided_why: string | null
  args?: unknown
  reply?: unknown
}

export type KeptPlansAsk = { ok: true; id: string | null; person: string | null; show: 'waiting' | 'all' } | { ok: false; error: string }

/** list_kept_plans' input: { person? (an id or a name), id? (one plan whole), show?: waiting | all }. */
export function keptPlansInput(input: Json): KeptPlansAsk {
  const id = typeof input.id === 'string' ? input.id.trim().toLowerCase() : ''
  if (id && !UUID_RE.test(id)) return { ok: false, error: 'list_kept_plans: id is a kept plan\'s id, as kept_id names it and as the list answers it.' }
  const person = typeof input.person === 'string' ? input.person.trim() : ''
  const show = input.show === undefined || input.show === null ? 'waiting' : input.show
  if (show !== 'waiting' && show !== 'all') return { ok: false, error: 'list_kept_plans: show is waiting (the plans that wait, and the ones that went stale this week) or all (every kept plan, decided or not).' }
  return { ok: true, id: id || null, person: person || null, show }
}

/** The REST query for the list: a person's plans or everyone's, newest kept first, at most KEPT_PLAN_LIST_MAX. */
export function keptPlansListQuery(personId: string | null, show: 'waiting' | 'all'): string {
  const parts = [`select=${KEPT_PLAN_LIST_COLUMNS}`]
  if (personId) parts.push(`person_id=eq.${personId}`)
  if (show === 'waiting') parts.push('state=in.(waiting,stale)')
  parts.push('order=kept_at.desc', `limit=${KEPT_PLAN_LIST_MAX}`)
  return parts.join('&')
}

/** The REST query for one plan whole. */
export function keptPlanWholeQuery(id: string): string {
  return `select=${KEPT_PLAN_WHOLE_COLUMNS}&id=eq.${id}&limit=1`
}

/** The REST query for the waiting plans that carry a hash under a verb: what an apply settles. Null for a hash that is not one. */
export function keptPlanByHashQuery(planVerb: string, planHash: string): string | null {
  if (!isKeepablePlanVerb(planVerb) || !HASH_RE.test(planHash)) return null
  return `select=id,person_id,verb,plan_hash,args,state&verb=eq.${planVerb}&plan_hash=eq.${planHash}&state=eq.waiting&limit=5`
}

/** v2.8102: every kept plan under a verb and hash that waits or was taken off: what an apply reads before it writes. */
export function keptPlanOffQuery(planVerb: string, planHash: string): string | null {
  if (!isKeepablePlanVerb(planVerb) || !HASH_RE.test(planHash)) return null
  return `select=id,args,state,decided_label,decided_why&verb=eq.${planVerb}&plan_hash=eq.${planHash}&state=in.(waiting,dropped,stale)&order=kept_at.desc&limit=20`
}

/**
 * v2.8102: why an apply is refused for a kept plan that was taken off, or null. Only the rows whose arguments are the
 * arguments sent count. One that still waits lets the apply through, since a plan kept again after a drop is a new
 * ask. Else the newest dropped or stale one refuses it, with who and why.
 */
export function keptPlanOffWords(rows: ReadonlyArray<{ args?: unknown; state: string; decided_label?: string | null; decided_why?: string | null }>, sent: Json): string | null {
  const mine = rows.filter((r) => sameKeptArgs(r.args, sent))
  if (mine.some((r) => r.state === 'waiting')) return null
  const off = mine.find((r) => r.state === 'dropped' || r.state === 'stale')
  if (!off) return null
  const why = keptPlanWhyTail(off.decided_why)
  if (off.state === 'stale') return `Nothing written: this plan was kept for a yes and went stale${why} Plan again, and keep the new plan if it still needs a yes.`
  return `Nothing written: this plan was kept for a yes and dropped${off.decided_label?.trim() ? ` by ${off.decided_label.trim()}` : ''}${why} A dropped plan is never applied. If it is wanted after all, plan it again with keep: true and wait for the yes.`
}

/**
 * v2.8242: the reason as the end of a sentence, with one stop whatever the reason was written with. A person's reason
 * may end in a full stop and the stale check's may not, and the off words read either with two stops or with none.
 */
export function keptPlanWhyTail(why: string | null | undefined): string {
  const said = (why ?? '').trim().replace(/[.\s]+$/, '')
  if (!said) return '.'
  return /[!?]$/.test(said) ? `: ${said}` : `: ${said}.`
}

/** v2.8102: the fixed documents an HR entry plan replaces or adds to. The plan commits to when each last changed. */
export function hrEntryReplacedKinds(p: unknown): string[] {
  const e = obj(p)
  if (!e) return []
  return [...(typeof e.summary === 'string' ? ['summary'] : []), ...(typeof e.narrative === 'string' || typeof e.narrative_append === 'string' ? ['narrative'] : [])]
}

/** The dry run's reply with `replaces`: when each replaced document last changed, null for one not written yet. */
export function withReplaces(reply: unknown, kinds: readonly string[], rows: ReadonlyArray<{ kind?: unknown; updated_at?: unknown }>): unknown {
  const r = obj(reply)
  if (!r || kinds.length === 0) return reply
  return { ...r, replaces: Object.fromEntries(kinds.map((k) => [k, rows.find((x) => x.kind === k)?.updated_at ?? null])) }
}

const applyWords = (verb: string): string => `${keptPlanApplyVerb(verb)} with the kept arguments and plan_hash`

/** One row of the list: who it is about, what it would do in the keeper's words, how long it has waited. */
function listRow(r: KeptPlanRead, nameOf: (personId: string) => string | null, todayYmd: string, ymdOf: (iso: string) => string): Json {
  const keptYmd = ymdOf(r.kept_at)
  return {
    kept_id: r.id,
    person: { id: r.person_id, name: nameOf(r.person_id) },
    about: keptPlanSubject(r.verb),
    verb: r.verb,
    state: r.state,
    words: r.words,
    kept: keptByWords(r, keptYmd),
    kept_at: r.kept_at,
    ...(r.state === 'waiting' ? { age: keptPlanAgeWords(keptYmd, todayYmd), plan_hash: r.plan_hash } : {}),
    ...(r.state !== 'waiting' ? { decided: { by: r.decided_label ?? '', at: r.decided_at, ...(r.decided_why ? { why: r.decided_why } : {}) } } : {}),
  }
}

/**
 * The list as the seat answers it. `waiting`: the plans that wait, the one that has waited longest first, then the
 * ones that went stale in the last seven days, as People → HR lists them. `all`: every row read, newest kept first.
 */
export function keptPlansListReply(rows: ReadonlyArray<KeptPlanRead>, ask: { show: 'waiting' | 'all'; person: { id: string; name: string } | null }, nameOf: (personId: string) => string | null, todayYmd: string, ymdOf: (iso: string) => string): Json {
  const draw = (r: KeptPlanRead) => listRow(r, nameOf, todayYmd, ymdOf)
  const waitingCount = rows.filter((r) => r.state === 'waiting').length
  const head = {
    person: ask.person,
    show: ask.show,
    waiting: waitingCount,
    at_cap: rows.length >= KEPT_PLAN_LIST_MAX,
  }
  const next = `A waiting plan is applied only on the owner's yes for that plan: list_kept_plans { id } answers one whole, with the arguments and the hash, and ${KEEPABLE_PLAN_VERBS.map((v) => keptPlanApplyVerb(v)).join(' / ')} applies it and marks it applied. drop_kept_plan { id, why } takes one off. A stale plan's dry run no longer matched: plan again and keep the new plan.`
  if (ask.show === 'all') return { ...head, plans: rows.map(draw), next }
  const shown = keptPlansToShow(rows, todayYmd, ymdOf)
  return { ...head, plans: shown.waiting.map(draw), stale_this_week: shown.stale.map(draw), next }
}

/** One plan whole: its row, the arguments and the reply as kept, and the call that applies it. */
export function keptPlanWholeReply(r: KeptPlanRead, personName: string | null, todayYmd: string, ymdOf: (iso: string) => string): Json {
  const args = obj(r.args) ?? {}
  const waiting = r.state === 'waiting'
  return {
    ...listRow(r, () => personName, todayYmd, ymdOf),
    plan_hash: r.plan_hash,
    args,
    reply_as_kept: r.reply ?? {},
    apply: waiting
      ? { verb: keptPlanApplyVerb(r.verb), arguments: { ...args, plan_hash: r.plan_hash }, rule: `Only on the owner's yes for this plan. ${applyWords(r.verb)} runs the dry run again and writes only when it still matches; it then marks this plan applied. If it no longer matches, the plan turns stale: plan again and keep the new plan.` }
      : null,
  }
}

// ── an apply settles a kept plan ───────────────────────────────────────────────────────────────────

/** The plan verb behind an apply of a keepable verb, or null. */
export function keptPlanVerbOfApply(applyVerb: string): KeepablePlanVerb | null {
  const plan = applyVerb.startsWith('apply_') ? `plan_${applyVerb.slice('apply_'.length)}` : ''
  return isKeepablePlanVerb(plan) ? plan : null
}

/** dev_kept_plan_decide's body. `why` is cut to the door's 500 characters. */
export function decideBody(id: string, state: 'applied' | 'dropped' | 'stale', why?: string | null): Json {
  const w = (why ?? '').trim()
  return { p_id: id, p_state: state, ...(w ? { p_why: w.length > KEPT_WHY_MAX ? `${w.slice(0, KEPT_WHY_MAX - 1).trimEnd()}…` : w } : {}) }
}

/** The waiting rows an apply that failed its hash turns stale: the ones whose kept arguments are the arguments sent. */
export function staleCandidates(rows: ReadonlyArray<{ id: string; args?: unknown }>, sent: Json): string[] {
  return rows.filter((r) => sameKeptArgs(r.args, sent)).map((r) => r.id)
}

/** What an apply's reply says of the kept plan it settled. */
export function settledWords(ids: readonly string[], state: 'applied' | 'stale', failed: string | null): Json {
  if (failed) return { kept: { state: 'waiting', kept_ids: ids, note: `The kept plan could not be marked ${state}: ${failed}. drop_kept_plan { id, why } takes it off the list.` } }
  if (ids.length === 0) return {}
  return { kept: { state, kept_ids: ids, note: state === 'applied' ? 'The kept plan is marked applied and is off Waiting on you.' : 'The kept plan no longer matches its dry run and is marked stale. Plan again, and keep the new plan if it still needs a yes.' } }
}

/** The sentence a refused apply ends with when it turned a kept plan stale; empty when it settled none. */
export function staleSentence(bits: Json): string {
  const kept = obj(bits.kept)
  if (!kept) return ''
  return kept.state === 'stale' ? ' The plan kept for a yes with these arguments is marked stale: plan again, and keep the new plan if it still needs a yes.' : ` ${String(kept.note ?? '')}`
}

// ── drop_kept_plan ─────────────────────────────────────────────────────────────────────────────────

/** drop_kept_plan's input: { id (a kept plan's id), why (1 to 500 characters) }. */
export function dropKeptPlanInput(input: Json): { ok: true; body: Json; target: string } | { ok: false; error: string } {
  const shape = `drop_kept_plan needs id (a kept plan's id: list_kept_plans) and why — the reason it comes off, 1 to ${KEPT_WHY_MAX} characters. A dropped plan stays on the table with its reason and is never applied; the plan itself wrote nothing.`
  const id = typeof input.id === 'string' ? input.id.trim().toLowerCase() : ''
  const why = typeof input.why === 'string' ? input.why.trim() : ''
  if (!UUID_RE.test(id) || why.length < 1 || why.length > KEPT_WHY_MAX) return { ok: false, error: shape }
  return { ok: true, body: decideBody(id, 'dropped', why), target: id }
}
