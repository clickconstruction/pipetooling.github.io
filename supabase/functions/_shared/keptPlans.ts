/**
 * One approvals list (punch list #315, upgrade 3a): the pure half of `dev_seat_kept_plans` (migration
 * 20261113120000). A kept plan is a plan the dev seat made on a person's HR file, held on the server for a yes: the
 * verb, its arguments, the plan hash and one paragraph of words. This kernel answers what the People → HR tab and the
 * seat both need: which plans may be kept and why another may not, what a row is in words, how long it has waited,
 * and the list in the order it is read.
 *
 * Nothing here applies a plan. An apply is the plan verb's own: the same arguments and the same hash, the dry run run
 * again. No app import, so the tab (`src/lib/people/keptPlans.ts` is its door) and `dev-mcp` draw from one
 * implementation.
 */

/** The plan verbs a kept plan may carry, as `dev_kept_plan_verbs()` lists them: about a person's file, words alone. */
export const KEEPABLE_PLAN_VERBS = ['plan_hr_entry', 'plan_person_doc', 'plan_person_report'] as const
export type KeepablePlanVerb = (typeof KEEPABLE_PLAN_VERBS)[number]

export type KeptPlanState = 'waiting' | 'applied' | 'dropped' | 'stale'

/** A `dev_seat_kept_plans` row as the list reads it: the words, never the arguments. */
export type KeptPlanRow = {
  id: string
  person_id: string
  verb: string
  words: string
  author_label: string | null
  session_label: string | null
  kept_at: string
  state: string
  decided_label: string | null
  decided_at: string | null
  decided_why: string | null
}

export function isKeepablePlanVerb(verb: string): verb is KeepablePlanVerb {
  return (KEEPABLE_PLAN_VERBS as readonly string[]).includes(verb)
}

/** The key the verb's arguments sit under: `plan_hr_entry { entry }`, `plan_person_doc { doc }`, `plan_person_report { report }`. */
export function keptPlanArgKey(verb: KeepablePlanVerb): 'entry' | 'doc' | 'report' {
  return verb === 'plan_hr_entry' ? 'entry' : verb === 'plan_person_doc' ? 'doc' : 'report'
}

/** What a plan is about, in words for a row: *an HR entry* · *an HR document* · *a field report*. */
export function keptPlanSubject(verb: string): string {
  switch (verb) {
    case 'plan_hr_entry':
      return 'an HR entry'
    case 'plan_person_doc':
      return 'an HR document'
    case 'plan_person_report':
      return 'a field report'
    default:
      return 'a plan'
  }
}

/** The verb that applies a kept plan: `plan_hr_entry` → `apply_hr_entry`. */
export function keptPlanApplyVerb(verb: string): string {
  return verb.startsWith('plan_') ? `apply_${verb.slice('plan_'.length)}` : verb
}

/** Whether a value carries `key` anywhere inside it, with `match` true of what it holds. */
function carries(value: unknown, key: string, match: (v: unknown) => boolean): boolean {
  if (Array.isArray(value)) return value.some((v) => carries(v, key, match))
  if (!value || typeof value !== 'object') return false
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (k === key && match(v)) return true
    if (carries(v, key, match)) return true
  }
  return false
}

/**
 * Why a plan cannot be kept, in words, or null when it can. Mirrors the door's refusals for what the seat can see
 * before it asks: a verb off the list, a file's bytes in the arguments, and anything marked counsel-only. The door
 * also refuses a change to a counsel-only document and a plan that writes to another person's file.
 */
export function keepRefusal(verb: string, args: unknown): string | null {
  if (!isKeepablePlanVerb(verb)) return `${verb || 'That'} is not a plan that can be kept. A kept plan is one of ${KEEPABLE_PLAN_VERBS.join(', ')}. Apply this one in its session.`
  if (!args || typeof args !== 'object' || Array.isArray(args)) return 'A kept plan needs the plan verb’s arguments.'
  if (carries(args, 'content_base64', () => true)) return 'A plan that carries a file’s bytes is not kept: the bytes are not stored. Apply it in its session.'
  if (carries(args, 'counsel_only', (v) => v === true)) return 'A counsel-only plan is not kept: its words stay in the session that made it.'
  return null
}

/** `dev_kept_plan_keep`'s payload. The reply is the dry run as shown; the seat caps it before it gets here. */
export function keepPayload(input: { personId: string; verb: KeepablePlanVerb; args: Record<string, unknown>; planHash: string; reply: unknown; words: string; session?: string | null }): Record<string, unknown> {
  return {
    person_id: input.personId,
    verb: input.verb,
    args: input.args,
    plan_hash: input.planHash,
    reply: input.reply ?? {},
    words: input.words.trim(),
    ...(input.session?.trim() ? { session: input.session.trim() } : {}),
  }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const
const dayLabel = (ymd: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  const month = m ? MONTHS[Number(m[2]) - 1] : undefined
  return m && month ? `${month} ${Number(m[3])}, ${m[1]}` : ymd
}

/** Whole days between two calendar days, never below zero. */
export function daysBetweenYmd(fromYmd: string, toYmd: string): number {
  const a = Date.parse(`${fromYmd}T00:00:00Z`)
  const b = Date.parse(`${toYmd}T00:00:00Z`)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0
  return Math.max(0, Math.round((b - a) / 86_400_000))
}

/** *waiting today* · *waiting 1 day* · *waiting 4 days*, by calendar days. */
export function keptPlanAgeWords(keptYmd: string, todayYmd: string): string {
  const days = daysBetweenYmd(keptYmd, todayYmd)
  return days === 0 ? 'waiting today' : `waiting ${days} ${days === 1 ? 'day' : 'days'}`
}

/** A plan that has waited this many days or more wears amber. */
export const KEPT_PLAN_AMBER_DAYS = 2

/** *Kept by Robert's agent, morning session, Nov 10, 2026*: who, from which session, the day. */
export function keptByWords(row: Pick<KeptPlanRow, 'author_label' | 'session_label'>, keptYmd: string): string {
  const who = row.author_label?.trim() ? `${row.author_label.trim()}’s agent` : 'an agent'
  const session = row.session_label?.trim() ? `, ${row.session_label.trim()}` : ''
  return `Kept by ${who}${session}, ${dayLabel(keptYmd)}`
}

/**
 * The rows the list shows, in the order it is read: the plans waiting, oldest first, then the ones that went stale
 * within `staleDays` of today, newest first, so a dev sees why a plan they expected is gone. Applied and dropped
 * plans are not listed.
 */
export function keptPlansToShow<T extends Pick<KeptPlanRow, 'state' | 'kept_at' | 'decided_at' | 'id'>>(rows: ReadonlyArray<T>, todayYmd: string, ymdOf: (iso: string) => string, staleDays = 7): { waiting: T[]; stale: T[] } {
  const waiting = rows.filter((r) => r.state === 'waiting').sort((a, b) => (a.kept_at < b.kept_at ? -1 : a.kept_at > b.kept_at ? 1 : a.id < b.id ? -1 : 1))
  const stale = rows
    .filter((r) => r.state === 'stale' && r.decided_at && daysBetweenYmd(ymdOf(r.decided_at), todayYmd) <= staleDays)
    .sort((a, b) => ((a.decided_at ?? '') < (b.decided_at ?? '') ? 1 : -1))
  return { waiting, stale }
}

/** The head over the list: *Waiting on you (2)*. */
export function keptPlansHeadWords(waiting: number): string {
  return `Waiting on you (${waiting})`
}
